"""QA: full candidate -> recruiter -> admin hiring workflow.

Stops on first failure with enough context to locate the owning layer.
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

API = (
    os.environ.get("SMOKE_API_URL")
    or os.environ.get("PUBLIC_API_URL")
    or "https://api-production-5f0fb.up.railway.app"
).rstrip("/")
if "localhost" in API or "127.0.0.1" in API:
    API = "https://api-production-5f0fb.up.railway.app/api/v1"
elif not API.endswith("/api/v1"):
    API = f"{API}/api/v1"

ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("SUPER_ADMIN_PASSWORD", "")

passes: list[str] = []
failed_at: str | None = None
failed_detail: str | None = None


def ok(step: str) -> None:
    passes.append(step)
    print(f"PASS  {step}")


def stop(step: str, detail: str) -> None:
    global failed_at, failed_detail
    failed_at = step
    failed_detail = detail
    print(f"FAIL  {step}: {detail}")
    raise SystemExit(1)


def token_from(body: dict) -> str | None:
    return body.get("access_token") or (body.get("tokens") or {}).get("access_token")


def main() -> int:
    print(f"API: {API}")
    print("=== QA workflow start ===")
    client = httpx.Client(base_url=API, timeout=90.0)

    r = client.get("/health")
    if r.status_code != 200 or r.json().get("status") != "ok":
        stop("health", f"{r.status_code} {r.text[:200]}")
    ok("0. API health")

    stamp = uuid.uuid4().hex[:8]
    cand_email = f"qa.candidate.{stamp}@example.com"
    cand_password = "QaTest123!"

    # --- Candidate register + login ---
    r = client.post(
        "/auth/register",
        json={
            "email": cand_email,
            "password": cand_password,
            "confirm_password": cand_password,
            "full_name": f"QA Candidate {stamp}",
            "role": "candidate",
        },
    )
    if r.status_code not in (200, 201):
        stop(
            "1. Candidate register",
            f"{r.status_code} {r.text[:300]} | auth_service.register / endpoints/auth.py",
        )
    ok("1. Candidate register")

    r = client.post(
        "/auth/login",
        json={"email": cand_email, "password": cand_password, "remember_me": False},
    )
    body = r.json() if r.status_code == 200 else {}
    cand_token = token_from(body)
    if not cand_token:
        stop(
            "2. Candidate login",
            f"{r.status_code} {r.text[:300]} | auth_service.login / endpoints/auth.py",
        )
    ok("2. Candidate login")
    cand_h = {"Authorization": f"Bearer {cand_token}"}

    # --- Upload resume (text-based; product requires extractable text) ---
    resume_text = (
        "QA Candidate Resume\n"
        "Email: qa@example.com\n"
        "Skills: Python, FastAPI, SQL, React, PostgreSQL, TypeScript\n"
        "Experience:\n"
        "- Backend Engineer at Acme (2021-2024): built APIs with FastAPI and SQL\n"
        "- Intern at Beta Corp: React dashboards\n"
        "Education: B.Tech Computer Science\n"
        "Projects: HirePulse screening prototype\n"
        "Certifications: AWS Cloud Practitioner\n"
    ).encode("utf-8")
    r = client.post(
        "/resumes/me/upload",
        headers=cand_h,
        files={"file": ("qa-resume.txt", resume_text, "text/plain")},
    )
    if r.status_code not in (200, 201):
        stop(
            "3. Upload resume",
            f"{r.status_code} {r.text[:300]} | resume_service.upload / endpoints/resumes.py",
        )
    resume = r.json()
    resume_id = resume.get("id")
    ok(f"3. Upload resume ({resume_id})")

    # --- Staff/admin login (acts as recruiter) ---
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        stop("4. Recruiter/admin login", "SUPER_ADMIN_EMAIL/PASSWORD missing in .env")
    r = client.post(
        "/auth/login",
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "remember_me": False,
        },
    )
    body = r.json() if r.status_code == 200 else {}
    admin_token = token_from(body)
    if not admin_token:
        stop(
            "4. Recruiter/admin login",
            f"{r.status_code} {r.text[:300]} | auth_service.login",
        )
    ok("4. Recruiter/admin login")
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # Pick an open job
    r = client.get("/jobs", headers=admin_h, params={"page_size": 20, "status": "open"})
    if r.status_code != 200:
        # fallback without status filter
        r = client.get("/jobs", headers=admin_h, params={"page_size": 20})
    jobs = (r.json().get("items") if r.status_code == 200 else None) or []
    open_jobs = [j for j in jobs if j.get("status") == "open"] or jobs
    if not open_jobs:
        stop("5. Find open job", "No jobs available | jobs endpoints / seed data")
    job = open_jobs[0]
    job_id = job["id"]
    ok(f"5. Find open job ({job.get('title')})")

    # --- Candidate apply ---
    r = client.post(
        "/applications/apply",
        headers=cand_h,
        json={"job_id": job_id, "resume_id": resume_id},
    )
    if r.status_code not in (200, 201):
        stop(
            "6. Candidate apply for job",
            f"{r.status_code} {r.text[:300]} | application_service.apply / endpoints/applications.py",
        )
    application = r.json()
    app_id = application["id"]
    ok(f"6. Candidate apply for job (app={app_id}, status={application.get('status')})")

    # --- Recruiter sees application ---
    r = client.get("/applications", headers=admin_h, params={"page_size": 50})
    if r.status_code != 200:
        stop(
            "7. Recruiter sees application",
            f"{r.status_code} {r.text[:300]} | application_service.list",
        )
    items = r.json().get("items") or []
    found = next((a for a in items if a.get("id") == app_id), None)
    if not found:
        stop(
            "7. Recruiter sees application",
            f"application {app_id} missing from list | application_service.list / crud/application.py",
        )
    ok("7. Recruiter sees application")

    # --- Resume screening (compare) ---
    r = client.post(
        "/applications/compare",
        headers=admin_h,
        json={"job_id": job_id, "resume_id": resume_id},
    )
    if r.status_code not in (200, 201):
        stop(
            "8. Resume screening",
            f"{r.status_code} {r.text[:400]} | application_service.compare / services/application.py",
        )
    screened = r.json()
    app_id = screened.get("id") or app_id
    ok(
        f"8. Resume screening (status={screened.get('status')}, "
        f"ats={screened.get('ats_score')}, engine={screened.get('scoring_engine')})"
    )

    # --- Select candidate (confirm equivalent = PATCH status) ---
    r = client.patch(
        f"/applications/{app_id}/status",
        headers=admin_h,
        json={"status": "selected"},
    )
    if r.status_code != 200:
        stop(
            "9. Click Select -> Confirm (status update)",
            f"{r.status_code} {r.text[:300]} | application_service.update_status",
        )
    selected_app = r.json()
    if selected_app.get("status") != "selected":
        stop(
            "10. Application status -> Selected",
            f"got {selected_app.get('status')} | application_service.update_status / crud/application.update_status",
        )
    ok("9. Select confirmed via API")
    ok("10. Application status -> Selected")

    # --- Schedule interview ---
    when = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    r = client.post(
        "/interviews",
        headers=admin_h,
        json={
            "application_id": app_id,
            "scheduled_at": when,
            "interview_type": "video",
            "duration_minutes": 45,
        },
    )
    if r.status_code not in (200, 201):
        stop(
            "11. Interview scheduled",
            f"{r.status_code} {r.text[:300]} | interview_service.create",
        )
    interview = r.json()
    iv_id = interview["id"]
    # After schedule, application should move to interview unless terminal selected blocks it.
    # Current sync: terminal selected is NOT overwritten by schedule.
    app_status_after_schedule = interview.get("application_status")
    ok(
        f"11. Interview scheduled (iv={iv_id}, interview_status={interview.get('status')}, "
        f"application_status={app_status_after_schedule})"
    )

    # Dropdown equivalent: list statuses exist and PATCH works
    if interview.get("status") != "scheduled":
        stop(
            "12. Interview status dropdown source",
            f"expected scheduled got {interview.get('status')} | interview_crud.create",
        )
    ok("12. Interview status present (Scheduled) - dropdown source OK")

    # Recruiter -> Completed
    r = client.patch(
        f"/interviews/{iv_id}/status",
        headers=admin_h,
        json={"status": "completed"},
    )
    if r.status_code != 200:
        stop(
            "13. Recruiter changes status to Completed",
            f"{r.status_code} {r.text[:300]} | interview_service.update_status",
        )
    completed = r.json()
    if completed.get("status") != "completed":
        stop(
            "13. Recruiter changes status to Completed",
            f"interview status={completed.get('status')}",
        )
    ok(
        f"13. Interview -> Completed (application_status={completed.get('application_status')})"
    )

    # Recruiter -> Selected (interview decision)
    r = client.patch(
        f"/interviews/{iv_id}/status",
        headers=admin_h,
        json={"status": "selected"},
    )
    if r.status_code != 200:
        stop(
            "14. Recruiter changes status to Selected",
            f"{r.status_code} {r.text[:300]} | interview_service.update_status / _sync_application_status",
        )
    decided = r.json()
    if decided.get("status") != "selected":
        stop("14. Recruiter changes status to Selected", f"interview={decided.get('status')}")
    if decided.get("application_status") != "selected":
        stop(
            "14. Application sync to Selected",
            f"application_status={decided.get('application_status')} | "
            "interview_service._sync_application_status",
        )
    ok("14. Interview -> Selected + application_status=selected")

    # Candidate dashboard reflects Selected
    r = client.get("/applications/me", headers=cand_h, params={"page_size": 20})
    if r.status_code != 200:
        stop(
            "15. Candidate dashboard reflects Selected",
            f"{r.status_code} {r.text[:300]} | applications/me endpoint",
        )
    mine = r.json().get("items") or []
    mine_app = next((a for a in mine if a.get("id") == app_id), None)
    if not mine_app:
        stop(
            "15. Candidate dashboard reflects Selected",
            f"application {app_id} not in candidate list | application_service.list_for_candidate",
        )
    if mine_app.get("status") != "selected":
        stop(
            "15. Candidate dashboard reflects Selected",
            f"got {mine_app.get('status')} expected selected | application status persistence",
        )
    ok("15. Candidate dashboard reflects Selected")

    # Candidate interviews also show decision
    r = client.get("/interviews/me", headers=cand_h, params={"page_size": 20})
    if r.status_code != 200:
        stop(
            "15b. Candidate interviews",
            f"{r.status_code} {r.text[:300]} | interviews/me",
        )
    my_iv = next(
        (i for i in (r.json().get("items") or []) if i.get("id") == iv_id), None
    )
    if not my_iv or my_iv.get("status") != "selected":
        stop(
            "15b. Candidate interviews reflect Selected",
            f"got {None if not my_iv else my_iv.get('status')}",
        )
    ok("15b. Candidate interviews reflect Selected")

    # Admin dashboard reflects Selected
    r = client.get(f"/applications/{app_id}", headers=admin_h)
    if r.status_code != 200 or r.json().get("status") != "selected":
        stop(
            "16. Admin dashboard reflects Selected",
            f"{r.status_code} {r.text[:200] if r.status_code!=200 else r.json().get('status')}",
        )
    ok("16. Admin get application reflects Selected")

    r = client.get("/applications", headers=admin_h, params={"page_size": 50})
    admin_items = r.json().get("items") if r.status_code == 200 else []
    admin_app = next((a for a in admin_items or [] if a.get("id") == app_id), None)
    if not admin_app or admin_app.get("status") != "selected":
        stop(
            "16b. Admin applications list reflects Selected",
            f"got {None if not admin_app else admin_app.get('status')}",
        )
    ok("16b. Admin applications list reflects Selected")

    print("=== QA workflow COMPLETE ===")
    print(f"Passed steps: {len(passes)}")
    for p in passes:
        print(f"  - {p}")
    print(f"Candidate: {cand_email}")
    print(f"Application: {app_id}")
    print(f"Interview: {iv_id}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit as exc:
        if failed_at:
            print("\n=== STOPPED ===")
            print(f"Failed step: {failed_at}")
            print(f"Detail: {failed_detail}")
            print(f"Passed before failure ({len(passes)}):")
            for p in passes:
                print(f"  - {p}")
        raise SystemExit(exc.code)

