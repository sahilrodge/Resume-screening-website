"""Resume data-access helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from app.models.candidate import Candidate
from app.models.enums import ResumeStatus
from app.models.resume import Resume


class CRUDResume:
    def get(self, db: Session, resume_id: uuid.UUID) -> Resume | None:
        stmt = (
            select(Resume)
            .options(joinedload(Resume.candidate).joinedload(Candidate.user))
            .where(Resume.id == resume_id)
        )
        return db.scalars(stmt).unique().first()

    def list(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Resume], int]:
        filters = []
        if candidate_id:
            filters.append(Resume.candidate_id == candidate_id)

        count_stmt = select(func.count()).select_from(Resume)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        stmt = select(Resume).options(
            joinedload(Resume.candidate).joinedload(Candidate.user)
        )
        if filters:
            stmt = stmt.where(*filters)
        stmt = stmt.order_by(Resume.created_at.desc()).offset(skip).limit(limit)
        items = list(db.scalars(stmt).unique().all())
        return items, total

    def create(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        file_name: str,
        file_url: str,
        storage_path: str,
        file_type: str,
        is_primary: bool = False,
    ) -> Resume:
        if is_primary:
            db.execute(
                update(Resume)
                .where(Resume.candidate_id == candidate_id)
                .values(is_primary=False)
            )

        resume = Resume(
            candidate_id=candidate_id,
            file_name=file_name,
            file_url=file_url,
            storage_path=storage_path,
            file_type=file_type,
            status=ResumeStatus.UPLOADED,
            is_primary=is_primary,
        )
        db.add(resume)
        db.commit()
        return self.get(db, resume.id)  # type: ignore[return-value]

    def set_status(
        self,
        db: Session,
        *,
        db_obj: Resume,
        status: ResumeStatus,
    ) -> Resume:
        db_obj.status = status
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def save_parse_result(
        self,
        db: Session,
        *,
        db_obj: Resume,
        status: ResumeStatus,
        raw_text: str | None = None,
        parsed_data: dict | None = None,
    ) -> Resume:
        if raw_text is not None:
            db_obj.raw_text = raw_text
        db_obj.parsed_data = parsed_data
        db_obj.status = status
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def get_latest_parsed(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
    ) -> Resume | None:
        stmt = (
            select(Resume)
            .options(joinedload(Resume.candidate).joinedload(Candidate.user))
            .where(
                Resume.candidate_id == candidate_id,
                Resume.status == ResumeStatus.PARSED,
                Resume.parsed_data.is_not(None),
            )
            .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
            .limit(1)
        )
        return db.scalars(stmt).unique().first()

    def delete(self, db: Session, *, db_obj: Resume) -> None:
        db.delete(db_obj)
        db.commit()


resume = CRUDResume()
