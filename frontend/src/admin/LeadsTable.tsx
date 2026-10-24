import { useEffect, useMemo, useState } from "react";
import { getLeadDetail, listLeads, listTenants } from "../lib/api";
import { maxScore } from "../lib/score";
import type { Lead, Message, Tenant } from "../lib/types";
import { Button, Dialog, PriorityChip, StateChip, inputCls } from "../lib/ui";
import { TopBar } from "./AdminLayout";

export default function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [includeTest, setIncludeTest] = useState(false);
  const [tenantFilter, setTenantFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setErr(null);
    listLeads({
      include_test: includeTest,
      tenant_id: tenantFilter || undefined,
      priority: priorityFilter || undefined,
    })
      .then(setLeads)
      .catch(() => setErr("Could not load leads. Check your connection and admin access."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    listTenants().then(setTenants).catch(() => {});
  }, []);
  useEffect(load, [includeTest, tenantFilter, priorityFilter]);

  // Per-tenant score ceiling (SC-8) — leads can span tenants with different weights.
  const maxByTenant = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tenants) m[t.id] = maxScore(t.scoring_weights);
    return m;
  }, [tenants]);

  const filtered = leads.filter(
    (l) =>
      !search ||
      (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.tenant_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <TopBar title="Leads" />
      <div className="filters">
        <label className="search-field">Search leads<input className={inputCls} value={search} onChange={e => setSearch(e.target.value)} placeholder="Email or chatbot name" /></label>
        <label>Chatbot<select className={inputCls} value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}>
          <option value="">All chatbots</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        <label>Priority<select className={inputCls} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option>
        </select></label>
      </div>
      <div className="results-heading"><label className="check-label"><input type="checkbox" checked={includeTest} onChange={e => setIncludeTest(e.target.checked)} />Show test leads</label>
        <span>{loading ? "Load leads…" : `${filtered.length} lead${filtered.length === 1 ? "" : "s"}`}</span></div>
      {err && <div className="notice" role="alert">{err}<Button variant="ghost" onClick={load}>Retry</Button></div>}
      <div className="table-panel" aria-busy={loading}>
        <div className="lead-table table-head" aria-hidden="true"><span>Contact</span><span>Chatbot</span><span>Priority</span><span>Updated</span><span /></div>
        {!loading && filtered.map(l => <div className="lead-table lead-row" key={l.id}>
          <span className="contact">{l.email || "Visitor"} {l.is_test && <small className="text-tertiary">Test</small>}</span>
          <span className="lead-bot">{l.tenant_name || "Chatbot"}</span>
          <PriorityChip priority={l.priority}/>
          <time dateTime={l.updated_at} title={new Date(l.updated_at).toLocaleString()}>{new Date(l.updated_at).toLocaleDateString()}</time>
          <button className="open-bot" onClick={() => setSelected(l.conversation_id)} aria-label={`View conversation: ${l.email || l.tenant_name || "Visitor"}`}>View conversation ↗</button>
        </div>)}
        {loading && <p className="empty-state" role="status">Load leads…</p>}
        {!loading && !filtered.length && !err && <p className="empty-state">No leads match this view. Try another filter or start a conversation.</p>}
      </div>

      {selected && (
        <LeadDrawer
          conversationId={selected}
          maxByTenant={maxByTenant}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function LeadDrawer({conversationId, maxByTenant, onClose}: {
  conversationId: string; maxByTenant: Record<string, number>; onClose: () => void;
}) {
  const [data, setData] = useState<{ lead: Lead; messages: Message[] } | null>(null);
  const [err, setErr] = useState(false);
  const load = () => {
    setErr(false); setData(null);
    getLeadDetail(conversationId).then(d => setData({lead: d.lead, messages: d.messages})).catch(() => setErr(true));
  };
  useEffect(load, [conversationId]);
  return <Dialog title="Lead conversation" onClose={onClose} className="lead-dialog">
    <header className="drawer-heading"><h2>Lead conversation</h2><Button variant="ghost" onClick={onClose} aria-label="Close conversation">Close ×</Button></header>
    <div className="drawer-content">
      {err ? <div className="notice" role="alert">Could not load this conversation.<Button variant="ghost" onClick={load}>Retry</Button></div> : !data ? <p role="status">Load conversation…</p> : <>
        <p className="lead-contact">{data.lead.email || "Visitor"}</p>
        <div className="lead-meta"><PriorityChip priority={data.lead.priority}/><span>{data.lead.is_test ? "Test conversation" : "Visitor conversation"}</span></div>
        <h3>Conversation</h3>
        <div className="transcript">{data.messages.map(m => <div key={m.id} className={`transcript-message ${m.role}`}><span>{m.role === "user" ? "Visitor" : "Assistant"}</span><p>{m.content}</p></div>)}</div>
        <details><summary>Score and qualification details</summary>
          <div className="flex flex-wrap items-center gap-md my-md"><strong>Score: {data.lead.score.toFixed(1)}{maxByTenant[data.lead.tenant_id] !== undefined ? ` / ${maxByTenant[data.lead.tenant_id]}` : " (maximum unavailable)"}</strong><StateChip state={data.lead.state}/></div>
          {Object.entries(data.lead.signals || {}).map(([key,value]) => <div className="signal-row" key={key}><span>{key.replace(/_/g, " ")}</span><span>{value} / 2</span></div>)}
        </details>
      </>}
    </div>
  </Dialog>;
}
