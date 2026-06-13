"""
Scoring engine: combines string similarity + phonetic similarity + country signal.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import jellyfish
from rapidfuzz.distance import JaroWinkler

from . import normalize
from .loader import SanctionedEntity

_COUNTRY_MAP: dict[str, str] = {
    "russian federation": "russia",
    "rus": "russia",
    "rf": "russia",
    "people's republic of china": "china",
    "prc": "china",
    "chn": "china",
    "islamic republic of iran": "iran",
    "irn": "iran",
    "dprk": "north korea",
    "democratic people's republic of korea": "north korea",
    "syrian arab republic": "syria",
    "bolivarian republic of venezuela": "venezuela",
    "republic of belarus": "belarus",
    "blr": "belarus",
    "republic of cuba": "cuba",
    "united states": "us",
    "united states of america": "us",
    "usa": "us",
}


def _canonical_country(raw: str) -> str:
    key = raw.lower().strip()
    return _COUNTRY_MAP.get(key, key)


def _metaphone_set(norm: str) -> set[str]:
    """Metaphone code for each token (skip empty / single-char tokens)."""
    return {jellyfish.metaphone(t) for t in norm.split() if len(t) > 1}


def _string_sim(a: str, b: str) -> float:
    """Token-sort JaroWinkler with a space-collapsed fallback.

    Token-sort handles 'IVANOV SERGEI' vs 'SERGEI IVANOV'.
    Space-collapsed handles CJK unidecode output: 'xi jin ping' vs 'xi jinping'.
    """
    a_sorted = " ".join(sorted(a.split()))
    b_sorted = " ".join(sorted(b.split()))
    jw_sorted = JaroWinkler.similarity(a_sorted, b_sorted)
    jw_collapsed = JaroWinkler.similarity(a.replace(" ", ""), b.replace(" ", ""))
    return max(jw_sorted, jw_collapsed)


def _phonetic_sim(a: str, b: str) -> float:
    """Jaccard overlap of Metaphone codes."""
    sa = _metaphone_set(a)
    sb = _metaphone_set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def score_names(query_norm: str, candidate_norm: str) -> float:
    """Combined 0–1 score: 70% string similarity + 30% phonetic similarity."""
    if not query_norm or not candidate_norm:
        return 0.0
    if query_norm == candidate_norm:
        return 1.0
    return 0.7 * _string_sim(query_norm, candidate_norm) + \
           0.3 * _phonetic_sim(query_norm, candidate_norm)


def _score_with_detail(query_norm: str, candidate_norm: str) -> dict:
    """Like score_names but returns full component breakdown for UI transparency."""
    empty = {
        "combined": 0.0, "string_sim": 0.0, "phonetic_sim": 0.0,
        "query_tokens_sorted": [], "candidate_tokens_sorted": [],
        "query_metaphones": [], "candidate_metaphones": [],
        "metaphone_intersection": [], "metaphone_union": [],
        "used_collapsed": False,
    }
    if not query_norm or not candidate_norm:
        return empty

    if query_norm == candidate_norm:
        tokens = query_norm.split()
        meta = sorted(_metaphone_set(query_norm))
        return {
            "combined": 1.0, "string_sim": 1.0, "phonetic_sim": 1.0,
            "query_tokens_sorted": tokens, "candidate_tokens_sorted": tokens,
            "query_metaphones": meta, "candidate_metaphones": meta,
            "metaphone_intersection": meta, "metaphone_union": meta,
            "used_collapsed": False,
        }

    a_sorted = " ".join(sorted(query_norm.split()))
    b_sorted = " ".join(sorted(candidate_norm.split()))
    jw_sorted = JaroWinkler.similarity(a_sorted, b_sorted)
    jw_collapsed = JaroWinkler.similarity(
        query_norm.replace(" ", ""), candidate_norm.replace(" ", "")
    )
    string_sim = max(jw_sorted, jw_collapsed)
    used_collapsed = jw_collapsed > jw_sorted

    sa = _metaphone_set(query_norm)
    sb = _metaphone_set(candidate_norm)
    if sa and sb:
        intersection = sa & sb
        union = sa | sb
        phonetic_sim = len(intersection) / len(union)
    else:
        intersection = set()
        union = sa | sb
        phonetic_sim = 0.0

    combined = 0.7 * string_sim + 0.3 * phonetic_sim

    return {
        "combined": round(combined, 4),
        "string_sim": round(string_sim, 4),
        "phonetic_sim": round(phonetic_sim, 4),
        "query_tokens_sorted": a_sorted.split(),
        "candidate_tokens_sorted": b_sorted.split(),
        "query_metaphones": sorted(sa),
        "candidate_metaphones": sorted(sb),
        "metaphone_intersection": sorted(intersection),
        "metaphone_union": sorted(union),
        "used_collapsed": used_collapsed,
    }


@dataclass
class NameMatch:
    entity: SanctionedEntity
    raw_score: float        # name-only combined score
    final_score: float      # after country adjustment
    matched_name: str       # the alias that scored best
    country_signal: str     # "confirmed" | "conflict" | "unknown"
    score_detail: Optional[dict] = None  # populated for top candidates only


def _country_signal(query_country: Optional[str], entity_countries: list[str]) -> str:
    if not query_country or not entity_countries:
        return "unknown"
    qc = _canonical_country(query_country)
    for ec in entity_countries:
        if qc == _canonical_country(ec):
            return "confirmed"
    return "conflict"


def find_name_matches(
    query_name: str,
    query_country: Optional[str],
    entities: list[SanctionedEntity],
    floor: float = 0.72,
    detail_limit: int = 3,
) -> list[NameMatch]:
    """
    Score every entity against the query name.
    Returns matches above `floor`, sorted descending by final_score.
    Top `detail_limit` matches include a full per-component score breakdown.
    """
    query_norm = normalize.name(query_name)
    results: list[NameMatch] = []

    for entity in entities:
        best_score = 0.0
        best_alias = ""

        for alias in entity.all_names:
            s = score_names(query_norm, normalize.name(alias))
            if s > best_score:
                best_score = s
                best_alias = alias

        if best_score < floor:
            continue

        signal = _country_signal(query_country, entity.countries)
        adjusted = best_score
        if signal == "confirmed":
            adjusted = min(1.0, best_score + 0.05)
        elif signal == "conflict":
            adjusted = max(0.0, best_score - 0.10)

        results.append(NameMatch(
            entity=entity,
            raw_score=round(best_score, 4),
            final_score=round(adjusted, 4),
            matched_name=best_alias,
            country_signal=signal,
        ))

    results.sort(key=lambda m: m.final_score, reverse=True)

    # Enrich the top N candidates with per-component breakdown (cheap, 3 extra calls)
    for i in range(min(detail_limit, len(results))):
        m = results[i]
        detail = _score_with_detail(query_norm, normalize.name(m.matched_name))
        results[i] = NameMatch(
            entity=m.entity,
            raw_score=m.raw_score,
            final_score=m.final_score,
            matched_name=m.matched_name,
            country_signal=m.country_signal,
            score_detail=detail,
        )

    return results


def find_crypto_match(
    wallet_address: str,
    crypto_index: dict[str, SanctionedEntity],
) -> Optional[SanctionedEntity]:
    """Exact lookup. Crypto addresses are deterministic — fuzzy is wrong here."""
    return crypto_index.get(normalize.address(wallet_address))
