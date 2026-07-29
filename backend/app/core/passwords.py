"""Shared password validation helpers."""

from __future__ import annotations

import re

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72  # bcrypt hard limit


def validate_password_strength(password: str) -> str:
    value = password or ""
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
    if len(value) > PASSWORD_MAX_LENGTH:
        raise ValueError(f"Password must be at most {PASSWORD_MAX_LENGTH} characters")
    if not re.search(r"[A-Za-z]", value):
        raise ValueError("Password must include at least one letter")
    if not re.search(r"\d", value):
        raise ValueError("Password must include at least one number")
    return value
