"""Application settings loaded from environment variables."""

from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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


class Settings(BaseSettings):
    """Central configuration for the FastAPI application."""

    model_config = SettingsConfigDict(
        env_file=".env",
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
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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
        default_factory=lambda: ["http://localhost:3000"]
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

    # OpenAI
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Cloudinary (resume storage)
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None
    CLOUDINARY_FOLDER: str = "hirepulse/resumes"
    MAX_RESUME_SIZE_MB: int = 10

    # Twilio WhatsApp
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_WHATSAPP_FROM: str | None = None
    TWILIO_STATUS_CALLBACK_URL: str | None = None
    TWILIO_VALIDATE_SIGNATURE: bool = False
    WHATSAPP_REMINDER_HOURS: int = 24

    # Vapi AI voice screening
    VAPI_API_KEY: str | None = None
    VAPI_PHONE_NUMBER_ID: str | None = None
    VAPI_ASSISTANT_ID: str | None = None
    VAPI_WEBHOOK_SECRET: str | None = None
    VAPI_BASE_URL: str = "https://api.vapi.ai"
    VAPI_AUTO_CALL_ON_APPLY: bool = True

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
    def cloudinary_configured(self) -> bool:
        return bool(
            self.CLOUDINARY_CLOUD_NAME
            and self.CLOUDINARY_API_KEY
            and self.CLOUDINARY_API_SECRET
        )

    @property
    def twilio_configured(self) -> bool:
        return bool(
            self.TWILIO_ACCOUNT_SID
            and self.TWILIO_AUTH_TOKEN
            and self.TWILIO_WHATSAPP_FROM
        )

    @property
    def vapi_configured(self) -> bool:
        return bool(self.VAPI_API_KEY and self.VAPI_PHONE_NUMBER_ID)

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
