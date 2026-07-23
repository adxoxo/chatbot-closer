"""Scoring-engine tests (SC-1, SC-2, SC-7, SC-8).

No live LLM key required — the LLM is monkeypatched (plain attribute swap so it
works under pytest and the zero-dep runner alike).
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.schemas import DEFAULT_WEIGHTS
from services import scoring_engine as se


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


class _FakeLLM:
    """Stands in for services.llm during a single test."""
    def __init__(self, response=None, capture=None):
        self._response = response if response is not None else {}
        self._capture = capture  # list to append received prompts to

    async def get_json(self, prompt, scoring=False):
        if self._capture is not None:
            self._capture.append(prompt)
        return self._response


def _patch_llm(fake):
    original = se.llm.get_json
    se.llm.get_json = fake.get_json
    return lambda: setattr(se.llm, "get_json", original)


# ── SC-8: score math ────────────────────────────────────────────────
def test_max_score_default_is_16_not_18():
    assert se.max_score(None) == 16.0
    assert se.max_score(DEFAULT_WEIGHTS) == 16.0


def test_max_score_tracks_custom_weights():
    w = {"weight_bl": 1, "weight_bs": 1, "weight_pc": 1, "weight_u": 1, "weight_da": 1}
    assert se.max_score(w) == 10.0  # 5 signals * 2 * 1


def test_calculate_score_applies_weights():
    signals = {"business_legitimacy": 2, "buyable_signal": 2, "pain_clarity": 0,
               "urgency": 0, "decision_authority": 0}
    # 2*1.5 + 2*2.0 = 7.0
    assert se.calculate_score(signals, None) == 7.0


# ── SC-1: assistant messages are never shown to the scorer ────────────
def test_scorer_only_sees_user_messages():
    captured = []
    restore = _patch_llm(_FakeLLM(response={}, capture=captured))
    try:
        # Distinctive tokens that can't appear in the rubric/few-shot template,
        # so a match proves the content came from the message (not the prompt).
        history = [
            {"role": "assistant", "content": "Tell me your ZEBRAQUUX and PINEAPPLE_TELEMETRY."},
            {"role": "user", "content": "MAGENTA_WIDGET hi"},
        ]
        _run(se.score_conversation(history))
    finally:
        restore()
    assert captured, "scorer should have been called"
    prompt = captured[0]
    assert "zebraquux" not in prompt.lower(), "assistant text must not reach the scorer (SC-1)"
    assert "pineapple_telemetry" not in prompt.lower()
    assert "MAGENTA_WIDGET" in prompt, "the visitor's own message must reach the scorer"


# ── SC-2: a signal with no evidence quote is forced to 0 ──────────────
def test_signal_without_evidence_is_zeroed():
    resp = {
        "business_legitimacy": {"score": 2, "evidence": ""},   # no quote → 0
        "buyable_signal": {"score": 2, "evidence": "$20k/mo ad spend"},  # quote → kept
        "pain_clarity": {"score": 1, "evidence": ""},          # no quote → 0
        "urgency": {"score": 0, "evidence": ""},
        "decision_authority": {"score": 2, "evidence": "I'm the owner"},
    }
    restore = _patch_llm(_FakeLLM(response=resp))
    try:
        signals, evidence = _run(se.score_conversation([{"role": "user", "content": "x"}]))
    finally:
        restore()
    assert signals["business_legitimacy"] == 0
    assert signals["pain_clarity"] == 0
    assert signals["buyable_signal"] == 2
    assert signals["decision_authority"] == 2
    assert evidence["buyable_signal"] == "$20k/mo ad spend"


# ── SC-7: heuristic fires only on LLM failure, not on a correct all-zeros ──
def test_all_zeros_llm_is_respected_not_overridden():
    # Hot-looking text, but the LLM returned a valid all-zeros verdict.
    resp = {k: {"score": 0, "evidence": ""} for k in se.SIGNAL_KEYS}
    restore = _patch_llm(_FakeLLM(response=resp))
    try:
        signals, _ = _run(se.score_conversation(
            [{"role": "user", "content": "we spend $20k/month on google ads"}]))
    finally:
        restore()
    assert sum(signals.values()) == 0, "a valid all-zeros LLM result must NOT trigger the heuristic"


def test_empty_llm_falls_back_to_heuristic():
    restore = _patch_llm(_FakeLLM(response={}))  # simulates a failed/absent LLM
    try:
        signals, _ = _run(se.score_conversation(
            [{"role": "user", "content": "we spend $20k/month on google ads, i'm the owner"}]))
    finally:
        restore()
    assert sum(signals.values()) > 0, "empty LLM response should fall back to the heuristic"


# ── Heuristic sanity (the zero-key crutch) ────────────────────────────
def test_heuristic_hi_is_all_zeros():
    assert sum(se._heuristic_signals([{"role": "user", "content": "hi"}]).values()) == 0


def test_heuristic_not_right_now_is_not_urgent():
    sig = se._heuristic_signals([{"role": "user", "content": "not right now, maybe later"}])
    assert sig["urgency"] == 0, "'not right now' must not read as urgency"


def test_heuristic_credits_concrete_hot_signals():
    sig = se._heuristic_signals([{"role": "user",
        "content": "we spend $20k/month on google ads and i'm the owner"}])
    assert sig["buyable_signal"] >= 1
    assert sig["decision_authority"] >= 1


def test_scorer_ignores_empty_history():
    signals, evidence = _run(se.score_conversation([]))
    assert sum(signals.values()) == 0
    assert all(v == "" for v in evidence.values())
