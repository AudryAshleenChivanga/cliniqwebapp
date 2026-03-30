from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..schemas import ChatRequest, ChatResponse, GuidelineQuery, GuidelineResponse
from ..security import get_current_user
from ..services.advisor_api import advisor_status, generate_advisor_response
from ..services.clinical_support import condition_guidelines

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/guidelines", response_model=GuidelineResponse)
def guidelines(
    payload: GuidelineQuery,
    _: Annotated[object, Depends(get_current_user)],
    __: Annotated[Session, Depends(get_session)],
):
    library = condition_guidelines()
    steps = library.get(payload.condition.lower(), ["No protocol loaded for this condition. Escalate to supervising clinician."])
    return GuidelineResponse(condition=payload.condition, steps=steps)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, _: Annotated[object, Depends(get_current_user)]):
    answer = generate_advisor_response(payload.prompt, payload.patient_context)
    return ChatResponse(answer=answer)


@router.get("/status")
def status(_: Annotated[object, Depends(get_current_user)]):
    return advisor_status()
