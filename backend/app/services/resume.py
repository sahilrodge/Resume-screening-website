"""Resume upload / parse / preview / download business logic."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.ai.resume_parser import parse_resume_text_with_fallback
from app.core.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.crud.candidate import candidate as candidate_crud
from app.crud.resume import resume as resume_crud
from app.crud.skill import skill as skill_crud
from app.models.application import Application
from app.models.enums import ResumeStatus
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User
from app.schemas.parsed_resume import ParsedResumeData
from app.schemas.resume import (
    AppliedJobSummary,
    ResumeListResponse,
    ResumePreviewResponse,
    ResumeResponse,
)
from app.utils import local_storage
from app.utils.pdf_extract import (
    ALLOWED_CONTENT_TYPES,
    ALLOWED_EXTENSIONS,
    detect_extension,
    detect_file_type,
    extract_resume_text,
)
from app.utils.resume_storage import delete_stored_resume, store_resume

logger = get_logger(__name__)


def _parsed_name(parsed_data: object | None) -> str | None:
    if not parsed_data:
        return None
    if isinstance(parsed_data, dict):
        name = parsed_data.get("name")
        return str(name).strip() if name else None
    name = getattr(parsed_data, "name", None)
    return str(name).strip() if name else None


def _candidate_display_name(obj: Resume) -> str:
    if obj.candidate and obj.candidate.user and (obj.candidate.user.full_name or "").strip():
        return obj.candidate.user.full_name.strip()
    parsed = _parsed_name(obj.parsed_data)
    if parsed:
        return parsed
    if obj.candidate and obj.candidate.user and (obj.candidate.user.email or "").strip():
        return obj.candidate.user.email.strip()
    return "Unknown candidate"


def _applications_for_resume(db: Session, resume: Resume) -> list[Application]:
    stmt = (
        select(Application)
        .options(joinedload(Application.job).joinedload(Job.company))
        .where(
            or_(
                Application.resume_id == resume.id,
                Application.candidate_id == resume.candidate_id,
            )
        )
        .order_by(Application.created_at.desc())
    )
    # Prefer applications tied to this resume; still include candidate apps.
    apps = list(db.scalars(stmt).unique().all())
    tied = [a for a in apps if a.resume_id == resume.id]
    if tied:
        return tied
    return apps


def _to_response(
    db: Session | None,
    obj: Resume,
    *,
    parse_error: str | None = None,
    include_applications: bool = True,
) -> ResumeResponse:
    candidate_name = _candidate_display_name(obj)
    candidate_email = None
    if obj.candidate and obj.candidate.user:
        candidate_email = obj.candidate.user.email

    applied_jobs: list[AppliedJobSummary] = []
    ats_score: float | None = None
    if include_applications and db is not None:
        apps = _applications_for_resume(db, obj)
        scores = [
            float(a.ats_score)
            for a in apps
            if a.ats_score is not None
        ]
        if scores:
            ats_score = max(scores)
        for app in apps:
            job = app.job
            applied_jobs.append(
                AppliedJobSummary(
                    application_id=app.id,
                    job_id=app.job_id,
                    job_title=(job.title if job else "Job"),
                    company_name=(
                        job.company.name if job and job.company else None
                    ),
                    ats_score=float(app.ats_score) if app.ats_score is not None else None,
                    match_score=(
                        float(app.match_score) if app.match_score is not None else None
                    ),
                )
            )

    return ResumeResponse(
        id=obj.id,
        candidate_id=obj.candidate_id,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        file_name=obj.file_name,
        file_url=obj.file_url,
        storage_path=obj.storage_path,
        file_type=obj.file_type,
        status=obj.status,
        is_primary=obj.is_primary,
        parsed_data=obj.parsed_data,
        parse_error=parse_error,
        ats_score=ats_score,
        applied_jobs=applied_jobs,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def _estimate_years(experience: list) -> int | None:
    if not experience:
        return None
    return min(40, max(1, len(experience) * 2))


def _apply_parsed_to_candidate(
    db: Session,
    *,
    candidate_id: uuid.UUID,
    parsed: ParsedResumeData,
) -> None:
    candidate = candidate_crud.get(db, candidate_id)
    if candidate is None:
        return

    if parsed.name and parsed.name.strip():
        candidate.user.full_name = parsed.name.strip()[:255]
    if parsed.phone and parsed.phone.strip():
        candidate.phone = parsed.phone.strip()[:30]

    if parsed.experience:
        latest = parsed.experience[0]
        if latest.title:
            candidate.current_title = latest.title[:255]
            if latest.company:
                candidate.headline = f"{latest.title} at {latest.company}"[:255]
            else:
                candidate.headline = latest.title[:255]
        candidate.experience = [item.model_dump() for item in parsed.experience]

    if parsed.education:
        candidate.education = [item.model_dump() for item in parsed.education]

    years = _estimate_years(parsed.experience)
    if years is not None and candidate.years_experience is None:
        candidate.years_experience = years

    if parsed.skills:
        skill_crud.sync_candidate_skills(
            db,
            candidate_id=candidate.id,
            skill_names=parsed.skills,
        )

    db.add(candidate.user)
    db.add(candidate)
    db.commit()


def _api_download_path(resume_id: uuid.UUID, *, mine: bool = False) -> str:
    prefix = settings.API_V1_PREFIX.rstrip("/")
    if mine:
        return f"{prefix}/resumes/me/{resume_id}/download"
    return f"{prefix}/resumes/{resume_id}/download"


def _public_download_url(resume_id: uuid.UUID, *, mine: bool = False) -> str:
    """Relative API path so the frontend can download with auth headers."""
    return _api_download_path(resume_id, mine=mine)

def _preview_urls(obj: Resume) -> tuple[str, str]:
    """Return (preview_url, download_url)."""
    if local_storage.is_local_storage_path(obj.storage_path):
        url = _public_download_url(obj.id)
        return url, url
    return obj.file_url, obj.file_url


class ResumeService:
    def _get_owned(
        self,
        db: Session,
        *,
        resume_id: uuid.UUID,
        user: User,
    ) -> Resume:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        candidate = candidate_crud.get_by_user_id(db, user.id)
        if candidate is None or obj.candidate_id != candidate.id:
            raise ForbiddenError("Not allowed to access this resume")
        return obj

    def _validate_upload(self, file: UploadFile, data: bytes) -> tuple[str, str]:
        filename = file.filename or "resume.pdf"
        ext = detect_extension(filename)
        content_type = (file.content_type or "").lower()

        if ext not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
            raise AppException(
                "Unsupported file type. Allowed formats: PDF, DOC, DOCX, TXT, RTF.",
                status_code=400,
                code="invalid_file_type",
            )
        if ext and ext not in ALLOWED_EXTENSIONS:
            raise AppException(
                "Unsupported file type. Allowed formats: PDF, DOC, DOCX, TXT, RTF.",
                status_code=400,
                code="invalid_file_type",
            )

        max_bytes = settings.MAX_RESUME_SIZE_MB * 1024 * 1024
        if len(data) == 0:
            raise AppException(
                "Uploaded file is empty", status_code=400, code="empty_file"
            )
        if len(data) > max_bytes:
            raise AppException(
                f"File exceeds the {settings.MAX_RESUME_SIZE_MB}MB size limit",
                status_code=400,
                code="file_too_large",
            )
        return filename, content_type

    async def upload(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        file: UploadFile,
        is_primary: bool = False,
        replace_existing: bool = False,
    ) -> ResumeResponse:
        candidate = candidate_crud.get(db, candidate_id)
        if candidate is None:
            raise NotFoundError("Candidate not found")

        data = await file.read()
        filename, content_type = self._validate_upload(file, data)

        previous: list[Resume] = []
        if replace_existing or is_primary:
            items, _ = resume_crud.list(db, candidate_id=candidate_id, skip=0, limit=50)
            previous = items

        try:
            stored = store_resume(
                file_bytes=data,
                original_filename=filename,
                candidate_id=candidate_id,
            )
        except AppException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Resume storage failed")
            raise AppException(
                "Could not store resume file. Check storage configuration.",
                status_code=502,
                code="resume_storage_failed",
                details=str(exc),
            ) from exc

        file_type = detect_file_type(filename, content_type)
        initial_url = stored.get("file_url") or ""

        created = resume_crud.create(
            db,
            candidate_id=candidate_id,
            file_name=filename,
            file_url=initial_url or "pending",
            storage_path=stored["storage_path"],
            file_type=file_type,
            is_primary=is_primary or replace_existing or not previous,
        )

        # Local files use authenticated download routes as their URL.
        if stored.get("backend") == "local" or not created.file_url or created.file_url == "pending":
            created.file_url = _public_download_url(created.id)
            db.add(created)
            db.commit()
            db.refresh(created)

        created = resume_crud.set_status(db, db_obj=created, status=ResumeStatus.PARSING)
        parse_error: str | None = None
        raw_text: str | None = None

        try:
            raw_text = extract_resume_text(
                file_bytes=data,
                filename=filename,
                content_type=content_type,
            )
        except AppException as exc:
            parse_error = exc.message
            logger.warning("Resume text extraction failed: %s", parse_error)
            created = resume_crud.save_parse_result(
                db,
                db_obj=created,
                status=ResumeStatus.FAILED,
                parsed_data=None,
            )
        except Exception as exc:  # noqa: BLE001
            parse_error = str(exc)
            logger.exception("Unexpected resume extraction error")
            created = resume_crud.save_parse_result(
                db,
                db_obj=created,
                status=ResumeStatus.FAILED,
                parsed_data=None,
            )

        if raw_text:
            try:
                parsed, warning = parse_resume_text_with_fallback(raw_text)
                created = resume_crud.save_parse_result(
                    db,
                    db_obj=created,
                    status=ResumeStatus.PARSED,
                    raw_text=raw_text,
                    parsed_data=parsed.model_dump(),
                )
                _apply_parsed_to_candidate(db, candidate_id=candidate_id, parsed=parsed)
                created = resume_crud.get(db, created.id)
                if warning:
                    parse_error = (
                        f"Parsed with fallback ({warning}). "
                        "Re-upload later for richer AI extraction."
                    )
            except AppException as exc:
                parse_error = exc.message
                logger.warning("Resume parse failed: %s", parse_error)
                # Keep extracted text so matching/re-parse can still proceed.
                created = resume_crud.save_parse_result(
                    db,
                    db_obj=created,
                    status=ResumeStatus.FAILED,
                    raw_text=raw_text,
                    parsed_data=None,
                )
            except Exception as exc:  # noqa: BLE001
                parse_error = str(exc)
                logger.exception("Unexpected resume parse error")
                created = resume_crud.save_parse_result(
                    db,
                    db_obj=created,
                    status=ResumeStatus.FAILED,
                    raw_text=raw_text,
                    parsed_data=None,
                )

        if replace_existing and previous:
            for old in previous:
                if created and old.id == created.id:
                    continue
                delete_stored_resume(old.storage_path)
                resume_crud.delete(db, db_obj=old)

        assert created is not None
        return _to_response(db, created, parse_error=parse_error)

    def list(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ResumeListResponse:
        items, total = resume_crud.list(
            db,
            candidate_id=candidate_id,
            search=search,
            skip=(page - 1) * page_size,
            limit=page_size,
        )
        pages = max(1, (total + page_size - 1) // page_size) if total else 0
        return ResumeListResponse(
            items=[_to_response(db, item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def get(self, db: Session, resume_id: uuid.UUID) -> ResumeResponse:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        return _to_response(db, obj)

    def get_mine(
        self, db: Session, *, resume_id: uuid.UUID, user: User
    ) -> ResumeResponse:
        return _to_response(db, self._get_owned(db, resume_id=resume_id, user=user))

    def _load_resume_bytes(self, resume: Resume) -> bytes | None:
        if local_storage.is_local_storage_path(resume.storage_path):
            try:
                path = local_storage.resolve_local_path(resume.storage_path or "")
                return path.read_bytes()
            except Exception:  # noqa: BLE001
                logger.warning("Could not read local resume bytes for %s", resume.id)
                return None
        if resume.file_url and resume.file_url.startswith("http"):
            try:
                import httpx

                response = httpx.get(resume.file_url, timeout=30.0, follow_redirects=True)
                if response.status_code < 400 and response.content:
                    return response.content
            except Exception:  # noqa: BLE001
                logger.warning("Could not download resume bytes for %s", resume.id)
        return None

    def ensure_ready(self, db: Session, *, resume_id: uuid.UUID) -> Resume:
        """
        Ensure a resume has parsed_data (and raw_text when possible) before matching.

        Re-extracts/re-parses failed uploads when the stored file is available.
        """
        resume = resume_crud.get(db, resume_id)
        if resume is None:
            raise NotFoundError("Resume not found")

        if resume.status == ResumeStatus.PARSED and resume.parsed_data:
            return resume

        raw_text = (resume.raw_text or "").strip() or None
        if not raw_text:
            file_bytes = self._load_resume_bytes(resume)
            if file_bytes:
                try:
                    raw_text = extract_resume_text(
                        file_bytes=file_bytes,
                        filename=resume.file_name or "resume.pdf",
                        content_type=resume.file_type or "",
                    )
                except AppException as exc:
                    raise AppException(
                        "Resume text could not be extracted. Re-upload a text-based "
                        "PDF/DOCX/TXT resume, then try matching again.",
                        status_code=400,
                        code="resume_not_ready",
                        details=exc.message,
                    ) from exc

        if not raw_text:
            raise AppException(
                "Resume must be parsed before matching. Re-upload the resume and "
                "wait until status is Parsed.",
                status_code=400,
                code="resume_not_ready",
            )

        if resume.parsed_data:
            # Has structured data already (even if status lagged).
            if resume.status != ResumeStatus.PARSED:
                return resume_crud.set_status(
                    db, db_obj=resume, status=ResumeStatus.PARSED
                )
            return resume

        parsed, _warning = parse_resume_text_with_fallback(raw_text)
        updated = resume_crud.save_parse_result(
            db,
            db_obj=resume,
            status=ResumeStatus.PARSED,
            raw_text=raw_text,
            parsed_data=parsed.model_dump(),
        )
        _apply_parsed_to_candidate(
            db, candidate_id=updated.candidate_id, parsed=parsed
        )
        refreshed = resume_crud.get(db, updated.id)
        assert refreshed is not None
        return refreshed

    def preview(self, db: Session, resume_id: uuid.UUID) -> ResumePreviewResponse:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        preview_url, download_url = _preview_urls(obj)
        return ResumePreviewResponse(
            id=obj.id,
            file_name=obj.file_name,
            preview_url=preview_url,
            download_url=download_url,
            file_type=obj.file_type,
        )

    def preview_mine(
        self, db: Session, *, resume_id: uuid.UUID, user: User
    ) -> ResumePreviewResponse:
        obj = self._get_owned(db, resume_id=resume_id, user=user)
        preview_url, download_url = _preview_urls(obj)
        # Prefer candidate-scoped download path for local files
        if local_storage.is_local_storage_path(obj.storage_path):
            preview_url = download_url = _public_download_url(obj.id, mine=True)
        return ResumePreviewResponse(
            id=obj.id,
            file_name=obj.file_name,
            preview_url=preview_url,
            download_url=download_url,
            file_type=obj.file_type,
        )

    def resolve_download(
        self, db: Session, resume_id: uuid.UUID
    ) -> tuple[str, str, Path | None]:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        return self._download_payload(obj)

    def resolve_download_mine(
        self, db: Session, *, resume_id: uuid.UUID, user: User
    ) -> tuple[str, str, Path | None]:
        obj = self._get_owned(db, resume_id=resume_id, user=user)
        return self._download_payload(obj)

    def _download_payload(
        self, obj: Resume
    ) -> tuple[str, str, Path | None]:
        """(kind, url_or_name, local_path). kind: redirect | file."""
        if local_storage.is_local_storage_path(obj.storage_path):
            path = local_storage.resolve_local_path(obj.storage_path or "")
            return "file", obj.file_name, path
        if not obj.file_url or obj.file_url == "pending":
            raise AppException(
                "Resume file URL is unavailable",
                status_code=404,
                code="resume_url_missing",
            )
        return "redirect", obj.file_url, None

    def delete(self, db: Session, resume_id: uuid.UUID) -> None:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        delete_stored_resume(obj.storage_path)
        resume_crud.delete(db, db_obj=obj)

    def delete_mine(self, db: Session, *, resume_id: uuid.UUID, user: User) -> None:
        obj = self._get_owned(db, resume_id=resume_id, user=user)
        delete_stored_resume(obj.storage_path)
        resume_crud.delete(db, db_obj=obj)


resume_service = ResumeService()
