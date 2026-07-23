"""POST /chat — the full conversation pipeline (ARCHITECTURE.md 3.4).

Pipeline order matters (SC-5): we score the visitor and compute the state
BEFORE generating the reply, then feed that state into the prompt so the bot's
words match the widget's behaviour. Scoring only reads the visitor's messages,
so it doesn't need the reply to exist yet.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.schemas import ChatRequest, ChatResponse
from services import llm, notifications, prompt_builder, scoring_engine, state_machine
from services.supabase import store

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Track LLM health for THIS request so the response can tell the UI whether
    # the reply/scoring came from the real model or a degraded fallback.
    llm.reset_status()

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

    # 3. Fetch prior history (does not include the new message yet)
    history = store.get_messages(conversation_id)

    # 4. Score the visitor FIRST (user messages only — SC-1). The scorer never
    #    sees the assistant's questions, so it can run before the reply exists.
    scoring_history = history + [{"role": "user", "content": req.message}]
    exchanges = sum(1 for m in scoring_history if m["role"] == "user")
    signals, evidence = await scoring_engine.score_conversation(scoring_history)
    weights = tenant.get("scoring_weights")
    score = scoring_engine.calculate_score(signals, weights)

    # 5. Compute the state from the score + signals (SC-3/4). This is final —
    #    the reply we generate next can't change the score.
    new_state = state_machine.determine_state(
        score=score,
        signals=signals,
        hot_threshold=float(tenant.get("hot_threshold", 10.0)),
        warm_threshold=float(tenant.get("warm_threshold", 6.0)),
        current_state=prev_state,
        exchanges=exchanges,
    )
    print(f"[score] convo={conversation_id[:8]} turn={exchanges} "
          f"score={score} state={new_state} signals={signals} evidence={evidence}")

    # 6. Build the prompt WITH the state directive → generate the reply (SC-5).
    system_prompt, messages = prompt_builder.build_prompt(
        tenant, history, req.message, state=new_state
    )
    reply = await llm.get_completion(messages, system_prompt)

    # 7. Persist both messages and commit the state.
    store.save_message(conversation_id, "user", req.message)
    store.save_message(conversation_id, "assistant", reply)
    store.update_conversation_state(conversation_id, new_state)

    # 8. Upsert lead record
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

    # 9. Fire notifications on first transition into CLOSING (real leads only)
    if (
        new_state == state_machine.CLOSING
        and prev_state != state_machine.CLOSING
        and not req.is_test
        and not lead.get("notified")
    ):
        store.mark_notified(conversation_id)
        # Summary = last 3 user messages, plain text — enough context for n8n
        # to draft a useful email without shipping the entire transcript.
        summary = notifications.summarize_user(scoring_history)
        await notifications.send_event(tenant, lead, "lead_qualified", summary)

    # 10. Build response flags
    calendly_url = tenant.get("calendly_url") if new_state == state_machine.CLOSING else None
    capture_email = new_state == state_machine.NURTURING

    return ChatResponse(
        conversation_id=conversation_id,
        reply=reply,
        state=new_state,
        score=score,
        signals=signals,
        max_score=scoring_engine.max_score(weights),
        llm_status=llm.get_status(),
        calendly_url=calendly_url or None,
        capture_email=capture_email,
    )
