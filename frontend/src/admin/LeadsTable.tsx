import { useEffect, useState } from "react";
import { getLeadDetail, listLeads, listTenants } from "../lib/api";
import type { Lead, Message, Priority, Tenant } from "../lib/types";
import { PriorityChip, StateChip } from "../lib/ui";
import { TopBar } from "./AdminLayout";

const ACCENT: Record<Priority, string> = {
  hot: "border-l-secondary",
  warm: "border-l-tertiary",
  cold: "border-l-transparent",
};

export default function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [includeTest, setIncludeTest] = useState(false);
  const [tenantFilter, setTenantFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = () => {
    listLeads({
      include_test: includeTest,
      tenant_id: tenantFilter || undefined,
      priority: priorityFilter || undefined,
    })
      .then(setLeads)
      .catch(() => setErr("Could not load leads. Check backend + admin key."));
  };

  useEffect(() => {
    listTenants().then(setTenants).catch(() => {});
  }, []);
  useEffect(load, [includeTest, tenantFilter, priorityFilter]);

  const filtered = leads.filter(
    (l) =>
      !search ||
      (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.tenant_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <TopBar title="Leads Management">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="bg-surface-container-low border border-outline-variant px-md py-sm rounded-lg text-body-md w-64 focus:outline-none focus:border-primary transition-all pl-9"
          />
          <span className="material-symbols-outlined absolute left-2 top-1.5 text-on-surface-variant text-[18px]">
            search
          </span>
        </div>
      </TopBar>

      <div className="p-lg flex flex-col gap-md">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-md">
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-mono text-label-mono text-on-surface outline-none focus:border-primary"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-mono text-label-mono text-on-surface outline-none focus:border-primary"
          >
            <option value="">All priorities</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
          <label className="flex items-center gap-sm font-label-mono text-label-mono text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="accent-primary"
            />
            Show test leads
          </label>
          <span className="ml-auto font-label-mono text-label-mono text-on-surface-variant">
            {filtered.length} lead{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {err && <p className="text-error font-label-mono text-label-mono">{err}</p>}

        <div className="bg-surface-container border border-outline-variant/40 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/50 font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th className="px-md py-sm font-medium">Tenant</th>
                <th className="px-md py-sm font-medium">Email</th>
                <th className="px-md py-sm font-medium">Score</th>
                <th className="px-md py-sm font-medium">State</th>
                <th className="px-md py-sm font-medium">Priority</th>
                <th className="px-md py-sm font-medium">Updated</th>
                <th className="px-md py-sm font-medium text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className={`border-b border-outline-variant/20 border-l-2 ${ACCENT[l.priority]} hover:bg-surface-container-high/50 transition-colors`}
                >
                  <td className="px-md py-md text-on-surface">
                    {l.tenant_name}
                    {l.is_test && (
                      <span className="ml-sm font-label-mono text-[9px] text-tertiary border border-tertiary/40 rounded px-1">
                        TEST
                      </span>
                    )}
                  </td>
                  <td className="px-md py-md text-on-surface-variant">{l.email || "—"}</td>
                  <td className="px-md py-md font-mono text-on-surface font-bold">
                    {l.score.toFixed(1)}
                    <span className="text-on-surface-variant font-normal">/18</span>
                  </td>
                  <td className="px-md py-md">
                    <StateChip state={l.state} />
                  </td>
                  <td className="px-md py-md">
                    <PriorityChip priority={l.priority} />
                  </td>
                  <td className="px-md py-md font-label-mono text-[10px] text-on-surface-variant">
                    {new Date(l.updated_at).toLocaleString()}
                  </td>
                  <td className="px-md py-md text-right">
                    <button
                      onClick={() => setSelected(l.conversation_id)}
                      className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors"
                    >
                      visibility
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !err && (
                <tr>
                  <td colSpan={7} className="px-md py-xl text-center text-on-surface-variant">
                    No leads yet. Run a conversation in the widget or test console.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <LeadDrawer conversationId={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function LeadDrawer({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ lead: Lead; messages: Message[] } | null>(null);
  useEffect(() => {
    getLeadDetail(conversationId).then((d) =>
      setData({ lead: d.lead, messages: d.messages })
    );
  }, [conversationId]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[440px] max-w-[100vw] h-full bg-surface border-l border-outline-variant flex flex-col animate-slide-up">
        <header className="px-lg py-md border-b border-outline-variant flex items-center justify-between">
          <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
            Lead Detail
          </h3>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-on-surface-variant hover:text-error"
          >
            close
          </button>
        </header>
        {!data ? (
          <div className="flex-1 flex items-center justify-center font-label-mono text-label-mono text-on-surface-variant">
            loading…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto thin-scrollbar p-lg flex flex-col gap-lg">
            <div className="grid grid-cols-2 gap-md">
              <Metric label="Score" value={`${data.lead.score.toFixed(1)}/18`} />
              <Metric label="Priority" value={data.lead.priority.toUpperCase()} />
              <Metric label="State" value={data.lead.state} />
              <Metric label="Email" value={data.lead.email || "—"} />
            </div>
            <div>
              <h4 className="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-sm">
                Signals
              </h4>
              <div className="flex flex-col gap-sm">
                {Object.entries(data.lead.signals || {}).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-xs">
                    <div className="flex justify-between font-label-mono text-[11px]">
                      <span className="text-on-surface-variant">{k}</span>
                      <span className="text-on-surface">{v} / 2</span>
                    </div>
                    <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(Number(v) / 2) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-sm">
                Transcript
              </h4>
              <div className="flex flex-col gap-sm">
                {data.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-sm rounded-lg text-body-md max-w-[90%] ${
                      m.role === "user"
                        ? "self-end bg-primary text-on-primary"
                        : "self-start bg-surface-container border-l-2 border-primary text-on-surface"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-high rounded-lg p-sm border border-outline-variant">
      <p className="font-label-mono text-[10px] uppercase text-on-surface-variant mb-xs">
        {label}
      </p>
      <p className="text-body-md font-bold text-on-surface truncate">{value}</p>
    </div>
  );
}
