"""Reset ALL applications and related hiring artifacts.

Deletes:
  - Every application (demo / smoke / test / production history)
  - Every interview
  - Notifications tied to those applications (meta.application_id or hiring events)
  - Clears assistant conversation application_id references

Keeps:
  - Users
  - Candidates / profiles
  - Resumes
  - Jobs
  - Companies
  - Recruiters
  - Saved jobs
  - Non-application notifications

Usage:
  python -m scripts.reset_all_applications --dry-run
  python -m scripts.reset_all_applications
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import delete, func, or_, select, update

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

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


_ensure_database_url()

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
from app.models.user import User  # noqa: E402

_engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
SessionLocal = sessionmaker(
    bind=_engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
    expire_on_commit=False,
)

HIRING_EVENT_PREFIXES = (
    "application_",
    "status_",
    "interview_",
)


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def _notification_targets_application(n: Notification, app_ids: set[str]) -> bool:
    meta = n.meta if isinstance(n.meta, dict) else {}
    app_id = meta.get("application_id")
    if app_id and str(app_id) in app_ids:
        return True
    event = str(meta.get("event") or "")
    if any(event.startswith(prefix) for prefix in HIRING_EVENT_PREFIXES):
        return True
    link = (n.link or "").lower()
    if "/screening/" in link or "/interviews" in link:
        return True
    title = (n.title or "").lower()
    if any(
        token in title
        for token in (
            "application",
            "interview",
            "candidate selected",
            "candidate rejected",
            "screening",
        )
    ):
        return True
    return False


def reset(*, dry_run: bool) -> dict[str, int]:
    db = SessionLocal()
    stats: dict[str, int] = {}
    try:
        before = {
            "users": _count(db, User),
            "candidates": _count(db, Candidate),
            "companies": _count(db, Company),
            "jobs": _count(db, Job),
            "resumes": _count(db, Resume),
            "applications": _count(db, Application),
            "interviews": _count(db, Interview),
            "notifications": _count(db, Notification),
            "assistant_conversations": _count(db, AssistantConversation),
        }

        applications = list(db.scalars(select(Application)).all())
        app_ids = [a.id for a in applications]
        app_id_strs = {str(i) for i in app_ids}

        interviews = list(db.scalars(select(Interview)).all())

        notifications = [
            n
            for n in db.scalars(select(Notification)).all()
            if _notification_targets_application(n, app_id_strs)
            or (
                # Even with zero apps, clear leftover hiring-event notifications
                isinstance(n.meta, dict)
                and any(
                    str(n.meta.get("event") or "").startswith(p)
                    for p in HIRING_EVENT_PREFIXES
                )
            )
            or "/screening/" in (n.link or "").lower()
            or "/interviews" in (n.link or "").lower()
        ]
        # Deduplicate by id
        seen: set = set()
        unique_notifications: list[Notification] = []
        for n in notifications:
            if n.id in seen:
                continue
            seen.add(n.id)
            unique_notifications.append(n)
        notifications = unique_notifications

        conversations_with_app = list(
            db.scalars(
                select(AssistantConversation).where(
                    AssistantConversation.application_id.is_not(None)
                )
            ).all()
        )

        stats = {
            "applications_deleted": len(applications),
            "interviews_deleted": len(interviews),
            "notifications_deleted": len(notifications),
            "assistant_app_refs_cleared": len(conversations_with_app),
            "users_kept": before["users"],
            "candidates_kept": before["candidates"],
            "companies_kept": before["companies"],
            "jobs_kept": before["jobs"],
            "resumes_kept": before["resumes"],
        }

        print("=== Reset all applications — plan ===")
        print(f"Applications to delete: {len(applications)}")
        by_status: dict[str, int] = {}
        for a in applications:
            key = a.status.value if hasattr(a.status, "value") else str(a.status)
            by_status[key] = by_status.get(key, 0) + 1
        for status, count in sorted(by_status.items()):
            print(f"  - {status}: {count}")
        print(f"Interviews to delete: {len(interviews)}")
        print(f"Related notifications to delete: {len(notifications)}")
        print(f"Assistant conversations to unlink: {len(conversations_with_app)}")
        print("--- kept ---")
        print(f"Users: {before['users']}")
        print(f"Candidates/profiles: {before['candidates']}")
        print(f"Companies: {before['companies']}")
        print(f"Jobs: {before['jobs']}")
        print(f"Resumes: {before['resumes']}")

        if dry_run:
            print("\nDRY RUN — no changes committed.")
            stats["dry_run"] = 1
            return stats

        # FK-safe order
        if interviews:
            db.execute(delete(Interview))
        if conversations_with_app:
            db.execute(
                update(AssistantConversation)
                .where(AssistantConversation.application_id.is_not(None))
                .values(application_id=None)
            )
        if notifications:
            db.execute(
                delete(Notification).where(
                    Notification.id.in_([n.id for n in notifications])
                )
            )
        if applications:
            db.execute(delete(Application))

        db.commit()

        after = {
            "applications": _count(db, Application),
            "interviews": _count(db, Interview),
            "users": _count(db, User),
            "jobs": _count(db, Job),
            "companies": _count(db, Company),
            "candidates": _count(db, Candidate),
            "resumes": _count(db, Resume),
            "notifications": _count(db, Notification),
        }
        stats["applications_remaining"] = after["applications"]
        stats["interviews_remaining"] = after["interviews"]
        stats["notifications_remaining"] = after["notifications"]
        stats["users_after"] = after["users"]
        stats["jobs_after"] = after["jobs"]
        stats["companies_after"] = after["companies"]
        stats["candidates_after"] = after["candidates"]
        stats["resumes_after"] = after["resumes"]

        print("\nCommitted reset successfully.")
        print("--- after ---")
        print(f"Applications remaining: {after['applications']}")
        print(f"Interviews remaining: {after['interviews']}")
        print(f"Notifications remaining: {after['notifications']}")
        print(f"Users: {after['users']} (unchanged expected {before['users']})")
        print(f"Jobs: {after['jobs']} (unchanged expected {before['jobs']})")
        print(
            f"Companies: {after['companies']} (unchanged expected {before['companies']})"
        )
        print(
            f"Candidates: {after['candidates']} (unchanged expected {before['candidates']})"
        )
        print(f"Resumes: {after['resumes']} (unchanged expected {before['resumes']})")

        if after["applications"] != 0 or after["interviews"] != 0:
            raise RuntimeError(
                "Cleanup incomplete — applications or interviews still remain"
            )
        if after["users"] != before["users"]:
            raise RuntimeError("Users count changed — aborting expectation failure")
        if after["jobs"] != before["jobs"]:
            raise RuntimeError("Jobs count changed — aborting expectation failure")
        if after["companies"] != before["companies"]:
            raise RuntimeError("Companies count changed — aborting expectation failure")

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
    stats = reset(dry_run=args.dry_run)
    print("\n=== Cleanup summary ===")
    for key, value in stats.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
