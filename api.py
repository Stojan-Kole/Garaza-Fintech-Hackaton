"""
Temporal Risk Prediction API
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sanctions_screener.temporal import TemporalRiskEngine


_temporal: TemporalRiskEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _temporal
    _temporal = TemporalRiskEngine()
    _temporal.initialize()
    yield


app = FastAPI(
    title="Temporal Risk Prediction",
    description="Predicts emerging sanctions risk based on ownership graph patterns.",
    version="0.3.0",
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


@app.get("/")
def root():
    return {"status": "running"}


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
def temporal_watchlist(limit: int = 50, view: str = "top") -> list:
    if _temporal is None:
        raise HTTPException(status_code=503, detail="Temporal engine not initialised.")
    return _temporal.get_high_risk_entities(limit=limit, view=view)


@app.get("/temporal/search")
def temporal_search(q: str, top_k: int = 10) -> list:
    if _temporal is None:
        raise HTTPException(status_code=503, detail="Temporal engine not initialised.")
    return _temporal.search(q, top_k=top_k)


@app.get("/health")
def health() -> dict:
    if _temporal is None:
        raise HTTPException(status_code=503, detail="Temporal engine not initialised.")
    return {
        "status": "ok",
        "entities": len(_temporal._entity_index),
    }
