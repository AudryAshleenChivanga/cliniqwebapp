from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import Visit
from ..schemas import VisitRead
from ..security import get_current_user

router = APIRouter(prefix="/records", tags=["records"])


@router.get("/visits/{patient_id}", response_model=list[VisitRead])
def patient_history(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    visits = list(session.exec(select(Visit).where(Visit.patient_id == patient_id).order_by(Visit.created_at.desc())).all())
    if not visits:
        raise HTTPException(status_code=404, detail="No visits found")
    return visits


@router.get("/timeline", response_model=list[VisitRead])
def timeline(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    return list(session.exec(select(Visit).order_by(Visit.created_at.desc()).limit(50)).all())
