from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import TeamChatMessage
from ..schemas import TeamChatCreate, TeamChatRead
from ..security import get_current_user
from ..services.clinical_support import write_audit

router = APIRouter(prefix="/team-chat", tags=["team-chat"])


@router.post("", response_model=TeamChatRead)
def post_team_message(
    payload: TeamChatCreate,
    session: Annotated[Session, Depends(get_session)],
    user=Depends(get_current_user),
):
    msg = TeamChatMessage(
        sender_user_id=user.id,
        sender_name=user.full_name,
        sender_role=user.role,
        message=payload.message,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    write_audit(session, user.id, "team_chat.post", f'{{"message_id":{msg.id}}}')
    return msg


@router.get("", response_model=list[TeamChatRead])
def list_team_messages(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    return list(session.exec(select(TeamChatMessage).order_by(TeamChatMessage.created_at.desc()).limit(100)).all())
