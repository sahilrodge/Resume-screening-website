"""Analytics dashboard endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DBSession, RecruiterUser
from app.schemas.analytics import AnalyticsOverview
from app.services.analytics import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/overview",
    response_model=AnalyticsOverview,
    summary="Full analytics overview for dashboard charts",
)
def analytics_overview(
    db: DBSession,
    _: RecruiterUser,
    months: Annotated[int, Query(ge=3, le=24)] = 6,
) -> AnalyticsOverview:
    return analytics_service.overview(db, months=months)
