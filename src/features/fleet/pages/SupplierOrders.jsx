// src/features/fleet/pages/SupplierOrders.jsx
//
// The operator's side of the Transport Marketplace: jobs the platform has committed to this fleet,
// and the screen where a vehicle and driver get put against one.
//
// It lives in `fleet/` because that is the truth of it — the operator is an ordinary Vehicle Diary
// tenant, and assigning a platform job means picking one of THEIR OWN vehicles and drivers. Doing
// that with the real fleet rows is what lets the trip land in their diary instead of as loose text.
//
// NO MONEY ON THIS SCREEN, and none is available to put there: `SupplierOrderDto` carries no
// payable, no supplier amount and no platform earning. An operator is told the job; settlement
// happens outside the order.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Car, MapPin, Truck, User, Users } from "lucide-react";
import { transportSupplierService } from "../api/transportSupplierService";
import fleetService from "../api/fleetService";
import {
  Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Field, GlassCard, Input, LoadingState, PageHeader, PageShell, Pager, Select,
  errMsg, fmtDateTime,
} from "../components/fleetUi";
import { useToast } from "@shared/ui/toast";

const PAGE_SIZE = 20;

/** Only these two mean "this is really yours to run". Anything else is still moving. */
const LIVE = new Set(["CONFIRMED", "TENANT_ACCEPTED"]);

const human = (v) => (v ? String(v).replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "");

export default function SupplierOrders() {
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [assigning, setAssigning] = useState(null); // the order being assigned
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    fleetVehiclePublicId: "",
    fleetDriverPublicId: "",
    vehicleRegistration: "",
    vehicleMakeModel: "",
    driverName: "",
    driverPhone: "",
    changeReason: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: data, pagination: meta } = await transportSupplierService.listOrders({
        page,
        size: PAGE_SIZE,
      });
      setRows(data ?? []);
      setPagination(meta);
    } catch (e) {
      showToast(errMsg(e, "Could not load your platform jobs."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  /* The operator's own fleet, loaded once and reused by every assign dialog. Fetched lazily rather
     than on mount: most visits are to read the day's jobs, not to assign. */
  const ensureFleetLoaded = useCallback(async () => {
    if (vehicles.length || drivers.length) return;
    try {
      const [v, d] = await Promise.all([
        fleetService.vehicleOptions("ACTIVE").catch(() => []),
        fleetService.driverOptions("ACTIVE").catch(() => []),
      ]);
      setVehicles(Array.isArray(v) ? v : v?.items ?? []);
      setDrivers(Array.isArray(d) ? d : d?.items ?? []);
    } catch {
      // Typing a registration by hand still works; the dropdowns are a convenience, not the contract.
    }
  }, [vehicles.length, drivers.length]);

  async function openAssign(order) {
    const current = order.assignments?.[0];
    setForm({
      fleetVehiclePublicId: "",
      fleetDriverPublicId: "",
      // Pre-filled from the current assignment so a REASSIGN is an edit rather than a retype.
      vehicleRegistration: current?.vehicleRegistration ?? "",
      vehicleMakeModel: current?.vehicleMakeModel ?? "",
      driverName: current?.driverName ?? "",
      driverPhone: current?.driverPhone ?? "",
      changeReason: "",
    });
    setAssigning(order);
    ensureFleetLoaded();
  }

  /* Picking a fleet row fills the free-text fields too. The server stores both: the ids are what
     link the job to the diary, the strings are what get printed on the duty slip and must survive
     the vehicle later being renamed or retired. */
  function pickVehicle(publicId) {
    const v = vehicles.find((x) => (x.value ?? x.publicId) === publicId);
    setForm((f) => ({
      ...f,
      fleetVehiclePublicId: publicId,
      vehicleRegistration: v?.registrationNumber ?? v?.label ?? f.vehicleRegistration,
      vehicleMakeModel: v?.makeModel ?? f.vehicleMakeModel,
    }));
  }

  function pickDriver(publicId) {
    const d = drivers.find((x) => (x.value ?? x.publicId) === publicId);
    setForm((f) => ({
      ...f,
      fleetDriverPublicId: publicId,
      driverName: d?.name ?? d?.label ?? f.driverName,
      driverPhone: d?.phone ?? f.driverPhone,
    }));
  }

  async function submitAssign() {
    setSaving(true);
    try {
      await transportSupplierService.assign(assigning.publicId, {
        fleetVehiclePublicId: form.fleetVehiclePublicId || null,
        fleetDriverPublicId: form.fleetDriverPublicId || null,
        vehicleRegistration: form.vehicleRegistration?.trim() || null,
        vehicleMakeModel: form.vehicleMakeModel?.trim() || null,
        driverName: form.driverName?.trim() || null,
        driverPhone: form.driverPhone?.trim() || null,
        changeReason: form.changeReason?.trim() || null,
      });
      showToast("Assigned. The duty slip has been reissued.", "success");
      setAssigning(null);
      await load();
    } catch (e) {
      showToast(errMsg(e, "Could not assign that vehicle."), "error");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.totalElements ?? rows.length;

  return (
    <PageShell>
      <PageHeader
        icon={Truck}
        title="Platform jobs"
        subtitle="Journeys the platform has committed to your fleet. Put a vehicle and driver against each one before pickup."
      />

      {loading ? (
        <LoadingState label="Loading your platform jobs…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No platform jobs yet"
          hint="When the platform confirms an order against one of your listings, it appears here."
        />
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((o) => {
              const assigned = o.assignments?.length > 0;
              const a = o.assignments?.[0];
              return (
                <GlassCard key={o.publicId} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{o.orderCode}</span>
                        <Badge variant={LIVE.has(o.status) ? "green" : "amber"}>{human(o.status)}</Badge>
                        {/* The server's own answer, not a guess from the status — it knows whether a
                            deadline has passed and whether an assignment is still outstanding. */}
                        {o.assignmentRequired && !assigned && <Badge variant="red">Needs a vehicle</Badge>}
                      </div>

                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                        <CalendarClock className="size-3.5 shrink-0" />
                        <span className="font-medium">{fmtDateTime(o.pickupAt)}</span>
                        {o.serviceTimezone && <span className="text-slate-400">({o.serviceTimezone})</span>}
                        <span aria-hidden className="text-slate-300">·</span>
                        <span>{human(o.serviceType)}</span>
                      </p>

                      <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span className="min-w-0">
                          {o.pickupLocation}
                          {o.dropLocation ? ` → ${o.dropLocation}` : ""}
                        </span>
                      </p>

                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Car className="size-3.5" /> {o.productName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" /> {o.passengers ?? "—"} pax
                          {o.luggagePieces != null ? ` · ${o.luggagePieces} bags` : ""}
                          {o.vehicleCount ? ` · ${o.vehicleCount} vehicle(s)` : ""}
                        </span>
                        {o.leadPassengerName && (
                          <span className="inline-flex items-center gap-1">
                            <User className="size-3.5" /> {o.leadPassengerName}
                            {o.leadPassengerPhone ? ` · ${o.leadPassengerPhone}` : ""}
                          </span>
                        )}
                      </p>

                      {o.specialRequests && (
                        <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-900">
                          {o.specialRequests}
                        </p>
                      )}

                      {assigned && (
                        <p className="mt-2 text-[13px] text-slate-600">
                          <span className="font-medium text-slate-800">Assigned:</span>{" "}
                          {[a.vehicleRegistration, a.vehicleMakeModel, a.driverName, a.driverPhone]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Button
                        variant={assigned ? "outline" : "default"}
                        size="sm"
                        onClick={() => openAssign(o)}
                        disabled={!LIVE.has(o.status)}
                        title={LIVE.has(o.status) ? undefined : "This job is not confirmed yet"}
                      >
                        {assigned ? "Reassign" : "Assign vehicle"}
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} className="mt-5" />
        </>
      )}

      <Dialog open={!!assigning} onOpenChange={(v) => !v && setAssigning(null)}>
        <DialogContent className="max-w-lg" onClose={() => setAssigning(null)}>
          <DialogHeader>
            <DialogTitle>
              {assigning?.assignments?.length ? "Reassign" : "Assign"} — {assigning?.orderCode}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 px-6 py-4">
            <Field label="Vehicle from your fleet" hint="Picking one links the job to your Vehicle Diary. You can also just type the details below.">
              <Select value={form.fleetVehiclePublicId} onChange={(e) => pickVehicle(e.target.value)}>
                <option value="">— not from my fleet —</option>
                {vehicles.map((v) => (
                  <option key={v.value ?? v.publicId} value={v.value ?? v.publicId}>
                    {v.label ?? v.registrationNumber}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Driver from your fleet">
              <Select value={form.fleetDriverPublicId} onChange={(e) => pickDriver(e.target.value)}>
                <option value="">— not from my fleet —</option>
                {drivers.map((d) => (
                  <option key={d.value ?? d.publicId} value={d.value ?? d.publicId}>
                    {d.label ?? d.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Registration">
                <Input
                  value={form.vehicleRegistration}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleRegistration: e.target.value }))}
                />
              </Field>
              <Field label="Make / model">
                <Input
                  value={form.vehicleMakeModel}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleMakeModel: e.target.value }))}
                />
              </Field>
              <Field label="Driver name">
                <Input
                  value={form.driverName}
                  onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))}
                />
              </Field>
              <Field label="Driver phone" hint="Printed on the duty slip — the passenger calls this.">
                <Input
                  value={form.driverPhone}
                  onChange={(e) => setForm((f) => ({ ...f, driverPhone: e.target.value }))}
                />
              </Field>
            </div>

            {assigning?.assignments?.length > 0 && (
              <Field label="Why the change" hint="Kept on the record — a reassignment reissues the passenger's duty slip.">
                <Input
                  value={form.changeReason}
                  onChange={(e) => setForm((f) => ({ ...f, changeReason: e.target.value }))}
                />
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(null)}>Cancel</Button>
            <Button
              onClick={submitAssign}
              disabled={saving || (!form.vehicleRegistration?.trim() && !form.driverName?.trim())}
            >
              {saving ? "Saving…" : "Confirm assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
