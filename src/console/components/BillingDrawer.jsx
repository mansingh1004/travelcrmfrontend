import { useCallback, useEffect, useState } from "react";
import { X, Loader2, Plus, CheckCircle2, RotateCcw, Receipt, Network } from "lucide-react";
import { billingService } from "../api/billingService";
import { planService } from "../api/planService";
import { tenantService } from "../api/tenantService";
import SuperAdminMfaActionModal from "./SuperAdminMfaActionModal";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

const money = (a, c) =>
  `${c || "INR"} ${Number(a ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function BillingStatusPill({ status, overdue }) {
  const map = {
    PAID: "bg-hue-emerald-soft text-hue-emerald ring-hue-emerald/20",
    UNPAID: "bg-hue-amber-soft text-hue-amber ring-hue-amber/20",
    VOID: "bg-surface-hover text-muted ring-border",
    // Credit note (negative amount) from a mid-cycle downgrade proration.
    CREDIT: "bg-hue-sky-soft text-hue-sky ring-hue-sky/20",
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${map[status] || map.VOID}`}>
        {status}
      </span>
      {overdue && (
        <span className="rounded bg-hue-orange-soft px-1.5 py-0.5 text-[10px] font-semibold text-hue-orange ring-1 ring-hue-orange/20">
          overdue
        </span>
      )}
    </span>
  );
}

export default function BillingDrawer({ tenant, onClose, onChanged, showToast }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "INR", dueDate: "", notes: "" });
  // The recurring invoice = plan price + sub-agent seat fee. It's billed "plan-derived" (amount left
  // null) so the backend folds in the current seat fee; a custom amount is taken verbatim (no seat fee).
  const [planPrice, setPlanPrice] = useState(null);
  const [customAmount, setCustomAmount] = useState(false);
  const [mfaAction, setMfaAction] = useState(null);
  const [mfaError, setMfaError] = useState("");

  // Sub-agent seat fee (per-tenant override vs platform default).
  const [seatInfo, setSeatInfo] = useState(null);
  const [seatInput, setSeatInput] = useState("");
  const [seatLoading, setSeatLoading] = useState(true);
  const [seatSaving, setSeatSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords((await billingService.listForTenant(tenant.publicId)) || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [tenant.publicId]);

  useEffect(() => { load(); }, [load]);

  // Prefill the issue amount/currency from the tenant's current plan.
  useEffect(() => {
    planService.list()
      .then((plans) => {
        const p = (plans || []).find((x) => x.code === tenant.plan);
        if (p) {
          setPlanPrice(p.monthlyPrice ?? null);
          setForm((f) => ({ ...f, currency: p.currency || "INR" }));
        }
      })
      .catch(() => {});
  }, [tenant.plan]);

  // Load the tenant's sub-agent seat-fee position.
  const loadSeatFee = useCallback(async () => {
    setSeatLoading(true);
    try {
      const info = await tenantService.getSeatFee(tenant.publicId);
      setSeatInfo(info);
      setSeatInput(info?.overrideRate != null ? String(info.overrideRate) : "");
    } catch {
      setSeatInfo(null);
    } finally {
      setSeatLoading(false);
    }
  }, [tenant.publicId]);
  useEffect(() => { loadSeatFee(); }, [loadSeatFee]);

  const saveSeatFee = async () => {
    const monthlySeatFee = seatInput.trim() === "" ? null : Number(seatInput);
    if (monthlySeatFee != null && (Number.isNaN(monthlySeatFee) || monthlySeatFee < 0)) {
      showToast("error", "Enter a valid seat fee.");
      return;
    }
    setMfaError("");
    setMfaAction({ type: "seatFee", monthlySeatFee });
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const issue = async (e) => {
    e.preventDefault();
    const amount = customAmount ? (form.amount === "" ? null : Number(form.amount)) : null;
    if (customAmount && amount != null && (Number.isNaN(amount) || amount < 0)) {
      showToast("error", "Enter a valid invoice amount.");
      return;
    }
    setMfaError("");
    setMfaAction({
      type: "issueInvoice",
      payload: {
        // Plan-derived (null) -> backend charges plan price + sub-agent seat fee. A custom amount is
        // billed verbatim (seat fee NOT auto-added), matching BillingServiceImpl.create.
        amount,
        currency: form.currency || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      },
    });
  };

  const setPaid = async (r, paid) => {
    setMfaError("");
    setMfaAction({ type: paid ? "markPaid" : "markUnpaid", record: r });
  };

  const confirmMfaAction = async (mfaCode) => {
    if (!mfaAction) return;
    const action = mfaAction;
    setMfaError("");

    if (action.type === "seatFee") setSeatSaving(true);
    else if (action.type === "issueInvoice") setSaving(true);
    else setBusyId(action.record.publicId);

    try {
      if (action.type === "seatFee") {
        const info = await tenantService.setSeatFee(tenant.publicId, { monthlySeatFee: action.monthlySeatFee }, mfaCode);
        setSeatInfo(info);
        setSeatInput(info?.overrideRate != null ? String(info.overrideRate) : "");
        showToast("success", action.monthlySeatFee == null ? "Reverted to platform default" : "Seat fee updated");
        onChanged?.();
      } else if (action.type === "issueInvoice") {
        await billingService.create(tenant.publicId, action.payload, mfaCode);
        showToast("success", "Invoice issued");
        setShowForm(false);
        await load();
        onChanged?.();
      } else {
        const paid = action.type === "markPaid";
        await (paid
          ? billingService.markPaid(action.record.publicId, mfaCode)
          : billingService.markUnpaid(action.record.publicId, mfaCode));
        showToast("success", paid ? "Marked paid" : "Marked unpaid");
        await load();
        onChanged?.();
      }
      setMfaAction(null);
    } catch (e2) {
      const msg = e2?.response?.data?.message || "Authenticator verification failed.";
      setMfaError(msg);
      showToast("error", msg);
    } finally {
      setBusyId(null);
      setSaving(false);
      setSeatSaving(false);
    }
  };

  const actionCopy = () => {
    if (!mfaAction) return {};
    if (mfaAction.type === "seatFee") {
      return {
        title: "Confirm seat-fee change",
        description: `Verify before changing billing seat pricing for ${tenant.organizationName}.`,
        confirmLabel: "Save fee",
      };
    }
    if (mfaAction.type === "issueInvoice") {
      return {
        title: "Confirm invoice issue",
        description: `Verify before issuing a billing invoice for ${tenant.organizationName}.`,
        confirmLabel: "Issue invoice",
      };
    }
    return {
      title: mfaAction.type === "markPaid" ? "Confirm mark paid" : "Confirm mark unpaid",
      description: `Verify before updating invoice ${mfaAction.record?.invoiceNumber || ""}.`,
      confirmLabel: mfaAction.type === "markPaid" ? "Mark paid" : "Mark unpaid",
    };
  };

  const actionSaving = () => {
    if (!mfaAction) return false;
    if (mfaAction.type === "seatFee") return seatSaving;
    if (mfaAction.type === "issueInvoice") return saving;
    return busyId === mfaAction.record?.publicId;
  };

  const seatTotal = Number(seatInfo?.monthlyTotal || 0);
  const planBase = Number(planPrice || 0);
  const grandTotal = planBase + seatTotal;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-accent" />
            <div>
              <h2 className="text-sm font-bold text-heading">Billing · {tenant.organizationName}</h2>
              <div className="font-mono text-xs text-muted">{tenant.plan}</div>
            </div>
          </div>
          <button onClick={onClose} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus text-muted hover:text-body"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Sub-agent seat fee ── */}
          <div className="mb-4 rounded-xl border border-border bg-surface-hover/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Network size={15} className="text-accent" />
              <h3 className="text-sm font-bold text-heading">Sub-agent seat fee</h3>
            </div>
            {seatLoading ? (
              <div className="py-4 text-center text-muted"><Loader2 size={16} className="mx-auto animate-spin" /></div>
            ) : !seatInfo ? (
              <p className="text-xs text-muted">Seat-fee info unavailable.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted">Active seats</div>
                    <div className="font-mono text-sm font-bold text-heading">{seatInfo.activeSeats}</div>
                  </div>
                  <div className="rounded-lg bg-surface px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted">Rate / seat</div>
                    <div className="font-mono text-sm font-bold text-heading">{money(seatInfo.effectiveRate)}</div>
                  </div>
                  <div className="rounded-lg bg-surface px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted">Monthly</div>
                    <div className="font-mono text-sm font-bold text-heading">{money(seatInfo.monthlyTotal)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-semibold text-body">Override rate / seat</label>
                    <input type="number" min={0} step="0.01" className={inputCls} value={seatInput}
                      onChange={(e) => setSeatInput(e.target.value)}
                      placeholder={`Default ${money(seatInfo.effectiveRate)}`} />
                  </div>
                  <button onClick={saveSeatFee} disabled={seatSaving}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
                    {seatSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {seatInfo.usingPlatformDefault
                    ? "Using the platform-default rate. Enter a value to override for this tenant."
                    : "Per-tenant override active. Clear the field and Save to revert to the platform default."}
                </p>
              </>
            )}
          </div>

          {!showForm && (
            <div className="mb-3 flex justify-end">
              <button onClick={() => setShowForm(true)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text hover:bg-accent-hover">
                <Plus size={15} /> Issue invoice
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={issue} className="mb-4 space-y-3 rounded-xl border border-border bg-surface-hover p-4">
              {!customAmount ? (
                <div className="rounded-lg border border-border bg-surface p-3 text-sm">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-body">Plan · <span className="font-mono">{tenant.plan}</span></span>
                    <span className="font-mono font-semibold text-heading">{money(planBase, form.currency)}</span>
                  </div>
                  {seatTotal > 0 && seatInfo && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-body">
                        Sub-agent seats
                        <span className="text-muted"> · {seatInfo.activeSeats} × {money(seatInfo.effectiveRate, form.currency)}</span>
                      </span>
                      <span className="font-mono font-semibold text-heading">+ {money(seatTotal, form.currency)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                    <span className="font-semibold text-heading">Total due</span>
                    <span className="font-mono text-base font-bold text-accent">{money(grandTotal, form.currency)}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">Custom amount</label>
                    <input type="number" min={0} step="0.01" className={inputCls} value={form.amount}
                      onChange={(e) => set("amount", e.target.value)} placeholder="Plan default" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">Currency</label>
                    <input className={inputCls} value={form.currency} onChange={(e) => set("currency", e.target.value)} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-medium text-body">
                <input type="checkbox" checked={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.checked);
                    if (e.target.checked && form.amount === "" && planPrice != null) set("amount", String(planPrice));
                  }}
                  className="h-4 w-4 rounded border-border-strong accent-accent" />
                Set a custom amount (sub-agent seat fee not auto-added)
              </label>
              <div>
                <label className="mb-1 block text-xs font-semibold text-body">
                  Due date <span className="font-normal text-muted">(blank = +15 days)</span>
                </label>
                <input type="date" className={inputCls} value={form.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-body">Notes</label>
                <input className={inputCls} value={form.notes}
                  onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} disabled={saving}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-sm font-semibold text-body hover:bg-surface-hover">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
                  {saving && <Loader2 size={14} className="animate-spin" />} Issue
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-12 text-center text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">No invoices yet.</div>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.publicId} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-heading">{r.invoiceNumber}</span>
                        <BillingStatusPill status={r.status} overdue={r.overdue} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {r.periodStart} → {r.periodEnd} · due {r.dueDate || "—"}
                        {r.paidDate ? ` · paid ${r.paidDate}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-bold text-heading">{money(r.amount, r.currency)}</div>
                      <div className="mt-1">
                        {r.status === "PAID" ? (
                          <button onClick={() => setPaid(r, false)} disabled={busyId === r.publicId}
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body disabled:opacity-60">
                            {busyId === r.publicId ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Mark unpaid
                          </button>
                        ) : r.status === "UNPAID" ? (
                          <button onClick={() => setPaid(r, true)} disabled={busyId === r.publicId}
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1 text-xs font-semibold text-hue-emerald hover:opacity-80 disabled:opacity-60">
                            {busyId === r.publicId ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Mark paid
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {r.notes && <div className="mt-2 border-t border-border pt-2 text-xs text-body">{r.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {mfaAction && (
          <SuperAdminMfaActionModal
            {...actionCopy()}
            saving={actionSaving()}
            error={mfaError}
            onClose={actionSaving() ? undefined : () => setMfaAction(null)}
            onConfirm={confirmMfaAction}
          />
        )}
      </div>
    </div>
  );
}
