import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTenant, deleteTenant, listTenants, updateTenant } from "../lib/api";
import type { Tenant } from "../lib/types";
import { Button, ConfirmDialog, StatusChip } from "../lib/ui";
import { TopBar } from "./AdminLayout";

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const nav = useNavigate();

  const load = () =>
    listTenants()
      .then(setTenants)
      .catch(() => setErr("Could not load tenants. Check the backend + admin key."));

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (t: Tenant) => {
    setBusyId(t.id);
    try {
      await updateTenant(t.id, { is_active: !t.is_active });
      await load();
    } catch {
      setErr("Could not update tenant status.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteTenant(toDelete.id);
      setToDelete(null);
      await load();
    } catch {
      setErr("Could not delete tenant.");
    } finally {
      setDeleting(false);
    }
  };

  const onCreate = async () => {
    setCreating(true);
    try {
      const t = await createTenant({
        name: "New Tenant",
        system_prompt:
          "You are a sales closer. Qualify the visitor and move high-intent leads to a booked call.",
        knowledge_base: "",
      });
      nav(`/admin/tenants/${t.id}`);
    } catch {
      setErr("Could not create tenant.");
      setCreating(false);
    }
  };

  return (
    <>
      <TopBar title="Tenants">
        <Button onClick={onCreate} disabled={creating}>
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">add</span>
          New Tenant
        </Button>
      </TopBar>
      <div className="p-lg">
        {err && <p className="text-error font-label-mono text-label-mono mb-md">{err}</p>}
        <div className="bg-surface-container border border-outline-variant/40 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/50 font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th className="px-md py-sm font-medium">Name</th>
                <th className="px-md py-sm font-medium">Bot</th>
                <th className="px-md py-sm font-medium">Status</th>
                <th className="px-md py-sm font-medium">ID</th>
                <th className="px-md py-sm font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-outline-variant/20 hover:bg-surface-container-high/50 transition-colors"
                >
                  <td className="px-md py-md font-semibold text-on-surface">{t.name}</td>
                  <td className="px-md py-md text-on-surface-variant">
                    <span className="flex items-center gap-sm">
                      <span
                        className="w-3 h-3 rounded-full border border-outline-variant"
                        style={{ background: t.branding?.primary_color || "#c4c0ff" }}
                      />
                      {t.branding?.bot_name || "—"}
                    </span>
                  </td>
                  <td className="px-md py-md">
                    <StatusChip active={t.is_active} />
                  </td>
                  <td className="px-md py-md font-label-mono text-[10px] text-on-surface-variant">
                    {t.id.slice(0, 8)}…
                  </td>
                  <td className="px-md py-md">
                    <div className="flex gap-sm justify-end items-center">
                      <Button variant="secondary" onClick={() => nav(`/admin/tenants/${t.id}`)}>
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => window.open(`/admin/tenants/${t.id}/test`, "_blank")}
                      >
                        Test Bot
                      </Button>
                      <button
                        onClick={() => toggleActive(t)}
                        disabled={busyId === t.id}
                        title={t.is_active ? "Disable" : "Enable"}
                        className="w-9 h-9 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-all disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {t.is_active ? "toggle_on" : "toggle_off"}
                        </span>
                      </button>
                      <button
                        onClick={() => setToDelete(t)}
                        title="Delete tenant"
                        className="w-9 h-9 rounded-lg border border-outline-variant text-on-surface-variant hover:text-error hover:border-error/50 flex items-center justify-center transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && !err && (
                <tr>
                  <td colSpan={5} className="px-md py-xl text-center text-on-surface-variant">
                    No tenants yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete tenant?"
          danger
          busy={deleting}
          confirmLabel="Delete permanently"
          message={
            <>
              This permanently deletes <b className="text-on-surface">{toDelete.name}</b> and all
              of its conversations, messages, and leads. This cannot be undone.
              <br />
              <span className="text-on-surface-variant/70">
                To keep the data but stop the bot, use Disable instead.
              </span>
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
