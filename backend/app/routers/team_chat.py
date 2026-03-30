from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import TeamChatMessage, User
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
    return TeamChatRead(
        id=msg.id,
        sender_user_id=msg.sender_user_id,
        sender_name=msg.sender_name,
        sender_role=msg.sender_role,
        sender_avatar_url=user.avatar_url,
        message=msg.message,
        created_at=msg.created_at,
    )


@router.get("", response_model=list[TeamChatRead])
def list_team_messages(
    session: Annotated[Session, Depends(get_session)],
    _: Annotated[object, Depends(get_current_user)],
):
    messages = list(session.exec(select(TeamChatMessage).order_by(TeamChatMessage.created_at.asc()).limit(200)).all())
    user_ids = {m.sender_user_id for m in messages}
    users = list(session.exec(select(User).where(User.id.in_(user_ids))).all()) if user_ids else []
    avatar_map = {u.id: u.avatar_url for u in users}
    return [
        TeamChatRead(
            id=m.id,
            sender_user_id=m.sender_user_id,
            sender_name=m.sender_name,
            sender_role=m.sender_role,
            sender_avatar_url=avatar_map.get(m.sender_user_id),
            message=m.message,
            created_at=m.created_at,
        )
        for m in messages
    ]
