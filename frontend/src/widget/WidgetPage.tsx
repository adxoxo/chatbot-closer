import { useEffect, useState } from "react";
import { getDefaultTenant, getPublicTenant } from "../lib/api";
import type { PublicTenant } from "../lib/types";
import ChatWidget from "./ChatWidget";

/**
 * Full-page floating widget. Used for:
 *   /widget?tenant=ID  — standalone visitor chat page
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
  const [open, setOpen] = useState(true); // embed opens immediately

  useEffect(() => {
    // Explicit ?tenant= / configured id wins; otherwise fall back to the
    // backend's first active tenant so the demo widget always loads.
    const load = tenantId ? getPublicTenant(tenantId) : getDefaultTenant();
    load
      .then(setTenant)
      .catch(() =>
        setErr(
          tenantId
            ? "This chat is unavailable. Please try again later."
            : "No chat is available right now. Please try again later."
        )
      );
  }, [tenantId]);

  const primary = tenant?.branding.primary_color || "#c4c0ff";

  const widget = (
    <div
      className="w-[380px] h-[560px] max-w-full max-h-[calc(100dvh-32px)] bg-surface border border-outline-variant rounded-xl flex flex-col overflow-hidden chat-shadow animate-slide-up"
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

  return <main className="visitor-stage">
    <div className="visitor-heading"><span className="eyebrow">LET'S TALK</span><h1>{tenant?.branding.bot_name || "How can we help?"}</h1>
      <p>Ask a question about our services. We’ll help you find the right next step.</p></div>
    <div className="visitor-chat">
      {err ? <ErrorBox msg={err}/> : !tenant ? <Loading/> : open ? widget : <button className="visitor-launch" style={{background:primary,color:"#2000a4"}} onClick={() => setOpen(true)}>Chat with us ↗</button>}
    </div>
  </main>;
}

function Loading() {
  return (
    <div className="w-full max-w-[380px] h-[560px] max-h-[100dvh] bg-surface border border-outline-variant rounded-xl flex items-center justify-center chat-shadow">
      <span className="font-label-mono text-label-mono text-on-surface-variant animate-pulse">
        loading…
      </span>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="w-full max-w-[380px] bg-surface border border-error/40 rounded-xl p-md text-body-md text-on-surface chat-shadow">
      <div className="flex items-center gap-sm mb-xs text-error">
        <span className="material-symbols-outlined text-[18px]">error</span>
        <span className="font-label-mono text-label-mono uppercase tracking-wider">Error</span>
      </div>
      <p role="alert">{msg}</p><button className="text-button" onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}
