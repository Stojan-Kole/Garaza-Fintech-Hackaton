# SanctionScreen — Full Architecture Reference

This document explains every component of the system: what it does, how it works,
and how the pieces connect. There are three independent but integrated modules:

1. **Sanctions Screening** — real-time name/wallet matching against the OFAC SDN list
2. **AML Transaction Analysis** — rule-based risk scoring for payment transactions
3. **Temporal Risk Prediction** — machine learning model that identifies entities
   exhibiting pre-blacklist behavioral patterns before they are officially sanctioned

---

## Table of Contents

- [How to Run](#how-to-run)
- [Repository Layout](#repository-layout)
- [Module 1: Sanctions Screening](#module-1-sanctions-screening)
- [Module 2: AML Transaction Analysis](#module-2-aml-transaction-analysis)
- [Module 3: Temporal Risk Prediction](#module-3-temporal-risk-prediction)
- [API Reference](#api-reference)
- [Frontend UI](#frontend-ui)
- [Data Flow Diagrams](#data-flow-diagrams)

---

## How to Run

```bash
# Backend (terminal 1)
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# Frontend (terminal 2)
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

First backend start downloads the OFAC SDN XML (~30 MB) and trains the
temporal model (~10–15 seconds). Both are cached; subsequent starts are instant.

---

## Repository Layout

```
sanctions-screener/
│
├── api.py                          # FastAPI application — all HTTP endpoints
├── requirements.txt
│
├── sanctions_screener/             # Python package
│   ├── __init__.py                 # exposes SanctionsScreener
│   ├── loader.py                   # OFAC XML download + parse
│   ├── normalize.py                # Unicode normalization + transliteration
│   ├── matcher.py                  # Jaro-Winkler + Metaphone scoring
│   ├── screener.py                 # Orchestrator — builds API response
│   ├── aml_rules.py                # 10 AML risk rules
│   │
│   └── temporal/                   # Temporal risk prediction module
│       ├── __init__.py
│       ├── data_generator.py       # Synthetic dataset (1000 persons, 500 companies, 9 years)
│       ├── graph.py                # NetworkX graphs + precomputed metrics
│       ├── features.py             # 17 features per entity per year
│       ├── model.py                # Random Forest model + explanations
│       └── engine.py               # TemporalRiskEngine — ties it all together
│
├── .cache/
│   ├── sdn.xml                     # Cached OFAC data
│   └── temporal_model.pkl          # Trained Random Forest + scaler
│
└── frontend/
    └── src/
        ├── App.jsx                 # Root — mode toggle, layout routing
        ├── api.js                  # fetch wrappers for all endpoints
        └── components/
            ├── Header.jsx          # Top bar + Sanctions / Temporal Risk toggle
            ├── ScreeningForm.jsx   # Fiat / crypto / AML input form
            ├── VerdictBanner.jsx   # MATCH / REVIEW / NO_MATCH result header
            ├── AnalysisLayers.jsx  # Pipeline accordion (normalization → verdict)
            ├── CandidatesPanel.jsx # Top 3 SDN candidates
            ├── EntityDetails.jsx   # Selected entity detail (programs, aliases, crypto)
            ├── AmendmentPanel.jsx  # Analyst override with audit trail
            ├── SessionHistory.jsx  # Last 30 screenings in sidebar
            ├── AMLFlagsPanel.jsx   # AML rules triggered / clear display
            ├── GraphIntelligencePanel.jsx  # Ownership graph visualisation
            ├── TemporalForm.jsx    # Entity search + watchlist mode
            ├── TemporalRiskPanel.jsx       # Risk score, history chart, explanations
            └── WatchlistPanel.jsx  # Ranked list of high-risk entities
```

---

## Module 1: Sanctions Screening

### What it does

Screens a name (fiat payment) or wallet address (crypto payment) against the
OFAC Specially Designated Nationals (SDN) list and returns a verdict:

| Verdict | Threshold | Meaning |
|---------|-----------|---------|
| **MATCH** | score ≥ 0.92 | High-confidence hit — block automatically |
| **REVIEW** | 0.78 ≤ score < 0.92 | Plausible match — route to analyst |
| **NO_MATCH** | score < 0.78 | No sanctions exposure detected |

### Data source: `loader.py`

`sdn.xml` is downloaded from OFAC's public API on first start and cached locally.
The parser reads every `<sdnEntry>` and builds a `SanctionedEntity` dataclass:

```python
@dataclass
class SanctionedEntity:
    uid: str                              # OFAC internal ID
    name: str                             # Primary canonical name
    all_names: list[str]                  # Primary + all aka/fka aliases
    entity_type: str                      # Individual / Entity / Vessel / Aircraft
    programs: list[str]                   # e.g. UKRAINE-EO13661, IRAN, SDGT
    countries: list[str]                  # From address records
    crypto_addresses: dict[str, list[str]] # {"XBT": ["1abc..."], "ETH": [...]}
```

The dataset currently contains ~12,000 designated persons and entities.
Every entity can have dozens of aliases (spelling variants, transliterations,
former names) — all are indexed for matching.

### Normalization pipeline: `normalize.py`

Before any comparison, both the query name and every SDN alias go through the
same four-step pipeline so they land in a comparable form:

```
Raw input
  → NFKC Unicode normalization   (decomposes composed characters)
  → lowercase
  → unidecode transliteration    (Cyrillic, Arabic, CJK, Hebrew → Latin)
  → strip punctuation and extra spaces
```

Example:
```
"Сергей Иванов"  →  "sergei ivanov"
"محمد الراشد"   →  "mhmd alrashd"     (Arabic transliteration is approximate)
"王伟"           →  "wang wei"
```

The `name_steps()` function returns each intermediate step, which the frontend
displays in the Analysis Layers accordion so analysts can see exactly what happened.

### Scoring: `matcher.py`

Each normalized query is scored against every normalized alias in the SDN list.
The score has two components:

**String similarity (weight 0.70) — Token-sort Jaro-Winkler**

Tokens in both strings are alphabetically sorted before comparison.
This means "IVANOV SERGEI" and "SERGEI IVANOV" score identically.
Jaro-Winkler gives extra credit for common prefixes, which helps with
names that differ only at the end (Sergei vs Sergey).

**Phonetic similarity (weight 0.30) — Metaphone Jaccard overlap**

Each token is converted to its Metaphone code (a phonetic fingerprint).
The score is the Jaccard overlap: `|intersection| / |union|` of code sets.
This is why Mohammed, Muhammad, and Mohamed all match — they share the
same Metaphone code `MHM`.

**Combined score:**
```
raw_score = 0.70 × string_sim + 0.30 × phonetic_sim
```

**Country signal adjustment:**
```
final_score = raw_score + 0.05   (if query country matches entity country)
final_score = raw_score - 0.10   (if query country conflicts with entity country)
final_score = raw_score          (if country unknown or not provided)
```

The adjustment lets country context push borderline cases across thresholds.
A name scoring 0.90 (REVIEW) in a confirmed-match country becomes 0.95 (MATCH).
A name scoring 0.94 (MATCH) in a conflicting country drops to 0.84 (REVIEW).

### Crypto screening

Wallet addresses are exact-matched against a pre-built dictionary indexed at startup.
`normalize.address()` lowercases the input; the dictionary is keyed by lowercased address.
An exact hit always returns MATCH with score 1.0.
There is no fuzzy matching for addresses — they are cryptographic hashes,
so any difference means a different address entirely.

### Orchestration: `screener.py`

`SanctionsScreener.screen()` calls `find_name_matches()` which returns up to 3
candidates sorted by final score. The top candidate determines the verdict.
`_build_analysis_layers()` serializes every step of the pipeline into a list of
dicts that the frontend renders as an interactive accordion.

---

## Module 2: AML Transaction Analysis

### What it does

Evaluates a payment transaction against 10 Anti-Money Laundering rules and
returns an AML risk score (0–100) with each rule's result.

### Endpoint

`POST /analyze` accepts a `TransactionRequest` with optional fields:
- `sender_name`, `receiver_name`, `sender_country`, `receiver_country`
- `amount`, `currency`
- `transaction_timestamp`, `account_age_days`
- `business_type`, `local_offset_hours`
- `sender_tx_count_24h`, `recent_transactions` (list of past transactions)

### The 10 rules: `aml_rules.py`

| # | Rule | Severity | What it checks |
|---|------|----------|----------------|
| 1 | **Sanctions Hit** | HIGH | Runs sender and receiver through the OFAC screener. Triggers on MATCH or REVIEW verdict. |
| 2 | **High-Risk Jurisdiction** | HIGH | Sender or receiver country is on the FATF blacklist / OFAC country programs (Iran, Russia, North Korea, Syria, etc.). |
| 3 | **Round Number Transaction** | MEDIUM | Amount is exactly $10,000, $50,000, or $100,000 — classic structuring to hover at CTR thresholds. |
| 4 | **Threshold Proximity (Smurfing)** | MEDIUM | Amount is between $9,000 and $9,999.99 — just below the $10,000 Currency Transaction Report threshold. |
| 5 | **PEP Detection** | HIGH | Sender or receiver name contains PEP title keywords (minister, senator, governor, etc.) or matches a known PEP database. |
| 6 | **Unusual Velocity** | MEDIUM | The same sender has ≥5 transactions in the past 24 hours — possible layering or coordinated fraud. |
| 7 | **Business Type Mismatch** | MEDIUM | Transaction amount far exceeds the typical cap for the declared business type (e.g., a hair salon sending $500,000). |
| 8 | **Circular Transactions** | HIGH | BFS detects a cycle in the transaction graph: A → B → C → A pattern (classic layering). |
| 9 | **Unusual Transaction Hours** | LOW | Transaction time is outside 06:00–22:00 in the sender's local timezone. |
| 10 | **New Account + Large Transfer** | MEDIUM | Account is less than 30 days old and is sending more than $10,000 — common fraud or money mule pattern. |

### Risk score calculation

```python
weights = {"HIGH": 30, "MEDIUM": 15, "LOW": 5}
score = min(100, sum(weight for each triggered rule))
```

| Score | Level |
|-------|-------|
| 0 | NO_RISK |
| 1–20 | LOW |
| 21–50 | MEDIUM |
| 51–75 | HIGH |
| 76–100 | CRITICAL |

---

## Module 3: Temporal Risk Prediction

### Purpose and key idea

A sanctions list is always reactive — it captures entities *after* they are
designated. This module tries to be proactive: it identifies entities that
*behave like* entities that were later sanctioned, before any official designation.

The output is an **Emerging Risk Score** (0–100). It is not a legal determination.
It is a statistical similarity measure: how closely does this entity's current
ownership graph behavior resemble the patterns observed in entities 1–2 years
before they appeared on a sanctions list?

### Synthetic dataset: `data_generator.py`

Because real pre-sanction behavioral data is not publicly available, the model
is trained on a realistic synthetic dataset:

- **1,000 persons** — names drawn from Russian, Arabic, Chinese, Western European,
  and Balkan name pools; random nationalities including high-risk countries
- **500 companies** — random industry, country, ~25% flagged as shell companies
- **9 years of history** — 2016 through 2024
- **~12% of entities eventually get blacklisted** — spread across 2018–2024

Each year's snapshot contains: persons, companies, ownership relationships,
and the cumulative blacklist up to that year.

**The critical behavioral pattern** is baked into the generator:
1–2 years before an entity gets blacklisted, it is given ownership connections
to entities that are *already* on the blacklist. This creates a training signal
the model can learn: "entities that start acquiring connections to sanctioned
entities are at elevated risk."

On top of that, ~3% of ownership relationships randomly change each year
(additions, removals, percentage adjustments) to simulate realistic corporate churn.

### Temporal graph construction: `graph.py`

For each year, a `networkx.DiGraph` is built where:
- **Nodes** are persons and companies, with attributes: `entity_type`, `name`, `blacklisted`
- **Directed edges** represent ownership: `owner_id → target_id`, with `percentage` attribute

Alongside each graph, a `GraphMetrics` object is precomputed to make
feature extraction fast:

| Metric | How computed | Purpose |
|--------|-------------|---------|
| `betweenness` | `nx.betweenness_centrality(k=30)` — 30-pivot approximation | How central is this node in the network? |
| `dist_to_blacklist` | Multi-source BFS from all blacklisted nodes simultaneously | Shortest distance from any node to the nearest blacklisted entity |
| `bl_neighbor_count` | Iteration over adjacency list | How many direct neighbors are blacklisted? |
| `undirected_adj` | Pre-built adjacency sets | Fast O(1) neighbor lookups during feature extraction |

The multi-source BFS is key to performance: instead of running a separate BFS
from each entity to find the nearest blacklisted node (O(V) operations × O(V+E) each),
a single BFS from all blacklisted sources simultaneously computes all distances in O(V+E).

### Feature extraction: `features.py`

For every (entity, year) pair, 17 numerical features are computed:

**Identity features**
| Feature | Description |
|---------|-------------|
| `alias_count` | Number of registered aliases for this entity |
| `name_sim_to_blacklist` | Maximum Jaro-Winkler similarity of this entity's name against all blacklisted entity names in the same year |

**Graph features**
| Feature | Description |
|---------|-------------|
| `graph_degree` | Total number of edges (ownership relationships) in the undirected graph |
| `betweenness_centrality` | How often this node lies on shortest paths between other nodes — measures structural importance |
| `shortest_path_to_blacklisted` | Distance to the nearest blacklisted entity (MAX=10 if unreachable) |
| `blacklisted_neighbors` | Count of direct neighbors that are blacklisted |
| `paths_to_blacklisted` | Approximate count of distinct paths that lead to blacklisted entities (capped at 15) |

**Ownership features**
| Feature | Description |
|---------|-------------|
| `owned_companies_count` | Number of companies this entity directly owns (out-edges in the directed graph) |
| `ownership_chain_depth` | Length of the longest ownership chain starting from this entity |
| `ownership_changes_last_year` | Symmetric difference between this year's and last year's ownership targets |

**Temporal features**
| Feature | Description |
|---------|-------------|
| `new_connections_last_year` | Neighbors present this year but not last year |
| `ownership_growth_rate` | `(current_owned - prior_owned) / prior_owned` |
| `structure_change_rate` | Ownership changes normalized by total ownership relationships |

**Risk exposure features**
| Feature | Description |
|---------|-------------|
| `direct_blacklist_exposure` | 1.0 if this entity is currently on the blacklist |
| `indirect_blacklist_exposure` | 1.0 if any direct neighbor is blacklisted |
| `propagated_graph_risk` | Exponential decay score: `e^(-(distance-1))` — gives 1.0 at distance 0, ~0.37 at distance 2, ~0.14 at distance 3 |
| `high_risk_country` | 1.0 if nationality or registered country is in the FATF high-risk list |

### Training dataset generation

The dataset is assembled by iterating over every entity × every year (except the last):

```
For year Y in [2016 .. 2023]:
  For each entity E:
    label = 1  if E becomes blacklisted in year Y+1 and was NOT blacklisted in year Y
    label = 0  otherwise
    features = extract_features(E, year=Y)
```

This produces 12,000 training samples (8 years × 1,500 entities).
Positive samples (~1.5%) represent entities in the year just before designation —
the "pre-blacklist pattern." The model learns to recognize these patterns
in entities that are not yet designated.

### Model: `model.py`

**Algorithm:** `scikit-learn RandomForestClassifier`

```python
RandomForestClassifier(
    n_estimators=150,
    max_depth=8,
    min_samples_leaf=4,
    class_weight="balanced",  # compensates for the ~1.5% positive rate
    random_state=42,
)
```

Features are standardized with `StandardScaler` before training.

**Why Random Forest?**
- Handles mixed feature types (binary flags, counts, floats) without scaling issues
- `class_weight="balanced"` handles the severe class imbalance without oversampling
- Feature importances are available natively for explanation
- Fast inference (~milliseconds per prediction)
- No hyperparameter tuning required to produce meaningful results

**Output:**
```
risk_score = model.predict_proba(features)[positive_class] × 100
```

**Explanations** are generated by computing per-feature contributions:
```
contribution[i] = feature_importance[i] × |normalized_feature_value[i]|
```

The top contributing features with positive values map to human-readable
strings via `FEATURE_EXPLANATIONS`. For example, a high `blacklisted_neighbors`
contribution produces: *"Direct connections to sanctioned entities."*

**Model persistence:** Trained weights are saved to `.cache/temporal_model.pkl`
and loaded on subsequent starts. Force retrain by deleting that file.

### Risk levels

| Score | Level |
|-------|-------|
| 0–14 | LOW |
| 15–34 | ELEVATED |
| 35–59 | HIGH |
| 60–79 | VERY_HIGH |
| 80–100 | CRITICAL |

### Engine: `engine.py`

`TemporalRiskEngine` is the top-level object initialized at API startup:

1. `generate_dataset()` — builds 9-year synthetic snapshot
2. `build_temporal_graphs()` — builds NetworkX graphs + GraphMetrics for each year
3. `predictor.load()` — loads cached model, or trains from scratch if missing
4. On prediction: extracts features for the queried entity at the latest year,
   runs predict(), computes history by running predict() across all 9 years

The three public methods used by the API:
- `predict_by_id(entity_id)` — full risk profile with history, explanations, feature breakdown
- `search(query, top_k)` — fuzzy name search using Jaro-Winkler (threshold 0.55)
- `get_high_risk_entities(limit)` — pre-scored watchlist of non-blacklisted entities sorted by risk

---

## API Reference

All endpoints are served at `http://localhost:8000`.

### Sanctions Screening

#### `POST /screen`
Screen a payment counterparty against OFAC SDN.

Request:
```json
{ "name": "Sergei Ivanov", "country": "RU" }
// or
{ "wallet_address": "1FzWLkAahHooV3kzTgyx6qsswXJ6sCXkSR" }
```

Response: `ScreeningResponse`
```json
{
  "verdict": "MATCH",
  "score": 0.97,
  "matched_entity": "IVANOV, Sergei Borisovich",
  "matched_alias": "IVANOV Sergei",
  "programs": ["UKRAINE-EO13661"],
  "country_signal": "confirmed",
  "reason": "High-confidence hit: ...",
  "top_candidates": [ /* up to 3 enriched candidate dicts */ ],
  "screening_type": "fiat",
  "normalized_query": "sergei ivanov",
  "analysis_layers": [ /* ordered pipeline steps */ ]
}
```

### AML Analysis

#### `POST /analyze`
Run 10 AML rules against a transaction.

Request: `TransactionRequest` (all fields optional — provide what you have)
```json
{
  "sender_name": "John Smith",
  "receiver_name": "Vladimir Putin",
  "amount": 9500,
  "sender_country": "US",
  "receiver_country": "RU",
  "transaction_timestamp": "2024-03-15T02:30:00Z",
  "account_age_days": 12
}
```

Response: `AnalysisResponse`
```json
{
  "aml_flags": [
    {
      "rule_id": 1,
      "rule_name": "Sanctions Hit",
      "severity": "HIGH",
      "triggered": true,
      "description": "...",
      "details": { "hits": [...] }
    }
  ],
  "triggered_count": 4,
  "total_rules": 10,
  "risk_score": 75.0,
  "risk_level": "HIGH"
}
```

### Temporal Risk Prediction

#### `POST /temporal/analyze`
Search for an entity by name and return full risk profile.

Request:
```json
{ "entity_name": "Vladimir Petrov", "top_k": 5 }
```

Response: `TemporalAnalyzeResponse`
```json
{
  "entity_id": "P0123",
  "entity_name": "Vladimir Petrov",
  "entity_type": "person",
  "current_year": 2024,
  "blacklisted": false,
  "direct_blacklist_match": null,
  "blacklisted_neighbors": [],
  "risk_score": 68.4,
  "risk_level": "HIGH",
  "reasons": [
    "High ownership proximity to sanctioned entities",
    "Direct connections to sanctioned entities",
    "Multiple ownership structure changes"
  ],
  "history": {
    "2016": 5.2, "2017": 8.1, "2018": 12.3, "2019": 24.7,
    "2020": 41.0, "2021": 55.3, "2022": 63.1, "2023": 67.9, "2024": 68.4
  },
  "feature_breakdown": [
    { "name": "blacklisted_neighbors", "value": 3, "importance": 0.18, "contribution": 0.21, "explanation": "Direct connections to sanctioned entities" },
    ...
  ],
  "search_candidates": [ /* other fuzzy matches */ ]
}
```

#### `GET /temporal/watchlist?limit=50`
Returns non-blacklisted entities ranked by risk score.

```json
[
  { "id": "P0042", "name": "Konstantin Orlov", "type": "person", "risk_score": 97.8, "risk_level": "CRITICAL" },
  ...
]
```

#### `GET /temporal/search?q=ivanov&top_k=10`
Fuzzy name search only (no prediction).

### Health

#### `GET /health`
```json
{ "status": "ok", "entities": 12483, "crypto_addresses": 847 }
```

---

## Frontend UI

The UI is built with React + Vite + Tailwind CSS. Dark mode only.
Vite proxies all API calls to `localhost:8000`.

### Layout

Three-panel grid: `288px sidebar | flex main | 352px right panel`

A mode toggle in the header switches between two top-level views:
**Sanctions** (OFAC screening + AML) and **Temporal Risk** (ML prediction).

### Sanctions mode

**Left panel:** `ScreeningForm` — fiat/crypto/AML toggle, input fields, submit.
Below that: `SessionHistory` — last 30 screenings, click to restore.

**Main panel:**
- `VerdictBanner` — full-width colored header (red=MATCH, amber=REVIEW, green=CLEAR)
  with score bar, programs, reason text
- `AnalysisLayers` — accordion showing every step of the pipeline
  (normalization input/output, string similarity score, phonetic codes, country signal,
  final verdict with thresholds)
- `CandidatesPanel` — top 3 SDN candidates with score breakdowns, click to select
- `AMLFlagsPanel` — shown instead of the above when in AML mode:
  triggered rules (colored by severity), clear rules (dimmed), rule detail cards

**Right panel:**
- `EntityDetails` — canonical name, OFAC UID (linked to ofac.gov), all aliases,
  sanctions programs (linked to regulatory descriptions), crypto wallet addresses
- `AmendmentPanel` — analyst override form: change verdict, mandatory reason,
  analyst ID, optional notes. Amendments persist in session history.
- AML mode: rule weight legend (HIGH=30pts, MEDIUM=15pts, LOW=5pts)

### Temporal Risk mode

**Left panel:** `TemporalForm` — toggle between entity search and watchlist mode.

**Main panel:**
- Empty state with feature description
- `WatchlistPanel` — when watchlist mode selected: ranked list of high-risk entities
  with mini score bars, click any to analyze
- `TemporalRiskPanel` — after analysis:
  - Entity name, type, blacklist badge (if applicable)
  - Emerging Risk Score with color-coded bar
  - Blacklist exposure section (direct + connected neighbors)
  - Risk factors list (top explanations from model)
  - Year-by-year bar chart (2016–2024) with hover tooltips
  - Feature contributions (expandable list of all 17 features)
  - Alternate search candidates

**Right panel:** Score methodology explanation — which feature categories feed
the model and a disclaimer that the score is not a legal prediction.

---

## Data Flow Diagrams

### Sanctions screening flow

```
POST /screen { name, country }
        │
        ▼
   normalize.name()
   NFKC → lowercase → unidecode → strip punct
        │
        ▼
   find_name_matches()
   For each SDN entity × alias:
     string_sim  = token_sort_jaro_winkler(query, alias)     × 0.70
     phonetic_sim = metaphone_jaccard(query, alias)           × 0.30
     raw_score   = string_sim + phonetic_sim
     final_score = raw_score ± country_signal_adjustment
        │
        ▼
   Sort by final_score, take top 3
        │
        ▼
   Verdict = MATCH / REVIEW / NO_MATCH (by threshold)
        │
        ▼
   _build_analysis_layers()   ← serialises every step for UI
        │
        ▼
   ScreeningResponse → frontend
```

### Temporal risk flow

```
POST /temporal/analyze { entity_name }
        │
        ▼
   _temporal.search(entity_name)
   Jaro-Winkler against 1500 synthetic entities → top match
        │
        ▼
   _temporal.predict_by_id(entity_id)
        │
        ├── For each year 2016..2024:
        │     extract_features(entity, year)
        │       → GraphMetrics lookup (O(1) dist, degree, betweenness)
        │       → Ownership diff vs prior year
        │       → name_sim_to_blacklist (jaro-winkler vs blacklisted names)
        │     predictor.predict(features)
        │       → StandardScaler transform
        │       → RandomForest.predict_proba → risk_score
        │     → history[year] = score
        │
        └── Latest year: full prediction
              predictor.predict(features) → (risk_score, reasons)
              predictor.feature_breakdown() → per-feature contributions
        │
        ▼
   TemporalAnalyzeResponse → frontend
   { risk_score, risk_level, reasons, history, feature_breakdown }
```

### AML analysis flow

```
POST /analyze { sender_name, amount, ... }
        │
        ▼
   run_all_rules()
   Runs 10 independent checks in sequence:
     Rule 1: screener.screen(sender_name), screener.screen(receiver_name)
     Rule 2: country in HIGH_RISK_ISO set?
     Rule 3: amount in {10000, 50000, 100000}?
     Rule 4: 9000 ≤ amount ≤ 9999.99?
     Rule 5: name contains PEP keywords or known PEP?
     Rule 6: count transactions by sender in past 24h ≥ 5?
     Rule 7: amount > business type cap?
     Rule 8: BFS cycle detection in transaction graph?
     Rule 9: local_hour < 6 or ≥ 22?
     Rule 10: account_age_days < 30 AND amount > 10000?
        │
        ▼
   compute_risk_score(flags)
   score = Σ(weight × triggered) capped at 100
        │
        ▼
   AnalysisResponse → frontend
```

---

## Important Caveats

**Sanctions screening:**
- OFAC SDN only. EU Consolidated List, UN List, UK HMT are not included.
- Crypto screening is exact-match only. Indirect exposure via mixer/hop requires
  blockchain analytics (Chainalysis, TRM Labs).
- Transliteration of Arabic and CJK is lossy. The phonetic layer compensates
  partially but unusual transliterations can still be missed.
- Thresholds (0.92 / 0.78) are calibrated for low false-negative rate.
  Adjust them based on your labeled validation data and risk tolerance.

**AML rules:**
- Rule-based systems generate false positives by design — they are conservative.
  An analyst review step for MEDIUM/HIGH flags is expected.
- Velocity and circular transaction rules require historical transaction data
  to be passed in the request. Without it, those rules do not trigger.

**Temporal risk prediction:**
- Trained entirely on synthetic data. Scores reflect similarity to patterns
  in generated data, not real-world intelligence.
- This is **not** a legal prediction, a sanctions determination, or investment advice.
- The model is intentionally lightweight (Random Forest on 17 features) to stay
  interpretable and fast. A production system would incorporate real historical
  designation data, more features, and rigorous calibration.
- The "emerging risk" framing is educational. Operational use would require
  legal review, compliance officer sign-off, and regulatory guidance.
