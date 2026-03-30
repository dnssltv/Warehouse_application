from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.dependencies import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
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
        raise HTTPException(status_code=400, detail="Email already exists")

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
    _: User = Depends(require_roles("admin")),
):
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

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
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/auth/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "warehouse_manager")),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    allowed_roles = {"pending", "admin", "requester", "warehouse_manager", "warehouse_operator"}
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_email = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

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
    _: User = Depends(require_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(payload.password)

    db.commit()
    return {"status": "ok", "message": "Password updated successfully"}