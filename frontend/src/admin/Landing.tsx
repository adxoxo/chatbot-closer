import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-xl relative">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] left-[20%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[5%] right-[15%] w-[30%] h-[30%] bg-secondary/10 rounded-full blur-[140px]" />
      </div>
      <div className="max-w-2xl text-center flex flex-col items-center gap-lg">
        <span className="font-label-mono text-label-mono uppercase tracking-[0.3em] text-primary">
          System Entry One
        </span>
        <h1 className="text-h1 md:text-[56px] font-black leading-[1.05] tracking-tight">
          The AI closer that books the call
          <span className="text-primary"> before the form does.</span>
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-xl">
          A multi-tenant funnel chatbot that qualifies visitors in real time, scores
          intent, and pushes hot leads straight to a booked call. Build once,
          reconfigure forever.
        </p>
        <div className="flex flex-wrap gap-md justify-center mt-sm">
          <Link
            to="/admin/tenants"
            className="bg-primary text-on-primary px-lg py-md rounded-lg font-label-mono text-label-mono font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            Open Admin →
          </Link>
          <Link
            to="/widget"
            className="border border-outline-variant text-on-surface px-lg py-md rounded-lg font-label-mono text-label-mono font-bold hover:bg-surface-container active:scale-95 transition-all"
          >
            Try the Widget
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-md mt-xl w-full">
          {[
            { k: "HOT", v: "≥ 12", d: "Push to Calendly", c: "text-secondary" },
            { k: "WARM", v: "6–11", d: "Capture email", c: "text-tertiary" },
            { k: "COLD", v: "< 6", d: "Polite exit", c: "text-on-surface-variant" },
          ].map((b) => (
            <div
              key={b.k}
              className="bg-surface-container border border-outline-variant/40 rounded-xl p-md flex flex-col gap-xs"
            >
              <span className={`font-label-mono text-label-mono font-bold ${b.c}`}>{b.k}</span>
              <span className="text-h2 font-bold">{b.v}</span>
              <span className="text-caption text-on-surface-variant">{b.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
