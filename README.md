# Sanctions Screener

Screen payment instructions against the OFAC SDN list.
Returns one of three verdicts: **MATCH**, **REVIEW**, or **NO_MATCH**.

## Architecture

```mermaid
flowchart TD
    A[Payment Instruction] --> B{fiat or crypto?}

    B -->|name + country| FIAT[Fiat Screening]
    B -->|wallet address| CRYPTO[Crypto Screening]

    FIAT --> N1[NFKC normalize + lowercase]
    N1 --> N2[unidecode transliteration\nCyrillic / Arabic / CJK to Latin]
    N2 --> N3[strip punctuation]
    N3 --> M[Score vs all SDN entries + aliases]

    M --> M1[Token-sort JaroWinkler\nhandles LAST FIRST vs FIRST LAST]
    M --> M2[Metaphone phonetics per token\nMohammed ~ Muhammad]
    M1 & M2 --> S[Combined score: 0.7 string + 0.3 phonetic]
    S --> CA[Country signal\n+0.05 confirmed / -0.10 conflict]

    CRYPTO --> CL[Exact lookup in address index]
    CL -->|found| MATCH

    CA --> T{Score threshold}
    T -->|score >= 0.92| MATCH[MATCH: block payment]
    T -->|0.78 to 0.91| REVIEW[REVIEW: route to analyst]
    T -->|score < 0.78| NOMATCH[NO_MATCH: release payment]
```

## Data source

OFAC Specially Designated Nationals (SDN) list — public domain, updated daily.
Downloaded automatically on first startup and cached to `.cache/sdn.xml`.

- ~12,000 designated entities
- Includes all aliases (a.k.a. / f.k.a.)
- Includes sanctioned cryptocurrency addresses (BTC, ETH, XMR, USDT, etc.)

## Setup

```bash
pip install -r requirements.txt
uvicorn api:app --reload
```

On first start the SDN XML (~30 MB) is downloaded. Subsequent starts use the cache.

## API

### `POST /screen`

```json
// Fiat transfer
{
  "name": "Sergei Ivanov",
  "country": "Russia"
}

// Crypto transfer
{
  "wallet_address": "1FzWLkAahHooV3kzTgyx6qsswXJ6sCXkSR"
}
```

Response:

```json
{
  "verdict": "MATCH",
  "score": 0.97,
  "matched_entity": "IVANOV, Sergei Borisovich",
  "matched_alias": "IVANOV, Sergei",
  "programs": ["UKRAINE-EO13661"],
  "country_signal": "confirmed",
  "reason": "High-confidence hit: ...",
  "top_candidates": [...]
}
```

### `GET /health`

```json
{"status": "ok", "entities": 12483, "crypto_addresses": 847}
```

## Verdict logic

| Score | Verdict | Action |
|-------|---------|--------|
| ≥ 0.92 | **MATCH** | Block payment automatically |
| 0.78 – 0.91 | **REVIEW** | Route to human analyst |
| < 0.78 | **NO_MATCH** | Release payment |

Country signal adjusts the name score: **+0.05** on country match, **−0.10** on country conflict.
This means a near-perfect name match in the wrong country can be pushed down to REVIEW instead of MATCH.

## Name matching examples

| Input | SDN alias | Score | Verdict |
|-------|-----------|-------|---------|
| Sergei Ivanov | IVANOV Sergei | 1.00 | MATCH |
| Sergey Ivanov | IVANOV Sergei | ~0.95 | MATCH |
| Сергей Иванов | IVANOV Sergei | ~0.93 | MATCH |
| Mohammed Al-Rashid | MOHAMMAD AL RASHID | ~0.89 | MATCH |
| Muhammad Al Rashid | MOHAMMAD AL RASHID | ~0.91 | MATCH |
| Xi Jinping | XI Jinping | ~0.98 | MATCH |
| John Smith | — | ~0.55 | NO_MATCH |

## Limitations

- SDN only: does not include EU Consolidated List, UN List, or HMT (UK) list.
  These are parseable in the same pattern and can be added as additional loaders.
- Crypto screening is exact-match only. Indirect exposure (funds routed through
  sanctioned addresses) requires a blockchain analytics provider (Chainalysis, TRM).
- Transliteration via `unidecode` is lossy. Arabic → Latin is approximate; errors
  are partially compensated by the Metaphone phonetic layer.
- Thresholds (0.92 / 0.78) are starting points. Calibrate on your own labeled data.
