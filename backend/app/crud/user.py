"""User CRUD operations."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.enums import UserRole
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

    def update(
        self,
        db: Session,
        *,
        db_obj: User,
        full_name: str | None = None,
        email: str | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
        password: str | None = None,
    ) -> User:
        if full_name is not None:
            db_obj.full_name = full_name.strip()
        if email is not None:
            db_obj.email = email.strip().lower()
        if role is not None:
            db_obj.role = role
        if is_active is not None:
            db_obj.is_active = is_active
        if password is not None:
            db_obj.hashed_password = hash_password(password)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, db_obj: User) -> None:
        db.delete(db_obj)
        db.commit()


user = CRUDUser()
