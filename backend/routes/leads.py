"""Lead + conversation read endpoints (admin), plus public email capture."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import EmailCapture
from routes.auth import require_admin
from services import notifications
from services.supabase import store

router = APIRouter()


@router.get("/leads", dependencies=[Depends(require_admin)])
def list_leads(include_test: bool = False, tenant_id: str | None = None,
               priority: str | None = None):
    leads = store.list_leads(include_test=include_test)
    # Attach tenant names for the admin table.
    tenants = {t["id"]: t["name"] for t in store.list_tenants()}
    for lead in leads:
        lead["tenant_name"] = tenants.get(lead.get("tenant_id"), "—")
    if tenant_id:
        leads = [l for l in leads if l.get("tenant_id") == tenant_id]
    if priority:
        leads = [l for l in leads if l.get("priority") == priority]
    return leads


@router.get("/leads/{conversation_id}", dependencies=[Depends(require_admin)])
def get_lead(conversation_id: str):
    lead = store.get_lead_by_conversation(conversation_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    messages = store.get_messages(conversation_id)
    conversation = store.get_conversation(conversation_id)
    return {"lead": lead, "conversation": conversation, "messages": messages}


@router.post("/leads/{conversation_id}/email")
async def capture_email(conversation_id: str, body: EmailCapture):
    """Public — called by the widget's NURTURING email capture card.

    Stores the email and fires an `email_captured` event to n8n (real leads only).
    """
    lead = store.set_lead_email(conversation_id, body.email.strip())
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.get("is_test"):
        tenant = store.get_tenant(lead["tenant_id"])
        if tenant:
            summary = notifications.summarize_user(store.get_messages(conversation_id))
            await notifications.send_event(tenant, lead, "email_captured", summary)
    return {"ok": True}


@router.post("/leads/{conversation_id}/booked")
async def mark_booked(conversation_id: str):
    """Public — called when the visitor clicks 'Book My Call' (CLOSING card).

    Fires a `call_booked` event to n8n (real leads only). Signals booking intent;
    Calendly itself confirms the actual booking.
    """
    lead = store.get_lead_by_conversation(conversation_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.get("is_test"):
        tenant = store.get_tenant(lead["tenant_id"])
        if tenant:
            summary = notifications.summarize_user(store.get_messages(conversation_id))
            await notifications.send_event(tenant, lead, "call_booked", summary)
    return {"ok": True}


@router.delete("/conversation/{conversation_id}", dependencies=[Depends(require_admin)])
def delete_conversation(conversation_id: str):
    store.delete_conversation(conversation_id)
    return {"ok": True}
