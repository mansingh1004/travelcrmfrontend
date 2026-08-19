import { useCallback, useEffect, useState } from "react";
import {
  Pencil, Loader2, X, CheckCircle2, AlertTriangle, RefreshCw, Users, Layers, Check,
  CalendarClock, HardDrive, BellRing, Network, HandCoins, Save, Info,
} from "lucide-react";
import { planService } from "../api/planService";
import { subAgentPricingService } from "../api/subAgentPricingService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

const fmtLimit = (v) => (v == null ? "Unlimited" : Number(v).toLocaleString());
const fmtStorage = (v) => (v == null ? "Unlimited" : `${Number(v).toLocaleString()} MB`);
// Sub-agents is a GATED capability: null/0 = not granted (unlike other limits where null = unlimited).
const fmtSubAgents = (v) => (v ? Number(v).toLocaleString() : "None");
const fmtPrice = (v, ccy) =>
  `${ccy || "INR"} ${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-body">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function PlanEditDrawer({ plan, availableModules, onClose, onSaved, showToast }) {
  const [form, setForm] = useState(() => ({
    displayName: plan.displayName ?? "",
    monthlyPrice: plan.monthlyPrice ?? 0,
    currency: plan.currency ?? "INR",
    maxUsers: plan.maxUsers ?? "", // "" = unlimited
    maxLeads: plan.maxLeads ?? "",
    maxBookingsPerMonth: plan.maxBookingsPerMonth ?? "",
    maxStorageMb: plan.maxStorageMb ?? "",
    maxSubAgents: plan.maxSubAgents ?? "",
    modules: new Set(plan.modules ?? []),
    active: plan.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [mfaError, setMfaError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleModule = (m) =>
    setForm((f) => {
      const s = new Set(f.modules);
      s.has(m) ? s.delete(m) : s.add(m);
      return { ...f, modules: s };
    });

  const submit = async (e) => {
    e.preventDefault();
    setMfaError("");
    setPendingPayload({
      displayName: form.displayName,
      monthlyPrice: Number(form.monthlyPrice),
      currency: form.currency,
      maxUsers: form.maxUsers === "" ? null : Number(form.maxUsers),
      maxLeads: form.maxLeads === "" ? null : Number(form.maxLeads),
      maxBookingsPerMonth: form.maxBookingsPerMonth === "" ? null : Number(form.maxBookingsPerMonth),
      maxStorageMb: form.maxStorageMb === "" ? null : Number(form.maxStorageMb),
      maxSubAgents: form.maxSubAgents === "" ? null : Number(form.maxSubAgents),
      modules: Array.from(form.modules),
      active: form.active,
    });
  };

  const confirmSave = async (mfaCode) => {
    if (!pendingPayload) return;
    setSaving(true);
    try {
      await planService.update(plan.publicId, pendingPayload, mfaCode);
      showToast("success", "Plan updated");
      setPendingPayload(null);
      onSaved();
    } catch (e2) {
      const msg = e2?.response?.data?.message || "Save failed";
      setMfaError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50" onClick={saving ? undefined : onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-bold text-heading">
            Edit plan · <span className="font-mono text-accent">{plan.code}</span>
          </h2>
          <button onClick={onClose} className="text-muted hover:text-body" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <Field label="Display name">
              <input className={inputCls} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly price">
                <input type="number" min={0} step="0.01" className={inputCls} value={form.monthlyPrice}
                  onChange={(e) => set("monthlyPrice", e.target.value)} />
              </Field>
              <Field label="Currency">
                <input className={inputCls} value={form.currency} onChange={(e) => set("currency", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max users" hint="Blank = unlimited">
                <input type="number" min={1} className={inputCls} value={form.maxUsers}
                  onChange={(e) => set("maxUsers", e.target.value)} placeholder="∞" />
              </Field>
              <Field label="Max leads" hint="Blank = unlimited">
                <input type="number" min={1} className={inputCls} value={form.maxLeads}
                  onChange={(e) => set("maxLeads", e.target.value)} placeholder="∞" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max bookings / month" hint="Blank = unlimited">
                <input type="number" min={1} className={inputCls} value={form.maxBookingsPerMonth}
                  onChange={(e) => set("maxBookingsPerMonth", e.target.value)} placeholder="∞" />
              </Field>
              <Field label="Max storage (MB)" hint="Blank = unlimited">
                <input type="number" min={1} className={inputCls} value={form.maxStorageMb}
                  onChange={(e) => set("maxStorageMb", e.target.value)} placeholder="∞" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max sub-agents" hint="Gated · blank or 0 = disabled">
                <input type="number" min={0} className={inputCls} value={form.maxSubAgents}
                  onChange={(e) => set("maxSubAgents", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <Field label="Modules unlocked">
              <div className="grid grid-cols-2 gap-1.5">
                {availableModules.map((m) => {
                  const on = form.modules.has(m);
                  return (
                    <button key={m} type="button" onClick={() => toggleModule(m)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        on
                          ? "border-accent bg-accent-soft text-accent-soft-text"
                          : "border-border bg-surface text-muted hover:bg-surface-hover"
                      }`}>
                      <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${on ? "border-accent bg-accent text-accent-text" : "border-border-strong"}`}>
                        {on && <Check size={10} />}
                      </span>
                      {m}
                    </button>
                  );
                })}
              </div>
            </Field>

            <label className="flex items-center gap-2 text-sm text-body">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)}
                className="h-4 w-4 rounded border-border-strong accent-violet-600" />
              Plan is active (available to assign)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Save
            </button>
          </div>
        </form>
        {pendingPayload && (
          <SuperAdminMfaActionModal
            title="Confirm plan change"
            description={`Verify before changing limits, modules, or pricing for ${plan.code}.`}
            confirmLabel="Save plan"
            saving={saving}
            error={mfaError}
            onClose={saving ? undefined : () => setPendingPayload(null)}
            onConfirm={confirmSave}
          />
        )}
      </div>
    </div>
  );
}

/* ── Platform-wide Travel Partner seat pricing (same across all tenants) ── */
function SeatPricingCard({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recurring, setRecurring] = useState("");
  const [oneTime, setOneTime] = useState("");   // "" = fall back to recurring
  const [pendingPayload, setPendingPayload] = useState(null);
  const [mfaError, setMfaError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await subAgentPricingService.get();
      setData(d);
      setRecurring(d?.recurringSeatFee != null ? String(d.recurringSeatFee) : "");
      setOneTime(d?.oneTimeLicenseFee != null ? String(d.oneTimeLicenseFee) : "");
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    const rec = Number(recurring);
    if (recurring === "" || isNaN(rec) || rec < 0) { showToast("error", "Enter a valid recurring seat fee (0 or more)."); return; }
    const one = oneTime.trim() === "" ? null : Number(oneTime);
    if (one != null && (isNaN(one) || one < 0)) { showToast("error", "One-time fee must be 0 or more (or blank)."); return; }
    setMfaError("");
    setPendingPayload({ recurringSeatFee: rec, oneTimeLicenseFee: one });
  };

  const confirmSave = async (mfaCode) => {
    if (!pendingPayload) return;
    setSaving(true);
    try {
      const d = await subAgentPricingService.set(pendingPayload, mfaCode);
      setData(d);
      setRecurring(d?.recurringSeatFee != null ? String(d.recurringSeatFee) : "");
      setOneTime(d?.oneTimeLicenseFee != null ? String(d.oneTimeLicenseFee) : "");
      setPendingPayload(null);
      showToast("success", "Travel Partner seat pricing saved - applies to all tenants.");
    } catch (e2) {
      const msg = e2?.response?.data?.message || "Couldn't save pricing.";
      setMfaError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const ccy = data?.currency || "INR";
  const effLicense = data?.effectiveLicenseFee;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--sa-card-shadow)]"
          style={{ backgroundImage: "var(--sa-gradient)" }}>
          <HandCoins size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-heading">Travel Partner seat pricing</h2>
          <p className="text-sm text-body">One price for every tenant. Set it once here.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></div>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Recurring monthly fee (per active partner)"
              hint="Added to each tenant's plan invoice: plan price + (active partners × this fee).">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">{ccy}</span>
                <input type="number" min={0} step="0.01" className={`${inputCls} pl-11`} value={recurring}
                  onChange={(e) => setRecurring(e.target.value)} placeholder="0" />
              </div>
            </Field>
            <Field label="One-time unlock fee (per seat)"
              hint="Charged when a partner is bought over cap. Blank = same as the recurring fee.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">{ccy}</span>
                <input type="number" min={0} step="0.01" className={`${inputCls} pl-11`} value={oneTime}
                  onChange={(e) => setOneTime(e.target.value)}
                  placeholder={data?.recurringSeatFee != null ? String(data.recurringSeatFee) : "0"} />
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-hover px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
              <Info size={13} />
              {data?.licenseFeeUsingRecurringFallback
                ? `Unlock uses the recurring rate: ${ccy} ${Number(effLicense ?? 0).toLocaleString()} / seat.`
                : `Unlock: ${ccy} ${Number(effLicense ?? 0).toLocaleString()} · recurring: ${ccy} ${Number(data?.recurringSeatFee ?? 0).toLocaleString()} /mo.`}
            </span>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save pricing
            </button>
          </div>
        </form>
      )}
      {pendingPayload && (
        <SuperAdminMfaActionModal
          title="Confirm platform seat pricing"
          description="Verify before changing the Travel Partner seat pricing applied across tenants."
          confirmLabel="Save pricing"
          saving={saving}
          error={mfaError}
          onClose={saving ? undefined : () => setPendingPayload(null)}
          onConfirm={confirmSave}
        />
      )}
    </div>
  );
}

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [expiring, setExpiring] = useState(false);
  const [dunning, setDunning] = useState(false);
  const [mfaAction, setMfaAction] = useState(null);
  const [mfaError, setMfaError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans((await planService.list()) || []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runExpiry = async () => {
    setMfaError("");
    setMfaAction({ type: "expiry" });
  };

  const runDunning = async () => {
    setMfaError("");
    setMfaAction({ type: "dunning" });
  };

  const confirmMfaAction = async (mfaCode) => {
    if (!mfaAction) return;
    const action = mfaAction;
    if (action.type === "expiry") setExpiring(true);
    else setDunning(true);
    setMfaError("");
    try {
      if (action.type === "expiry") {
        const r = await planService.runExpiry(mfaCode);
        showToast("success", `Expiry sweep complete - ${r?.expired ?? 0} tenant(s) expired`);
      } else {
        const r = await planService.runDunning(mfaCode);
        showToast("success", `Dunning sweep complete - ${r?.changed ?? 0} tenant(s) updated`);
      }
      setMfaAction(null);
    } catch (e) {
      const msg = e?.response?.data?.message || (action.type === "expiry" ? "Expiry sweep failed" : "Dunning sweep failed");
      setMfaError(msg);
      showToast("error", msg);
    } finally {
      setExpiring(false);
      setDunning(false);
    }
  };

  const sweepSaving = mfaAction?.type === "expiry" ? expiring : dunning;
  const availableModules = Array.from(
    new Set(plans.flatMap((plan) => plan.modules || [])),
  ).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-heading">Subscription Plans</h1>
          <p className="text-sm text-body">Feature limits &amp; pricing. Assign a plan to a tenant from the Tenants page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={runDunning} disabled={dunning} title="ACTIVE→PAST_DUE (overdue) and PAST_DUE→EXPIRED (past grace)"
            className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60">
            {dunning ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
            Run dunning sweep
          </button>
          <button onClick={runExpiry} disabled={expiring}
            className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60">
            {expiring ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Run expiry sweep
          </button>
        </div>
      </div>

      <SeatPricingCard showToast={showToast} />

      {loading ? (
        <div className="py-16 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div key={p.publicId} className="flex flex-col rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-heading">{p.displayName}</h2>
                    {!p.active && (
                      <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">inactive</span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted">{p.code}</div>
                </div>
                <button onClick={() => setEditing(p)} title="Edit plan"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-body">
                  <Pencil size={15} />
                </button>
              </div>

              <div className="mt-3 font-mono text-2xl font-bold text-heading">
                {fmtPrice(p.monthlyPrice, p.currency)}
                <span className="text-sm font-normal text-muted"> /mo</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-surface-hover px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted"><Users size={12} /> Users</div>
                  <div className="font-mono font-semibold text-heading">{fmtLimit(p.maxUsers)}</div>
                </div>
                <div className="rounded-lg bg-surface-hover px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted"><Layers size={12} /> Leads</div>
                  <div className="font-mono font-semibold text-heading">{fmtLimit(p.maxLeads)}</div>
                </div>
                <div className="rounded-lg bg-surface-hover px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted"><CalendarClock size={12} /> Bookings/mo</div>
                  <div className="font-mono font-semibold text-heading">{fmtLimit(p.maxBookingsPerMonth)}</div>
                </div>
                <div className="rounded-lg bg-surface-hover px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted"><HardDrive size={12} /> Storage</div>
                  <div className="font-mono font-semibold text-heading">{fmtStorage(p.maxStorageMb)}</div>
                </div>
                <div className="rounded-lg bg-surface-hover px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted"><Network size={12} /> Sub-agents</div>
                  <div className="font-mono font-semibold text-heading">{fmtSubAgents(p.maxSubAgents)}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-muted">Modules ({(p.modules || []).length})</div>
                <div className="flex flex-wrap gap-1">
                  {(p.modules || []).map((m) => (
                    <span key={m} className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-soft-text">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PlanEditDrawer plan={editing} availableModules={availableModules} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} showToast={showToast} />
      )}

      {mfaAction && (
        <SuperAdminMfaActionModal
          title={mfaAction.type === "expiry" ? "Confirm expiry sweep" : "Confirm dunning sweep"}
          description={
            mfaAction.type === "expiry"
              ? "Verify before expiring tenants whose subscription period has ended."
              : "Verify before updating overdue tenants into dunning states."
          }
          confirmLabel={mfaAction.type === "expiry" ? "Run expiry" : "Run dunning"}
          saving={sweepSaving}
          error={mfaError}
          onClose={sweepSaving ? undefined : () => setMfaAction(null)}
          onConfirm={confirmMfaAction}
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
