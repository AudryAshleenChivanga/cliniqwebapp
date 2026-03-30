from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..db import get_session
from ..models.entities import Patient, Visit
from ..security import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    total_patients = session.exec(select(func.count(Patient.id))).one()
    total_visits = session.exec(select(func.count(Visit.id))).one()
    triage_counts = session.exec(select(Visit.triage, func.count(Visit.id)).group_by(Visit.triage)).all()
    diagnosis_counts = session.exec(select(Visit.diagnosis, func.count(Visit.id)).group_by(Visit.diagnosis)).all()

    return {
        "total_patients": total_patients,
        "total_visits": total_visits,
        "triage_distribution": [{"triage": t, "count": c} for t, c in triage_counts],
        "common_conditions": [{"condition": d, "count": c} for d, c in diagnosis_counts],
    }


@router.get("/alerts")
def alerts(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    critical = list(
        session.exec(
            select(Visit).where(Visit.emergency_alert == True).order_by(Visit.created_at.desc()).limit(10)  # noqa: E712
        ).all()
    )
    return [
        {
            "visit_id": v.id,
            "patient_id": v.patient_id,
            "diagnosis": v.diagnosis,
            "triage": v.triage,
            "created_at": v.created_at,
        }
        for v in critical
    ]
