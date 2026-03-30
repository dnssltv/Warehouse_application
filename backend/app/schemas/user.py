from datetime import datetime
from uuid import UUID
import re

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


LATIN_NAME_PATTERN = re.compile(r"^[A-Za-z]+$")


class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_latin_only(cls, value: str) -> str:
        if not LATIN_NAME_PATTERN.fullmatch(value):
            raise ValueError("Only latin letters are allowed")
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
            raise ValueError("Only latin letters are allowed")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        allowed_roles = {"requester", "warehouse_manager", "warehouse_operator", "admin", "pending"}
        if value not in allowed_roles:
            raise ValueError("Invalid role")
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
            raise ValueError("Only latin letters are allowed")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        allowed_roles = {"requester", "warehouse_manager", "warehouse_operator", "admin", "pending"}
        if value not in allowed_roles:
            raise ValueError("Invalid role")
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
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserRoleUpdate(BaseModel):
    role: str