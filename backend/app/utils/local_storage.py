"""Local filesystem storage for resume uploads (dev fallback)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)

LOCAL_PREFIX = "local:"


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def upload_root() -> Path:
    configured = (settings.LOCAL_UPLOAD_DIR or "uploads").strip()
    root = Path(configured)
    if not root.is_absolute():
        root = _backend_root() / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_ext(filename: str) -> str:
    if "." not in filename:
        return "bin"
    ext = filename.rsplit(".", 1)[-1].lower()
    ext = re.sub(r"[^a-z0-9]", "", ext)[:12]
    return ext or "bin"


def save_document(
    *,
    file_bytes: bytes,
    original_filename: str,
    candidate_id: uuid.UUID,
) -> dict[str, str]:
    """Persist resume bytes under uploads/resumes/{candidate_id}/."""
    if not file_bytes:
        raise AppException("Uploaded file is empty", status_code=400, code="empty_file")

    ext = _safe_ext(original_filename)
    relative = Path("resumes") / str(candidate_id) / f"{uuid.uuid4().hex}.{ext}"
    absolute = upload_root() / relative
    absolute.parent.mkdir(parents=True, exist_ok=True)
    try:
        absolute.write_bytes(file_bytes)
    except OSError as exc:
        logger.exception("Local resume save failed")
        raise AppException(
            "Could not save resume file locally",
            status_code=500,
            code="local_storage_failed",
            details=str(exc),
        ) from exc

    storage_path = f"{LOCAL_PREFIX}{relative.as_posix()}"
    return {
        "storage_path": storage_path,
        "relative_path": relative.as_posix(),
        "absolute_path": str(absolute),
        "format": ext,
    }


def save_image(
    *,
    file_bytes: bytes,
    original_filename: str,
    user_id: uuid.UUID,
    folder: str = "avatars",
) -> dict[str, str]:
    """Persist an image under uploads/{folder}/{user_id}/."""
    if not file_bytes:
        raise AppException("Uploaded file is empty", status_code=400, code="empty_file")

    ext = _safe_ext(original_filename or "avatar.jpg")
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    relative = Path(folder) / str(user_id) / f"{uuid.uuid4().hex}.{ext}"
    absolute = upload_root() / relative
    absolute.parent.mkdir(parents=True, exist_ok=True)
    try:
        absolute.write_bytes(file_bytes)
    except OSError as exc:
        logger.exception("Local image save failed")
        raise AppException(
            "Could not save image file locally",
            status_code=500,
            code="local_storage_failed",
            details=str(exc),
        ) from exc

    return {
        "storage_path": f"{LOCAL_PREFIX}{relative.as_posix()}",
        "relative_path": relative.as_posix(),
        "absolute_path": str(absolute),
        "public_path": f"/uploads/{relative.as_posix()}",
        "format": ext,
    }


def is_local_storage_path(storage_path: str | None) -> bool:
    return bool(storage_path and storage_path.startswith(LOCAL_PREFIX))


def resolve_local_path(storage_path: str) -> Path:
    if not is_local_storage_path(storage_path):
        raise AppException(
            "Not a local storage path",
            status_code=400,
            code="invalid_storage_path",
        )
    relative = storage_path[len(LOCAL_PREFIX) :].lstrip("/\\")
    # Prevent path traversal
    candidate = (upload_root() / relative).resolve()
    root = upload_root().resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise AppException(
            "Invalid local file path",
            status_code=400,
            code="invalid_storage_path",
        ) from exc
    if not candidate.is_file():
        raise AppException(
            "Resume file is missing from local storage",
            status_code=404,
            code="local_file_missing",
        )
    return candidate


def delete_local(storage_path: str | None) -> None:
    if not is_local_storage_path(storage_path):
        return
    assert storage_path is not None
    try:
        path = resolve_local_path(storage_path)
        path.unlink(missing_ok=True)
        # Best-effort cleanup of empty candidate folder
        parent = path.parent
        if parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
    except AppException:
        return
    except OSError:
        logger.warning("Failed to delete local resume file: %s", storage_path)
