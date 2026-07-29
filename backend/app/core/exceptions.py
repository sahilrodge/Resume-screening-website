"""Custom exceptions and FastAPI exception handlers."""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from jose import JWTError
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "app_error",
        details: Any = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", *, details: Any = None) -> None:
        super().__init__(
            message,
            status_code=status.HTTP_404_NOT_FOUND,
            code="not_found",
            details=details,
        )


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Not authenticated", *, details: Any = None) -> None:
        super().__init__(
            message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="unauthorized",
            details=details,
        )


class ForbiddenError(AppException):
    def __init__(self, message: str = "Forbidden", *, details: Any = None) -> None:
        super().__init__(
            message,
            status_code=status.HTTP_403_FORBIDDEN,
            code="forbidden",
            details=details,
        )


class ConflictError(AppException):
    def __init__(self, message: str = "Conflict", *, details: Any = None) -> None:
        super().__init__(
            message,
            status_code=status.HTTP_409_CONFLICT,
            code="conflict",
            details=details,
        )


def _error_body(
    *,
    code: str,
    message: str,
    details: Any = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
        }
    }
    if request_id:
        body["request_id"] = request_id
    return body


def register_exception_handlers(app: FastAPI) -> None:
    """Attach global exception handlers to the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.warning(
            "Application error: %s",
            exc.message,
            extra={"path": request.url.path, "request_id": request_id},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                request_id=request_id,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)

        def _json_safe(value: Any) -> Any:
            if isinstance(value, BaseException):
                return str(value)
            if isinstance(value, dict):
                return {k: _json_safe(v) for k, v in value.items()}
            if isinstance(value, (list, tuple)):
                return [_json_safe(v) for v in value]
            return value

        details = _json_safe(exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body(
                code="validation_error",
                message="Request validation failed",
                details=details,
                request_id=request_id,
            ),
        )

    @app.exception_handler(JWTError)
    async def jwt_exception_handler(request: Request, exc: JWTError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=_error_body(
                code="invalid_token",
                message="Could not validate credentials",
                details=None,
                request_id=request_id,
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(
        request: Request,
        exc: SQLAlchemyError,
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "Database error",
            extra={"path": request.url.path, "request_id": request_id},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(
                code="database_error",
                message="A database error occurred",
                request_id=request_id,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "Unhandled error: %s",
            exc,
            extra={"path": request.url.path, "request_id": request_id},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(
                code="internal_server_error",
                message="An unexpected error occurred",
                request_id=request_id,
            ),
        )
