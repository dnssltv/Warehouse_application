from datetime import datetime, timedelta, time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.request import Request


WORKDAY_START = time(8, 0)
WORKDAY_END = time(21, 0)


class RequestService:
    @staticmethod
    def generate_request_number(db: Session) -> str:
        current_month = datetime.utcnow().strftime("%Y%m")
        prefix = f"REQ-{current_month}-"

        stmt = select(func.max(Request.request_number)).where(Request.request_number.like(f"{prefix}%"))
        max_request_number = db.execute(stmt).scalar_one()
        next_number = 1

        if max_request_number:
            try:
                next_number = int(max_request_number.rsplit("-", 1)[-1]) + 1
            except ValueError:
                # Fallback keeps service resilient to malformed legacy values.
                count_stmt = select(func.count(Request.id)).where(Request.request_number.like(f"{prefix}%"))
                next_number = db.execute(count_stmt).scalar_one() + 1

        return f"{prefix}{next_number:04d}"

    @staticmethod
    def _normalize_to_work_time(dt: datetime) -> datetime:
        current_time = dt.time()

        if current_time < WORKDAY_START:
            return dt.replace(hour=WORKDAY_START.hour, minute=0, second=0, microsecond=0)

        if current_time >= WORKDAY_END:
            next_day = dt + timedelta(days=1)
            return next_day.replace(hour=WORKDAY_START.hour, minute=0, second=0, microsecond=0)

        return dt

    @staticmethod
    def calculate_deadline(item_qty: int) -> tuple[int, datetime]:
        deadline_seconds = item_qty * 60
        remaining = deadline_seconds

        current = RequestService._normalize_to_work_time(datetime.now())

        while remaining > 0:
            end_of_day = current.replace(
                hour=WORKDAY_END.hour,
                minute=WORKDAY_END.minute,
                second=0,
                microsecond=0,
            )

            available_today = int((end_of_day - current).total_seconds())

            if remaining <= available_today:
                current = current + timedelta(seconds=remaining)
                remaining = 0
            else:
                remaining -= available_today
                next_day = current + timedelta(days=1)
                current = next_day.replace(
                    hour=WORKDAY_START.hour,
                    minute=0,
                    second=0,
                    microsecond=0,
                )

        return deadline_seconds, current

    @staticmethod
    def calculate_duration_seconds(started_at: datetime, finished_at: datetime) -> int:
        if finished_at <= started_at:
            return 0

        total = 0
        cursor = started_at
        while cursor < finished_at:
            day_start = cursor.replace(
                hour=WORKDAY_START.hour,
                minute=WORKDAY_START.minute,
                second=0,
                microsecond=0,
            )
            day_end = cursor.replace(
                hour=WORKDAY_END.hour,
                minute=WORKDAY_END.minute,
                second=0,
                microsecond=0,
            )

            if cursor < day_start:
                cursor = day_start
                continue

            if cursor >= day_end:
                next_day = cursor + timedelta(days=1)
                cursor = next_day.replace(
                    hour=WORKDAY_START.hour,
                    minute=WORKDAY_START.minute,
                    second=0,
                    microsecond=0,
                )
                continue

            window_end = min(day_end, finished_at)
            total += int((window_end - cursor).total_seconds())
            cursor = window_end

        return max(0, total)