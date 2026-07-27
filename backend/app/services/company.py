"""Company business logic."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.crud.company import company as company_crud
from app.schemas.company import CompanyCreate, CompanyListResponse, CompanyResponse


class CompanyService:
    def create(self, db: Session, *, data: CompanyCreate) -> CompanyResponse:
        if company_crud.get_by_name(db, data.name):
            raise ConflictError("Company name already exists")
        created = company_crud.create(db, obj_in=data)
        return CompanyResponse.model_validate(created)

    def list(self, db: Session, *, page_size: int = 100) -> CompanyListResponse:
        items, total = company_crud.list(db, skip=0, limit=page_size)
        return CompanyListResponse(
            items=[CompanyResponse.model_validate(item) for item in items],
            total=total,
        )


company_service = CompanyService()
