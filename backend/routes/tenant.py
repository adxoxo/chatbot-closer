"""Tenant config endpoints.

GET /tenant/:id is public but returns ONLY branding-safe fields (no prompt/KB).
Admin endpoints (list/create/update) require the admin key.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import TenantCreate, TenantUpdate
from routes.auth import require_admin
from services.supabase import store

router = APIRouter()


def _public_view(tenant: dict) -> dict:
    """Branding-only projection safe to expose to the widget."""
    branding = tenant.get("branding") or {}
    return {
        "id": tenant["id"],
        "name": tenant["name"],
        "is_active": tenant.get("is_active", True),
        "branding": {
            "primary_color": branding.get("primary_color", "#c4c0ff"),
            "bot_name": branding.get("bot_name", "TQ Assistant"),
            "logo_url": branding.get("logo_url", ""),
            "welcome_message": branding.get("welcome_message", "Hi! How can I help you today?"),
        },
    }


@router.get("/default-tenant")
def get_default_tenant():
    """Public — branding for the first active tenant.

    Lets the demo widget (`/widget` with no ?tenant=) resolve a tenant without a
    hardcoded id, so it never breaks from config drift.
    """
    active = [t for t in store.list_tenants() if t.get("is_active", True)]
    if not active:
        raise HTTPException(status_code=404, detail="No active tenant")
    return _public_view(active[0])


@router.get("/tenant/{tenant_id}")
def get_tenant_public(tenant_id: str):
    tenant = store.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _public_view(tenant)


# ── Admin ───────────────────────────────────────────────────────────
@router.get("/admin/tenants", dependencies=[Depends(require_admin)])
def list_tenants():
    return store.list_tenants()


@router.get("/admin/tenants/{tenant_id}", dependencies=[Depends(require_admin)])
def get_tenant_full(tenant_id: str):
    tenant = store.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/tenant", dependencies=[Depends(require_admin)])
def create_tenant(body: TenantCreate):
    return store.create_tenant(body.model_dump())


@router.put("/tenant/{tenant_id}", dependencies=[Depends(require_admin)])
def update_tenant(tenant_id: str, body: TenantUpdate):
    updated = store.update_tenant(tenant_id, body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return updated


@router.delete("/tenant/{tenant_id}", dependencies=[Depends(require_admin)])
def delete_tenant(tenant_id: str):
    """Permanently delete a tenant and all its conversations, messages, leads."""
    if not store.delete_tenant(tenant_id):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"ok": True}
