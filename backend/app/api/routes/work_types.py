from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.models.user import User
from app.models.work_type import WorkType
from app.schemas.work_type import WorkTypeCreate, WorkTypeRead

router = APIRouter(prefix="/work-types", tags=["work-types"])


@router.get("", response_model=list[WorkTypeRead])
def list_work_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "warehouse_manager", "requester")),
):
    return db.query(WorkType).order_by(WorkType.name.asc()).all()


@router.post("", response_model=WorkTypeRead)
def create_work_type(
    payload: WorkTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    entity = WorkType(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity