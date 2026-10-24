import { useEffect, useId, useRef } from "react";
import type { LeadState, Priority } from "./types";

export function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-sm w-max px-sm py-1 rounded-md border text-xs ${
        active
          ? "bg-secondary-container/20 border-secondary/30 text-secondary"
          : "bg-surface-container-high border-outline-variant text-on-surface-variant"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${active ? "bg-secondary" : "bg-outline"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  hot: "bg-secondary-container/20 border-secondary/40 text-secondary",
  warm: "bg-tertiary-container/20 border-tertiary/40 text-tertiary",
  cold: "bg-surface-container-high border-outline-variant text-on-surface-variant",
};

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center px-sm py-1 rounded-md border text-xs font-bold ${PRIORITY_STYLE[priority]}`}
    >
      {priority}
    </span>
  );
}

const STATE_STYLE: Record<LeadState, string> = {
  GREETING: "text-on-surface-variant border-outline-variant",
  QUALIFYING: "text-primary border-primary/40",
  CLOSING: "text-secondary border-secondary/40",
  NURTURING: "text-tertiary border-tertiary/40",
  PARKING: "text-on-surface-variant border-outline-variant",
};

export function StateChip({ state }: { state: LeadState }) {
  return (
    <span
      className={`inline-flex items-center px-sm py-1 rounded border font-label-mono text-[10px] uppercase tracking-wider ${STATE_STYLE[state]}`}
    >
      {state}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary:
      "bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/10",
    secondary:
      "border border-outline-variant text-on-surface hover:bg-surface-container",
    ghost: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
  }[variant];
  return (
    <button
      {...rest}
      className={`min-h-[44px] px-md py-sm rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:active:scale-100 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-sm font-medium text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint && <span className="text-caption text-on-surface-variant">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "min-h-[44px] min-w-0 w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg px-md py-sm text-body-md text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40";

export const textareaCls =
  "min-h-[44px] min-w-0 w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl p-md font-sans text-body-md text-on-surface leading-relaxed resize-none outline-none transition-all placeholder:text-on-surface-variant/40";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  returnFocus,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocus?: React.RefObject<HTMLElement>;
}) {
  return <Dialog title={title} onClose={onCancel} busy={busy} returnFocus={returnFocus} className="confirm-dialog">
    <h2 className="text-2xl font-semibold mb-md">{title}</h2>
    <div className="text-sm text-on-surface-variant leading-relaxed">{message}</div>
    <div className="flex flex-wrap justify-end gap-sm mt-lg">
      <Button variant="secondary" onClick={onCancel} disabled={busy} autoFocus>Cancel</Button>
      <Button onClick={onConfirm} disabled={busy} className={danger ? "!bg-error !text-on-error" : ""}>
        {busy ? "Please wait…" : confirmLabel}
      </Button>
    </div>
  </Dialog>;
}

export function Dialog({title, children, onClose, busy = false, className = "", returnFocus}: {
  title: string; children: React.ReactNode; onClose: () => void; busy?: boolean; className?: string; returnFocus?: React.RefObject<HTMLElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); const target = returnFocus?.current || previous; if (target?.isConnected && target !== document.body) target.focus(); };
  }, []);
  return <dialog ref={ref} tabIndex={-1} onKeyDown={e => {
    if (e.key !== "Tab") return;
    const targets = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.getClientRects().length > 0);
    const first = targets[0], last = targets[targets.length - 1];
    if (!first) { e.preventDefault(); e.currentTarget.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }} className={`tq-dialog ${className}`} aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    onClick={e => { if (e.target !== e.currentTarget || busy) return;
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    }}>
    <span id={titleId} className="sr-only">{title}</span>{children}
  </dialog>;
}
