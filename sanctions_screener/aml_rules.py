"""
AML (Anti-Money Laundering) transaction risk rules.
10 rules ordered by priority: 4 HIGH, 5 MEDIUM, 1 LOW severity.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_HIGH_RISK_ISO = {
    "IR", "KP", "RU", "MM", "SY", "CU", "VE", "BY",
    "SD", "SO", "YE", "LY", "CF", "SS", "ZW", "IQ",
    "AF", "HT", "ML", "NI",
}
_HIGH_RISK_NAMES = {
    "iran", "north korea", "russia", "myanmar", "burma", "syria",
    "cuba", "venezuela", "belarus", "sudan", "somalia", "yemen",
    "libya", "central african republic", "south sudan", "zimbabwe",
    "iraq", "afghanistan", "haiti", "mali", "nicaragua",
}

REPORTING_THRESHOLD = 10_000.0
ROUND_AMOUNT_TRIGGERS = {10_000.0, 50_000.0, 100_000.0}
SMURFING_LOW = 9_000.0
SMURFING_HIGH = 9_999.99

VELOCITY_WINDOW_HOURS = 24
VELOCITY_THRESHOLD = 5

LARGE_TRANSFER_MIN = 10_000.0
NEW_ACCOUNT_MAX_DAYS = 30

BUSINESS_HOURS_START = 6
BUSINESS_HOURS_END = 22

# Typical max transaction amount by business type (cash-intensive businesses)
_BUSINESS_CAPS: dict[str, float] = {
    "hair salon": 50_000,
    "beauty salon": 50_000,
    "barber": 30_000,
    "nail salon": 30_000,
    "laundromat": 20_000,
    "car wash": 30_000,
    "restaurant": 150_000,
    "food truck": 20_000,
    "retail": 200_000,
    "florist": 20_000,
    "bakery": 30_000,
    "convenience store": 50_000,
    "gas station": 75_000,
    "tattoo": 20_000,
}

_PEP_TITLE_KEYWORDS = {
    "president", "prime minister", "minister", "senator", "congressman",
    "governor", "mayor", "ambassador", "secretary of state", "chancellor",
    "parliament", "deputy minister", "director general", "head of state",
    "vice president", "secretary general", "general",
}

_KNOWN_PEPS = {
    "vladimir putin", "ali khamenei", "kim jong un", "bashar al-assad",
    "alexander lukashenko", "nicolas maduro", "omar al-bashir",
    "robert mugabe", "idi amin", "muammar gaddafi",
}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class AMLFlag:
    rule_id: int
    rule_name: str
    severity: str       # HIGH | MEDIUM | LOW
    triggered: bool
    description: str
    details: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _iso(c: str) -> str:
    return c.strip().upper()


def _is_high_risk_country(country: Optional[str]) -> bool:
    if not country:
        return False
    return _iso(country) in _HIGH_RISK_ISO or country.strip().lower() in _HIGH_RISK_NAMES


# ---------------------------------------------------------------------------
# Rule 1 — Sanctions screening
# ---------------------------------------------------------------------------

def check_sanctions(
    sender_name: Optional[str],
    receiver_name: Optional[str],
    screener_fn: Optional[Callable],
) -> AMLFlag:
    """OFAC / UN / EU sanctions list hit on sender or receiver."""
    if not screener_fn:
        return AMLFlag(
            rule_id=1, rule_name="Sanctions Hit", severity="HIGH", triggered=False,
            description="Screener not available — rule skipped.",
        )

    hits = []
    for label, name in [("sender", sender_name), ("receiver", receiver_name)]:
        if not name:
            continue
        result = screener_fn(name=name)
        if result.verdict in ("MATCH", "REVIEW"):
            hits.append({
                "party": label,
                "name": name,
                "verdict": result.verdict,
                "score": round(result.score, 4),
                "matched_entity": result.matched_entity,
                "programs": result.programs,
            })

    return AMLFlag(
        rule_id=1,
        rule_name="Sanctions Hit",
        severity="HIGH",
        triggered=bool(hits),
        description=(
            "Sender or receiver matches or closely resembles an entry "
            "on the OFAC SDN, UN, or EU sanctions list."
        ),
        details={"hits": hits},
    )


# ---------------------------------------------------------------------------
# Rule 2 — High-risk jurisdiction
# ---------------------------------------------------------------------------

def check_high_risk_jurisdiction(
    sender_country: Optional[str],
    receiver_country: Optional[str],
) -> AMLFlag:
    """Transaction touches a FATF / OFAC high-risk jurisdiction."""
    flagged = []
    for label, country in [("sender", sender_country), ("receiver", receiver_country)]:
        if _is_high_risk_country(country):
            flagged.append({"party": label, "country": country})

    return AMLFlag(
        rule_id=2,
        rule_name="High-Risk Jurisdiction",
        severity="HIGH",
        triggered=bool(flagged),
        description=(
            "Transaction originates from or is directed to a high-risk or "
            "sanctioned jurisdiction (FATF blacklist / OFAC country programs)."
        ),
        details={"flagged_jurisdictions": flagged},
    )


# ---------------------------------------------------------------------------
# Rule 3 — Round number transactions
# ---------------------------------------------------------------------------

def check_round_number(amount: Optional[float]) -> AMLFlag:
    """Exact $10k / $50k / $100k — classic structuring indicator."""
    if amount is None:
        return AMLFlag(
            rule_id=3, rule_name="Round Number Transaction", severity="MEDIUM",
            triggered=False, description="Amount not provided.",
        )
    triggered = amount in ROUND_AMOUNT_TRIGGERS
    return AMLFlag(
        rule_id=3,
        rule_name="Round Number Transaction",
        severity="MEDIUM",
        triggered=triggered,
        description=(
            f"Amount ${amount:,.2f} is an exact round figure used to "
            "deliberately stay at or near CTR reporting thresholds (structuring)."
            if triggered else
            f"Amount ${amount:,.2f} is not a round number trigger."
        ),
        details={"amount": amount, "trigger_amounts": sorted(ROUND_AMOUNT_TRIGGERS)},
    )


# ---------------------------------------------------------------------------
# Rule 4 — Threshold proximity (smurfing)
# ---------------------------------------------------------------------------

def check_threshold_proximity(amount: Optional[float]) -> AMLFlag:
    """Amount in $9,000–$9,999 — staying below $10k CTR threshold."""
    if amount is None:
        return AMLFlag(
            rule_id=4, rule_name="Threshold Proximity (Smurfing)", severity="MEDIUM",
            triggered=False, description="Amount not provided.",
        )
    triggered = SMURFING_LOW <= amount <= SMURFING_HIGH
    return AMLFlag(
        rule_id=4,
        rule_name="Threshold Proximity (Smurfing)",
        severity="MEDIUM",
        triggered=triggered,
        description=(
            f"Amount ${amount:,.2f} falls in the $9,000–$9,999 range — "
            "classic smurfing pattern to evade the $10,000 CTR reporting threshold."
            if triggered else
            f"Amount ${amount:,.2f} is outside the smurfing range."
        ),
        details={"amount": amount, "smurfing_range": [SMURFING_LOW, SMURFING_HIGH]},
    )


# ---------------------------------------------------------------------------
# Rule 5 — PEP detection
# ---------------------------------------------------------------------------

def check_pep(
    sender_name: Optional[str],
    receiver_name: Optional[str],
) -> AMLFlag:
    """Politically Exposed Person involvement."""
    hits = []
    for label, name in [("sender", sender_name), ("receiver", receiver_name)]:
        if not name:
            continue
        nl = name.lower()
        kw_hit = next((kw for kw in _PEP_TITLE_KEYWORDS if kw in nl), None)
        known_hit = next((p for p in _KNOWN_PEPS if p in nl), None)
        if kw_hit or known_hit:
            hits.append({
                "party": label,
                "name": name,
                "matched_title": kw_hit,
                "matched_known_pep": known_hit,
            })

    return AMLFlag(
        rule_id=5,
        rule_name="PEP — Politically Exposed Person",
        severity="HIGH",
        triggered=bool(hits),
        description=(
            "Sender or receiver is (or resembles) a Politically Exposed Person. "
            "PEPs carry elevated corruption and bribery risk per FATF Recommendation 12."
        ),
        details={"pep_hits": hits},
    )


# ---------------------------------------------------------------------------
# Rule 6 — Unusual transaction velocity
# ---------------------------------------------------------------------------

def check_velocity(
    sender_name: Optional[str],
    recent_transactions: Optional[list[dict]],
    reference_timestamp: Optional[datetime],
    tx_count_override: Optional[int] = None,
) -> AMLFlag:
    """5+ transactions from same sender in 24h — possible layering."""
    if tx_count_override is not None and sender_name:
        count = tx_count_override
        triggered = count >= VELOCITY_THRESHOLD
        return AMLFlag(
            rule_id=6,
            rule_name="Unusual Transaction Velocity",
            severity="MEDIUM",
            triggered=triggered,
            description=(
                f"Entity '{sender_name}' sent {count} transaction(s) in the last 24h "
                f"(threshold: {VELOCITY_THRESHOLD}). "
                + ("Possible layering or coordinated fraud." if triggered else "Within normal range.")
            ),
            details={
                "sender": sender_name,
                "transactions_in_window": count,
                "velocity_threshold": VELOCITY_THRESHOLD,
                "window_hours": VELOCITY_WINDOW_HOURS,
            },
        )

    if not sender_name or not recent_transactions:
        return AMLFlag(
            rule_id=6, rule_name="Unusual Transaction Velocity", severity="MEDIUM",
            triggered=False, description="No transaction history provided.",
            details={"note": "Pass recent_transactions or sender_tx_count_24h to enable this rule."},
        )

    ref = reference_timestamp or datetime.now(timezone.utc)
    window_start = ref - timedelta(hours=VELOCITY_WINDOW_HOURS)
    sender_lower = sender_name.lower()
    count = 0
    for tx in recent_transactions:
        ts_raw = tx.get("timestamp")
        if not ts_raw:
            continue
        ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
        if ts >= window_start and tx.get("sender", "").lower() == sender_lower:
            count += 1

    triggered = count >= VELOCITY_THRESHOLD
    return AMLFlag(
        rule_id=6,
        rule_name="Unusual Transaction Velocity",
        severity="MEDIUM",
        triggered=triggered,
        description=(
            f"Entity '{sender_name}' has {count} transaction(s) in the last 24h "
            f"(threshold: {VELOCITY_THRESHOLD}). "
            + ("Possible layering or coordinated fraud." if triggered else "Within normal range.")
        ),
        details={
            "sender": sender_name,
            "transactions_in_window": count,
            "velocity_threshold": VELOCITY_THRESHOLD,
            "window_hours": VELOCITY_WINDOW_HOURS,
        },
    )


# ---------------------------------------------------------------------------
# Rule 7 — Business type mismatch
# ---------------------------------------------------------------------------

def check_business_mismatch(
    business_type: Optional[str],
    amount: Optional[float],
) -> AMLFlag:
    """Transaction amount far exceeds typical profile for the business type."""
    if not business_type or amount is None:
        return AMLFlag(
            rule_id=7, rule_name="Business Type Mismatch", severity="MEDIUM",
            triggered=False, description="Business type or amount not provided.",
        )

    bt_lower = business_type.lower()
    cap = next((v for k, v in _BUSINESS_CAPS.items() if k in bt_lower), None)

    if cap is None:
        return AMLFlag(
            rule_id=7, rule_name="Business Type Mismatch", severity="MEDIUM",
            triggered=False,
            description=f"No expected cap defined for business type '{business_type}'.",
            details={"business_type": business_type},
        )

    triggered = amount > cap
    return AMLFlag(
        rule_id=7,
        rule_name="Business Type Mismatch",
        severity="MEDIUM",
        triggered=triggered,
        description=(
            f"Amount ${amount:,.2f} far exceeds typical range for '{business_type}' "
            f"(expected ≤ ${cap:,.0f}). Business profile does not match transaction size."
            if triggered else
            f"Amount ${amount:,.2f} is within expected range for '{business_type}' (≤ ${cap:,.0f})."
        ),
        details={
            "business_type": business_type,
            "amount": amount,
            "expected_cap": cap,
            "excess": round(amount - cap, 2) if triggered else 0,
        },
    )


# ---------------------------------------------------------------------------
# Rule 8 — Circular transactions
# ---------------------------------------------------------------------------

def check_circular_transactions(
    sender_name: Optional[str],
    receiver_name: Optional[str],
    recent_transactions: Optional[list[dict]],
) -> AMLFlag:
    """A → B → C → A pattern — classic layering."""
    if not sender_name or not receiver_name or not recent_transactions:
        return AMLFlag(
            rule_id=8, rule_name="Circular Transactions", severity="HIGH",
            triggered=False, description="Insufficient data to detect circular pattern.",
            details={"note": "Pass recent_transactions with sender/receiver fields to enable this rule."},
        )

    graph: dict[str, set[str]] = {}
    for tx in recent_transactions:
        s = tx.get("sender", "").lower()
        r = tx.get("receiver", "").lower()
        if s and r:
            graph.setdefault(s, set()).add(r)

    s_lower = sender_name.lower()
    r_lower = receiver_name.lower()
    graph.setdefault(s_lower, set()).add(r_lower)

    def _path_back(start: str, target: str, max_hops: int = 5) -> list[str] | None:
        queue: deque[tuple[str, list[str]]] = deque([(start, [start])])
        visited = {start}
        while queue:
            node, path = queue.popleft()
            if len(path) > max_hops:
                continue
            for neighbor in graph.get(node, set()):
                if neighbor == target:
                    return path + [neighbor]
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))
        return None

    cycle = _path_back(r_lower, s_lower)
    triggered = cycle is not None

    return AMLFlag(
        rule_id=8,
        rule_name="Circular Transactions",
        severity="HIGH",
        triggered=triggered,
        description=(
            "Money returns to the original sender through intermediaries — "
            f"classic layering pattern ({' → '.join(cycle)})."
            if triggered else
            "No circular transaction pattern detected in provided history."
        ),
        details={
            "cycle_path": cycle or [],
            "current_sender": sender_name,
            "current_receiver": receiver_name,
        },
    )


# ---------------------------------------------------------------------------
# Rule 9 — Unusual transaction hours
# ---------------------------------------------------------------------------

def check_unusual_hours(
    transaction_timestamp: Optional[datetime],
    local_offset_hours: int = 0,
) -> AMLFlag:
    """Transaction outside 06:00–22:00 local time."""
    if transaction_timestamp is None:
        return AMLFlag(
            rule_id=9, rule_name="Unusual Transaction Hours", severity="LOW",
            triggered=False, description="No timestamp provided.",
        )

    local_hour = (transaction_timestamp.hour + local_offset_hours) % 24
    triggered = local_hour < BUSINESS_HOURS_START or local_hour >= BUSINESS_HOURS_END

    return AMLFlag(
        rule_id=9,
        rule_name="Unusual Transaction Hours",
        severity="LOW",
        triggered=triggered,
        description=(
            f"Transaction at {transaction_timestamp.strftime('%H:%M')} UTC "
            f"(local hour {local_hour:02d}:xx) is outside normal business hours "
            f"({BUSINESS_HOURS_START:02d}:00–{BUSINESS_HOURS_END:02d}:00)."
            if triggered else
            f"Transaction at local hour {local_hour:02d}:xx is within business hours."
        ),
        details={
            "utc_time": transaction_timestamp.strftime("%H:%M"),
            "local_hour": local_hour,
            "business_hours": f"{BUSINESS_HOURS_START:02d}:00–{BUSINESS_HOURS_END:02d}:00",
            "local_offset_hours": local_offset_hours,
        },
    )


# ---------------------------------------------------------------------------
# Rule 10 — New account + large transfer
# ---------------------------------------------------------------------------

def check_new_account_large_transfer(
    account_age_days: Optional[int],
    amount: Optional[float],
) -> AMLFlag:
    """Account < 30 days old sending > $10k — common fraud/mule pattern."""
    if account_age_days is None or amount is None:
        return AMLFlag(
            rule_id=10, rule_name="New Account + Large Transfer", severity="MEDIUM",
            triggered=False, description="Account age or amount not provided.",
        )

    triggered = account_age_days < NEW_ACCOUNT_MAX_DAYS and amount > LARGE_TRANSFER_MIN
    return AMLFlag(
        rule_id=10,
        rule_name="New Account + Large Transfer",
        severity="MEDIUM",
        triggered=triggered,
        description=(
            f"Account is only {account_age_days} day(s) old and is sending "
            f"${amount:,.2f} — common pattern for newly created fraud or mule accounts."
            if triggered else
            f"Account age ({account_age_days}d) and amount (${amount:,.2f}) do not trigger this rule."
        ),
        details={
            "account_age_days": account_age_days,
            "amount": amount,
            "age_threshold": NEW_ACCOUNT_MAX_DAYS,
            "amount_threshold": LARGE_TRANSFER_MIN,
        },
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_all_rules(
    *,
    sender_name: Optional[str] = None,
    receiver_name: Optional[str] = None,
    sender_country: Optional[str] = None,
    receiver_country: Optional[str] = None,
    amount: Optional[float] = None,
    transaction_timestamp: Optional[datetime] = None,
    account_age_days: Optional[int] = None,
    business_type: Optional[str] = None,
    local_offset_hours: int = 0,
    recent_transactions: Optional[list[dict]] = None,
    sender_tx_count_24h: Optional[int] = None,
    screener_fn: Optional[Callable] = None,
) -> list[AMLFlag]:
    """Run all 10 AML rules and return the full flag list in priority order."""
    return [
        check_sanctions(sender_name, receiver_name, screener_fn),
        check_high_risk_jurisdiction(sender_country, receiver_country),
        check_round_number(amount),
        check_threshold_proximity(amount),
        check_pep(sender_name, receiver_name),
        check_velocity(sender_name, recent_transactions, transaction_timestamp, sender_tx_count_24h),
        check_business_mismatch(business_type, amount),
        check_circular_transactions(sender_name, receiver_name, recent_transactions),
        check_unusual_hours(transaction_timestamp, local_offset_hours),
        check_new_account_large_transfer(account_age_days, amount),
    ]


def compute_risk_score(flags: list[AMLFlag]) -> tuple[float, str]:
    """Return (score 0–100, risk_level string)."""
    weights = {"HIGH": 30, "MEDIUM": 15, "LOW": 5}
    raw = sum(weights.get(f.severity, 0) for f in flags if f.triggered)
    score = min(100.0, float(raw))

    if score == 0:
        level = "NO_RISK"
    elif score <= 20:
        level = "LOW"
    elif score <= 50:
        level = "MEDIUM"
    elif score <= 75:
        level = "HIGH"
    else:
        level = "CRITICAL"

    return score, level
