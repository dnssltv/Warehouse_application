import os
import shutil
import uuid
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.models.request import Request
from app.models.user import User
from app.models.work_type import WorkType
from app.schemas.request import (
    RequestActionByUser,
    RequestAdminEdit,
    RequestAttachmentDelete,
    RequestAssign,
    RequestPause,
    RequestCreate,
    RequestManagerComment,
    RequestRate,
    RequestRead,
)
from app.services.request_service import RequestService

router = APIRouter(prefix="/requests", tags=["requests"])


def _remove_local_upload(path: str) -> None:
    normalized = os.path.normpath(path)
    if not normalized.startswith("uploads" + os.sep) and normalized != "uploads":
        return
    if os.path.exists(normalized):
        os.remove(normalized)


@router.get("", response_model=list[RequestRead])
def list_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in {"admin", "warehouse_manager"}:
        return db.query(Request).order_by(Request.created_at.desc()).all()

    if current_user.role == "warehouse_operator":
        return (
            db.query(Request)
            .filter(
                (Request.assignee_id == current_user.id)
                | (Request.assignee_ids.contains([str(current_user.id)]))
            )
            .order_by(Request.created_at.desc())
            .all()
        )

    if current_user.role == "requester":
        return (
            db.query(Request)
            .filter(Request.requester_id == current_user.id)
            .order_by(Request.created_at.desc())
            .all()
        )

    return []


@router.post("", response_model=RequestRead)
def create_request(
    payload: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("requester")),
):
    work_type = db.query(WorkType).filter(WorkType.name == "Сборка устройств / аксессуаров").first()

    if not work_type:
        work_type = WorkType(
            name="Сборка устройств / аксессуаров",
            norm_per_item_min=1,
            reward_per_order=0,
            description="Фиксированный тип работы по сборке устройств и аксессуаров",
            is_active=True,
        )
        db.add(work_type)
        db.commit()
        db.refresh(work_type)

    deadline_seconds, deadline_at = RequestService.calculate_deadline(payload.item_qty)

    request = None
    for _ in range(3):
        request = Request(
            request_number=RequestService.generate_request_number(db),
            requester_id=current_user.id,
            requester_name=current_user.full_name,
            requester_department="—",
            work_type_id=work_type.id,
            item_qty=payload.item_qty,
            movement_number=payload.movement_number,
            comment=payload.comment,
            attachments=[],
            priority=payload.priority,
            status="new",
            deadline_seconds=deadline_seconds,
            deadline_at=deadline_at,
        )
        db.add(request)
        try:
            db.commit()
            db.refresh(request)
            return request
        except IntegrityError:
            db.rollback()

    raise HTTPException(status_code=409, detail="Failed to generate unique request number. Please retry.")


@router.post("/{request_id}/attachments", response_model=RequestRead)
def upload_attachment(
    request_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("requester", "admin")),
):
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user.role != "admin" and request.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can upload files only to your own request")

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1]
    safe_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, safe_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    attachments = request.attachments or []
    attachments.append(file_path)
    request.attachments = attachments

    db.commit()
    db.refresh(request)
    return request


@router.delete("/{request_id}/attachments", response_model=RequestRead)
def delete_attachment(
    request_id: UUID,
    payload: RequestAttachmentDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("requester", "admin")),
):
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user.role != "admin" and request.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can delete files only from your own request")

    attachments = request.attachments or []
    if payload.file_path not in attachments:
        raise HTTPException(status_code=404, detail="Attachment not found in request")

    attachments.remove(payload.file_path)
    request.attachments = attachments

    _remove_local_upload(payload.file_path)

    db.commit()
    db.refresh(request)
    return request


@router.patch("/{request_id}/admin-edit", response_model=RequestRead)
def admin_edit_request(
    request_id: UUID,
    payload: RequestAdminEdit,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    updatable_fields = (
        "item_qty",
        "movement_number",
        "comment",
        "priority",
        "status",
        "deadline_seconds",
        "deadline_at",
        "manager_comment",
        "quality_rating",
        "quality_comment",
        "quality_rated_at",
    )
    for field in updatable_fields:
        if field in payload.model_fields_set:
            setattr(request, field, getattr(payload, field))

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/assign", response_model=RequestRead)
def assign_request(
    request_id: UUID,
    payload: RequestAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_manager")),
):
    if payload.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can assign only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    manager = db.query(User).filter(User.id == payload.manager_id).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    if manager.role != "warehouse_manager":
        raise HTTPException(status_code=400, detail="Selected manager is not warehouse_manager")

    if not payload.assignee_ids:
        raise HTTPException(status_code=400, detail="At least one assignee is required")

    assignees = db.query(User).filter(User.id.in_(payload.assignee_ids)).all()
    if len(assignees) != len(payload.assignee_ids):
        raise HTTPException(status_code=400, detail="Some assignees were not found")

    for assignee in assignees:
        if assignee.role != "warehouse_operator":
            raise HTTPException(status_code=400, detail="All assignees must be warehouse_operator")

    if request.status not in {"new", "returned_to_work"}:
        raise HTTPException(status_code=400, detail="Request cannot be assigned in current status")

    request.manager_id = payload.manager_id
    request.assignee_id = payload.assignee_ids[0]
    request.assignee_ids = [str(x) for x in payload.assignee_ids]
    request.status = "assigned"

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/start", response_model=RequestRead)
def start_request(
    request_id: UUID,
    payload: RequestActionByUser,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_operator")),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can start only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Only assigned warehouse operator can start this request")

    if request.status not in {"assigned", "returned_to_work"}:
        raise HTTPException(status_code=400, detail="Request cannot be started in current status")

    request.status = "in_progress"
    request.started_at = datetime.utcnow()

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/finish", response_model=RequestRead)
def finish_request(
    request_id: UUID,
    payload: RequestActionByUser,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_operator")),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can finish only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Only assigned warehouse operator can finish this request")

    if request.status != "in_progress":
        raise HTTPException(status_code=400, detail="Request is not in progress")

    if not request.started_at:
        raise HTTPException(status_code=400, detail="Request has no started_at value")

    request.finished_at = datetime.utcnow()
    request.duration_seconds = RequestService.calculate_duration_seconds(request.started_at, request.finished_at)
    request.status = "assembled"

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/pause", response_model=RequestRead)
def pause_request(
    request_id: UUID,
    payload: RequestPause,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_operator")),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can pause only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Only assigned warehouse operator can pause this request")

    if request.status != "in_progress":
        raise HTTPException(status_code=400, detail="Only request in progress can be paused")

    request.status = "paused"
    if payload.pause_comment:
        request.manager_comment = f"Пауза: {payload.pause_comment}"

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/resume", response_model=RequestRead)
def resume_request(
    request_id: UUID,
    payload: RequestActionByUser,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_operator")),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can resume only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Only assigned warehouse operator can resume this request")

    if request.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused request can be resumed")

    request.status = "in_progress"

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/approve", response_model=RequestRead)
def approve_request(
    request_id: UUID,
    payload: RequestManagerComment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_manager")),
):
    if payload.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can approve only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.manager_id != payload.manager_id:
        raise HTTPException(status_code=400, detail="Only assigned warehouse manager can approve this request")

    if request.status != "assembled":
        raise HTTPException(status_code=400, detail="Only assembled request can be approved")

    request.status = "approved"
    request.manager_comment = payload.manager_comment

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/return-to-work", response_model=RequestRead)
def return_to_work(
    request_id: UUID,
    payload: RequestManagerComment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("warehouse_manager")),
):
    if payload.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can return only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.manager_id != payload.manager_id:
        raise HTTPException(status_code=400, detail="Only assigned warehouse manager can return this request")

    if request.status != "assembled":
        raise HTTPException(status_code=400, detail="Only assembled request can be returned to work")

    request.status = "returned_to_work"
    request.manager_comment = payload.manager_comment
    request.finished_at = None
    request.duration_seconds = None

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/rate", response_model=RequestRead)
def rate_request(
    request_id: UUID,
    payload: RequestRate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("requester")),
):
    if payload.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can rate only as yourself")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.requester_id != payload.requester_id:
        raise HTTPException(status_code=400, detail="Only requester can rate this request")

    if request.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved request can be rated")

    request.quality_rating = payload.quality_rating
    request.quality_comment = payload.quality_comment
    request.quality_rated_at = datetime.utcnow()
    request.status = "rated"

    db.commit()
    db.refresh(request)
    return request
