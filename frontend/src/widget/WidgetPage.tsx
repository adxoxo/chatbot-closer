import { useEffect, useState } from "react";
import { getDefaultTenant, getPublicTenant } from "../lib/api";
import type { PublicTenant } from "../lib/types";
import ChatWidget from "./ChatWidget";

/**
 * Full-page floating widget. Used for:
 *   /widget?tenant=ID  — demo page with a mock dashboard background
 *   /embed?tenant=ID   — bare widget for iframe embedding (transparent bg)
 */
export default function WidgetPage({ bare = false }: { bare?: boolean }) {
  const params = new URLSearchParams(window.location.search);
  const tenantId =
    params.get("tenant") ||
    params.get("tenant_id") ||
    (import.meta.env.VITE_DEMO_TENANT_ID as string) ||
    "";

  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(bare); // embed opens immediately

  useEffect(() => {
    // Explicit ?tenant= / configured id wins; otherwise fall back to the
    // backend's first active tenant so the demo widget always loads.
    const load = tenantId ? getPublicTenant(tenantId) : getDefaultTenant();
    load
      .then(setTenant)
      .catch(() =>
        setErr(
          tenantId
            ? "Tenant not found or backend unreachable."
            : "No active tenant found. Create one in the admin, or append ?tenant=<id>."
        )
      );
  }, [tenantId]);

  const primary = tenant?.branding.primary_color || "#c4c0ff";

  const widget = (
    <div
      className="w-[380px] h-[560px] max-w-[100vw] max-h-[100dvh] bg-surface border border-outline-variant rounded-xl flex flex-col overflow-hidden chat-shadow animate-slide-up"
      style={{ borderColor: "#464555" }}
    >
      {tenant && (
        <ChatWidget
          tenantId={tenant.id}
          branding={tenant.branding}
          showHeader
          onClose={bare ? undefined : () => setOpen(false)}
          onMinimize={bare ? undefined : () => setOpen(false)}
        />
      )}
    </div>
  );

  if (bare) {
    // iframe mode — fill available space, transparent page
    return (
      <div className="w-full h-[100dvh] flex items-stretch justify-stretch bg-transparent">
        {err ? (
          <ErrorBox msg={err} />
        ) : tenant ? (
          <div className="w-full h-full">
            <ChatWidget tenantId={tenant.id} branding={tenant.branding} showHeader />
          </div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] relative">
      <MockDashboard />
      {/* Floating widget / launcher */}
      <div className="fixed bottom-lg right-lg z-50 flex flex-col items-end gap-md">
        {err && !open && <ErrorBox msg={err} />}
        {open && (err ? <ErrorBox msg={err} /> : tenant ? widget : <Loading />)}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 pulse-ring"
            style={{ background: primary, color: "#2000a4", ["--tq-primary" as any]: primary }}
            title="Chat with us"
          >
            <span className="material-symbols-outlined text-2xl icon-fill">chat_bubble</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="w-[380px] h-[560px] bg-surface border border-outline-variant rounded-xl flex items-center justify-center chat-shadow">
      <span className="font-label-mono text-label-mono text-on-surface-variant animate-pulse">
        loading…
      </span>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="w-[320px] bg-surface border border-error/40 rounded-xl p-md text-body-md text-on-surface chat-shadow">
      <div className="flex items-center gap-sm mb-xs text-error">
        <span className="material-symbols-outlined text-[18px]">error</span>
        <span className="font-label-mono text-label-mono uppercase tracking-wider">Error</span>
      </div>
      {msg}
    </div>
  );
}

/** A mock agency dashboard, recreating the chat_widget_expanded reference background. */
function MockDashboard() {
  return (
    <main className="relative z-0 p-xl min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="border-b border-outline-variant pb-lg mb-lg">
          <h1 className="font-h1 text-h1 text-on-surface">Agency Pipeline</h1>
          <p className="text-body-lg text-on-surface-variant">
            Live view of active lead generation flows.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          <StatCard label="ACTIVE_CAMPAIGNS" value="12" icon="trending_up" color="secondary" pct="66%" />
          <StatCard label="LEAD_VELOCITY" value="84%" icon="speed" color="primary" pct="84%" />
          <StatCard label="CONVERSION_RATE" value="4.2%" icon="target" color="tertiary" pct="33%" />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  pct,
}: {
  label: string;
  value: string;
  icon: string;
  color: "primary" | "secondary" | "tertiary";
  pct: string;
}) {
  const text = { primary: "text-primary", secondary: "text-secondary", tertiary: "text-tertiary" }[color];
  const bg = { primary: "bg-primary", secondary: "bg-secondary", tertiary: "bg-tertiary" }[color];
  return (
    <div className="h-48 bg-surface-container rounded-xl border border-outline-variant/30 flex flex-col p-lg gap-md">
      <div className="flex justify-between items-center">
        <span className={`font-label-mono text-label-mono ${text}`}>{label}</span>
        <span className={`material-symbols-outlined ${text}`}>{icon}</span>
      </div>
      <span className="font-h1 text-h1">{value}</span>
      <div className="mt-auto w-full h-1 bg-surface-variant rounded-full overflow-hidden">
        <div className={`h-full ${bg}`} style={{ width: pct }} />
      </div>
    </div>
  );
}
