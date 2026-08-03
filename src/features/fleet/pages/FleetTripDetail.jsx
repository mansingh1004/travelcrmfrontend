// src/features/fleet/pages/FleetTripDetail.jsx
// Trip detail — the duty slip, read in full.
//
// A trip is not one row: it is a sequence of LEGS (who was driving what, and when), a pile of
// EXPENSES (every rupee that left, in whatever currency), and one SETTLEMENT per driver (the cash
// loop that has to square to zero before anyone signs). This page is where those three meet the
// lifecycle actions — start, hand over, close, cancel.
//
// OLD — removed in the ledger cutover: the "Expenses" block used to render the trip's three legacy
// scalars (fuelCost / tollCost / driverAllowance). Those fields stopped being written when the
// close dialog dropped them; the expense LEDGER is the source of truth now, and trip.totalExpense
// already carries the ledger sum (with the old scalar as fallback for pre-ledger trips). A trip
// from before the cutover still shows its old figures — as a single muted line, not as a ledger.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  Route as RouteIcon, ArrowLeft, ArrowRight, Play, Flag, Ban, Pencil, Trash2,
  Car, IdCard, Gauge, MapPin, Receipt, Clock, IndianRupee, MapPinned,
  ArrowLeftRight, Waypoints, Wallet, CheckCircle2, Lock, Paperclip, Printer,
} from "lucide-react";

import fleetService from "../api/fleetService";
import AttachmentsDialog from "../components/AttachmentsDialog";
import { openBlob, hydrateBlobError } from "@shared/lib/download";
import { hasPermission, P } from "@shared/lib/access";
import {
  Button, Badge, Input, Select, Textarea, Field,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  PageShell, GlassCard, Panel, EntityCard, MiniStat, LoadingState, EmptyState, ConfirmDialog,
  useToast, errMsg, StatusBadge, TRIP_STATUS, fmtDate, fmtDateTime, fmtNumber, fmtMoney,
  StatStrip, FormSection, nowDateTimeInput,
} from "../components/fleetUi";
import { StartTripDialog, CloseTripDialog } from "./FleetTrips";

function Info({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-700">{value ?? "—"}</p>
      </div>
    </div>
  );
}

/** "3h 20m" from two datetimes (or "—"). */
function durationLabel(start, end) {
  if (!start || !end) return "—";
  const ms = new Date(end) - new Date(start);
  if (Number.isNaN(ms) || ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* Tone maps follow the app's sanctioned pill idiom: a map + a fallback, never an exhaustive enum
   copy — an unknown value renders in slate instead of breaking. */
const REASON_TONE = {
  BREAKDOWN: "bg-rose-100 text-rose-700 border border-rose-200",
  DRIVER_HANDOVER: "bg-blue-100 text-blue-700 border border-blue-200",
  REST_RULE: "bg-amber-100 text-amber-700 border border-amber-200",
  OWNER_DECISION: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  CUSTOMER_REQUEST: "bg-violet-100 text-violet-700 border border-violet-200",
};
const reasonTone = (code) => REASON_TONE[code] || "bg-slate-100 text-slate-600 border border-slate-200";

const PAID_BY_LABEL = {
  DRIVER_CASH: "Driver's cash",
  OFFICE_DIRECT: "Office paid",
  VENDOR_CREDIT: "Vendor credit",
};

/** Positive = driver holds company money. Same tone rule as the Driver cash screen. */
const netTone = (net) => (net > 0 ? "amber" : net < 0 ? "rose" : "green");

const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/* ── Hand over (swap) dialog ─────────────────────────────────────────────── */
function SwapTripDialog({ trip, onClose, onDone, showToast }) {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [reasons, setReasons] = useState([]);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      vehiclePublicId: "", driverPublicId: "", changeReason: "",
      atOdometer: "", newStartOdometer: "", at: nowDateTimeInput(), notes: "",
    },
  });
  const pickedVehicle = watch("vehiclePublicId");
  const pickedDriver = watch("driverPublicId");

  useEffect(() => {
    // The server refuses a non-AVAILABLE incoming vehicle, so only offer those; the current
    // vehicle is legitimately ON_TRIP and therefore never in this list.
    fleetService.vehicleOptions("AVAILABLE").then(setVehicles).catch(() => {});
    fleetService.driverOptions("ACTIVE").then(setDrivers).catch(() => {});
    fleetService.listLegChangeReasons().then((r) => setReasons(r || [])).catch(() => {});
  }, []);

  const onSubmit = async (data) => {
    if (!data.vehiclePublicId && !data.driverPublicId) {
      showToast("Pick a different vehicle or driver — nothing changed.", "error");
      return;
    }
    try {
      await fleetService.swapTrip(trip.publicId, {
        vehiclePublicId: data.vehiclePublicId || null,
        driverPublicId: data.driverPublicId || null,
        changeReason: data.changeReason,
        atOdometer: toNum(data.atOdometer),
        newStartOdometer: data.vehiclePublicId ? toNum(data.newStartOdometer) : null,
        at: data.at || null,
        notes: data.notes?.trim() || null,
      });
      showToast("Handed over.");
      await onDone();
    } catch (e) {
      showToast(errMsg(e, "Couldn't hand the trip over."), "error");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onClose={onClose}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Hand over — {trip.vehicleNumber} · {trip.driverName}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-xs text-slate-500">
              Breakdown, relief driver, reallocation. The current leg closes at the reading below and
              a new one opens — the odometer chain and "who was driving at 14:20" both survive.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Vehicle taking over">
                <Select {...register("vehiclePublicId")}>
                  <option value="">Keep {trip.vehicleNumber}</option>
                  {vehicles.map((v) => (
                    <option key={v.publicId} value={v.publicId}>{v.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Driver taking over">
                <Select {...register("driverPublicId")}>
                  <option value="">Keep {trip.driverName}</option>
                  {drivers
                    .filter((d) => d.publicId !== trip.driverPublicId)
                    .map((d) => (
                      <option key={d.publicId} value={d.publicId}>{d.label}</option>
                    ))}
                </Select>
              </Field>
            </div>

            <Field label="Why" required error={errors.changeReason}
                   hint="This is the field an owner reads when a trip cost twice what it should have.">
              <Select aria-invalid={!!errors.changeReason}
                      {...register("changeReason", { required: "Say why the duty changed hands" })}>
                <option value="">Select a reason…</option>
                {reasons.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`Odometer on ${trip.vehicleNumber} (km)`}
                     hint="Reading when it stopped.">
                <Input type="number" min="0" {...register("atOdometer")} />
              </Field>
              {pickedVehicle ? (
                <Field label="Incoming vehicle odometer (km)"
                       hint="A different vehicle — a different number.">
                  <Input type="number" min="0" {...register("newStartOdometer")} />
                </Field>
              ) : (
                <Field label="When">
                  <Input type="datetime-local" {...register("at")} />
                </Field>
              )}
            </div>
            {pickedVehicle && (
              <Field label="When">
                <Input type="datetime-local" {...register("at")} />
              </Field>
            )}

            <Field label="Notes">
              <Textarea rows={2} placeholder="Clutch gone near Devprayag; ABC-123 sent from Rishikesh…"
                        {...register("notes")} />
            </Field>

            {!pickedVehicle && !pickedDriver && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Pick at least one — the vehicle taking over, the driver, or both.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              <ArrowLeftRight /> {isSubmitting ? "Handing over…" : "Hand over"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function FleetTripDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();

  const [trip, setTrip] = useState(null);
  const [legs, setLegs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [attachTarget, setAttachTarget] = useState(null);   // settlement whose sheet is open
  const [busy, setBusy] = useState(false);

  const canUpdate = hasPermission(P.FLEET_UPDATE);
  const canDelete = hasPermission(P.FLEET_DELETE);
  // Money is a separate grant: a dispatcher runs trips all day without ever seeing driver cash.
  const canMoney = hasPermission(P.FLEET_MONEY_READ);

  const load = useCallback(async () => {
    try {
      const t = await fleetService.getTrip(publicId);
      setTrip(t);
      // Sections degrade independently: a failed sub-list leaves an empty panel, never a dead page.
      // Real failures (403/500) are already toasted by the interceptor.
      const [lg, ex, st] = await Promise.all([
        fleetService.getTripLegs(publicId).catch(() => []),
        canMoney
          ? fleetService.listExpenses({ tripId: publicId, size: 100 }).then((r) => r.items).catch(() => [])
          : Promise.resolve([]),
        canMoney
          ? fleetService.listTripSettlements(publicId).catch(() => [])
          : Promise.resolve([]),
      ]);
      setLegs(lg || []);
      setExpenses(ex || []);
      setSettlements(st || []);
    } catch (e) {
      showToast(errMsg(e, "Failed to load trip."), "error");
    } finally {
      setLoading(false);
    }
  }, [publicId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const confirmCancel = async () => {
    setBusy(true);
    try {
      await fleetService.cancelTrip(publicId);
      showToast("Trip cancelled.");
      setShowCancel(false);
      await load();
    } catch (e) {
      showToast(errMsg(e, "Couldn't cancel the trip."), "error");
    } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await fleetService.deleteTrip(publicId);
      showToast("Trip moved to Trash.");
      navigate("/fleet/trips");
    } catch (e) {
      showToast(errMsg(e, "Couldn't delete the trip."), "error");
      setBusy(false);
    }
  };

  /** The paper that rides with the vehicle. Deliberately available from PLANNED — that is when
      it is most useful, blanks and all. */
  const printDutySlip = async () => {
    try {
      openBlob(await fleetService.fetchDutySlip(publicId));
    } catch (e) {
      showToast(errMsg(await hydrateBlobError(e), "Couldn't generate the duty slip."), "error");
    }
  };

  const printSheet = async (s) => {
    try {
      openBlob(await fleetService.fetchSettlementSheet(s.tripPublicId, s.driverPublicId));
    } catch (e) {
      showToast(errMsg(await hydrateBlobError(e), "Couldn't generate the sheet."), "error");
    }
  };

  const doReconcile = async (s) => {
    try {
      await fleetService.reconcileSettlement(s.tripPublicId, s.driverPublicId);
      showToast("Recomputed and reconciled.");
      await load();
    } catch (e) { showToast(errMsg(e, "Could not reconcile."), "error"); }
  };

  const cashWithDrivers = useMemo(
    () => settlements.reduce((s, x) => s + Math.max(0, Number(x.netDueFromDriver || 0)), 0),
    [settlements],
  );

  // Pre-ledger trips carry their close-time scalars; once real ledger rows exist those stop
  // being shown as figures — trip.totalExpense already prefers the ledger server-side.
  const legacyScalars = useMemo(() => {
    if (!trip) return null;
    const f = Number(trip.fuelCost || 0), t = Number(trip.tollCost || 0), a = Number(trip.driverAllowance || 0);
    return f || t || a ? { f, t, a } : null;
  }, [trip]);

  if (loading) return <PageShell><LoadingState label="Loading trip…" /></PageShell>;
  if (!trip) {
    return (
      <PageShell>
        {toastNode}
        <EmptyState icon={RouteIcon} title="Trip not found"
          action={<Button onClick={() => navigate("/fleet/trips")}>Back to Trips</Button>} />
      </PageShell>
    );
  }

  const route = [trip.routeFrom, trip.routeTo].filter(Boolean).join(" → ") || "Trip";

  const kpi = [
    { key: "dist", label: "Distance", value: fmtNumber(trip.distanceKm, " km"), icon: Gauge, tone: "text-blue-600", accent: "bg-blue-50" },
    { key: "exp", label: "Total Expense", value: fmtMoney(trip.totalExpense), icon: IndianRupee, tone: "text-rose-600", accent: "bg-rose-50" },
    { key: "dur", label: "Duration", value: durationLabel(trip.startDatetime, trip.endDatetime), icon: Clock, tone: "text-indigo-600", accent: "bg-indigo-50" },
    ...(canMoney && settlements.length > 0 ? [{
      key: "cash", label: "Cash with drivers", value: fmtMoney(cashWithDrivers),
      icon: Wallet, tone: "text-amber-600", accent: "bg-amber-50",
    }] : []),
  ];

  return (
    <PageShell>
      {toastNode}

      <button
        onClick={() => navigate("/fleet/trips")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" /> Trips
      </button>

      {/* Hero */}
      <GlassCard className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-blue-50/60 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <RouteIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">{route}</h1>
                <StatusBadge config={TRIP_STATUS} value={trip.status} />
                {legs.length > 1 && (
                  <Badge className="border border-indigo-200 bg-indigo-100 text-indigo-700">
                    {legs.length} legs
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">{fmtDateTime(trip.startDatetime)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={printDutySlip}>
              <Printer /> Duty slip
            </Button>
            {canUpdate && trip.status === "PLANNED" && (
              <Button size="sm" onClick={() => setShowStart(true)}><Play /> Start</Button>
            )}
            {canUpdate && trip.status === "ONGOING" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowSwap(true)}>
                  <ArrowLeftRight /> Hand over
                </Button>
                <Button size="sm" variant="success" onClick={() => setShowClose(true)}><Flag /> Close</Button>
              </>
            )}
            {canUpdate && (trip.status === "PLANNED" || trip.status === "ONGOING") && (
              <Button size="sm" variant="outline" className="text-amber-600" onClick={() => setShowCancel(true)}>
                <Ban /> Cancel
              </Button>
            )}
            {canUpdate && trip.status !== "CANCELLED" && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/fleet/trips/${publicId}/edit`)}>
                <Pencil /> Edit
              </Button>
            )}
            {canDelete && trip.status !== "ONGOING" && (
              <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setShowDelete(true)}>
                <Trash2 /> Delete
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <StatStrip items={kpi} />

      {/* Trip details */}
      <FormSection title="Trip Details" subtitle="Assignment, schedule & route" icon={MapPinned} className="mb-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Vehicle" value={trip.vehicleNumber} icon={Car} />
          <Info label="Driver" value={trip.driverName} icon={IdCard} />
          <Info label="Booking" value={trip.bookingCode || "—"} />
          <Info label="Distance" value={fmtNumber(trip.distanceKm, " km")} icon={Gauge} />
          <Info label="Start" value={fmtDateTime(trip.startDatetime)} />
          <Info label="End" value={trip.endDatetime ? fmtDateTime(trip.endDatetime) : "—"} />
          <Info label="Start Odometer" value={fmtNumber(trip.startOdometer, " km")} />
          <Info label="End Odometer" value={fmtNumber(trip.endOdometer, " km")} />
          <Info label="From" value={trip.routeFrom} icon={MapPin} />
          <Info label="To" value={trip.routeTo} icon={MapPin} />
          <Info label="Purpose" value={trip.purpose} />
          {trip.fxCurrency && trip.fxCurrency !== "INR" && (
            <Info label="Trip currency"
                  value={`${trip.fxCurrency} @ ${Number(trip.fxRate || 0).toFixed(4)}`} />
          )}
        </div>
        {trip.remarks && (
          <div className="mt-4 rounded-xl bg-slate-50/70 p-3 text-sm text-slate-600">{trip.remarks}</div>
        )}
      </FormSection>

      {/* Journey legs — only when the duty actually changed hands. A single leg IS the trip. */}
      {legs.length > 1 && (
        <div className="mb-5">
          <Panel icon={Waypoints} title="Journey legs"
                 description="Who was on which vehicle, and when. The trip's distance is the sum of these — never end-minus-start across a vehicle change.">
            <ol className="relative ml-3 space-y-4 border-l-2 border-slate-200 pl-5">
              {legs.map((l) => (
                <li key={l.publicId} className="relative">
                  <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-extrabold text-white ring-4 ring-white">
                    {l.seq}
                  </span>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-800">{l.vehicleNumber}</span>
                      <span className="text-xs font-semibold text-slate-500">· {l.driverName}</span>
                      {l.changeReason && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reasonTone(l.changeReason)}`}>
                          {l.changeReasonLabel || l.changeReason}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{fmtDateTime(l.startDatetime)} → {l.endDatetime ? fmtDateTime(l.endDatetime) : "running"}</span>
                      {(l.startOdometer != null || l.endOdometer != null) && (
                        <span className="font-semibold">
                          {fmtNumber(l.startOdometer)} → {l.endOdometer != null ? fmtNumber(l.endOdometer) : "—"} km
                        </span>
                      )}
                      {l.distanceKm != null && (
                        <span className="font-bold text-blue-600">{fmtNumber(l.distanceKm, " km")}</span>
                      )}
                    </div>
                    {l.notes && <p className="mt-1.5 text-xs text-slate-400">{l.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}

      {/* Expense ledger — the real one. */}
      {canMoney && (
        <div className="mb-5">
          <Panel icon={Receipt} title="Expenses"
                 description="Every rupee recorded against this trip, from the ledger."
                 action={
                   <button onClick={() => navigate(`/fleet/expenses?tripId=${publicId}`)}
                           className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                     Add / open ledger <ArrowRight className="h-3 w-3" />
                   </button>
                 }>
            {expenses.length === 0 ? (
              <div className="py-2">
                <p className="text-sm text-slate-400">
                  No expenses recorded against this trip yet — the ledger link above arrives with
                  this trip, its vehicle and its driver already picked.
                </p>
                {legacyScalars && (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Recorded at close, before the ledger existed — Fuel {fmtMoney(legacyScalars.f)} ·
                    Toll {fmtMoney(legacyScalars.t)} · Bata {fmtMoney(legacyScalars.a)}
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Paid by</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.publicId}
                          className={`border-b border-slate-100 last:border-0 ${e.reversed ? "opacity-50" : ""}`}>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600">{fmtDate(e.documentDate)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                            {e.expenseTypeLabel || e.expenseType}
                          </span>
                          {e.reversalOfPublicId && (
                            <span className="ml-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              reversal
                            </span>
                          )}
                        </td>
                        <td className="max-w-[220px] truncate py-2.5 pr-3 text-slate-500">
                          {e.description || e.reversalReason || "—"}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500">
                          {e.paidByLabel || PAID_BY_LABEL[e.paidBy] || e.paidBy}
                          {e.paidBy === "DRIVER_CASH" && e.driverName ? ` — ${e.driverName}` : ""}
                        </td>
                        <td className={`py-2.5 text-right font-extrabold whitespace-nowrap ${
                          e.reversalOfPublicId ? "text-rose-600" : "text-slate-800"} ${e.reversed ? "line-through" : ""}`}>
                          {fmtMoney(e.baseAmount)}
                          {e.currency && e.currency !== "INR" && (
                            <span className="block text-[10px] font-semibold text-violet-600">
                              {e.currency} {Number(e.amount).toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="py-2.5 pr-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Trip total
                      </td>
                      <td className="py-2.5 text-right text-base font-extrabold text-blue-700 whitespace-nowrap">
                        {fmtMoney(trip.totalExpense)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Driver settlements — one sheet per driver who touched this trip. */}
      {canMoney && settlements.length > 0 && (
        <div className="mb-5">
          <Panel icon={Wallet} title="Driver settlements"
                 description="One sheet per driver. A trip is finished when every sheet squares to exactly zero and is signed."
                 action={
                   <button onClick={() => navigate("/fleet/settlements")}
                           className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                     Driver cash screen <ArrowRight className="h-3 w-3" />
                   </button>
                 }>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {settlements.map((s) => {
                const net = Number(s.netDueFromDriver || 0);
                const settled = s.status === "SETTLED" || s.status === "LOCKED";
                return (
                  <EntityCard key={s.publicId} tone={netTone(net)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-extrabold text-slate-800">{s.driverName}</p>
                          <Badge className="bg-slate-100 text-slate-600">
                            {settled && <Lock className="mr-1 inline h-3 w-3" />}{s.statusLabel}
                          </Badge>
                          {s.hasPostSettlementMovement && (
                            <Badge className="bg-rose-100 text-rose-700">moved after signing</Badge>
                          )}
                        </div>
                        {s.settledAt && (
                          <p className="text-[11px] text-slate-400">
                            Signed {fmtDateTime(s.settledAt)}{s.settledBy ? ` by ${s.settledBy}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-lg font-extrabold ${
                          net > 0 ? "text-amber-600" : net < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {net === 0 ? <CheckCircle2 className="ml-auto h-5 w-5" /> : fmtMoney(Math.abs(net))}
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

                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button onClick={() => printSheet(s)} title="Print the hisaab for signing"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </button>
                      <button onClick={() => setAttachTarget(s)} title="Signed sheet & papers"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50">
                        <Paperclip className="h-3.5 w-3.5" /> Files
                      </button>
                      {!settled && canUpdate && (
                        <button onClick={() => doReconcile(s)}
                                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50">
                          Recompute
                        </button>
                      )}
                    </div>
                  </EntityCard>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {showStart && (
        <StartTripDialog trip={trip} onClose={() => setShowStart(false)}
          onDone={async () => { setShowStart(false); await load(); }} showToast={showToast} />
      )}
      {showClose && (
        <CloseTripDialog trip={trip} onClose={() => setShowClose(false)}
          onDone={async () => { setShowClose(false); await load(); }} showToast={showToast} />
      )}
      {showSwap && (
        <SwapTripDialog trip={trip} onClose={() => setShowSwap(false)}
          onDone={async () => { setShowSwap(false); await load(); }} showToast={showToast} />
      )}
      {attachTarget && (
        <AttachmentsDialog
          ownerType="SETTLEMENT"
          ownerId={attachTarget.publicId}
          title={`Sheet — ${attachTarget.driverName}`}
          onClose={() => setAttachTarget(null)}
        />
      )}

      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancel this trip?"
        description="The trip will be marked CANCELLED and its vehicle freed."
        confirmLabel="Cancel Trip"
        busy={busy}
        onConfirm={confirmCancel}
      />
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Move trip to Trash?"
        description="This trip will be moved to Trash."
        confirmLabel="Move to Trash"
        busy={busy}
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}
