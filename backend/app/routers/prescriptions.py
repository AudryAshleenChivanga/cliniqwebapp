from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import Prescription
from ..schemas import PrescriptionCreate, PrescriptionRead
from ..security import get_current_user
from ..services.clinical_support import write_audit

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.post("", response_model=PrescriptionRead)
def create_prescription(
    payload: PrescriptionCreate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    prescription = Prescription(**payload.model_dump(), created_by=user.id)
    session.add(prescription)
    session.commit()
    session.refresh(prescription)
    write_audit(session, user.id, "prescription.create", f'{{"prescription_id":{prescription.id}}}')
    return prescription


@router.get("/patient/{patient_id}", response_model=list[PrescriptionRead])
def list_by_patient(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    return list(
        session.exec(select(Prescription).where(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc())).all()
    )
