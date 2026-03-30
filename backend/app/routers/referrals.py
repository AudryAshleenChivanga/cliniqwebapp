from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import Referral, ReferralStatus
from ..schemas import ReferralCreate, ReferralRead, ReferralUpdate
from ..security import get_current_user
from ..services.clinical_support import write_audit

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.post("", response_model=ReferralRead)
def create_referral(
    payload: ReferralCreate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    note = (
        f"Referral Note\\nPatient ID: {payload.patient_id}\\nReason: {payload.reason}\\n"
        f"Recommendation: Urgent specialist assessment at {payload.target_facility}."
    )
    ref = Referral(
        patient_id=payload.patient_id,
        reason=payload.reason,
        note=note,
        target_facility=payload.target_facility,
        created_by=user.id,
    )
    session.add(ref)
    session.commit()
    session.refresh(ref)
    write_audit(session, user.id, "referral.create", f'{{"referral_id":{ref.id}}}')
    return ref


@router.get("", response_model=list[ReferralRead])
def list_referrals(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    return list(session.exec(select(Referral).order_by(Referral.created_at.desc())).all())


@router.patch("/{referral_id}", response_model=ReferralRead)
def update_referral(
    referral_id: int,
    payload: ReferralUpdate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    ref = session.get(Referral, referral_id)
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    ref.status = payload.status
    session.add(ref)
    session.commit()
    session.refresh(ref)
    write_audit(session, user.id, "referral.update", f'{{"referral_id":{ref.id},"status":"{ref.status}"}}')
    return ref
