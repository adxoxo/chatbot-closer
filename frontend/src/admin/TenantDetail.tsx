import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteTenant, getTenant, updateTenant } from "../lib/api";
import type { ScoringWeights, Tenant } from "../lib/types";
import { Button, ConfirmDialog, Field, StatusChip, inputCls, textareaCls } from "../lib/ui";
import ChatWidget from "../widget/ChatWidget";
import EmbedCode from "./EmbedCode";

const TABS = ["General", "Prompt & KB", "Scoring", "Branding", "Notifications"] as const;
type Tab = (typeof TABS)[number];

export default function TenantDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [draft, setDraft] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<Tab>("Prompt & KB");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getTenant(id)
      .then((t) => {
        setTenant(t);
        setDraft(t);
      })
      .catch(() => setErr("Could not load tenant."));
  }, [id]);

  const dirty = useMemo(
    () => JSON.stringify(tenant) !== JSON.stringify(draft),
    [tenant, draft]
  );

  if (err) return <Centered>{err}</Centered>;
  if (!draft) return <Centered>loading…</Centered>;

  const patch = (p: Partial<Tenant>) => setDraft({ ...draft, ...p });
  const patchBranding = (p: Partial<Tenant["branding"]>) =>
    setDraft({ ...draft, branding: { ...draft.branding, ...p } });
  const patchWeights = (p: Partial<ScoringWeights>) =>
    setDraft({ ...draft, scoring_weights: { ...draft.scoring_weights, ...p } });

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const updated = await updateTenant(id, draft);
      setTenant(updated);
      setDraft(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setErr("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteTenant(id);
      nav("/admin/tenants");
    } catch {
      setErr("Delete failed.");
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full bg-surface border-b border-outline-variant px-lg pt-md flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-lg">
            <button
              onClick={() => nav("/admin/tenants")}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-h2 font-black text-on-surface">{draft.name}</h1>
            <StatusChip active={draft.is_active} />
          </div>
          <div className="flex items-center gap-md">
            <Button
              variant="secondary"
              onClick={() => patch({ is_active: !draft.is_active })}
              title="Toggle active — remember to Save"
            >
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                {draft.is_active ? "toggle_on" : "toggle_off"}
              </span>
              {draft.is_active ? "Disable" : "Enable"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(`/admin/tenants/${id}/test`, "_blank")}
            >
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">terminal</span>
              Test Bot
            </Button>
            <button
              onClick={() => setConfirmDel(true)}
              title="Delete tenant"
              className="px-md py-sm rounded-lg font-label-mono text-label-mono font-bold border border-error/40 text-error hover:bg-error/10 transition-all active:scale-95"
            >
              Delete
            </button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
            </Button>
          </div>
        </div>
        <nav className="flex gap-lg">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 font-label-mono text-label-mono transition-all ${
                tab === t
                  ? "text-primary border-b-2 border-primary font-bold"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: editors */}
        <div className="flex-1 overflow-y-auto thin-scrollbar p-lg space-y-lg">
          {tab === "General" && (
            <div className="space-y-lg max-w-2xl">
              <Field label="Tenant Name">
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="Calendly URL" hint="Where hot leads are sent in CLOSING state.">
                <input
                  className={inputCls}
                  value={draft.calendly_url}
                  onChange={(e) => patch({ calendly_url: e.target.value })}
                  placeholder="https://calendly.com/you/strategy-call"
                />
              </Field>
              <Field label="Active">
                <Toggle
                  on={draft.is_active}
                  onChange={(v) => patch({ is_active: v })}
                  label={draft.is_active ? "Bot is live" : "Bot is disabled"}
                />
              </Field>
              <div className="pt-md border-t border-outline-variant/30">
                <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant mb-md">
                  Embed Code
                </h3>
                <EmbedCode tenantId={id} />
              </div>
            </div>
          )}

          {tab === "Prompt & KB" && (
            <div className="space-y-lg">
              <section className="space-y-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary text-sm">terminal</span>
                  <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
                    System Prompt
                  </h3>
                </div>
                <textarea
                  className={`${textareaCls} h-[340px] text-primary`}
                  value={draft.system_prompt}
                  onChange={(e) => patch({ system_prompt: e.target.value })}
                  placeholder="Define the bot's role, personality and closing rules…"
                />
              </section>
              <section className="space-y-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-tertiary text-sm">database</span>
                  <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
                    Knowledge Base
                  </h3>
                </div>
                <textarea
                  className={`${textareaCls} h-[260px] !font-sans text-on-surface-variant`}
                  value={draft.knowledge_base}
                  onChange={(e) => patch({ knowledge_base: e.target.value })}
                  placeholder="Services, pricing, FAQs, qualification criteria…"
                />
              </section>
            </div>
          )}

          {tab === "Scoring" && (
            <ScoringTab draft={draft} patch={patch} patchWeights={patchWeights} />
          )}

          {tab === "Branding" && (
            <div className="space-y-lg max-w-2xl">
              <Field label="Primary Color">
                <div className="flex items-center gap-md">
                  <input
                    type="color"
                    value={draft.branding.primary_color}
                    onChange={(e) => patchBranding({ primary_color: e.target.value })}
                    className="w-12 h-10 rounded-lg bg-surface border border-outline-variant cursor-pointer"
                  />
                  <input
                    className={`${inputCls} font-mono`}
                    value={draft.branding.primary_color}
                    onChange={(e) => patchBranding({ primary_color: e.target.value })}
                  />
                </div>
              </Field>
              <Field label="Bot Name">
                <input
                  className={inputCls}
                  value={draft.branding.bot_name}
                  onChange={(e) => patchBranding({ bot_name: e.target.value })}
                />
              </Field>
              <Field label="Logo URL" hint="Optional. Square image works best.">
                <input
                  className={inputCls}
                  value={draft.branding.logo_url}
                  onChange={(e) => patchBranding({ logo_url: e.target.value })}
                  placeholder="https://…/logo.png"
                />
              </Field>
              <Field label="Welcome Message">
                <textarea
                  className={`${textareaCls} !font-sans h-24 text-on-surface`}
                  value={draft.branding.welcome_message}
                  onChange={(e) => patchBranding({ welcome_message: e.target.value })}
                />
              </Field>
            </div>
          )}

          {tab === "Notifications" && (
            <div className="space-y-lg max-w-2xl">
              <Field
                label="n8n Webhook URL"
                hint="A single POST fires here the first time a lead reaches CLOSING. n8n handles the downstream fan-out (email, Slack, CRM…). Leave empty to disable."
              >
                <input
                  className={inputCls}
                  value={draft.n8n_webhook_url}
                  onChange={(e) => patch({ n8n_webhook_url: e.target.value })}
                  placeholder="https://n8n.example.com/webhook/hot-lead"
                />
              </Field>
              <Field
                label="Notification Email"
                hint="Passed through to n8n in the payload so it knows where to route the alert."
              >
                <input
                  className={inputCls}
                  value={draft.notification_email}
                  onChange={(e) => patch({ notification_email: e.target.value })}
                  placeholder="alerts@yourcompany.com"
                />
              </Field>
            </div>
          )}

          <div className="pt-md flex items-center justify-between border-t border-outline-variant/30">
            <span className="flex items-center gap-xs text-[12px] text-on-surface-variant/60">
              <span className="material-symbols-outlined text-[14px]">save</span>
              {savedAt ? `Last saved at ${savedAt}` : "Not saved yet"}
            </span>
            <div className="flex gap-sm">
              <Button variant="secondary" onClick={() => setDraft(tenant)} disabled={!dirty}>
                Discard
              </Button>
              <Button onClick={save} disabled={saving || !dirty}>
                Save Configuration
              </Button>
            </div>
          </div>
          {err && <p className="text-error font-label-mono text-label-mono">{err}</p>}
        </div>

        {/* Right: live preview */}
        <div className="w-[420px] bg-surface-container border-l border-outline-variant flex flex-col p-lg shrink-0">
          <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant mb-md">
            Widget Preview
          </h3>
          <div className="flex-1 rounded-2xl border border-outline-variant overflow-hidden chat-shadow">
            <ChatWidget
              key={draft.branding.primary_color + draft.branding.bot_name + id}
              tenantId={id}
              branding={draft.branding}
              isTest
              showHeader
            />
          </div>
          <p className="text-center text-[10px] text-on-surface-variant/50 mt-sm font-label-mono">
            Live • runs against this tenant in test mode
          </p>
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog
          title="Delete tenant?"
          danger
          busy={deleting}
          confirmLabel="Delete permanently"
          message={
            <>
              This permanently deletes <b className="text-on-surface">{draft.name}</b> and all of
              its conversations, messages, and leads. This cannot be undone.
              <br />
              <span className="text-on-surface-variant/70">
                To keep the data but stop the bot, use Disable instead.
              </span>
            </>
          }
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}

function ScoringTab({
  draft,
  patch,
  patchWeights,
}: {
  draft: Tenant;
  patch: (p: Partial<Tenant>) => void;
  patchWeights: (p: Partial<ScoringWeights>) => void;
}) {
  const w = draft.scoring_weights;
  const max =
    (w.weight_bl + w.weight_bs + w.weight_pc + w.weight_u + w.weight_da) * 2;
  const rows: { key: keyof ScoringWeights; label: string }[] = [
    { key: "weight_bl", label: "Business Legitimacy" },
    { key: "weight_bs", label: "Buyable Signal" },
    { key: "weight_pc", label: "Pain Clarity" },
    { key: "weight_u", label: "Urgency" },
    { key: "weight_da", label: "Decision Authority" },
  ];

  return (
    <div className="space-y-lg max-w-2xl">
      <div>
        <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant mb-md">
          Signal Weights
        </h3>
        <p className="text-caption text-on-surface-variant/70 mb-md">
          Each signal scores 0–2. Weight multiplies its contribution. Max possible
          score: <span className="text-on-surface font-bold">{max.toFixed(1)}</span>.
        </p>
        <div className="space-y-md">
          {rows.map((r) => (
            <Field key={r.key} label={r.label}>
              <div className="flex items-center gap-md">
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.5}
                  value={w[r.key]}
                  onChange={(e) => patchWeights({ [r.key]: parseFloat(e.target.value) } as any)}
                  className="flex-1 accent-primary"
                />
                <span className="font-mono text-label-mono text-primary w-12 text-right">
                  ×{w[r.key].toFixed(1)}
                </span>
              </div>
            </Field>
          ))}
        </div>
      </div>

      <div className="pt-md border-t border-outline-variant/30">
        <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant mb-md">
          Thresholds
        </h3>
        <div className="grid grid-cols-2 gap-md">
          <Field label="Hot ≥" hint="Push to Calendly">
            <input
              type="number"
              step={0.5}
              className={inputCls}
              value={draft.hot_threshold}
              onChange={(e) => patch({ hot_threshold: parseFloat(e.target.value) })}
            />
          </Field>
          <Field label="Warm ≥" hint="Capture email">
            <input
              type="number"
              step={0.5}
              className={inputCls}
              value={draft.warm_threshold}
              onChange={(e) => patch({ warm_threshold: parseFloat(e.target.value) })}
            />
          </Field>
        </div>
        {/* Tier band preview */}
        <div className="mt-md flex h-8 rounded-lg overflow-hidden border border-outline-variant font-label-mono text-[10px] uppercase">
          <div
            className="bg-outline/30 flex items-center justify-center text-on-surface-variant"
            style={{ width: `${(draft.warm_threshold / max) * 100}%` }}
          >
            Cold
          </div>
          <div
            className="bg-tertiary/30 flex items-center justify-center text-tertiary"
            style={{ width: `${((draft.hot_threshold - draft.warm_threshold) / max) * 100}%` }}
          >
            Warm
          </div>
          <div className="bg-secondary/30 flex-1 flex items-center justify-center text-secondary">
            Hot
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center gap-md"
    >
      <span
        className={`w-10 h-5 rounded-full relative transition-colors ${
          on ? "bg-secondary" : "bg-surface-container-high"
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-on-surface transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
      <span className="font-label-mono text-label-mono text-on-surface-variant">{label}</span>
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center font-label-mono text-label-mono text-on-surface-variant">
      {children}
    </div>
  );
}
