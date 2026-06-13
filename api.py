"""
Sanctions Screener REST API

POST /screen   — screen a payment instruction
GET  /health   — liveness + entity count
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

from sanctions_screener import SanctionsScreener


# ---------------------------------------------------------------------------
# Lifespan: load OFAC data once at startup
# ---------------------------------------------------------------------------

_screener: SanctionsScreener | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _screener
    _screener = SanctionsScreener()
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


@app.get("/health")
def health() -> dict:
    if _screener is None:
        raise HTTPException(status_code=503, detail="Screener not yet initialised.")
    return {
        "status": "ok",
        "entities": len(_screener.entities),
        "crypto_addresses": len(_screener._crypto_index),
    }
