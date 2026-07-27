"""Company data-access helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyCreate


class CRUDCompany:
    def get(self, db: Session, company_id: uuid.UUID) -> Company | None:
        return db.get(Company, company_id)

    def get_by_name(self, db: Session, name: str) -> Company | None:
        return db.scalar(select(Company).where(func.lower(Company.name) == name.strip().lower()))

    def list(self, db: Session, *, skip: int = 0, limit: int = 100) -> tuple[list[Company], int]:
        total = db.scalar(select(func.count()).select_from(Company)) or 0
        items = list(
            db.scalars(
                select(Company).order_by(Company.name.asc()).offset(skip).limit(limit)
            ).all()
        )
        return items, total

    def create(self, db: Session, *, obj_in: CompanyCreate) -> Company:
        company = Company(**obj_in.model_dump())
        db.add(company)
        db.commit()
        db.refresh(company)
        return company


company = CRUDCompany()
