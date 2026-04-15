from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RequestCreate(BaseModel):
    item_qty: int = Field(gt=0)
    movement_number: str | None = None
    comment: str | None = None
    priority: str = "normal"
    fulfillment_site: Literal["warehouse", "stock_in_agc"] = "warehouse"


class RequestAssign(BaseModel):
    manager_id: UUID
    assignee_ids: list[UUID]


class RequestManagerComment(BaseModel):
    manager_id: UUID
    manager_comment: str | None = None


class RequestActionByUser(BaseModel):
    user_id: UUID


class RequestPause(BaseModel):
    user_id: UUID
    pause_comment: str | None = None


class RequestRate(BaseModel):
    requester_id: UUID
    quality_rating: int = Field(ge=1, le=5)
    quality_comment: str | None = None
    feedback_liked_points: list[str] | None = None
    feedback_issue_points: list[str] | None = None
    feedback_free_text: str | None = None


class RequestAdminEdit(BaseModel):
    item_qty: int | None = Field(default=None, gt=0)
    movement_number: str | None = None
    comment: str | None = None
    priority: str | None = None
    fulfillment_site: Literal["warehouse", "stock_in_agc"] | None = None
    status: str | None = None
    deadline_seconds: int | None = Field(default=None, gt=0)
    deadline_at: datetime | None = None
    manager_comment: str | None = None
    pause_comment: str | None = None
    quality_rating: int | None = Field(default=None, ge=1, le=5)
    quality_comment: str | None = None
    feedback_liked_points: list[str] | None = None
    feedback_issue_points: list[str] | None = None
    feedback_free_text: str | None = None
    quality_rated_at: datetime | None = None


class RequestAttachmentDelete(BaseModel):
    file_path: str


class RequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    request_number: str

    requester_id: UUID
    requester_name: str
    requester_department: str

    work_type_id: UUID

    item_qty: int
    movement_number: str | None = None
    comment: str | None = None
    attachments: list[str] | None = None
    priority: str

    fulfillment_site: str = "warehouse"

    status: str

    manager_id: UUID | None = None
    assignee_id: UUID | None = None
    assignee_ids: list[str] | None = None

    deadline_seconds: int
    deadline_at: datetime

    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_seconds: int | None = None
    active_duration_seconds: int | None = None
    total_pause_seconds: int = 0
    pause_started_at: datetime | None = None

    manager_comment: str | None = None
    pause_comment: str | None = None

    quality_rating: int | None = None
    quality_comment: str | None = None
    feedback_liked_points: list[str] | None = None
    feedback_issue_points: list[str] | None = None
    feedback_free_text: str | None = None
    quality_rated_at: datetime | None = None

    created_at: datetime
    updated_at: datetime


class FeedbackPointStatRead(BaseModel):
    point: str
    count: int


class FeedbackAnalyticsRead(BaseModel):
    total_rated: int
    average_rating: float | None = None
    rating_distribution: dict[str, int]
    top_liked_points: list[FeedbackPointStatRead]
    top_issue_points: list[FeedbackPointStatRead]
