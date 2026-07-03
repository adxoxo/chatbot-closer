"""Shared admin auth dependency.

Admin endpoints require the `X-Admin-Key` header to match ADMIN_API_KEY.
Not production-grade — appropriate for the demo per ARCHITECTURE.md 7.
"""
from fastapi import Header, HTTPException

import config


def require_admin(x_admin_key: str = Header(default="")):
    if x_admin_key != config.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    return True
