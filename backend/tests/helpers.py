from __future__ import annotations

from starlette.testclient import TestClient


def create_user(
    client: TestClient,
    admin_headers: dict[str, str],
    *,
    email: str,
    password: str,
    role: str,
    first_name: str = "Test",
    last_name: str = "User",
) -> dict:
    r = client.post(
        "/api/users/admin-create",
        headers=admin_headers,
        json={
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password": password,
            "role": role,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def login(client: TestClient, email: str, password: str) -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
