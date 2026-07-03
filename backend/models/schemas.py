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
    hot_threshold: float = 12.0
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
