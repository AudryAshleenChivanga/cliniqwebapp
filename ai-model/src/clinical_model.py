from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = Path(__file__).with_name("model.joblib")

LABELS = ["viral_fever", "hypertensive_urgency", "possible_sepsis", "respiratory_distress", "gastroenteritis"]


@dataclass
class PredictionResult:
    label: str
    probabilities: dict[str, float]
    feature_importance: dict[str, float]


def _build_dataset(seed: int = 7):
    rng = np.random.default_rng(seed)
    size = 1200
    temp = rng.normal(37.5, 1.2, size)
    sbp = rng.normal(122, 20, size)
    dbp = rng.normal(78, 10, size)
    hr = rng.normal(88, 18, size)
    spo2 = rng.normal(96, 2.5, size)
    symptom_fever = rng.integers(0, 2, size)
    symptom_cough = rng.integers(0, 2, size)
    symptom_diarrhea = rng.integers(0, 2, size)
    symptom_confusion = rng.integers(0, 2, size)

    X = np.column_stack([temp, sbp, dbp, hr, spo2, symptom_fever, symptom_cough, symptom_diarrhea, symptom_confusion])

    y = []
    for i in range(size):
        if temp[i] > 38.5 and hr[i] > 110 and (spo2[i] < 92 or symptom_confusion[i] == 1):
            y.append("possible_sepsis")
        elif sbp[i] > 170 or dbp[i] > 110:
            y.append("hypertensive_urgency")
        elif spo2[i] < 91 and symptom_cough[i] == 1:
            y.append("respiratory_distress")
        elif symptom_diarrhea[i] == 1 and temp[i] < 38.7:
            y.append("gastroenteritis")
        else:
            y.append("viral_fever")
    return X, np.array(y)


def train_and_save_model(path: Path = MODEL_PATH):
    X, y = _build_dataset()
    model = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42)
    model.fit(X, y)
    payload = {
        "model": model,
        "labels": LABELS,
        "feature_names": [
            "temperature",
            "systolic_bp",
            "diastolic_bp",
            "heart_rate",
            "oxygen_saturation",
            "symptom_fever",
            "symptom_cough",
            "symptom_diarrhea",
            "symptom_confusion",
        ],
    }
    joblib.dump(payload, path)


def _load(path: Path = MODEL_PATH):
    if not path.exists():
        train_and_save_model(path)
    return joblib.load(path)


def predict(features: np.ndarray, path: Path = MODEL_PATH) -> PredictionResult:
    bundle = _load(path)
    model = bundle["model"]
    probs = model.predict_proba(features)[0]
    labels = model.classes_
    probabilities = {label: float(prob) for label, prob in sorted(zip(labels, probs), key=lambda x: x[1], reverse=True)}
    top_label = max(probabilities, key=probabilities.get)
    importances = {
        name: float(weight)
        for name, weight in sorted(
            zip(bundle["feature_names"], model.feature_importances_), key=lambda x: x[1], reverse=True
        )
    }
    return PredictionResult(label=top_label, probabilities=probabilities, feature_importance=importances)
