"""
Интеграционные тесты API. Нужен PostgreSQL и отдельная база (по умолчанию warehouse_test).

Создание базы (один раз), при контейнере Docker с пользователем warehouse_user, например:

  docker exec -it warehouse_db psql -U warehouse_user -d postgres -c "CREATE DATABASE warehouse_test OWNER warehouse_user;"

Переменные окружения можно переопределить: POSTGRES_HOST, POSTGRES_DB, и т.д.
"""

from __future__ import annotations

import os


def _bootstrap_env() -> None:
    defaults: dict[str, str] = {
        "POSTGRES_HOST": "127.0.0.1",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "warehouse_user",
        "POSTGRES_PASSWORD": "warehouse_pass",
        "SECRET_KEY": "pytest-secret-key-at-least-32-chars-long!!",
        "ADMIN_EMAIL": "pytest-admin@example.com",
        "ADMIN_PASSWORD": "PytestAdminPass123!",
        "ADMIN_FIRST_NAME": "Admin",
        "ADMIN_LAST_NAME": "Pytest",
        "SYNC_ADMIN_ON_STARTUP": "false",
        "CORS_ALLOW_LAN": "false",
    }
    for key, value in defaults.items():
        os.environ.setdefault(key, value)
    # Не используем POSTGRES_DB из docker-compose (warehouse_db): только тестовая база.
    os.environ["POSTGRES_DB"] = os.environ.get("WAREHOUSE_PYTEST_DB", "warehouse_test")


_bootstrap_env()

import pytest
from sqlalchemy import text
from starlette.testclient import TestClient


@pytest.fixture(scope="session")
def client() -> TestClient:
    from app.db.session import engine
    from app.main import app

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — показать причину skip
        pytest.skip(
            "PostgreSQL недоступен или база не создана: "
            f"{exc!s}. См. docstring в tests/conftest.py"
        )

    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(autouse=True)
def _clean_db_before_each_test(client: TestClient) -> None:
    _ = client.app  # дожидаемся lifespan и схемы перед очисткой
    from app.db.session import SessionLocal
    from app.main import seed_admin
    from app.models.request import Request
    from app.models.user import User
    from app.models.work_type import WorkType

    db = SessionLocal()
    try:
        db.query(Request).delete()
        db.query(User).delete()
        db.query(WorkType).delete()
        db.commit()
    finally:
        db.close()

    seed_admin()


@pytest.fixture
def admin_token(client: TestClient) -> str:
    from app.core.config import settings

    r = client.post(
        "/api/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
