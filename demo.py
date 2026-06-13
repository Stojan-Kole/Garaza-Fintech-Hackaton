"""
Offline demo: builds a synthetic SDN dataset (no download needed)
and exercises the screener against known cases.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sanctions_screener.loader import SanctionedEntity
from sanctions_screener.screener import SanctionsScreener, MATCH_THRESHOLD, REVIEW_THRESHOLD

# ---------------------------------------------------------------------------
# Synthetic SDN entities (representative of real OFAC entries)
# ---------------------------------------------------------------------------

SYNTHETIC_ENTITIES: list[SanctionedEntity] = [
    SanctionedEntity(
        uid="1",
        name="IVANOV Sergei Borisovich",
        all_names=[
            "IVANOV Sergei Borisovich",
            "IVANOV Sergei",
            "ИВАНОВ Сергей Борисович",   # Cyrillic alias in real SDN
        ],
        entity_type="Individual",
        programs=["UKRAINE-EO13661"],
        countries=["Russia"],
        crypto_addresses={},
    ),
    SanctionedEntity(
        uid="2",
        name="MOHAMMAD Khalid Al-Rashid",
        all_names=[
            "MOHAMMAD Khalid Al-Rashid",
            "MOHAMMAD AL RASHID",
            "محمد الراشد",               # Arabic alias
        ],
        entity_type="Individual",
        programs=["SDGT"],
        countries=["Syria", "Turkey"],
        crypto_addresses={},
    ),
    SanctionedEntity(
        uid="3",
        name="LAZARUS GROUP",
        all_names=["LAZARUS GROUP", "HIDDEN COBRA", "GUARDIANS OF PEACE"],
        entity_type="Entity",
        programs=["DPRK3"],
        countries=["North Korea"],
        crypto_addresses={
            "XBT": [
                "1fzedc9zlr4pkqc5cakznhxpfbqbkxm3w",
                "3j6bgz8pj8fkfpf4l6zkymmxkspffxnvc",
            ],
            "ETH": ["0x098b716b8aaf21512996dc57eb0615e2383e2f96"],
        },
    ),
    SanctionedEntity(
        uid="4",
        name="BANK ROSSIYA",
        all_names=["BANK ROSSIYA", "ROSSIYA BANK", "БАНК РОССИЯ"],
        entity_type="Entity",
        programs=["UKRAINE-EO13685"],
        countries=["Russia"],
        crypto_addresses={},
    ),
]


# ---------------------------------------------------------------------------
# Patch the screener to accept pre-built entity list (skip download/parse)
# ---------------------------------------------------------------------------

class DemoScreener(SanctionsScreener):
    def __init__(self):
        from sanctions_screener import normalize
        self.entities = SYNTHETIC_ENTITIES
        self._crypto_index = {}
        for e in self.entities:
            for addresses in e.crypto_addresses.values():
                for addr in addresses:
                    self._crypto_index[normalize.address(addr)] = e
        print(f"Demo mode: {len(self.entities)} synthetic entities loaded.\n")


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

CASES = [
    # --- Cyrillic / transliteration variants ---
    dict(label="Cyrillic exact",           name="Сергей Иванов",              country="Russia"),
    dict(label="Sergei (EN standard)",     name="Sergei Ivanov",              country="Russia"),
    dict(label="Sergey (US passport)",     name="Sergey Ivanov",              country="Russia"),
    dict(label="Sergej (DE/CZ variant)",   name="Sergej Ivanov",              country="Russia"),
    dict(label="Reversed token order",     name="Ivanov Sergei",              country="Russia"),
    dict(label="Country conflict",         name="Sergei Ivanov",              country="Germany"),

    # --- Arabic / phonetic variants ---
    dict(label="Mohammed variant",         name="Mohammed Al-Rashid",         country="Syria"),
    dict(label="Muhammad variant",         name="Muhammad Al Rashid",         country="Syria"),
    dict(label="Arabic script",            name="محمد الراشد",               country="Syria"),

    # --- Entity name ---
    dict(label="Entity transliterated",   name="Bank Rossiya",               country="Russia"),
    dict(label="Entity Cyrillic",          name="Банк Россия",               country="Russia"),

    # --- Clean names (should be NO_MATCH) ---
    dict(label="Clean — similar surname",  name="Ivan Sergeyev",              country="Russia"),
    dict(label="Clean — unrelated",        name="John Smith",                 country="US"),

    # --- Crypto ---
    dict(label="Crypto — MATCH",
         wallet_address="1fzedc9zlr4pkqc5cakznhxpfbqbkxm3w"),
    dict(label="Crypto — ETH MATCH",
         wallet_address="0x098b716b8aaf21512996dc57eb0615e2383e2f96"),
    dict(label="Crypto — NO_MATCH",
         wallet_address="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"),
]


def run():
    screener = DemoScreener()

    col = {"MATCH": "\033[91m", "REVIEW": "\033[93m", "NO_MATCH": "\033[92m", "RESET": "\033[0m"}
    has_color = sys.stdout.isatty()

    def colorize(verdict: str) -> str:
        if not has_color:
            return verdict
        return f"{col[verdict]}{verdict}{col['RESET']}"

    header = f"{'Label':<30} {'Input':<35} {'Score':>6}  Verdict"
    print(header)
    print("─" * len(header))

    for case in CASES:
        label = case.get("label", "")
        name = case.get("name")
        country = case.get("country")
        wallet = case.get("wallet_address")

        result = screener.screen(name=name, country=country, wallet_address=wallet)

        display_input = wallet or f"{name}" + (f" ({country})" if country else "")
        verdict_str = colorize(result.verdict)

        print(f"{label:<30} {display_input:<35} {result.score:>6.2%}  {verdict_str}")
        if result.verdict != "NO_MATCH" and result.matched_alias:
            print(f"  → matched: '{result.matched_alias}'  |  {result.reason}")
        elif result.verdict == "NO_MATCH" and result.score > 0:
            if result.top_candidates:
                best = result.top_candidates[0]
                print(f"  → best candidate: '{best['matched_alias']}' score {best['score']:.2%} — below threshold")

    print()
    print(f"Thresholds: MATCH ≥ {MATCH_THRESHOLD:.0%}  |  REVIEW ≥ {REVIEW_THRESHOLD:.0%}  |  else NO_MATCH")


if __name__ == "__main__":
    run()
