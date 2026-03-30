from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import DrugStock, UserRole
from ..schemas import DrugStockCreate, DrugStockRead
from ..security import require_role

router = APIRouter(prefix="/drugs", tags=["drugs"])


@router.post("", response_model=DrugStockRead)
def upsert_drug(
    payload: DrugStockCreate,
    session: Annotated[Session, Depends(get_session)],
    _=Depends(require_role(UserRole.admin)),
):
    existing = session.exec(select(DrugStock).where(DrugStock.name == payload.name)).first()
    if existing:
        existing.is_available = payload.is_available
        existing.alternative = payload.alternative
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    drug = DrugStock(**payload.model_dump())
    session.add(drug)
    session.commit()
    session.refresh(drug)
    return drug


@router.get("", response_model=list[DrugStockRead])
def list_drugs(
    session: Annotated[Session, Depends(get_session)],
    _=Depends(require_role(UserRole.nurse)),
):
    return list(session.exec(select(DrugStock)).all())
