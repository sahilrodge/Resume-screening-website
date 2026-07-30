"""End-to-end API smoke test for HirePulse core workflows.

Creates ephemeral candidate + staff checks against the configured API.
Exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

# Load backend/.env if present
env_path = Path(__file__).resolve().parents[1] / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _resolve_api() -> str:
    explicit = os.environ.get("SMOKE_API_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    public = (os.environ.get("PUBLIC_API_URL") or "").strip().rstrip("/")
    if public and "localhost" not in public and "127.0.0.1" not in public:
        if public.endswith("/api/v1"):
            return public
        return f"{public}/api/v1"
    return "https://api-production-5f0fb.up.railway.app/api/v1"


API = _resolve_api()
ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("SUPER_ADMIN_PASSWORD", "")

failures: list[str] = []
passes: list[str] = []


def ok(label: str) -> None:
    passes.append(label)
    print(f"PASS  {label}")


def fail(label: str, detail: str) -> None:
    failures.append(f"{label}: {detail}")
    print(f"FAIL  {label}: {detail}")


def access_token(body: dict) -> str | None:
    return body.get("access_token") or (body.get("tokens") or {}).get("access_token")


def main() -> int:
    print(f"API: {API}")
    client = httpx.Client(base_url=API, timeout=45.0)

    try:
        r = client.get("/health")
        if r.status_code == 200 and r.json().get("status") == "ok":
            ok("health")
        else:
            fail("health", f"{r.status_code} {r.text[:200]}")
            return 1
    except Exception as exc:  # noqa: BLE001
        fail("health", str(exc))
        return 1

    stamp = uuid.uuid4().hex[:8]
    cand_email = f"smoke.candidate.{stamp}@example.com"
    cand_password = "SmokeTest1!"
    admin_headers: dict[str, str] = {}
    job_id: str | None = None
    company_id: str | None = None

    # --- Staff bootstrap (job must exist before candidate apply) ---
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        fail("admin_login", "SUPER_ADMIN_EMAIL/PASSWORD not set — staff/apply flows limited")
    else:
        r = client.post(
            "/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "remember_me": False,
            },
        )
        body = r.json() if r.status_code == 200 else {}
        token = access_token(body)
        if r.status_code == 200 and token:
            ok("admin_login")
            admin_headers = {"Authorization": f"Bearer {token}"}
        else:
            fail("admin_login", f"{r.status_code} {r.text[:300]}")

        if admin_headers:
            for label, path in [
                ("admin_users", "/users"),
                ("admin_candidates", "/candidates"),
                ("admin_jobs", "/jobs"),
                ("admin_applications", "/applications"),
                ("admin_interviews", "/interviews"),
                ("admin_analytics", "/analytics/overview"),
                ("admin_resumes", "/resumes"),
            ]:
                r = client.get(path, headers=admin_headers, params={"page_size": 5})
                if r.status_code == 200:
                    ok(label)
                else:
                    fail(label, f"{r.status_code} {r.text[:200]}")

            r = client.post(
                "/companies",
                headers=admin_headers,
                json={
                    "name": f"Smoke Co {stamp}",
                    "industry": "Technology",
                    "location": "Remote",
                },
            )
            if r.status_code in (200, 201):
                ok("admin_create_company")
                company_id = r.json().get("id")
            else:
                fail("admin_create_company", f"{r.status_code} {r.text[:250]}")

            if company_id:
                r = client.post(
                    "/jobs",
                    headers=admin_headers,
                    json={
                        "title": f"Smoke Backend Engineer {stamp}",
                        "description": "Python FastAPI PostgreSQL Docker",
                        "company_id": company_id,
                        "location": "Remote",
                        "employment_type": "full_time",
                        "status": "open",
                        "openings": 1,
                        "skills": ["Python", "FastAPI"],
                    },
                )
                if r.status_code in (200, 201):
                    ok("admin_create_job")
                    job_id = r.json().get("id")
                    if r.json().get("recruiter_id"):
                        ok("admin_create_job_assigns_recruiter")
                    else:
                        # Admins often have no Recruiter profile — acceptable
                        ok("admin_create_job_no_recruiter_profile")
                else:
                    fail("admin_create_job", f"{r.status_code} {r.text[:300]}")

    # --- Candidate workflow ---
    r = client.post(
        "/auth/register",
        json={
            "email": cand_email,
            "password": cand_password,
            "full_name": f"Smoke Candidate {stamp}",
            "confirm_password": cand_password,
        },
    )
    if r.status_code in (200, 201):
        ok("candidate_register")
    else:
        fail("candidate_register", f"{r.status_code} {r.text[:300]}")

    r = client.post(
        "/auth/login",
        json={"email": cand_email, "password": cand_password, "remember_me": False},
    )
    body = r.json() if r.status_code == 200 else {}
    token = access_token(body)
    if r.status_code == 200 and token:
        ok("candidate_login")
        cand_headers = {"Authorization": f"Bearer {token}"}
    else:
        fail("candidate_login", f"{r.status_code} {r.text[:300]}")
        cand_headers = {}

    app_id: str | None = None
    resume_id: str | None = None

    if cand_headers:
        r = client.get("/profile/me", headers=cand_headers)
        if r.status_code == 200:
            ok("candidate_profile_get")
        else:
            fail("candidate_profile_get", f"{r.status_code} {r.text[:200]}")

        r = client.patch(
            "/profile/me",
            headers=cand_headers,
            json={
                "headline": "Smoke Test Engineer",
                "summary": "E2E validation profile",
                "skills": ["Python", "FastAPI"],
            },
        )
        if r.status_code == 200:
            ok("candidate_profile_update")
        else:
            fail("candidate_profile_update", f"{r.status_code} {r.text[:300]}")

        files = {
            "file": (
                "smoke-resume.txt",
                b"Jane Doe\nPython FastAPI PostgreSQL\n5 years experience\n",
                "text/plain",
            )
        }
        r = client.post("/resumes/me/upload", headers=cand_headers, files=files)
        if r.status_code in (200, 201):
            ok("candidate_resume_upload")
            resume_id = r.json().get("id")
        else:
            fail("candidate_resume_upload", f"{r.status_code} {r.text[:300]}")

        r = client.get("/jobs/open", headers=cand_headers, params={"page_size": 10})
        if r.status_code == 200:
            ok("candidate_list_jobs")
            items = r.json().get("items") or []
            if not job_id and items:
                job_id = items[0].get("id")
        else:
            fail("candidate_list_jobs", f"{r.status_code} {r.text[:200]}")

        if job_id and resume_id:
            r = client.post(
                "/applications/apply",
                headers=cand_headers,
                json={"job_id": job_id, "resume_id": resume_id},
            )
            if r.status_code in (200, 201):
                ok("candidate_apply")
                app_id = r.json().get("id")
            elif r.status_code == 409:
                ok("candidate_apply_already")
            else:
                fail("candidate_apply", f"{r.status_code} {r.text[:300]}")
        else:
            fail(
                "candidate_apply",
                f"missing job_id={job_id!r} or resume_id={resume_id!r}",
            )

        r = client.get("/applications/me", headers=cand_headers)
        if r.status_code == 200:
            ok("candidate_applications_me")
            if not app_id:
                items = r.json().get("items") or []
                if items:
                    app_id = items[0].get("id")
        else:
            fail("candidate_applications_me", f"{r.status_code} {r.text[:200]}")

        r = client.get("/interviews/me", headers=cand_headers)
        if r.status_code == 200:
            ok("candidate_interviews_me")
        else:
            fail("candidate_interviews_me", f"{r.status_code} {r.text[:200]}")

        r = client.post("/auth/logout-all", headers=cand_headers)
        if r.status_code < 500:
            ok("candidate_logout")
        else:
            fail("candidate_logout", f"{r.status_code} {r.text[:200]}")

    # --- Recruiter / admin hiring pipeline ---
    if admin_headers and app_id:
        # Re-login admin (candidate logout-all may revoke shared nothing, but refresh session)
        r = client.post(
            "/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "remember_me": False,
            },
        )
        token = access_token(r.json() if r.status_code == 200 else {})
        if token:
            admin_headers = {"Authorization": f"Bearer {token}"}

        r = client.get(f"/applications/{app_id}", headers=admin_headers)
        app = r.json() if r.status_code == 200 else None
        if app is None:
            r = client.get(
                "/applications",
                headers=admin_headers,
                params={"page_size": 20, "sort_by": "created_at", "sort_order": "desc"},
            )
            if r.status_code == 200:
                for item in r.json().get("items") or []:
                    if item.get("id") == app_id:
                        app = item
                        break

        if app and app.get("resume_id") and app.get("job_id"):
            r = client.post(
                "/applications/compare",
                headers=admin_headers,
                json={"job_id": app["job_id"], "resume_id": app["resume_id"]},
            )
            if r.status_code == 200:
                ok("recruiter_screen_resume")
                app = r.json()
            else:
                fail("recruiter_screen_resume", f"{r.status_code} {r.text[:300]}")

        if app_id:
            r = client.patch(
                f"/applications/{app_id}/status",
                headers=admin_headers,
                json={"status": "selected"},
            )
            if r.status_code == 200 and r.json().get("status") == "selected":
                ok("recruiter_select_candidate")
            else:
                fail(
                    "recruiter_select_candidate",
                    f"{r.status_code} {r.text[:300]}",
                )

            when = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
            r = client.post(
                "/interviews",
                headers=admin_headers,
                json={
                    "application_id": app_id,
                    "scheduled_at": when,
                    "interview_type": "video",
                    "duration_minutes": 45,
                },
            )
            if r.status_code in (200, 201):
                ok("recruiter_schedule_interview")
                interview_id = r.json().get("id")
            else:
                fail("recruiter_schedule_interview", f"{r.status_code} {r.text[:300]}")
                interview_id = None

            if interview_id:
                r = client.patch(
                    f"/interviews/{interview_id}/status",
                    headers=admin_headers,
                    json={"status": "confirmed"},
                )
                if r.status_code == 200 and r.json().get("status") == "confirmed":
                    ok("recruiter_update_interview_status")
                    body = r.json()
                    if body.get("timeline"):
                        ok("interview_timeline_present")
                    else:
                        fail("interview_timeline_present", "timeline missing")
                    if body.get("status_changed_at"):
                        ok("interview_status_changed_at")
                    else:
                        fail("interview_status_changed_at", "missing")
                else:
                    fail(
                        "recruiter_update_interview_status",
                        f"{r.status_code} {r.text[:300]}",
                    )

        r = client.post("/auth/logout-all", headers=admin_headers)
        if r.status_code < 500:
            ok("admin_logout")
        else:
            fail("admin_logout", f"{r.status_code}")

    print("\n=== SUMMARY ===")
    print(f"Passed: {len(passes)}")
    print(f"Failed: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
