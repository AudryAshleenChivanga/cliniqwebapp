from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import DrugStock, Patient, Visit
from ..schemas import PredictionInput, PredictionOutput, VisitCreate, VisitRead
from ..security import get_current_user
from ..services.ai_engine import run_prediction
from ..services.clinical_support import write_audit

router = APIRouter(prefix="/predict", tags=["predict"])


@router.post("", response_model=PredictionOutput)
def predict(
    payload: PredictionInput,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    result = run_prediction(payload.model_dump())
    write_audit(session, user.id, "prediction.run", "{}")
    return result


@router.post("/visit", response_model=VisitRead)
def create_visit(
    payload: VisitCreate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    patient = session.get(Patient, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    prediction = run_prediction(payload.model_dump())
    diagnosis = prediction["top_conditions"][0]["condition"]
    treatment = "; ".join(prediction["recommended_next_steps"])

    visit = Visit(
        patient_id=payload.patient_id,
        symptoms=payload.symptoms,
        temperature=payload.temperature,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        heart_rate=payload.heart_rate,
        oxygen_saturation=payload.oxygen_saturation,
        diagnosis=diagnosis,
        risk_score=prediction["risk_score"],
        triage=prediction["triage"],
        treatment_plan=treatment,
        emergency_alert=prediction["emergency_alert"],
        created_by=user.id,
    )
    patient.latest_triage = prediction["triage"]

    session.add(visit)
    session.add(patient)
    session.commit()
    session.refresh(visit)
    write_audit(session, user.id, "visit.create", f'{{"visit_id":{visit.id}}}')
    return visit


@router.get("/drug-awareness")
def drug_awareness(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    drugs = list(session.exec(select(DrugStock)).all())
    return [
        {"name": d.name, "available": d.is_available, "alternative": d.alternative}
        for d in drugs
    ]
