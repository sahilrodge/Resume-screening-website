"""Apply go-live ops hardening to local env + rotate seeded accounts.

Run from backend/:  python -m scripts.apply_golive_ops
"""

from __future__ import annotations

import secrets
import string
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ENV = ROOT / "backend" / ".env"
FRONTEND_ENV = ROOT / "frontend" / ".env.local"
CREDENTIALS_OUT = ROOT / "backend" / ".env.golive-credentials"


def _parse_env(text: str) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in text.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def _render_env(original: str, updates: dict[str, str]) -> str:
    """Update keys in-place when present; append missing keys at end."""
    seen: set[str] = set()
    out: list[str] = []
    for line in original.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                out.append(f"{key}={updates[key]}")
                seen.add(key)
                continue
        out.append(line)
    missing = [k for k in updates if k not in seen]
    if missing:
        if out and out[-1].strip():
            out.append("")
        out.append("# --- Go-live ops (auto-applied) ---")
        for key in missing:
            out.append(f"{key}={updates[key]}")
    return "\n".join(out).rstrip() + "\n"


def _strong_secret(n: int = 48) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _strong_password() -> str:
    # Meets app password policy: letters + number, length >= 8
    return "Hp" + _strong_secret(18) + "9!"


def apply_env() -> dict[str, str]:
    if not BACKEND_ENV.exists():
        raise SystemExit(f"Missing {BACKEND_ENV}")

    backend_text = BACKEND_ENV.read_text(encoding="utf-8-sig")
    backend = _parse_env(backend_text)

    secret = backend.get("SECRET_KEY", "").strip()
    if (
        not secret
        or len(secret) < 32
        or secret.startswith("change-me")
        or "secret-key-min" in secret
    ):
        secret = _strong_secret(48)

    admin_password = backend.get("SUPER_ADMIN_PASSWORD", "").strip() or _strong_password()
    admin_email = (
        backend.get("SUPER_ADMIN_EMAIL", "").strip() or "sahilrodge4@gmail.com"
    )

    cors = backend.get("CORS_ORIGINS", "").strip()
    # Keep localhost for local verification; ensure common local origins exist.
    required_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    origins = [o.strip() for o in cors.split(",") if o.strip()] if cors else []
    for origin in required_origins:
        if origin not in origins:
            origins.append(origin)
    # Drop overly broad wildcards if somehow present as exact values
    origins = [o for o in origins if o != "*"]

    backend_updates = {
        "APP_ENV": "production",
        "DEBUG": "false",
        "SECRET_KEY": secret,
        "SUPER_ADMIN_EMAIL": admin_email,
        "SUPER_ADMIN_FULL_NAME": backend.get("SUPER_ADMIN_FULL_NAME")
        or "Super Admin",
        "SUPER_ADMIN_PASSWORD": admin_password,
        "SEED_JOBS_IF_EMPTY": "false",
        "CORS_ORIGINS": ",".join(origins),
        "CORS_ALLOW_CREDENTIALS": "true",
        "LOG_LEVEL": "INFO",
        "LOG_FORMAT": "json",
        "PUBLIC_API_URL": backend.get("PUBLIC_API_URL") or "http://127.0.0.1:8000",
    }

    BACKEND_ENV.write_text(
        _render_env(backend_text, backend_updates), encoding="utf-8"
    )

    # Frontend AUTH_SECRET must match backend SECRET_KEY
    if FRONTEND_ENV.exists():
        front_text = FRONTEND_ENV.read_text(encoding="utf-8-sig")
    else:
        front_text = (
            "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1\n"
            "NEXT_PUBLIC_APP_NAME=HirePulse\n"
        )
    front_updates = {
        "AUTH_SECRET": secret,
        "NEXT_PUBLIC_API_URL": _parse_env(front_text).get("NEXT_PUBLIC_API_URL")
        or "http://127.0.0.1:8000/api/v1",
        "NEXT_PUBLIC_APP_NAME": _parse_env(front_text).get("NEXT_PUBLIC_APP_NAME")
        or "HirePulse",
    }
    FRONTEND_ENV.write_text(_render_env(front_text, front_updates), encoding="utf-8")

    cloudinary_ready = all(
        [
            backend.get("CLOUDINARY_CLOUD_NAME", "").strip(),
            backend.get("CLOUDINARY_API_KEY", "").strip(),
            backend.get("CLOUDINARY_API_SECRET", "").strip(),
        ]
    )

    CREDENTIALS_OUT.write_text(
        "\n".join(
            [
                "HirePulse go-live credentials (local file — do not commit)",
                f"SUPER_ADMIN_EMAIL={admin_email}",
                f"SUPER_ADMIN_PASSWORD={admin_password}",
                f"SECRET_KEY/AUTH_SECRET length={len(secret)}",
                f"CLOUDINARY_CONFIGURED={cloudinary_ready}",
                f"STORAGE_MODE={'cloudinary' if cloudinary_ready else 'authenticated-local-downloads'}",
                f"CORS_ORIGINS={','.join(origins)}",
                f"SEED_JOBS_IF_EMPTY=false",
                "",
            ]
        ),
        encoding="utf-8",
    )

    return {
        "admin_email": admin_email,
        "admin_password": admin_password,
        "secret_len": str(len(secret)),
        "cloudinary_ready": str(cloudinary_ready),
        "cors": ",".join(origins),
    }


def rotate_accounts(admin_email: str, admin_password: str) -> dict[str, int]:
    """Set Super Admin password and disable/rotate seeded recruiters."""
    # Ensure backend package imports resolve
    sys.path.insert(0, str(ROOT / "backend"))

    from app.core.security import hash_password
    from app.database import SessionLocal
    from app.models.user import User
    from sqlalchemy import select

    db = SessionLocal()
    stats = {"super_admin_updated": 0, "seed_recruiters_rotated": 0, "seed_disabled": 0}
    try:
        # Super Admin password sync
        admin = db.scalar(
            select(User).where(User.email == admin_email.strip().lower())
        )
        if admin is None:
            # Case-insensitive fallback
            admin = db.scalar(select(User).where(User.email.ilike(admin_email)))
        if admin is not None:
            admin.hashed_password = hash_password(admin_password)
            admin.is_active = True
            db.add(admin)
            stats["super_admin_updated"] = 1

        # Rotate seeded recruiters created by seed_indian_jobs
        seeded = list(
            db.scalars(
                select(User).where(User.email.ilike("seed.recruiter.%@hirepulse.local"))
            ).all()
        )
        for user in seeded:
            user.hashed_password = hash_password(_strong_password())
            user.is_active = False
            db.add(user)
            stats["seed_recruiters_rotated"] += 1
            stats["seed_disabled"] += 1

        db.commit()
    finally:
        db.close()
    return stats


def main() -> None:
    info = apply_env()
    try:
        stats = rotate_accounts(info["admin_email"], info["admin_password"])
    except Exception as exc:  # noqa: BLE001
        print(f"ENV_UPDATED=1 DB_ROTATE_FAILED={exc}")
        print(f"CREDENTIALS_FILE={CREDENTIALS_OUT}")
        raise SystemExit(1) from exc

    print("GO_LIVE_OPS_OK=1")
    print(f"APP_ENV=production")
    print(f"SUPER_ADMIN_EMAIL={info['admin_email']}")
    print(f"SECRET_LEN={info['secret_len']}")
    print(f"CLOUDINARY_CONFIGURED={info['cloudinary_ready']}")
    print(f"CORS_ORIGINS={info['cors']}")
    print(f"SEED_JOBS_IF_EMPTY=false")
    print(f"SUPER_ADMIN_UPDATED={stats['super_admin_updated']}")
    print(f"SEED_RECRUITERS_ROTATED={stats['seed_recruiters_rotated']}")
    print(f"CREDENTIALS_FILE={CREDENTIALS_OUT}")


if __name__ == "__main__":
    main()
