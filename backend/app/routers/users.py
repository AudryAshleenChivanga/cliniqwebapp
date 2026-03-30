from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile
from sqlmodel import Session

from ..db import get_session
from ..models.entities import User
from ..schemas import UserProfileUpdate, UserRead
from ..security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "avatars"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/me", response_model=UserRead)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: UserProfileUpdate,
    session: Annotated[Session, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
):
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/me/avatar", response_model=UserRead)
def upload_avatar(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    suffix = Path(file.filename or "avatar.png").suffix or ".png"
    filename = f"{uuid4().hex}{suffix}"
    output = UPLOAD_DIR / filename
    with output.open("wb") as f:
        f.write(file.file.read())
    user.avatar_url = f"/uploads/avatars/{filename}"
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
