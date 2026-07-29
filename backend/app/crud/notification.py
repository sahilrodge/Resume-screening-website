"""Notification data-access helpers."""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.enums import (
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
)
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.push_subscription import PushSubscription


class CRUDNotification:
    def get(self, db: Session, notification_id: uuid.UUID) -> Notification | None:
        return db.get(Notification, notification_id)

    def create(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
        channel: NotificationChannel = NotificationChannel.IN_APP,
        delivery_status: NotificationDeliveryStatus = NotificationDeliveryStatus.SENT,
        link: str | None = None,
        meta: dict[str, Any] | None = None,
        is_read: bool = False,
    ) -> Notification:
        obj = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            channel=channel,
            delivery_status=delivery_status,
            link=link,
            meta=meta,
            is_read=is_read,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def list_for_user(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        channel: NotificationChannel | None = None,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int, int]:
        stmt: Select[tuple[Notification]] = select(Notification).where(
            Notification.user_id == user_id
        )
        count_stmt = (
            select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
        )
        if channel is not None:
            stmt = stmt.where(Notification.channel == channel)
            count_stmt = count_stmt.where(Notification.channel == channel)
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
            count_stmt = count_stmt.where(Notification.is_read.is_(False))

        total = int(db.scalar(count_stmt) or 0)
        pages = max(1, math.ceil(total / page_size)) if total else 1
        items = list(
            db.scalars(
                stmt.order_by(Notification.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).all()
        )
        return items, total, pages

    def unread_count(self, db: Session, *, user_id: uuid.UUID) -> int:
        return int(
            db.scalar(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.is_read.is_(False),
                    Notification.channel == NotificationChannel.IN_APP,
                )
            )
            or 0
        )

    def mark_read(
        self,
        db: Session,
        *,
        db_obj: Notification,
        is_read: bool = True,
    ) -> Notification:
        db_obj.is_read = is_read
        db_obj.read_at = datetime.now(timezone.utc) if is_read else None
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def mark_all_read(self, db: Session, *, user_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        items = list(
            db.scalars(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.is_read.is_(False),
                )
            ).all()
        )
        for item in items:
            item.is_read = True
            item.read_at = now
            db.add(item)
        db.commit()
        return len(items)

    def clear_all(self, db: Session, *, user_id: uuid.UUID) -> int:
        items = list(
            db.scalars(
                select(Notification).where(Notification.user_id == user_id)
            ).all()
        )
        count = len(items)
        for item in items:
            db.delete(item)
        db.commit()
        return count

    def channel_counts(self, db: Session, *, user_id: uuid.UUID) -> dict[str, int]:
        rows = db.execute(
            select(Notification.channel, func.count().label("count"))
            .where(Notification.user_id == user_id)
            .group_by(Notification.channel)
        ).all()
        return {
            (r.channel.value if hasattr(r.channel, "value") else str(r.channel)): int(r.count)
            for r in rows
        }


class CRUDNotificationPreference:
    def get_or_create(self, db: Session, *, user_id: uuid.UUID) -> NotificationPreference:
        pref = db.scalar(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        if pref is None:
            pref = NotificationPreference(user_id=user_id)
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return pref

    def update(
        self,
        db: Session,
        *,
        db_obj: NotificationPreference,
        email_enabled: bool | None = None,
        in_app_enabled: bool | None = None,
        push_enabled: bool | None = None,
    ) -> NotificationPreference:
        if email_enabled is not None:
            db_obj.email_enabled = email_enabled
        if in_app_enabled is not None:
            db_obj.in_app_enabled = in_app_enabled
        if push_enabled is not None:
            db_obj.push_enabled = push_enabled
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


class CRUDPushSubscription:
    def list_for_user(self, db: Session, *, user_id: uuid.UUID) -> list[PushSubscription]:
        return list(
            db.scalars(
                select(PushSubscription).where(PushSubscription.user_id == user_id)
            ).all()
        )

    def upsert(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str | None = None,
    ) -> PushSubscription:
        existing = db.scalar(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        if existing:
            existing.p256dh = p256dh
            existing.auth = auth
            if user_agent is not None:
                existing.user_agent = user_agent
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing

        obj = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=user_agent,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def delete_by_endpoint(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        endpoint: str,
    ) -> bool:
        obj = db.scalar(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        if obj is None:
            return False
        db.delete(obj)
        db.commit()
        return True

    def delete(self, db: Session, *, db_obj: PushSubscription) -> None:
        db.delete(db_obj)
        db.commit()


notification = CRUDNotification()
notification_preference = CRUDNotificationPreference()
push_subscription = CRUDPushSubscription()
