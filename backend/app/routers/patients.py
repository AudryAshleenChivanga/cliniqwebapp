from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, or_, select

from ..db import get_session
from ..models.entities import AuditLog, Patient, PatientDepartmentAssignment
from ..schemas import PatientCreate, PatientRead
from ..security import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])


def _to_patient_read(session: Session, patient: Patient) -> PatientRead:
    latest_assignment = session.exec(
        select(PatientDepartmentAssignment)
        .where(PatientDepartmentAssignment.patient_id == patient.id)
        .order_by(PatientDepartmentAssignment.created_at.desc())
    ).first()
    department = latest_assignment.department if latest_assignment else "OPD"
    return PatientRead(
        id=patient.id,
        national_id=patient.national_id,
        full_name=patient.full_name,
        age=patient.age,
        sex=patient.sex,
        contact=patient.contact,
        medical_history=patient.medical_history,
        department=department,
        latest_triage=patient.latest_triage,
        created_at=patient.created_at,
    )


@router.post("", response_model=PatientRead)
def create_patient(
    payload: PatientCreate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    existing = session.exec(select(Patient).where(Patient.national_id == payload.national_id)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Patient national ID already exists")

    patient = Patient(
        national_id=payload.national_id,
        full_name=payload.full_name,
        age=payload.age,
        sex=payload.sex,
        contact=payload.contact,
        medical_history=payload.medical_history,
    )
    session.add(patient)
    session.commit()
    session.refresh(patient)
    session.add(
        PatientDepartmentAssignment(
            patient_id=patient.id,
            department=payload.department,
            assigned_by=user.id,
        )
    )
    session.commit()
    session.add(AuditLog(actor_user_id=user.id, action="patient.create", metadata_json=f'{{"patient_id":{patient.id}}}'))
    session.commit()
    return _to_patient_read(session, patient)


@router.get("", response_model=list[PatientRead])
def list_patients(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
    q: str = Query(default="", description="Search by name or national ID"),
):
    statement = select(Patient)
    if q:
        statement = statement.where(or_(Patient.full_name.contains(q), Patient.national_id.contains(q)))
    patients = list(session.exec(statement.order_by(Patient.created_at.desc())).all())
    return [_to_patient_read(session, patient) for patient in patients]


@router.get("/{patient_id}", response_model=PatientRead)
def get_patient(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _to_patient_read(session, patient)
