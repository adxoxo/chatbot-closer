"""Conversation state machine (ARCHITECTURE.md 3.5).

Five states. GREETING always advances to QUALIFYING after the first exchange.

A lead is promoted to CLOSING only when it clears the HOT GATE (SC-3): the
weighted score is at/above the hot threshold AND the visitor has actually shown
the three signals that make a lead closeable — a buyable signal, some urgency,
and a legitimate business. A total made purely of one hallucinated signal no
longer books a call. CLOSING also requires at least two exchanges, so a single
noisy turn-1 score can't fire the Calendly card (a real hot lead loses ~15s; a
false positive is prevented).

CLOSING is the only truly sticky state — once a closer commits, it stays
committed. NURTURING and PARKING are NOT dead ends (SC-4): a visitor who warms
up slowly (the classic "things are ok" → "actually we spend $20k/mo" arc) is
still promoted to CLOSING the moment they clear the hot gate. PARKING can also
recover to NURTURING.
"""
from __future__ import annotations

GREETING = "GREETING"
QUALIFYING = "QUALIFYING"
CLOSING = "CLOSING"
NURTURING = "NURTURING"
PARKING = "PARKING"

TERMINAL = {CLOSING, NURTURING, PARKING}
STATE_PRIORITY = {CLOSING: "hot", NURTURING: "warm", PARKING: "cold"}

# How many user turns to keep probing before committing to warm/cold.
COMMIT_AFTER_EXCHANGES = 4

# Minimum exchanges before a lead can be pushed to CLOSING (SC-3).
MIN_EXCHANGES_TO_CLOSE = 2


def hot_gate(score: float, signals: dict, hot_threshold: float, exchanges: int) -> bool:
    """Whether a lead has genuinely earned the Calendly card (SC-3).

    Requires: the score clears the hot threshold, the conversation has had at
    least MIN_EXCHANGES_TO_CLOSE turns, AND the three closeability signals are
    each present — so a score built entirely from one hallucinated signal, or a
    hot score on turn one, cannot close.
    """
    signals = signals or {}
    if score < hot_threshold:
        return False
    if exchanges < MIN_EXCHANGES_TO_CLOSE:
        return False
    return (
        signals.get("buyable_signal", 0) >= 1
        and signals.get("urgency", 0) >= 1
        and signals.get("business_legitimacy", 0) >= 1
    )


def determine_state(score: float, signals: dict, hot_threshold: float,
                    warm_threshold: float, current_state: str, exchanges: int) -> str:
    """Compute the next state.

    `signals` = {signal_key: 0..2} for the conversation so far.
    `exchanges` = number of user messages in this conversation (>=1).
    """
    hot = hot_gate(score, signals, hot_threshold, exchanges)

    # CLOSING is the only truly sticky state.
    if current_state == CLOSING:
        return CLOSING

    # A genuinely hot lead is promoted to CLOSING from ANY state (SC-4) — a
    # slow-warming buyer who finally shows real signals is not lost to a sticky
    # NURTURING/PARKING label.
    if hot:
        return CLOSING

    # Non-closing terminal states can still recover upward but never re-open
    # into an active qualification loop.
    if current_state == NURTURING:
        return NURTURING
    if current_state == PARKING:
        # Allow PARKING → NURTURING if the lead has warmed to at least warm.
        return NURTURING if score >= warm_threshold else PARKING

    # Greeting always hands off to qualifying.
    if current_state == GREETING:
        return QUALIFYING

    # Keep qualifying until the conversation has matured, then commit.
    if exchanges < COMMIT_AFTER_EXCHANGES:
        return QUALIFYING

    if score >= warm_threshold:
        return NURTURING
    return PARKING


def priority_for_state(state: str) -> str:
    return STATE_PRIORITY.get(state, "cold")
