import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search, Loader2, ChevronLeft, ChevronRight, ToggleLeft, Check, X,
  CheckCircle2, AlertTriangle, RotateCcw, Building2,
} from "lucide-react";
import { tenantService } from "../api/tenantService";
import { featureFlagService } from "../api/featureFlagService";
import StatusPill from "../components/StatusPill";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

function ModulesModal({ tenant, onClose, showToast }) {
  const [available, setAvailable] = useState([]);
  const [enabled, setEnabled] = useState(new Set());
  const [planModules, setPlanModules] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mfaError, setMfaError] = useState("");

  useEffect(() => {
    featureFlagService.getModules(tenant.publicId)
      .then((d) => {
        setAvailable(d.available || []);
        setEnabled(new Set(d.enabled || []));
        setPlanModules(new Set(d.planModules || []));
      })
      .catch(() => showToast("error", "Failed to load modules"))
      .finally(() => setLoading(false));
  }, [tenant.publicId, showToast]);

  const toggle = (m) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });

  const save = () => {
    setMfaError("");
    setConfirming(true);
  };

  const confirmSave = async (mfaCode) => {
    setSaving(true);
    setMfaError("");
    try {
      await featureFlagService.updateModules(tenant.publicId, Array.from(enabled), mfaCode);
      showToast("success", "Modules updated");
      onClose();
    } catch (e) {
      setMfaError(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-heading">Modules · {tenant.organizationName}</h3>
            <p className="mt-0.5 text-xs text-muted">
              Plan <span className="font-mono">{tenant.plan}</span> · toggle module access
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-body" disabled={saving}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></div>
        ) : (
          <>
            <div className="mt-4 grid max-h-[52vh] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {available.map((m) => {
                const on = enabled.has(m);
                const inPlan = planModules.has(m);
                return (
                  <button key={m} type="button" onClick={() => toggle(m)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                      on ? "border-accent bg-accent-soft text-accent-soft-text"
                         : "border-border bg-surface text-muted hover:bg-surface-hover"
                    }`}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                        on ? "border-accent bg-accent text-accent-text" : "border-border-strong"}`}>
                        {on && <Check size={10} />}
                      </span>
                      {m}
                    </span>
                    {!inPlan && (
                      <span title="Not in the tenant's plan" className="rounded bg-amber-500/10 px-1 text-[9px] font-semibold text-amber-600">extra</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setEnabled(new Set(planModules))}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-body">
                <RotateCcw size={13} /> Reset to plan
              </button>
              <div className="flex gap-3">
                <button onClick={onClose} disabled={saving}
                  className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
                  Cancel
                </button>
                <button onClick={save} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {confirming && (
        <SuperAdminMfaActionModal
          title="Confirm feature flag change"
          description={`Enter your authenticator code to update modules for ${tenant.organizationName}.`}
          confirmLabel="Save"
          saving={saving}
          error={mfaError}
          onClose={() => (saving ? undefined : setConfirming(false))}
          onConfirm={confirmSave}
        />
      )}
    </div>
  );
}

export default function FeatureFlags() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId") || "";
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [modalTenant, setModalTenant] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { rows, pagination } = await tenantService.list({ search: debounced, page, size: 20 });
      setRows(rows);
      setPagination(pagination);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load tenants.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!tenantId) return;
    tenantService.get(tenantId)
      .then(setModalTenant)
      .catch(() => showToast("error", "Selected tenant could not be loaded."));
  }, [tenantId, showToast]);

  const totalPages = pagination.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-heading">Feature Flags</h1>
        <p className="text-sm text-body">Toggle module access per tenant. Defaults come from the plan; overrides stick until you reset.</p>
      </div>

      {tenantId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm text-body">
          <span>Tenant entitlement workspace opened from Tenant 360.</span>
          <Link to="/console/feature-flags" className="text-xs font-semibold text-accent hover:underline">Show all tenants</Link>
        </div>
      )}

      <div className="relative min-w-[240px] max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenants…"
          className={`${inputCls} pl-9`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">
                  <Loader2 size={18} className="mx-auto animate-spin" />
                </td></tr>
              ) : error ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-red-500">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">
                  <Building2 size={28} className="mx-auto mb-2 opacity-50" /> No tenants found.
                </td></tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.publicId} className="hover:bg-surface-hover/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-heading">{t.organizationName}</div>
                      <div className="font-mono text-xs text-muted">{t.organizationCode}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-body">{t.plan}</td>
                    <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModalTenant(t)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover">
                        <ToggleLeft size={14} /> Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-body hover:bg-surface-hover disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalTenant && (
        <ModulesModal tenant={modalTenant} onClose={() => setModalTenant(null)} showToast={showToast} />
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
