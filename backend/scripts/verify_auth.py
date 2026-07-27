"""Quick end-to-end auth verification script."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def main() -> None:
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "candidate@example.com",
            "password": "Password123!",
            "full_name": "Test Candidate",
            "role": "candidate",
        },
    )
    print("REGISTER", r.status_code)
    assert r.status_code == 201, r.text
    tokens = r.json()["tokens"]
    access = tokens["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    print("ME", r.status_code, r.json()["role"])
    assert r.status_code == 200

    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "recruiter@example.com",
            "password": "Password123!",
            "full_name": "Test Recruiter",
            "role": "recruiter",
        },
    )
    print("REGISTER RECRUITER", r.status_code)
    assert r.status_code == 201

    r = client.post(
        "/api/v1/auth/login",
        json={"email": "recruiter@example.com", "password": "Password123!"},
    )
    print("LOGIN", r.status_code, r.json()["user"]["role"])
    assert r.status_code == 200
    login_refresh = r.json()["tokens"]["refresh_token"]

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": login_refresh})
    print("REFRESH", r.status_code)
    assert r.status_code == 200
    new_refresh = r.json()["refresh_token"]

    r = client.post("/api/v1/auth/logout", json={"refresh_token": new_refresh})
    print("LOGOUT", r.status_code, r.json())
    assert r.status_code == 200

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    print("REFRESH AFTER LOGOUT", r.status_code)
    assert r.status_code == 401

    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@example.com",
            "password": "Password123!",
            "full_name": "Test Admin",
            "role": "admin",
        },
    )
    print("REGISTER ADMIN", r.status_code, r.json()["user"]["role"] if r.status_code == 201 else r.json())
    assert r.status_code == 201

    print("ALL AUTH CHECKS PASSED")


if __name__ == "__main__":
    main()
