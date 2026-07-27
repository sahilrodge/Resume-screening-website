"""Analytics business logic."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.crud.analytics import analytics as analytics_crud
from app.schemas.analytics import AnalyticsOverview


class AnalyticsService:
    def overview(self, db: Session, *, months: int = 6) -> AnalyticsOverview:
        data = analytics_crud.overview(db, months=months)
        return AnalyticsOverview(**data)


analytics_service = AnalyticsService()
