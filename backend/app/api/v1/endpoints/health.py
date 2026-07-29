"""Health / readiness probes."""

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.api.deps import DBSession
from app.core.config import settings
from app.schemas.common import HealthResponse, ReadyResponse
from app.utils.cloudinary_storage import cloudinary_status_message, is_cloudinary_ready
from app.utils.resume_storage import active_backend

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Liveness probe — confirms the API process is running."""
    if settings.is_production:
        return HealthResponse(
            status="ok",
            app=settings.APP_NAME,
            version=settings.PROJECT_VERSION,
            environment=settings.APP_ENV,
        )
    backend = active_backend()
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.PROJECT_VERSION,
        environment=settings.APP_ENV,
        storage_backend=backend,
        cloudinary_configured=is_cloudinary_ready(),
        storage_message=cloudinary_status_message(),
    )


@router.get("/health/ready", response_model=ReadyResponse)
def readiness_check(db: DBSession, response: Response) -> ReadyResponse:
    """Readiness probe — confirms the API can reach PostgreSQL."""
    try:
        db.execute(text("SELECT 1"))
        return ReadyResponse(
            status="ready",
            app=settings.APP_NAME,
            version=settings.PROJECT_VERSION,
            environment=settings.APP_ENV,
            database="ok",
            storage_backend=active_backend(),
            cloudinary_configured=is_cloudinary_ready(),
        )
    except Exception:  # noqa: BLE001
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadyResponse(
            status="not_ready",
            app=settings.APP_NAME,
            version=settings.PROJECT_VERSION,
            environment=settings.APP_ENV,
            database="error",
            storage_backend=active_backend(),
            cloudinary_configured=is_cloudinary_ready(),
        )
