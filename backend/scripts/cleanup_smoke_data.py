"""Remove smoke / ephemeral E2E test data from the database.

Targets only clearly ephemeral smoke artifacts created by scripts/e2e_smoke.py:
  - users: smoke.candidate.*@example.com, full_name like "Smoke Candidate%"
  - companies: "Smoke Co%"
  - jobs: "Smoke Backend Engineer%"

Does NOT delete:
  - Super Admin
  - seed.recruiter.* accounts
  - Indian job seed companies/roles
  - any other production users

Usage:
  python -m scripts.cleanup_smoke_data           # apply
  python -m scripts.cleanup_smoke_data --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import delete, func, or_, select, update

# Ensure backend root is importable
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load local .env defaults (without overriding existing env)
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _normalize_db_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _ensure_database_url() -> None:
    # Prefer an explicit override, then Railway public URL (never use *.railway.internal
    # or local postgres from backend/.env when cleaning production smoke data).
    for key in ("SMOKE_CLEANUP_DATABASE_URL", "DATABASE_PUBLIC_URL"):
        url = (os.environ.get(key) or "").strip()
        if url and "railway.internal" not in url:
            os.environ["DATABASE_URL"] = _normalize_db_url(url)
            print(f"Using database from {key}")
            return

    try:
        raw = subprocess.check_output(
            [
                "npx.cmd",
                "--yes",
                "@railway/cli",
                "variables",
                "--service",
                "Postgres",
                "--json",
            ],
            cwd=str(ROOT),
            text=True,
            stderr=subprocess.DEVNULL,
        )
        start = raw.find("{")
        data = json.loads(raw[start:])
        url = (data.get("DATABASE_PUBLIC_URL") or "").strip()
        if not url or "railway.internal" in url:
            raise RuntimeError("No public DATABASE_URL on Railway Postgres service")
        os.environ["DATABASE_URL"] = _normalize_db_url(url)
        print("Using Railway Postgres DATABASE_PUBLIC_URL")
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"Could not resolve production DATABASE_URL: {exc}") from exc

    # Force settings/engine to pick up the overridden URL
    os.environ.pop("DATABASE_URL_cached", None)


_ensure_database_url()

# Build a dedicated engine AFTER DATABASE_URL is set (avoid local .env engine).
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.models.application import Application  # noqa: E402
from app.models.assistant import AssistantConversation  # noqa: E402
from app.models.candidate import Candidate  # noqa: E402
from app.models.company import Company  # noqa: E402
from app.models.interview import Interview  # noqa: E402
from app.models.job import Job  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.resume import Resume  # noqa: E402
from app.models.saved_job import SavedJob  # noqa: E402
from app.models.user import User  # noqa: E402

_engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
SessionLocal = sessionmaker(
    bind=_engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
    expire_on_commit=False,
)

SUPER_ADMIN_EMAIL = (os.environ.get("SUPER_ADMIN_EMAIL") or "").strip().lower()


def is_protected_user(user: User) -> bool:
    email = (user.email or "").lower()
    if SUPER_ADMIN_EMAIL and email == SUPER_ADMIN_EMAIL:
        return True
    if user.role.value == "admin" and email.endswith("@gmail.com"):
        # Extra safety: never wipe primary admin accounts by smoke heuristics
        if "smoke" not in email and "smoke" not in (user.full_name or "").lower():
            return True
    return False


def find_smoke_users(db) -> list[User]:
    rows = list(
        db.scalars(
            select(User).where(
                or_(
                    User.email.ilike("smoke.%"),
                    User.email.ilike("smoke%@%"),
                    User.email.ilike("%.smoke.%@%"),
                    User.email.ilike("smoke.candidate.%@example.com"),
                    User.email.ilike("deploy.check.%@example.com"),
                    User.full_name.ilike("Smoke Candidate%"),
                    User.full_name.ilike("Smoke Test%"),
                    User.full_name.ilike("Deploy Check%"),
                )
            )
        ).all()
    )
    return [u for u in rows if not is_protected_user(u)]


def find_smoke_companies(db) -> list[Company]:
    return list(
        db.scalars(select(Company).where(Company.name.ilike("Smoke Co%"))).all()
    )


def find_smoke_jobs(db, company_ids: list) -> list[Job]:
    clauses = [Job.title.ilike("Smoke Backend Engineer%")]
    if company_ids:
        clauses.append(Job.company_id.in_(company_ids))
    return list(db.scalars(select(Job).where(or_(*clauses))).all())


def count_where(db, model, *filters) -> int:
    stmt = select(func.count()).select_from(model)
    if filters:
        stmt = stmt.where(*filters)
    return int(db.scalar(stmt) or 0)


def cleanup(*, dry_run: bool) -> dict[str, int | list]:
    stats: dict[str, int | list] = {
        "users": 0,
        "candidates": 0,
        "resumes": 0,
        "applications": 0,
        "interviews": 0,
        "notifications": 0,
        "saved_jobs": 0,
        "assistant_conversations": 0,
        "jobs": 0,
        "companies": 0,
        "user_emails": [],
        "company_names": [],
        "job_titles": [],
    }

    db = SessionLocal()
    try:
        users = find_smoke_users(db)
        user_ids = [u.id for u in users]
        emails = [u.email for u in users]
        stats["user_emails"] = emails

        candidates = []
        if user_ids:
            candidates = list(
                db.scalars(
                    select(Candidate).where(Candidate.user_id.in_(user_ids))
                ).all()
            )
        candidate_ids = [c.id for c in candidates]

        applications = []
        if candidate_ids:
            applications = list(
                db.scalars(
                    select(Application).where(Application.candidate_id.in_(candidate_ids))
                ).all()
            )
        application_ids = [a.id for a in applications]

        companies = find_smoke_companies(db)
        company_ids = [c.id for c in companies]
        stats["company_names"] = [c.name for c in companies]

        jobs = find_smoke_jobs(db, company_ids)
        job_ids = [j.id for j in jobs]
        stats["job_titles"] = [j.title for j in jobs]

        # Applications against smoke jobs (any candidate)
        if job_ids:
            stmt = select(Application).where(Application.job_id.in_(job_ids))
            if application_ids:
                stmt = stmt.where(Application.id.notin_(application_ids))
            extra_apps = list(db.scalars(stmt).all())
            for a in extra_apps:
                applications.append(a)
                application_ids.append(a.id)

        interviews = []
        if application_ids:
            interviews = list(
                db.scalars(
                    select(Interview).where(Interview.application_id.in_(application_ids))
                ).all()
            )

        # Notifications owned by smoke users OR referencing smoke applications
        notif_filters = []
        if user_ids:
            notif_filters.append(Notification.user_id.in_(user_ids))
        # Title/message heuristics for admin alerts about smoke candidates
        notif_filters.append(Notification.title.ilike("%Smoke Candidate%"))
        notif_filters.append(Notification.message.ilike("%Smoke Candidate%"))
        notifications = list(
            db.scalars(select(Notification).where(or_(*notif_filters))).all()
        )
        # Also match meta.application_id for smoke apps
        if application_ids:
            for n in db.scalars(select(Notification)).all():
                meta = n.meta or {}
                app_id = meta.get("application_id") if isinstance(meta, dict) else None
                if app_id and str(app_id) in {str(i) for i in application_ids}:
                    if n not in notifications:
                        notifications.append(n)

        saved = []
        if candidate_ids:
            saved = list(
                db.scalars(
                    select(SavedJob).where(SavedJob.candidate_id.in_(candidate_ids))
                ).all()
            )
        if job_ids:
            extra_saved = list(
                db.scalars(select(SavedJob).where(SavedJob.job_id.in_(job_ids))).all()
            )
            for s in extra_saved:
                if s not in saved:
                    saved.append(s)

        resumes = []
        if candidate_ids:
            resumes = list(
                db.scalars(
                    select(Resume).where(Resume.candidate_id.in_(candidate_ids))
                ).all()
            )

        conversations = []
        if user_ids:
            conversations = list(
                db.scalars(
                    select(AssistantConversation).where(
                        AssistantConversation.created_by_user_id.in_(user_ids)
                    )
                ).all()
            )

        stats["users"] = len(users)
        stats["candidates"] = len(candidates)
        stats["resumes"] = len(resumes)
        stats["applications"] = len(applications)
        stats["interviews"] = len(interviews)
        stats["notifications"] = len(notifications)
        stats["saved_jobs"] = len(saved)
        stats["assistant_conversations"] = len(conversations)
        stats["jobs"] = len(jobs)
        stats["companies"] = len(companies)

        print("=== Smoke data cleanup plan ===")
        print(f"Users ({len(users)}):")
        for u in users:
            print(f"  - {u.email} | {u.full_name} | {u.role.value}")
        print(f"Applications: {len(applications)}")
        print(f"Interviews: {len(interviews)}")
        print(f"Notifications: {len(notifications)}")
        print(f"Resumes: {len(resumes)}")
        print(f"Saved jobs: {len(saved)}")
        print(f"Assistant conversations: {len(conversations)}")
        print(f"Jobs ({len(jobs)}):")
        for j in jobs:
            print(f"  - {j.title}")
        print(f"Companies ({len(companies)}):")
        for c in companies:
            print(f"  - {c.name}")

        if dry_run:
            print("\nDRY RUN — no changes committed.")
            return stats

        # Delete in FK-safe order
        if interviews:
            db.execute(
                delete(Interview).where(
                    Interview.id.in_([i.id for i in interviews])
                )
            )
        if application_ids:
            db.execute(
                update(AssistantConversation)
                .where(AssistantConversation.application_id.in_(application_ids))
                .values(application_id=None)
            )
            db.execute(
                delete(Application).where(Application.id.in_(application_ids))
            )
        if notifications:
            db.execute(
                delete(Notification).where(
                    Notification.id.in_([n.id for n in notifications])
                )
            )
        if saved:
            db.execute(delete(SavedJob).where(SavedJob.id.in_([s.id for s in saved])))
        if resumes:
            db.execute(delete(Resume).where(Resume.id.in_([r.id for r in resumes])))
        if conversations:
            db.execute(
                delete(AssistantConversation).where(
                    AssistantConversation.id.in_([c.id for c in conversations])
                )
            )
        if job_ids:
            db.execute(delete(Job).where(Job.id.in_(job_ids)))
        if company_ids:
            db.execute(delete(Company).where(Company.id.in_(company_ids)))
        if candidate_ids:
            db.execute(
                delete(Candidate).where(Candidate.id.in_(candidate_ids))
            )
        if user_ids:
            db.execute(
                update(Interview)
                .where(Interview.interviewer_id.in_(user_ids))
                .values(interviewer_id=None)
            )
            db.execute(delete(User).where(User.id.in_(user_ids)))

        db.commit()
        print("\nCommitted cleanup successfully.")
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print matching records without deleting",
    )
    args = parser.parse_args()
    stats = cleanup(dry_run=args.dry_run)
    print("\n=== Summary ===")
    for key in (
        "users",
        "candidates",
        "resumes",
        "applications",
        "interviews",
        "notifications",
        "saved_jobs",
        "assistant_conversations",
        "jobs",
        "companies",
    ):
        print(f"{key}: {stats[key]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
