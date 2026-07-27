"""Check PostgreSQL readiness for the recruitment app."""

from sqlalchemy import inspect, text

from app.database.database import verify_database_connection
from app.database.session import engine

EXPECTED = {
    "users",
    "refresh_tokens",
    "companies",
    "candidates",
    "recruiters",
    "jobs",
    "applications",
    "skills",
    "candidate_skills",
    "job_skills",
    "interviews",
    "resumes",
    "notifications",
    "notification_preferences",
    "push_subscriptions",
    "assistant_conversations",
    "assistant_messages",
    "alembic_version",
}


def main() -> None:
    verify_database_connection()
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT current_database()")).scalar_one()
        version = conn.execute(text("SELECT version()")).scalar_one()
        alembic = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()

    missing = sorted(EXPECTED - tables)
    print(f"database: {db_name}")
    print(f"postgres: {str(version).split(',')[0]}")
    print(f"alembic:  {alembic}")
    print(f"tables:   {len(tables)}")
    for name in sorted(tables):
        print(f"  - {name}")
    if missing:
        print("MISSING:", ", ".join(missing))
        raise SystemExit(1)
    print("STATUS: READY")


if __name__ == "__main__":
    main()
