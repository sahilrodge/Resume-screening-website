"""Candidate business logic."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.crud.candidate import candidate as candidate_crud
from app.crud.user import user as user_crud
from app.models.candidate import Candidate
from app.schemas.candidate import (
    CandidateCreate,
    CandidateListResponse,
    CandidateProfileResponse,
    CandidateResponse,
    CandidateSortField,
    CandidateUpdate,
    SortOrder,
)
from app.crud.resume import resume as resume_crud


def _to_response(obj: Candidate) -> CandidateResponse:
    return CandidateResponse(
        id=obj.id,
        user_id=obj.user_id,
        email=obj.user.email,
        full_name=obj.user.full_name,
        is_active=obj.user.is_active,
        phone=obj.phone,
        location=obj.location,
        headline=obj.headline,
        summary=obj.summary,
        years_experience=obj.years_experience,
        linkedin_url=obj.linkedin_url,
        portfolio_url=obj.portfolio_url,
        current_title=obj.current_title,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


class CandidateService:
    def create(self, db: Session, *, data: CandidateCreate) -> CandidateResponse:
        if user_crud.get_by_email(db, data.email):
            raise ConflictError("Email already registered")
        created = candidate_crud.create(db, obj_in=data)
        return _to_response(created)

    def get(self, db: Session, candidate_id: uuid.UUID) -> CandidateResponse:
        obj = candidate_crud.get(db, candidate_id)
        if obj is None:
            raise NotFoundError("Candidate not found")
        return _to_response(obj)

    def get_profile(self, db: Session, candidate_id: uuid.UUID) -> CandidateProfileResponse:
        obj = candidate_crud.get(db, candidate_id)
        if obj is None:
            raise NotFoundError("Candidate not found")

        base = _to_response(obj)
        skill_names = [
            link.skill.name
            for link in (obj.skills or [])
            if link.skill is not None
        ]

        latest = resume_crud.get_latest_parsed(db, candidate_id=candidate_id)
        parsed = latest.parsed_data if latest else None
        if parsed and isinstance(parsed, dict) and parsed.get("skills"):
            # Prefer OpenAI-extracted skills when present
            skill_names = list(parsed["skills"])

        return CandidateProfileResponse(
            **base.model_dump(),
            skills=skill_names,
            resume_id=latest.id if latest else None,
            resume_status=latest.status.value if latest else None,
            parsed_data=parsed,
        )

    def update(
        self,
        db: Session,
        candidate_id: uuid.UUID,
        *,
        data: CandidateUpdate,
    ) -> CandidateResponse:
        obj = candidate_crud.get(db, candidate_id)
        if obj is None:
            raise NotFoundError("Candidate not found")
        updated = candidate_crud.update(db, db_obj=obj, obj_in=data)
        return _to_response(updated)

    def delete(self, db: Session, candidate_id: uuid.UUID) -> None:
        obj = candidate_crud.get(db, candidate_id)
        if obj is None:
            raise NotFoundError("Candidate not found")
        candidate_crud.delete(db, db_obj=obj)

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
    ) -> CandidateListResponse:
        items, total, pages = candidate_crud.list(
            db,
            page=page,
            page_size=page_size,
            search=search,
            location=location,
            min_experience=min_experience,
            max_experience=max_experience,
            is_active=is_active,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return CandidateListResponse(
            items=[_to_response(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )


candidate_service = CandidateService()
