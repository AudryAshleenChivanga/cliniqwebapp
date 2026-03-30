from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import DoctorChatMessage
from ..schemas import DoctorChatCreate, DoctorChatRead
from ..security import get_current_user
from ..services.clinical_support import write_audit

router = APIRouter(prefix="/doctor-chat", tags=["doctor-chat"])


@router.post("", response_model=DoctorChatRead)
def post_message(
    payload: DoctorChatCreate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    msg = DoctorChatMessage(**payload.model_dump())
    session.add(msg)
    if payload.sender_role.lower() == "nurse":
        session.add(
            DoctorChatMessage(
                encounter_id=payload.encounter_id,
                sender_role="doctor",
                sender_name="On-Call Doctor",
                message="Received. Continue stabilization, follow the protocol steps, and prepare transfer if instability persists.",
            )
        )
    session.commit()
    session.refresh(msg)
    write_audit(session, user.id, "doctor_chat.post", f'{{"encounter_id":{payload.encounter_id}}}')
    return msg


@router.get("/{encounter_id}", response_model=list[DoctorChatRead])
def list_messages(
    encounter_id: int,
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    return list(
        session.exec(
            select(DoctorChatMessage)
            .where(DoctorChatMessage.encounter_id == encounter_id)
            .order_by(DoctorChatMessage.created_at.asc())
        ).all()
    )
