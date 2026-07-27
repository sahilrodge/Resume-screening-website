"""Recruitment assistant chat endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.assistant import (
    ChatReplyResponse,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    MessageCreate,
)
from app.services.assistant import assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start recruitment assistant conversation",
)
def create_conversation(
    payload: ConversationCreate,
    db: DBSession,
    user: CurrentUser,
) -> ConversationResponse:
    return assistant_service.create_conversation(db, user=user, data=payload)


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List assistant conversations",
)
def list_conversations(
    db: DBSession,
    user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 30,
) -> ConversationListResponse:
    return assistant_service.list_conversations(db, user=user, page=page, page_size=page_size)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get conversation with chat history",
)
def get_conversation(
    conversation_id: uuid.UUID,
    db: DBSession,
    user: CurrentUser,
) -> ConversationResponse:
    return assistant_service.get_conversation(db, conversation_id, user=user)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ChatReplyResponse,
    summary="Send message to recruitment assistant (OpenAI)",
)
def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    db: DBSession,
    user: CurrentUser,
) -> ChatReplyResponse:
    return assistant_service.send_message(
        db, conversation_id=conversation_id, data=payload, user=user
    )
