import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteTenant, getTenant, updateTenant } from "../lib/api";
import type { ScoringWeights, Tenant } from "../lib/types";
import { Button, ConfirmDialog, Field, StatusChip, inputCls, textareaCls } from "../lib/ui";
import EmbedCode from "./EmbedCode";

const TABS = ["General", "Instructions", "Scoring", "Appearance", "Notifications"] as const;
type Tab = (typeof TABS)[number];

export default function TenantDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [draft, setDraft] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<Tab>("General");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [more, setMore] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getTenant(id)
      .then((t) => {
        setTenant(t);
        setDraft(t);
      })
      .catch(() => setErr("Could not load this chatbot."));
  }, [id]);

  const dirty = useMemo(
    () => JSON.stringify(tenant) !== JSON.stringify(draft),
    [tenant, draft]
  );

  if (err && !draft) return <Centered>{err} <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button></Centered>;
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
      setErr("Delete failed. Please try again.");
      setConfirmDel(false); moreButton.current?.focus();
      setDeleting(false);
    }
  };

  return (
    <>
      <button className="text-button mb-md" onClick={() => nav("/admin/tenants")}>← All chatbots</button>
      <header className="page-heading">
        <div><div className="settings-heading"><h1>{tenant?.name}</h1><StatusChip active={tenant?.is_active ?? false}/></div>
          <p>Adjust your chatbot, save your changes, then try it out.</p></div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => window.open(`/admin/tenants/${id}/test`, "_blank", "noopener")}>Test chatbot ↗</Button>
          <Button onClick={save} disabled={saving || !dirty}>{saving ? "Save…" : "Save changes"}</Button>
          <div className="more-wrap">
            <button ref={moreButton} className="more-button" aria-expanded={more} aria-controls="chatbot-more" onClick={() => setMore(v => !v)}>More</button>
            {more && <><button className="menu-dismiss" aria-label="Close more actions" onClick={() => setMore(false)}/><div className="more-menu" id="chatbot-more" onKeyDown={e => { if(e.key === "Escape") setMore(false); }}>
              <button onClick={() => { patch({is_active: !draft.is_active}); setMore(false); }}>{draft.is_active ? "Disable chatbot" : "Enable chatbot"}</button>
              <button className="text-error" onClick={() => { setConfirmDel(true); setMore(false); }}>Delete chatbot</button>
            </div></>}
          </div>
        </div>
      </header>
      {err && <p className="notice" role="alert">{err} Your changes are still here. Please try again.</p>}
      <nav className="settings-tabs" aria-label="Chatbot settings">
        {TABS.map(t => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>{t}</button>)}
      </nav>
      <div className="settings-body">
        {/* Left: editors */}
        <fieldset disabled={saving || deleting} className="settings-content space-y-lg min-w-0">
          {tab === "General" && (
            <div className="space-y-lg max-w-2xl">
              <Field label="Chatbot name">
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="Call booking link" hint="Send qualified visitors here to book a call.">
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
              <details className="embed-details"><summary>Add to your website</summary><EmbedCode tenantId={id} /></details>
            </div>
          )}

          {tab === "Instructions" && (
            <div className="space-y-lg">
              <section className="space-y-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary text-sm">terminal</span>
                  <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
                    Chatbot instructions
                  </h3>
                </div>
                <textarea
                  aria-label="Chatbot instructions"
                  className={`${textareaCls} h-[280px]`}
                  value={draft.system_prompt}
                  onChange={(e) => patch({ system_prompt: e.target.value })}
                  placeholder="Define the bot's role, personality and closing rules…"
                />
              </section>
              <section className="space-y-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-tertiary text-sm">database</span>
                  <h3 className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
                    Business knowledge
                  </h3>
                </div>
                <textarea
                  aria-label="Business knowledge"
                  className={`${textareaCls} h-[220px] !font-sans text-on-surface-variant`}
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

          {tab === "Appearance" && (
            <div className="space-y-lg max-w-2xl">
              <Field label="Primary Color">
                <div className="flex items-center gap-md">
                  <input
                    type="color"
                    value={draft.branding.primary_color}
                    onChange={(e) => patchBranding({ primary_color: e.target.value })}
                    aria-label="Choose primary color"
                    className="w-12 h-12 rounded-lg bg-surface border border-outline-variant cursor-pointer"
                  />
                  <input
                    aria-label="Primary color code"
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
            <span role="status" className="flex items-center gap-xs text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">save</span>
              {dirty ? "Unsaved changes. Save before you test." : savedAt ? `Last saved at ${savedAt}` : "All changes saved"}
            </span>
            <Button variant="ghost" onClick={() => { setDraft(tenant); setErr(null); }} disabled={!dirty || saving}>Discard changes</Button>
          </div>
        </fieldset>

      </div>

      {confirmDel && (
        <ConfirmDialog
          returnFocus={moreButton}
          title="Delete chatbot?"
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
          onCancel={() => { setConfirmDel(false); moreButton.current?.focus(); }}
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
                  className="flex-1 min-w-0 min-h-[44px] accent-primary"
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
            style={{ width: `${max > 0 ? Math.min(100, Math.max(0, draft.warm_threshold / max * 100)) : 0}%` }}
          >
            Cold
          </div>
          <div
            className="bg-tertiary/30 flex items-center justify-center text-tertiary"
            style={{ width: `${max > 0 ? Math.min(100, Math.max(0, (draft.hot_threshold - draft.warm_threshold) / max * 100)) : 0}%` }}
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
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="min-h-[44px] flex items-center gap-md"
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
