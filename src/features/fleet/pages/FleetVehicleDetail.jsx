



// src/fleet/FleetVehicleDetail.jsx
// Vehicle detail — profile, compliance docs, and the fuel / maintenance / trip diaries.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Car, ArrowLeft, Pencil, Trash2, Settings2, Fuel, Wrench, Route as RouteIcon, Gauge, CalendarClock,
  Users, ShieldCheck,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import CommonPagination from "../components/CommanPegination";
import {
  Button, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  PageShell, GlassCard, LoadingState, EmptyState, ConfirmDialog, useToast, errMsg,
  StatusBadge, VEHICLE_STATUS, OWNER_TYPE, TRIP_STATUS, expiryInfo, fmtDate, fmtDateTime,
  fmtNumber, fmtMoney, StatStrip, FormSection,
} from "../components/fleetUi";
import { FuelLogsPanel, MaintenanceLogsPanel } from "../components/vehicleLogs";
import { VehicleStatusDialog } from "./FleetVehicles";

function Info({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
        <p className="text-sm font-semibold text-slate-700 truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function DocChip({ label, date }) {
  const info = expiryInfo(date);
  return (
    <div className="rounded-xl border border-slate-100 bg-white/60 p-3 flex flex-col justify-center min-w-0 w-full">
      <p className="mb-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      {date ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{fmtDate(date)}</span>
          <Badge variant={info.variant} className="whitespace-nowrap">{info.text}</Badge>
        </div>
      ) : (
        <span className="text-sm text-slate-300">Not set</span>
      )}
    </div>
  );
}

const TABS = [
  { key: "fuel", label: "Fuel", icon: Fuel },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "trips", label: "Trips", icon: RouteIcon },
];

export default function FleetVehicleDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("fuel");
  const [showDelete, setShowDelete] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [busy, setBusy] = useState(false);

  const canUpdate = hasPermission(P.FLEET_UPDATE);
  const canCreate = hasPermission(P.FLEET_CREATE);
  const canDelete = hasPermission(P.FLEET_DELETE);

  const loadVehicle = useCallback(async () => {
    try {
      const v = await fleetService.getVehicle(publicId);
      setVehicle(v);
    } catch (e) {
      showToast(errMsg(e, "Failed to load vehicle."), "error");
    } finally {
      setLoading(false);
    }
  }, [publicId, showToast]);

  useEffect(() => { loadVehicle(); }, [loadVehicle]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await fleetService.deleteVehicle(publicId);
      showToast("Vehicle moved to Trash.");
      navigate("/fleet/vehicles");
    } catch (e) {
      showToast(errMsg(e, "Failed to delete vehicle."), "error");
      setBusy(false);
    }
  };

  if (loading) return <PageShell><LoadingState label="Loading vehicle…" /></PageShell>;
  if (!vehicle) {
    return (
      <PageShell>
        {toastNode}
        <EmptyState icon={Car} title="Vehicle not found"
          action={<Button onClick={() => navigate("/fleet/vehicles")}>Back to Vehicles</Button>} />
      </PageShell>
    );
  }

  const spec = [vehicle.type, vehicle.make, vehicle.model].filter(Boolean).join(" · ");
  const serviceInKm = vehicle.nextServiceDueKm != null && vehicle.lastOdometer != null
    ? vehicle.nextServiceDueKm - vehicle.lastOdometer
    : null;

  const kpi = [
    { key: "odo", label: "Odometer", value: fmtNumber(vehicle.lastOdometer, " km"), icon: Gauge, tone: "text-blue-600", accent: "bg-blue-50" },
    { key: "svcDate", label: "Next Service", value: vehicle.nextServiceDueDate ? fmtDate(vehicle.nextServiceDueDate) : "—", icon: CalendarClock, tone: "text-amber-600", accent: "bg-amber-50" },
    { key: "svcKm", label: "Service In", value: serviceInKm != null ? fmtNumber(serviceInKm, " km") : "—", icon: Wrench, tone: "text-orange-600", accent: "bg-orange-50" },
    { key: "seat", label: "Seating", value: vehicle.seatingCapacity ?? "—", icon: Users, tone: "text-indigo-600", accent: "bg-indigo-50" },
  ];

  return (
    <PageShell>
      {toastNode}

      <button
        onClick={() => navigate("/fleet/vehicles")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" /> Vehicles
      </button>

      {/* Hero */}
      <GlassCard className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-blue-50/60 to-transparent p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Car className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-800 sm:text-2xl truncate">{vehicle.vehicleNumber}</h1>
                <StatusBadge config={VEHICLE_STATUS} value={vehicle.status} />
              </div>
              {spec && <p className="text-xs sm:text-sm text-slate-500 truncate">{spec}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            {canUpdate && (
              <>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => setShowStatus(true)}>
                  <Settings2 className="mr-1.5 h-4 w-4" /> Status
                </Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => navigate(`/fleet/vehicles/${publicId}/edit`)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>
              </>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" className="flex-1 sm:flex-none justify-center text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setShowDelete(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <StatStrip items={kpi} />
      </div>

      {/* Profile */}
      <FormSection title="Profile" subtitle="Ownership & specifications" icon={Car} className="mb-5 mt-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Owner" value={OWNER_TYPE[vehicle.ownerType] || vehicle.ownerType} />
          <Info label="Vendor" value={vehicle.vendorName} />
          <Info label="Year" value={vehicle.year} />
          <Info label="Seating" value={vehicle.seatingCapacity} />
          <Info label="Odometer" value={fmtNumber(vehicle.lastOdometer, " km")} icon={Gauge} />
          <Info label="Next Service (date)" value={vehicle.nextServiceDueDate ? fmtDate(vehicle.nextServiceDueDate) : "—"} icon={CalendarClock} />
          <Info label="Next Service (km)" value={fmtNumber(vehicle.nextServiceDueKm, " km")} />
          <Info label="Added" value={fmtDate(vehicle.createdAt)} />
        </div>
        {vehicle.notes && (
          <div className="mt-4 rounded-xl bg-slate-50/70 p-3 text-sm text-slate-600 break-words">{vehicle.notes}</div>
        )}
      </FormSection>

      {/* Documents */}
      <FormSection title="Compliance Documents" subtitle="Expiry status across the four documents" icon={ShieldCheck} className="mb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocChip label="Insurance" date={vehicle.insuranceExpiry} />
          <DocChip label="Registration (RC)" date={vehicle.rcExpiry} />
          <DocChip label="Permit" date={vehicle.permitExpiry} />
          <DocChip label="PUC" date={vehicle.pucExpiry} />
        </div>
      </FormSection>

      {/* Diary tabs - Horizontal scrollable container */}
      <div className="mb-4 flex overflow-x-auto scrollbar-hide rounded-2xl border border-slate-100 bg-white/70 p-1 backdrop-blur max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 sm:py-2 text-sm font-bold transition-all whitespace-nowrap shrink-0 flex-1 sm:flex-none ${
              tab === t.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="w-full">
        {tab === "fuel" && (
          <FuelLogsPanel
            vehiclePublicId={publicId}
            canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete}
            showToast={showToast} onChange={loadVehicle}
          />
        )}
        {tab === "maintenance" && (
          <MaintenanceLogsPanel
            vehiclePublicId={publicId}
            canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete}
            showToast={showToast} onChange={loadVehicle}
          />
        )}
        {tab === "trips" && (
          <VehicleTripsPanel vehiclePublicId={publicId} showToast={showToast} navigate={navigate} />
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Move vehicle to Trash?"
        description={`“${vehicle.vehicleNumber}” will be moved to Trash. Vehicles with diary history can't be deleted — retire them via Out of Service instead.`}
        confirmLabel="Move to Trash"
        busy={busy}
        onConfirm={confirmDelete}
      />

      <VehicleStatusDialog
        vehicle={showStatus ? vehicle : null}
        onClose={() => setShowStatus(false)}
        onDone={loadVehicle}
        showToast={showToast}
      />
    </PageShell>
  );
}

/* ── Trips for this vehicle (read-only) ───────────────────────── */
function VehicleTripsPanel({ vehiclePublicId, showToast, navigate }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fleetService
      .listTrips({ vehicleId: vehiclePublicId, page, size })
      .then((res) => { if (alive) { setItems(res.items); setPagination(res.pagination); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load trips."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [vehiclePublicId, page, size, showToast]);

  return (
    <GlassCard>
      <div className="flex items-center gap-2 border-b border-slate-100 p-4 font-bold text-slate-700">
        <RouteIcon className="h-4 w-4 text-indigo-500" /> Trip History
      </div>
      {loading ? (
        <LoadingState label="Loading trips…" />
      ) : items.length === 0 ? (
        <EmptyState icon={RouteIcon} title="No trips for this vehicle yet" />
      ) : (
        <div className="w-full overflow-x-auto">
          <Table className="fleet-table min-w-[800px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Start</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.publicId} className="cursor-pointer" onClick={() => navigate(`/fleet/trips/${t.publicId}`)}>
                  <TableCell className="font-medium whitespace-nowrap">{fmtDateTime(t.startDatetime)}</TableCell>
                  <TableCell className="text-slate-600 min-w-[150px]">
                    {[t.routeFrom, t.routeTo].filter(Boolean).join(" → ") || "—"}
                  </TableCell>
                  <TableCell className="text-slate-600 whitespace-nowrap">{t.driverName || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtNumber(t.distanceKm, " km")}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtMoney(t.totalExpense)}</TableCell>
                  <TableCell><StatusBadge config={TRIP_STATUS} value={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="mt-4 w-full overflow-x-auto pb-4">
          <CommonPagination
            pageIndex={pagination?.page ?? 0}
            pageSize={pagination?.size ?? size}
            totalElements={pagination?.totalElements ?? items.length}
            totalPages={pagination?.totalPages ?? 1}
            goToPage={setPage}
            changePageSize={(s) => { setSize(s); setPage(0); }}
          />
        </div>
      )}
    </GlassCard>
  );
}