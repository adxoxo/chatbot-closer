"""Hot-lead notifications: fire-and-forget POSTs to a per-tenant n8n webhook.

Three event types, all to the same `n8n_webhook_url`, distinguished by the
`event_type` field so a single n8n workflow can branch:

  - lead_qualified  : bot scored the visitor hot (first CLOSING transition)
  - email_captured  : visitor submitted their email (NURTURING card)
  - call_booked     : visitor clicked "Book My Call" (CLOSING card)

n8n owns the downstream fan-out (email, Slack, CRM…). If a tenant has no
webhook the event is skipped silently. Every POST is wrapped in try/except —
a failed notification is logged but never blocks the request.
"""
from __future__ import annotations

import httpx


def summarize_user(messages: list[dict], n: int = 3) -> str:
    """Last `n` user messages joined as plain text — context for n8n."""
    user_msgs = [m["content"] for m in messages if m.get("role") == "user"]
    return "\n".join(user_msgs[-n:])


async def send_event(tenant: dict, lead: dict, event_type: str,
                     conversation_summary: str = ""):
    """POST a single lead event to the tenant's n8n webhook (fire-and-forget)."""
    webhook = (tenant.get("n8n_webhook_url") or "").strip()
    if not webhook:
        return  # no webhook configured → skip silently

    payload = {
        "event_type": event_type,
        "tenant_name": tenant.get("name", ""),
        "notification_email": tenant.get("notification_email", "") or "",
        "lead_email": lead.get("email") or "",
        "lead_score": lead.get("score", 0.0),
        "signals": lead.get("signals", {}) or {},
        "conversation_summary": conversation_summary,
        "calendly_url": tenant.get("calendly_url", "") or "",
        "conversation_id": lead.get("conversation_id", ""),
    }

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            await client.post(webhook, json=payload)
    except Exception as e:  # never let a failed notification block the request
        print(f"[notify:n8n] {event_type} failed: {e}")
