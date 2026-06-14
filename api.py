"""
Sanctions Screener REST API

POST /screen   — screen a payment instruction
GET  /health   — liveness + entity count
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

from sanctions_screener import SanctionsScreener
from sanctions_screener.aml_rules import compute_risk_score, run_all_rules
from sanctions_screener.temporal import TemporalRiskEngine


# ---------------------------------------------------------------------------
# Lifespan: load OFAC data once at startup
# ---------------------------------------------------------------------------

_screener: SanctionsScreener | None = None
_temporal: TemporalRiskEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _screener, _temporal
    _screener = SanctionsScreener()
    _temporal = TemporalRiskEngine()
    _temporal.initialize()
    yield


app = FastAPI(
    title="Sanctions Screener",
    description=(
        "Screens payment instructions against the OFAC SDN list. "
        "Returns MATCH / REVIEW / NO_MATCH with full analysis-layer transparency."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class PaymentInstruction(BaseModel):
    # Fiat
    name: Optional[str] = None
    country: Optional[str] = None
    # Crypto
    wallet_address: Optional[str] = None

    @model_validator(mode="after")
    def _require_one(self) -> "PaymentInstruction":
        if not self.name and not self.wallet_address:
            raise ValueError("Provide name (fiat) or wallet_address (crypto).")
        return self


class ScreeningResponse(BaseModel):
    verdict: str                        # MATCH | REVIEW | NO_MATCH
    score: float                        # 0.0–1.0 confidence
    matched_entity: Optional[str]
    matched_alias: Optional[str]
    programs: list[str]
    country_signal: str                 # confirmed | conflict | unknown | n/a
    reason: str                         # human-readable explanation
    top_candidates: list[dict]          # up to 3 enriched candidates
    screening_type: str                 # fiat | crypto
    normalized_query: Optional[str]     # normalized form of the query
    analysis_layers: list[dict]         # ordered pipeline stages for UI


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "running"}
@app.post("/screen", response_model=ScreeningResponse)
def screen(payment: PaymentInstruction) -> ScreeningResponse:
    result = _screener.screen(  # type: ignore[union-attr]
        name=payment.name,
        country=payment.country,
        wallet_address=payment.wallet_address,
    )
    return ScreeningResponse(
        verdict=result.verdict,
        score=result.score,
        matched_entity=result.matched_entity,
        matched_alias=result.matched_alias,
        programs=result.programs,
        country_signal=result.country_signal,
        reason=result.reason,
        top_candidates=result.top_candidates,
        screening_type=result.screening_type,
        normalized_query=result.normalized_query,
        analysis_layers=result.analysis_layers,
    )


# ---------------------------------------------------------------------------
# Transaction Analysis — AML rules engine
# ---------------------------------------------------------------------------

class TransactionRequest(BaseModel):
    sender_name: Optional[str] = None
    receiver_name: Optional[str] = None
    sender_country: Optional[str] = None
    receiver_country: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "USD"
    transaction_timestamp: Optional[datetime] = None
    account_age_days: Optional[int] = None
    business_type: Optional[str] = None
    local_offset_hours: int = 0
    sender_tx_count_24h: Optional[int] = None
    recent_transactions: Optional[list[dict]] = None

    @model_validator(mode="after")
    def _require_something(self) -> "TransactionRequest":
        if not self.sender_name and not self.receiver_name and self.amount is None:
            raise ValueError("Provide at least sender_name, receiver_name, or amount.")
        return self


class AMLFlagResponse(BaseModel):
    rule_id: int
    rule_name: str
    severity: str
    triggered: bool
    description: str
    details: dict


class AnalysisResponse(BaseModel):
    aml_flags: list[AMLFlagResponse]
    triggered_count: int
    total_rules: int
    risk_score: float
    risk_level: str


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(tx: TransactionRequest) -> AnalysisResponse:
    def _screen(*, name: str):
        return _screener.screen(name=name)  # type: ignore[union-attr]

    flags = run_all_rules(
        sender_name=tx.sender_name,
        receiver_name=tx.receiver_name,
        sender_country=tx.sender_country,
        receiver_country=tx.receiver_country,
        amount=tx.amount,
        transaction_timestamp=tx.transaction_timestamp,
        account_age_days=tx.account_age_days,
        business_type=tx.business_type,
        local_offset_hours=tx.local_offset_hours,
        recent_transactions=tx.recent_transactions,
        sender_tx_count_24h=tx.sender_tx_count_24h,
        screener_fn=_screen,
    )

    risk_score, risk_level = compute_risk_score(flags)

    return AnalysisResponse(
        aml_flags=[AMLFlagResponse(**f.__dict__) for f in flags],
        triggered_count=sum(1 for f in flags if f.triggered),
        total_rules=len(flags),
        risk_score=risk_score,
        risk_level=risk_level,
    )


# ---------------------------------------------------------------------------
# Temporal Risk Prediction
# ---------------------------------------------------------------------------

class TemporalAnalyzeRequest(BaseModel):
    entity_name: str
    top_k: int = 5


class TemporalAnalyzeResponse(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str
    current_year: int
    blacklisted: bool
    direct_blacklist_match: Optional[str]
    blacklisted_neighbors: list[dict]
    risk_score: float
    risk_level: str
    reasons: list[str]
    history: dict
    feature_breakdown: list[dict]
    search_candidates: list[dict]


@app.post("/temporal/analyze", response_model=TemporalAnalyzeResponse)
def temporal_analyze(req: TemporalAnalyzeRequest) -> TemporalAnalyzeResponse:
    if _temporal is None:
        raise HTTPException(status_code=503, detail="Temporal engine not initialised.")
    candidates = _temporal.search(req.entity_name, top_k=req.top_k)
    if not candidates:
        raise HTTPException(status_code=404, detail=f"No entity found matching '{req.entity_name}'.")
    top = candidates[0]
    result = _temporal.predict_by_id(top["id"])
    result["search_candidates"] = candidates
    return TemporalAnalyzeResponse(**result)


@app.get("/temporal/watchlist")
def temporal_watchlist(limit: int = 50) -> list:
    if _temporal is None:
        raise HTTPException(status_code=503, detail="Temporal engine not initialised.")
    return _temporal.get_high_risk_entities(limit=limit)


@app.get("/temporal/search")
def temporal_search(q: str, top_k: int = 10) -> list:
    if _temporal is None:
        raise HTTPException(status_code=503, detail="Temporal engine not initialised.")
    return _temporal.search(q, top_k=top_k)


@app.get("/health")
def health() -> dict:
    if _screener is None:
        raise HTTPException(status_code=503, detail="Screener not yet initialised.")
    return {
        "status": "ok",
        "entities": len(_screener.entities),
        "crypto_addresses": len(_screener._crypto_index),
    }
