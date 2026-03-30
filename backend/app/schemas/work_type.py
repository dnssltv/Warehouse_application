from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkTypeCreate(BaseModel):
    name: str
    norm_per_item_min: Decimal
    reward_per_order: Decimal | None = None
    description: str | None = None


class WorkTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    norm_per_item_min: Decimal
    reward_per_order: Decimal | None = None
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime