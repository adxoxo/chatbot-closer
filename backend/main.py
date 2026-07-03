"""TQ Chatbot #1 — FastAPI entrypoint.

Two ways to run:

  Dev (two origins):
    uvicorn main:app --reload --port 8000      # API only, frontend on Vite :5173

  Single-origin (production / tunnel):
    cd frontend && npm run build               # produces frontend/dist
    uvicorn main:app --port 8000               # serves API under /api + the SPA

The API is mounted under /api so it never collides with client-side routes
(e.g. the SPA route /admin/tenants/:id vs the API GET /api/admin/tenants/:id).
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
from routes import chat, leads, tenant

app = FastAPI(title="TQ Chatbot #1 — System Entry One", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API (everything under /api) ──
@app.get("/api/health")
def health():
    return {"ok": True, "mode": config.summary()}


app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(tenant.router, prefix="/api", tags=["tenant"])
app.include_router(leads.router, prefix="/api", tags=["leads"])

# ── Static SPA (only if a build exists) ──
DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
DIST = os.path.abspath(DIST)

if os.path.isdir(DIST):
    # Hashed assets
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/")
    def _root_index():
        return FileResponse(os.path.join(DIST, "index.html"))

    @app.get("/{full_path:path}")
    def _spa(full_path: str):
        """Serve real files (widget.js, favicon…) else fall back to index.html."""
        candidate = os.path.join(DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(DIST, "index.html"))
else:
    @app.get("/")
    def _root():
        return {
            "service": "tq-chatbot-1",
            "status": "ok",
            "mode": config.summary(),
            "note": "frontend build not found — run `npm run build` for single-origin serving",
        }
