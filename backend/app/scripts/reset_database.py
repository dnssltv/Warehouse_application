import shutil
from pathlib import Path

from app.db.base import Base
from app.db.session import engine


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def clear_uploads() -> None:
    uploads_dir = Path("uploads")
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    reset_database()
    clear_uploads()
    print("Database and uploads are reset.")
