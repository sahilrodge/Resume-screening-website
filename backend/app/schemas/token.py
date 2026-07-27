"""JWT token schemas."""

from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: str | None = None
    type: str | None = None
    role: str | None = None
    jti: str | None = None
    exp: int | None = None
