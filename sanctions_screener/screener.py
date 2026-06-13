"""
SanctionsScreener: main entry point.
Loads OFAC SDN data once, then screens payment instructions on demand.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

from . import normalize
from .loader import SanctionedEntity, download, parse
from .matcher import NameMatch, find_crypto_match, find_name_matches

Verdict = Literal["MATCH", "REVIEW", "NO_MATCH"]

MATCH_THRESHOLD: float = 0.92
REVIEW_THRESHOLD: float = 0.78


def _verdict(score: float) -> Verdict:
    if score >= MATCH_THRESHOLD:
        return "MATCH"
    if score >= REVIEW_THRESHOLD:
        return "REVIEW"
    return "NO_MATCH"


def _build_analysis_layers(
    original_name: str,
    query_country: Optional[str],
    top: NameMatch,
) -> list[dict]:
    """Build ordered analysis-layer dicts consumed by the frontend."""
    layers: list[dict] = []

    # 1. Input normalization
    norm_info = normalize.name_steps(original_name)
    layers.append({
        "stage": "normalization",
        "title": "Input Normalization",
        "description": (
            "Raw input is Unicode-normalized and transliterated to a "
            "comparable Latin-script form before any comparison."
        ),
        **norm_info,
    })

    # 2–4. Score components (require detail breakdown from matcher)
    if top.score_detail:
        d = top.score_detail

        layers.append({
            "stage": "string_similarity",
            "title": "String Similarity",
            "description": (
                "Token-sorted Jaro-Winkler similarity. "
                "Tokens are alphabetically sorted before comparison so name-order "
                "variants (IVANOV SERGEI vs SERGEI IVANOV) score equally. "
                "A space-collapse fallback handles CJK unidecode spacing."
            ),
            "algorithm": "Token-sort Jaro-Winkler (+ space-collapse fallback for CJK)",
            "matched_alias": top.matched_name,
            "query_tokens_sorted": d["query_tokens_sorted"],
            "candidate_tokens_sorted": d["candidate_tokens_sorted"],
            "score": d["string_sim"],
            "weight": 0.7,
            "contribution": round(0.7 * d["string_sim"], 4),
            "used_collapsed": d["used_collapsed"],
        })

        layers.append({
            "stage": "phonetic_similarity",
            "title": "Phonetic Similarity",
            "description": (
                "Jaccard overlap of per-token Metaphone codes. "
                "Captures spelling variants: Mohamed / Muhammad / Mohammed all "
                "encode to the same Metaphone code, so they match phonetically."
            ),
            "algorithm": "Metaphone Jaccard Overlap",
            "query_metaphones": d["query_metaphones"],
            "candidate_metaphones": d["candidate_metaphones"],
            "intersection": d["metaphone_intersection"],
            "union": d["metaphone_union"],
            "score": d["phonetic_sim"],
            "weight": 0.3,
            "contribution": round(0.3 * d["phonetic_sim"], 4),
        })

        layers.append({
            "stage": "score_combination",
            "title": "Score Combination",
            "description": "Weighted sum of string and phonetic components gives the raw name score.",
            "formula": "0.7 × string_sim + 0.3 × phonetic_sim",
            "string_sim": d["string_sim"],
            "phonetic_sim": d["phonetic_sim"],
            "string_contribution": round(0.7 * d["string_sim"], 4),
            "phonetic_contribution": round(0.3 * d["phonetic_sim"], 4),
            "raw_score": top.raw_score,
        })

    # 5. Country signal adjustment
    adjustment = (
        +0.05 if top.country_signal == "confirmed"
        else -0.10 if top.country_signal == "conflict"
        else 0.0
    )
    layers.append({
        "stage": "country_adjustment",
        "title": "Country Signal Adjustment",
        "description": (
            "If the query country matches a country associated with the SDN entity, "
            "the score is boosted (+0.05). A mismatch applies a penalty (−0.10). "
            "Unknown or missing country data has no effect."
        ),
        "query_country": query_country,
        "entity_countries": top.entity.countries,
        "signal": top.country_signal,
        "adjustment": adjustment,
        "raw_score": top.raw_score,
        "final_score": top.final_score,
    })

    # 6. Verdict determination
    layers.append({
        "stage": "verdict",
        "title": "Verdict Determination",
        "description": (
            f"Final score compared against fixed thresholds. "
            f"≥ {MATCH_THRESHOLD:.0%} → MATCH (auto-block); "
            f"≥ {REVIEW_THRESHOLD:.0%} → REVIEW (analyst escalation); "
            f"< {REVIEW_THRESHOLD:.0%} → NO_MATCH (clear)."
        ),
        "score": top.final_score,
        "match_threshold": MATCH_THRESHOLD,
        "review_threshold": REVIEW_THRESHOLD,
        "verdict": _verdict(top.final_score),
    })

    return layers


def _entity_to_candidate(m: NameMatch) -> dict:
    """Serialize a NameMatch to the enriched candidate dict exposed by the API."""
    return {
        "name": m.entity.name,
        "matched_alias": m.matched_name,
        "score": m.final_score,
        "raw_score": m.raw_score,
        "country_signal": m.country_signal,
        "programs": m.entity.programs,
        "entity_type": m.entity.entity_type,
        "countries": m.entity.countries,
        "uid": m.entity.uid,
        "all_names": m.entity.all_names[:20],
        "crypto_addresses": m.entity.crypto_addresses,
        "score_detail": m.score_detail,
    }


@dataclass
class ScreeningResult:
    verdict: Verdict
    score: float                    # 0.0–1.0; 0.0 for NO_MATCH
    matched_entity: Optional[str]   # canonical name on the list
    matched_alias: Optional[str]    # which alias/name variant triggered
    programs: list[str]             # OFAC sanctions programs
    country_signal: str             # "confirmed"|"conflict"|"unknown"|"n/a"
    reason: str                     # human-readable explanation
    top_candidates: list[dict]      # up to 3 enriched candidates
    screening_type: str = "fiat"    # "fiat" | "crypto"
    normalized_query: Optional[str] = None
    analysis_layers: list[dict] = field(default_factory=list)


class SanctionsScreener:
    def __init__(self, sdn_path: Optional[Path] = None, force_download: bool = False):
        if sdn_path is None:
            sdn_path = download(force=force_download)
        self.entities: list[SanctionedEntity] = parse(sdn_path)
        self._crypto_index: dict[str, SanctionedEntity] = {}
        for e in self.entities:
            for addresses in e.crypto_addresses.values():
                for addr in addresses:
                    self._crypto_index[normalize.address(addr)] = e
        print(f"Loaded {len(self.entities):,} SDN entities, "
              f"{len(self._crypto_index):,} crypto addresses.")

    def screen(
        self,
        *,
        name: Optional[str] = None,
        country: Optional[str] = None,
        wallet_address: Optional[str] = None,
    ) -> ScreeningResult:
        if wallet_address:
            return self._screen_crypto(wallet_address)
        if name:
            return self._screen_fiat(name, country)
        raise ValueError("Provide name or wallet_address.")

    # ------------------------------------------------------------------
    def _screen_fiat(self, name: str, country: Optional[str]) -> ScreeningResult:
        matches = find_name_matches(name, country, self.entities)
        normalized_query = normalize.name(name)

        if not matches:
            return ScreeningResult(
                verdict="NO_MATCH",
                score=0.0,
                matched_entity=None,
                matched_alias=None,
                programs=[],
                country_signal="unknown",
                reason="No candidate above minimum threshold in OFAC SDN list.",
                top_candidates=[],
                screening_type="fiat",
                normalized_query=normalized_query,
                analysis_layers=[
                    {
                        "stage": "normalization",
                        "title": "Input Normalization",
                        "description": "Raw input normalized to Latin-script form.",
                        **normalize.name_steps(name),
                    },
                    {
                        "stage": "verdict",
                        "title": "Verdict Determination",
                        "description": "No candidates scored above the minimum floor threshold (0.72).",
                        "score": 0.0,
                        "match_threshold": MATCH_THRESHOLD,
                        "review_threshold": REVIEW_THRESHOLD,
                        "verdict": "NO_MATCH",
                    },
                ],
            )

        top = matches[0]
        v = _verdict(top.final_score)

        if v == "MATCH":
            reason = (
                f"High-confidence hit: '{top.matched_name}' on the OFAC SDN list "
                f"(score {top.final_score:.2%}, country signal: {top.country_signal}). "
                f"Programs: {', '.join(top.entity.programs) or 'n/a'}."
            )
        elif v == "REVIEW":
            reason = (
                f"Plausible match: '{top.matched_name}' (score {top.final_score:.2%}, "
                f"country signal: {top.country_signal}). "
                f"Score below automatic-block threshold ({MATCH_THRESHOLD:.0%}). "
                "Requires analyst review."
            )
        else:
            reason = (
                f"Best candidate '{top.matched_name}' scored {top.final_score:.2%} — "
                f"below review threshold ({REVIEW_THRESHOLD:.0%}). No sanctions exposure."
            )

        return ScreeningResult(
            verdict=v,
            score=top.final_score,
            matched_entity=top.entity.name if v != "NO_MATCH" else None,
            matched_alias=top.matched_name if v != "NO_MATCH" else None,
            programs=top.entity.programs if v != "NO_MATCH" else [],
            country_signal=top.country_signal,
            reason=reason,
            top_candidates=[_entity_to_candidate(m) for m in matches[:3]],
            screening_type="fiat",
            normalized_query=normalized_query,
            analysis_layers=_build_analysis_layers(name, country, top),
        )

    # ------------------------------------------------------------------
    def _screen_crypto(self, wallet_address: str) -> ScreeningResult:
        entity = find_crypto_match(wallet_address, self._crypto_index)
        normalized = normalize.address(wallet_address)

        if entity is None:
            return ScreeningResult(
                verdict="NO_MATCH",
                score=0.0,
                matched_entity=None,
                matched_alias=None,
                programs=[],
                country_signal="n/a",
                reason="Wallet address not found in OFAC SDN list.",
                top_candidates=[],
                screening_type="crypto",
                normalized_query=normalized,
                analysis_layers=[
                    {
                        "stage": "crypto_lookup",
                        "title": "Exact Address Lookup",
                        "description": (
                            "Wallet address lowercased and checked against the OFAC SDN "
                            "crypto address index (O(1) exact match)."
                        ),
                        "original": wallet_address,
                        "normalized": normalized,
                        "method": "exact_match",
                        "result": "not_found",
                    },
                    {
                        "stage": "verdict",
                        "title": "Verdict Determination",
                        "description": "Address not present in OFAC SDN crypto index.",
                        "score": 0.0,
                        "match_threshold": MATCH_THRESHOLD,
                        "review_threshold": REVIEW_THRESHOLD,
                        "verdict": "NO_MATCH",
                    },
                ],
            )

        from dataclasses import asdict
        top_candidate = {
            "name": entity.name,
            "matched_alias": None,
            "score": 1.0,
            "raw_score": 1.0,
            "country_signal": "n/a",
            "programs": entity.programs,
            "entity_type": entity.entity_type,
            "countries": entity.countries,
            "uid": entity.uid,
            "all_names": entity.all_names[:20],
            "crypto_addresses": entity.crypto_addresses,
            "score_detail": None,
        }

        return ScreeningResult(
            verdict="MATCH",
            score=1.0,
            matched_entity=entity.name,
            matched_alias=None,
            programs=entity.programs,
            country_signal="n/a",
            reason=(
                f"Exact match: wallet address is designated under "
                f"{', '.join(entity.programs) or 'OFAC SDN'}. "
                f"Associated entity: '{entity.name}'."
            ),
            top_candidates=[top_candidate],
            screening_type="crypto",
            normalized_query=normalized,
            analysis_layers=[
                {
                    "stage": "crypto_lookup",
                    "title": "Exact Address Lookup",
                    "description": (
                        "Wallet address lowercased and checked against the OFAC SDN "
                        "crypto address index (O(1) exact match)."
                    ),
                    "original": wallet_address,
                    "normalized": normalized,
                    "method": "exact_match",
                    "result": "found",
                    "matched_entity": entity.name,
                },
                {
                    "stage": "verdict",
                    "title": "Verdict Determination",
                    "description": "Exact address match in OFAC SDN crypto index — score is 1.0.",
                    "score": 1.0,
                    "match_threshold": MATCH_THRESHOLD,
                    "review_threshold": REVIEW_THRESHOLD,
                    "verdict": "MATCH",
                },
            ],
        )
