"""Conversation state machine (ARCHITECTURE.md 3.5).

Five states. GREETING always advances to QUALIFYING after the first exchange.
A hot score jumps straight to CLOSING on any turn. NURTURING/PARKING are only
committed once the conversation has had room to develop, so the bot never
dismisses a visitor too early. Terminal states (CLOSING/NURTURING/PARKING)
never transition out.
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


def determine_state(score: float, hot_threshold: float, warm_threshold: float,
                    current_state: str, exchanges: int) -> str:
    """Compute the next state.

    `exchanges` = number of user messages in this conversation (>=1).
    """
    # Terminal states are sticky — once a closer commits, it stays committed.
    if current_state in TERMINAL:
        return current_state

    # A clearly hot lead is pushed to CLOSING immediately, on any turn.
    if score >= hot_threshold:
        return CLOSING

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
