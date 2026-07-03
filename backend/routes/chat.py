"""POST /chat — the full conversation pipeline (ARCHITECTURE.md 3.4)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.schemas import ChatRequest, ChatResponse
from services import llm, notifications, prompt_builder, scoring_engine, state_machine
from services.supabase import store

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # 1. Load tenant config
    tenant = store.get_tenant(req.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.get("is_active", True):
        raise HTTPException(status_code=403, detail="Tenant is inactive")

    # 2. Fetch or create the conversation
    conversation = None
    if req.conversation_id:
        conversation = store.get_conversation(req.conversation_id)
    if not conversation:
        conversation = store.create_conversation(req.tenant_id, req.is_test)
    conversation_id = conversation["id"]
    prev_state = conversation.get("state", state_machine.GREETING)

    # 3. Fetch history
    history = store.get_messages(conversation_id)

    # 4 + 5. Build prompt → Gemini reply
    system_prompt, messages = prompt_builder.build_prompt(tenant, history, req.message)
    reply = await llm.get_completion(messages, system_prompt)

    # 8. Persist both messages (do this before scoring so scorer sees full convo)
    store.save_message(conversation_id, "user", req.message)
    store.save_message(conversation_id, "assistant", reply)
    full_history = history + [
        {"role": "user", "content": req.message},
        {"role": "assistant", "content": reply},
    ]
    exchanges = sum(1 for m in full_history if m["role"] == "user")

    # 6. Score the conversation
    signals = await scoring_engine.score_conversation(full_history)
    score = scoring_engine.calculate_score(signals, tenant.get("scoring_weights"))

    # 7. State machine
    new_state = state_machine.determine_state(
        score=score,
        hot_threshold=float(tenant.get("hot_threshold", 12.0)),
        warm_threshold=float(tenant.get("warm_threshold", 6.0)),
        current_state=prev_state,
        exchanges=exchanges,
    )
    store.update_conversation_state(conversation_id, new_state)

    # 9. Upsert lead record
    priority = state_machine.priority_for_state(new_state)
    lead = store.upsert_lead(
        conversation_id=conversation_id,
        tenant_id=req.tenant_id,
        score=score,
        state=new_state,
        signals=signals,
        priority=priority,
        is_test=req.is_test,
    )

    # 10. Fire notifications on first transition into CLOSING (real leads only)
    if (
        new_state == state_machine.CLOSING
        and prev_state != state_machine.CLOSING
        and not req.is_test
        and not lead.get("notified")
    ):
        store.mark_notified(conversation_id)
        # Summary = last 3 user messages, plain text — enough context for n8n
        # to draft a useful email without shipping the entire transcript.
        summary = notifications.summarize_user(full_history)
        await notifications.send_event(tenant, lead, "lead_qualified", summary)

    # 11. Build response flags
    calendly_url = tenant.get("calendly_url") if new_state == state_machine.CLOSING else None
    capture_email = new_state == state_machine.NURTURING

    return ChatResponse(
        conversation_id=conversation_id,
        reply=reply,
        state=new_state,
        score=score,
        signals=signals,
        calendly_url=calendly_url or None,
        capture_email=capture_email,
    )
