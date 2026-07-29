"""Company tenancy helpers for recruiter-scoped mutations."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.enums import UserRole
from app.models.recruiter import Recruiter
from app.models.user import User


def recruiter_company_id(db: Session, user: User) -> uuid.UUID | None:
    """Return the company linked to a recruiter profile, if any."""
    if user.role != UserRole.RECRUITER:
        return None
    profile = getattr(user, "recruiter_profile", None)
    if profile is not None:
        return profile.company_id
    row = db.scalar(select(Recruiter).where(Recruiter.user_id == user.id))
    return row.company_id if row else None


def assert_can_manage_company(
    db: Session, user: User, company_id: uuid.UUID
) -> None:
    """Admins may manage any company; recruiters only their own."""
    if user.role == UserRole.ADMIN:
        return
    if user.role != UserRole.RECRUITER:
        raise ForbiddenError("Insufficient permissions")
    linked = recruiter_company_id(db, user)
    if linked is None:
        raise ForbiddenError(
            "Your recruiter account is not linked to a company. "
            "Ask an admin to assign a company before editing profiles."
        )
    if linked != company_id:
        raise ForbiddenError("You can only manage your own company profile.")


def assert_can_manage_job_company(
    db: Session, user: User, job_company_id: uuid.UUID | None
) -> None:
    """Admins may manage any job; recruiters only jobs for their company."""
    if user.role == UserRole.ADMIN:
        return
    if user.role != UserRole.RECRUITER:
        raise ForbiddenError("Insufficient permissions")
    if job_company_id is None:
        raise NotFoundError("Job not found")
    linked = recruiter_company_id(db, user)
    if linked is None:
        # Unlinked recruiters can still operate in single-tenant setups;
        # cross-company edits are blocked once a company is assigned.
        return
    if linked != job_company_id:
        raise ForbiddenError("You can only manage jobs for your own company.")
