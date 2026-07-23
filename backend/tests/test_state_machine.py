"""Deterministic state-machine tests (SC-3, SC-4). No LLM key required."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import state_machine as sm

HOT = 12.0
WARM = 6.0

# Signal bundle that clears the evidence gate (all three closeability signals present).
FULL = {"business_legitimacy": 2, "buyable_signal": 2, "pain_clarity": 2,
        "urgency": 2, "decision_authority": 2}
# A high total built ONLY from legitimacy+authority — no buyable signal, no urgency.
LOPSIDED = {"business_legitimacy": 2, "buyable_signal": 0, "pain_clarity": 2,
            "urgency": 0, "decision_authority": 2}


def test_turn1_hot_does_not_close():
    # Score clears threshold and signals are full, but it's turn 1 → no booking.
    s = sm.determine_state(16.0, FULL, HOT, WARM, sm.GREETING, exchanges=1)
    assert s != sm.CLOSING, "a single turn-1 sample must not fire the Calendly card"


def test_hot_closes_after_min_exchanges():
    s = sm.determine_state(16.0, FULL, HOT, WARM, sm.QUALIFYING, exchanges=2)
    assert s == sm.CLOSING


def test_high_score_without_evidence_gate_does_not_close():
    # Total high enough to pass the threshold but missing buyable_signal & urgency.
    s = sm.determine_state(13.0, LOPSIDED, HOT, WARM, sm.QUALIFYING, exchanges=3)
    assert s != sm.CLOSING, "a total made of hallucinated legitimacy/pain must not close"


def test_score_below_threshold_never_closes():
    s = sm.determine_state(11.9, FULL, HOT, WARM, sm.QUALIFYING, exchanges=5)
    assert s != sm.CLOSING


def test_nurturing_promotes_to_closing_when_hot():
    # The slow-warm buyer: parked as NURTURING, then real signals land.
    s = sm.determine_state(16.0, FULL, HOT, WARM, sm.NURTURING, exchanges=4)
    assert s == sm.CLOSING, "NURTURING must not be a dead end for a lead that turns hot"


def test_parking_promotes_to_closing_when_hot():
    s = sm.determine_state(16.0, FULL, HOT, WARM, sm.PARKING, exchanges=4)
    assert s == sm.CLOSING, "PARKING must not be a dead end for a lead that turns hot"


def test_parking_recovers_to_nurturing_when_warm():
    s = sm.determine_state(7.0, LOPSIDED, HOT, WARM, sm.PARKING, exchanges=4)
    assert s == sm.NURTURING


def test_parking_stays_parking_when_still_cold():
    s = sm.determine_state(2.0, {}, HOT, WARM, sm.PARKING, exchanges=4)
    assert s == sm.PARKING


def test_closing_is_sticky():
    s = sm.determine_state(0.0, {}, HOT, WARM, sm.CLOSING, exchanges=9)
    assert s == sm.CLOSING


def test_greeting_advances_to_qualifying():
    s = sm.determine_state(3.0, {}, HOT, WARM, sm.GREETING, exchanges=1)
    assert s == sm.QUALIFYING


def test_commits_warm_after_maturing():
    s = sm.determine_state(7.0, LOPSIDED, HOT, WARM, sm.QUALIFYING,
                           exchanges=sm.COMMIT_AFTER_EXCHANGES)
    assert s == sm.NURTURING


def test_commits_cold_after_maturing():
    s = sm.determine_state(2.0, {}, HOT, WARM, sm.QUALIFYING,
                           exchanges=sm.COMMIT_AFTER_EXCHANGES)
    assert s == sm.PARKING


def test_hot_gate_helper_requires_all_three_signals():
    assert sm.hot_gate(16.0, FULL, HOT, 2) is True
    assert sm.hot_gate(16.0, LOPSIDED, HOT, 2) is False
    assert sm.hot_gate(16.0, FULL, HOT, 1) is False  # too early
    assert sm.hot_gate(11.0, FULL, HOT, 2) is False  # below threshold
