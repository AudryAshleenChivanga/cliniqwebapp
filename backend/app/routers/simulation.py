from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import SimulationAttempt, SimulationCase, SimulationResult
from ..security import get_current_user
from ..services.clinical_support import simulation_cases

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.get("/cases", response_model=list[SimulationCase])
def list_cases(_: Annotated[object, Depends(get_current_user)]):
    return simulation_cases()


@router.post("/attempt", response_model=SimulationResult)
def attempt(payload: SimulationAttempt, _: Annotated[object, Depends(get_current_user)]):
    cases = {c["case_id"]: c for c in simulation_cases()}
    case = cases.get(payload.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Simulation case not found")

    correct = case["expected_triage"] == payload.chosen_triage
    score = 100 if correct else 40
    feedback = (
        "Correct triage selection. Prioritization matched expected care pathway."
        if correct
        else f"Expected triage was {case['expected_triage']}. Re-check danger signs and escalation thresholds."
    )
    return SimulationResult(score=score, feedback=feedback)
