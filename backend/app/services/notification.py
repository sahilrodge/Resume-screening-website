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

    def get_preferences(self, db: Session, *, user: User) -> NotificationPreferenceResponse:
        pref = preference_crud.get_or_create(db, user_id=user.id)
        return NotificationPreferenceResponse(
            email_enabled=pref.email_enabled,
            whatsapp_enabled=pref.whatsapp_enabled,
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
            whatsapp_enabled=data.whatsapp_enabled,
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
        whatsapp_phone: str | None = None,
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
                created.append(self._send_email_channel(db, user=user, title=title, message=message, notification_type=notification_type, link=link, meta=meta))
            elif channel == NotificationChannel.PUSH:
                created.append(self._send_push_channel(db, user=user, title=title, message=message, notification_type=notification_type, link=link, meta=meta))
            elif channel == NotificationChannel.WHATSAPP:
                created.append(
                    self._send_whatsapp_channel(
                        db,
                        user=user,
                        title=title,
                        message=message,
                        notification_type=notification_type,
                        link=link,
                        meta=meta,
                        phone=whatsapp_phone,
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
        include_whatsapp_history: bool = True,
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

        href = link or f"/screening/{application.id}"

        # Recruiter on the job
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
                    link=href,
                    meta=meta,
                    channels=DEFAULT_CHANNELS,
                )
            except Exception:  # noqa: BLE001
                logger.exception("Recruiter notify failed")

        # Also ping admins via in-app only (avoid email spam)
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
                    link=href,
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
                    link=href,
                    meta=meta,
                    channels=[
                        NotificationChannel.IN_APP,
                        NotificationChannel.EMAIL,
                    ],
                )
                if include_whatsapp_history:
                    self.record_whatsapp_history(
                        db,
                        user_id=application.candidate.user_id,
                        title=title,
                        message=message,
                        meta={**(meta or {}), "source": "hiring_event"},
                    )
            except Exception:  # noqa: BLE001
                logger.exception("Candidate notify failed")

        # Mirror WhatsApp delivery into recruiter history when requested
        if include_whatsapp_history and recruiter_user_id:
            try:
                self.record_whatsapp_history(
                    db,
                    user_id=recruiter_user_id,
                    title=f"WhatsApp · {title}",
                    message=message,
                    meta={**(meta or {}), "source": "hiring_event"},
                )
            except Exception:  # noqa: BLE001
                logger.exception("WhatsApp history record failed")

    def record_whatsapp_history(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        title: str,
        message: str,
        meta: dict[str, Any] | None = None,
        delivery_status: NotificationDeliveryStatus = NotificationDeliveryStatus.SENT,
    ) -> NotificationResponse:
        """Store a WhatsApp delivery in notification history (does not resend)."""
        return _to_response(
            notification_crud.create(
                db,
                user_id=user_id,
                title=title,
                message=message,
                notification_type=NotificationType.INFO,
                channel=NotificationChannel.WHATSAPP,
                delivery_status=delivery_status,
                meta=meta,
                is_read=True,
            )
        )

    def _channel_allowed(self, pref: Any, channel: NotificationChannel) -> bool:
        if channel == NotificationChannel.IN_APP:
            return bool(pref.in_app_enabled)
        if channel == NotificationChannel.EMAIL:
            return bool(pref.email_enabled)
        if channel == NotificationChannel.WHATSAPP:
            return bool(pref.whatsapp_enabled)
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
        result = send_email(
            to_email=user.email,
            subject=title,
            body=message if not link else f"{message}\n\nOpen: {link}",
            html_body=(
                f"<p>{message}</p>"
                + (f'<p><a href="{link}">Open in HirePulse</a></p>' if link else "")
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

    def _send_whatsapp_channel(
        self,
        db: Session,
        *,
        user: User,
        title: str,
        message: str,
        notification_type: NotificationType,
        link: str | None,
        meta: dict[str, Any] | None,
        phone: str | None,
    ) -> NotificationResponse:
        """Send WhatsApp to a phone if available; always write history."""
        from app.services.whatsapp import whatsapp_service
        from app.services.whatsapp_templates import WhatsappEvent
        from app.utils.twilio_whatsapp import normalize_whatsapp_number

        body = f"*{title}*\n{message}"
        if link:
            body = f"{body}\n{link}"

        delivery = NotificationDeliveryStatus.SKIPPED
        wa_meta: dict[str, Any] = {**(meta or {})}
        target = phone
        if not target and getattr(user, "recruiter_profile", None):
            target = user.recruiter_profile.phone if user.recruiter_profile else None
        if not target and getattr(user, "candidate_profile", None):
            target = user.candidate_profile.phone if user.candidate_profile else None

        if not target:
            wa_meta["reason"] = "no_phone"
        elif not settings.twilio_configured:
            wa_meta["reason"] = "twilio_not_configured"
        else:
            try:
                # Prefer candidate send path when candidate_id present
                candidate_id = None
                if meta and meta.get("candidate_id"):
                    try:
                        candidate_id = uuid.UUID(str(meta["candidate_id"]))
                    except ValueError:
                        candidate_id = None
                if candidate_id:
                    log = whatsapp_service.send_to_candidate(
                        db,
                        candidate_id=candidate_id,
                        event=WhatsappEvent.MANUAL,
                        body=body,
                        application_id=(
                            uuid.UUID(str(meta["application_id"]))
                            if meta and meta.get("application_id")
                            else None
                        ),
                        allow_missing_twilio=True,
                    )
                    if log:
                        delivery = NotificationDeliveryStatus.SENT
                        wa_meta["whatsapp_log_id"] = str(log.id)
                    else:
                        delivery = NotificationDeliveryStatus.FAILED
                else:
                    from app.crud.whatsapp_log import whatsapp_log as whatsapp_log_crud
                    from app.models.enums import WhatsappDirection, WhatsappStatus
                    from app.utils.twilio_whatsapp import (
                        send_whatsapp_message,
                        strip_whatsapp_prefix,
                    )

                    result = send_whatsapp_message(to=target, body=body)
                    status = WhatsappStatus.SENT if result.get("ok") else WhatsappStatus.FAILED
                    delivery = (
                        NotificationDeliveryStatus.SENT
                        if result.get("ok")
                        else NotificationDeliveryStatus.FAILED
                    )
                    log = whatsapp_log_crud.create(
                        db,
                        to_number=strip_whatsapp_prefix(normalize_whatsapp_number(target)),
                        from_number=strip_whatsapp_prefix(settings.TWILIO_WHATSAPP_FROM or ""),
                        direction=WhatsappDirection.OUTBOUND,
                        status=status,
                        message_body=body,
                        provider_message_id=result.get("sid"),
                        error_message=result.get("error"),
                        user_id=user.id,
                        meta={**(meta or {}), "event_type": WhatsappEvent.MANUAL.value},
                    )
                    wa_meta["whatsapp_log_id"] = str(log.id)
            except Exception as exc:  # noqa: BLE001
                logger.exception("WhatsApp channel failed")
                delivery = NotificationDeliveryStatus.FAILED
                wa_meta["error"] = str(exc)

        return _to_response(
            notification_crud.create(
                db,
                user_id=user.id,
                title=title,
                message=message,
                notification_type=notification_type,
                channel=NotificationChannel.WHATSAPP,
                delivery_status=delivery,
                link=link,
                meta=wa_meta,
                is_read=True,
            )
        )


notification_service = NotificationService()
