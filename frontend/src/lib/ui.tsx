import type { LeadState, Priority } from "./types";

export function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-sm px-sm py-1 rounded-full border font-label-mono text-[10px] uppercase tracking-wider ${
        active
          ? "bg-secondary-container/20 border-secondary/30 text-secondary"
          : "bg-surface-container-high border-outline-variant text-on-surface-variant"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${active ? "bg-secondary animate-pulse" : "bg-outline"}`}
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
      className={`inline-flex items-center px-sm py-1 rounded-full border font-label-mono text-[10px] uppercase tracking-wider font-bold ${PRIORITY_STYLE[priority]}`}
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
      className={`px-md py-sm rounded-lg font-label-mono text-label-mono font-bold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${styles} ${className}`}
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
      <span className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint && <span className="text-caption text-on-surface-variant/60">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg px-md py-sm text-body-md text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40";

export const textareaCls =
  "w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl p-md font-mono text-label-mono text-on-surface leading-relaxed resize-none outline-none transition-all placeholder:text-on-surface-variant/40";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-md">
      <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : onCancel} />
      <div className="relative w-[420px] max-w-full bg-surface-container-high border border-outline-variant rounded-xl p-lg flex flex-col gap-md beveled-edge shadow-2xl">
        <div className="flex items-center gap-sm">
          <span
            className={`material-symbols-outlined ${danger ? "text-error" : "text-primary"}`}
          >
            {danger ? "warning" : "help"}
          </span>
          <h3 className="text-h2 font-bold text-on-surface">{title}</h3>
        </div>
        <div className="text-body-md text-on-surface-variant">{message}</div>
        <div className="flex justify-end gap-sm mt-sm">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-md py-sm rounded-lg font-label-mono text-label-mono font-bold transition-all active:scale-95 disabled:opacity-50 ${
              danger
                ? "bg-error text-on-error hover:opacity-90"
                : "bg-primary text-on-primary hover:opacity-90"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
