"""Seed demo jobs into Railway production (public DB URL + SSL)."""

from __future__ import annotations

import json
import os
import random
import secrets
import string
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

BACKEND = Path(__file__).resolve().parents[1]


def _with_ssl(url: str) -> str:
    raw = url.strip()
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    if raw.startswith("postgresql://") and "+psycopg" not in raw.split("://", 1)[0]:
        raw = "postgresql+psycopg2://" + raw[len("postgresql://") :]
    parseable = raw.replace("postgresql+psycopg2://", "postgresql://", 1)
    parts = urlparse(parseable)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("sslmode", "require")
    out = urlunparse(parts._replace(query=urlencode(query)))
    if raw.startswith("postgresql+psycopg2://"):
        out = out.replace("postgresql://", "postgresql+psycopg2://", 1)
    return out


def _fetch_public_db_url() -> str:
    result = subprocess.run(
        ["npx.cmd", "--yes", "@railway/cli", "variables", "--service", "Postgres", "--json"],
        cwd=str(BACKEND),
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    url = (data.get("DATABASE_PUBLIC_URL") or data.get("DATABASE_URL") or "").strip()
    if not url:
        raise SystemExit("No DATABASE_PUBLIC_URL on Railway Postgres service")
    return url


def _strong_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Hp" + "".join(secrets.choice(alphabet) for _ in range(18)) + "9!"


def main() -> None:
    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))

    public_url = _with_ssl(_fetch_public_db_url())
    os.environ["DATABASE_URL"] = public_url
    os.environ["APP_ENV"] = "production"
    print("Connecting to Railway Postgres…", flush=True)

    from app.core.config import get_settings

    get_settings.cache_clear()
    # Force module-level settings used by SessionLocal to match Railway URL
    import app.core.config as config_mod

    config_mod.settings = get_settings()
    print(f"DB host: {config_mod.settings.redacted_database_host()}", flush=True)

    # Rebuild engine/session against the new URL
    import app.database.session as session_mod
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    session_mod.engine = create_engine(
        config_mod.settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=3,
        max_overflow=5,
    )
    session_mod.SessionLocal = sessionmaker(
        bind=session_mod.engine, autocommit=False, autoflush=False
    )

    from sqlalchemy import func, select

    from app.core.security import hash_password
    from app.database.session import SessionLocal
    from app.models.enums import EmploymentType, JobStatus, SkillLevel, UserRole
    from app.models.job import Job
    from app.models.skill import JobSkill, Skill
    from app.models.user import User
    from scripts import seed_indian_jobs as seedmod

    db = SessionLocal()
    try:
        # Verify connectivity quickly
        db.execute(select(func.count()).select_from(Job)).scalar()
        print("DB connection OK", flush=True)

        existing_seed = seedmod.count_seed_jobs(db)
        if existing_seed:
            removed = seedmod.clear_seed_jobs(db)
            print(f"Removed {removed} old seed jobs", flush=True)

        companies = seedmod.ensure_companies(db)
        print(f"Companies ready: {len(companies)}", flush=True)
        recruiters = seedmod.ensure_recruiters(db, companies)
        print(f"Recruiters ready: {len(recruiters)}", flush=True)

        # Preload / create skills once
        skill_cache: dict[str, Skill] = {}
        all_skill_names: set[str] = set()
        for role in seedmod.ROLES:
            all_skill_names.update(role["skills"])
        for name in sorted(all_skill_names):
            row = db.scalar(select(Skill).where(Skill.name == name))
            if row is None:
                row = Skill(name=name)
                db.add(row)
                db.flush()
            skill_cache[name] = row
        db.commit()
        print(f"Skills ready: {len(skill_cache)}", flush=True)

        rng = random.Random(42)
        now = datetime.now(timezone.utc)
        company_list = list(seedmod.COMPANIES)
        # 5 jobs per company = 100 total
        slots = 5
        created = 0

        for company_idx, company_meta in enumerate(company_list):
            company = companies[company_meta["name"]]
            recruiter = recruiters[company_meta["name"]]
            for slot in range(slots):
                role_idx = (company_idx * slots + slot) % len(seedmod.ROLES)
                role = seedmod.ROLES[role_idx]
                location = seedmod.LOCATIONS[(company_idx + slot * 2) % len(seedmod.LOCATIONS)]
                if slot == 0:
                    location = company_meta["location"]
                employment = seedmod.EMPLOYMENT_MIX[
                    (company_idx + slot) % len(seedmod.EMPLOYMENT_MIX)
                ]
                exp_min, exp_max = role["exp"]
                sal_lo, sal_hi = role["salary_lpa"]
                productish = company_meta["industry"] in {
                    "Fintech",
                    "SaaS",
                    "Consumer Internet",
                    "E-commerce",
                    "Technology",
                }
                bump = 1.15 if productish else 1.0
                salary_min = seedmod.lpa_to_inr(sal_lo * bump)
                salary_max = seedmod.lpa_to_inr(sal_hi * bump)
                if employment == EmploymentType.INTERNSHIP:
                    salary_min = seedmod.lpa_to_inr(3)
                    salary_max = seedmod.lpa_to_inr(6)
                    exp_min, exp_max = 0, 1
                skills = list(role["skills"])
                closes_at = now + timedelta(days=rng.randint(30, 90))
                description = seedmod.build_description(
                    company=company_meta["name"],
                    role=role,
                    location=location,
                    exp_min=exp_min,
                    exp_max=exp_max,
                    salary_min=salary_min,
                    salary_max=salary_max,
                    employment=employment,
                    skills=skills,
                    recruiter_name=company_meta["recruiter"],
                    closes_at=closes_at,
                )
                job = Job(
                    company_id=company.id,
                    recruiter_id=recruiter.id if recruiter else None,
                    title=role["title"],
                    description=description,
                    location=location,
                    employment_type=employment,
                    status=JobStatus.OPEN,
                    salary_min=salary_min,
                    salary_max=salary_max,
                    currency="INR",
                    experience_min_years=exp_min,
                    experience_max_years=exp_max,
                    openings=rng.choice([1, 1, 2, 2, 3, 5]),
                    published_at=now - timedelta(days=rng.randint(0, 21)),
                    closes_at=closes_at,
                )
                db.add(job)
                db.flush()
                for skill_name in skills:
                    skill = skill_cache.get(skill_name)
                    if skill is None:
                        continue
                    db.add(
                        JobSkill(
                            job_id=job.id,
                            skill_id=skill.id,
                            is_required=True,
                            level=SkillLevel.INTERMEDIATE,
                        )
                    )
                created += 1
            print(
                f"Progress {company_meta['name']}: {slots} jobs ({created} total)",
                flush=True,
            )
            db.commit()

        print(f"SEED_RESULT={created}", flush=True)

        job_count = db.scalar(select(func.count()).select_from(Job)) or 0
        print(f"JOBS_TOTAL={job_count}", flush=True)

        seeded_users = list(
            db.scalars(
                select(User).where(User.email.ilike("seed.recruiter.%@hirepulse.local"))
            ).all()
        )
        for user in seeded_users:
            user.hashed_password = hash_password(_strong_password())
            user.is_active = False
            user.role = UserRole.RECRUITER
            db.add(user)
        db.commit()
        print(f"SEED_RECRUITERS_DISABLED={len(seeded_users)}", flush=True)
        print("DONE", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()
