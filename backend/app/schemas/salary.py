from pydantic import BaseModel


class SalaryPreviewRead(BaseModel):
    minute_rate_kzt: int
    total_duration_seconds: int
    completed_orders_count: int
    average_seconds: int | None = None
    best_seconds: int | None = None
    base_pay_kzt: int
    premium_first_order_kzt: int
    premium_milestone_kzt: int
    premium_speed_kzt: int
    premium_top_worker_kzt: int
    premium_total_kzt: int
    payout_total_kzt: int
    achievements: list[str]


class AchievementHistoryItemRead(BaseModel):
    code: str
    title: str
    description: str
    level: str
    achieved_at: str
