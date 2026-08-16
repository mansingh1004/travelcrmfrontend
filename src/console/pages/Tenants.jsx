import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus, Search, Pencil, Trash2, RotateCcw, PauseCircle, PlayCircle,
  X, Loader2, ChevronLeft, ChevronRight, Building2, AlertTriangle, CheckCircle2, CreditCard, Receipt,
} from "lucide-react";
import StatusPill from "../components/StatusPill";
import BillingDrawer from "../components/BillingDrawer";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { tenantService } from "../api/tenantService";
import { planService } from "../api/planService";
import { isLocalSuperAdminMfaDisabled } from "../lib/consoleEnvironment";

const CREATE_STATUSES = ["TRIAL", "ACTIVE"];
const FILTERS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIAL", label: "Trial" },
  { value: "PAST_DUE", label: "Past due" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "EXPIRED", label: "Expired" },
];

const EMPTY = {
  organizationName: "", organizationCode: "", email: "", phone: "", address: "",
  plan: "STARTER", status: "TRIAL", maxUsers: 5,
  subscriptionStartDate: "", subscriptionEndDate: "",
  adminUsername: "", adminEmail: "", adminPassword: "",
};

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60";

function PlanBadge({ plan }) {
  return (
    <span className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-soft-text">
      {plan}
    </span>
  );
}

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-body">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Create / edit slide-over ───────────────────────────────────────────────
function TenantDrawer({ mode, tenant, onClose, onSaved, showToast }) {
  const isEdit = mode === "edit";
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(!isEdit);
  const [plansError, setPlansError] = useState("");
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          ...EMPTY,
          organizationName: tenant.organizationName ?? "",
          organizationCode: tenant.organizationCode ?? "",
          email: tenant.email ?? "",
          phone: tenant.phone ?? "",
          address: tenant.address ?? "",
          plan: tenant.plan ?? "STARTER",
          maxUsers: tenant.maxUsers ?? 5,
          subscriptionStartDate: tenant.subscriptionStartDate ?? "",
          subscriptionEndDate: tenant.subscriptionEndDate ?? "",
        }
      : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState({});

  useEffect(() => {
    if (isEdit) return undefined;
    let active = true;
    planService.list()
      .then((items) => {
        if (!active) return;
        const available = (items || []).filter((p) => p.active !== false);
        setPlans(available);
        if (available.length > 0) {
          setForm((current) => {
            const selected = available.find((p) => p.code === current.plan) || available[0];
            return { ...current, plan: selected.code, maxUsers: selected.maxUsers ?? current.maxUsers };
          });
        } else {
          setPlansError("No active plans are configured.");
        }
      })
      .catch(() => active && setPlansError("Plan catalogue could not be loaded."))
      .finally(() => active && setPlansLoading(false));
    return () => { active = false; };
  }, [isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.organizationName.trim()) errs.organizationName = "Required";
    if (!isEdit && !form.organizationCode.trim()) errs.organizationCode = "Required";
    if (!form.email.trim()) errs.email = "Valid email required";
    if (!form.subscriptionStartDate) errs.subscriptionStartDate = "Required";
    if (!form.subscriptionEndDate) errs.subscriptionEndDate = "Required";
    if (!isEdit) {
      if (plansError || plans.length === 0) errs.plan = plansError || "Select an active plan";
      if (!form.adminUsername.trim()) errs.adminUsername = "Required";
      if (!form.adminEmail.trim()) errs.adminEmail = "Valid email required";
      if (!form.adminPassword || form.adminPassword.length < 6) errs.adminPassword = "Min 6 characters";
    }
    setErr(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      if (isEdit) {
        await tenantService.update(tenant.publicId, {
          organizationName: form.organizationName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          maxUsers: Number(form.maxUsers),
          subscriptionStartDate: form.subscriptionStartDate,
          subscriptionEndDate: form.subscriptionEndDate,
        });
      } else {
        await tenantService.create({
          organizationName: form.organizationName,
          organizationCode: form.organizationCode,
          email: form.email,
          phone: form.phone,
          address: form.address,
          plan: form.plan,
          status: form.status,
          maxUsers: Number(form.maxUsers),
          subscriptionStartDate: form.subscriptionStartDate,
          subscriptionEndDate: form.subscriptionEndDate,
          adminUsername: form.adminUsername,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
        });
      }
      showToast("success", isEdit ? "Tenant updated" : "Tenant created");
      onSaved();
    } catch (e2) {
      showToast("error", e2?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-accent" />
            <h2 className="text-sm font-bold text-heading">
              {isEdit ? "Edit tenant" : "New tenant"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-body" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <Field label="Organization name" required error={err.organizationName}>
              <input className={inputCls} value={form.organizationName}
                onChange={(e) => set("organizationName", e.target.value)} placeholder="ABC Travels" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Subdomain / code" required error={err.organizationCode}>
                <input className={inputCls} value={form.organizationCode} disabled={isEdit}
                  onChange={(e) => set("organizationCode", e.target.value)} placeholder="ABC001" />
              </Field>
              <Field label="Contact email" required error={err.email}>
                <input type="email" className={inputCls} value={form.email}
                  onChange={(e) => set("email", e.target.value)} placeholder="ops@abc.com" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input className={inputCls} value={form.phone}
                  onChange={(e) => set("phone", e.target.value)} placeholder="+91 90000 00000" />
              </Field>
              <Field label="Max users">
                <input type="number" min={1} className={inputCls} value={form.maxUsers}
                  onChange={(e) => set("maxUsers", e.target.value)} />
              </Field>
            </div>

            <Field label="Address">
              <input className={inputCls} value={form.address}
                onChange={(e) => set("address", e.target.value)} placeholder="City, State" />
            </Field>

            {!isEdit && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plan" error={err.plan || plansError}>
                  <select className={inputCls} value={form.plan} disabled={plansLoading || plans.length === 0}
                    onChange={(e) => {
                      const selected = plans.find((p) => p.code === e.target.value);
                      setForm((f) => ({ ...f, plan: e.target.value, maxUsers: selected?.maxUsers ?? f.maxUsers }));
                    }}>
                    {plansLoading && <option>Loading plans…</option>}
                    {plans.map((p) => <option key={p.publicId || p.code} value={p.code}>{p.displayName} ({p.code})</option>)}
                  </select>
                </Field>
                <Field label="Initial status">
                  <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
                    {CREATE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Subscription start" required error={err.subscriptionStartDate}>
                <input type="date" className={inputCls} value={form.subscriptionStartDate}
                  onChange={(e) => set("subscriptionStartDate", e.target.value)} />
              </Field>
              <Field label="Subscription end" required error={err.subscriptionEndDate}>
                <input type="date" className={inputCls} value={form.subscriptionEndDate}
                  onChange={(e) => set("subscriptionEndDate", e.target.value)} />
              </Field>
            </div>

            {!isEdit && (
              <div className="space-y-4 rounded-lg border border-border bg-page p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">First admin account</p>
                <Field label="Admin name" required error={err.adminUsername}>
                  <input className={inputCls} value={form.adminUsername}
                    onChange={(e) => set("adminUsername", e.target.value)} placeholder="Jane Admin" />
                </Field>
                <Field label="Admin email" required error={err.adminEmail}>
                  <input type="email" className={inputCls} value={form.adminEmail}
                    onChange={(e) => set("adminEmail", e.target.value)} placeholder="admin@abc.com" />
                </Field>
                <Field label="Admin password" required error={err.adminPassword}>
                  <input type="password" className={inputCls} value={form.adminPassword}
                    onChange={(e) => set("adminPassword", e.target.value)} placeholder="••••••••" />
                </Field>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
              Cancel
            </button>
            <button type="submit" disabled={saving || (!isEdit && (plansLoading || plans.length === 0))}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {isEdit ? "Save changes" : "Create tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm dialog ──────────────────────────────────────────────────────────
function ConfirmModal({ state, busy, onClose }) {
  const [mfaCode, setMfaCode] = useState("");
  const mfaDisabled = isLocalSuperAdminMfaDisabled();

  if (!state) return null;

  const mfaReady = mfaDisabled || !state.requireMfa || /^\d{6}$/.test(mfaCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${state.danger ? "text-red-500" : "text-amber-500"}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-heading">{state.title}</h3>
            <p className="mt-1 text-sm text-body">{state.message}</p>
          </div>
        </div>
        {state.requireMfa && !mfaDisabled && (
          <label className="mt-4 block text-xs font-semibold text-body">
            Authenticator code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={`${inputCls} mt-1 font-mono tracking-[0.24em]`}
              autoFocus
              required
            />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={() => state.onConfirm(mfaDisabled ? "" : mfaCode)} disabled={busy || !mfaReady}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              state.danger ? "bg-red-600 hover:bg-red-700 dark:hover:bg-red-500" : "bg-accent hover:bg-accent-hover"
            }`}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change-plan modal ────────────────────────────────────────────────────────
function ChangePlanModal({ tenant, onClose, onDone, showToast }) {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(tenant.plan);
  const [saving, setSaving] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaError, setMfaError] = useState("");

  useEffect(() => {
    planService.list().then((p) => setPlans(p || [])).catch(() => setPlans([]));
  }, []);

  const confirm = async () => {
    setMfaError("");
    setMfaOpen(true);
  };

  const confirmChange = async (mfaCode) => {
    setSaving(true);
    try {
      await tenantService.changePlan(tenant.publicId, selected, mfaCode);
      showToast("success", `Plan changed to ${selected}`);
      onDone();
    } catch (e) {
      const msg = e?.response?.data?.message || "Plan change failed";
      setMfaError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h3 className="text-sm font-bold text-heading">Change plan · {tenant.organizationName}</h3>
        <p className="mt-1 text-xs text-muted">
          Applies the plan's seat limit. Current: <span className="font-mono">{tenant.plan}</span>
        </p>
        <div className="mt-4 space-y-2">
          {plans.length === 0 && <div className="text-xs text-muted">Loading plans…</div>}
          {plans.map((p) => (
            <label key={p.publicId}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
                selected === p.code ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-hover"
              }`}>
              <input type="radio" name="plan" checked={selected === p.code}
                onChange={() => setSelected(p.code)} className="accent-violet-600" />
              <div>
                <div className="text-sm font-semibold text-heading">
                  {p.displayName} <span className="font-mono text-xs text-muted">({p.code})</span>
                </div>
                <div className="text-[11px] text-muted">
                  {p.maxUsers == null ? "Unlimited" : p.maxUsers} users · {p.currency} {Number(p.monthlyPrice).toLocaleString()}/mo
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={confirm} disabled={saving || selected === tenant.plan}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
            {saving && <Loader2 size={15} className="animate-spin" />} Change plan
          </button>
        </div>
        {mfaOpen && (
          <SuperAdminMfaActionModal
            title="Confirm tenant plan change"
            description={`Verify before changing ${tenant.organizationName} from ${tenant.plan} to ${selected}.`}
            confirmLabel="Change plan"
            saving={saving}
            error={mfaError}
            onClose={saving ? undefined : () => setMfaOpen(false)}
            onConfirm={confirmChange}
          />
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Tenants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const initialSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(initialSearch);
  const [debounced, setDebounced] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [showDeleted, setShowDeleted] = useState(searchParams.get("deleted") === "true");
  const [page, setPage] = useState(() => Math.max(0, Number.parseInt(searchParams.get("page") || "0", 10) || 0));

  const [drawer, setDrawer] = useState(null); // { mode, tenant }
  const [confirm, setConfirm] = useState(null);
  const [planModal, setPlanModal] = useState(null);
  const [billingTenant, setBillingTenant] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search === debounced) return;
      setDebounced(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search, debounced]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debounced.trim()) next.set("q", debounced.trim());
    if (statusFilter) next.set("status", statusFilter);
    if (showDeleted) next.set("deleted", "true");
    if (page > 0) next.set("page", String(page));
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [debounced, statusFilter, showDeleted, page, searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { rows, pagination } = await tenantService.list({
        search: debounced, status: statusFilter, deleted: showDeleted, page, size: 20,
      });
      setRows(rows);
      setPagination(pagination);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load tenants.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, statusFilter, showDeleted, page]);

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const runAction = async (fn, publicId, successMsg, mfaCode) => {
    setBusyId(publicId);
    try {
      await fn(publicId, mfaCode);
      showToast("success", successMsg);
      setConfirm(null);
      await load();
    } catch (e) {
      showToast("error", e?.response?.data?.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const askSuspend = (t) => setConfirm({
    title: `Suspend ${t.organizationName}?`,
    message: "The organization's staff will be blocked from signing in until you reactivate it.",
    confirmLabel: "Suspend", danger: false,
    requireMfa: true,
    onConfirm: (mfaCode) => runAction(tenantService.suspend, t.publicId, "Tenant suspended", mfaCode),
  });
  const askReactivate = (t) => setConfirm({
    title: `Reactivate ${t.organizationName}?`,
    message: "Restores tenant access and allows the organization's staff to sign in again.",
    confirmLabel: "Reactivate", danger: false,
    requireMfa: true,
    onConfirm: (mfaCode) => runAction(tenantService.reactivate, t.publicId, "Tenant reactivated", mfaCode),
  });
  const askRestore = (t) => setConfirm({
    title: `Restore ${t.organizationName}?`,
    message: "Returns this deleted tenant to lifecycle management. Reactivate it separately if access should resume.",
    confirmLabel: "Restore", danger: false,
    requireMfa: true,
    onConfirm: (mfaCode) => runAction(tenantService.restore, t.publicId, "Tenant restored", mfaCode),
  });
  const askDelete = (t) => setConfirm({
    title: `Delete ${t.organizationName}?`,
    message: "Soft-deletes the tenant (recoverable from the deleted view). Its users can no longer sign in.",
    confirmLabel: "Delete", danger: true,
    requireMfa: true,
    onConfirm: (mfaCode) => runAction(tenantService.remove, t.publicId, "Tenant deleted", mfaCode),
  });

  const totalPages = pagination.totalPages ?? 1;
  const listContext = new URLSearchParams();
  if (debounced.trim()) listContext.set("q", debounced.trim());
  if (statusFilter) listContext.set("status", statusFilter);
  if (showDeleted) listContext.set("deleted", "true");
  if (page > 0) listContext.set("page", String(page));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-heading">Tenants</h1>
          <p className="text-sm text-body">Onboard organizations and manage their lifecycle.</p>
        </div>
        <button onClick={() => setDrawer({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover">
          <Plus size={16} /> New tenant
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, email…"
            className={`${inputCls} pl-9`} />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className={`${inputCls} w-auto`}>
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-body">
          <input type="checkbox" checked={showDeleted}
            onChange={(e) => { setShowDeleted(e.target.checked); setPage(0); }}
            className="h-4 w-4 rounded border-border-strong accent-violet-600" />
          Show deleted
        </label>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Users</th>
                <th className="px-4 py-3 font-semibold">Sub. end</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">
                  <Loader2 size={18} className="mx-auto animate-spin" />
                </td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-red-500">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">
                  <Building2 size={28} className="mx-auto mb-2 opacity-50" />
                  No tenants found.
                </td></tr>
              ) : (
                rows.map((t) => {
                  const busy = busyId === t.publicId;
                  return (
                    <tr key={t.publicId} className="hover:bg-surface-hover/60">
                      <td className="px-4 py-3">
                        <Link to={`/console/tenants/${t.publicId}`} state={{ tenantList: listContext.toString() }}
                          className="font-semibold text-heading hover:text-accent hover:underline">
                          {t.organizationName}
                        </Link>
                        <div className="font-mono text-xs text-muted">{t.organizationCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-body">{t.email}</div>
                        <div className="text-xs text-muted">{t.phone || "—"}</div>
                      </td>
                      <td className="px-4 py-3"><PlanBadge plan={t.plan} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusPill status={t.status} />
                          {t.unpaidCount > 0 && (
                            <span title={`${t.unpaidCount} unpaid invoice(s)`}
                              className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-500/20">
                              {t.unpaidCount} unpaid
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-body">{t.userCount}/{t.maxUsers}</td>
                      <td className="px-4 py-3 font-mono text-xs text-body">{t.subscriptionEndDate || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {t.deleted ? (
                            <IconBtn title="Restore" onClick={() => askRestore(t)} busy={busy}>
                              <RotateCcw size={16} />
                            </IconBtn>
                          ) : (
                            <>
                              <IconBtn title="Edit" onClick={() => setDrawer({ mode: "edit", tenant: t })} busy={busy}>
                                <Pencil size={16} />
                              </IconBtn>
                              <IconBtn title="Change plan" onClick={() => setPlanModal(t)} busy={busy}>
                                <CreditCard size={16} className="text-accent" />
                              </IconBtn>
                              <IconBtn title="Billing" onClick={() => setBillingTenant(t)} busy={busy}>
                                <Receipt size={16} />
                              </IconBtn>
                              {t.status === "SUSPENDED" || t.status === "EXPIRED" ? (
                                <IconBtn title="Reactivate" onClick={() => askReactivate(t)} busy={busy}>
                                  <PlayCircle size={16} className="text-emerald-500" />
                                </IconBtn>
                              ) : (
                                <IconBtn title="Suspend" onClick={() => askSuspend(t)} busy={busy}>
                                  <PauseCircle size={16} className="text-amber-500" />
                                </IconBtn>
                              )}
                              <IconBtn title="Delete" onClick={() => askDelete(t)} busy={busy}>
                                <Trash2 size={16} className="text-red-500" />
                              </IconBtn>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
          <span>
            {pagination.totalElements ?? 0} tenant{(pagination.totalElements ?? 0) === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-body hover:bg-surface-hover disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-xs">{(pagination.page ?? 0) + 1} / {Math.max(totalPages, 1)}</span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-body hover:bg-surface-hover disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {drawer && (
        <TenantDrawer
          mode={drawer.mode}
          tenant={drawer.tenant}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
          showToast={showToast}
        />
      )}

      <ConfirmModal
        key={confirm?.title || "confirm"}
        state={confirm}
        busy={!!busyId}
        onClose={() => setConfirm(null)}
      />

      {planModal && (
        <ChangePlanModal tenant={planModal} onClose={() => setPlanModal(null)}
          onDone={() => { setPlanModal(null); load(); }} showToast={showToast} />
      )}

      {billingTenant && (
        <BillingDrawer tenant={billingTenant} onClose={() => setBillingTenant(null)}
          onChanged={load} showToast={showToast} />
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

function IconBtn({ title, onClick, busy, children }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={busy}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-body hover:bg-surface-hover disabled:opacity-40">
      {children}
    </button>
  );
}
