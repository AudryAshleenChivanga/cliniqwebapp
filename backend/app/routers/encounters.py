import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import EncounterReport, Patient, Referral, Visit
from ..schemas import EncounterReportRead, EncounterWorkflowInput, EncounterWorkflowOutput
from ..security import get_current_user
from ..services.ai_engine import run_prediction, run_prediction_with_labs
from ..services.clinical_support import write_audit

router = APIRouter(prefix="/encounters", tags=["encounters"])


def _upsert_patient(session: Session, payload: EncounterWorkflowInput) -> Patient:
    existing = session.exec(select(Patient).where(Patient.national_id == payload.demographics.national_id)).first()
    if existing:
        existing.full_name = payload.demographics.full_name
        existing.age = payload.demographics.age
        existing.sex = payload.demographics.sex
        existing.contact = payload.demographics.contact
        existing.medical_history = payload.medical_history
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    patient = Patient(
        national_id=payload.demographics.national_id,
        full_name=payload.demographics.full_name,
        age=payload.demographics.age,
        sex=payload.demographics.sex,
        contact=payload.demographics.contact,
        medical_history=payload.medical_history,
    )
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient


@router.post("/workflow", response_model=EncounterWorkflowOutput)
def run_workflow(
    payload: EncounterWorkflowInput,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    patient = _upsert_patient(session, payload)

    pre_input = {
        "symptoms": payload.symptoms,
        "temperature": payload.vitals.temperature,
        "systolic_bp": payload.vitals.systolic_bp,
        "diastolic_bp": payload.vitals.diastolic_bp,
        "heart_rate": payload.vitals.heart_rate,
        "oxygen_saturation": payload.vitals.oxygen_saturation,
        "medical_history": payload.medical_history,
    }
    prelab = run_prediction(pre_input)
    postlab = run_prediction_with_labs(pre_input, payload.labs.model_dump())

    emergency = prelab["emergency_alert"] or postlab["emergency_alert"]
    escalate = emergency or postlab["triage"] in {"medium", "critical"}

    referral_obj = None
    if postlab["referral_recommended"] or emergency:
        reason = f"{postlab['top_conditions'][0]['condition']} with {postlab['triage']} triage"
        note = (
            f"Referral Note\\nPatient: {patient.full_name} ({patient.national_id})\\n"
            f"Reason: {reason}\\n"
            "Please review urgently and continue advanced management."
        )
        referral_obj = Referral(
            patient_id=patient.id,
            reason=reason,
            note=note,
            target_facility=payload.target_facility,
            created_by=user.id,
        )
        session.add(referral_obj)
        session.commit()
        session.refresh(referral_obj)

    ambulance_called = bool(payload.call_ambulance_if_critical and emergency)
    ambulance_eta = 12 if ambulance_called else None

    report_text = (
        f"Clinical Encounter Report\\n"
        f"Patient: {patient.full_name} ({patient.national_id})\\n"
        f"Pre-lab triage: {prelab['triage']} (risk {prelab['risk_score']})\\n"
        f"Post-lab triage: {postlab['triage']} (risk {postlab['risk_score']})\\n"
        f"Top condition: {postlab['top_conditions'][0]['condition']}\\n"
        f"Escalation: {'Yes' if escalate else 'No'}\\n"
        f"Referral: {'Yes' if referral_obj else 'No'}\\n"
        f"Ambulance called: {'Yes' if ambulance_called else 'No'}"
    )

    encounter = EncounterReport(
        patient_id=patient.id,
        symptoms=payload.symptoms,
        vitals_json=json.dumps(payload.vitals.model_dump()),
        labs_json=json.dumps(payload.labs.model_dump()),
        prelab_summary_json=json.dumps(prelab),
        postlab_summary_json=json.dumps(postlab),
        report_text=report_text,
        escalated_to_doctor=escalate,
        referral_issued=referral_obj is not None,
        referral_id=referral_obj.id if referral_obj else None,
        ambulance_called=ambulance_called,
        ambulance_eta_minutes=ambulance_eta,
        created_by=user.id,
    )
    session.add(encounter)

    visit = Visit(
        patient_id=patient.id,
        symptoms=payload.symptoms,
        temperature=payload.vitals.temperature,
        systolic_bp=payload.vitals.systolic_bp,
        diastolic_bp=payload.vitals.diastolic_bp,
        heart_rate=payload.vitals.heart_rate,
        oxygen_saturation=payload.vitals.oxygen_saturation,
        diagnosis=postlab["top_conditions"][0]["condition"],
        risk_score=postlab["risk_score"],
        triage=postlab["triage"],
        treatment_plan="; ".join(postlab["recommended_next_steps"]),
        emergency_alert=postlab["emergency_alert"],
        created_by=user.id,
    )
    patient.latest_triage = postlab["triage"]

    session.add(visit)
    session.add(patient)
    session.commit()
    session.refresh(encounter)

    write_audit(session, user.id, "encounter.workflow", f'{{"encounter_id":{encounter.id}}}')

    ambulance_message = (
        f"Ambulance dispatched immediately. Estimated arrival {ambulance_eta} minutes."
        if ambulance_called
        else None
    )

    return EncounterWorkflowOutput(
        encounter_id=encounter.id,
        patient_id=patient.id,
        prelab_assessment=prelab,
        postlab_assessment=postlab,
        report=EncounterReportRead(
            id=encounter.id,
            patient_id=encounter.patient_id,
            report_text=encounter.report_text,
            escalated_to_doctor=encounter.escalated_to_doctor,
            referral_issued=encounter.referral_issued,
            referral_id=encounter.referral_id,
            ambulance_called=encounter.ambulance_called,
            ambulance_eta_minutes=encounter.ambulance_eta_minutes,
            created_at=encounter.created_at,
        ),
        ambulance_message=ambulance_message,
    )


@router.post("/{encounter_id}/call-ambulance")
def call_ambulance(
    encounter_id: int,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    encounter = session.get(EncounterReport, encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    encounter.ambulance_called = True
    encounter.ambulance_eta_minutes = 10
    session.add(encounter)
    session.commit()

    write_audit(session, user.id, "encounter.ambulance_call", f'{{"encounter_id":{encounter.id}}}')

    return {
        "message": "Ambulance dispatched",
        "encounter_id": encounter.id,
        "eta_minutes": encounter.ambulance_eta_minutes,
    }


@router.get("/patient/{patient_id}", response_model=list[EncounterReportRead])
def patient_encounter_history(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    reports = list(
        session.exec(
            select(EncounterReport).where(EncounterReport.patient_id == patient_id).order_by(EncounterReport.created_at.desc())
        ).all()
    )
    return [
        EncounterReportRead(
            id=r.id,
            patient_id=r.patient_id,
            report_text=r.report_text,
            escalated_to_doctor=r.escalated_to_doctor,
            referral_issued=r.referral_issued,
            referral_id=r.referral_id,
            ambulance_called=r.ambulance_called,
            ambulance_eta_minutes=r.ambulance_eta_minutes,
            created_at=r.created_at,
        )
        for r in reports
    ]
