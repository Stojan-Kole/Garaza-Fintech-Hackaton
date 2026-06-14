"""
Temporal risk prediction model (Random Forest).
Outputs risk score 0-100 with human-readable explanations.
"""
from __future__ import annotations
import pickle
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from .features import FEATURE_NAMES, FEATURE_LABELS, FEATURE_EXPLANATIONS

MODEL_CACHE = Path(".cache/temporal_model.pkl")


class RiskPredictor:
    def __init__(self):
        self.model: RandomForestClassifier | None = None
        self.scaler: StandardScaler | None = None
        self._importances: np.ndarray | None = None

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        self.model = RandomForestClassifier(
            n_estimators=150,
            max_depth=8,
            min_samples_leaf=4,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_scaled, y)
        self._importances = self.model.feature_importances_

    def predict(self, features: list) -> tuple:
        """Returns (risk_score: float 0-100, reasons: list[str])."""
        if self.model is None or self.scaler is None:
            raise RuntimeError("Model not trained.")
        X = np.array(features, dtype=np.float32).reshape(1, -1)
        X_scaled = self.scaler.transform(X)
        proba = self.model.predict_proba(X_scaled)[0]
        pos_idx = list(self.model.classes_).index(1)
        risk_score = round(float(proba[pos_idx]) * 100, 1)

        # Explanation: top features by (importance × |normalized value|)
        feature_arr = np.array(features, dtype=np.float32)
        normalized = (feature_arr - self.scaler.mean_) / (self.scaler.scale_ + 1e-9)
        contributions = self._importances * np.abs(normalized)
        top_indices = np.argsort(contributions)[::-1][:6]

        reasons = []
        for idx in top_indices:
            if contributions[idx] < 0.002:
                break
            fname = FEATURE_NAMES[idx]
            fval = features[idx]
            if fname in FEATURE_EXPLANATIONS and fval > 0:
                reasons.append(FEATURE_EXPLANATIONS[fname])

        if not reasons and risk_score > 15:
            reasons = ["Elevated statistical similarity to pre-blacklist entity patterns"]

        return risk_score, reasons

    def feature_breakdown(self, features: list) -> list:
        """Return list of {name, value, contribution, explanation} dicts."""
        if self.model is None or self.scaler is None:
            return []
        feature_arr = np.array(features, dtype=np.float32)
        normalized = (feature_arr - self.scaler.mean_) / (self.scaler.scale_ + 1e-9)
        contributions = self._importances * np.abs(normalized)
        result = []
        for i, fname in enumerate(FEATURE_NAMES):
            result.append({
                "name": fname,
                "label": FEATURE_LABELS.get(fname, fname),
                "value": round(float(features[i]), 4),
                "importance": round(float(self._importances[i]), 4),
                "contribution": round(float(contributions[i]), 4),
                "explanation": FEATURE_EXPLANATIONS.get(fname, fname),
            })
        result.sort(key=lambda x: x["contribution"], reverse=True)
        return result

    def save(self, path: Path = MODEL_CACHE) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({
                "model": self.model,
                "scaler": self.scaler,
                "importances": self._importances,
            }, f)

    def load(self, path: Path = MODEL_CACHE) -> bool:
        if not path.exists():
            return False
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.model = data["model"]
        self.scaler = data["scaler"]
        self._importances = data["importances"]
        return True
