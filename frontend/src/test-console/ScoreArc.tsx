import type { LeadState } from "../lib/types";

/** Signature lead-intent arc gauge (180° semicircle, 6px stroke, rounded caps). */
export default function ScoreArc({
  score,
  max,
  state,
}: {
  score: number;
  max: number;
  state: LeadState;
}) {
  const pct = Math.max(0, Math.min(1, max ? score / max : 0));

  // Color by lead tier.
  const tier =
    state === "CLOSING"
      ? { stroke: "#68dbae", text: "text-secondary", glow: "arc-glow-secondary", label: "CLOSING" }
      : state === "NURTURING"
      ? { stroke: "#ffb95d", text: "text-tertiary", glow: "arc-glow-tertiary", label: "NURTURING" }
      : state === "PARKING"
      ? { stroke: "#918fa1", text: "text-on-surface-variant", glow: "arc-glow-muted", label: "PARKING" }
      : pct >= 0.66
      ? { stroke: "#68dbae", text: "text-secondary", glow: "arc-glow-secondary", label: state }
      : pct >= 0.33
      ? { stroke: "#ffb95d", text: "text-tertiary", glow: "arc-glow-tertiary", label: state }
      : { stroke: "#c4c0ff", text: "text-primary", glow: "arc-glow-muted", label: state };

  // Semicircle path from (10,50) to (90,50), radius 40.
  const R = 40;
  const len = Math.PI * R; // arc length of semicircle
  const dash = len;
  const offset = len * (1 - pct);

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant p-lg flex flex-col items-center relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-1 opacity-20"
        style={{ background: tier.stroke }}
      />
      <span className="font-label-mono text-[11px] text-on-surface-variant uppercase tracking-[0.2em] mb-md">
        Lead Intent Score
      </span>
      <div className={`relative w-48 h-28 flex items-end justify-center ${tier.glow}`}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 60">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#2A2A30"
            strokeLinecap="round"
            strokeWidth="6"
          />
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={tier.stroke}
            strokeLinecap="round"
            strokeWidth="6"
            strokeDasharray={dash}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1), stroke 0.3s" }}
          />
        </svg>
        <div className="flex flex-col items-center mb-xs">
          <span className={`text-[44px] font-black leading-none ${tier.text}`}>
            {score.toFixed(score % 1 === 0 ? 0 : 1)}
          </span>
          <span className="font-label-mono text-[10px] text-on-surface-variant">
            / {max} TOTAL
          </span>
        </div>
      </div>
      <div
        className="mt-sm px-md py-xs rounded-full border"
        style={{ borderColor: `${tier.stroke}55`, background: `${tier.stroke}1a` }}
      >
        <span className={`font-label-mono font-bold tracking-widest text-[12px] ${tier.text}`}>
          {tier.label}
        </span>
      </div>
    </div>
  );
}
