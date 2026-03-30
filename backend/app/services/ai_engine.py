from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
AI_SRC = ROOT / "ai-model" / "src"
if str(AI_SRC) not in sys.path:
    sys.path.append(str(AI_SRC))

from clinical_model import predict as model_predict  # type: ignore  # noqa: E402


SYMPTOM_MAP = {
    "fever": "symptom_fever",
    "cough": "symptom_cough",
    "diarrhea": "symptom_diarrhea",
    "confusion": "symptom_confusion",
}


def _extract_symptom_flags(text: str) -> dict[str, int]:
    lower = text.lower()
    flags = {v: 0 for v in SYMPTOM_MAP.values()}
    for token, feature in SYMPTOM_MAP.items():
        if re.search(rf"\\b{re.escape(token)}\\b", lower):
            flags[feature] = 1
    return flags


def _base_prediction(payload: dict) -> dict:
    flags = _extract_symptom_flags(payload.get("symptoms", ""))
    row = np.array(
        [
            [
                payload["temperature"],
                payload["systolic_bp"],
                payload["diastolic_bp"],
                payload["heart_rate"],
                payload.get("oxygen_saturation", 98),
                flags["symptom_fever"],
                flags["symptom_cough"],
                flags["symptom_diarrhea"],
                flags["symptom_confusion"],
            ]
        ]
    )

    result = model_predict(row)
    probs = result.probabilities
    top_conditions = [{"condition": k, "confidence": round(v, 4)} for k, v in list(probs.items())[:3]]

    risk = 0.25
    if payload["temperature"] >= 39:
        risk += 0.2
    if payload["heart_rate"] > 120:
        risk += 0.2
    if payload["systolic_bp"] < 95 or payload["oxygen_saturation"] < 90:
        risk += 0.3
    if "chest pain" in payload.get("symptoms", "").lower() or "confusion" in payload.get("symptoms", "").lower():
        risk += 0.15
    risk = min(1.0, risk)

    if risk >= 0.75:
        triage = "critical"
    elif risk >= 0.45:
        triage = "medium"
    else:
        triage = "low"

    emergency_alert = triage == "critical" or result.label in {"possible_sepsis", "respiratory_distress"}

    next_steps = [
        "Repeat vitals in 15-30 minutes.",
        "Follow local protocol for suspected condition.",
        "Document findings and interventions in EMR.",
    ]
    if emergency_alert:
        next_steps.insert(0, "Trigger emergency escalation and notify on-call clinician immediately.")

    referral_recommended = (triage in {"medium", "critical"} and payload["systolic_bp"] > 170) or (
        payload["oxygen_saturation"] < 90
    )
    guideline_references = [
        {
            "source": "WHO Emergency Triage Assessment and Treatment (ETAT)",
            "note": "Supports rapid triage and danger-sign recognition in low-resource settings.",
        },
        {
            "source": "WHO Integrated Management pathways",
            "note": "Guides protocolized first-line management based on symptoms and severity.",
        },
        {
            "source": "Rwanda MoH / RBC standard treatment guidance",
            "note": "Align local treatment and referral decisions with national practice.",
        },
    ]

    advisor_summary = (
        f"Triage is {triage}. Prioritize protocol-based management for {top_conditions[0]['condition']} "
        "and continue close reassessment with escalation on deterioration."
    )

    return {
        "top_conditions": top_conditions,
        "risk_score": round(risk, 3),
        "triage": triage,
        "recommended_next_steps": next_steps,
        "advisor_summary": advisor_summary,
        "emergency_alert": emergency_alert,
        "explainability": {k: round(v, 4) for k, v in list(result.feature_importance.items())[:6]},
        "referral_recommended": referral_recommended,
        "guideline_references": guideline_references,
    }


def run_prediction(payload: dict) -> dict:
    return _base_prediction(payload)


def run_prediction_with_labs(payload: dict, labs: dict | None = None) -> dict:
    assessment = _base_prediction(payload)
    if not labs:
        return assessment

    risk = assessment["risk_score"]
    top = assessment["top_conditions"]
    next_steps = list(assessment["recommended_next_steps"])

    lactate = labs.get("lactate")
    wbc = labs.get("wbc")
    platelets = labs.get("platelets")
    glucose = labs.get("glucose")
    crp = labs.get("crp")

    if lactate is not None and lactate >= 2.0:
        risk += 0.12
        next_steps.insert(0, "Elevated lactate: prioritize sepsis bundle and urgent fluid/antibiotic protocol.")
    if wbc is not None and (wbc >= 12 or wbc <= 4):
        risk += 0.08
        next_steps.insert(0, "Abnormal WBC: monitor for systemic infection and reassess q15 minutes.")
    if platelets is not None and platelets < 100:
        risk += 0.07
        next_steps.insert(0, "Low platelets: assess bleeding risk and escalate to physician review.")
    if glucose is not None and glucose >= 250:
        risk += 0.05
        next_steps.insert(0, "Hyperglycemia detected: evaluate for metabolic decompensation.")
    if crp is not None and crp >= 100:
        risk += 0.06

    risk = round(min(1.0, risk), 3)
    if risk >= 0.75:
        triage = "critical"
    elif risk >= 0.45:
        triage = "medium"
    else:
        triage = "low"

    if lactate is not None and lactate >= 4.0:
        top = [{"condition": "possible_sepsis", "confidence": 0.92}] + [item for item in top if item["condition"] != "possible_sepsis"]

    emergency_alert = triage == "critical" or (lactate is not None and lactate >= 2.0)
    referral_recommended = assessment["referral_recommended"] or triage in {"medium", "critical"}

    return {
        **assessment,
        "top_conditions": top[:3],
        "risk_score": risk,
        "triage": triage,
        "recommended_next_steps": next_steps[:6],
        "advisor_summary": (
            f"Post-lab reassessment indicates {triage} risk. "
            "Use lab-informed care pathway and escalate urgently if instability persists."
        ),
        "emergency_alert": emergency_alert,
        "referral_recommended": referral_recommended,
    }
