"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Always resolve backend/.env relative to this package (not process cwd).
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"


def _split_csv(value: object) -> object:
    """Parse comma-separated env values into a list of strings."""
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


def _normalize_database_url(url: str) -> str:
    """Normalize Railway/Heroku/Neon URLs to SQLAlchemy + psycopg2."""
    value = url.strip()
    if value.startswith("postgres://"):
        value = "postgresql://" + value[len("postgres://") :]
    if value.startswith("postgresql://") and "+psycopg" not in value.split("://", 1)[0]:
        value = "postgresql+psycopg2://" + value[len("postgresql://") :]
    return value


def _normalize_origin(origin: str) -> str:
    """Strip trailing slashes so browser Origin headers match."""
    return origin.strip().rstrip("/")


def _empty_str_to_none(value: object) -> object:
    """Treat blank env values as unset."""
    if isinstance(value, str) and not value.strip():
        return None
    if isinstance(value, str):
        return value.strip()
    return value


class Settings(BaseSettings):
    """Central configuration for the FastAPI application."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "AI Recruitment Management System"
    APP_ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_VERSION: str = "0.1.0"

    # Security / JWT
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Session (browser close) vs Remember Me refresh lifetimes
    REFRESH_TOKEN_SESSION_DAYS: int = 1
    REFRESH_TOKEN_REMEMBER_DAYS: int = 30
    # Back-compat alias used by older code paths
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # Idle timeout for browser sessions (minutes). 0 disables.
    IDLE_TIMEOUT_MINUTES: int = 30

    # Permanent Super Admin (bootstrapped on startup; protected from delete/demote/suspend)
    SUPER_ADMIN_EMAIL: str = "sahilrodge4@gmail.com"
    SUPER_ADMIN_FULL_NAME: str = "Super Admin"
    SUPER_ADMIN_PASSWORD: str | None = None

    # Database
    DATABASE_URL: str = Field(
        ...,
        description="SQLAlchemy database URL (PostgreSQL)",
    )
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_PRE_PING: bool = True

    # CORS (comma-separated strings in .env; NoDecode avoids JSON parsing)
    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    # Optional regex for preview deploys, e.g. https://.*\\.vercel\\.app
    CORS_ORIGIN_REGEX: str | None = None
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["*"]
    )
    CORS_ALLOW_HEADERS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["*"]
    )

    # Logging
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_FORMAT: Literal["json", "console"] = "json"
    LOG_REQUESTS: bool = True
    LOG_SKIP_PATHS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["/api/v1/health", "/api/v1/health/ready", "/"]
    )

    # OpenAI (resume parsing / matching / assistant) — set OPENAI_API_KEY in backend/.env
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Cloudinary (resume storage) — optional; falls back to local uploads/ in development
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None
    CLOUDINARY_FOLDER: str = "hirepulse/resumes"
    MAX_RESUME_SIZE_MB: int = 10
    LOCAL_UPLOAD_DIR: str = "uploads"
    # Optional absolute public API origin for local file URLs, e.g. http://127.0.0.1:8000
    PUBLIC_API_URL: str | None = None

    # Email (SMTP)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "HirePulse"
    SMTP_USE_TLS: bool = True

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_CLAIM_EMAIL: str = "mailto:admin@hirepulse.io"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            return _normalize_database_url(value)
        return value

    @field_validator(
        "OPENAI_API_KEY",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "SUPER_ADMIN_PASSWORD",
        "SMTP_HOST",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "SMTP_FROM_EMAIL",
        "VAPID_PUBLIC_KEY",
        "VAPID_PRIVATE_KEY",
        "PUBLIC_API_URL",
        mode="before",
    )
    @classmethod
    def blank_optional_secrets(cls, value: object) -> object:
        return _empty_str_to_none(value)

    @field_validator(
        "CORS_ORIGINS",
        "CORS_ALLOW_METHODS",
        "CORS_ALLOW_HEADERS",
        "LOG_SKIP_PATHS",
        mode="before",
    )
    @classmethod
    def parse_csv_lists(cls, value: object) -> object:
        return _split_csv(value)

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def normalize_cors_origins(cls, value: list[str]) -> list[str]:
        return [_normalize_origin(origin) for origin in value if origin]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def openai_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY)

    @property
    def cloudinary_configured(self) -> bool:
        """True when all three Cloudinary credentials are present (non-blank)."""
        return bool(
            (self.CLOUDINARY_CLOUD_NAME or "").strip()
            and (self.CLOUDINARY_API_KEY or "").strip()
            and (self.CLOUDINARY_API_SECRET or "").strip()
        )

    def cloudinary_missing_vars(self) -> list[str]:
        missing: list[str] = []
        if not (self.CLOUDINARY_CLOUD_NAME or "").strip():
            missing.append("CLOUDINARY_CLOUD_NAME")
        if not (self.CLOUDINARY_API_KEY or "").strip():
            missing.append("CLOUDINARY_API_KEY")
        if not (self.CLOUDINARY_API_SECRET or "").strip():
            missing.append("CLOUDINARY_API_SECRET")
        return missing


    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_FROM_EMAIL)

    @property
    def vapid_configured(self) -> bool:
        return bool(self.VAPID_PUBLIC_KEY and self.VAPID_PRIVATE_KEY)

    def redacted_database_host(self) -> str:
        try:
            parsed = urlparse(self.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1))
            return parsed.hostname or "unknown"
        except Exception:  # noqa: BLE001
            return "unknown"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (safe for dependency injection)."""
    return Settings()


settings = get_settings()
