// src/fleet/FleetTrips.jsx
// Trip list — filters (vehicle/driver/status/date/search), server pagination,
// and the PLANNED → ONGOING → COMPLETED lifecycle actions (start / close / cancel).
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  Route as RouteIcon, Plus, Search, Play, Flag, Ban, Pencil, Trash2, Printer,
  CheckCircle2, Gauge, CalendarClock, Receipt,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { openBlob, hydrateBlobError } from "@shared/lib/download";
import { hasPermission, P } from "@shared/lib/access";
import CommonPagination from "../components/CommanPegination";
import {
  Button, Input, Select, Textarea, Label,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  PageShell, PageHeader, GlassCard, LoadingState, EmptyState, ConfirmDialog,
  StatStrip, ChipBar, statusChips, CardGrid, ViewToggle, useViewMode,
  useToast, errMsg, StatusBadge, TRIP_STATUS, fmtDateTime, fmtNumber, fmtMoney,
  nowDateTimeInput,
} from "../components/fleetUi";

const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/** Small label/value pair for trip cards. */
function Meta({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-red-500">{error.message}</p>}
    </div>
  );
}

export default function FleetTrips() {
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [statusF, setStatusF] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [view, setView] = useViewMode("trips", "list");

  const [vehicleOpts, setVehicleOpts] = useState([]);
  const [driverOpts, setDriverOpts] = useState([]);
  const [stats, setStats] = useState(null);

  const [startTarget, setStartTarget] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /** Tomorrow's slips get printed in a batch from this list — that is the 9pm routine. */
  const printDutySlip = async (t) => {
    try {
      openBlob(await fleetService.fetchDutySlip(t.publicId));
    } catch (e) {
      showToast(errMsg(await hydrateBlobError(e), "Couldn't generate the duty slip."), "error");
    }
  };
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission(P.FLEET_CREATE);
  const canUpdate = hasPermission(P.FLEET_UPDATE);
  const canDelete = hasPermission(P.FLEET_DELETE);

  useEffect(() => {
    fleetService.vehicleOptions().then(setVehicleOpts).catch(() => setVehicleOpts([]));
    fleetService.driverOptions().then(setDriverOpts).catch(() => setDriverOpts([]));
    fleetService.getDashboard().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = () =>
    fleetService.listTrips({ vehicleId, driverId, status: statusF, fromDate, toDate, search: debounced, page, size });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    query()
      .then((res) => { if (alive) { setItems(res.items); setPagination(res.pagination); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load trips."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, driverId, statusF, fromDate, toDate, debounced, page, size, showToast]);

  const refetch = async () => { const res = await query(); setItems(res.items); setPagination(res.pagination); };

  const anyFilter = search || vehicleId || driverId || statusF || fromDate || toDate;
  const resetFilters = () => {
    setSearch(""); setVehicleId(""); setDriverId(""); setStatusF(""); setFromDate(""); setToDate(""); setPage(0);
  };
  const onFilter = (setter) => (val) => { setter(val); setPage(0); };

  const confirmCancel = async () => {
    setBusy(true);
    try {
      await fleetService.cancelTrip(cancelTarget.publicId);
      showToast("Trip cancelled.");
      setCancelTarget(null);
      await refetch();
    } catch (e) {
      showToast(errMsg(e, "Couldn't cancel the trip."), "error");
    } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await fleetService.deleteTrip(deleteTarget.publicId);
      showToast("Trip moved to Trash.");
      setDeleteTarget(null);
      await refetch();
    } catch (e) {
      showToast(errMsg(e, "Couldn't delete the trip."), "error");
    } finally { setBusy(false); }
  };

  const ts = stats?.tripsThisMonth ?? {};
  const kpi = [
    { key: "done", label: "Done This Month", value: ts.count, icon: CheckCircle2, tone: "text-green-600", accent: "bg-green-50" },
    { key: "dist", label: "Distance (MTD)", value: fmtNumber(ts.distanceKm, " km"), icon: Gauge, tone: "text-blue-600", accent: "bg-blue-50" },
    { key: "ongoing", label: "Ongoing", value: stats?.ongoingTrips?.length ?? 0, icon: Play, tone: "text-indigo-600", accent: "bg-indigo-50" },
    { key: "upcoming", label: "Upcoming", value: stats?.upcomingTrips?.length ?? 0, icon: CalendarClock, tone: "text-amber-600", accent: "bg-amber-50" },
  ];

  return (
    <PageShell>
      {toastNode}

      <PageHeader title="Trips" subtitle="Plan, run and close vehicle trips" icon={RouteIcon}>
        {canCreate && <Button onClick={() => navigate("/fleet/trips/new")}><Plus /> New Trip</Button>}
      </PageHeader>

      {stats && <StatStrip items={kpi} />}

      <GlassCard className="mb-5">
        {/* Filters */}
        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search route, purpose, booking…"
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={vehicleId} onChange={(e) => onFilter(setVehicleId)(e.target.value)}>
              <option value="">All vehicles</option>
              {vehicleOpts.map((o) => <option key={o.publicId} value={o.publicId}>{o.label}</option>)}
            </Select>
            <Select value={driverId} onChange={(e) => onFilter(setDriverId)(e.target.value)}>
              <option value="">All drivers</option>
              {driverOpts.map((o) => <option key={o.publicId} value={o.publicId}>{o.label}</option>)}
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => onFilter(setFromDate)(e.target.value)} title="From date" />
            <Input type="date" value={toDate} onChange={(e) => onFilter(setToDate)(e.target.value)} title="To date" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ChipBar
              options={statusChips(TRIP_STATUS)}
              value={statusF}
              onChange={(val) => { setStatusF(val); setPage(0); }}
            />
            <div className="flex items-center gap-2">
              {anyFilter && <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>}
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
        </div>
      </GlassCard>

      {loading ? (
        <GlassCard><LoadingState label="Loading trips…" /></GlassCard>
      ) : items.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={RouteIcon}
            title={anyFilter ? "No trips match your filters" : "No trips yet"}
            hint={anyFilter ? "Try clearing the filters." : "Plan a trip or log a completed one."}
            action={canCreate && !anyFilter && (
              <Button onClick={() => navigate("/fleet/trips/new")}><Plus /> New Trip</Button>
            )}
          />
        </GlassCard>
      ) : (
        <>
          {view === "list" ? (
          <GlassCard>
          <Table className="fleet-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Trip</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Vehicle / Driver</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.publicId} className="cursor-pointer" onClick={() => navigate(`/fleet/trips/${t.publicId}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <RouteIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">
                          {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "Trip"}
                        </p>
                        {t.bookingCode && <p className="truncate text-xs text-slate-400">Booking {t.bookingCode}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-600">{fmtDateTime(t.startDatetime)}</div>
                    {t.endDatetime && <div className="text-xs text-slate-400">→ {fmtDateTime(t.endDatetime)}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-slate-700">{t.vehicleNumber || "—"}</div>
                    <div className="text-xs text-slate-400">{t.driverName || "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{fmtNumber(t.distanceKm, " km")}</TableCell>
                  <TableCell className="text-sm">{fmtMoney(t.totalExpense)}</TableCell>
                  <TableCell><StatusBadge config={TRIP_STATUS} value={t.status} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {canUpdate && t.status === "PLANNED" && (
                        <Button variant="ghost" size="icon" title="Start trip"
                          className="text-blue-600 hover:bg-blue-50" onClick={() => setStartTarget(t)}>
                          <Play />
                        </Button>
                      )}
                      {canUpdate && t.status === "ONGOING" && (
                        <Button variant="ghost" size="icon" title="Close trip"
                          className="text-green-600 hover:bg-green-50" onClick={() => setCloseTarget(t)}>
                          <Flag />
                        </Button>
                      )}
                      {canUpdate && (t.status === "PLANNED" || t.status === "ONGOING") && (
                        <Button variant="ghost" size="icon" title="Cancel trip"
                          className="text-amber-600 hover:bg-amber-50" onClick={() => setCancelTarget(t)}>
                          <Ban />
                        </Button>
                      )}
                      {/* Ungated: printing the slip IS the dispatcher's job. The server decides
                          what goes ON it — the office-use cost block is omitted for anyone without
                          FLEET_MONEY_READ, so this button can safely be open to everyone. */}
                      <Button variant="ghost" size="icon" title="Duty slip"
                        onClick={() => printDutySlip(t)}>
                        <Printer />
                      </Button>
                      {canUpdate && t.status !== "CANCELLED" && (
                        <Button variant="ghost" size="icon" title="Edit"
                          onClick={() => navigate(`/fleet/trips/${t.publicId}/edit`)}>
                          <Pencil />
                        </Button>
                      )}
                      {canDelete && t.status !== "ONGOING" && (
                        <Button variant="ghost" size="icon" title="Delete"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(t)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </GlassCard>
          ) : (
          <CardGrid>
            {items.map((t) => (
              <div key={t.publicId} className="group flex flex-col rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
                <button onClick={() => navigate(`/fleet/trips/${t.publicId}`)} className="flex items-start gap-3 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <RouteIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-slate-800">
                      {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "Trip"}
                    </p>
                    <p className="truncate text-xs text-slate-400">{fmtDateTime(t.startDatetime)}</p>
                  </div>
                  <StatusBadge config={TRIP_STATUS} value={t.status} />
                </button>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Meta label="Vehicle" value={t.vehicleNumber || "—"} />
                  <Meta label="Driver" value={t.driverName || "—"} />
                  <Meta label="Distance" value={fmtNumber(t.distanceKm, " km")} />
                  <Meta label="Expense" value={fmtMoney(t.totalExpense)} />
                </div>
                {t.bookingCode && <p className="mt-2 truncate text-xs text-slate-400">Booking {t.bookingCode}</p>}

                <div className="mt-auto flex items-center justify-end gap-0.5 border-t border-slate-100 pt-3">
                  {canUpdate && t.status === "PLANNED" && (
                    <Button variant="ghost" size="icon" title="Start trip" className="text-blue-600 hover:bg-blue-50" onClick={() => setStartTarget(t)}><Play /></Button>
                  )}
                  {canUpdate && t.status === "ONGOING" && (
                    <Button variant="ghost" size="icon" title="Close trip" className="text-green-600 hover:bg-green-50" onClick={() => setCloseTarget(t)}><Flag /></Button>
                  )}
                  {canUpdate && (t.status === "PLANNED" || t.status === "ONGOING") && (
                    <Button variant="ghost" size="icon" title="Cancel trip" className="text-amber-600 hover:bg-amber-50" onClick={() => setCancelTarget(t)}><Ban /></Button>
                  )}
                  <Button variant="ghost" size="icon" title="Duty slip" onClick={() => printDutySlip(t)}><Printer /></Button>
                  {canUpdate && t.status !== "CANCELLED" && (
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/fleet/trips/${t.publicId}/edit`)}><Pencil /></Button>
                  )}
                  {canDelete && t.status !== "ONGOING" && (
                    <Button variant="ghost" size="icon" title="Delete" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(t)}><Trash2 /></Button>
                  )}
                </div>
              </div>
            ))}
          </CardGrid>
          )}

          <GlassCard className="mt-5">
            <CommonPagination
              pageIndex={pagination?.page ?? 0}
              pageSize={pagination?.size ?? size}
              totalElements={pagination?.totalElements ?? items.length}
              totalPages={pagination?.totalPages ?? 1}
              goToPage={setPage}
              changePageSize={(s) => { setSize(s); setPage(0); }}
            />
          </GlassCard>
        </>
      )}

      {startTarget && (
        <StartTripDialog trip={startTarget} onClose={() => setStartTarget(null)}
          onDone={async () => { setStartTarget(null); await refetch(); }} showToast={showToast} />
      )}
      {closeTarget && (
        <CloseTripDialog trip={closeTarget} onClose={() => setCloseTarget(null)}
          onDone={async () => { setCloseTarget(null); await refetch(); }} showToast={showToast} />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel this trip?"
        description="The trip will be marked CANCELLED and its vehicle freed."
        confirmLabel="Cancel Trip"
        variant="destructive"
        busy={busy}
        onConfirm={confirmCancel}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Move trip to Trash?"
        description="This trip will be moved to Trash."
        confirmLabel="Move to Trash"
        busy={busy}
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}

/* ── Start trip ───────────────────────────────────────────────── */
export function StartTripDialog({ trip, onClose, onDone, showToast }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { startOdometer: trip?.startOdometer ?? "", startDatetime: nowDateTimeInput() },
  });

  const onSubmit = async (data) => {
    try {
      await fleetService.startTrip(trip.publicId, {
        startOdometer: toNum(data.startOdometer),
        startDatetime: data.startDatetime || null,
      });
      showToast("Trip started.");
      await onDone();
    } catch (e) {
      showToast(errMsg(e, "Couldn't start the trip."), "error");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" onClose={onClose}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader><DialogTitle>Start trip</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Start Odometer (km)" required error={errors.startOdometer}>
              <Input type="number" aria-invalid={!!errors.startOdometer}
                {...register("startOdometer", { required: "Start odometer is required", min: { value: 0, message: "Can't be negative" } })} />
            </Field>
            <Field label="Start Time">
              <Input type="datetime-local" {...register("startDatetime")} />
            </Field>
            <p className="text-xs text-slate-400">The vehicle must be Available and the driver Active. This flips the vehicle to On Trip.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Starting…" : "Start Trip"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Close trip ───────────────────────────────────────────────── */
export function CloseTripDialog({ trip, onClose, onDone, showToast }) {
  // OLD — removed in the ledger cutover:
  //   fuelCost: trip?.fuelCost ?? "", tollCost: trip?.tollCost ?? "",
  //   driverAllowance: trip?.driverAllowance ?? "",
  // Closing a trip no longer records cost. The same three figures are collected by the expense
  // ledger, and both paths were live — one tank of diesel entered here AND there is Rs 12,000 of
  // fuel on one trip. The server ignores them now; the fields are gone so nobody types them twice.
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      endOdometer: trip?.endOdometer ?? "", endDatetime: nowDateTimeInput(),
      remarks: trip?.remarks ?? "",
    },
  });

  const onSubmit = async (data) => {
    try {
      await fleetService.closeTrip(trip.publicId, {
        endOdometer: toNum(data.endOdometer),
        endDatetime: data.endDatetime || null,
        remarks: data.remarks?.trim() || null,
      });
      showToast("Trip closed.");
      await onDone();
    } catch (e) {
      showToast(errMsg(e, "Couldn't close the trip."), "error");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent onClose={onClose}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader><DialogTitle>Close trip</DialogTitle></DialogHeader>
          <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="End Odometer (km)" required error={errors.endOdometer}>
              <Input type="number" aria-invalid={!!errors.endOdometer}
                {...register("endOdometer", { required: "End odometer is required", min: { value: 0, message: "Can't be negative" } })} />
            </Field>
            <Field label="End Time">
              <Input type="datetime-local" {...register("endDatetime")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Remarks"><Textarea rows={2} {...register("remarks")} /></Field>
            </div>
            {/* Costs moved out of this dialog — see the note on defaultValues above. */}
            <div className="sm:col-span-2 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-[12px] text-blue-800">
              <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Fuel, tolls and the driver&apos;s allowance are recorded in
                {" "}<strong>Fleet&nbsp;→&nbsp;Expenses</strong> against this trip — that is what the
                driver&apos;s cash settlement and the vehicle&apos;s running cost read from.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="success" disabled={isSubmitting}>{isSubmitting ? "Closing…" : "Close Trip"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}