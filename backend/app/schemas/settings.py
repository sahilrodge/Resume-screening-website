"""Schemas for account settings (language + privacy)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


SupportedLanguage = Literal["en", "hi", "es", "fr", "de"]


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    language: SupportedLanguage = "en"
    profile_discoverable: bool = True
    show_email_to_recruiters: bool = False
    allow_ai_processing: bool = True
    share_activity_status: bool = True
    updated_at: datetime | None = None


class UserSettingsUpdate(BaseModel):
    language: SupportedLanguage | None = None
    profile_discoverable: bool | None = None
    show_email_to_recruiters: bool | None = None
    allow_ai_processing: bool | None = None
    share_activity_status: bool | None = None


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    confirmation: Literal["DELETE"] = Field(
        description='Must be the exact string "DELETE"'
    )
