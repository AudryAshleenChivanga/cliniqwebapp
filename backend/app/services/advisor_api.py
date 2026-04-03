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


def _hf_candidate_urls(model_id: str, explicit_url: str) -> list[str]:
    urls: list[str] = []
    clean_url = explicit_url.strip()
    clean_model = model_id.strip().strip("/")

    if clean_url:
        urls.append(clean_url)
    if clean_model:
        urls.append(f"https://router.huggingface.co/hf-inference/models/{clean_model}/v1/chat/completions")
        urls.append(f"https://api-inference.huggingface.co/models/{clean_model}")

    deduped: list[str] = []
    for url in urls:
        if url not in deduped:
            deduped.append(url)
    return deduped


def _extract_message_text(content: Any) -> str | None:
    if isinstance(content, str):
        return content.strip() or None
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        if parts:
            return "\n".join(parts)
    return None


def _extract_hf_text(payload: Any) -> str | None:
    if isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], dict):
            message = choices[0].get("message")
            if isinstance(message, dict):
                text = _extract_message_text(message.get("content"))
                if text:
                    return text

        generated = payload.get("generated_text")
        text = _extract_message_text(generated)
        if text:
            return text

    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, dict):
            generated = first.get("generated_text")
            text = _extract_message_text(generated)
            if text:
                return text
    return None


def _hf_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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
        user_prompt = f"{_format_context(patient_context)}\n\nQuestion: {prompt}"
        try:
            with httpx.Client(timeout=8.0) as client:
                for url in _hf_candidate_urls(settings.hf_model_id, settings.hf_api_url):
                    if url.endswith("/v1/chat/completions"):
                        response = client.post(
                            url,
                            headers=_hf_headers(settings.hf_api_token),
                            json={
                                "model": settings.hf_model_id,
                                "messages": [
                                    {"role": "system", "content": _system_prompt()},
                                    {"role": "user", "content": user_prompt},
                                ],
                                "max_tokens": 380,
                                "temperature": 0.4,
                            },
                        )
                    else:
                        response = client.post(
                            url,
                            headers=_hf_headers(settings.hf_api_token),
                            json={
                                "inputs": f"{_system_prompt()}\n\n{user_prompt}",
                                "parameters": {"max_new_tokens": 380, "temperature": 0.4},
                            },
                        )

                    response.raise_for_status()
                    text = _extract_hf_text(response.json())
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
                for url in _hf_candidate_urls(settings.hf_model_id, settings.hf_api_url):
                    resp = client.get(url, headers=_hf_headers(settings.hf_api_token))
                    if resp.status_code in {200, 401, 403, 404, 405}:
                        # Endpoint is reachable even if auth/method/model behavior differs.
                        return {
                            "provider": "huggingface",
                            "available": True,
                            "mode": f"open_source_api:{settings.hf_model_id}",
                        }
            return {"provider": "huggingface", "available": False, "mode": "fallback_local"}
        except Exception:
            return {"provider": "huggingface", "available": False, "mode": "fallback_local"}

    return {"provider": provider or "unknown", "available": False, "mode": "fallback_local"}
