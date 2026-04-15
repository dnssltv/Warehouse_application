import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.router import api_router
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.request import Request
from app.models.user import User
from app.models.work_type import WorkType

app = FastAPI(title="Warehouse App API")

_cors_params: dict = {
    "allow_origins": settings.CORS_ORIGINS,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.cors_lan_regex:
    _cors_params["allow_origin_regex"] = settings.cors_lan_regex

app.add_middleware(CORSMiddleware, **_cors_params)

app.include_router(api_router)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


def ensure_schema() -> None:
    """Лёгкие миграции без Alembic: добавление колонок к существующей БД."""
    statements = [
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS fulfillment_site VARCHAR(40) NOT NULL DEFAULT 'warehouse';",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS pause_comment TEXT;",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS active_duration_seconds INTEGER;",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS total_pause_seconds INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMP;",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS feedback_liked_points JSON;",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS feedback_issue_points JSON;",
        "ALTER TABLE requests ADD COLUMN IF NOT EXISTS feedback_free_text TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def seed_admin():
    db: Session = SessionLocal()
    try:
        admin_email = settings.ADMIN_EMAIL
        existing_admin = db.query(User).filter(User.email == admin_email).first()

        if existing_admin and settings.SYNC_ADMIN_ON_STARTUP:
            existing_admin.password_hash = get_password_hash(settings.ADMIN_PASSWORD)
            existing_admin.first_name = settings.ADMIN_FIRST_NAME
            existing_admin.last_name = settings.ADMIN_LAST_NAME
            existing_admin.full_name = f"{settings.ADMIN_LAST_NAME} {settings.ADMIN_FIRST_NAME}"
            existing_admin.role = "admin"
            existing_admin.is_active = True
            db.commit()
            return

        if existing_admin:
            return

        user = User(
            first_name=settings.ADMIN_FIRST_NAME,
            last_name=settings.ADMIN_LAST_NAME,
            full_name=f"{settings.ADMIN_LAST_NAME} {settings.ADMIN_FIRST_NAME}",
            email=admin_email,
            password_hash=get_password_hash(settings.ADMIN_PASSWORD),
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Admin account created: {admin_email}")
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    max_retries = 10
    delay_seconds = 3

    for attempt in range(max_retries):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            Base.metadata.create_all(bind=engine)
            ensure_schema()
            seed_admin()
            print("Database is ready. Tables created.")
            return
        except Exception as e:
            print(f"Database is not ready yet (attempt {attempt + 1}/{max_retries}): {e}")
            time.sleep(delay_seconds)

    raise RuntimeError("Could not connect to database after multiple attempts.")


@app.get("/")
def root():
    return {"status": "ok", "service": "warehouse-app"}
