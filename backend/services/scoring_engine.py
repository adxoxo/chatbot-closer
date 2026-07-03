"""Lead scoring engine.

Runs a secondary LLM call after each user message to extract five 0–2 signals,
then applies tenant-configured weights to produce a weighted score (max 18.0).

When no LLM key is present, a deterministic keyword heuristic produces signals
so the demo still escalates believable hot leads.
"""
from __future__ import annotations

import re

from models.schemas import DEFAULT_WEIGHTS
from services import llm

SCORING_PROMPT = """You are a lead scoring assistant. Read the conversation below and score each signal from 0 to 2.

Signals:
- business_legitimacy: Is this a real business with real operations? (0 = unclear/no, 1 = probably, 2 = confirmed)
- buyable_signal: Do they have traffic, ad spend, revenue, or proven demand? (0 = none, 1 = some, 2 = strong)
- pain_clarity: Is the specific problem costing them money clear? (0 = vague, 1 = general, 2 = specific)
- urgency: Are they trying to fix this now or someday? (0 = someday, 1 = soon, 2 = now)
- decision_authority: Are they the decision maker? (0 = unknown, 1 = probably, 2 = confirmed)

Return only valid JSON with exactly these five integer keys. No explanation.

CONVERSATION:
{conversation}
"""

SIGNAL_KEYS = [
    "business_legitimacy",
    "buyable_signal",
    "pain_clarity",
    "urgency",
    "decision_authority",
]

# Maps each signal key to its tenant weight key.
_WEIGHT_KEYS = {
    "business_legitimacy": "weight_bl",
    "buyable_signal": "weight_bs",
    "pain_clarity": "weight_pc",
    "urgency": "weight_u",
    "decision_authority": "weight_da",
}


async def score_conversation(history: list[dict]) -> dict:
    """Return {signal_key: 0..2} for the conversation so far."""
    convo_text = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history)
    data = await llm.get_json(SCORING_PROMPT.format(conversation=convo_text), scoring=True)

    signals = {}
    for k in SIGNAL_KEYS:
        try:
            signals[k] = max(0, min(2, int(round(float(data.get(k, 0))))))
        except (TypeError, ValueError):
            signals[k] = 0

    # If the LLM is mocked (empty dict) or returned all zeros, use the heuristic.
    if not data or sum(signals.values()) == 0:
        return _heuristic_signals(history)
    return signals


def calculate_score(signals: dict, weights: dict | None) -> float:
    """Apply tenant weights to raw 0–2 signals → weighted total (max 18.0)."""
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    total = 0.0
    for sig, wkey in _WEIGHT_KEYS.items():
        total += signals.get(sig, 0) * float(w.get(wkey, DEFAULT_WEIGHTS[wkey]))
    return round(total, 1)


# ── Heuristic fallback ──────────────────────────────────────────────
_PATTERNS = {
    "business_legitimacy": [r"\bwe\b", r"\bour\b", r"company", r"agency", r"business",
                            r"team", r"clients?", r"customers?"],
    "buyable_signal": [r"\$\s?\d", r"\d+\s?k", r"ad spend", r"google ads", r"revenue",
                       r"traffic", r"leads?", r"per month", r"/month", r"campaign", r"budget"],
    "pain_clarity": [r"cost(ing|s)?", r"losing", r"problem", r"gap", r"not converting",
                     r"cac", r"cpl", r"cost per", r"churn", r"bottleneck"],
    "urgency": [r"\basap\b", r"\bnow\b", r"this week", r"this month", r"urgent",
                r"immediately", r"right away", r"next month"],
    "decision_authority": [r"\bi\b.*(decide|approve|own)", r"owner", r"founder",
                           r"ceo", r"\bi run\b", r"my (company|business|agency)", r"i'?m the"],
}


def _heuristic_signals(history: list[dict]) -> dict:
    text = " ".join(m["content"].lower() for m in history if m["role"] == "user")
    signals = {}
    for key, patterns in _PATTERNS.items():
        hits = sum(1 for p in patterns if re.search(p, text))
        signals[key] = 2 if hits >= 2 else (1 if hits == 1 else 0)
    return signals
