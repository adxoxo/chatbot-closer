"""Storage layer.

Exposes a single `store` object with a uniform async-friendly API used by the
rest of the backend. Two interchangeable backends:

  * SupabaseStore  — real Postgres via supabase-py (when keys are configured)
  * SqliteStore    — local file DB (zero-config fallback for the demo)

Both implement the same method surface so callers never branch on backend.
All methods are plain (synchronous) — they are fast and called from async
handlers via direct invocation; the network calls in SupabaseStore are
blocking but small. This keeps the codebase simple per the handoff note.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

import config
from models.schemas import DEFAULT_BRANDING, DEFAULT_WEIGHTS


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ──────────────────────────────────────────────────────────────────
# SQLite backend
# ──────────────────────────────────────────────────────────────────
class SqliteStore:
    backend = "sqlite"

    def __init__(self, path: str):
        self.path = path
        self._init_schema()

    def _conn(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_schema(self):
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS tenants (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    knowledge_base TEXT,
                    calendly_url TEXT,
                    scoring_weights TEXT,
                    hot_threshold REAL DEFAULT 12.0,
                    warm_threshold REAL DEFAULT 6.0,
                    branding TEXT,
                    notification_email TEXT,
                    n8n_webhook_url TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT
                );
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
                    state TEXT DEFAULT 'GREETING',
                    is_test INTEGER DEFAULT 0,
                    started_at TEXT,
                    updated_at TEXT
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
                    role TEXT,
                    content TEXT NOT NULL,
                    created_at TEXT
                );
                CREATE TABLE IF NOT EXISTS leads (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
                    tenant_id TEXT,
                    email TEXT,
                    score REAL DEFAULT 0,
                    state TEXT DEFAULT 'GREETING',
                    signals TEXT,
                    priority TEXT DEFAULT 'cold',
                    notified INTEGER DEFAULT 0,
                    is_test INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT
                );
                """
            )
            # Migrate older DBs (pre-n8n): add n8n_webhook_url, drop slack_webhook_url.
            cols = {r[1] for r in c.execute("PRAGMA table_info(tenants)").fetchall()}
            if "n8n_webhook_url" not in cols:
                c.execute("ALTER TABLE tenants ADD COLUMN n8n_webhook_url TEXT")
            if "slack_webhook_url" in cols:
                try:
                    c.execute("ALTER TABLE tenants DROP COLUMN slack_webhook_url")
                except sqlite3.OperationalError:
                    pass  # SQLite < 3.35 can't drop columns — harmless, leave it

    @staticmethod
    def _tenant_row(r: sqlite3.Row) -> dict:
        d = dict(r)
        d["scoring_weights"] = json.loads(d["scoring_weights"] or "{}") or dict(DEFAULT_WEIGHTS)
        d["branding"] = json.loads(d["branding"] or "{}") or dict(DEFAULT_BRANDING)
        d["is_active"] = bool(d["is_active"])
        return d

    # ── tenants ──
    def list_tenants(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute("SELECT * FROM tenants ORDER BY created_at DESC").fetchall()
        return [self._tenant_row(r) for r in rows]

    def get_tenant(self, tenant_id: str) -> Optional[dict]:
        with self._conn() as c:
            r = c.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,)).fetchone()
        return self._tenant_row(r) if r else None

    def create_tenant(self, data: dict) -> dict:
        tid = _new_id()
        with self._conn() as c:
            c.execute(
                """INSERT INTO tenants (id,name,system_prompt,knowledge_base,calendly_url,
                   scoring_weights,hot_threshold,warm_threshold,branding,notification_email,
                   n8n_webhook_url,is_active,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    tid, data["name"], data["system_prompt"], data.get("knowledge_base", ""),
                    data.get("calendly_url", ""),
                    json.dumps(data.get("scoring_weights") or DEFAULT_WEIGHTS),
                    data.get("hot_threshold", 12.0), data.get("warm_threshold", 6.0),
                    json.dumps(data.get("branding") or DEFAULT_BRANDING),
                    data.get("notification_email", ""), data.get("n8n_webhook_url", ""),
                    1 if data.get("is_active", True) else 0, _now(),
                ),
            )
        return self.get_tenant(tid)

    def update_tenant(self, tenant_id: str, data: dict) -> Optional[dict]:
        existing = self.get_tenant(tenant_id)
        if not existing:
            return None
        fields, values = [], []
        for k, v in data.items():
            if v is None:
                continue
            if k in ("scoring_weights", "branding"):
                v = json.dumps(v)
            if k == "is_active":
                v = 1 if v else 0
            fields.append(f"{k} = ?")
            values.append(v)
        if fields:
            values.append(tenant_id)
            with self._conn() as c:
                c.execute(f"UPDATE tenants SET {', '.join(fields)} WHERE id = ?", values)
        return self.get_tenant(tenant_id)

    def delete_tenant(self, tenant_id: str) -> bool:
        if not self.get_tenant(tenant_id):
            return False
        with self._conn() as c:
            conv_ids = [r[0] for r in c.execute(
                "SELECT id FROM conversations WHERE tenant_id = ?", (tenant_id,)).fetchall()]
            for cid in conv_ids:
                c.execute("DELETE FROM messages WHERE conversation_id = ?", (cid,))
            c.execute("DELETE FROM leads WHERE tenant_id = ?", (tenant_id,))
            c.execute("DELETE FROM conversations WHERE tenant_id = ?", (tenant_id,))
            c.execute("DELETE FROM tenants WHERE id = ?", (tenant_id,))
        return True

    # ── conversations ──
    def create_conversation(self, tenant_id: str, is_test: bool) -> dict:
        cid = _new_id()
        with self._conn() as c:
            c.execute(
                "INSERT INTO conversations (id,tenant_id,state,is_test,started_at,updated_at) VALUES (?,?,?,?,?,?)",
                (cid, tenant_id, "GREETING", 1 if is_test else 0, _now(), _now()),
            )
            r = c.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
        return dict(r)

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        with self._conn() as c:
            r = c.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        return dict(r) if r else None

    def update_conversation_state(self, conversation_id: str, state: str):
        with self._conn() as c:
            c.execute(
                "UPDATE conversations SET state = ?, updated_at = ? WHERE id = ?",
                (state, _now(), conversation_id),
            )

    def delete_conversation(self, conversation_id: str):
        with self._conn() as c:
            c.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))

    # ── messages ──
    def get_messages(self, conversation_id: str) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def save_message(self, conversation_id: str, role: str, content: str) -> dict:
        mid = _new_id()
        with self._conn() as c:
            c.execute(
                "INSERT INTO messages (id,conversation_id,role,content,created_at) VALUES (?,?,?,?,?)",
                (mid, conversation_id, role, content, _now()),
            )
        return {"id": mid, "conversation_id": conversation_id, "role": role, "content": content}

    # ── leads ──
    def get_lead_by_conversation(self, conversation_id: str) -> Optional[dict]:
        with self._conn() as c:
            r = c.execute(
                "SELECT * FROM leads WHERE conversation_id = ?", (conversation_id,)
            ).fetchone()
        if not r:
            return None
        d = dict(r)
        d["signals"] = json.loads(d["signals"] or "{}")
        d["notified"] = bool(d["notified"])
        d["is_test"] = bool(d["is_test"])
        return d

    def upsert_lead(self, conversation_id: str, tenant_id: str, score: float, state: str,
                    signals: dict, priority: str, is_test: bool) -> dict:
        existing = self.get_lead_by_conversation(conversation_id)
        with self._conn() as c:
            if existing:
                c.execute(
                    """UPDATE leads SET score=?, state=?, signals=?, priority=?, updated_at=?
                       WHERE conversation_id=?""",
                    (score, state, json.dumps(signals), priority, _now(), conversation_id),
                )
            else:
                c.execute(
                    """INSERT INTO leads (id,conversation_id,tenant_id,score,state,signals,
                       priority,notified,is_test,created_at,updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (_new_id(), conversation_id, tenant_id, score, state, json.dumps(signals),
                     priority, 0, 1 if is_test else 0, _now(), _now()),
                )
        return self.get_lead_by_conversation(conversation_id)

    def set_lead_email(self, conversation_id: str, email: str) -> Optional[dict]:
        with self._conn() as c:
            c.execute(
                "UPDATE leads SET email=?, updated_at=? WHERE conversation_id=?",
                (email, _now(), conversation_id),
            )
        return self.get_lead_by_conversation(conversation_id)

    def mark_notified(self, conversation_id: str):
        with self._conn() as c:
            c.execute(
                "UPDATE leads SET notified=1, updated_at=? WHERE conversation_id=?",
                (_now(), conversation_id),
            )

    def list_leads(self, include_test: bool = False) -> list[dict]:
        q = "SELECT * FROM leads"
        if not include_test:
            q += " WHERE is_test = 0"
        q += " ORDER BY updated_at DESC"
        with self._conn() as c:
            rows = c.execute(q).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["signals"] = json.loads(d["signals"] or "{}")
            d["notified"] = bool(d["notified"])
            d["is_test"] = bool(d["is_test"])
            out.append(d)
        return out


# ──────────────────────────────────────────────────────────────────
# Supabase backend
# ──────────────────────────────────────────────────────────────────
class SupabaseStore:
    backend = "supabase"

    def __init__(self, url: str, key: str):
        from supabase import create_client

        self.client = create_client(url, key)

    @staticmethod
    def _norm_tenant(d: dict) -> dict:
        d = dict(d)
        d["scoring_weights"] = d.get("scoring_weights") or dict(DEFAULT_WEIGHTS)
        d["branding"] = d.get("branding") or dict(DEFAULT_BRANDING)
        return d

    # ── tenants ──
    def list_tenants(self) -> list[dict]:
        res = self.client.table("tenants").select("*").order("created_at", desc=True).execute()
        return [self._norm_tenant(t) for t in res.data]

    def get_tenant(self, tenant_id: str) -> Optional[dict]:
        res = self.client.table("tenants").select("*").eq("id", tenant_id).limit(1).execute()
        return self._norm_tenant(res.data[0]) if res.data else None

    def create_tenant(self, data: dict) -> dict:
        res = self.client.table("tenants").insert(data).execute()
        return self._norm_tenant(res.data[0])

    def update_tenant(self, tenant_id: str, data: dict) -> Optional[dict]:
        clean = {k: v for k, v in data.items() if v is not None}
        if clean:
            self.client.table("tenants").update(clean).eq("id", tenant_id).execute()
        return self.get_tenant(tenant_id)

    def delete_tenant(self, tenant_id: str) -> bool:
        if not self.get_tenant(tenant_id):
            return False
        # conversations cascade to messages + leads; also clear leads by tenant_id.
        self.client.table("leads").delete().eq("tenant_id", tenant_id).execute()
        self.client.table("conversations").delete().eq("tenant_id", tenant_id).execute()
        self.client.table("tenants").delete().eq("id", tenant_id).execute()
        return True

    # ── conversations ──
    def create_conversation(self, tenant_id: str, is_test: bool) -> dict:
        res = self.client.table("conversations").insert(
            {"tenant_id": tenant_id, "state": "GREETING", "is_test": is_test}
        ).execute()
        return res.data[0]

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        res = self.client.table("conversations").select("*").eq("id", conversation_id).limit(1).execute()
        return res.data[0] if res.data else None

    def update_conversation_state(self, conversation_id: str, state: str):
        self.client.table("conversations").update(
            {"state": state, "updated_at": _now()}
        ).eq("id", conversation_id).execute()

    def delete_conversation(self, conversation_id: str):
        self.client.table("conversations").delete().eq("id", conversation_id).execute()

    # ── messages ──
    def get_messages(self, conversation_id: str) -> list[dict]:
        res = (
            self.client.table("messages").select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data

    def save_message(self, conversation_id: str, role: str, content: str) -> dict:
        res = self.client.table("messages").insert(
            {"conversation_id": conversation_id, "role": role, "content": content}
        ).execute()
        return res.data[0]

    # ── leads ──
    def get_lead_by_conversation(self, conversation_id: str) -> Optional[dict]:
        res = self.client.table("leads").select("*").eq("conversation_id", conversation_id).limit(1).execute()
        return res.data[0] if res.data else None

    def upsert_lead(self, conversation_id: str, tenant_id: str, score: float, state: str,
                    signals: dict, priority: str, is_test: bool) -> dict:
        existing = self.get_lead_by_conversation(conversation_id)
        if existing:
            self.client.table("leads").update(
                {"score": score, "state": state, "signals": signals,
                 "priority": priority, "updated_at": _now()}
            ).eq("conversation_id", conversation_id).execute()
        else:
            self.client.table("leads").insert(
                {"conversation_id": conversation_id, "tenant_id": tenant_id, "score": score,
                 "state": state, "signals": signals, "priority": priority, "is_test": is_test}
            ).execute()
        return self.get_lead_by_conversation(conversation_id)

    def set_lead_email(self, conversation_id: str, email: str) -> Optional[dict]:
        self.client.table("leads").update(
            {"email": email, "updated_at": _now()}
        ).eq("conversation_id", conversation_id).execute()
        return self.get_lead_by_conversation(conversation_id)

    def mark_notified(self, conversation_id: str):
        self.client.table("leads").update(
            {"notified": True, "updated_at": _now()}
        ).eq("conversation_id", conversation_id).execute()

    def list_leads(self, include_test: bool = False) -> list[dict]:
        q = self.client.table("leads").select("*")
        if not include_test:
            q = q.eq("is_test", False)
        return q.order("updated_at", desc=True).execute().data


# ──────────────────────────────────────────────────────────────────
# Singleton selection
# ──────────────────────────────────────────────────────────────────
if config.USE_SUPABASE:
    store = SupabaseStore(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
else:
    store = SqliteStore(config.SQLITE_PATH)
