"""FastAPI application entrypoint."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.database import verify_database_connection
from app.middleware.request_context import RequestContextMiddleware

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
        verify_database_connection()
    except Exception:
        logger.exception(
            "Failed to connect to PostgreSQL. Check DATABASE_URL in .env"
        )
        raise

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

    register_exception_handlers(app)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

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
