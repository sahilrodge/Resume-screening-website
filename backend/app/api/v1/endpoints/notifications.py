"""Notification inbox, preferences, and push subscription endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CurrentUser, DBSession
from app.models.enums import NotificationChannel, NotificationType
from app.schemas.common import MessageResponse
from app.schemas.notification import (
    MarkReadRequest,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    NotifyTestRequest,
    PushSubscribeRequest,
    PushSubscriptionResponse,
    PushUnsubscribeRequest,
    UnreadCountResponse,
)
from app.services.notification import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Notification history for current user",
)
def list_notifications(
    db: DBSession,
    current_user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    channel: NotificationChannel | None = None,
    unread_only: Annotated[bool, Query()] = False,
) -> NotificationListResponse:
    return notification_service.list(
        db,
        user=current_user,
        page=page,
        page_size=page_size,
        channel=channel,
        unread_only=unread_only,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Unread in-app notification count",
)
def unread_count(db: DBSession, current_user: CurrentUser) -> UnreadCountResponse:
    return notification_service.unread_count(db, user=current_user)


@router.post(
    "/mark-all-read",
    response_model=UnreadCountResponse,
    summary="Mark all notifications as read",
)
def mark_all_read(db: DBSession, current_user: CurrentUser) -> UnreadCountResponse:
    return notification_service.mark_all_read(db, user=current_user)


@router.delete(
    "/clear",
    response_model=UnreadCountResponse,
    summary="Delete all notifications for the current user",
)
def clear_notifications(
    db: DBSession, current_user: CurrentUser
) -> UnreadCountResponse:
    return notification_service.clear_all(db, user=current_user)


@router.get(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    summary="Get notification channel preferences",
)
def get_preferences(
    db: DBSession,
    current_user: CurrentUser,
) -> NotificationPreferenceResponse:
    return notification_service.get_preferences(db, user=current_user)


@router.patch(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    summary="Update notification channel preferences",
)
def update_preferences(
    payload: NotificationPreferenceUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> NotificationPreferenceResponse:
    return notification_service.update_preferences(db, user=current_user, data=payload)


@router.post(
    "/push/subscribe",
    response_model=PushSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a Web Push subscription",
)
def push_subscribe(
    payload: PushSubscribeRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> PushSubscriptionResponse:
    return notification_service.subscribe_push(
        db,
        user=current_user,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
        user_agent=payload.user_agent,
    )


@router.post(
    "/push/unsubscribe",
    response_model=MessageResponse,
    summary="Remove a Web Push subscription",
)
def push_unsubscribe(
    payload: PushUnsubscribeRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> MessageResponse:
    result = notification_service.unsubscribe_push(
        db, user=current_user, endpoint=payload.endpoint
    )
    return MessageResponse(
        message="Unsubscribed" if result["ok"] else "Subscription not found"
    )


@router.post(
    "/test",
    response_model=list[NotificationResponse],
    summary="Send a test notification on selected channels",
)
def test_notify(
    payload: NotifyTestRequest,
    db: DBSession,
    current_user: AdminUser,
) -> list[NotificationResponse]:
    return notification_service.notify(
        db,
        user_id=current_user.id,
        title=payload.title,
        message=payload.message,
        notification_type=NotificationType.INFO,
        channels=payload.channels,
        respect_preferences=False,
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification read/unread",
)
def mark_read(
    notification_id: uuid.UUID,
    payload: MarkReadRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> NotificationResponse:
    return notification_service.mark_read(
        db,
        user=current_user,
        notification_id=notification_id,
        is_read=payload.is_read,
    )
