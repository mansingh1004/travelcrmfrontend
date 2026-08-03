// src/features/fleet/pages/FleetSettlements.jsx
//
// The driver cash loop: peshgi out → spends against it → cash back → signed hisaab.
//
// This is the owner's 10pm screen. Every practitioner interviewed named the same first question —
// "how much of my cash is out on the road, and with whom" — and until now the product had no way to
// answer it, because driver money was framed as reimbursement rather than as a running imprest.
//
// SPEED: same quick-entry treatment as the expense grid. Driver / trip / direction stay put after a
// save, Enter records and jumps back to the amount, Esc clears the row. A clerk hands out eight
// advances before a morning departure; that is eight amounts, not eight forms.
//
// THE INVARIANT THIS SCREEN EXISTS TO ENFORCE: a trip cannot be signed off until the driver's cash
// squares to exactly zero. The server refuses otherwise — this page just makes the number and the
// reason visible so nobody has to guess which way the money is short.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet, Plus, IndianRupee, HandCoins, CheckCircle2, AlertTriangle, FileSignature,
  RotateCcw, ArrowRight, Users,
  Paperclip, Printer,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import {
  Button, Badge, PageShell, PageHeader, LoadingState, EmptyState, ConfirmDialog,
  StatCard, StatCardRow, Panel, EntityCard, MiniStat,
  useToast, errMsg, fmtMoney, fmtDate, todayDateInput,
} from "../components/fleetUi";
import { Field, fieldCls } from "../components/fleetFormKit";
import AttachmentsDialog from "../components/AttachmentsDialog";
import { openBlob, hydrateBlobError } from "@shared/lib/download";

/** Sticky across saves — a clerk works one driver, or one departure, at a time. */
const blankCash = (sticky = {}) => ({
  driverPublicId: sticky.driverPublicId || "",
  tripPublicId: sticky.tripPublicId || "",
  direction: sticky.direction || "ADVANCE_OUT",
  amount: "",
  currency: "INR",
  entryDate: sticky.entryDate || todayDateInput(),
  reason: "",
  referenceNumber: "",
  partyReference: "",
});

/** Positive = driver holds company money. Drives the card tone and the wording. */
const netTone = (net) => (net > 0 ? "amber" : net < 0 ? "rose" : "green");

export default function FleetSettlements() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const amountRef = useRef(null);

  const [directions, setDirections] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState(blankCash());
  const [errors, setErrors] = useState({});
  const [settleTarget, setSettleTarget] = useState(null);
  const [attachTarget, setAttachTarget] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const canRecord = hasPermission(P.FLEET_UPDATE);
  const canSettle = hasPermission(P.FLEET_MONEY_SETTLE);

  /* ── data ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    fleetService.listCashDirections().then(setDirections)
      .catch((e) => showToast(errMsg(e, "Failed to load cash movement types."), "error"));
    fleetService.driverOptions("ACTIVE").then(setDrivers).catch(() => {});
    // Open duties only — an advance is handed out against a trip that is about to run or running.
    fleetService.listTrips({ size: 100 }).then((r) => setTrips(r.items || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    setLoading(true);
    return fleetService
      .listOpenSettlements()
      .then((rows) => setSettlements(rows || []))
      .catch((e) => showToast(errMsg(e, "Failed to load settlements."), "error"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── derived ────────────────────────────────────────────────────────── */
  const selectedDirection = useMemo(
    () => directions.find((d) => d.code === draft.direction),
    [directions, draft.direction],
  );

  const cashOut = useMemo(
    () => settlements.reduce((s, x) => s + Math.max(0, Number(x.netDueFromDriver || 0)), 0),
    [settlements],
  );
  const owedToDrivers = useMemo(
    () => settlements.reduce((s, x) => s + Math.max(0, -Number(x.netDueFromDriver || 0)), 0),
    [settlements],
  );
  const squaredCount = useMemo(() => settlements.filter((s) => s.squared).length, [settlements]);
  const movedAfterSigning = useMemo(
    () => settlements.filter((s) => s.hasPostSettlementMovement).length, [settlements]);

  /* ── entry ──────────────────────────────────────────────────────────── */
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const validate = () => {
    const e = {};
    if (!draft.driverPublicId) e.driverPublicId = "Pick a driver";
    if (!draft.amount || Number(draft.amount) <= 0) e.amount = "Enter an amount";
    // Mirrors the server, which is the authority — these two rules come from the fetched catalogue,
    // not from a hardcoded list, so they cannot drift from the backend enum.
    if (selectedDirection?.requiresReason && !draft.reason.trim()) {
      e.reason = "This one needs a reason on record";
    }
    if (selectedDirection?.customerMoney && !draft.partyReference.trim()) {
      e.partyReference = "Whose money is it?";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitCash = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await fleetService.recordCash({
        ...draft,
        tripPublicId: draft.tripPublicId || null,
        amount: Number(draft.amount),
        reason: draft.reason.trim() || null,
        referenceNumber: draft.referenceNumber.trim() || null,
        partyReference: draft.partyReference.trim() || null,
      });
      setDraft(blankCash(draft));
      showToast("Recorded.", "success");
      await load();
      amountRef.current?.focus();
    } catch (e) {
      showToast(errMsg(e, "Could not record this movement."), "error");
    } finally { setSaving(false); }
  };

  /** Enter saves (one-row repeat grid, like the expense strip); Esc clears keeping the sticky slice. */
  const onEntryKeyDown = (e) => {
    if (saving) return;
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      submitCash();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(blankCash(draft));
      setErrors({});
      amountRef.current?.focus();
    }
  };

  /** Print → driver signs → photograph it back on as an attachment. That loop is the point. */
  const printSheet = async (row) => {
    try {
      openBlob(await fleetService.fetchSettlementSheet(row.tripPublicId, row.driverPublicId));
    } catch (e) {
      showToast(errMsg(await hydrateBlobError(e), "Couldn't generate the sheet."), "error");
    }
  };

  const doReconcile = async (s) => {
    try {
      await fleetService.reconcileSettlement(s.tripPublicId, s.driverPublicId);
      showToast("Recomputed and reconciled.", "success");
      load();
    } catch (e) { showToast(errMsg(e, "Could not reconcile."), "error"); }
  };

  const doSettle = async () => {
    if (!acknowledged) return showToast("The driver has to acknowledge the sheet.", "error");
    try {
      await fleetService.settleSettlement(
        settleTarget.tripPublicId, settleTarget.driverPublicId, true);
      showToast("Settled and signed off.", "success");
      setSettleTarget(null);
      setAcknowledged(false);
      load();
    } catch (e) {
      // The server refuses unless the net is exactly zero, and says which way it is short.
      showToast(errMsg(e, "Could not settle."), "error");
    }
  };

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <PageShell>
      <PageHeader
        icon={Wallet}
        title="Driver cash"
        subtitle="Advance out, spends against it, cash back — and the signed settlement."
      >
        <button onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-800">
          <RotateCcw className="h-4 w-4" /> Refresh
        </button>
      </PageHeader>

      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard label="Cash with drivers" value={cashOut} icon={<HandCoins />} tone="amber" money />
        <StatCard label="Owed to drivers" value={owedToDrivers} icon={<IndianRupee />} tone="rose" money />
        <StatCard label="Open sheets" value={settlements.length} icon={<Users />} tone="blue" />
        <StatCard label="Squared, unsigned" value={squaredCount} icon={<CheckCircle2 />} tone="green" />
      </StatCardRow>

      {movedAfterSigning > 0 && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{movedAfterSigning}</strong> signed sheet{movedAfterSigning === 1 ? "" : "s"} moved
            afterwards — a late bill or a reversal landed after the driver was released, so the frozen
            totals and his live balance no longer agree. They need a correcting entry.
          </p>
        </div>
      )}

      {/* ── quick entry ── */}
      {canRecord && (
        <div className="mb-6">
          <Panel
            icon={Plus}
            title="Record cash"
            description="Driver, trip and type stay put after each save. Enter records and jumps back to the amount; Esc clears the row."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12" onKeyDown={onEntryKeyDown}>
              <Field label="Driver" required error={errors.driverPublicId} className="md:col-span-3">
                <select className={fieldCls} value={draft.driverPublicId}
                        onChange={(e) => set({ driverPublicId: e.target.value })}>
                  <option value="">Select…</option>
                  {drivers.map((d) => <option key={d.publicId} value={d.publicId}>{d.label}</option>)}
                </select>
              </Field>

              <Field label="Movement" required className="md:col-span-3">
                <select className={fieldCls} value={draft.direction}
                        onChange={(e) => set({ direction: e.target.value })}>
                  {directions.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
                </select>
              </Field>

              <Field label="Amount" required error={errors.amount} className="md:col-span-2">
                <input ref={amountRef} type="number" step="0.01" min="0" placeholder="0.00"
                       className={fieldCls} value={draft.amount}
                       onChange={(e) => set({ amount: e.target.value })} />
              </Field>

              <Field label="Date" required className="md:col-span-2">
                <input type="date" className={fieldCls} value={draft.entryDate}
                       onChange={(e) => set({ entryDate: e.target.value })} />
              </Field>

              <div className="flex items-end md:col-span-2">
                <Button className="w-full" disabled={saving} onClick={submitCash}>
                  {saving ? "…" : "Record"}
                </Button>
              </div>

              {/* Optional: an opening balance or a general float is not against any one trip. */}
              <Field label="Against trip" className="md:col-span-4"
                     note="Leave blank for a general float or opening balance">
                <select className={fieldCls} value={draft.tripPublicId}
                        onChange={(e) => set({ tripPublicId: e.target.value })}>
                  <option value="">— No trip —</option>
                  {trips.map((t) => (
                    <option key={t.publicId} value={t.publicId}>
                      {[t.vehicleNumber, [t.routeFrom, t.routeTo].filter(Boolean).join(" → ")]
                        .filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Both prompts come from the fetched catalogue, so they follow the backend enum. */}
              {selectedDirection?.requiresReason && (
                <Field label="Reason" required error={errors.reason} className="md:col-span-4">
                  <input className={fieldCls} placeholder="Challan MH12/2026/8891 — driver at fault"
                         value={draft.reason} onChange={(e) => set({ reason: e.target.value })} />
                </Field>
              )}

              {selectedDirection?.customerMoney && (
                <Field label="Whose money" required error={errors.partyReference} className="md:col-span-4"
                       note="Booking code or party name — so it can be receipted against the right one">
                  <input className={fieldCls} placeholder="BKG-26-0042 / Sharma family"
                         value={draft.partyReference}
                         onChange={(e) => set({ partyReference: e.target.value })} />
                </Field>
              )}

              <Field label="Reference" className="md:col-span-3" note="UTR, cheque or slip number">
                <input className={fieldCls} value={draft.referenceNumber}
                       onChange={(e) => set({ referenceNumber: e.target.value })} />
              </Field>
            </div>
          </Panel>
        </div>
      )}

      {/* ── open sheets ── */}
      {loading ? (
        <Panel icon={Wallet} title="Open settlements"><LoadingState label="Loading…" /></Panel>
      ) : settlements.length === 0 ? (
        <Panel icon={Wallet} title="Open settlements">
          <EmptyState icon={CheckCircle2} title="Nothing outstanding"
                      hint="Every driver's cash is squared. An advance opens a new sheet." />
        </Panel>
      ) : (
        <Panel icon={Wallet} title="Open settlements"
               description="A sheet stays open until the driver's cash squares to exactly zero.">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {settlements.map((s) => {
              const net = Number(s.netDueFromDriver || 0);
              return (
                <EntityCard key={s.publicId} tone={netTone(net)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-extrabold text-slate-800">{s.driverName}</p>
                        <Badge className="bg-slate-100 text-slate-600">{s.statusLabel}</Badge>
                        {s.hasPostSettlementMovement && (
                          <Badge className="bg-rose-100 text-rose-700">moved after signing</Badge>
                        )}
                      </div>
                      <button onClick={() => navigate(`/fleet/trips/${s.tripPublicId}`)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                        Open trip <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-extrabold ${
                        net > 0 ? "text-amber-600" : net < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {fmtMoney(Math.abs(net))}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {net > 0 ? "driver holds" : net < 0 ? "company owes" : "squared"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MiniStat label="Advance" value={fmtMoney(s.advanceTotal)} />
                    <MiniStat label="Spent" value={fmtMoney(s.driverCashSpend)} />
                    <MiniStat label="Bata" value={fmtMoney(s.allowanceTotal)} />
                    <MiniStat label="Returned" value={fmtMoney(s.returnedTotal)} />
                  </div>

                  {/* Collections are kept apart from the float on purpose — a driver returning more
                      than he was ever given is otherwise how the sheet reads. */}
                  {(Number(s.collectedTotal) > 0 || Number(s.depositedTotal) > 0) && (
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="Collected from customers" value={fmtMoney(s.collectedTotal)} />
                      <MiniStat label="Deposited" value={fmtMoney(s.depositedTotal)} />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => printSheet(s)} title="Print the hisaab for signing"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                    <button onClick={() => setAttachTarget(s)} title="Signed sheet & papers"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
                      <Paperclip className="h-3.5 w-3.5" /> Files
                    </button>
                    {canRecord && (
                      <button onClick={() => doReconcile(s)}
                              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50">
                        Recompute
                      </button>
                    )}
                    {canSettle && (
                      <button
                        onClick={() => { setSettleTarget(s); setAcknowledged(false); }}
                        disabled={!s.squared}
                        title={s.squared ? undefined : "Cash has to square to zero before it can be signed"}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                        <FileSignature className="h-3.5 w-3.5" /> Settle
                      </button>
                    )}
                  </div>

                  {!s.squared && (
                    <p className="text-[11px] text-slate-400">
                      {net > 0
                        ? `Record a cash return of ${fmtMoney(net)} to square this.`
                        : `Pay the driver ${fmtMoney(Math.abs(net))} to square this.`}
                    </p>
                  )}
                </EntityCard>
              );
            })}
          </div>
        </Panel>
      )}

      <ConfirmDialog
        open={!!settleTarget}
        onOpenChange={(open) => { if (!open) { setSettleTarget(null); setAcknowledged(false); } }}
        variant="default"
        title={`Settle ${settleTarget?.driverName || ""}?`}
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              This freezes the sheet. Afterwards the figures cannot be edited — a correction becomes a
              dated reversal that stands beside the original.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Advance" value={fmtMoney(settleTarget?.advanceTotal)} />
              <MiniStat label="Spent" value={fmtMoney(settleTarget?.driverCashSpend)} />
              <MiniStat label="Bata" value={fmtMoney(settleTarget?.allowanceTotal)} />
              <MiniStat label="Returned" value={fmtMoney(settleTarget?.returnedTotal)} />
            </div>
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5" checked={acknowledged}
                     onChange={(e) => setAcknowledged(e.target.checked)} />
              <span>
                The driver has seen this sheet and agrees to it.
                <span className="block text-xs text-slate-400">
                  Recorded as his acknowledgement — the server will not sign without it.
                </span>
              </span>
            </label>
          </div>
        }
        confirmLabel="Settle & sign off"
        onConfirm={doSettle}
      />

      {/* The photographed signed sheet lives HERE — uploaded after the driver signs, appendable
          forever, never deletable once the sheet is signed. */}
      {attachTarget && (
        <AttachmentsDialog
          ownerType="SETTLEMENT"
          ownerId={attachTarget.publicId}
          title={`Sheet — ${attachTarget.driverName}`}
          onClose={() => setAttachTarget(null)}
        />
      )}
    </PageShell>
  );
}
