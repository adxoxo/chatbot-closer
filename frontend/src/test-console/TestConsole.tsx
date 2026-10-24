import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTenant } from "../lib/api";
import { maxScore as computeMaxScore } from "../lib/score";
import type { LlmStatus, Tenant } from "../lib/types";
import { SIGNAL_LABELS } from "../lib/types";
import ChatWidget from "../widget/ChatWidget";
import type { ChatState } from "../widget/useChat";
import ScoreArc from "./ScoreArc";
import { AdminHeader } from "../admin/AdminLayout";
import { Button } from "../lib/ui";

export default function TestConsole() {
  const { id = "" } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [chat, setChat] = useState<ChatState | null>(null);
  const [debug, setDebug] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);

  useEffect(() => {
    getTenant(id)
      .then(setTenant)
      .catch(() => setErr("Could not load tenant config."));
  }, [id]);

  const maxScore = useMemo(() => computeMaxScore(tenant?.scoring_weights), [tenant]);

  if (err)
    return <FullMsg>{err} <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button></FullMsg>;
  if (!tenant) return <FullMsg>loading…</FullMsg>;

  return (
    <div className="tq-admin"><AdminHeader />
      <main className="workspace test-workspace">
        <Link className="text-button inline-flex mb-md" to={`/admin/tenants/${id}`}>← Back to settings</Link>
        <header className="page-heading"><div><h1>Test your chatbot</h1><p>{tenant.name}. These conversations stay separate from visitor leads.</p></div>
          <div className="heading-actions"><Button variant="secondary" onClick={() => {setWidgetKey(k => k + 1); setChat(null);}}>New conversation</Button>
            <Button variant="secondary" aria-expanded={debug} aria-controls="test-details" onClick={() => setDebug(d => !d)}>Test details</Button></div>
        </header>
      <LlmStatusBanner status={chat?.llmStatus} />

      <div className={`test-layout ${debug ? "with-details" : ""}`}>
        <section className="test-chat-panel" aria-label="Test conversation">
          <div className="flex-1 overflow-hidden">
            <ChatWidget
              key={widgetKey}
              tenantId={id}
              branding={tenant.branding}
              isTest
              showHeader
              onState={setChat}
            />
          </div>
        </section>

        {/* Right: debug panel */}
        {debug && (
          <section id="test-details" aria-label="Test details" className="test-details flex flex-col gap-lg">
            <ScoreArc
              score={chat?.score ?? 0}
              max={maxScore}
              state={chat?.state ?? "GREETING"}
            />

            {/* Signal breakdown */}
            <div className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <h3 className="font-label-mono text-on-surface font-bold text-[12px] uppercase tracking-wider">
                  Signal Breakdown
                </h3>
                <span className="material-symbols-outlined text-outline text-[16px]">info</span>
              </div>
              <div className="flex flex-col gap-sm">
                {(Object.keys(SIGNAL_LABELS) as (keyof typeof SIGNAL_LABELS)[]).map((k) => {
                  const v = chat?.signals?.[k] ?? 0;
                  const pct = (v / 2) * 100;
                  const color = v >= 2 ? "bg-secondary" : v >= 1 ? "bg-primary" : "bg-outline";
                  return (
                    <div key={k} className="flex flex-col gap-xs">
                      <div className="flex justify-between font-label-mono text-[11px]">
                        <span className="text-on-surface-variant">{SIGNAL_LABELS[k]}</span>
                        <span className="text-on-surface">{v} / 2</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* State history */}
            <div className="flex flex-col gap-md">
              <h3 className="font-label-mono text-on-surface font-bold text-[12px] uppercase tracking-wider">
                State History
              </h3>
              <div className="flex items-center gap-xs flex-wrap">
                {(chat?.history ?? [{ state: "GREETING", at: "" }]).map((h, i, arr) => {
                  const active = i === arr.length - 1;
                  return (
                    <div key={i} className="flex items-center gap-xs">
                      <div className="flex flex-col gap-xs items-center">
                        <div
                          className={`h-8 px-sm flex items-center justify-center rounded border ${
                            active
                              ? "bg-secondary/10 border-secondary"
                              : "bg-surface-container border-outline-variant"
                          }`}
                        >
                          <span
                            className={`font-label-mono text-[10px] ${
                              active ? "text-secondary font-bold" : "text-outline"
                            }`}
                          >
                            {h.state}
                          </span>
                        </div>
                        <span className="font-label-mono text-[9px] text-outline">
                          {active ? "ACTIVE" : h.at}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <span className="material-symbols-outlined text-outline-variant text-[14px]">
                          chevron_right
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Raw signal extraction */}
            <div className="p-md bg-surface-container-lowest border border-outline-variant rounded-lg">
              <div className="flex items-center gap-sm mb-xs">
                <span className="material-symbols-outlined text-primary text-[16px]">code</span>
                <span className="font-label-mono text-[10px] text-on-surface-variant font-bold uppercase">
                  Raw Signal Extraction
                </span>
              </div>
              <pre className="font-mono text-[10px] text-primary/80 overflow-x-auto whitespace-pre-wrap thin-scrollbar">
                {JSON.stringify(
                  {
                    score: chat?.score ?? 0,
                    state: chat?.state ?? "GREETING",
                    llm_status: chat?.llmStatus ?? "ok",
                    signals: chat?.signals ?? {},
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            {/* System prompt preview */}
            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <button
                onClick={() => setShowPrompt((s) => !s)}
                aria-expanded={showPrompt}
                className="w-full min-h-[44px] px-md py-sm bg-surface-container flex items-center justify-between"
              >
                <span className="font-label-mono text-[10px] text-on-surface-variant font-bold uppercase">
                  System Prompt
                </span>
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
                  {showPrompt ? "expand_less" : "expand_more"}
                </span>
              </button>
              {showPrompt && (
                <pre className="p-md font-mono text-[10px] text-on-surface-variant whitespace-pre-wrap max-h-64 overflow-y-auto thin-scrollbar bg-surface-container-lowest">
                  {tenant.system_prompt}
                  {tenant.knowledge_base
                    ? `\n\n── KNOWLEDGE BASE ──\n${tenant.knowledge_base}`
                    : ""}
                </pre>
              )}
            </div>
          </section>
        )}
      </div>
      </main>
    </div>
  );
}

function FullMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex items-center justify-center font-label-mono text-label-mono text-on-surface-variant">
      {children}
    </div>
  );
}

// Diagnostic banner: tells you whether a degraded reply came from Groq being
// down/rate-limited (not your logic) vs. a missing key. Admin-only — the
// client widget never shows this.
const LLM_STATUS_INFO: Record<
  LlmStatus,
  { icon: string; title: string; detail: string; tone: string } | null
> = {
  ok: null,
  rate_limited: {
    icon: "speed",
    title: "Groq rate limit hit (429)",
    detail:
      "You've exceeded the free-tier tokens-per-minute limit. This reply used the built-in fallback, not the AI — that's why the answer looks off. Wait a minute and retry, or upgrade your Groq tier.",
    tone: "tertiary",
  },
  timeout: {
    icon: "timer_off",
    title: "Groq request timed out",
    detail:
      "Groq didn't respond in time, so this reply used the fallback logic. Check Groq's status or your network, then retry.",
    tone: "tertiary",
  },
  error: {
    icon: "error",
    title: "Groq API error",
    detail:
      "Groq rejected the request — usually a bad/expired GROQ_API_KEY or an invalid GROQ_MODEL. This reply used the fallback logic. Check the key in backend/.env.",
    tone: "error",
  },
  mock: {
    icon: "smart_toy",
    title: "No AI key configured — running on mock",
    detail:
      "GROQ_API_KEY isn't set, so replies and scoring use the built-in mock. Set the key in backend/.env to use the real model.",
    tone: "primary",
  },
};

function LlmStatusBanner({ status }: { status?: LlmStatus }) {
  if (!status || status === "ok") return null;
  const info = LLM_STATUS_INFO[status];
  if (!info) return null;
  const toneCls =
    info.tone === "error"
      ? "bg-error/10 border-error/40 text-error"
      : info.tone === "tertiary"
      ? "bg-tertiary/10 border-tertiary/40 text-tertiary"
      : "bg-primary/10 border-primary/40 text-primary";
  return (
    <div role="status" className={`mb-md rounded-lg border ${toneCls} px-lg py-sm flex items-start gap-sm`}>
      <span className="material-symbols-outlined text-[18px] mt-0.5">{info.icon}</span>
      <div className="flex flex-col">
        <span className="font-label-mono text-[11px] font-bold uppercase tracking-wider">
          {info.title}
        </span>
        <span className="text-body-md text-on-surface-variant">{info.detail}</span>
      </div>
    </div>
  );
}
