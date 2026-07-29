"""Permanent Super Admin bootstrap and protection helpers."""

from __future__ import annotations

import secrets
import string

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ForbiddenError
from app.core.logging import get_logger
from app.crud.user import user as user_crud
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.auth import auth_service

logger = get_logger(__name__)


def super_admin_email() -> str:
    return (settings.SUPER_ADMIN_EMAIL or "").strip().lower()


def is_super_admin(user: User | None) -> bool:
    if user is None:
        return False
    email = (user.email or "").strip().lower()
    return bool(email) and email == super_admin_email()


def is_super_admin_email(email: str | None) -> bool:
    value = (email or "").strip().lower()
    return bool(value) and value == super_admin_email()


def protect_super_admin(user: User | None, *, action: str) -> None:
    """Raise 403 if the target user is the permanent Super Admin."""
    if is_super_admin(user):
        raise ForbiddenError(
            f"The Super Admin account cannot be {action}."
        )


def _generate_bootstrap_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Sa" + "".join(secrets.choice(alphabet) for _ in range(14)) + "1"


def ensure_super_admin(db: Session) -> User | None:
    """
    Ensure the configured Super Admin exists, is active, and has Admin role.

    Creates the account when missing. Promotes/reactivates when present.
    """
    email = super_admin_email()
    if not email:
        logger.warning("SUPER_ADMIN_EMAIL is empty — skipping Super Admin bootstrap")
        return None

    user = user_crud.get_by_email(db, email)
    password = (settings.SUPER_ADMIN_PASSWORD or "").strip() or None
    full_name = (settings.SUPER_ADMIN_FULL_NAME or "").strip() or "Super Admin"

    if user is None:
        bootstrap_password = password
        if bootstrap_password is None:
            if settings.is_production:
                logger.error(
                    "SUPER_ADMIN_PASSWORD is required in production to create %s. "
                    "Set it in backend/.env and restart.",
                    email,
                )
                return None
            bootstrap_password = _generate_bootstrap_password()
        user = user_crud.create(
            db,
            obj_in=UserCreate(
                email=email,
                password=bootstrap_password,
                full_name=full_name,
                role=UserRole.ADMIN,
            ),
        )
        if password is None:
            logger.warning(
                "Created Super Admin %s with a generated password. "
                "Set SUPER_ADMIN_PASSWORD in backend/.env and reset the password.",
                email,
            )
        else:
            logger.info("Created Super Admin account %s", email)
    else:
        changed = False
        if user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        if full_name and not (user.full_name or "").strip():
            user.full_name = full_name
            changed = True
        # Keep production login in sync when SUPER_ADMIN_PASSWORD is configured
        if password:
            from app.core.security import hash_password, verify_password

            if not verify_password(password, user.hashed_password):
                user.hashed_password = hash_password(password)
                changed = True
                logger.info("Synced Super Admin password from SUPER_ADMIN_PASSWORD")
        if changed:
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(
                "Promoted/reactivated Super Admin %s (role=admin, active=true)",
                email,
            )
        else:
            logger.info("Super Admin account verified: %s", email)

    auth_service._ensure_role_profile(db, user)
    return user
