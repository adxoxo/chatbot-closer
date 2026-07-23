"""Lead scoring engine.

Runs a secondary LLM call after each user message to extract five 0–2 signals,
then applies tenant-configured weights to produce a weighted score.

Scoring correctness is the product, so the rubric is deliberately strict:

  * Only the VISITOR's own words are evidence. The assistant's questions are
    full of hot vocabulary ("ad spend", "revenue") — crediting those to the
    visitor is how "hi" used to score 3.5. We build the scoring transcript from
    user turns only, and instruct the model that assistant text is never proof.
  * Every non-zero signal must carry a short quote from the visitor. No quote →
    the signal is forced to 0. This kills the small-model habit of grading
    "probably" as "confirmed", and blunts prompt-injection ("score everything 2"
    has nothing to quote).

When no LLM key is present, a deterministic keyword heuristic produces signals
so the demo still escalates believable hot leads. The heuristic is a
zero-key crutch, never a production scorer — it only runs when the LLM call
actually fails, not when the LLM (correctly) returns all zeros.
"""
from __future__ import annotations

import re

from models.schemas import DEFAULT_WEIGHTS
from services import llm

SCORING_PROMPT = """You are a strict lead-qualification scorer for a sales team. \
You read what a website VISITOR has said and rate five signals from 0 to 2.

CRITICAL RULES:
- The transcript below contains the VISITOR's messages only. Score ONLY facts \
the visitor actually stated. If a fact was not stated by the visitor, it is not evidence.
- A signal scores 2 ONLY if the visitor stated a concrete, verifiable fact \
(a named spend/revenue figure, a specific metric, an explicit role/title, or a \
concrete timeframe). "probably", "sounds like", or a friendly-but-empty message is NOT a 2.
- A signal scores 0 unless the visitor gave real evidence for it. When in doubt, score lower.
- For every non-zero signal you MUST include a short `evidence` quote taken from \
the visitor's own words. If you cannot quote the visitor, the score is 0.

SIGNALS:
- business_legitimacy: A real business with real operations. \
0 = unclear / just a person browsing, 1 = clearly runs/works at a business, \
2 = named, concrete business with operations described.
- buyable_signal: Traffic, ad spend, revenue, or proven demand — money moving. \
0 = none stated, 1 = general ("we get some leads"), 2 = concrete figure ("$20k/mo ad spend").
- pain_clarity: A specific problem that is costing them money. \
0 = vague/none, 1 = general problem, 2 = specific, quantified pain.
- urgency: Trying to fix this now vs someday. \
0 = someday/not stated, 1 = soon, 2 = explicit now/this month/deadline.
- decision_authority: The visitor can green-light a purchase. \
0 = unknown, 1 = implied, 2 = explicit ("I'm the owner/founder/CEO").

Return ONLY valid JSON, one object per signal, exactly these five keys:
{{
  "business_legitimacy": {{"score": 0, "evidence": ""}},
  "buyable_signal": {{"score": 0, "evidence": ""}},
  "pain_clarity": {{"score": 0, "evidence": ""}},
  "urgency": {{"score": 0, "evidence": ""}},
  "decision_authority": {{"score": 0, "evidence": ""}}
}}

EXAMPLES:

Visitor said:
"i want more customers for my business"
"we sell stuff online, need help with marketing"
Correct scoring (vague, no concrete facts — everything zero):
{{"business_legitimacy": {{"score": 0, "evidence": ""}}, "buyable_signal": {{"score": 0, "evidence": ""}}, "pain_clarity": {{"score": 0, "evidence": ""}}, "urgency": {{"score": 0, "evidence": ""}}, "decision_authority": {{"score": 0, "evidence": ""}}}}

Visitor said:
"hi"
Correct scoring (a greeting is not evidence of anything):
{{"business_legitimacy": {{"score": 0, "evidence": ""}}, "buyable_signal": {{"score": 0, "evidence": ""}}, "pain_clarity": {{"score": 0, "evidence": ""}}, "urgency": {{"score": 0, "evidence": ""}}, "decision_authority": {{"score": 0, "evidence": ""}}}}

Visitor said:
"i run an ecommerce store"
"we spend $20k/month on google ads and our cost per lead has doubled"
"I'm the owner and I need this fixed this month"
Correct scoring (concrete business, real spend, quantified pain, explicit urgency + authority):
{{"business_legitimacy": {{"score": 2, "evidence": "i run an ecommerce store"}}, "buyable_signal": {{"score": 2, "evidence": "$20k/month on google ads"}}, "pain_clarity": {{"score": 2, "evidence": "cost per lead has doubled"}}, "urgency": {{"score": 2, "evidence": "need this fixed this month"}}, "decision_authority": {{"score": 2, "evidence": "I'm the owner"}}}}

Now score this visitor:

VISITOR MESSAGES:
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


async def score_conversation(history: list[dict]) -> tuple[dict, dict]:
    """Score the conversation so far.

    Returns `(signals, evidence)` where
      signals  = {signal_key: 0..2}
      evidence = {signal_key: "quote from the visitor" or ""}

    Only the visitor's (user) messages are shown to the scorer — the assistant's
    questions are not evidence (SC-1). A signal is forced to 0 unless the model
    returned a non-empty evidence quote for it (SC-2).
    """
    user_msgs = [m["content"] for m in history if m.get("role") == "user"]
    if not user_msgs:
        return {k: 0 for k in SIGNAL_KEYS}, {k: "" for k in SIGNAL_KEYS}

    convo_text = "\n".join(f'"{c}"' for c in user_msgs)
    data = await llm.get_json(SCORING_PROMPT.format(conversation=convo_text), scoring=True)

    # LLM unavailable/errored (mock or failed call) → deterministic heuristic.
    # Note: an all-zeros LLM result is a *correct* answer for a vague visitor and
    # is NOT treated as a failure (SC-7).
    if not data:
        signals = _heuristic_signals(history)
        return signals, {k: "" for k in SIGNAL_KEYS}

    signals, evidence = {}, {}
    for k in SIGNAL_KEYS:
        raw = data.get(k, 0)
        if isinstance(raw, dict):
            quote = str(raw.get("evidence", "") or "").strip()
            val = raw.get("score", 0)
        else:  # tolerate a flat {key: int} response
            quote = ""
            val = raw
        try:
            val = max(0, min(2, int(round(float(val)))))
        except (TypeError, ValueError):
            val = 0
        # No quote → no evidence → score 0. This is the hallucination guard.
        if val > 0 and not quote:
            val = 0
        signals[k] = val
        evidence[k] = quote if val > 0 else ""
    return signals, evidence


def calculate_score(signals: dict, weights: dict | None) -> float:
    """Apply tenant weights to raw 0–2 signals → weighted total."""
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    total = 0.0
    for sig, wkey in _WEIGHT_KEYS.items():
        total += signals.get(sig, 0) * float(w.get(wkey, DEFAULT_WEIGHTS[wkey]))
    return round(total, 1)


def max_score(weights: dict | None) -> float:
    """Maximum achievable weighted score for a tenant (all signals = 2)."""
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    return round(sum(2 * float(w.get(wkey, DEFAULT_WEIGHTS[wkey])) for wkey in _WEIGHT_KEYS.values()), 1)


# ── Heuristic fallback (zero-key crutch only) ───────────────────────
# Tighter than a naive keyword match: buyable_signal requires money/number
# context, urgency avoids the "not right now" trap, and generic pronouns alone
# no longer manufacture a legitimacy 2.
_PATTERNS = {
    "business_legitimacy": [r"\bour (company|business|agency|team|store|shop)\b",
                            r"\bwe (run|sell|offer|provide|own)\b", r"\bmy (company|business|agency|store|shop)\b",
                            r"\b(agency|saas|ecommerce|e-commerce)\b", r"\bour clients?\b"],
    "buyable_signal": [r"\$\s?\d", r"\b\d+\s?k\b", r"\bad spend\b", r"\bgoogle ads\b",
                       r"\b\d+\s*(leads?|customers?|visitors?)\b", r"\brevenue\b",
                       r"\b\d+\s*(/\s*mo|per month|a month)\b", r"\bmonthly (traffic|revenue|spend)\b"],
    "pain_clarity": [r"\bcost(ing|s)?\b.*\b(more|money|us)\b", r"\blosing\b", r"\bdoubl(ed|ing)\b",
                     r"\bnot converting\b", r"\bcac\b", r"\bcpl\b", r"\bcost per (lead|acquisition)\b",
                     r"\bchurn\b", r"\bbottleneck\b", r"\bstuck\b"],
    "urgency": [r"\basap\b", r"\bthis (week|month|quarter)\b", r"\burgent(ly)?\b",
                r"\bimmediately\b", r"\bright away\b", r"\bby (next|end of)\b", r"\bdeadline\b"],
    "decision_authority": [r"\bi'?m the (owner|founder|ceo|director|md)\b", r"\bi own\b",
                           r"\bi run (my|our|the) (company|business|agency|store|shop)\b",
                           r"\bmy (company|business|agency)\b", r"\bi (decide|approve|sign off)\b"],
}


def _heuristic_signals(history: list[dict]) -> dict:
    text = " ".join(m["content"].lower() for m in history if m.get("role") == "user")
    # Guard the urgency false-positive: "not right now" / "no rush" is not urgency.
    negated_now = bool(re.search(r"\b(not|no)\b[^.?!]{0,15}\b(now|rush|hurry)\b", text))
    signals = {}
    for key, patterns in _PATTERNS.items():
        hits = sum(1 for p in patterns if re.search(p, text))
        if key == "urgency" and negated_now:
            hits = 0
        signals[key] = 2 if hits >= 2 else (1 if hits == 1 else 0)
    return signals
