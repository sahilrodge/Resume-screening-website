"""FastAPI application entrypoint."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.database import verify_database_connection
from app.middleware.request_context import RequestContextMiddleware
from app.utils.local_storage import upload_root

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application startup / shutdown hooks."""
    setup_logging()
    logger.info(
        "Starting %s v%s (%s) | db_host=%s | cors_origins=%s",
        settings.APP_NAME,
        __version__,
        settings.APP_ENV,
        settings.redacted_database_host(),
        settings.CORS_ORIGINS,
    )

    try:
        from app.utils.cloudinary_storage import cloudinary_status_message
        from app.utils.local_storage import upload_root
        from app.utils.resume_storage import active_backend

        upload_root()  # ensure local uploads dir exists even when Cloudinary is used
        logger.info(
            "File storage: backend=%s | %s",
            active_backend(),
            cloudinary_status_message(),
        )
    except Exception:
        logger.exception("Storage bootstrap warning (continuing with defaults)")

    try:
        verify_database_connection()
    except Exception:
        logger.exception(
            "Failed to connect to PostgreSQL. Check DATABASE_URL in .env"
        )
        raise

    try:
        from app.core.super_admin import ensure_super_admin
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            ensure_super_admin(db)
        finally:
            db.close()
    except Exception:
        logger.exception("Super Admin bootstrap skipped due to an error")

    try:
        from scripts.seed_indian_jobs import seed_if_empty

        # Never auto-seed in production (seeded recruiters use a known password).
        if settings.is_production:
            logger.info("Skipping job auto-seed in production")
        else:
            created = seed_if_empty()
            if created:
                logger.info(
                    "Auto-seeded %s Indian job postings (jobs table was empty)",
                    created,
                )
    except Exception:
        logger.exception("Job auto-seed skipped due to an error")

    yield
    logger.info("Shutting down %s", settings.APP_NAME)


def create_application() -> FastAPI:
    """Application factory."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        debug=settings.DEBUG and not settings.is_production,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    cors_kwargs: dict = {
        "allow_origins": settings.CORS_ORIGINS,
        "allow_credentials": settings.CORS_ALLOW_CREDENTIALS,
        "allow_methods": settings.CORS_ALLOW_METHODS,
        "allow_headers": settings.CORS_ALLOW_HEADERS,
    }
    if settings.CORS_ORIGIN_REGEX:
        cors_kwargs["allow_origin_regex"] = settings.CORS_ORIGIN_REGEX

    app.add_middleware(CORSMiddleware, **cors_kwargs)
    app.add_middleware(RequestContextMiddleware)

    @app.middleware("http")
    async def security_headers(request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response

    register_exception_handlers(app)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Serve locally stored resumes/avatars only outside production.
    # In production, use authenticated download endpoints (and Cloudinary).
    if not settings.is_production:
        uploads_dir = upload_root()
        uploads_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
    else:
        logger.info(
            "Production mode: /uploads static mount disabled — use authenticated file routes"
        )

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "message": settings.APP_NAME,
            "version": __version__,
            "health": f"{settings.API_V1_PREFIX}/health",
            "ready": f"{settings.API_V1_PREFIX}/health/ready",
        }

    return app


app = create_application()
