import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.dependencies import ADMIN_EQUIVALENT_ROLES, get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.schemas.user import (
    AdminCreateUser,
    UserPasswordUpdate,
    UserRead,
    UserRegister,
    UserRoleUpdate,
    UserUpdate,
)

router = APIRouter(tags=["users"])


@router.post("/auth/register", response_model=UserRead)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    full_name = f"{payload.last_name} {payload.first_name}"

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        full_name=full_name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="pending",
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/admin-create", response_model=UserRead)
def admin_create_user(
    payload: AdminCreateUser,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_EQUIVALENT_ROLES)),
):
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    full_name = f"{payload.last_name} {payload.first_name}"

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        full_name=full_name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    try:
        valid_password = verify_password(payload.password, user.password_hash)
    except Exception:
        # Для старых/битых хэшей не падаем 500, а возвращаем обычную ошибку авторизации.
        valid_password = False
    if not valid_password:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Пользователь отключен")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/auth/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/avatar", response_model=UserRead)
def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload_dir = os.path.join("uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Разрешены только изображения jpg/jpeg/png/webp")

    safe_name = f"{uuid.uuid4()}{ext}"
    local_path = os.path.join(upload_dir, safe_name)
    with open(local_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Храним относительный путь, чтобы фронт мог открыть через /uploads
    current_user.avatar_url = f"uploads/avatars/{safe_name}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/auth/change-password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.new_password.strip():
        raise HTTPException(status_code=400, detail="Новый пароль не может быть пустым")

    try:
        is_current_valid = verify_password(payload.current_password, current_user.password_hash)
    except Exception:
        is_current_valid = False
    if not is_current_valid:
        raise HTTPException(status_code=400, detail="Текущий пароль указан неверно")

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"status": "ok", "message": "Пароль успешно обновлен"}


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles(*ADMIN_EQUIVALENT_ROLES, "warehouse_manager", "grading_manager")
    ),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_EQUIVALENT_ROLES)),
):
    allowed_roles = {
        "pending",
        "admin",
        "general_director",
        "commercial_director",
        "requester",
        "warehouse_manager",
        "warehouse_operator",
        "grading_manager",
        "warehouse_operator_agc",
    }
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Некорректная роль")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_EQUIVALENT_ROLES)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    existing_email = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.full_name = f"{payload.last_name} {payload.first_name}"
    user.email = payload.email
    user.role = payload.role
    user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/password")
def update_user_password(
    user_id: str,
    payload: UserPasswordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_EQUIVALENT_ROLES)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.password_hash = get_password_hash(payload.password)

    db.commit()
    return {"status": "ok", "message": "Пароль успешно обновлен"}
