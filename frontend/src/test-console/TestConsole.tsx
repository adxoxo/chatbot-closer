import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getTenant } from "../lib/api";
import { maxScore as computeMaxScore } from "../lib/score";
import type { LlmStatus, Tenant } from "../lib/types";
import { SIGNAL_LABELS } from "../lib/types";
import ChatWidget from "../widget/ChatWidget";
import type { ChatState } from "../widget/useChat";
import ScoreArc from "./ScoreArc";

export default function TestConsole() {
  const { id = "" } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [chat, setChat] = useState<ChatState | null>(null);
  const [debug, setDebug] = useState(true);
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
    return <FullMsg>{err}</FullMsg>;
  if (!tenant) return <FullMsg>loading…</FullMsg>;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top app bar */}
      <header className="bg-surface border-b border-outline-variant px-lg py-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-lg">
          <h1 className="text-h2 font-black uppercase tracking-tight text-on-surface">
            TQ Chatbot Admin
          </h1>
          <span className="font-label-mono text-label-mono text-on-surface-variant">
            / {tenant.name}
          </span>
        </div>
        <a
          href={`/admin/tenants/${id}`}
          className="font-label-mono text-label-mono text-on-surface-variant hover:text-primary flex items-center gap-xs"
        >
          <span className="material-symbols-outlined text-[16px]">settings</span>
          Configure
        </a>
      </header>

      <LlmStatusBanner status={chat?.llmStatus} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: chat console */}
        <section
          className={`${debug ? "w-3/5" : "w-full"} flex flex-col bg-surface-container-lowest border-r border-outline-variant transition-all`}
        >
          <div className="px-lg py-sm bg-surface-container border-b border-outline-variant flex items-center justify-between shrink-0">
            <div className="flex items-center gap-md">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-secondary text-[18px]">terminal</span>
                <span className="font-label-mono text-label-mono font-bold tracking-widest text-on-surface">
                  TEST CONSOLE
                </span>
              </div>
              <div className="h-4 w-px bg-outline-variant" />
              <button
                onClick={() => setDebug((d) => !d)}
                className="flex items-center gap-sm bg-surface-container-lowest px-sm py-xs rounded border border-outline-variant"
              >
                <span className="font-label-mono text-[10px] text-on-surface-variant">DEBUG VIEW</span>
                <span
                  className={`w-8 h-4 rounded-full relative flex items-center px-xs transition-colors ${
                    debug ? "bg-secondary" : "bg-outline-variant"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full bg-on-secondary transition-all ${
                      debug ? "ml-auto" : "ml-0"
                    }`}
                  />
                </span>
                <span
                  className={`font-label-mono text-[10px] font-bold ${
                    debug ? "text-secondary" : "text-outline"
                  }`}
                >
                  {debug ? "ON" : "OFF"}
                </span>
              </button>
            </div>
            <button
              onClick={() => setWidgetKey((k) => k + 1)}
              className="flex items-center gap-xs font-label-mono text-[11px] text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
              RESET SESSION
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatWidget
              key={widgetKey}
              tenantId={id}
              branding={tenant.branding}
              isTest
              showHeader={false}
              onState={setChat}
            />
          </div>
        </section>

        {/* Right: debug panel */}
        {debug && (
          <section className="w-2/5 flex flex-col bg-surface overflow-y-auto thin-scrollbar p-lg gap-lg">
            <ScoreArc
              score={chat?.score ?? 0}
              max={Math.round(maxScore)}
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
                className="w-full px-md py-sm bg-surface-container flex items-center justify-between"
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
    <div className={`shrink-0 border-b ${toneCls} px-lg py-sm flex items-start gap-sm`}>
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
