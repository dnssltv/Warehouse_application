from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.request import Request
from app.models.user import User
from app.schemas.salary import AchievementHistoryItemRead, SalaryPreviewRead

router = APIRouter(prefix="/salary", tags=["salary"])

WORKER_MINUTE_RATE_KZT = 24
PREMIUM_FIRST_ORDER_KZT = 500
PREMIUM_EVERY_10_ORDERS_KZT = 3000
PREMIUM_FAST_AVG_MAX_SECONDS = 30 * 60
PREMIUM_FAST_AVG_KZT = 5000
PREMIUM_TOP_BONUS_KZT = 8000
COMPLETED_STATUSES = {"assembled", "approved", "rated"}


def _as_iso(dt: datetime | None) -> str:
    if not dt:
        return datetime.now(timezone.utc).isoformat()
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt.tzinfo is None else dt.isoformat()


def _worker_share_seconds(req: Request, worker_id: str) -> int:
    assigned_ids = req.assignee_ids or ([] if not req.assignee_id else [str(req.assignee_id)])
    assigned_unique = [str(x) for x in assigned_ids if x]
    if worker_id not in assigned_unique:
        return 0
    worker_count = max(1, len(assigned_unique))
    effective_seconds = int(req.active_duration_seconds or req.duration_seconds or 0)
    return max(0, round(effective_seconds / worker_count))


@router.get("/preview", response_model=SalaryPreviewRead)
def salary_preview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_requests = db.query(Request).all()
    completed_requests = [r for r in all_requests if r.status in COMPLETED_STATUSES]

    my_completed = []
    for req in completed_requests:
        assigned_ids = req.assignee_ids or ([] if not req.assignee_id else [str(req.assignee_id)])
        if str(current_user.id) in assigned_ids:
            my_completed.append(req)

    durations = [
        _worker_share_seconds(r, str(current_user.id))
        for r in my_completed
        if _worker_share_seconds(r, str(current_user.id)) > 0
    ]
    total_duration_seconds = sum(durations)
    completed_orders_count = len(my_completed)
    average_seconds = round(total_duration_seconds / completed_orders_count) if completed_orders_count > 0 else None
    best_seconds = min(durations) if durations else None

    base_pay_kzt = round((total_duration_seconds / 60) * WORKER_MINUTE_RATE_KZT)
    premium_first_order_kzt = PREMIUM_FIRST_ORDER_KZT if completed_orders_count >= 1 else 0
    premium_milestone_kzt = (completed_orders_count // 10) * PREMIUM_EVERY_10_ORDERS_KZT
    premium_speed_kzt = (
        PREMIUM_FAST_AVG_KZT
        if average_seconds is not None
        and completed_orders_count >= 5
        and average_seconds <= PREMIUM_FAST_AVG_MAX_SECONDS
        else 0
    )

    by_worker: dict[str, int] = {}
    for req in completed_requests:
        worker_id = (
            req.assignee_ids[0]
            if req.assignee_ids and len(req.assignee_ids) > 0
            else (str(req.assignee_id) if req.assignee_id else "")
        )
        if not worker_id:
            continue
        by_worker[worker_id] = by_worker.get(worker_id, 0) + 1

    top_worker_id = None
    top_worker_orders = 0
    for worker_id, count in by_worker.items():
        if count > top_worker_orders:
            top_worker_orders = count
            top_worker_id = worker_id

    premium_top_worker_kzt = PREMIUM_TOP_BONUS_KZT if top_worker_id == str(current_user.id) else 0
    premium_total_kzt = (
        premium_first_order_kzt + premium_milestone_kzt + premium_speed_kzt + premium_top_worker_kzt
    )
    payout_total_kzt = base_pay_kzt + premium_total_kzt
    achievements: list[str] = []
    if completed_orders_count >= 1:
        achievements.append("🏁 Первый собранный заказ")
    if completed_orders_count >= 10:
        achievements.append("🔟 10+ собранных заказов")
    if completed_orders_count >= 50:
        achievements.append("🏆 50+ собранных заказов")
    if best_seconds is not None and best_seconds <= 15 * 60:
        achievements.append("⚡ Быстрый заказ (до 15 минут)")
    if average_seconds is not None and completed_orders_count >= 5 and average_seconds <= PREMIUM_FAST_AVG_MAX_SECONDS:
        achievements.append("🎯 Стабильная скорость (среднее до 30 минут)")
    if premium_top_worker_kzt > 0:
        achievements.append("👑 Топ кладовщик площадки")

    return SalaryPreviewRead(
        minute_rate_kzt=WORKER_MINUTE_RATE_KZT,
        total_duration_seconds=total_duration_seconds,
        completed_orders_count=completed_orders_count,
        average_seconds=average_seconds,
        best_seconds=best_seconds,
        base_pay_kzt=base_pay_kzt,
        premium_first_order_kzt=premium_first_order_kzt,
        premium_milestone_kzt=premium_milestone_kzt,
        premium_speed_kzt=premium_speed_kzt,
        premium_top_worker_kzt=premium_top_worker_kzt,
        premium_total_kzt=premium_total_kzt,
        payout_total_kzt=payout_total_kzt,
        achievements=achievements,
    )


@router.get("/achievements/history", response_model=list[AchievementHistoryItemRead])
def achievements_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_requests = db.query(Request).all()
    completed_requests = [r for r in all_requests if r.status in COMPLETED_STATUSES]

    my_completed = []
    for req in completed_requests:
        assigned_ids = req.assignee_ids or ([] if not req.assignee_id else [str(req.assignee_id)])
        if str(current_user.id) in assigned_ids:
            my_completed.append(req)

    my_completed_sorted = sorted(
        my_completed,
        key=lambda r: (
            r.finished_at or r.updated_at or r.created_at,
            r.created_at,
        ),
    )

    history: list[AchievementHistoryItemRead] = []

    if len(my_completed_sorted) >= 1:
        first = my_completed_sorted[0]
        history.append(
            AchievementHistoryItemRead(
                code="first_order",
                title="Первый собранный заказ",
                description="Собран первый заказ как кладовщик.",
                level="bronze",
                achieved_at=_as_iso(first.finished_at or first.updated_at or first.created_at),
            )
        )

    milestone_map = {10: ("milestone_10", "10+ собранных заказов", "silver"), 50: ("milestone_50", "50+ собранных заказов", "gold")}
    for threshold, (code, title, level) in milestone_map.items():
        if len(my_completed_sorted) >= threshold:
            req = my_completed_sorted[threshold - 1]
            history.append(
                AchievementHistoryItemRead(
                    code=code,
                    title=title,
                    description=f"Достигнут порог {threshold} завершенных заказов.",
                    level=level,
                    achieved_at=_as_iso(req.finished_at or req.updated_at or req.created_at),
                )
            )

    fast_orders = [r for r in my_completed_sorted if (r.duration_seconds or 0) > 0 and (r.duration_seconds or 0) <= 15 * 60]
    if fast_orders:
        fast_req = fast_orders[0]
        history.append(
            AchievementHistoryItemRead(
                code="fast_order",
                title="Быстрый заказ",
                description="Собран заказ быстрее 15 минут.",
                level="silver",
                achieved_at=_as_iso(fast_req.finished_at or fast_req.updated_at or fast_req.created_at),
            )
        )

    if len(my_completed_sorted) >= 5:
        rolling_sum = 0
        stable_req = None
        for idx, req in enumerate(my_completed_sorted, start=1):
            rolling_sum += int(req.duration_seconds or 0)
            if idx >= 5:
                avg = round(rolling_sum / idx)
                if avg <= PREMIUM_FAST_AVG_MAX_SECONDS:
                    stable_req = req
                    break
        if stable_req:
            history.append(
                AchievementHistoryItemRead(
                    code="stable_speed",
                    title="Стабильная скорость",
                    description="Среднее время выполнения <= 30 минут (минимум 5 заказов).",
                    level="gold",
                    achieved_at=_as_iso(stable_req.finished_at or stable_req.updated_at or stable_req.created_at),
                )
            )

    approvals = sorted(
        [r for r in all_requests if str(r.manager_id or "") == str(current_user.id) and r.status in {"approved", "rated"}],
        key=lambda r: (r.updated_at, r.created_at),
    )
    if len(approvals) >= 20:
        req = approvals[19]
        history.append(
            AchievementHistoryItemRead(
                code="manager_approvals_20",
                title="Контроль качества: 20+ подтверждений",
                description="Подтверждено не менее 20 заявок в роли руководителя.",
                level="gold",
                achieved_at=_as_iso(req.updated_at or req.created_at),
            )
        )

    requester_done = sorted(
        [r for r in all_requests if str(r.requester_id or "") == str(current_user.id) and r.status in COMPLETED_STATUSES],
        key=lambda r: (r.updated_at, r.created_at),
    )
    if len(requester_done) >= 5:
        req = requester_done[4]
        history.append(
            AchievementHistoryItemRead(
                code="requester_5_done",
                title="Активный заказчик: 5+ закрытых заявок",
                description="Как заказчик закрыл не менее 5 заявок.",
                level="silver",
                achieved_at=_as_iso(req.updated_at or req.created_at),
            )
        )

    return sorted(history, key=lambda x: x.achieved_at, reverse=True)
