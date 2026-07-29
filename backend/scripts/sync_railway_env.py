"""Push go-live env vars to linked Railway api service (no secret printing)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def parse_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def main() -> None:
    local = parse_env(BACKEND / ".env")
    creds_path = BACKEND / ".env.golive-credentials"
    admin_email = local.get("SUPER_ADMIN_EMAIL") or "sahilrodge4@gmail.com"
    admin_pass = local.get("SUPER_ADMIN_PASSWORD") or ""
    if creds_path.exists():
        for line in creds_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("SUPER_ADMIN_PASSWORD="):
                admin_pass = line.split("=", 1)[1].strip()
            if line.startswith("SUPER_ADMIN_EMAIL="):
                admin_email = line.split("=", 1)[1].strip()

    updates: dict[str, str] = {
        "APP_ENV": "production",
        "DEBUG": "false",
        "LOG_FORMAT": "json",
        "LOG_LEVEL": "INFO",
        "RUN_MIGRATIONS": "true",
        "SEED_JOBS_IF_EMPTY": "false",
        "PUBLIC_API_URL": "https://api-production-5f0fb.up.railway.app",
        "CORS_ORIGINS": (
            "https://hirepulse-gamma.vercel.app,"
            "https://hirepulse-sahil-5fbe.vercel.app,"
            "https://hirepulse-sahilrodge-sahil-5fbe.vercel.app,"
            "https://resume-screening-website.vercel.app"
        ),
        "CORS_ORIGIN_REGEX": r"https://.*\.vercel\.app",
        "SUPER_ADMIN_EMAIL": admin_email,
        "SUPER_ADMIN_FULL_NAME": "Super Admin",
    }
    if admin_pass:
        updates["SUPER_ADMIN_PASSWORD"] = admin_pass
    if local.get("OPENAI_API_KEY"):
        updates["OPENAI_API_KEY"] = local["OPENAI_API_KEY"]
    if local.get("OPENAI_MODEL"):
        updates["OPENAI_MODEL"] = local["OPENAI_MODEL"]
    for key in (
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "CLOUDINARY_FOLDER",
    ):
        if local.get(key):
            updates[key] = local[key]

    cmd = ["npx.cmd", "--yes", "@railway/cli", "variables"]
    for key, value in updates.items():
        cmd.extend(["--set", f"{key}={value}"])

    print("SETTING_KEYS=" + ",".join(sorted(updates.keys())))
    print("OPENAI_SET=" + str("OPENAI_API_KEY" in updates))
    print("ADMIN_PASS_SET=" + str(bool(admin_pass)))
    result = subprocess.run(cmd, cwd=str(BACKEND), capture_output=True, text=True)
    if result.stdout:
        print(result.stdout[-1500:])
    if result.stderr:
        print(result.stderr[-1500:])
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
