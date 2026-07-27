"""Database helpers: session dependency and connection verification."""

from collections.abc import Generator

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database.session import SessionLocal, engine

logger = get_logger(__name__)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_database_connection() -> None:
    """Verify PostgreSQL connectivity. Raises on failure."""
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        result.scalar_one()
        db_name = connection.execute(text("SELECT current_database()")).scalar_one()
        version = connection.execute(text("SELECT version()")).scalar_one()

    logger.info(
        "PostgreSQL connection verified | database=%s | %s",
        db_name,
        str(version).split(",")[0],
    )
