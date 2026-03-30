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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


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
