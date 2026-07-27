"""PDF text extraction helpers."""

from __future__ import annotations

import io

from pypdf import PdfReader

from app.core.exceptions import AppException


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text from a PDF. Raises if no readable text is found."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as exc:  # noqa: BLE001
        raise AppException(
            "Could not read PDF content",
            status_code=400,
            code="pdf_read_error",
            details=str(exc),
        ) from exc

    chunks: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            chunks.append(text.strip())

    combined = "\n\n".join(chunks).strip()
    if not combined:
        raise AppException(
            "No extractable text found in PDF (it may be a scanned image)",
            status_code=400,
            code="pdf_no_text",
        )
    # Keep prompt size reasonable
    return combined[:20000]
