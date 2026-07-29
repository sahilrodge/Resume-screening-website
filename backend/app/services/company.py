"""Company business logic."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.crud.company import company as company_crud
from app.schemas.company import (
    CompanyCreate,
    CompanyListResponse,
    CompanyProfileResponse,
    CompanyResponse,
    CompanyUpdate,
)
from app.services.job import _to_response as job_to_response


def _to_company_response(
    obj, *, open_jobs_count: int = 0
) -> CompanyResponse:
    benefits = obj.benefits if isinstance(obj.benefits, list) else []
    social = obj.social_links if isinstance(obj.social_links, dict) else {}
    return CompanyResponse(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        website=obj.website,
        industry=obj.industry,
        location=obj.location,
        logo_url=None,  # Always use HirePulse brand mark in the UI — no external logos
        employee_count=obj.employee_count,
        culture=obj.culture,
        benefits=[str(item) for item in benefits if item],
        social_links={str(k): v for k, v in social.items() if v},
        open_jobs_count=open_jobs_count,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


class CompanyService:
    def create(self, db: Session, *, data: CompanyCreate) -> CompanyResponse:
        if company_crud.get_by_name(db, data.name):
            raise ConflictError("Company name already exists")
        # Never persist external company logos — UI uses HirePulse brand mark.
        payload = data.model_copy(update={"logo_url": None})
        created = company_crud.create(db, obj_in=payload)
        return _to_company_response(created, open_jobs_count=0)

    def get(self, db: Session, company_id: uuid.UUID) -> CompanyResponse | None:
        obj = company_crud.get(db, company_id)
        if obj is None:
            return None
        count = company_crud.open_jobs_count(db, company_id)
        return _to_company_response(obj, open_jobs_count=count)

    def get_profile(
        self, db: Session, company_id: uuid.UUID
    ) -> CompanyProfileResponse:
        obj = company_crud.get(db, company_id)
        if obj is None:
            raise NotFoundError("Company not found")
        open_jobs = company_crud.list_open_jobs(db, company_id)
        base = _to_company_response(obj, open_jobs_count=len(open_jobs))
        return CompanyProfileResponse(
            **base.model_dump(),
            open_jobs=[job_to_response(job) for job in open_jobs],
        )

    def update(
        self, db: Session, company_id: uuid.UUID, *, data: CompanyUpdate
    ) -> CompanyResponse:
        obj = company_crud.get(db, company_id)
        if obj is None:
            raise NotFoundError("Company not found")
        if data.name and data.name.lower() != obj.name.lower():
            existing = company_crud.get_by_name(db, data.name)
            if existing and existing.id != obj.id:
                raise ConflictError("Company name already exists")
        # Strip logo updates so external images cannot be stored.
        payload = data.model_copy(update={"logo_url": None})
        updated = company_crud.update(db, db_obj=obj, obj_in=payload)
        count = company_crud.open_jobs_count(db, company_id)
        return _to_company_response(updated, open_jobs_count=count)

    def get_or_404(self, db: Session, company_id: uuid.UUID) -> CompanyResponse:
        obj = self.get(db, company_id)
        if obj is None:
            raise NotFoundError("Company not found")
        return obj

    def list(self, db: Session, *, page_size: int = 100) -> CompanyListResponse:
        items, total = company_crud.list(db, skip=0, limit=page_size)
        counts = company_crud.open_jobs_counts(db, [item.id for item in items])
        return CompanyListResponse(
            items=[
                _to_company_response(item, open_jobs_count=counts.get(item.id, 0))
                for item in items
            ],
            total=total,
        )


company_service = CompanyService()
