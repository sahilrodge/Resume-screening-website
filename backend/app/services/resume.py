"""Resume upload / parse / preview / download business logic."""

from __future__ import annotations

import uuid

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.ai.resume_parser import parse_resume_text
from app.core.config import settings
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.crud.candidate import candidate as candidate_crud
from app.crud.resume import resume as resume_crud
from app.crud.skill import skill as skill_crud
from app.models.enums import ResumeStatus
from app.models.resume import Resume
from app.schemas.parsed_resume import ParsedResumeData
from app.schemas.resume import ResumeListResponse, ResumePreviewResponse, ResumeResponse
from app.utils.cloudinary_storage import delete_asset, upload_pdf
from app.utils.pdf_extract import extract_text_from_pdf

logger = get_logger(__name__)

ALLOWED_CONTENT_TYPES = {"application/pdf"}
ALLOWED_EXTENSIONS = {".pdf"}


def _to_response(obj: Resume, *, parse_error: str | None = None) -> ResumeResponse:
    candidate_name = None
    candidate_email = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
        candidate_email = obj.candidate.user.email

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


class ResumeService:
    async def upload(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        file: UploadFile,
        is_primary: bool = False,
    ) -> ResumeResponse:
        candidate = candidate_crud.get(db, candidate_id)
        if candidate is None:
            raise NotFoundError("Candidate not found")

        filename = file.filename or "resume.pdf"
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        content_type = (file.content_type or "").lower()

        if content_type not in ALLOWED_CONTENT_TYPES and ext not in ALLOWED_EXTENSIONS:
            raise AppException(
                "Only PDF resumes are allowed",
                status_code=400,
                code="invalid_file_type",
            )

        data = await file.read()
        max_bytes = settings.MAX_RESUME_SIZE_MB * 1024 * 1024
        if len(data) == 0:
            raise AppException("Uploaded file is empty", status_code=400, code="empty_file")
        if len(data) > max_bytes:
            raise AppException(
                f"File exceeds {settings.MAX_RESUME_SIZE_MB}MB limit",
                status_code=400,
                code="file_too_large",
            )

        uploaded = upload_pdf(
            file_bytes=data,
            original_filename=filename,
            candidate_id=candidate_id,
        )

        created = resume_crud.create(
            db,
            candidate_id=candidate_id,
            file_name=filename,
            file_url=uploaded["secure_url"],
            storage_path=uploaded["public_id"],
            file_type="application/pdf",
            is_primary=is_primary,
        )

        created = resume_crud.set_status(db, db_obj=created, status=ResumeStatus.PARSING)
        parse_error: str | None = None

        try:
            raw_text = extract_text_from_pdf(data)
            parsed = parse_resume_text(raw_text)
            created = resume_crud.save_parse_result(
                db,
                db_obj=created,
                status=ResumeStatus.PARSED,
                raw_text=raw_text,
                parsed_data=parsed.model_dump(),
            )
            _apply_parsed_to_candidate(db, candidate_id=candidate_id, parsed=parsed)
            # Refresh response fields after candidate updates
            created = resume_crud.get(db, created.id)
        except AppException as exc:
            parse_error = exc.message
            logger.warning("Resume parse failed: %s", parse_error)
            created = resume_crud.save_parse_result(
                db,
                db_obj=created,
                status=ResumeStatus.FAILED,
                parsed_data=None,
            )
        except Exception as exc:  # noqa: BLE001
            parse_error = str(exc)
            logger.exception("Unexpected resume parse error")
            created = resume_crud.save_parse_result(
                db,
                db_obj=created,
                status=ResumeStatus.FAILED,
                parsed_data=None,
            )

        assert created is not None
        return _to_response(created, parse_error=parse_error)

    def list(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ResumeListResponse:
        items, total = resume_crud.list(
            db,
            candidate_id=candidate_id,
            skip=(page - 1) * page_size,
            limit=page_size,
        )
        return ResumeListResponse(
            items=[_to_response(item) for item in items],
            total=total,
        )

    def get(self, db: Session, resume_id: uuid.UUID) -> ResumeResponse:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        return _to_response(obj)

    def preview(self, db: Session, resume_id: uuid.UUID) -> ResumePreviewResponse:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        return ResumePreviewResponse(
            id=obj.id,
            file_name=obj.file_name,
            preview_url=obj.file_url,
            download_url=obj.file_url,
            file_type=obj.file_type,
        )

    def get_download_url(self, db: Session, resume_id: uuid.UUID) -> tuple[str, str]:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        return obj.file_url, obj.file_name

    def delete(self, db: Session, resume_id: uuid.UUID) -> None:
        obj = resume_crud.get(db, resume_id)
        if obj is None:
            raise NotFoundError("Resume not found")
        if obj.storage_path:
            delete_asset(obj.storage_path)
        resume_crud.delete(db, db_obj=obj)


resume_service = ResumeService()
