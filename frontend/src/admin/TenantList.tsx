import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTenant, listTenants } from "../lib/api";
import type { Tenant } from "../lib/types";
import { Button, StatusChip } from "../lib/ui";
import { TopBar } from "./AdminLayout";

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const nav = useNavigate();
  const load = () => { setLoading(true); setErr(null);
    listTenants().then(setTenants).catch(() => setErr("Could not load chatbots. Check your connection and admin access."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const onCreate = async () => {
    setCreating(true); setErr(null);
    try {
      const t = await createTenant({name: "New chatbot", system_prompt: "You are a sales closer. Qualify the visitor and move high-intent leads to a booked call.", knowledge_base: ""});
      nav(`/admin/tenants/${t.id}`);
    } catch { setErr("Could not create the chatbot. Please try again."); }
    finally { setCreating(false); }
  };
  return <><TopBar title="Chatbots"><Button onClick={onCreate} disabled={creating}>{creating ? "Create…" : "+ New chatbot"}</Button></TopBar>
    {err && <div className="notice" role="alert">{err} <Button variant="ghost" onClick={load}>Retry</Button></div>}
    <div className="table-panel" aria-busy={loading}>
      <div className="chatbot-table table-head" aria-hidden="true"><span>Chatbot</span><span>Assistant</span><span>Status</span><span /></div>
      {loading ? <p className="empty-state" role="status">Load chatbots…</p> : tenants.map(t =>
        <div className="chatbot-table chatbot-row" key={t.id}>
          <div className="chatbot-name"><span className="bot-initial">{t.name.slice(0,1).toUpperCase()}</span><strong>{t.name}</strong></div>
          <span className="assistant-name">{t.branding?.bot_name || "Assistant"}</span>
          <StatusChip active={t.is_active}/>
          <Link className="open-bot" to={`/admin/tenants/${t.id}`} aria-label={`Open chatbot: ${t.name}`}>Open chatbot <span aria-hidden="true">↗</span></Link>
        </div>)}
      {!loading && !err && !tenants.length && <p className="empty-state">No chatbots yet. Create your first chatbot to get started.</p>}
    </div><p className="list-count">{!loading && !err ? `${tenants.length} chatbot${tenants.length === 1 ? "" : "s"}` : ""}</p>
  </>;
}
