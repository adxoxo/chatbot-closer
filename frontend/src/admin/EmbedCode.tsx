import { useState } from "react";
import { API_BASE } from "../lib/api";

/** Where the deployed widget lives. In the demo the frontend serves itself. */
const WIDGET_ORIGIN =
  (import.meta.env.VITE_WIDGET_ORIGIN as string) || window.location.origin;

export default function EmbedCode({ tenantId }: { tenantId: string }) {
  const script = `<script
  src="${WIDGET_ORIGIN}/widget.js"
  data-tenant-id="${tenantId}"
  data-api="${API_BASE}"
  data-position="bottom-right"
></script>`;

  const iframe = `<iframe
  src="${WIDGET_ORIGIN}/embed?tenant=${tenantId}"
  width="380"
  height="560"
  frameborder="0"
  style="border:none;"
></iframe>`;

  return (
    <div className="flex flex-col gap-md">
      <Snippet label="Script tag (recommended)" code={script} />
      <Snippet label="iFrame (CSP fallback)" code={iframe} />
    </div>
  );
}

function Snippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard may be blocked; ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center justify-between">
        <span className="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 font-label-mono text-[10px] text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[14px]">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md font-mono text-[11px] text-primary/80 overflow-x-auto whitespace-pre-wrap thin-scrollbar">
        {code}
      </pre>
    </div>
  );
}
