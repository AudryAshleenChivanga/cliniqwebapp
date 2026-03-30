from __future__ import annotations

from typing import Any

import httpx

from ..core.config import get_settings
from .clinical_support import rule_based_chat


def _system_prompt() -> str:
    return (
        "You are ClinIQ advisor for nurses in low-resource settings. "
        "Respond with: Clinical Summary, Interpretation, Advisor Steps, Danger Signs, and Escalation Triggers. "
        "Use concise, practical language and never replace clinician judgment."
    )


def _format_context(context: dict[str, Any] | None) -> str:
    if not context:
        return "No structured patient context provided."
    lines = [f"- {k}: {v}" for k, v in context.items()]
    return "Patient context:\n" + "\n".join(lines)


def generate_advisor_response(prompt: str, patient_context: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    provider = settings.advisor_provider.lower().strip()

    if provider == "ollama":
        try:
            with httpx.Client(timeout=6.0) as client:
                response = client.post(
                    f"{settings.ollama_url}/api/chat",
                    json={
                        "model": settings.ollama_model,
                        "stream": False,
                        "messages": [
                            {"role": "system", "content": _system_prompt()},
                            {"role": "user", "content": f"{_format_context(patient_context)}\n\nQuestion: {prompt}"},
                        ],
                    },
                )
                response.raise_for_status()
                payload = response.json()
                content = (payload.get("message") or {}).get("content")
                if content:
                    return content
        except Exception:
            pass

    if provider == "huggingface" and settings.hf_api_token:
        try:
            with httpx.Client(timeout=8.0) as client:
                response = client.post(
                    settings.hf_api_url,
                    headers={"Authorization": f"Bearer {settings.hf_api_token}"},
                    json={
                        "inputs": f"{_system_prompt()}\n\n{_format_context(patient_context)}\n\nQuestion: {prompt}",
                        "parameters": {"max_new_tokens": 380, "temperature": 0.4},
                    },
                )
                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, list) and payload and isinstance(payload[0], dict):
                    text = payload[0].get("generated_text")
                    if text:
                        return text
        except Exception:
            pass

    # Fallback guaranteed behavior
    return rule_based_chat(prompt, patient_context)


def advisor_status() -> dict[str, Any]:
    settings = get_settings()
    provider = settings.advisor_provider.lower().strip()

    if provider == "rule_based":
        return {"provider": "rule_based", "available": True, "mode": "fallback_local"}

    if provider == "ollama":
        try:
            with httpx.Client(timeout=2.5) as client:
                resp = client.get(f"{settings.ollama_url}/api/tags")
                resp.raise_for_status()
            return {"provider": "ollama", "available": True, "mode": "open_source_api"}
        except Exception:
            return {"provider": "ollama", "available": False, "mode": "fallback_local"}

    if provider == "huggingface":
        if not settings.hf_api_token:
            return {"provider": "huggingface", "available": False, "mode": "fallback_local"}
        try:
            with httpx.Client(timeout=2.5) as client:
                resp = client.get(settings.hf_api_url, headers={"Authorization": f"Bearer {settings.hf_api_token}"})
                if resp.status_code in {200, 401, 403, 404, 405}:
                    # endpoint reachable even if method/token/model behavior differs
                    return {"provider": "huggingface", "available": True, "mode": "open_source_api"}
            return {"provider": "huggingface", "available": False, "mode": "fallback_local"}
        except Exception:
            return {"provider": "huggingface", "available": False, "mode": "fallback_local"}

    return {"provider": provider or "unknown", "available": False, "mode": "fallback_local"}
