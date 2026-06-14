"""
TemporalRiskEngine — orchestrates data generation, graph construction,
feature extraction, model training, and risk prediction.
"""
from __future__ import annotations
import numpy as np
from jellyfish import jaro_winkler_similarity

from .data_generator import YearSnapshot, generate_dataset, YEARS
from .graph import build_temporal_graphs, GraphMetrics
from .features import extract_features, FEATURE_NAMES
from .model import RiskPredictor


class TemporalRiskEngine:
    def __init__(self):
        self.snapshots: dict = {}
        self.graphs: dict = {}
        self.metrics: dict = {}
        self.predictor = RiskPredictor()
        self._entity_index: dict = {}       # id -> name
        self._id_to_type: dict = {}         # id -> person|company
        self._watchlist_cache: list = []    # pre-scored at startup
        self._initialized = False

    def initialize(self, force_retrain: bool = False) -> None:
        print("[Temporal] Generating synthetic dataset...")
        self.snapshots = generate_dataset()

        print("[Temporal] Building temporal graphs...")
        self.graphs, self.metrics = build_temporal_graphs(self.snapshots)

        latest_snap = self.snapshots[max(self.snapshots)]
        for p in latest_snap.persons:
            self._entity_index[p.id] = p.name
            self._id_to_type[p.id] = "person"
        for c in latest_snap.companies:
            self._entity_index[c.id] = c.name
            self._id_to_type[c.id] = "company"

        if not force_retrain and self.predictor.load():
            print("[Temporal] Loaded cached model.")
            self._initialized = True
            print("[Temporal] Pre-scoring watchlist...")
            self._watchlist_cache = self._score_all_entities()
            print(f"[Temporal] Watchlist ready: {len(self._watchlist_cache)} entities.")
            return

        print("[Temporal] Extracting features and training model...")
        X, y = self._build_training_data()
        pos = int(y.sum())
        print(f"[Temporal] Training on {len(y)} samples ({pos} positive, {len(y)-pos} negative)...")
        self.predictor.train(X, y)
        self.predictor.save()
        print("[Temporal] Model trained and cached.")
        self._initialized = True

        print("[Temporal] Pre-scoring watchlist...")
        self._watchlist_cache = self._score_all_entities()
        print(f"[Temporal] Watchlist ready: {len(self._watchlist_cache)} entities.")

    def _build_training_data(self) -> tuple:
        years = sorted(self.snapshots.keys())
        X_rows, y_rows = [], []

        for i, year in enumerate(years[:-1]):
            snap = self.snapshots[year]
            next_snap = self.snapshots[years[i + 1]]
            prev_snap = self.snapshots[years[i - 1]] if i > 0 else None
            G = self.graphs[year]
            m = self.metrics[year]
            prev_m = self.metrics[years[i - 1]] if i > 0 else None

            all_entities = (
                [(p.id, p.name) for p in snap.persons] +
                [(c.id, c.name) for c in snap.companies]
            )
            for eid, ename in all_entities:
                label = 1 if (eid in next_snap.blacklist and eid not in snap.blacklist) else 0
                feats = extract_features(eid, ename, snap, G, m, prev_snap, prev_m)
                X_rows.append(feats)
                y_rows.append(label)

        return np.array(X_rows, dtype=np.float32), np.array(y_rows, dtype=np.int32)

    def _get_features_for_year(self, entity_id: str, year: int) -> list:
        years = sorted(self.snapshots.keys())
        i = years.index(year)
        snap = self.snapshots[year]
        G = self.graphs[year]
        m = self.metrics[year]
        prev_snap = self.snapshots[years[i - 1]] if i > 0 else None
        prev_m = self.metrics[years[i - 1]] if i > 0 else None
        ename = self._entity_index.get(entity_id, "Unknown")
        return extract_features(entity_id, ename, snap, G, m, prev_snap, prev_m)

    def predict_by_id(self, entity_id: str) -> dict:
        if not self._initialized:
            raise RuntimeError("Engine not initialized.")

        years = sorted(self.snapshots.keys())
        history = {}
        for year in years:
            feats = self._get_features_for_year(entity_id, year)
            score, _ = self.predictor.predict(feats)
            history[year] = score

        latest_year = years[-1]
        latest_snap = self.snapshots[latest_year]
        latest_feats = self._get_features_for_year(entity_id, latest_year)
        risk_score, reasons = self.predictor.predict(latest_feats)
        breakdown = self.predictor.feature_breakdown(latest_feats)

        blacklisted = entity_id in latest_snap.blacklist
        undirected_adj = self.metrics[latest_year].undirected_adj
        neighbors = undirected_adj.get(entity_id, set())
        bl_neighbors = [
            {"id": n, "name": self._entity_index.get(n, n),
             "type": self._id_to_type.get(n, "unknown")}
            for n in neighbors if n in latest_snap.blacklist
        ][:5]

        ename = self._entity_index.get(entity_id, "Unknown")
        return {
            "entity_id": entity_id,
            "entity_name": ename,
            "entity_type": self._id_to_type.get(entity_id, "unknown"),
            "current_year": latest_year,
            "blacklisted": blacklisted,
            "direct_blacklist_match": ename if blacklisted else None,
            "blacklisted_neighbors": bl_neighbors,
            "risk_score": risk_score,
            "risk_level": _risk_level(risk_score),
            "reasons": reasons,
            "history": history,
            "feature_breakdown": breakdown,
        }

    def search(self, query: str, top_k: int = 10) -> list:
        query_lower = query.lower()
        scored = []
        for eid, ename in self._entity_index.items():
            score = jaro_winkler_similarity(query_lower, ename.lower())
            if score >= 0.55:
                scored.append((score, eid, ename))
        scored.sort(reverse=True)
        results = []
        for s, eid, ename in scored[:top_k]:
            latest_snap = self.snapshots[max(self.snapshots)]
            results.append({
                "id": eid,
                "name": ename,
                "type": self._id_to_type.get(eid, "unknown"),
                "blacklisted": eid in latest_snap.blacklist,
                "match_score": round(s, 3),
            })
        return results

    def _score_all_entities(self) -> list:
        """Score every non-blacklisted entity at current + previous year. Called once at startup."""
        years = sorted(self.snapshots.keys())
        latest_year = years[-1]
        prev_year = years[-2]
        latest_snap = self.snapshots[latest_year]

        result = []
        for eid in self._entity_index:
            if eid in latest_snap.blacklist:
                continue
            feats = self._get_features_for_year(eid, latest_year)
            score, _ = self.predictor.predict(feats)
            prev_feats = self._get_features_for_year(eid, prev_year)
            prev_score, _ = self.predictor.predict(prev_feats)
            result.append({
                "id": eid,
                "name": self._entity_index[eid],
                "type": self._id_to_type.get(eid, "unknown"),
                "risk_score": round(score, 1),
                "risk_level": _risk_level(score),
                "prev_score": round(prev_score, 1),
                "score_delta": round(score - prev_score, 1),
            })
        return result

    def get_high_risk_entities(self, limit: int = 50, view: str = "top") -> list:
        data = self._watchlist_cache
        if view == "top":
            filtered = sorted(
                (e for e in data if e["risk_score"] >= 20),
                key=lambda x: x["risk_score"], reverse=True,
            )
        elif view == "rising":
            filtered = sorted(
                (e for e in data if e["score_delta"] > 0),
                key=lambda x: x["score_delta"], reverse=True,
            )
        elif view == "critical_edge":
            filtered = sorted(
                (e for e in data if 60 <= e["risk_score"] < 80),
                key=lambda x: x["risk_score"], reverse=True,
            )
        elif view == "name":
            filtered = sorted(
                (e for e in data if e["risk_score"] >= 20),
                key=lambda x: x["name"],
            )
        elif view == "declining":
            filtered = sorted(
                (e for e in data if e["score_delta"] < 0),
                key=lambda x: x["score_delta"],
            )
        else:
            filtered = sorted(data, key=lambda x: x["risk_score"], reverse=True)
        return filtered[:limit]


def _risk_level(score: float) -> str:
    if score < 15:
        return "LOW"
    if score < 35:
        return "ELEVATED"
    if score < 60:
        return "HIGH"
    if score < 80:
        return "VERY_HIGH"
    return "CRITICAL"
