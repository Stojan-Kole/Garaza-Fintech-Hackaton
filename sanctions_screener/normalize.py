"""
Name normalization pipeline:
  NFKC → lowercase → unidecode (Cyrillic/Arabic/CJK → Latin) → strip punctuation
"""

import re
import unicodedata
from unidecode import unidecode

_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE = re.compile(r"\s+")


def name(raw: str) -> str:
    """Return a comparable Latin-script lowercase token string."""
    s = unicodedata.normalize("NFKC", raw)
    s = s.lower()
    s = unidecode(s)         # Сергей → sergei, 习近平 → Xi Jin Ping, محمد → mhmd
    s = s.lower()            # unidecode re-capitalises CJK output; lowercase again
    s = _PUNCT.sub(" ", s)
    s = _SPACE.sub(" ", s).strip()
    return s


def name_steps(raw: str) -> dict:
    """Like name() but captures each transformation step for UI transparency."""
    s0 = raw
    s1 = unicodedata.normalize("NFKC", s0)
    s2 = s1.lower()
    s3 = unidecode(s2)
    s4 = s3.lower()          # re-lowercase after unidecode (CJK capitalises)
    s5 = _PUNCT.sub(" ", s4)
    s6 = _SPACE.sub(" ", s5).strip()

    transformations = []
    if s1 != s0:
        transformations.append("unicode_nfkc")
    if s2 != s1:
        transformations.append("lowercase")
    if s3 != s2:
        transformations.append("script_transliteration")
    if s5 != s4:
        transformations.append("punctuation_removal")
    if s6 != s5:
        transformations.append("whitespace_collapse")

    # Build deduplicated step list (skip no-op steps)
    raw_steps = [
        {"name": "Original Input",                    "value": s0},
        {"name": "NFKC Unicode Normalization",        "value": s1},
        {"name": "Lowercase",                         "value": s2},
        {"name": "Script Transliteration (Unidecode)","value": s4},
        {"name": "Punctuation Strip",                 "value": s5},
        {"name": "Normalized Output",                 "value": s6},
    ]
    steps = [raw_steps[0]]
    for step in raw_steps[1:]:
        if step["value"] != steps[-1]["value"]:
            steps.append(step)

    return {
        "original": s0,
        "normalized": s6,
        "steps": steps,
        "transformations_applied": transformations,
        "changed": s0 != s6,
    }


def address(raw: str) -> str:
    """Normalize a crypto wallet address for exact matching."""
    return raw.strip().lower()
