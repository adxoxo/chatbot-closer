"""Pydantic request/response models for the API."""
from typing import Optional

from pydantic import BaseModel, Field

# ── Default scoring weights (per ARCHITECTURE.md 3.6) ─────────────
DEFAULT_WEIGHTS = {
    "weight_bl": 1.5,
    "weight_bs": 2.0,
    "weight_pc": 1.5,
    "weight_u": 2.0,
    "weight_da": 1.0,
}

DEFAULT_BRANDING = {
    "primary_color": "#c4c0ff",
    "bot_name": "TQ Assistant",
    "logo_url": "",
    "welcome_message": "Hi! How can I help you today?",
}


# ── /chat ─────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    tenant_id: str
    conversation_id: Optional[str] = None
    message: str
    is_test: bool = False


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    state: str
    score: float
    signals: dict
    max_score: float = 16.0  # dynamic per-tenant maximum (SC-8), not a hardcoded 18
    # LLM health for this turn: ok | mock | rate_limited | timeout | error.
    # Lets the admin UI distinguish "free-tier exhausted" from "bad logic".
    llm_status: str = "ok"
    calendly_url: Optional[str] = None
    capture_email: bool = False


# ── Tenant ─────────────────────────────────────────────────────────
class TenantBranding(BaseModel):
    primary_color: str = "#c4c0ff"
    bot_name: str = "TQ Assistant"
    logo_url: str = ""
    welcome_message: str = "Hi! How can I help you today?"


class TenantCreate(BaseModel):
    name: str
    system_prompt: str
    knowledge_base: Optional[str] = ""
    calendly_url: Optional[str] = ""
    scoring_weights: dict = Field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    # Calibrated for the evidence-based rubric (SC-2/SC-8): with an honest scorer
    # a genuine hot lead lands ~10–11.5 out of a 16 max, not ≥12. The CLOSING
    # evidence gate (SC-3) — not this threshold — is what blocks contentless closes.
    hot_threshold: float = 10.0
    warm_threshold: float = 6.0
    branding: dict = Field(default_factory=lambda: dict(DEFAULT_BRANDING))
    notification_email: Optional[str] = ""
    n8n_webhook_url: Optional[str] = ""
    is_active: bool = True


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    knowledge_base: Optional[str] = None
    calendly_url: Optional[str] = None
    scoring_weights: Optional[dict] = None
    hot_threshold: Optional[float] = None
    warm_threshold: Optional[float] = None
    branding: Optional[dict] = None
    notification_email: Optional[str] = None
    n8n_webhook_url: Optional[str] = None
    is_active: Optional[bool] = None


class EmailCapture(BaseModel):
    email: str
