import { useEffect, useState } from "react";
import { listLeads, listTenants } from "../lib/api";
import type { Lead, Tenant } from "../lib/types";
import { TopBar } from "./AdminLayout";

export default function Dashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listTenants(), listLeads({ include_test: false })])
      .then(([t, l]) => {
        setTenants(t);
        setLeads(l);
      })
      .catch(() => setErr("Could not load data. Check the backend + admin key."));
  }, []);

  const hot = leads.filter((l) => l.priority === "hot").length;
  const warm = leads.filter((l) => l.priority === "warm").length;
  const active = tenants.filter((t) => t.is_active).length;
  const convRate = leads.length ? Math.round((hot / leads.length) * 100) : 0;

  return (
    <>
      <TopBar title="Dashboard" />
      <div className="p-lg flex flex-col gap-lg">
        {err && <p className="text-error font-label-mono text-label-mono">{err}</p>}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-lg">
          <Stat label="ACTIVE_TENANTS" value={`${active}`} icon="corporate_fare" color="primary" />
          <Stat label="TOTAL_LEADS" value={`${leads.length}`} icon="leaderboard" color="primary" />
          <Stat label="HOT_LEADS" value={`${hot}`} icon="local_fire_department" color="secondary" />
          <Stat label="CONVERSION_RATE" value={`${convRate}%`} icon="target" color="tertiary" />
        </div>

        <div className="bg-surface-container border border-outline-variant/40 rounded-xl p-lg">
          <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant mb-md">
            Lead Distribution
          </h3>
          <div className="flex flex-col gap-md">
            <Bar label="Hot" count={hot} total={leads.length} color="bg-secondary" />
            <Bar label="Warm" count={warm} total={leads.length} color="bg-tertiary" />
            <Bar
              label="Cold"
              count={leads.length - hot - warm}
              total={leads.length}
              color="bg-outline"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: "primary" | "secondary" | "tertiary";
}) {
  const text = { primary: "text-primary", secondary: "text-secondary", tertiary: "text-tertiary" }[color];
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 flex flex-col p-lg gap-md">
      <div className="flex justify-between items-center">
        <span className={`font-label-mono text-label-mono ${text}`}>{label}</span>
        <span className={`material-symbols-outlined ${text}`}>{icon}</span>
      </div>
      <span className="font-h1 text-h1">{value}</span>
    </div>
  );
}

function Bar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex justify-between font-label-mono text-label-mono">
        <span className="text-on-surface-variant">{label}</span>
        <span className="text-on-surface">
          {count} <span className="text-on-surface-variant">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
