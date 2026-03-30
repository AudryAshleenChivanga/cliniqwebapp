from typing import Any

from sqlmodel import Session

from ..models.entities import AuditLog


def write_audit(session: Session, actor_user_id: int, action: str, metadata_json: str = "{}") -> None:
    session.add(AuditLog(actor_user_id=actor_user_id, action=action, metadata_json=metadata_json))
    session.commit()


def condition_guidelines() -> dict[str, list[str]]:
    return {
        "possible_sepsis": [
            "Assess ABCs immediately and check airway patency.",
            "Obtain IV access and draw lactate/cultures if available.",
            "Start broad-spectrum antibiotics within 1 hour per local protocol.",
            "Begin fluid resuscitation and monitor urine output.",
            "Escalate to physician/senior clinician immediately.",
        ],
        "stroke_pattern": [
            "Perform FAST assessment and note symptom onset time.",
            "Check glucose and vital signs.",
            "Arrange urgent referral to stroke-capable facility.",
            "Keep patient NPO until swallow assessed.",
        ],
        "hypertensive_urgency": [
            "Confirm BP with repeat readings.",
            "Assess for end-organ symptoms (headache, vision change, chest pain).",
            "Initiate BP-lowering protocol if indicated.",
            "Arrange close observation and referral if severe symptoms present.",
        ],
        "respiratory_distress": [
            "Position patient upright and provide oxygen if available.",
            "Check respiratory rate and pulse oximetry every 15 minutes.",
            "Treat likely cause (bronchodilator, antibiotics, etc.) per protocol.",
            "Refer urgently if oxygen saturation remains < 90%.",
        ],
    }


def rule_based_chat(prompt: str, patient_context: dict[str, Any] | None = None) -> str:
    context = patient_context or {}
    lower = prompt.lower()

    triage = str(context.get("triage", "medium"))
    risk_score = context.get("risk_score")
    diagnosis = context.get("top_condition", context.get("diagnosis", "the suspected condition"))

    base_summary = (
        f"Clinical Summary:\n"
        f"- Current triage: {triage}\n"
        f"- Estimated risk score: {risk_score if risk_score is not None else 'not provided'}\n"
        f"- Likely condition: {diagnosis}\n"
    )

    if "why" in lower and "sepsis" in lower:
        return (
            base_summary
            + "Interpretation:\n"
            "- Sepsis risk increases when fever, tachycardia, low blood pressure, abnormal lactate, or mental-status changes coexist.\n"
            "- This pattern can indicate systemic infection with potential organ dysfunction.\n"
            "Advisor:\n"
            "- Start emergency protocol, obtain clinician review, begin time-sensitive treatment bundle, and monitor response every 15 minutes.\n"
            "Guideline Context:\n"
            "- WHO emergency triage principles and local severe infection pathway."
        )
    if "next" in lower or "what should" in lower:
        if triage == "critical":
            return (
                base_summary
                + "Immediate Next Steps:\n"
                "1. Stabilize airway, breathing, circulation.\n"
                "2. Trigger emergency escalation and call senior clinician.\n"
                "3. Start protocolized first-line treatment.\n"
                "4. Arrange urgent referral and ambulance if transfer is required.\n"
                "5. Recheck vitals every 10-15 minutes."
            )
        if triage == "medium":
            return (
                base_summary
                + "Care Plan:\n"
                "1. Begin guideline-aligned treatment.\n"
                "2. Reassess vitals within 30 minutes.\n"
                "3. Watch for danger signs (hypotension, altered mental status, hypoxia).\n"
                "4. Escalate to physician if deterioration occurs."
            )
        return (
            base_summary
            + "Care Plan:\n"
            "1. Provide symptomatic treatment and counseling.\n"
            "2. Give return precautions and schedule follow-up.\n"
            "3. Document findings and patient education in EMR."
        )
    return (
        base_summary
        + "I can help with:\n"
        "- Explaining risk drivers and likely diagnosis\n"
        "- Suggesting protocol-based treatment steps\n"
        "- Clarifying referral and escalation criteria\n"
        "- Summarizing patient status for handover"
    )


def simulation_cases() -> list[dict[str, Any]]:
    return [
        {
            "case_id": 1,
            "title": "Postpartum Fever",
            "prompt": "27-year-old, fever 39.2C, HR 124, BP 92/60, confusion.",
            "expected_triage": "critical",
        },
        {
            "case_id": 2,
            "title": "Mild URTI",
            "prompt": "19-year-old, runny nose, sore throat, temp 37.8C, stable vitals.",
            "expected_triage": "low",
        },
        {
            "case_id": 3,
            "title": "Severe Hypertension",
            "prompt": "63-year-old, BP 186/118, headache, no focal deficits.",
            "expected_triage": "medium",
        },
    ]
