import { useCallback, useEffect, useState } from "react";
import {
  Download, Loader2, AlertTriangle, CheckCircle2, Trash2, X, ShieldAlert, Building2,
} from "lucide-react";
import { opsService } from "../api/opsService";
import { tenantService } from "../api/tenantService";
import StatusPill from "../components/StatusPill";

function HardDeleteModal({ tenant, onClose, onDeleted, showToast }) {
  const [typed, setTyped] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState(false);
  const match = typed.trim().toLowerCase() === (tenant.organizationCode || "").toLowerCase();
  const mfaReady = /^\d{6}$/.test(mfaCode);

  const confirm = async () => {
    if (!match || !mfaReady) return;
    setBusy(true);
    try {
      await opsService.hardDeleteTenant(tenant.publicId, typed.trim(), mfaCode);
      showToast("success", `Permanently deleted ${tenant.organizationCode}`);
      onDeleted(tenant.publicId);
    } catch (e) {
      showToast("error", e?.response?.data?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-red-500/40 bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-red-500"><ShieldAlert size={18} /></div>
            <h3 className="text-sm font-bold text-heading">Permanently delete tenant</h3>
          </div>
          <button onClick={onClose} disabled={busy} className="text-muted hover:text-body"><X size={18} /></button>
        </div>

        <p className="mt-3 text-sm text-body">
          This <b>irreversibly</b> removes <b>{tenant.organizationName}</b> and all its user accounts.
          Billing &amp; audit records are kept. This cannot be undone.
        </p>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-muted">
            Type <span className="font-mono text-red-500">{tenant.organizationCode}</span> to confirm
          </label>
          <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-muted">Authenticator code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm tracking-[0.24em] text-heading focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={confirm} disabled={!match || !mfaReady || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete forever
          </button>
        </div>
      </div>
    </div>
  );
}

function StepUpModal({ busy, onClose, onConfirm }) {
  const [mfaCode, setMfaCode] = useState("");
  const ready = /^\d{6}$/.test(mfaCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-text">
            <Download size={17} />
          </div>
          <h3 className="text-sm font-bold text-heading">Export tenant registry</h3>
        </div>
        <p className="mt-2 text-sm text-body">Enter the current authenticator code to continue.</p>
        <label className="mt-4 block text-xs font-semibold text-body">
          Authenticator code
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm tracking-[0.24em] text-heading focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={() => onConfirm(mfaCode)} disabled={!ready || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Ops() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMfaOpen, setExportMfaOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const { rows } = await tenantService.list({ deleted: true, size: 100 });
      setRows(rows);
    } catch {
      showToast("error", "Failed to load deleted tenants");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const id = window.setTimeout(loadDeleted, 0);
    return () => window.clearTimeout(id);
  }, [loadDeleted]);

  const exportCsv = async (mfaCode) => {
    setExporting(true);
    try {
      const blob = await opsService.downloadTenantsCsv(mfaCode);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tenants.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMfaOpen(false);
      showToast("success", "Tenant registry exported");
    } catch (e) {
      showToast("error", e?.response?.data?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-heading">Ops / Danger Zone</h1>
        <p className="text-sm text-body">Data exports and irreversible operations.</p>
      </div>

      {/* Export */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-text"><Download size={18} /></div>
            <div>
              <h2 className="text-sm font-bold text-heading">Export tenant registry</h2>
              <p className="text-xs text-muted">All tenants — code, name, status, plan, users, subscription dates — as CSV.</p>
            </div>
          </div>
          <button onClick={() => setExportMfaOpen(true)} disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download CSV
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="overflow-hidden rounded-xl border border-red-500/40 bg-surface">
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/5 px-4 py-3">
          <ShieldAlert size={16} className="text-red-500" />
          <h2 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone — permanent tenant deletion</h2>
        </div>
        <p className="px-4 pt-3 text-xs text-muted">
          Only soft-deleted tenants (in Trash) can be permanently deleted. This removes the tenant + its users and cannot be undone.
        </p>

        {loading ? (
          <div className="px-4 py-12 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted">
            <Building2 size={28} className="mx-auto mb-2 opacity-50" /> No soft-deleted tenants. Delete a tenant first to purge it here.
          </div>
        ) : (
          <ul className="divide-y divide-border p-2">
            {rows.map((t) => (
              <li key={t.publicId} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-hover/60">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-heading">{t.organizationName}</div>
                  <div className="font-mono text-xs text-muted">{t.organizationCode}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={t.status} />
                  <button onClick={() => setTarget(t)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">
                    <Trash2 size={14} /> Delete permanently
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {target && (
        <HardDeleteModal
          tenant={target}
          onClose={() => setTarget(null)}
          onDeleted={(publicId) => { setTarget(null); setRows((r) => r.filter((x) => x.publicId !== publicId)); }}
          showToast={showToast}
        />
      )}

      {exportMfaOpen && (
        <StepUpModal
          busy={exporting}
          onClose={() => setExportMfaOpen(false)}
          onConfirm={exportCsv}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
