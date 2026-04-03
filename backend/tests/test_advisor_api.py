import unittest
from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.advisor_api import _extract_hf_text, _hf_candidate_urls, _normalized_provider_name, advisor_status


class AdvisorApiTests(unittest.TestCase):
    def test_extracts_chat_completion_text(self) -> None:
        payload = {
            "choices": [
                {
                    "message": {
                        "content": "Clinical Summary:\n- Stable patient",
                    }
                }
            ]
        }

        self.assertEqual(_extract_hf_text(payload), "Clinical Summary:\n- Stable patient")

    def test_extracts_legacy_generated_text(self) -> None:
        payload = [{"generated_text": "Advisor Steps:\n1. Reassess vitals"}]

        self.assertEqual(_extract_hf_text(payload), "Advisor Steps:\n1. Reassess vitals")

    def test_builds_router_and_legacy_urls_from_model(self) -> None:
        urls = _hf_candidate_urls("google/medgemma-1.5-4b-it", "")

        self.assertEqual(
            urls,
            [
                "https://router.huggingface.co/hf-inference/models/google/medgemma-1.5-4b-it/v1/chat/completions",
                "https://api-inference.huggingface.co/models/google/medgemma-1.5-4b-it",
            ],
        )

    def test_normalizes_huggingface_medgemma_to_medgemma_provider(self) -> None:
        self.assertEqual(_normalized_provider_name("huggingface", "google/medgemma-1.5-4b-it"), "medgemma")

    def test_advisor_status_reports_medgemma_when_token_missing(self) -> None:
        class StubSettings:
            advisor_provider = "medgemma"
            hf_model_id = "google/medgemma-1.5-4b-it"
            hf_api_token = ""
            hf_api_url = ""
            ollama_url = "http://localhost:11434"

        with patch("app.services.advisor_api.get_settings", return_value=StubSettings()):
            status = advisor_status()

        self.assertEqual(status["provider"], "medgemma")
        self.assertFalse(status["available"])
        self.assertIn("missing_token", status["mode"])


if __name__ == "__main__":
    unittest.main()
