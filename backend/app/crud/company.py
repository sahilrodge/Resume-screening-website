"""Company data-access helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company
from app.models.enums import JobStatus
from app.models.job import Job
from app.schemas.company import CompanyCreate, CompanyUpdate


class CRUDCompany:
    def get(self, db: Session, company_id: uuid.UUID) -> Company | None:
        return db.get(Company, company_id)

    def get_by_name(self, db: Session, name: str) -> Company | None:
        return db.scalar(
            select(Company).where(func.lower(Company.name) == name.strip().lower())
        )

    def list(self, db: Session, *, skip: int = 0, limit: int = 100) -> tuple[list[Company], int]:
        total = db.scalar(select(func.count()).select_from(Company)) or 0
        items = list(
            db.scalars(
                select(Company).order_by(Company.name.asc()).offset(skip).limit(limit)
            ).all()
        )
        return items, total

    def open_jobs_count(self, db: Session, company_id: uuid.UUID) -> int:
        return (
            db.scalar(
                select(func.count())
                .select_from(Job)
                .where(Job.company_id == company_id, Job.status == JobStatus.OPEN)
            )
            or 0
        )

    def open_jobs_counts(
        self, db: Session, company_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not company_ids:
            return {}
        rows = db.execute(
            select(Job.company_id, func.count())
            .where(Job.company_id.in_(company_ids), Job.status == JobStatus.OPEN)
            .group_by(Job.company_id)
        ).all()
        return {company_id: count for company_id, count in rows}

    def list_open_jobs(self, db: Session, company_id: uuid.UUID) -> list[Job]:
        from app.models.recruiter import Recruiter
        from app.models.skill import JobSkill

        stmt = (
            select(Job)
            .where(Job.company_id == company_id, Job.status == JobStatus.OPEN)
            .options(
                selectinload(Job.company),
                selectinload(Job.recruiter).selectinload(Recruiter.user),
                selectinload(Job.applications),
                selectinload(Job.skills).selectinload(JobSkill.skill),
            )
            .order_by(Job.published_at.desc().nullslast(), Job.created_at.desc())
        )
        return list(db.scalars(stmt).unique().all())

    def create(self, db: Session, *, obj_in: CompanyCreate) -> Company:
        data = obj_in.model_dump()
        if data.get("benefits") is None:
            data["benefits"] = []
        if data.get("social_links") is None:
            data["social_links"] = {}
        company = Company(**data)
        db.add(company)
        db.commit()
        db.refresh(company)
        return company

    def update(self, db: Session, *, db_obj: Company, obj_in: CompanyUpdate) -> Company:
        data = obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


company = CRUDCompany()
