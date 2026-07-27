"""Data-access (CRUD) layer."""

from app.crud.base import CRUDBase
from app.crud.candidate import candidate
from app.crud.refresh_token import refresh_token
from app.crud.resume import resume
from app.crud.user import user

__all__ = ["CRUDBase", "user", "refresh_token", "candidate", "resume"]
