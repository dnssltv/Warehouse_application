import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Request(Base):
    __tablename__ = "requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    requester_name: Mapped[str] = mapped_column(String(255), nullable=False)
    requester_department: Mapped[str] = mapped_column(String(255), nullable=False)

    work_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("work_types.id"), nullable=False)

    item_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    movement_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)

    # warehouse — сборка на складе; stock_in_agc — Stock in AGC (грейдинг)
    fulfillment_site: Mapped[str] = mapped_column(String(40), default="warehouse", nullable=False)

    status: Mapped[str] = mapped_column(String(30), default="new", nullable=False)

    manager_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assignee_ids: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    deadline_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    deadline_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_pause_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pause_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    manager_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Комментарий кладовщика при паузе (отдельно от комментария руководителя)
    pause_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    quality_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_liked_points: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    feedback_issue_points: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    feedback_free_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_rated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)