# TQ Chatbot #1 — System Entry One

A multi-tenant AI **funnel chatbot** that acts as a sales closer: it qualifies
a visitor in real time, scores intent, and pushes hot leads straight to a
booked Calendly call. Build once, reconfigure per client.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind (widget, admin, test console) |
| Backend | FastAPI (Python 3.11+) |
| Storage | Supabase (Postgres) — **or local SQLite fallback** |
| LLM | Groq (primary) → Gemini → **deterministic mock fallback** |
| Notify | Single per-tenant n8n webhook on hot lead (n8n fans out to email/Slack/CRM) |
| Tunnel | Cloudflare Tunnel |

**Zero-key mode:** with no `.env` keys, the backend runs on SQLite + a mock
closer + log-only notifications, so the whole system works on a laptop for `$0`.
Add keys to promote each subsystem to production.

---

## Quick start (local, zero keys)

### 1. Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional — works with defaults
python seed.py                # creates two demo tenants
uvicorn main:app --reload --port 8000
```
Check: `curl localhost:8000/health` → `{"ok":true,"mode":{"storage":"sqlite",...}}`

> `requirements.txt` includes `supabase` and `google-generativeai`. For pure
> zero-key local mode you can skip those two — the imports are lazy. Install the
> full file once you add real keys.

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env           # set VITE_DEMO_TENANT_ID to a seeded tenant id
npm run dev                    # http://localhost:5173
```

### 3. Try it
- **Landing:** `/`
- **Widget demo:** `/widget` (uses `VITE_DEMO_TENANT_ID`, or `?tenant=<id>`)
- **Admin:** `/admin` → Tenants / Leads / Dashboard
- **Test console:** Tenants → **Test Bot** (or `/admin/tenants/:id/test`)

To see a hot lead close, send strong signals, e.g.:
> "We run a marketing agency spending $30k/month on Google Ads, our cost per
> lead doubled and it's killing us, we need it fixed now — I'm the founder."

The arc climbs, state walks `GREETING → QUALIFYING → CLOSING`, and the Calendly
card appears.

---

## Live deployment

This instance is **live at https://chat.aquryu.space** (single origin: FastAPI
serves the built SPA and the API under `/api`).

It runs as two durable **systemd --user** services (persist across logout/reboot
via user lingering):

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user status  tqchat-backend tqchat-tunnel     # check
systemctl --user restart tqchat-backend                   # after backend changes
systemctl --user restart tqchat-tunnel                    # after tunnel config changes
journalctl --user -u tqchat-backend -f                    # logs
```

**After changing frontend code:** `cd frontend && npm run build`, then
`systemctl --user restart tqchat-backend` (it serves `frontend/dist`).

Active config (`backend/.env`): `llm:groq` (`llama-3.3-70b-versatile` for
replies, `llama-3.1-8b-instant` for the scoring extraction),
`notify:n8n (per-tenant webhook)`, `storage:sqlite`. Groq is preferred over
Gemini whenever `GROQ_API_KEY` is set —
chosen because Gemini Flash's free tier is only 20 requests/day (each chat
message makes 2 LLM calls), which a live chatbot exhausts almost immediately.
To promote storage to Supabase, run [`supabase/schema.sql`](supabase/schema.sql),
set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, restart. `/api/health` reports the mode.

> **Notifications:** fire-and-forget POSTs to the tenant's `n8n_webhook_url`,
> tagged with an `event_type` so one n8n workflow can branch:
> `lead_qualified` (first CLOSING), `email_captured` (NURTURING email submit,
> includes `lead_email`), `call_booked` (Book My Call click). Real leads only;
> empty webhook → skipped silently; test leads never fire. n8n owns the
> downstream fan-out (email, Slack, CRM…).

### Tunnel topology
A **dedicated** `tq-chat` tunnel (id `006aee60…`) routes `chat.aquryu.space`
→ `localhost:8000`, isolated from the other tunnels on this host. Config:
[`cloudflare/config.yml`](cloudflare/config.yml).

---

## Repository layout

```
backend/        FastAPI: routes, services (gemini, scoring, state machine, notify), storage
frontend/       React: src/widget, src/admin, src/test-console, public/widget.js
supabase/       schema.sql
cloudflare/     tunnel config
design/         the reference design system + screens
CLAUDE / ARCHITECTURE / BUILDPLAN / RECONFIG / COSTS .md
```

---

## How the closer works (one screen)

```
/chat  →  load tenant → load history → Gemini reply → save messages
       →  score conversation (Gemini JSON, 5 signals × 0–2)
       →  weighted score (max 18) → state machine
       →  upsert lead → if first CLOSING: POST n8n webhook (fire-and-forget)
       →  return {reply, state, score, signals, calendly_url, capture_email}
```

| Score | State | Behaviour |
|-------|-------|-----------|
| ≥ hot_threshold (12) | CLOSING | stop asking, show Calendly card, notify team |
| ≥ warm_threshold (6) | NURTURING | acknowledge, capture email |
| below | PARKING | polite exit, stored cold, no notification |
```
# chatbot-closer
