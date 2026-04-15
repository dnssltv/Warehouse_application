import os
import shutil
import uuid
from collections import Counter
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import ADMIN_EQUIVALENT_ROLES, get_current_user, get_db, require_roles
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
    FeedbackAnalyticsRead,
    FeedbackPointStatRead,
)
from app.services.request_service import RequestService

router = APIRouter(prefix="/requests", tags=["requests"])

# Площадка выполнения заявки
FULFILLMENT_WAREHOUSE = "warehouse"
FULFILLMENT_STOCK_IN_AGC = "stock_in_agc"


def _normalize_feedback_points(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    for value in values:
        if not value:
            continue
        clean = value.strip()
        if not clean:
            continue
        if clean not in normalized:
            normalized.append(clean)
    return normalized


def _consume_pause_seconds(request: Request, now_utc: datetime) -> int:
    if not request.pause_started_at:
        return 0
    pause_seconds = RequestService.calculate_duration_seconds(request.pause_started_at, now_utc)
    request.total_pause_seconds = int(request.total_pause_seconds or 0) + pause_seconds
    request.pause_started_at = None
    return pause_seconds


def _require_operator_for_request(current_user: User, request: Request) -> None:
    if current_user.role not in ("warehouse_operator", "warehouse_operator_agc"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для выполнения операции")
    if request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC:
        if current_user.role != "warehouse_operator_agc":
            raise HTTPException(
                status_code=400,
                detail="Эта заявка выполняется на грейдинге (Stock in AGC). Войдите под учётной записью кладовщика Stock in AGC.",
            )
    elif current_user.role != "warehouse_operator":
        raise HTTPException(
            status_code=400,
            detail="Эта заявка выполняется на складе. Войдите под учётной записью кладовщика склада.",
        )


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
    q = db.query(Request)

    if current_user.role in ADMIN_EQUIVALENT_ROLES:
        return q.order_by(Request.created_at.desc()).all()

    if current_user.role == "warehouse_manager":
        return (
            q.filter(Request.fulfillment_site == FULFILLMENT_WAREHOUSE)
            .order_by(Request.created_at.desc())
            .all()
        )

    if current_user.role == "grading_manager":
        return (
            q.filter(Request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC)
            .order_by(Request.created_at.desc())
            .all()
        )

    if current_user.role == "warehouse_operator":
        candidates = (
            q.filter(Request.fulfillment_site == FULFILLMENT_WAREHOUSE)
            .order_by(Request.created_at.desc())
            .all()
        )
        me_id = str(current_user.id)
        return [
            r
            for r in candidates
            if r.assignee_id == current_user.id
            or (isinstance(r.assignee_ids, list) and me_id in [str(x) for x in r.assignee_ids])
        ]

    if current_user.role == "warehouse_operator_agc":
        candidates = (
            q.filter(Request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC)
            .order_by(Request.created_at.desc())
            .all()
        )
        me_id = str(current_user.id)
        return [
            r
            for r in candidates
            if r.assignee_id == current_user.id
            or (isinstance(r.assignee_ids, list) and me_id in [str(x) for x in r.assignee_ids])
        ]

    if current_user.role == "requester":
        return (
            q.filter(Request.requester_id == current_user.id)
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
            fulfillment_site=payload.fulfillment_site,
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

    raise HTTPException(status_code=409, detail="Не удалось сгенерировать уникальный номер заявки. Повторите попытку.")


@router.post("/{request_id}/attachments", response_model=RequestRead)
def upload_attachment(
    request_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("requester", "admin")),
):
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if current_user.role != "admin" and request.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете загружать файлы только в свои заявки")

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
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if current_user.role != "admin" and request.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете удалять файлы только из своих заявок")

    attachments = request.attachments or []
    if payload.file_path not in attachments:
        raise HTTPException(status_code=404, detail="Файл не найден в заявке")

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
    _: User = Depends(require_roles(*ADMIN_EQUIVALENT_ROLES)),
):
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    updatable_fields = (
        "item_qty",
        "movement_number",
        "comment",
        "priority",
        "fulfillment_site",
        "status",
        "deadline_seconds",
        "deadline_at",
        "manager_comment",
        "pause_comment",
        "quality_rating",
        "quality_comment",
        "feedback_liked_points",
        "feedback_issue_points",
        "feedback_free_text",
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
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("warehouse_manager", "grading_manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для назначения заявок")

    if payload.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Назначение можно выполнять только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if request.fulfillment_site == FULFILLMENT_WAREHOUSE and current_user.role != "warehouse_manager":
        raise HTTPException(
            status_code=403,
            detail="Складские заявки может назначать только заведующий складом",
        )
    if request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC and current_user.role != "grading_manager":
        raise HTTPException(
            status_code=403,
            detail="Заявки Stock in AGC может назначать только руководитель грейдинга",
        )

    if not payload.assignee_ids:
        raise HTTPException(status_code=400, detail="Нужно выбрать хотя бы одного кладовщика")

    assignees = db.query(User).filter(User.id.in_(payload.assignee_ids)).all()
    if len(assignees) != len(payload.assignee_ids):
        raise HTTPException(status_code=400, detail="Некоторые кладовщики не найдены")

    expected_assignee_role = (
        "warehouse_operator_agc"
        if request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC
        else "warehouse_operator"
    )
    for assignee in assignees:
        if assignee.role != expected_assignee_role:
            raise HTTPException(
                status_code=400,
                detail="Для этой заявки можно назначить только кладовщиков соответствующей площадки",
            )

    if request.status not in {"new", "returned_to_work"}:
        raise HTTPException(status_code=400, detail="Заявку нельзя назначить в текущем статусе")

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
    current_user: User = Depends(get_current_user),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Начать работу можно только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    _require_operator_for_request(current_user, request)

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Только назначенный кладовщик может начать эту заявку")

    if request.status not in {"assigned", "returned_to_work"}:
        raise HTTPException(status_code=400, detail="Заявку нельзя начать в текущем статусе")

    request.status = "in_progress"
    request.started_at = datetime.utcnow()
    request.total_pause_seconds = 0
    request.pause_started_at = None
    request.active_duration_seconds = None

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/finish", response_model=RequestRead)
def finish_request(
    request_id: UUID,
    payload: RequestActionByUser,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Завершить работу можно только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    _require_operator_for_request(current_user, request)

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Только назначенный кладовщик может завершить эту заявку")

    if request.status != "in_progress":
        raise HTTPException(status_code=400, detail="Заявка не находится в работе")

    if not request.started_at:
        raise HTTPException(status_code=400, detail="У заявки отсутствует время начала")

    request.finished_at = datetime.utcnow()
    _consume_pause_seconds(request, request.finished_at)
    request.duration_seconds = RequestService.calculate_duration_seconds(request.started_at, request.finished_at)
    request.active_duration_seconds = max(0, int(request.duration_seconds or 0) - int(request.total_pause_seconds or 0))
    request.status = "assembled"

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/pause", response_model=RequestRead)
def pause_request(
    request_id: UUID,
    payload: RequestPause,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Поставить на паузу можно только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    _require_operator_for_request(current_user, request)

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Только назначенный кладовщик может поставить заявку на паузу")

    if request.status != "in_progress":
        raise HTTPException(status_code=400, detail="На паузу можно поставить только заявку в работе")

    request.pause_started_at = datetime.utcnow()
    request.status = "paused"
    if payload.pause_comment and payload.pause_comment.strip():
        note = payload.pause_comment.strip()
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        line = f"[{ts}] {note}"
        prev = (request.pause_comment or "").strip()
        request.pause_comment = f"{prev}\n{line}".strip() if prev else line

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/resume", response_model=RequestRead)
def resume_request(
    request_id: UUID,
    payload: RequestActionByUser,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Возобновить работу можно только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    _require_operator_for_request(current_user, request)

    assigned_ids = request.assignee_ids or ([] if not request.assignee_id else [str(request.assignee_id)])
    if str(payload.user_id) not in assigned_ids:
        raise HTTPException(status_code=400, detail="Только назначенный кладовщик может возобновить эту заявку")

    if request.status != "paused":
        raise HTTPException(status_code=400, detail="Возобновить можно только заявку на паузе")

    _consume_pause_seconds(request, datetime.utcnow())
    request.status = "in_progress"

    db.commit()
    db.refresh(request)
    return request


@router.post("/{request_id}/approve", response_model=RequestRead)
def approve_request(
    request_id: UUID,
    payload: RequestManagerComment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("warehouse_manager", "grading_manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для подтверждения заявки")

    if payload.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Подтверждение можно выполнять только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if request.fulfillment_site == FULFILLMENT_WAREHOUSE and current_user.role != "warehouse_manager":
        raise HTTPException(status_code=403, detail="Складские заявки подтверждает только заведующий складом")
    if request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC and current_user.role != "grading_manager":
        raise HTTPException(status_code=403, detail="Заявки Stock in AGC подтверждает только руководитель грейдинга")

    if request.manager_id != payload.manager_id:
        raise HTTPException(status_code=400, detail="Подтвердить заявку может только назначенный заведующий")

    if request.status != "assembled":
        raise HTTPException(status_code=400, detail="Подтвердить можно только собранную заявку")

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
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("warehouse_manager", "grading_manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для возврата заявки в работу")

    if payload.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Возврат в работу можно выполнять только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if request.fulfillment_site == FULFILLMENT_WAREHOUSE and current_user.role != "warehouse_manager":
        raise HTTPException(status_code=403, detail="Складские заявки возвращает только заведующий складом")
    if request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC and current_user.role != "grading_manager":
        raise HTTPException(status_code=403, detail="Заявки Stock in AGC возвращает только руководитель грейдинга")

    if request.manager_id != payload.manager_id:
        raise HTTPException(status_code=400, detail="Вернуть заявку может только назначенный заведующий")

    if request.status != "assembled":
        raise HTTPException(status_code=400, detail="В работу можно вернуть только собранную заявку")

    request.status = "returned_to_work"
    request.manager_comment = payload.manager_comment
    request.finished_at = None
    request.duration_seconds = None
    request.active_duration_seconds = None
    request.total_pause_seconds = 0
    request.pause_started_at = None

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
        raise HTTPException(status_code=403, detail="Оценить заявку можно только от своего имени")

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if request.requester_id != payload.requester_id:
        raise HTTPException(status_code=400, detail="Оценить заявку может только ее заказчик")

    if request.status != "approved":
        raise HTTPException(status_code=400, detail="Оценить можно только подтвержденную заявку")

    request.quality_rating = payload.quality_rating
    request.quality_comment = payload.quality_comment
    request.feedback_liked_points = _normalize_feedback_points(payload.feedback_liked_points)
    request.feedback_issue_points = _normalize_feedback_points(payload.feedback_issue_points)
    request.feedback_free_text = payload.feedback_free_text.strip() if payload.feedback_free_text else None
    request.quality_rated_at = datetime.utcnow()
    request.status = "rated"

    db.commit()
    db.refresh(request)
    return request


@router.delete("/{request_id}", response_model=dict)
def delete_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_EQUIVALENT_ROLES)),
):
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    for file_path in (request.attachments or []):
        _remove_local_upload(file_path)

    db.delete(request)
    db.commit()
    return {"status": "ok", "message": "Заявка удалена"}


@router.get("/feedback-analytics", response_model=FeedbackAnalyticsRead)
def feedback_analytics(
    period_days: int | None = Query(default=None, ge=1, le=3650),
    site: Literal["all", "warehouse", "stock_in_agc"] = Query(default="all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Request).filter(Request.quality_rating.is_not(None))

    if current_user.role in ADMIN_EQUIVALENT_ROLES:
        if site != "all":
            q = q.filter(Request.fulfillment_site == site)
    elif current_user.role == "warehouse_manager":
        q = q.filter(Request.fulfillment_site == FULFILLMENT_WAREHOUSE)
    elif current_user.role == "grading_manager":
        q = q.filter(Request.fulfillment_site == FULFILLMENT_STOCK_IN_AGC)
    else:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра аналитики")

    if period_days is not None:
        threshold = datetime.utcnow().timestamp() - (period_days * 24 * 60 * 60)
        candidates = q.all()
        rated_requests = []
        for r in candidates:
            rated_at = r.quality_rated_at or r.updated_at or r.created_at
            if rated_at and rated_at.timestamp() >= threshold:
                rated_requests.append(r)
    else:
        rated_requests = q.all()

    total_rated = len(rated_requests)
    average_rating = (
        round(sum(int(r.quality_rating or 0) for r in rated_requests) / total_rated, 2)
        if total_rated > 0
        else None
    )

    distribution = {str(i): 0 for i in range(1, 6)}
    liked_counter: Counter[str] = Counter()
    issue_counter: Counter[str] = Counter()

    for request in rated_requests:
        rating_key = str(int(request.quality_rating or 0))
        if rating_key in distribution:
            distribution[rating_key] += 1

        for point in _normalize_feedback_points(request.feedback_liked_points):
            liked_counter[point] += 1
        for point in _normalize_feedback_points(request.feedback_issue_points):
            issue_counter[point] += 1

    top_liked = [
        FeedbackPointStatRead(point=point, count=count)
        for point, count in liked_counter.most_common(5)
    ]
    top_issue = [
        FeedbackPointStatRead(point=point, count=count)
        for point, count in issue_counter.most_common(5)
    ]

    return FeedbackAnalyticsRead(
        total_rated=total_rated,
        average_rating=average_rating,
        rating_distribution=distribution,
        top_liked_points=top_liked,
        top_issue_points=top_issue,
    )
