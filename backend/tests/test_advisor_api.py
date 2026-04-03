import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.advisor_api import _extract_hf_text, _hf_candidate_urls


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


if __name__ == "__main__":
    unittest.main()
