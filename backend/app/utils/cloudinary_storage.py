"""Cloudinary storage helpers with safe configuration from environment."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)

_configured = False


def missing_cloudinary_settings() -> list[str]:
    """Return names of Cloudinary env vars that are unset."""
    missing: list[str] = []
    if not (settings.CLOUDINARY_CLOUD_NAME or "").strip():
        missing.append("CLOUDINARY_CLOUD_NAME")
    if not (settings.CLOUDINARY_API_KEY or "").strip():
        missing.append("CLOUDINARY_API_KEY")
    if not (settings.CLOUDINARY_API_SECRET or "").strip():
        missing.append("CLOUDINARY_API_SECRET")
    return missing


def cloudinary_status_message() -> str:
    missing = missing_cloudinary_settings()
    if missing:
        return (
            "Cloudinary is not configured. Missing: "
            + ", ".join(missing)
            + ". Using local file storage instead."
        )
    return (
        f"Cloudinary configured (cloud={settings.CLOUDINARY_CLOUD_NAME}, "
        f"folder={settings.CLOUDINARY_FOLDER})."
    )


def is_cloudinary_ready() -> bool:
    return not missing_cloudinary_settings()


def _configure_cloudinary() -> None:
    """
    Apply Cloudinary credentials from environment.

    Raises AppException with a clear message when required variables are missing.
    Callers that support local fallback should catch this and continue.
    """
    global _configured
    missing = missing_cloudinary_settings()
    if missing:
        raise AppException(
            "Cloudinary is not configured. Set "
            + ", ".join(missing)
            + " in backend/.env (or leave them empty to use local storage in development).",
            status_code=503,
            code="cloudinary_not_configured",
            details={"missing": missing},
        )

    try:
        import cloudinary
    except ImportError as exc:
        raise AppException(
            "Cloudinary package is not installed. Run: pip install cloudinary",
            status_code=503,
            code="cloudinary_unavailable",
            details=str(exc),
        ) from exc

    try:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        _configured = True
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to apply Cloudinary configuration")
        raise AppException(
            "Cloudinary configuration failed. Check CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
            status_code=503,
            code="cloudinary_config_failed",
            details=str(exc),
        ) from exc


def upload_document(
    *,
    file_bytes: bytes,
    original_filename: str,
    candidate_id: uuid.UUID,
) -> dict[str, Any]:
    """Upload a resume document (PDF/DOCX) to Cloudinary as a raw asset."""
    _configure_cloudinary()
    import cloudinary.uploader

    public_id = f"{settings.CLOUDINARY_FOLDER}/{candidate_id}/{uuid.uuid4().hex}"
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            resource_type="raw",
            public_id=public_id,
            overwrite=False,
            use_filename=False,
            unique_filename=False,
        )
    except AppException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cloudinary document upload failed")
        raise AppException(
            "Cloudinary upload failed. Verify your Cloudinary credentials and network access.",
            status_code=502,
            code="cloudinary_upload_failed",
            details=str(exc),
        ) from exc

    ext = (
        original_filename.rsplit(".", 1)[-1].lower()
        if "." in original_filename
        else "bin"
    )
    return {
        "public_id": result.get("public_id") or public_id,
        "secure_url": result["secure_url"],
        "bytes": result.get("bytes"),
        "format": result.get("format") or ext,
        "resource_type": result.get("resource_type") or "raw",
    }


def upload_pdf(
    *,
    file_bytes: bytes,
    original_filename: str,
    candidate_id: uuid.UUID,
) -> dict[str, Any]:
    """Backward-compatible alias for PDF uploads."""
    return upload_document(
        file_bytes=file_bytes,
        original_filename=original_filename,
        candidate_id=candidate_id,
    )


def upload_image(
    *,
    file_bytes: bytes,
    user_id: uuid.UUID,
    folder: str = "hirepulse/avatars",
) -> dict[str, Any]:
    """Upload a profile image to Cloudinary. Returns public_id + secure_url."""
    _configure_cloudinary()
    import cloudinary.uploader

    public_id = f"{folder}/{user_id}/{uuid.uuid4().hex}"
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            resource_type="image",
            public_id=public_id,
            overwrite=True,
            folder=None,
            transformation=[
                {"width": 400, "height": 400, "crop": "fill", "gravity": "face"},
                {"quality": "auto", "fetch_format": "auto"},
            ],
        )
    except AppException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cloudinary image upload failed")
        raise AppException(
            "Cloudinary image upload failed. Verify your Cloudinary credentials "
            "and network access.",
            status_code=502,
            code="cloudinary_upload_failed",
            details=str(exc),
        ) from exc

    return {
        "public_id": result.get("public_id") or public_id,
        "secure_url": result["secure_url"],
        "bytes": result.get("bytes"),
        "format": result.get("format"),
        "resource_type": result.get("resource_type") or "image",
    }


def delete_asset(public_id: str, *, resource_type: str = "raw") -> None:
    """Best-effort delete from Cloudinary — never raises to callers."""
    if not is_cloudinary_ready() or not public_id:
        return
    try:
        _configure_cloudinary()
        import cloudinary.uploader

        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception:  # noqa: BLE001
        logger.warning("Cloudinary delete skipped for %s", public_id, exc_info=True)
