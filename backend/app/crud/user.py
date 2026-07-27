"""User CRUD operations."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate


class CRUDUser:
    def get_by_id(self, db: Session, user_id: uuid.UUID) -> User | None:
        return db.get(User, user_id)

    def get_by_email(self, db: Session, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return db.scalars(stmt).first()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        user = User(
            email=obj_in.email.lower(),
            hashed_password=hash_password(obj_in.password),
            full_name=obj_in.full_name.strip(),
            role=obj_in.role,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


user = CRUDUser()
