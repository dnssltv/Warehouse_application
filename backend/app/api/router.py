from fastapi import APIRouter

from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.work_types import router as work_types_router

api_router = APIRouter(prefix="/api")
api_router.include_router(users_router)
api_router.include_router(work_types_router)
api_router.include_router(requests_router)