// src/features/fleet/pages/FleetExpenses.jsx
// The fleet cost ledger.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// VISUAL LANGUAGE: matched to Bookings, not invented here.
// Gradient KPI cards + the coloured top strip on every record card come from Allbookings.jsx; the
// Panel / Field pair around the entry form comes from CreateBookingClean.jsx. Fleet used to render
// flat white tiles and bare tables, which made it read as a different product bolted onto the CRM.
//
// FAST DATA FILLING: modelled on the rebuilt Create Lead / Create Booking forms.
//   • sticky fields — vehicle, date, category and payer SURVIVE a save, because a user works
//     through one pile of receipts for one vehicle, not one receipt at a time
//   • Enter saves and immediately refocuses the amount, so the loop is: type, Tab, type, Enter
//   • fields appear only when they matter (driver only for a cash spend, time only for the
//     categories that must resolve to a leg, currency only on a Nepal category)
//   • validation is inline and per-field, never a modal that loses what was typed
//
// WHAT THIS SCREEN DELIBERATELY DOES NOT HAVE:
//   • No approve / reject. Approval happens ONCE, on the trip settlement — four approvals for a
//     Rs 640 parking charge is ceremony nobody performs, so it gets worked around.
//   • No exchange-rate field. The office sets one rate per trip; NPR is entered as NPR.
//   • No hardcoded category list — it comes from GET /fleet/expense-types, so this file cannot
//     drift from the backend enum the way the lead stage lists did.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Receipt, Plus, Search, Trash2, Undo2, AlertTriangle, IndianRupee, FileWarning,
  Lock, Fuel, Car, RotateCcw, Paperclip,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import CommonPagination from "../components/CommanPegination";
import {
  Button, Input, Select, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  PageShell, PageHeader, LoadingState, EmptyState, ConfirmDialog,
  StatCard, StatCardRow, Panel, EntityCard, CodeChip, MiniStat,
  useToast, errMsg, fmtDate, fmtMoney, todayDateInput,
} from "../components/fleetUi";
import { Field as KitField, fieldCls } from "../components/fleetFormKit";
import AttachmentsDialog from "../components/AttachmentsDialog";

/** Category tone — same vocabulary as the Bookings status palette so colour means one thing. */
const TYPE_TONE = {
  TOLL: "bg-sky-100 text-sky-700 border border-sky-200",
  PARKING: "bg-teal-100 text-teal-700 border border-teal-200",
  FUEL: "bg-amber-100 text-amber-700 border border-amber-200",
  MAINTENANCE: "bg-orange-100 text-orange-700 border border-orange-200",
  TYRE: "bg-orange-100 text-orange-700 border border-orange-200",
  BHANSAR_NEPAL: "bg-violet-100 text-violet-700 border border-violet-200",
  PERMIT_NP: "bg-violet-100 text-violet-700 border border-violet-200",
  BORDER_AGENT_FEE: "bg-violet-100 text-violet-700 border border-violet-200",
  PERMIT_IN: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  ROAD_TAX_IN: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  CHALLAN: "bg-rose-100 text-rose-700 border border-rose-200",
};
const typeTone = (code) => TYPE_TONE[code] || "bg-slate-100 text-slate-700 border border-slate-200";

/** Card top-strip tone: a reversal reads as an exception at a glance. */
const cardTone = (e) => (e.reversalOfPublicId ? "rose" : e.hasReceipt ? "blue" : "amber");

const PAID_BY = [
  { value: "DRIVER_CASH", label: "Driver's cash" },
  { value: "OFFICE_DIRECT", label: "Office paid" },
  { value: "VENDOR_CREDIT", label: "On vendor credit" },
];

/**
 * A fresh entry row. `sticky` carries forward the fields that stay the same across a pile of
 * receipts — the single biggest speed win, straight out of CreateBookingClean's resetForm.
 */
const blankDraft = (sticky = {}) => ({
  vehiclePublicId: sticky.vehiclePublicId || "",
  driverPublicId: sticky.driverPublicId || "",
  tripPublicId: sticky.tripPublicId || "",
  expenseType: sticky.expenseType || "TOLL",
  documentDate: sticky.documentDate || todayDateInput(),
  documentTime: "",
  amount: "",
  currency: "INR",
  paidBy: sticky.paidBy || "DRIVER_CASH",
  hasReceipt: false,
  noReceiptReason: "",
  description: "",
});

export default function FleetExpenses() {
  const { showToast } = useToast();
  const amountRef = useRef(null);
  const [searchParams] = useSearchParams();

  const [types, setTypes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  // Duties for the picked vehicle, so a receipt can land on its trip — and therefore on the
  // driver's settlement sheet. A DRIVER_CASH row without a trip comes off the general float.
  const [trips, setTrips] = useState([]);
  const [seedTrip, setSeedTrip] = useState(null);   // trip carried in via ?tripId=

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState(blankDraft());
  const [errors, setErrors] = useState({});

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [vehicleF, setVehicleF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [missingReceipt, setMissingReceipt] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [attachTarget, setAttachTarget] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reverseReason, setReverseReason] = useState("");

  const canCreate = hasPermission(P.FLEET_CREATE);
  const canDelete = hasPermission(P.FLEET_DELETE);
  const canReverse = hasPermission(P.FLEET_MONEY_SETTLE);

  /* ── reference data ─────────────────────────────────────────────────── */
  useEffect(() => {
    fleetService.listExpenseTypes()
      .then((t) => setTypes((t || []).filter((x) => !x.systemComputed)))
      .catch((e) => showToast(errMsg(e, "Failed to load expense categories."), "error"));
    fleetService.vehicleOptions().then(setVehicles).catch(() => {});
    fleetService.driverOptions("ACTIVE").then(setDrivers).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving from a trip's detail page (?tripId=) pre-arms the whole strip: the trip, its vehicle
  // and its driver. That is the after-the-duty workflow — the man is back, the receipts are a pile.
  useEffect(() => {
    const tripId = searchParams.get("tripId");
    if (!tripId) return;
    fleetService.getTrip(tripId)
      .then((t) => {
        if (!t) return;
        setSeedTrip(t);
        setDraft((d) => ({
          ...d,
          tripPublicId: t.publicId,
          vehiclePublicId: t.vehiclePublicId || d.vehiclePublicId,
          driverPublicId: t.driverPublicId || d.driverPublicId,
        }));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Duties for the picked vehicle, newest first — receipts are usually entered after the trip
  // returns, so COMPLETED trips belong in this list just as much as the ONGOING one.
  useEffect(() => {
    if (!draft.vehiclePublicId) { setTrips([]); return; }
    let alive = true;
    fleetService.listTrips({ vehicleId: draft.vehiclePublicId, size: 15 })
      .then((r) => { if (alive) setTrips(r.items || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [draft.vehiclePublicId]);

  // Same tolerance idiom as the lead stage select: if the chosen trip is not in the last 15
  // (an old duty opened from its detail page), prepend it instead of silently dropping it.
  const tripOptions = useMemo(() => {
    const base = trips;
    if (draft.tripPublicId && seedTrip && !base.some((t) => t.publicId === draft.tripPublicId)
        && seedTrip.publicId === draft.tripPublicId) {
      return [seedTrip, ...base];
    }
    return base;
  }, [trips, seedTrip, draft.tripPublicId]);

  const tripLabel = (t) =>
    [
      [t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "Trip",
      fmtDate(t.startDatetime),
      t.status === "ONGOING" ? "running" : null,
    ].filter(Boolean).join(" · ");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    return fleetService
      .listExpenses({
        vehicleId: vehicleF, type: typeF, search: debounced,
        missingReceipt: missingReceipt || undefined, page, size,
      })
      .then((res) => { setItems(res.items); setPagination(res.pagination); })
      .catch((e) => showToast(errMsg(e, "Failed to load expenses."), "error"))
      .finally(() => setLoading(false));
  }, [vehicleF, typeF, debounced, missingReceipt, page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── derived ────────────────────────────────────────────────────────── */
  const selectedType = useMemo(
    () => types.find((t) => t.code === draft.expenseType),
    [types, draft.expenseType],
  );
  const isNepal = selectedType?.fixedCountry === "NP";
  const needsTime = selectedType?.requiredFields?.includes("documentTime");

  // Deliberately labelled "on this page". A total that silently means one page is how people
  // misread a report — and this list is server-paginated.
  const pageTotal = useMemo(
    () => items.reduce((s, e) => s + Number(e.baseAmount || 0), 0), [items]);
  const noReceiptCount = useMemo(
    () => items.filter((e) => !e.hasReceipt).length, [items]);
  const driverPaidTotal = useMemo(
    () => items.filter((e) => e.paidBy === "DRIVER_CASH")
               .reduce((s, e) => s + Number(e.baseAmount || 0), 0), [items]);
  const reversedCount = useMemo(
    () => items.filter((e) => e.reversalOfPublicId).length, [items]);

  /* ── entry ──────────────────────────────────────────────────────────── */
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  /** Per-field, inline — never a modal, so nothing typed is lost on a failed save. */
  const validate = () => {
    const e = {};
    if (!draft.vehiclePublicId) e.vehiclePublicId = "Pick a vehicle";
    if (!draft.amount || Number(draft.amount) <= 0) e.amount = "Enter an amount";
    if (!draft.documentDate) e.documentDate = "Receipt date is required";
    if (draft.paidBy === "DRIVER_CASH" && !draft.driverPublicId) {
      e.driverPublicId = "A cash spend comes off someone's advance";
    }
    if (!draft.hasReceipt && !draft.noReceiptReason.trim()) {
      e.noReceiptReason = "Say why there is no receipt";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await fleetService.createExpense({
        ...draft,
        tripPublicId: draft.tripPublicId || null,
        driverPublicId: draft.driverPublicId || null,
        documentTime: draft.documentTime || null,
        amount: Number(draft.amount),
      });
      setDraft(blankDraft(draft));      // sticky: same vehicle/date/category/payer for the next receipt
      showToast("Recorded.", "success");
      await load();
      amountRef.current?.focus();
    } catch (e) {
      // 400/409 are silent by interceptor design — the call site renders what the user just typed.
      showToast(errMsg(e, "Could not record this expense."), "error");
    } finally { setSaving(false); }
  };

  /**
   * Entry-strip keyboard. Deliberately NOT the same as the vehicle / driver / trip forms.
   *
   * Those are long forms, so Enter advances a field and Ctrl+Enter saves. This is a ONE-ROW repeat
   * grid — a clerk works down a bundle of forty receipts against the same vehicle — so Enter SAVES
   * and refocuses the amount. Making Enter advance here would add a keystroke to every single
   * receipt, which is the opposite of fast. Ctrl+Enter also saves, so the muscle memory from the
   * other forms still lands somewhere sensible rather than doing nothing.
   *
   * Escape clears the row without touching the sticky slice — the "I picked the wrong category
   * three fields ago" escape hatch, which otherwise means backspacing through four inputs.
   */
  const onEntryKeyDown = (e) => {
    if (saving) return;

    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      submitDraft();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(blankDraft(draft));   // keeps vehicle / date / category / payer
      setErrors({});
      amountRef.current?.focus();
    }
  };

  const doDelete = async () => {
    try {
      await fleetService.deleteExpense(deleteTarget.publicId);
      showToast("Moved to Trash.", "success");
      setDeleteTarget(null);
      load();
    } catch (e) { showToast(errMsg(e, "Could not delete."), "error"); }
  };

  const doReverse = async () => {
    if (!reverseReason.trim()) return showToast("A reversal needs a reason.", "error");
    try {
      await fleetService.reverseExpense(reverseTarget.publicId, reverseReason.trim());
      showToast("Reversed. The original stays on record.", "success");
      setReverseTarget(null);
      setReverseReason("");
      load();
    } catch (e) { showToast(errMsg(e, "Could not reverse."), "error"); }
  };

  /* ── row actions, shared by the table and the cards ──────────────────── */
  const RowActions = ({ e }) => (
    <div className="flex items-center justify-end gap-1">
      <button className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Receipts"
              onClick={() => setAttachTarget(e)}>
        <Paperclip className="h-4 w-4" />
      </button>
      {e.reversed && <Badge className="bg-slate-100 text-slate-500">reversed</Badge>}
      {!e.editable && !e.reversalOfPublicId && !e.reversed && (
        <span title="Settled or period closed — correct it with a reversal">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
        </span>
      )}
      {e.editable && canDelete && !e.reversalOfPublicId && (
        <button className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                title="Delete" onClick={() => setDeleteTarget(e)}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {!e.editable && !e.reversed && !e.reversalOfPublicId && canReverse && (
        <button className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                title="Reverse" onClick={() => setReverseTarget(e)}>
          <Undo2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const Amount = ({ e }) => (
    <>
      <div className={`font-extrabold ${e.reversalOfPublicId ? "text-rose-600" : "text-slate-800"}`}>
        {fmtMoney(e.baseAmount)}
      </div>
      {/* Foreign-currency rows show what was actually handed over at the counter — that is the
          number printed on the paper the driver brought back. */}
      {e.currency && e.currency !== "INR" && (
        <div className="text-[11px] font-semibold text-violet-600">
          {e.currency} {Number(e.amount).toFixed(2)} @ {Number(e.fxRate).toFixed(4)}
        </div>
      )}
    </>
  );

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <PageShell>
      <PageHeader
        icon={Receipt}
        title="Fleet expenses"
        subtitle="Every rupee that leaves for a vehicle. Enter straight from the receipts."
      >
        <button onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-800">
          <RotateCcw className="h-4 w-4" /> Refresh
        </button>
      </PageHeader>

      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard label="On this page" value={pageTotal} icon={<IndianRupee />} tone="blue" money />
        <StatCard label="Driver-paid" value={driverPaidTotal} icon={<Fuel />} tone="amber" money />
        <StatCard label="No receipt" value={noReceiptCount} icon={<FileWarning />} tone="rose" />
        <StatCard label="Reversals" value={reversedCount} icon={<Undo2 />} tone="slate" />
      </StatCardRow>

      {/* ── fast entry ── */}
      {canCreate && (
        <div className="mb-6">
          <Panel
            icon={Plus}
            title="Quick entry"
            description="Vehicle, date, category and payer stay put after each save. Enter records and jumps back to the amount; Esc clears the row."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12" onKeyDown={onEntryKeyDown}>
              <KitField label="Vehicle" required error={errors.vehiclePublicId} className="md:col-span-3">
                <select className={fieldCls} value={draft.vehiclePublicId}
                        onChange={(ev) => set({ vehiclePublicId: ev.target.value, tripPublicId: "" })}>
                  <option value="">Select…</option>
                  {vehicles.map((v) => <option key={v.publicId} value={v.publicId}>{v.label}</option>)}
                </select>
              </KitField>

              <KitField label="Category" required className="md:col-span-2">
                <select className={fieldCls} value={draft.expenseType}
                        onChange={(ev) => set({ expenseType: ev.target.value })}>
                  {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </KitField>

              <KitField label="Receipt date" required error={errors.documentDate} className="md:col-span-2">
                <input type="date" className={fieldCls} value={draft.documentDate}
                       onChange={(ev) => set({ documentDate: ev.target.value })} />
              </KitField>

              <KitField
                label="Amount" required error={errors.amount}
                hint={isNepal ? "Enter in NPR — the office rate for the trip applies" : undefined}
                className="md:col-span-2"
              >
                <div className="flex gap-1.5">
                  <input ref={amountRef} type="number" step="0.01" min="0" placeholder="0.00"
                         className={fieldCls} value={draft.amount}
                         onChange={(ev) => set({ amount: ev.target.value })} />
                  {isNepal && (
                    <select className={`${fieldCls} w-24`} value={draft.currency}
                            onChange={(ev) => set({ currency: ev.target.value })}>
                      <option value="NPR">NPR</option>
                      <option value="INR">INR</option>
                    </select>
                  )}
                </div>
              </KitField>

              <KitField label="Paid by" required className="md:col-span-2">
                <select className={fieldCls} value={draft.paidBy}
                        onChange={(ev) => set({ paidBy: ev.target.value })}>
                  {PAID_BY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </KitField>

              <div className="flex items-end md:col-span-1">
                <Button className="w-full" disabled={saving} onClick={submitDraft}>
                  {saving ? "…" : "Add"}
                </Button>
              </div>

              {/* Conditional fields — shown only when they carry meaning, so the row stays short. */}
              <KitField label="Against trip" optional className="md:col-span-3"
                        hint={draft.paidBy === "DRIVER_CASH" && !draft.tripPublicId
                          ? "Without a trip this comes off the general float, not a duty sheet"
                          : undefined}>
                <select className={fieldCls} value={draft.tripPublicId}
                        disabled={!draft.vehiclePublicId}
                        onChange={(ev) => set({ tripPublicId: ev.target.value })}>
                  <option value="">
                    {draft.vehiclePublicId ? "— No trip —" : "Pick a vehicle first"}
                  </option>
                  {tripOptions.map((t) => (
                    <option key={t.publicId} value={t.publicId}>{tripLabel(t)}</option>
                  ))}
                </select>
              </KitField>

              {draft.paidBy === "DRIVER_CASH" && (
                <KitField label="Driver who paid" required error={errors.driverPublicId} className="md:col-span-3">
                  <select className={fieldCls} value={draft.driverPublicId}
                          onChange={(ev) => set({ driverPublicId: ev.target.value })}>
                    <option value="">Select…</option>
                    {drivers.map((d) => <option key={d.publicId} value={d.publicId}>{d.label}</option>)}
                  </select>
                </KitField>
              )}

              {needsTime && (
                <KitField label="Time on receipt" className="md:col-span-2"
                          hint="Lands the cost on the right driver if the trip changed hands">
                  <input type="time" className={fieldCls} value={draft.documentTime}
                         onChange={(ev) => set({ documentTime: ev.target.value })} />
                </KitField>
              )}

              <KitField label="Note" optional className="md:col-span-4">
                <input className={fieldCls} placeholder="Plaza / location / what it was for"
                       value={draft.description} onChange={(ev) => set({ description: ev.target.value })} />
              </KitField>

              {/* "No receipt" is a normal answer here, not an error state — half the tolls and most
                  small parking charges never produce one. It just has to be explained. */}
              <KitField label="Receipt" error={errors.noReceiptReason} className="md:col-span-3">
                <div className="flex items-center gap-2">
                  <label className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                    <input type="checkbox" checked={draft.hasReceipt}
                           onChange={(ev) => set({ hasReceipt: ev.target.checked, noReceiptReason: "" })} />
                    In hand
                  </label>
                  {!draft.hasReceipt && (
                    <input className={fieldCls} placeholder="Why not?"
                           value={draft.noReceiptReason}
                           onChange={(ev) => set({ noReceiptReason: ev.target.value })} />
                  )}
                </div>
              </KitField>
            </div>
          </Panel>
        </div>
      )}

      {/* ── filters ── */}
      <div className="mb-6">
        <Panel icon={Search} title="Filters" description="Narrow the ledger before exporting or reconciling.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <KitField label="Search" className="md:col-span-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldCls} pl-9`} placeholder="Note, reference or vehicle number"
                       value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              </div>
            </KitField>
            <KitField label="Vehicle" className="md:col-span-3">
              <select className={fieldCls} value={vehicleF}
                      onChange={(e) => { setVehicleF(e.target.value); setPage(0); }}>
                <option value="">All vehicles</option>
                {vehicles.map((v) => <option key={v.publicId} value={v.publicId}>{v.label}</option>)}
              </select>
            </KitField>
            <KitField label="Category" className="md:col-span-3">
              <select className={fieldCls} value={typeF}
                      onChange={(e) => { setTypeF(e.target.value); setPage(0); }}>
                <option value="">All categories</option>
                {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </KitField>
            <div className="flex items-end md:col-span-2">
              <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                <input type="checkbox" checked={missingReceipt}
                       onChange={(e) => { setMissingReceipt(e.target.checked); setPage(0); }} />
                Missing receipts
              </label>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── ledger ── */}
      {loading ? (
        <Panel icon={Receipt} title="Ledger"><LoadingState label="Loading expenses…" /></Panel>
      ) : items.length === 0 ? (
        <Panel icon={Receipt} title="Ledger">
          <EmptyState icon={Receipt} title="No expenses yet"
                      hint="Record the first one from a receipt using the quick entry above." />
        </Panel>
      ) : (
        <>
          {/* Desktop: dense table. Mobile: Bookings-style cards. Same data, same actions. */}
          <div className="hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.publicId} className={e.reversalOfPublicId ? "bg-rose-50/40" : undefined}>
                    <TableCell>
                      <div className="font-bold text-slate-700">{fmtDate(e.documentDate)}</div>
                      {/* Shown only when it differs — i.e. a correction booked into a later period. */}
                      {e.postingDate && e.postingDate !== e.documentDate && (
                        <div className="text-[11px] font-semibold text-amber-600">
                          booked {fmtDate(e.postingDate)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell><CodeChip>{e.vehicleNumber}</CodeChip></TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${typeTone(e.expenseType)}`}>
                        {e.expenseTypeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate font-medium text-slate-600">{e.description || "—"}</div>
                      {!e.hasReceipt && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                          <FileWarning className="h-3 w-3" />{e.noReceiptReason || "no receipt"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-slate-600">{e.paidByLabel}</div>
                      {e.driverName && <div className="text-[11px] text-slate-400">{e.driverName}</div>}
                    </TableCell>
                    <TableCell className="text-right"><Amount e={e} /></TableCell>
                    <TableCell><RowActions e={e} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
            {items.map((e) => (
              <EntityCard key={e.publicId} tone={cardTone(e)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <CodeChip>{e.vehicleNumber}</CodeChip>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${typeTone(e.expenseType)}`}>
                        {e.expenseTypeLabel}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold text-slate-700">{e.description || "—"}</p>
                    <p className="text-xs text-slate-400">{fmtDate(e.documentDate)}</p>
                  </div>
                  <div className="text-right"><Amount e={e} /></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Paid by" value={e.paidByLabel} />
                  <MiniStat label="Driver" value={e.driverName} />
                </div>

                {!e.hasReceipt && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                    <FileWarning className="h-3.5 w-3.5 shrink-0" />
                    {e.noReceiptReason || "No receipt"}
                  </div>
                )}

                <RowActions e={e} />
              </EntityCard>
            ))}
          </div>
        </>
      )}

      {pagination && !loading && items.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <CommonPagination
            pageIndex={pagination?.page ?? page}
            pageSize={pagination?.size ?? size}
            totalElements={pagination?.totalElements ?? items.length}
            totalPages={pagination?.totalPages ?? 1}
            goToPage={setPage}
            changePageSize={(s) => { setSize(s); setPage(0); }}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete this expense?"
        description="It moves to Trash and stops counting towards this vehicle's cost."
        confirmLabel="Delete"
        onConfirm={doDelete}
      />

      {/* Reversal is not a delete, and the wording says so — the original stays on record, which is
          the whole point of correcting a frozen row this way. */}
      <ConfirmDialog
        open={!!reverseTarget}
        onOpenChange={(open) => { if (!open) { setReverseTarget(null); setReverseReason(""); } }}
        variant="default"
        title="Reverse this expense?"
        description={
          <div className="space-y-3">
            <p className="flex gap-2 text-sm text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              This entry is settled or its period is closed, so it cannot be edited. Reversing writes an
              opposing entry dated today. The original stays on record and keeps its receipt date, so the
              vehicle's cost is corrected without moving a closed month.
            </p>
            <input autoFocus className={fieldCls} placeholder="Reason for the reversal"
                   value={reverseReason} onChange={(ev) => setReverseReason(ev.target.value)} />
          </div>
        }
        confirmLabel="Reverse"
        onConfirm={doReverse}
      />

      {attachTarget && (
        <AttachmentsDialog
          ownerType="EXPENSE"
          ownerId={attachTarget.publicId}
          title={`Receipts — ${attachTarget.expenseTypeLabel || attachTarget.expenseType} · ${fmtMoney(attachTarget.baseAmount)}`}
          onClose={() => setAttachTarget(null)}
        />
      )}
    </PageShell>
  );
}
