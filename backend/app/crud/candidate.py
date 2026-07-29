"""Candidate CRUD with search, sorting, and pagination."""

from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.candidate import Candidate
from app.models.enums import UserRole
from app.models.skill import CandidateSkill
from app.models.user import User
from app.schemas.candidate import (
    CandidateCreate,
    CandidateSortField,
    CandidateUpdate,
    SortOrder,
)


def _base_query() -> Select[tuple[Candidate]]:
    return (
        select(Candidate)
        .options(
            joinedload(Candidate.user),
            joinedload(Candidate.skills).joinedload(CandidateSkill.skill),
        )
        .join(User)
    )


class CRUDCandidate:
    def get(self, db: Session, candidate_id: uuid.UUID) -> Candidate | None:
        stmt = _base_query().where(Candidate.id == candidate_id)
        return db.scalars(stmt).unique().first()

    def get_by_user_id(self, db: Session, user_id: uuid.UUID) -> Candidate | None:
        stmt = _base_query().where(Candidate.user_id == user_id)
        return db.scalars(stmt).unique().first()

    def create(self, db: Session, *, obj_in: CandidateCreate) -> Candidate:
        user = User(
            email=obj_in.email.lower(),
            hashed_password=hash_password(obj_in.password),
            full_name=obj_in.full_name.strip(),
            role=UserRole.CANDIDATE,
            is_active=True,
        )
        db.add(user)
        db.flush()

        candidate = Candidate(
            user_id=user.id,
            phone=obj_in.phone,
            location=obj_in.location,
            date_of_birth=obj_in.date_of_birth,
            headline=obj_in.headline,
            summary=obj_in.summary,
            years_experience=obj_in.years_experience,
            linkedin_url=obj_in.linkedin_url,
            github_url=getattr(obj_in, "github_url", None),
            portfolio_url=obj_in.portfolio_url,
            current_title=obj_in.current_title,
            preferred_job_role=obj_in.preferred_job_role,
            preferred_location=obj_in.preferred_location,
            expected_salary=obj_in.expected_salary,
        )
        db.add(candidate)
        db.commit()
        return self.get(db, candidate.id)  # type: ignore[return-value]

    def update(
        self,
        db: Session,
        *,
        db_obj: Candidate,
        obj_in: CandidateUpdate,
    ) -> Candidate:
        data = obj_in.model_dump(exclude_unset=True)
        if "full_name" in data:
            db_obj.user.full_name = data.pop("full_name")
        if "is_active" in data:
            db_obj.user.is_active = data.pop("is_active")
        skills = data.pop("skills", None)
        education = data.pop("education", None)
        experience = data.pop("experience", None)

        for field, value in data.items():
            setattr(db_obj, field, value)

        if education is not None:
            db_obj.education = [
                e.model_dump() if hasattr(e, "model_dump") else e for e in education
            ]
        if experience is not None:
            db_obj.experience = [
                e.model_dump() if hasattr(e, "model_dump") else e for e in experience
            ]

        db.add(db_obj.user)
        db.add(db_obj)
        db.commit()

        if skills is not None:
            from sqlalchemy import delete, func, select

            from app.models.skill import CandidateSkill, Skill

            db.execute(
                delete(CandidateSkill).where(CandidateSkill.candidate_id == db_obj.id)
            )
            for name in skills:
                cleaned = str(name).strip()
                if not cleaned:
                    continue
                skill = db.scalars(
                    select(Skill).where(func.lower(Skill.name) == cleaned.lower())
                ).first()
                if skill is None:
                    skill = Skill(name=cleaned[:120])
                    db.add(skill)
                    db.flush()
                db.add(CandidateSkill(candidate_id=db_obj.id, skill_id=skill.id))
            db.commit()

        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def delete(self, db: Session, *, db_obj: Candidate) -> None:
        # Cascade deletes candidate via user relationship; deleting user is cleaner
        user = db_obj.user
        db.delete(user)
        db.commit()

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        location: str | None = None,
        min_experience: int | None = None,
        max_experience: int | None = None,
        is_active: bool | None = None,
        sort_by: CandidateSortField = "created_at",
        sort_order: SortOrder = "desc",
    ) -> tuple[list[Candidate], int, int]:
        filters: list[Any] = []

        if search:
            term = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(User.full_name).like(term),
                    func.lower(User.email).like(term),
                    func.lower(Candidate.current_title).like(term),
                    func.lower(Candidate.headline).like(term),
                    func.lower(Candidate.location).like(term),
                )
            )

        if location:
            filters.append(func.lower(Candidate.location).like(f"%{location.strip().lower()}%"))

        if min_experience is not None:
            filters.append(Candidate.years_experience >= min_experience)

        if max_experience is not None:
            filters.append(Candidate.years_experience <= max_experience)

        if is_active is not None:
            filters.append(User.is_active.is_(is_active))

        count_stmt = select(func.count()).select_from(Candidate).join(User)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        sort_map = {
            "created_at": Candidate.created_at,
            "full_name": User.full_name,
            "email": User.email,
            "years_experience": Candidate.years_experience,
            "location": Candidate.location,
            "current_title": Candidate.current_title,
        }
        sort_col = sort_map[sort_by]
        order_expr = asc(sort_col) if sort_order == "asc" else desc(sort_col)

        stmt = _base_query()
        if filters:
            stmt = stmt.where(*filters)
        stmt = (
            stmt.order_by(order_expr, desc(Candidate.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        items = list(db.scalars(stmt).unique().all())
        pages = max(1, math.ceil(total / page_size)) if total else 0
        return items, total, pages


candidate = CRUDCandidate()
