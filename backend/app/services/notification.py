"""Multi-channel notification dispatcher and inbox APIs."""

from __future__ import annotations

import uuid
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.crud.notification import (
    notification as notification_crud,
    notification_preference as preference_crud,
    push_subscription as push_crud,
)
from app.crud.user import user as user_crud
from app.models.application import Application
from app.models.enums import (
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
    UserRole,
)
from app.models.interview import Interview
from app.models.job import Job
from app.models.notification import Notification
from app.models.recruiter import Recruiter
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    PushSubscriptionResponse,
    UnreadCountResponse,
)
from app.utils.email import send_email
from app.utils.web_push import send_web_push

logger = get_logger(__name__)

DEFAULT_CHANNELS = (
    NotificationChannel.IN_APP,
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
)


def _frontend_base_url() -> str:
    """Absolute app origin for email deep links."""
    configured = (settings.FRONTEND_URL or "").strip().rstrip("/")
    if configured:
        return configured
    for origin in settings.CORS_ORIGINS:
        o = origin.strip().rstrip("/")
        if not o:
            continue
        if "localhost" in o or "127.0.0.1" in o:
            continue
        return o
    if settings.CORS_ORIGINS:
        return settings.CORS_ORIGINS[0].strip().rstrip("/")
    return ""


def absolute_app_link(path: str | None) -> str | None:
    """Turn an in-app path into an absolute URL when FRONTEND_URL/CORS allow it."""
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = _frontend_base_url()
    if not base:
        return path
    return f"{base}{path if path.startswith('/') else f'/{path}'}"


def staff_application_path(application_id: uuid.UUID) -> str:
    return f"/screening/{application_id}"


def candidate_hiring_path(*, interview: Interview | None = None) -> str:
    """Candidate-safe deep link (staff /screening/* is blocked by RBAC)."""
    if interview is not None:
        return "/portal"
    return "/portal/screening"


def _to_response(obj: Notification) -> NotificationResponse:
    return NotificationResponse.model_validate(obj)


class NotificationService:
    def list(
        self,
        db: Session,
        *,
        user: User,
        page: int = 1,
        page_size: int = 20,
        channel: NotificationChannel | None = None,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        items, total, pages = notification_crud.list_for_user(
            db,
            user_id=user.id,
            page=page,
            page_size=page_size,
            channel=channel,
            unread_only=unread_only,
        )
        return NotificationListResponse(
            items=[_to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            unread_count=notification_crud.unread_count(db, user_id=user.id),
            channel_counts=notification_crud.channel_counts(db, user_id=user.id),
        )

    def unread_count(self, db: Session, *, user: User) -> UnreadCountResponse:
        return UnreadCountResponse(
            unread_count=notification_crud.unread_count(db, user_id=user.id)
        )

    def mark_read(
        self,
        db: Session,
        *,
        user: User,
        notification_id: uuid.UUID,
        is_read: bool = True,
    ) -> NotificationResponse:
        obj = notification_crud.get(db, notification_id)
        if obj is None or obj.user_id != user.id:
            raise NotFoundError("Notification not found")
        return _to_response(notification_crud.mark_read(db, db_obj=obj, is_read=is_read))

    def mark_all_read(self, db: Session, *, user: User) -> UnreadCountResponse:
        notification_crud.mark_all_read(db, user_id=user.id)
        return self.unread_count(db, user=user)

    def clear_all(self, db: Session, *, user: User) -> UnreadCountResponse:
        notification_crud.clear_all(db, user_id=user.id)
        return self.unread_count(db, user=user)

    def get_preferences(self, db: Session, *, user: User) -> NotificationPreferenceResponse:
        pref = preference_crud.get_or_create(db, user_id=user.id)
        return NotificationPreferenceResponse(
            email_enabled=pref.email_enabled,
            in_app_enabled=pref.in_app_enabled,
            push_enabled=pref.push_enabled,
            vapid_public_key=settings.VAPID_PUBLIC_KEY,
            smtp_configured=settings.smtp_configured,
            push_configured=settings.vapid_configured,
        )

    def update_preferences(
        self,
        db: Session,
        *,
        user: User,
        data: NotificationPreferenceUpdate,
    ) -> NotificationPreferenceResponse:
        pref = preference_crud.get_or_create(db, user_id=user.id)
        preference_crud.update(
            db,
            db_obj=pref,
            email_enabled=data.email_enabled,
            in_app_enabled=data.in_app_enabled,
            push_enabled=data.push_enabled,
        )
        return self.get_preferences(db, user=user)

    def subscribe_push(
        self,
        db: Session,
        *,
        user: User,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str | None = None,
    ) -> PushSubscriptionResponse:
        obj = push_crud.upsert(
            db,
            user_id=user.id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=user_agent,
        )
        return PushSubscriptionResponse.model_validate(obj)

    def unsubscribe_push(
        self,
        db: Session,
        *,
        user: User,
        endpoint: str,
    ) -> dict[str, bool]:
        ok = push_crud.delete_by_endpoint(db, user_id=user.id, endpoint=endpoint)
        return {"ok": ok}

    def notify(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
        link: str | None = None,
        meta: dict[str, Any] | None = None,
        channels: Iterable[NotificationChannel] | None = None,
        respect_preferences: bool = True,
    ) -> list[NotificationResponse]:
        """Dispatch to one or more channels and persist history rows."""
        user = user_crud.get_by_id(db, user_id)
        if user is None:
            logger.warning("notify skipped — user %s not found", user_id)
            return []

        pref = preference_crud.get_or_create(db, user_id=user_id)
        requested = list(channels) if channels is not None else list(DEFAULT_CHANNELS)
        created: list[NotificationResponse] = []

        for channel in requested:
            if respect_preferences and not self._channel_allowed(pref, channel):
                created.append(
                    _to_response(
                        notification_crud.create(
                            db,
                            user_id=user_id,
                            title=title,
                            message=message,
                            notification_type=notification_type,
                            channel=channel,
                            delivery_status=NotificationDeliveryStatus.SKIPPED,
                            link=link,
                            meta={**(meta or {}), "reason": "preference_disabled"},
                            is_read=True,
                        )
                    )
                )
                continue

            if channel == NotificationChannel.IN_APP:
                created.append(
                    _to_response(
                        notification_crud.create(
                            db,
                            user_id=user_id,
                            title=title,
                            message=message,
                            notification_type=notification_type,
                            channel=NotificationChannel.IN_APP,
                            delivery_status=NotificationDeliveryStatus.SENT,
                            link=link,
                            meta=meta,
                        )
                    )
                )
            elif channel == NotificationChannel.EMAIL:
                created.append(
                    self._send_email_channel(
                        db,
                        user=user,
                        title=title,
                        message=message,
                        notification_type=notification_type,
                        link=link,
                        meta=meta,
                    )
                )
            elif channel == NotificationChannel.PUSH:
                created.append(
                    self._send_push_channel(
                        db,
                        user=user,
                        title=title,
                        message=message,
                        notification_type=notification_type,
                        link=link,
                        meta=meta,
                    )
                )
            else:
                created.append(
                    _to_response(
                        notification_crud.create(
                            db,
                            user_id=user_id,
                            title=title,
                            message=message,
                            notification_type=notification_type,
                            channel=channel,
                            delivery_status=NotificationDeliveryStatus.SKIPPED,
                            link=link,
                            meta={**(meta or {}), "reason": "unsupported_channel"},
                            is_read=True,
                        )
                    )
                )

        return created

    def notify_hiring_event(
        self,
        db: Session,
        *,
        application: Application,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
        link: str | None = None,
        event: str | None = None,
        interview: Interview | None = None,
        notify_candidate: bool = False,
    ) -> None:
        """Best-effort recruiter (+ optional candidate) multi-channel notify."""
        meta: dict[str, Any] = {
            "event": event,
            "application_id": str(application.id),
            "job_id": str(application.job_id) if application.job_id else None,
            "candidate_id": str(application.candidate_id) if application.candidate_id else None,
        }
        if interview is not None:
            meta["interview_id"] = str(interview.id)

        staff_href = link or staff_application_path(application.id)
        if staff_href.startswith("/portal"):
            staff_href = staff_application_path(application.id)
        candidate_href = candidate_hiring_path(interview=interview)

        recruiter_user_id = None
        if application.job and application.job.recruiter and application.job.recruiter.user_id:
            recruiter_user_id = application.job.recruiter.user_id
        else:
            job = application.job or db.get(Job, application.job_id)
            if job and job.recruiter_id:
                rec = db.get(Recruiter, job.recruiter_id)
                if rec:
                    recruiter_user_id = rec.user_id

        if recruiter_user_id:
            try:
                self.notify(
                    db,
                    user_id=recruiter_user_id,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    link=staff_href,
                    meta=meta,
                    channels=DEFAULT_CHANNELS,
                )
            except Exception:  # noqa: BLE001
                logger.exception("Recruiter notify failed")

        try:
            admin_ids = list(
                db.scalars(
                    select(User.id).where(
                        User.role == UserRole.ADMIN,
                        User.is_active.is_(True),
                    )
                ).all()
            )
            for admin_id in admin_ids:
                if recruiter_user_id and admin_id == recruiter_user_id:
                    continue
                self.notify(
                    db,
                    user_id=admin_id,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    link=staff_href,
                    meta=meta,
                    channels=[NotificationChannel.IN_APP],
                )
        except Exception:  # noqa: BLE001
            logger.exception("Admin notify failed")

        if notify_candidate and application.candidate and application.candidate.user_id:
            try:
                self.notify(
                    db,
                    user_id=application.candidate.user_id,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    link=candidate_href,
                    meta=meta,
                    channels=[
                        NotificationChannel.IN_APP,
                        NotificationChannel.EMAIL,
                    ],
                )
            except Exception:  # noqa: BLE001
                logger.exception("Candidate notify failed")

    def _channel_allowed(self, pref: Any, channel: NotificationChannel) -> bool:
        if channel == NotificationChannel.IN_APP:
            return bool(pref.in_app_enabled)
        if channel == NotificationChannel.EMAIL:
            return bool(pref.email_enabled)
        if channel == NotificationChannel.PUSH:
            return bool(pref.push_enabled)
        return False

    def _send_email_channel(
        self,
        db: Session,
        *,
        user: User,
        title: str,
        message: str,
        notification_type: NotificationType,
        link: str | None,
        meta: dict[str, Any] | None,
    ) -> NotificationResponse:
        email_link = absolute_app_link(link)
        result = send_email(
            to_email=user.email,
            subject=title,
            body=message if not email_link else f"{message}\n\nOpen: {email_link}",
            html_body=(
                f"<p>{message}</p>"
                + (
                    f'<p><a href="{email_link}">Open in HirePulse</a></p>'
                    if email_link
                    else ""
                )
            ),
        )
        if result.get("skipped"):
            status = NotificationDeliveryStatus.SKIPPED
        elif result.get("ok"):
            status = NotificationDeliveryStatus.SENT
        else:
            status = NotificationDeliveryStatus.FAILED
        return _to_response(
            notification_crud.create(
                db,
                user_id=user.id,
                title=title,
                message=message,
                notification_type=notification_type,
                channel=NotificationChannel.EMAIL,
                delivery_status=status,
                link=link,
                meta={**(meta or {}), "email_result": result},
                is_read=True,
            )
        )

    def _send_push_channel(
        self,
        db: Session,
        *,
        user: User,
        title: str,
        message: str,
        notification_type: NotificationType,
        link: str | None,
        meta: dict[str, Any] | None,
    ) -> NotificationResponse:
        subs = push_crud.list_for_user(db, user_id=user.id)
        if not subs:
            return _to_response(
                notification_crud.create(
                    db,
                    user_id=user.id,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    channel=NotificationChannel.PUSH,
                    delivery_status=NotificationDeliveryStatus.SKIPPED,
                    link=link,
                    meta={**(meta or {}), "reason": "no_subscriptions"},
                    is_read=True,
                )
            )

        any_ok = False
        any_attempt = False
        results: list[dict[str, Any]] = []
        for sub in subs:
            result = send_web_push(
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
                title=title,
                body=message,
                url=link,
            )
            results.append(result)
            if result.get("skipped"):
                continue
            any_attempt = True
            if result.get("ok"):
                any_ok = True
            elif result.get("gone"):
                push_crud.delete(db, db_obj=sub)

        if not any_attempt:
            status = NotificationDeliveryStatus.SKIPPED
        elif any_ok:
            status = NotificationDeliveryStatus.SENT
        else:
            status = NotificationDeliveryStatus.FAILED

        return _to_response(
            notification_crud.create(
                db,
                user_id=user.id,
                title=title,
                message=message,
                notification_type=notification_type,
                channel=NotificationChannel.PUSH,
                delivery_status=status,
                link=link,
                meta={**(meta or {}), "push_results": results},
                is_read=True,
            )
        )


notification_service = NotificationService()
