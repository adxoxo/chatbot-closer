"""End-to-end persona regression against the REAL scoring pipeline.

Runs each scripted persona (tests/personas.py) through the actual brain —
score_conversation → calculate_score → determine_state — turn by turn, and
asserts the behavioural contract (expect_hot / forbid_hot / no_close_turn1).

This is the single test the whole product is judged on: does a high-intent
visitor get booked, and does a vague one get left alone? It needs a live LLM
key (DEEPSEEK_API_KEY, GROQ_API_KEY or GEMINI_API_KEY); without one it skips, since the
deterministic keyword heuristic is not the thing under test.

Scoring is user-only, so we don't need to interleave real assistant replies to
reproduce the brain faithfully — `exchanges` is just the number of user turns.
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from services import scoring_engine as se
from services import state_machine as sm
from tests.personas import PERSONAS

HOT_THRESHOLD = 10.0  # matches the recalibrated tenant default (SC-8)
WARM_THRESHOLD = 6.0


def _live_available() -> bool:
    return bool(config.USE_DEEPSEEK or config.USE_GROQ or config.USE_GEMINI)


async def _walk(messages: list[str]) -> list[dict]:
    """Replay a persona turn by turn, returning the trajectory."""
    history: list[dict] = []
    state = sm.GREETING
    trace = []
    for msg in messages:
        history.append({"role": "user", "content": msg})
        signals, evidence = await se.score_conversation(history)
        score = se.calculate_score(signals, None)
        exchanges = sum(1 for m in history if m["role"] == "user")
        state = sm.determine_state(score, signals, HOT_THRESHOLD, WARM_THRESHOLD,
                                   state, exchanges)
        trace.append({"msg": msg, "score": score, "state": state,
                      "signals": signals, "evidence": evidence})
    return trace


def _check_persona(p: dict) -> list[str]:
    trace = asyncio.new_event_loop().run_until_complete(_walk(p["messages"]))
    states = [t["state"] for t in trace]
    failures = []

    if p.get("expect_hot") and states[-1] != sm.CLOSING:
        failures.append(f"expected CLOSING by the end, got trajectory {states}")
    if p.get("forbid_hot") and sm.CLOSING in states:
        failures.append(f"must never reach CLOSING, got trajectory {states}")
    if p.get("no_close_turn1") and states[0] == sm.CLOSING:
        failures.append("must not be CLOSING after turn 1")

    if failures:
        # Print the scored trajectory so a real failure is debuggable / tunable.
        print(f"\n  ── persona '{p['name']}' trajectory ──")
        for t in trace:
            print(f"    score={t['score']:>5}  {t['state']:<10} <- {t['msg'][:60]!r}")
    return [f"[{p['name']}] {f}" for f in failures]


def _assert_all_personas():
    all_failures = []
    for p in PERSONAS:
        all_failures.extend(_check_persona(p))
    assert not all_failures, "persona contract failures:\n  - " + "\n  - ".join(all_failures)


def test_personas_live():
    if not _live_available():
        try:
            import pytest
            pytest.skip("no LLM key configured (set GROQ_API_KEY to run persona regression)")
        except ImportError:
            print("[SKIP] test_personas_live — no LLM key configured")
            return
    _assert_all_personas()
