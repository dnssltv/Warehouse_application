from starlette.testclient import TestClient

from app.core.config import settings

from .helpers import auth_headers, login


def test_login_wrong_password(client: TestClient) -> None:
    r = client.post(
        "/api/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": "wrong-password-xyz"},
    )
    assert r.status_code == 401
    detail = r.json().get("detail", "")
    text = detail.lower() if isinstance(detail, str) else ""
    assert "парол" in text or "email" in text


def test_login_success_admin(client: TestClient) -> None:
    token = login(client, settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
    assert isinstance(token, str) and len(token) > 20


def test_me_requires_auth(client: TestClient) -> None:
    r = client.get("/api/auth/me")
    assert r.status_code == 403


def test_me_with_token(client: TestClient, admin_token: str) -> None:
    r = client.get("/api/auth/me", headers=auth_headers(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == settings.ADMIN_EMAIL
    assert body["role"] == "admin"
