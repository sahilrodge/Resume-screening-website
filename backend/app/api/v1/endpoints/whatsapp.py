"""WhatsApp messaging + Twilio webhook endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status

from app.api.deps import DBSession, RecruiterUser
from app.models.enums import WhatsappDirection
from app.schemas.whatsapp import (
    ReminderSendResponse,
    WhatsappLogListResponse,
    WhatsappLogResponse,
    WhatsappSendRequest,
)
from app.services.whatsapp import whatsapp_service

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get(
    "/messages",
    response_model=WhatsappLogListResponse,
    summary="List stored WhatsApp messages",
)
def list_messages(
    db: DBSession,
    _: RecruiterUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    candidate_id: uuid.UUID | None = None,
    direction: WhatsappDirection | None = None,
    event_type: str | None = None,
) -> WhatsappLogListResponse:
    return whatsapp_service.list_logs(
        db,
        page=page,
        page_size=page_size,
        candidate_id=candidate_id,
        direction=direction,
        event_type=event_type,
    )


@router.get(
    "/messages/{message_id}",
    response_model=WhatsappLogResponse,
    summary="Get WhatsApp message",
)
def get_message(
    message_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> WhatsappLogResponse:
    return whatsapp_service.get(db, message_id)


@router.post(
    "/send",
    response_model=WhatsappLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send WhatsApp message to candidate",
)
def send_message(
    payload: WhatsappSendRequest,
    db: DBSession,
    _: RecruiterUser,
) -> WhatsappLogResponse:
    return whatsapp_service.send_to_candidate(
        db,
        candidate_id=payload.candidate_id,
        event=payload.event,
        body=payload.body,
        application_id=payload.application_id,
        interview_id=payload.interview_id,
        allow_missing_twilio=False,
    )


@router.post(
    "/reminders/send-due",
    response_model=ReminderSendResponse,
    summary="Send interview reminder WhatsApp messages",
)
def send_due_reminders(
    db: DBSession,
    _: RecruiterUser,
) -> ReminderSendResponse:
    return whatsapp_service.send_due_reminders(db)


@router.post(
    "/webhook",
    include_in_schema=True,
    summary="Twilio WhatsApp inbound webhook",
)
async def twilio_inbound_webhook(
    request: Request,
    db: DBSession,
) -> Response:
    form = dict(await request.form())
    # Convert FormData values to str
    params = {k: str(v) for k, v in form.items()}
    signature = request.headers.get("X-Twilio-Signature")
    whatsapp_service.handle_inbound_webhook(
        db,
        form=params,
        request_url=str(request.url),
        signature=signature,
    )
    # Empty TwiML — no auto-reply required
    return Response(
        content="<?xml version='1.0' encoding='UTF-8'?><Response></Response>",
        media_type="application/xml",
    )


@router.post(
    "/webhook/status",
    include_in_schema=True,
    summary="Twilio WhatsApp status callback",
)
async def twilio_status_webhook(
    request: Request,
    db: DBSession,
) -> dict[str, str]:
    form = dict(await request.form())
    params = {k: str(v) for k, v in form.items()}
    signature = request.headers.get("X-Twilio-Signature")
    whatsapp_service.handle_status_webhook(
        db,
        form=params,
        request_url=str(request.url),
        signature=signature,
    )
    return {"status": "ok"}
