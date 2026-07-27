"""Cloudinary storage helpers for resume uploads."""

from __future__ import annotations

import uuid
from typing import Any

import cloudinary
import cloudinary.uploader

from app.core.config import settings
from app.core.exceptions import AppException


def _configure_cloudinary() -> None:
    if not settings.cloudinary_configured:
        raise AppException(
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env",
            status_code=503,
            code="cloudinary_not_configured",
        )
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_pdf(
    *,
    file_bytes: bytes,
    original_filename: str,
    candidate_id: uuid.UUID,
) -> dict[str, Any]:
    """Upload a PDF to Cloudinary as a raw asset. Returns public_id + secure_url."""
    _configure_cloudinary()

    public_id = f"{settings.CLOUDINARY_FOLDER}/{candidate_id}/{uuid.uuid4().hex}"
    result = cloudinary.uploader.upload(
        file_bytes,
        resource_type="raw",
        public_id=public_id,
        overwrite=False,
        use_filename=False,
        unique_filename=False,
    )
    return {
        "public_id": result.get("public_id") or public_id,
        "secure_url": result["secure_url"],
        "bytes": result.get("bytes"),
        "format": result.get("format") or "pdf",
        "resource_type": result.get("resource_type") or "raw",
    }


def upload_image(
    *,
    file_bytes: bytes,
    user_id: uuid.UUID,
    folder: str = "hirepulse/avatars",
) -> dict[str, Any]:
    """Upload a profile image to Cloudinary. Returns public_id + secure_url."""
    _configure_cloudinary()

    public_id = f"{folder}/{user_id}/{uuid.uuid4().hex}"
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
    return {
        "public_id": result.get("public_id") or public_id,
        "secure_url": result["secure_url"],
        "bytes": result.get("bytes"),
        "format": result.get("format"),
        "resource_type": result.get("resource_type") or "image",
    }


def delete_asset(public_id: str, *, resource_type: str = "raw") -> None:
    """Best-effort delete from Cloudinary."""
    if not settings.cloudinary_configured or not public_id:
        return
    _configure_cloudinary()
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception:
        # Non-fatal — DB row may still be removed
        pass
