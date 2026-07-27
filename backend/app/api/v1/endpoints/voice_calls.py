"""Vapi voice screening endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Header, Query, Request, status

from app.api.deps import DBSession, RecruiterUser
from app.core.config import settings
from app.core.exceptions import AppException
from app.models.enums import VoiceCallStatus
from app.schemas.voice_call import (
    VoiceCallListResponse,
    VoiceCallResponse,
    VoiceCallTriggerRequest,
)
from app.services.voice_call import voice_call_service

router = APIRouter(prefix="/voice-calls", tags=["voice-calls"])


@router.get(
    "",
    response_model=VoiceCallListResponse,
    summary="List AI screening calls",
)
def list_voice_calls(
    db: DBSession,
    _: RecruiterUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    application_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    status_filter: Annotated[VoiceCallStatus | None, Query(alias="status")] = None,
) -> VoiceCallListResponse:
    return voice_call_service.list(
        db,
        page=page,
        page_size=page_size,
        application_id=application_id,
        candidate_id=candidate_id,
        status=status_filter,
    )


@router.get(
    "/{call_id}",
    response_model=VoiceCallResponse,
    summary="Get voice call transcript and score",
)
def get_voice_call(
    call_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> VoiceCallResponse:
    return voice_call_service.get(db, call_id)


@router.post(
    "/trigger",
    response_model=VoiceCallResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually trigger Vapi screening call for an application",
)
def trigger_voice_call(
    payload: VoiceCallTriggerRequest,
    db: DBSession,
    _: RecruiterUser,
) -> VoiceCallResponse:
    return voice_call_service.trigger_for_application(db, application_id=payload.application_id)


@router.post(
    "/webhook",
    summary="Vapi server webhook (status + end-of-call-report)",
)
async def vapi_webhook(
    request: Request,
    db: DBSession,
    x_vapi_secret: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    if settings.VAPI_WEBHOOK_SECRET and x_vapi_secret != settings.VAPI_WEBHOOK_SECRET:
        raise AppException("Invalid Vapi webhook secret", status_code=403, code="invalid_webhook")

    payload = await request.json()
    result = voice_call_service.handle_webhook(db, payload)
    return {
        "status": "ok",
        "call_id": str(result.id) if result else None,
        "interview_score": result.interview_score if result else None,
    }
