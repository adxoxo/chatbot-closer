"""Provider-agnostic LLM layer.

Priority: Groq (OpenAI-compatible) → Gemini → deterministic mock.
Whichever is configured first wins. The mock keeps the whole system runnable
with zero keys.

Two entry points used by the pipeline:
  get_completion(messages, system_prompt) -> str     (conversational reply)
  get_json(prompt, scoring=True) -> dict              (structured extraction)
"""
from __future__ import annotations

import asyncio
import contextvars
import json
import re

import httpx

import config

# ──────────────────────────────────────────────────────────────────
# Per-request LLM health tracking
# ──────────────────────────────────────────────────────────────────
# When Groq 429s / times out / errors, replies silently degrade to the mock and
# scoring degrades to the keyword heuristic — which is exactly the "the bot's
# logic is bad" symptom, with no way to tell a quota problem from a code problem.
# Every call records its outcome into a per-request context var; the chat route
# reads the worst outcome and returns it as `llm_status` so the UI can say so.
STATUS_OK = "ok"                 # a real model answered
STATUS_MOCK = "mock"             # no key configured — built-in mock/heuristic
STATUS_RATE_LIMITED = "rate_limited"  # 429, retries exhausted (free-tier TPM)
STATUS_TIMEOUT = "timeout"       # request timed out
STATUS_ERROR = "error"           # bad key / bad model / other non-200

# Worst-first: the overall status is the most severe event seen this request.
_SEVERITY = [STATUS_RATE_LIMITED, STATUS_TIMEOUT, STATUS_ERROR, STATUS_MOCK, STATUS_OK]

_status_events: contextvars.ContextVar[list] = contextvars.ContextVar("llm_status_events")


def reset_status() -> None:
    """Begin tracking a fresh request (call once at the start of the pipeline)."""
    _status_events.set([])


def _record(event: str) -> None:
    try:
        _status_events.get().append(event)
    except LookupError:
        _status_events.set([event])


def get_status() -> str:
    """Worst LLM outcome recorded since the last reset_status()."""
    try:
        events = _status_events.get()
    except LookupError:
        return STATUS_OK
    for level in _SEVERITY:
        if level in events:
            return level
    return STATUS_OK

# Groq free tier is TPM-limited; a burst of calls (or the regression suite) hits
# 429 constantly. Retry with the backoff Groq asks for so a 429 degrades to
# "slightly slower" instead of silently falling through to the keyword heuristic.
_MAX_RETRIES = 4
_MAX_BACKOFF_S = 12.0


def _retry_after_seconds(r: httpx.Response) -> float:
    header = r.headers.get("retry-after")
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    m = re.search(r"try again in ([\d.]+)\s*(ms|s)", r.text)
    if m:
        val = float(m.group(1))
        return val / 1000 if m.group(2) == "ms" else val
    return 1.0

# Optional Gemini fallback (lazy)
_gemini_model = None
if not config.USE_GROQ and config.USE_GEMINI:
    import google.generativeai as genai

    genai.configure(api_key=config.GEMINI_API_KEY)
    _gemini_model = genai.GenerativeModel(config.GEMINI_MODEL)


# ──────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────
async def get_completion(messages: list[dict], system_prompt: str) -> str:
    """Conversational reply. `messages` = [{role:user|assistant, content}] chrono."""
    if config.USE_GROQ:
        out = await _groq_chat(
            model=config.GROQ_MODEL,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            max_tokens=400,
            temperature=0.6,
        )
        return out or _mock_reply(messages, system_prompt)

    if config.USE_GEMINI:
        return await _gemini_completion(messages, system_prompt)

    _record(STATUS_MOCK)
    return _mock_reply(messages, system_prompt)


async def get_json(prompt: str, scoring: bool = False) -> dict:
    """Single-shot prompt expected to return a JSON object."""
    if config.USE_GROQ:
        model = config.GROQ_SCORING_MODEL if scoring else config.GROQ_MODEL
        out = await _groq_chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,  # nested per-signal score+evidence JSON needs headroom
            temperature=0.0,
            json_mode=True,
        )
        return _extract_json(out)

    if config.USE_GEMINI:
        return await _gemini_json(prompt)

    _record(STATUS_MOCK)
    return {}


# ──────────────────────────────────────────────────────────────────
# Groq (OpenAI-compatible)
# ──────────────────────────────────────────────────────────────────
async def _groq_chat(model: str, messages: list[dict], max_tokens: int,
                     temperature: float, json_mode: bool = False) -> str:
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(_MAX_RETRIES + 1):
                r = await client.post(
                    f"{config.GROQ_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
                    json=body,
                )
                if r.status_code == 429:
                    if attempt < _MAX_RETRIES:
                        wait = min(_retry_after_seconds(r) + 0.25, _MAX_BACKOFF_S)
                        print(f"[groq] 429 rate-limited, retry {attempt + 1}/{_MAX_RETRIES} in {wait:.2f}s")
                        await asyncio.sleep(wait)
                        continue
                    print("[groq] 429 rate-limited — retries exhausted (free-tier TPM?)")
                    _record(STATUS_RATE_LIMITED)
                    return ""
                if r.status_code != 200:
                    print(f"[groq] {r.status_code}: {r.text[:200]}")
                    _record(STATUS_ERROR)
                    return ""
                data = r.json()
                _record(STATUS_OK)
                return (data["choices"][0]["message"]["content"] or "").strip()
            _record(STATUS_RATE_LIMITED)
            return ""  # exhausted retries
    except httpx.TimeoutException as e:
        print(f"[groq] timeout: {e}")
        _record(STATUS_TIMEOUT)
        return ""
    except Exception as e:
        print(f"[groq] error: {e}")
        _record(STATUS_ERROR)
        return ""


# ──────────────────────────────────────────────────────────────────
# Gemini fallback
# ──────────────────────────────────────────────────────────────────
async def _gemini_completion(messages: list[dict], system_prompt: str) -> str:
    contents = [
        {"role": "user" if m["role"] == "user" else "model", "parts": [m["content"]]}
        for m in messages
    ]
    try:
        import google.generativeai as genai

        model = genai.GenerativeModel(config.GEMINI_MODEL, system_instruction=system_prompt)
        resp = await model.generate_content_async(contents)
        text = (resp.text or "").strip()
        _record(STATUS_OK if text else STATUS_MOCK)
        return text or _mock_reply(messages, system_prompt)
    except Exception as e:
        print(f"[gemini] completion error: {e}")
        _record(STATUS_ERROR)
        return _mock_reply(messages, system_prompt)


async def _gemini_json(prompt: str) -> dict:
    try:
        import google.generativeai as genai

        model = genai.GenerativeModel(config.GEMINI_MODEL)
        resp = await model.generate_content_async(prompt)
        _record(STATUS_OK)
        return _extract_json(resp.text or "")
    except Exception as e:
        print(f"[gemini] json error: {e}")
        _record(STATUS_ERROR)
        return {}


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────
def _extract_json(text: str) -> dict:
    if not text:
        return {}
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)
    try:
        return json.loads(text)
    except Exception:
        return {}


# ── Deterministic mock closer (zero-key safety net) ─────────────────
_HOT_HINTS = ["ad spend", "google ads", "$", "k/month", "per month", "leads", "revenue",
              "traffic", "asap", "now", "this week", "this month", "urgent", "decision",
              "owner", "founder", "ceo", "budget", "spend", "campaign"]


def _mock_reply(messages: list[dict], system_prompt: str) -> str:
    user_msgs = [m["content"] for m in messages if m["role"] == "user"]
    last = user_msgs[-1].lower() if user_msgs else ""
    turns = len(user_msgs)
    score_hint = sum(1 for h in _HOT_HINTS if h in last)

    if turns <= 1:
        return ("Great to meet you. To point you in the right direction — what does your "
                "business do, and what's the single biggest gap costing you money right now?")
    if score_hint >= 3:
        return ("That's a strong signal — real spend and a clear gap. Rather than keep asking "
                "questions, the fastest path is a quick call with our team to map the fix. "
                "Grab a time that works for you and we'll take it from there.")
    if score_hint >= 1:
        return ("Got it — sounds like there's real opportunity here. Are you looking to fix "
                "this now, or is it more of a someday thing? And are you the one who'd green-light it?")
    return ("Understood. Can you tell me a bit more about the scale you're working at — "
            "monthly traffic, ad spend, or revenue — so I can tell whether we're the right fit?")
