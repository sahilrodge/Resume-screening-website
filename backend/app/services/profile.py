"""Unified profile business logic for all roles."""

from __future__ import annotations

from fastapi import UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import AppException, ConflictError, UnauthorizedError
from app.core.security import verify_password
from app.crud.candidate import candidate as candidate_crud
from app.crud.company import company as company_crud
from app.crud.resume import resume as resume_crud
from app.crud.user import user as user_crud
from app.models.candidate import Candidate
from app.models.enums import UserRole
from app.models.recruiter import Recruiter
from app.models.skill import CandidateSkill, Skill
from app.models.user import User
from app.schemas.company import CompanyCreate
from app.schemas.parsed_resume import EducationItem, ExperienceItem
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.utils.resume_storage import store_image

ALLOWED_AVATAR_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _local_public_url(public_path: str) -> str:
    base = (settings.PUBLIC_API_URL or "http://127.0.0.1:8000").rstrip("/")
    if public_path.startswith("http://") or public_path.startswith("https://"):
        return public_path
    return f"{base}{public_path}"


def _education_list(raw: object) -> list[EducationItem]:
    if not isinstance(raw, list):
        return []
    items: list[EducationItem] = []
    for entry in raw:
        try:
            items.append(EducationItem.model_validate(entry))
        except Exception:
            continue
    return items


def _experience_list(raw: object) -> list[ExperienceItem]:
    if not isinstance(raw, list):
        return []
    items: list[ExperienceItem] = []
    for entry in raw:
        try:
            items.append(ExperienceItem.model_validate(entry))
        except Exception:
            continue
    return items


def _skill_names(candidate: Candidate) -> list[str]:
    names: list[str] = []
    for link in candidate.skills or []:
        if link.skill and link.skill.name:
            names.append(link.skill.name)
    return names


def _ensure_recruiter(db: Session, user: User) -> Recruiter:
    existing = db.scalars(
        select(Recruiter)
        .options(joinedload(Recruiter.company), joinedload(Recruiter.user))
        .where(Recruiter.user_id == user.id)
    ).first()
    if existing is not None:
        return existing
    rec = Recruiter(user_id=user.id, company_id=None)
    db.add(rec)
    db.commit()
    loaded = db.scalars(
        select(Recruiter)
        .options(joinedload(Recruiter.company), joinedload(Recruiter.user))
        .where(Recruiter.user_id == user.id)
    ).first()
    assert loaded is not None
    return loaded


def _sync_skills(db: Session, candidate: Candidate, skills: list[str]) -> None:
    db.execute(delete(CandidateSkill).where(CandidateSkill.candidate_id == candidate.id))
    for name in skills:
        skill = db.scalars(
            select(Skill).where(func.lower(Skill.name) == name.lower())
        ).first()
        if skill is None:
            skill = Skill(name=name)
            db.add(skill)
            db.flush()
        db.add(CandidateSkill(candidate_id=candidate.id, skill_id=skill.id))
    db.commit()


class ProfileService:
    def get_me(self, db: Session, user: User) -> ProfileResponse:
        base = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

        if user.role == UserRole.CANDIDATE:
            candidate = candidate_crud.get_by_user_id(db, user.id)
            if candidate is None:
                db.add(Candidate(user_id=user.id))
                db.commit()
                candidate = candidate_crud.get_by_user_id(db, user.id)
            assert candidate is not None

            skills = _skill_names(candidate)
            education = _education_list(candidate.education)
            experience = _experience_list(candidate.experience)
            latest = resume_crud.get_primary_or_latest(db, candidate_id=candidate.id)
            parsed = None
            if latest and latest.parsed_data and isinstance(latest.parsed_data, dict):
                parsed = latest.parsed_data
                if not skills and parsed.get("skills"):
                    skills = [str(s) for s in parsed["skills"]]
                if not education and parsed.get("education"):
                    education = _education_list(parsed["education"])
                if not experience and parsed.get("experience"):
                    experience = _experience_list(parsed["experience"])

            return ProfileResponse(
                **base,
                phone=candidate.phone,
                location=candidate.location,
                date_of_birth=candidate.date_of_birth,
                headline=candidate.headline,
                summary=candidate.summary,
                years_experience=candidate.years_experience,
                current_title=candidate.current_title,
                linkedin_url=candidate.linkedin_url,
                github_url=candidate.github_url,
                portfolio_url=candidate.portfolio_url,
                preferred_job_role=candidate.preferred_job_role,
                preferred_location=candidate.preferred_location,
                expected_salary=candidate.expected_salary,
                skills=skills,
                education=education,
                experience=experience,
                resume_id=latest.id if latest else None,
                resume_file_name=latest.file_name if latest else None,
                resume_status=latest.status.value if latest else None,
                resume_uploaded_at=latest.created_at if latest else None,
            )

        if user.role == UserRole.RECRUITER:
            recruiter = _ensure_recruiter(db, user)
            return ProfileResponse(
                **base,
                phone=recruiter.phone,
                company_id=recruiter.company_id,
                company_name=recruiter.company.name if recruiter.company else None,
                job_title=recruiter.job_title,
                department=recruiter.department,
            )

        # Admin
        return ProfileResponse(**base)

    def update_me(self, db: Session, user: User, *, data: ProfileUpdate) -> ProfileResponse:
        payload = data.model_dump(exclude_unset=True)

        if payload.get("new_password"):
            if not verify_password(
                payload.get("current_password") or "", user.hashed_password
            ):
                raise UnauthorizedError("Current password is incorrect")
            user_crud.update(db, db_obj=user, password=payload["new_password"])
            user = user_crud.get_by_id(db, user.id) or user

        if "email" in payload and payload["email"]:
            new_email = str(payload["email"]).strip().lower()
            if new_email != user.email.lower():
                existing = user_crud.get_by_email(db, new_email)
                if existing is not None and existing.id != user.id:
                    raise ConflictError("Email already registered")
                user_crud.update(db, db_obj=user, email=new_email)
                user = user_crud.get_by_id(db, user.id) or user

        if "full_name" in payload and payload["full_name"]:
            user_crud.update(db, db_obj=user, full_name=payload["full_name"])
            user = user_crud.get_by_id(db, user.id) or user

        if user.role == UserRole.CANDIDATE:
            candidate = candidate_crud.get_by_user_id(db, user.id)
            if candidate is None:
                db.add(Candidate(user_id=user.id))
                db.commit()
                candidate = candidate_crud.get_by_user_id(db, user.id)
            assert candidate is not None

            for field in (
                "phone",
                "location",
                "date_of_birth",
                "headline",
                "summary",
                "years_experience",
                "current_title",
                "linkedin_url",
                "github_url",
                "portfolio_url",
                "preferred_job_role",
                "preferred_location",
                "expected_salary",
            ):
                if field in payload:
                    setattr(candidate, field, payload[field])

            if data.education is not None:
                candidate.education = [e.model_dump() for e in data.education]
            if data.experience is not None:
                candidate.experience = [e.model_dump() for e in data.experience]

            db.add(candidate)
            db.commit()

            if data.skills is not None:
                _sync_skills(db, candidate, data.skills)

        elif user.role == UserRole.RECRUITER:
            recruiter = _ensure_recruiter(db, user)
            if "phone" in payload:
                recruiter.phone = payload["phone"]
            if "job_title" in payload:
                recruiter.job_title = payload["job_title"]
            if "department" in payload:
                recruiter.department = payload["department"]
            if "company_name" in payload:
                name = payload["company_name"]
                if name:
                    existing = company_crud.get_by_name(db, name)
                    if existing is None:
                        existing = company_crud.create(
                            db, obj_in=CompanyCreate(name=name)
                        )
                    recruiter.company_id = existing.id
                else:
                    recruiter.company_id = None
            db.add(recruiter)
            db.commit()

        refreshed = user_crud.get_by_id(db, user.id)
        assert refreshed is not None
        return self.get_me(db, refreshed)

    async def upload_avatar(
        self, db: Session, user: User, *, file: UploadFile
    ) -> ProfileResponse:
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_AVATAR_TYPES:
            raise AppException(
                "Avatar must be a JPEG, PNG, WebP, or GIF image",
                status_code=400,
                code="invalid_avatar_type",
            )
        raw = await file.read()
        if not raw:
            raise AppException("Empty file", status_code=400, code="empty_file")
        if len(raw) > MAX_AVATAR_BYTES:
            raise AppException(
                "Avatar must be 5MB or smaller",
                status_code=400,
                code="avatar_too_large",
            )

        try:
            stored = store_image(
                file_bytes=raw,
                original_filename=file.filename or "avatar.jpg",
                user_id=user.id,
            )
            user.avatar_url = _local_public_url(stored.get("file_url") or "")
        except AppException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise AppException(
                "Could not store avatar image. Check Cloudinary credentials or "
                f"local upload directory ({settings.LOCAL_UPLOAD_DIR}).",
                status_code=500,
                code="avatar_storage_failed",
                details=str(exc),
            ) from exc
        db.add(user)
        db.commit()
        db.refresh(user)
        return self.get_me(db, user)


profile_service = ProfileService()
