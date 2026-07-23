"""Tests for per-request LLM health tracking (the UI degradation banner).

Pure-logic only — no network, no key, no real LLM calls."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

from services import llm


def test_empty_status_is_ok():
    llm.reset_status()
    assert llm.get_status() == llm.STATUS_OK


def test_ok_only_stays_ok():
    llm.reset_status()
    llm._record(llm.STATUS_OK)
    llm._record(llm.STATUS_OK)
    assert llm.get_status() == llm.STATUS_OK


def test_worst_of_wins_rate_limited_over_ok():
    llm.reset_status()
    llm._record(llm.STATUS_OK)
    llm._record(llm.STATUS_RATE_LIMITED)
    assert llm.get_status() == llm.STATUS_RATE_LIMITED


def test_rate_limited_outranks_error_and_mock():
    llm.reset_status()
    llm._record(llm.STATUS_MOCK)
    llm._record(llm.STATUS_ERROR)
    llm._record(llm.STATUS_RATE_LIMITED)
    assert llm.get_status() == llm.STATUS_RATE_LIMITED


def test_error_outranks_mock():
    llm.reset_status()
    llm._record(llm.STATUS_MOCK)
    llm._record(llm.STATUS_ERROR)
    assert llm.get_status() == llm.STATUS_ERROR


def test_mock_reported_when_only_mock():
    llm.reset_status()
    llm._record(llm.STATUS_MOCK)
    assert llm.get_status() == llm.STATUS_MOCK


def test_reset_clears_previous_request():
    llm.reset_status()
    llm._record(llm.STATUS_RATE_LIMITED)
    llm.reset_status()
    assert llm.get_status() == llm.STATUS_OK


# ── retry-after parsing ───────────────────────────────────────────────
def test_retry_after_header_seconds():
    r = httpx.Response(429, headers={"retry-after": "3"}, content=b"")
    assert llm._retry_after_seconds(r) == 3.0


def test_retry_after_from_body_seconds():
    r = httpx.Response(429, content=b'{"error":"Please try again in 1.47s. Upgrade..."}')
    assert abs(llm._retry_after_seconds(r) - 1.47) < 1e-6


def test_retry_after_from_body_millis():
    r = httpx.Response(429, content=b'{"error":"Please try again in 915ms."}')
    assert abs(llm._retry_after_seconds(r) - 0.915) < 1e-6


def test_retry_after_default_when_absent():
    r = httpx.Response(429, content=b"no hint here")
    assert llm._retry_after_seconds(r) == 1.0
