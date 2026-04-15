from datetime import datetime
from uuid import UUID
import re

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


LATIN_NAME_PATTERN = re.compile(r"^[A-Za-z]+$")

ALL_ROLES = {
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


class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_latin_only(cls, value: str) -> str:
        if not LATIN_NAME_PATTERN.fullmatch(value):
            raise ValueError("Допустимы только латинские буквы")
        return value


class AdminCreateUser(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_latin_only(cls, value: str) -> str:
        if not LATIN_NAME_PATTERN.fullmatch(value):
            raise ValueError("Допустимы только латинские буквы")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in ALL_ROLES:
            raise ValueError("Некорректная роль")
        return value


class UserUpdate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str
    is_active: bool

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_latin_only(cls, value: str) -> str:
        if not LATIN_NAME_PATTERN.fullmatch(value):
            raise ValueError("Допустимы только латинские буквы")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in ALL_ROLES:
            raise ValueError("Некорректная роль")
        return value


class UserPasswordUpdate(BaseModel):
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    full_name: str
    email: EmailStr
    avatar_url: str | None = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserRoleUpdate(BaseModel):
    role: str