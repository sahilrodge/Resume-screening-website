"""Unified media storage (Cloudinary with local-disk fallback)."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.utils import local_storage
from app.utils.cloudinary_storage import (
    cloudinary_status_message,
    delete_asset,
    is_cloudinary_ready,
    upload_document,
    upload_image,
)

logger = get_logger(__name__)

StorageBackend = Literal["cloudinary", "local"]


def active_backend() -> StorageBackend:
    return "cloudinary" if is_cloudinary_ready() else "local"


def storage_status() -> dict[str, Any]:
    backend = active_backend()
    return {
        "backend": backend,
        "cloudinary_configured": is_cloudinary_ready(),
        "message": cloudinary_status_message()
        if backend == "local"
        else cloudinary_status_message(),
        "local_upload_dir": str(local_storage.upload_root()),
    }


def _store_local_document(
    *,
    file_bytes: bytes,
    original_filename: str,
    candidate_id: uuid.UUID,
    reason: str,
) -> dict[str, Any]:
    logger.info(
        "Storing resume locally under %s (%s)",
        settings.LOCAL_UPLOAD_DIR,
        reason,
    )
    saved = local_storage.save_document(
        file_bytes=file_bytes,
        original_filename=original_filename,
        candidate_id=candidate_id,
    )
    return {
        "backend": "local",
        "storage_path": saved["storage_path"],
        "file_url": "",
        "format": saved.get("format"),
        "fallback_reason": reason,
    }


def _should_fallback_to_local(exc: BaseException) -> bool:
    """Prefer local storage over failing the request when Cloudinary is unavailable."""
    code = getattr(exc, "code", None)
    if code in {
        "cloudinary_not_configured",
        "cloudinary_unavailable",
        "cloudinary_config_failed",
    }:
        return True
    # Always fall back outside production so local/dev never hard-fails on Cloudinary.
    if not settings.is_production:
        return True
    # In production, still fall back when Cloudinary itself fails so uploads don't crash.
    if code == "cloudinary_upload_failed":
        return True
    return False


def store_resume(
    *,
    file_bytes: bytes,
    original_filename: str,
    candidate_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Store resume bytes.

    Uses Cloudinary when CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET are set.
    Otherwise (or when Cloudinary errors) writes to local uploads/ so the app
    keeps working without crashing.
    """
    if not is_cloudinary_ready():
        return _store_local_document(
            file_bytes=file_bytes,
            original_filename=original_filename,
            candidate_id=candidate_id,
            reason=cloudinary_status_message(),
        )

    try:
        uploaded = upload_document(
            file_bytes=file_bytes,
            original_filename=original_filename,
            candidate_id=candidate_id,
        )
        return {
            "backend": "cloudinary",
            "storage_path": uploaded["public_id"],
            "file_url": uploaded["secure_url"],
            "format": uploaded.get("format"),
        }
    except Exception as exc:  # noqa: BLE001
        if _should_fallback_to_local(exc):
            message = getattr(exc, "message", None) or str(exc)
            logger.warning(
                "Cloudinary resume upload unavailable; falling back to local storage: %s",
                message,
            )
            try:
                return _store_local_document(
                    file_bytes=file_bytes,
                    original_filename=original_filename,
                    candidate_id=candidate_id,
                    reason=message,
                )
            except AppException:
                raise
            except Exception as local_exc:  # noqa: BLE001
                logger.exception("Local resume fallback also failed")
                raise AppException(
                    "Could not store resume. Cloudinary failed and local storage "
                    "is unavailable. Check CLOUDINARY_* credentials and disk permissions "
                    f"for {settings.LOCAL_UPLOAD_DIR}.",
                    status_code=500,
                    code="resume_storage_failed",
                    details={"cloudinary": message, "local": str(local_exc)},
                ) from local_exc

        if isinstance(exc, AppException):
            raise
        raise AppException(
            "Could not store resume on Cloudinary. Verify CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
            status_code=502,
            code="cloudinary_upload_failed",
            details=str(exc),
        ) from exc


def store_image(
    *,
    file_bytes: bytes,
    original_filename: str,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """Store a profile/avatar image with Cloudinary → local fallback."""
    if is_cloudinary_ready():
        try:
            uploaded = upload_image(file_bytes=file_bytes, user_id=user_id)
            return {
                "backend": "cloudinary",
                "storage_path": uploaded["public_id"],
                "file_url": uploaded["secure_url"],
                "format": uploaded.get("format"),
            }
        except Exception as exc:  # noqa: BLE001
            if not _should_fallback_to_local(exc):
                if isinstance(exc, AppException):
                    raise
                raise AppException(
                    "Could not upload image to Cloudinary. Verify your credentials.",
                    status_code=502,
                    code="cloudinary_upload_failed",
                    details=str(exc),
                ) from exc
            logger.warning(
                "Cloudinary image upload unavailable; falling back to local storage: %s",
                getattr(exc, "message", None) or exc,
            )

    saved = local_storage.save_image(
        file_bytes=file_bytes,
        original_filename=original_filename,
        user_id=user_id,
    )
    return {
        "backend": "local",
        "storage_path": saved["storage_path"],
        "file_url": saved["public_path"],
        "public_path": saved["public_path"],
        "format": saved.get("format"),
    }


def delete_stored_resume(storage_path: str | None) -> None:
    if not storage_path:
        return
    if local_storage.is_local_storage_path(storage_path):
        local_storage.delete_local(storage_path)
        return
    delete_asset(storage_path, resource_type="raw")
