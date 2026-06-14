# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend

```bash
# Install dependencies (use the project venv)
source .venv/bin/activate
pip install -r requirements.txt

# Run the API server (reloads on file changes)
uvicorn api:app --reload --port 8000

# Run the offline demo (no download, synthetic data only)
python demo.py
```

First startup downloads the OFAC SDN XML (~30 MB) to `.cache/sdn.xml` and trains the temporal model (~10–15 s), saving to `.cache/temporal_model.pkl`. Subsequent starts are instant. Delete `.cache/temporal_model.pkl` to force retrain.

### Frontend

```bash
cd frontend
npm install
npm run dev      # → http://localhost:5173
npm run build    # production build
```

Vite proxies all `/screen`, `/analyze`, `/temporal/*`, `/health` requests to `localhost:8000`.

## Architecture

The system has three independent but integrated modules exposed through a single FastAPI app (`api.py`). Both global singletons (`_screener`, `_temporal`) are initialised in the FastAPI lifespan hook at startup.

### Module 1 — Sanctions Screening (`sanctions_screener/`)

Pipeline for each name query: **normalize → score → verdict**.

- `loader.py` — downloads and parses OFAC SDN XML into `SanctionedEntity` dataclasses; builds a crypto address index (`_crypto_index`) keyed by lowercased address.
- `normalize.py` — four-step pipeline: NFKC → lowercase → unidecode (Cyrillic/Arabic/CJK → Latin) → strip punctuation. `name_steps()` returns each intermediate result for UI display.
- `matcher.py` — scores a query against every alias: 70% token-sort Jaro-Winkler + 30% Metaphone Jaccard. Country signal adds ±0.05/0.10.
- `screener.py` — orchestrates the pipeline, builds `analysis_layers` list consumed by the frontend accordion.

Thresholds: MATCH ≥ 0.92 | REVIEW ≥ 0.78 | NO_MATCH < 0.78. Crypto uses exact match only (score 1.0).

### Module 2 — AML Rules Engine (`sanctions_screener/aml_rules.py`)

`run_all_rules()` runs 10 independent checks; `compute_risk_score()` sums weights (HIGH=30, MEDIUM=15, LOW=5, capped at 100). Velocity and circular-transaction rules only fire when `recent_transactions`/`sender_tx_count_24h` are passed in the request.

### Module 3 — Temporal Risk Prediction (`sanctions_screener/temporal/`)

A Random Forest trained on synthetic data to surface entities exhibiting pre-sanction behavioral patterns.

- `data_generator.py` — 1,500 synthetic entities (1,000 persons + 500 companies), 9-year history (2016–2024), ~12% eventually blacklisted; entities acquire connections to blacklisted nodes 1–2 years before designation.
- `graph.py` — builds a `networkx.DiGraph` per year; precomputes `GraphMetrics` (betweenness, multi-source BFS distances to blacklisted nodes, adjacency sets) for fast O(1) feature lookups.
- `features.py` — extracts 17 features per entity per year (identity, graph, ownership, temporal, risk-exposure).
- `model.py` — `RandomForestClassifier(n_estimators=150, max_depth=8, class_weight="balanced")` with `StandardScaler`. Feature importances drive human-readable explanations.
- `engine.py` — `TemporalRiskEngine`: top-level object wiring data generation → graph build → model load/train → `predict_by_id()`, `search()`, `get_high_risk_entities()`.

### Frontend (`frontend/src/`)

React 18 + Vite + Tailwind CSS, dark mode only. Entry point is `App.jsx`; `api.js` wraps all fetch calls.

Two top-level modes toggled in `Header.jsx`:
- **Sanctions mode**: `ScreeningForm` → `VerdictBanner` + `AnalysisLayers` + `CandidatesPanel` + `EntityDetails` + `AmendmentPanel`. AML sub-mode swaps in `AMLFlagsPanel` and a rule-weight legend.
- **Temporal Risk mode**: `TemporalForm` → `TemporalRiskPanel` (score, history bar chart, feature breakdown) + `WatchlistPanel`.

`SessionHistory` persists the last 30 screenings in component state (sidebar, click to restore). `GraphIntelligencePanel` uses `react-force-graph-2d` with data from `mockGraphData.js`.

## Key Design Decisions

- The scoring formula weights and thresholds (0.92/0.78) are in `screener.py` as `MATCH_THRESHOLD` / `REVIEW_THRESHOLD` — calibrate these against labeled data before production use.
- Temporal risk scores are derived entirely from synthetic data and are **not** legal determinations.
- `analysis_layers` in `ScreeningResponse` is the serialised pipeline for the frontend accordion — every step name and intermediate value must stay serialisable to plain dicts.
- AML rules that need historical data (velocity, circular transactions) silently skip when that data is absent rather than erroring.
