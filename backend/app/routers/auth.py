from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models.entities import AuditLog, User, UserRole
from ..schemas import LoginRequest, TokenResponse, UserCreate, UserRead
from ..security import authenticate_user, create_access_token, hash_password, require_role

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
def register(payload: UserCreate, session: Annotated[Session, Depends(get_session)]):
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    log = AuditLog(actor_user_id=user.id, action="user.register", metadata_json='{"email":"%s"}' % user.email)
    session.add(log)
    session.commit()
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Annotated[Session, Depends(get_session)]):
    user = authenticate_user(session, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email/password")

    token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(hours=8))
    session.add(AuditLog(actor_user_id=user.id, action="user.login", metadata_json="{}"))
    session.commit()
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
def me(user=Depends(require_role(UserRole.nurse))):
    return user
