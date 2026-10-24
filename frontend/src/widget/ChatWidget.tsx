import { useEffect, useRef, useState } from "react";
import type { Branding } from "../lib/types";
import { captureEmail, markBooked } from "../lib/api";
import { useChat, nowTime } from "./useChat";

interface Props {
  tenantId: string;
  branding: Branding;
  isTest?: boolean;
  /** When embedded as a self-contained widget we render our own header chrome. */
  showHeader?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  /** Bubble up chat state for debug consumers (test console). */
  onState?: (s: ReturnType<typeof useChat>["state"]) => void;
  className?: string;
}

export default function ChatWidget({
  tenantId,
  branding,
  isTest = false,
  showHeader = true,
  onClose,
  onMinimize,
  onState,
  className = "",
}: Props) {
  const { state, send, reset } = useChat(tenantId, isTest);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const primary = branding.primary_color || "#c4c0ff";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [state.messages.length, state.sending, state.captureEmail, state.calendlyUrl]);

  useEffect(() => {
    onState?.(state);
  }, [state, onState]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  const botName = branding.bot_name || "TQ Assistant";

  return (
    <div
      className={`tq-chat flex flex-col min-h-0 h-full bg-surface overflow-hidden ${className}`}
      style={{ ["--tq-primary" as any]: primary }}
    >
      {showHeader && (
        <header className="glass-header h-[72px] px-md flex items-center justify-between border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-md">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center overflow-hidden"
                style={{ background: "#2a2a2d" }}
              >
                {branding.logo_url ? (
                  <img src={branding.logo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ color: primary }}
                  >
                    smart_toy
                  </span>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-body-md font-semibold text-on-surface leading-tight">
                {botName}
              </h2>
              <p className="text-caption text-on-surface-variant">{isTest ? "Test conversation" : "Ask us a question"}</p>
            </div>
          </div>
          <div className="flex gap-xs text-on-surface-variant">
            {onMinimize && (
              <button
                onClick={onMinimize}
                aria-label="Minimize chat"
                className="min-w-[44px] min-h-[44px] material-symbols-outlined hover:text-on-surface transition-colors p-xs"
                title="Minimize"
              >
                minimize
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close chat"
                className="min-w-[44px] min-h-[44px] material-symbols-outlined hover:text-error transition-colors p-xs"
                title="Close"
              >
                close
              </button>
            )}
          </div>
        </header>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions text"
        className="min-h-0 flex-1 overflow-y-auto thin-scrollbar p-md flex flex-col gap-lg bg-[#0F0F12]"
      >
        {/* Welcome message */}
        <BotBubble botName={botName} primary={primary} time={nowTime()}>
          {branding.welcome_message || "Hi! How can I help you today?"}
        </BotBubble>

        {state.messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} primary={primary} time={fmt(m.created_at)}>
              {m.content}
            </UserBubble>
          ) : (
            <BotBubble key={m.id} botName={botName} primary={primary} time={fmt(m.created_at)}>
              {m.content}
            </BotBubble>
          )
        )}

        {state.sending && <TypingIndicator primary={primary} />}

        {/* CLOSING — Calendly CTA */}
        {state.calendlyUrl && !state.sending && (
          <CalendlyCard url={state.calendlyUrl} conversationId={state.conversationId} />
        )}

        {/* NURTURING — email capture (never alongside a Calendly close) */}
        {state.captureEmail && !state.calendlyUrl && !state.sending && state.conversationId && (
          <EmailCaptureCard conversationId={state.conversationId} />
        )}

        {state.error && (
          <div role="alert" className="self-center text-caption text-error bg-error-container/20 border border-error/30 rounded-lg px-md py-sm">
            {state.error}
          </div>
        )}
      </div>

      {/* Input */}
      <footer className="p-md border-t border-outline-variant bg-surface flex flex-col gap-sm shrink-0">
        <form onSubmit={submit} className="chat-composer flex items-center gap-sm">
          <input
            aria-label="Your message"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={state.sending}
            placeholder="Type a message..."
            className="min-w-0 flex-1 min-h-[46px] bg-surface-container-lowest border border-outline-variant focus:border-primary rounded-lg px-md py-sm text-body-md text-on-surface transition-all outline-none placeholder:text-on-surface-variant/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={state.sending || !input.trim()}
            className="shrink-0 w-[46px] h-[46px] rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
            style={{ background: primary, color: "#2000a4" }}
            title="Send message"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined icon-fill text-[18px]">send</span>
          </button>
        </form>
        <div className="flex justify-between items-center px-xs">
          <span className="text-xs text-on-surface-variant">
            {isTest ? "TEST MODE" : "POWERED BY TQ AI"}
          </span>
          {!isTest && <button
            disabled={state.sending}
            onClick={reset}
            className="min-h-[44px] text-xs text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[12px]">restart_alt</span>
            New chat
          </button>}
        </div>
      </footer>
    </div>
  );
}

function BotBubble({
  children,
  botName,
  primary,
  time,
}: {
  children: React.ReactNode;
  botName: string;
  primary: string;
  time: string;
}) {
  return (
    <div className="flex flex-col gap-xs max-w-[88%] break-words whitespace-pre-wrap self-start">
      <div
        className="bg-surface-container text-on-surface p-md rounded-xl rounded-tl-none border-l-2 text-body-md leading-relaxed"
        style={{ borderColor: primary }}
      >
        {children}
      </div>
      <span className="font-label-mono text-[10px] text-on-surface-variant ml-sm uppercase tracking-wider">
        {botName} • {time}
      </span>
    </div>
  );
}

function UserBubble({
  children,
  primary,
  time,
}: {
  children: React.ReactNode;
  primary: string;
  time: string;
}) {
  return (
    <div className="flex flex-col gap-xs max-w-[88%] break-words whitespace-pre-wrap self-end">
      <div
        className="p-md rounded-xl rounded-tr-none text-body-md leading-relaxed shadow-lg"
        style={{ background: primary, color: "#2000a4" }}
      >
        {children}
      </div>
      <span className="font-label-mono text-[10px] text-on-surface-variant mr-sm text-right uppercase tracking-wider">
        You • {time}
      </span>
    </div>
  );
}

function TypingIndicator({ primary }: { primary: string }) {
  return (
    <div className="flex items-center gap-sm self-start">
      <span className="sr-only" role="status">Assistant response in progress</span>
      <div aria-hidden="true" className="bg-surface-container-high px-md py-sm rounded-full flex gap-1 items-center border border-outline-variant/30">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full typing-dot"
            style={{ background: primary }}
          />
        ))}
      </div>
    </div>
  );
}

function CalendlyCard({
  url,
  conversationId,
}: {
  url: string;
  conversationId: string | null;
}) {
  const onBook = () => {
    // Fire-and-forget: tell the backend (→ n8n) the visitor clicked to book.
    // Never block opening Calendly on it.
    if (conversationId) markBooked(conversationId).catch(() => {});
  };
  return (
    <div className="self-start max-w-[90%] w-full rounded-xl border border-secondary/40 bg-secondary-container/10 p-md flex flex-col gap-sm beveled-edge">
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-secondary text-[20px]">event_available</span>
        <span className="font-label-mono text-[11px] uppercase tracking-widest text-secondary font-bold">
          You're a fit — let's talk
        </span>
      </div>
      <p className="text-body-md text-on-surface">
        Grab the next available slot and our team will take it from there.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={onBook}
        className="mt-xs min-h-[44px] inline-flex items-center justify-center gap-xs bg-secondary text-on-secondary font-label-mono text-label-mono font-bold rounded-lg px-md py-sm hover:opacity-90 active:scale-[0.98] transition-all"
      >
        Book My Call
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </a>
    </div>
  );
}

function EmailCaptureCard({ conversationId }: { conversationId: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErr("Enter a valid email");
      return;
    }
    try {
      await captureEmail(conversationId, email);
      setDone(true);
    } catch {
      setErr("Couldn't save — try again");
    }
  };

  return (
    <div className="self-start max-w-[90%] w-full rounded-xl border border-tertiary/40 bg-tertiary-container/10 p-md flex flex-col gap-sm beveled-edge">
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-tertiary text-[20px]">mark_email_unread</span>
        <span className="font-label-mono text-[11px] uppercase tracking-widest text-tertiary font-bold">
          Stay in the loop
        </span>
      </div>
      {done ? (
        <p className="text-body-md text-on-surface">Got it — we'll be in touch. 👋</p>
      ) : (
        <>
          <p className="text-body-md text-on-surface">
            Drop your email and we'll send over the relevant details.
          </p>
          <form onSubmit={submit} className="email-form flex flex-wrap gap-sm">
            <input
              type="email"
              aria-label="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr(null);
              }}
              placeholder="you@company.com"
              className="min-w-0 min-h-[44px] flex-1 bg-surface-container-lowest border border-outline-variant focus:border-tertiary rounded-lg px-md py-sm text-body-md outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] bg-tertiary text-on-tertiary font-label-mono text-label-mono font-bold rounded-lg px-md py-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Send
            </button>
          </form>
          {err && <span className="text-caption text-error">{err}</span>}
        </>
      )}
    </div>
  );
}

function fmt(iso?: string): string {
  if (!iso) return nowTime();
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
