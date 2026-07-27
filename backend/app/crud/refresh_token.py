"""Refresh token CRUD operations."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken


class CRUDRefreshToken:
    def create(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        jti: str,
        token_hash: str,
        expires_at: datetime,
    ) -> RefreshToken:
        row = RefreshToken(
            user_id=user_id,
            jti=jti,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked=False,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def get_active_by_jti(self, db: Session, jti: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(
            RefreshToken.jti == jti,
            RefreshToken.revoked.is_(False),
        )
        return db.scalars(stmt).first()

    def get_by_jti(self, db: Session, jti: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.jti == jti)
        return db.scalars(stmt).first()

    def revoke_by_jti(self, db: Session, jti: str) -> bool:
        token = self.get_active_by_jti(db, jti)
        if token is None:
            return False
        token.revoked = True
        db.add(token)
        db.commit()
        return True

    def revoke_all_for_user(self, db: Session, user_id: uuid.UUID) -> int:
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked.is_(False),
            )
            .values(revoked=True)
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount or 0

    def is_expired(self, token: RefreshToken) -> bool:
        expires = token.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return expires <= datetime.now(UTC)


refresh_token = CRUDRefreshToken()
