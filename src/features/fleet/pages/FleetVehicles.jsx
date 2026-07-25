// // src/fleet/FleetVehicles.jsx
// // Vehicle list — modern card grid with a KPI strip + chip status filters.
// // Server-paginated, searchable, filterable. Part of the Vehicle Diary.
// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   Car, Bus, Plus, Search, Pencil, Trash2, Settings2, Eye,
//   CheckCircle2, Route as RouteIcon, Wrench, XCircle,
// } from "lucide-react";

// import fleetService from "../api/fleetService";
// import { hasPermission, P } from "@shared/lib/access";
// import CommonPagination from "../components/CommanPegination";
// import {
//   Button, Input, Select, Label, Badge,
//   Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
//   Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
//   PageShell, PageHeader, GlassCard, LoadingState, EmptyState, ConfirmDialog,
//   StatStrip, ChipBar, statusChips, CardGrid, ViewToggle, useViewMode, cn,
//   useToast, errMsg, StatusBadge, VEHICLE_STATUS, OWNER_TYPE, expiryInfo, fmtNumber,
// } from "../components/fleetUi";

// /** Status gradients — same depth/tones as the dashboard StatCards. */
// const VEHICLE_GRADIENT = {
//   AVAILABLE: "from-green-500 to-emerald-700",
//   ON_TRIP: "from-indigo-500 to-violet-700",
//   MAINTENANCE: "from-amber-500 to-orange-600",
//   OUT_OF_SERVICE: "from-rose-500 to-red-700",
// };

// /** Most-urgent document expiry across the four vehicle docs (or null). */
// function soonestDoc(v) {
//   const docs = [
//     ["Insurance", v.insuranceExpiry],
//     ["RC", v.rcExpiry],
//     ["Permit", v.permitExpiry],
//     ["PUC", v.pucExpiry],
//   ].filter(([, d]) => d);
//   if (!docs.length) return null;
//   return docs
//     .map(([label, d]) => ({ label, ...expiryInfo(d) }))
//     .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9))[0];
// }

// /** Bus/coach get a bus glyph; everything else a car. */
// function vehicleIcon(type) {
//   const t = (type || "").toLowerCase();
//   return t.includes("bus") || t.includes("coach") ? Bus : Car;
// }

// // Manual status endpoint rejects ON_TRIP (trip-managed) — offer only these.
// const MANUAL_STATUSES = ["AVAILABLE", "MAINTENANCE", "OUT_OF_SERVICE"];

// export default function FleetVehicles() {
//   const navigate = useNavigate();
//   const { showToast, toastNode } = useToast();

//   const [items, setItems] = useState([]);
//   const [pagination, setPagination] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [stats, setStats] = useState(null);

//   const [search, setSearch] = useState("");
//   const [debounced, setDebounced] = useState("");
//   const [statusF, setStatusF] = useState("");
//   const [ownerF, setOwnerF] = useState("");
//   const [page, setPage] = useState(0);
//   const [size, setSize] = useState(12);
//   const [view, setView] = useViewMode("vehicles", "grid");

//   const [deleteTarget, setDeleteTarget] = useState(null);
//   const [statusTarget, setStatusTarget] = useState(null);
//   const [busy, setBusy] = useState(false);

//   const canCreate = hasPermission(P.FLEET_CREATE);
//   const canUpdate = hasPermission(P.FLEET_UPDATE);
//   const canDelete = hasPermission(P.FLEET_DELETE);

//   // debounce the search box
//   useEffect(() => {
//     const t = setTimeout(() => setDebounced(search.trim()), 350);
//     return () => clearTimeout(t);
//   }, [search]);

//   const loadStats = () =>
//     fleetService.getDashboard().then((d) => setStats(d)).catch(() => {});

//   useEffect(() => { loadStats(); }, []);

//   useEffect(() => {
//     let alive = true;
//     setLoading(true);
//     fleetService
//       .listVehicles({ status: statusF, ownerType: ownerF, search: debounced, page, size })
//       .then((res) => {
//         if (!alive) return;
//         setItems(res.items);
//         setPagination(res.pagination);
//       })
//       .catch((e) => alive && showToast(errMsg(e, "Failed to load vehicles."), "error"))
//       .finally(() => alive && setLoading(false));
//     return () => { alive = false; };
//   }, [statusF, ownerF, debounced, page, size, showToast]);

//   const anyFilter = search || statusF || ownerF;
//   const resetFilters = () => { setSearch(""); setStatusF(""); setOwnerF(""); setPage(0); };

//   const refetch = async () => {
//     const res = await fleetService.listVehicles({ status: statusF, ownerType: ownerF, search: debounced, page, size });
//     setItems(res.items); setPagination(res.pagination);
//     loadStats();
//   };

//   const confirmDelete = async () => {
//     setBusy(true);
//     try {
//       await fleetService.deleteVehicle(deleteTarget.publicId);
//       showToast(`${deleteTarget.vehicleNumber} moved to Trash.`);
//       setDeleteTarget(null);
//       await refetch();
//     } catch (e) {
//       showToast(errMsg(e, "Failed to delete vehicle."), "error");
//     } finally {
//       setBusy(false);
//     }
//   };

//   const vc = stats?.vehicles ?? {};
//   const kpi = [
//     { key: "total", label: "Total", value: vc.total, icon: Car, tone: "text-blue-600", accent: "bg-blue-50" },
//     { key: "available", label: "Available", value: vc.available, icon: CheckCircle2, tone: "text-green-600", accent: "bg-green-50" },
//     { key: "onTrip", label: "On Trip", value: vc.onTrip, icon: RouteIcon, tone: "text-indigo-600", accent: "bg-indigo-50" },
//     { key: "maintenance", label: "Maintenance", value: vc.maintenance, icon: Wrench, tone: "text-amber-600", accent: "bg-amber-50" },
//     { key: "outOfService", label: "Out of Service", value: vc.outOfService, icon: XCircle, tone: "text-red-600", accent: "bg-red-50" },
//   ];

//   const totalElements = pagination?.totalElements ?? items.length;
//   const totalPages = pagination?.totalPages ?? 1;

//   return (
//     <PageShell>
//       {toastNode}

//       <PageHeader title="Vehicles" subtitle="Your operational fleet" icon={Car}>
//         {canCreate && (
//           <Button onClick={() => navigate("/fleet/vehicles/new")}>
//             <Plus /> Add Vehicle
//           </Button>
//         )}
//       </PageHeader>

//       {stats && <StatStrip items={kpi} />}

//       <GlassCard className="mb-5">
//         {/* Toolbar: search + owner + clear */}
//         <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
//           <div className="relative flex-1">
//             <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//             <Input
//               value={search}
//               onChange={(e) => { setSearch(e.target.value); setPage(0); }}
//               placeholder="Search by number, make, model…"
//               className="pl-10"
//             />
//           </div>
//           <div className="flex items-center gap-3">
//             <Select value={ownerF} onChange={(e) => { setOwnerF(e.target.value); setPage(0); }} className="sm:w-40">
//               <option value="">All owners</option>
//               {Object.entries(OWNER_TYPE).map(([k, label]) => (
//                 <option key={k} value={k}>{label}</option>
//               ))}
//             </Select>
//             {anyFilter && (
//               <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>
//             )}
//             <ViewToggle value={view} onChange={setView} className="ml-auto" />
//           </div>
//         </div>
//         {/* Status chips */}
//         <div className="border-t border-slate-100 px-4 py-3">
//           <ChipBar
//             options={statusChips(VEHICLE_STATUS)}
//             value={statusF}
//             onChange={(val) => { setStatusF(val); setPage(0); }}
//           />
//         </div>
//       </GlassCard>

//       {/* Body */}
//       {loading ? (
//         <GlassCard><LoadingState label="Loading vehicles…" /></GlassCard>
//       ) : items.length === 0 ? (
//         <GlassCard>
//           <EmptyState
//             icon={Car}
//             title={anyFilter ? "No vehicles match your filters" : "No vehicles yet"}
//             hint={anyFilter ? "Try clearing the filters." : "Add your first vehicle to start the diary."}
//             action={canCreate && !anyFilter && (
//               <Button onClick={() => navigate("/fleet/vehicles/new")}><Plus /> Add Vehicle</Button>
//             )}
//           />
//         </GlassCard>
//       ) : (
//         <>
//           {view === "grid" ? (
//             <CardGrid>
//               {items.map((v) => (
//                 <VehicleCard
//                   key={v.publicId}
//                   v={v}
//                   canUpdate={canUpdate}
//                   canDelete={canDelete}
//                   onView={() => navigate(`/fleet/vehicles/${v.publicId}`)}
//                   onEdit={() => navigate(`/fleet/vehicles/${v.publicId}/edit`)}
//                   onStatus={() => setStatusTarget(v)}
//                   onDelete={() => setDeleteTarget(v)}
//                 />
//               ))}
//             </CardGrid>
//           ) : (
//             <GlassCard>
//               <Table className="fleet-table">
//                 <TableHeader>
//                   <TableRow className="hover:bg-transparent">
//                     <TableHead>Vehicle</TableHead>
//                     <TableHead>Owner</TableHead>
//                     <TableHead>Documents</TableHead>
//                     <TableHead>Odometer</TableHead>
//                     <TableHead>Status</TableHead>
//                     <TableHead className="text-right">Actions</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {items.map((v) => {
//                     const doc = soonestDoc(v);
//                     const spec = [v.type, v.make, v.model].filter(Boolean).join(" · ");
//                     return (
//                       <TableRow key={v.publicId} className="cursor-pointer" onClick={() => navigate(`/fleet/vehicles/${v.publicId}`)}>
//                         <TableCell>
//                           <div className="font-bold text-slate-800">{v.vehicleNumber}</div>
//                           {spec && <div className="text-xs text-slate-400">{spec}</div>}
//                         </TableCell>
//                         <TableCell>
//                           <div className="text-sm font-medium text-slate-600">{OWNER_TYPE[v.ownerType] || v.ownerType}</div>
//                           {v.vendorName && <div className="text-xs text-slate-400">{v.vendorName}</div>}
//                         </TableCell>
//                         <TableCell>
//                           {doc ? <Badge variant={doc.variant}>{doc.label}: {doc.text}</Badge> : <span className="text-xs text-slate-300">—</span>}
//                         </TableCell>
//                         <TableCell className="text-sm">{fmtNumber(v.lastOdometer, " km")}</TableCell>
//                         <TableCell><StatusBadge config={VEHICLE_STATUS} value={v.status} /></TableCell>
//                         <TableCell onClick={(e) => e.stopPropagation()}>
//                           <div className="flex items-center justify-end gap-0.5">
//                             <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/fleet/vehicles/${v.publicId}`)}><Eye /></Button>
//                             {canUpdate && (
//                               <>
//                                 <Button variant="ghost" size="icon" title="Change status" onClick={() => setStatusTarget(v)}><Settings2 /></Button>
//                                 <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/fleet/vehicles/${v.publicId}/edit`)}><Pencil /></Button>
//                               </>
//                             )}
//                             {canDelete && (
//                               <Button variant="ghost" size="icon" title="Delete"
//                                 className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(v)}><Trash2 /></Button>
//                             )}
//                           </div>
//                         </TableCell>
//                       </TableRow>
//                     );
//                   })}
//                 </TableBody>
//               </Table>
//             </GlassCard>
//           )}

//           <GlassCard className="mt-5">
//             <CommonPagination
//               pageIndex={pagination?.page ?? 0}
//               pageSize={pagination?.size ?? size}
//               totalElements={totalElements}
//               totalPages={totalPages}
//               goToPage={(p) => setPage(p)}
//               changePageSize={(s) => { setSize(s); setPage(0); }}
//             />
//           </GlassCard>
//         </>
//       )}

//       {/* Delete confirm */}
//       <ConfirmDialog
//         open={!!deleteTarget}
//         onOpenChange={(o) => !o && setDeleteTarget(null)}
//         title="Move vehicle to Trash?"
//         description={deleteTarget ? `“${deleteTarget.vehicleNumber}” will be moved to Trash. Vehicles with diary history can't be deleted — retire them via Out of Service instead.` : ""}
//         confirmLabel="Move to Trash"
//         busy={busy}
//         onConfirm={confirmDelete}
//       />

//       {/* Status change */}
//       <VehicleStatusDialog
//         vehicle={statusTarget}
//         onClose={() => setStatusTarget(null)}
//         onDone={refetch}
//         showToast={showToast}
//       />
//     </PageShell>
//   );
// }

// /* ── Vehicle card ── */
// function Meta({ label, value }) {
//   return (
//     <div className="min-w-0">
//       <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
//       <p className="truncate text-sm font-semibold text-slate-700">{value}</p>
//     </div>
//   );
// }

// function VehicleCard({ v, canUpdate, canDelete, onView, onEdit, onStatus, onDelete }) {
//   const doc = soonestDoc(v);
//   const spec = [v.type, v.make, v.model].filter(Boolean).join(" · ");
//   const Icon = vehicleIcon(v.type);
//   const grad = VEHICLE_GRADIENT[v.status] || "from-slate-500 to-slate-700";
//   const statusLabel = VEHICLE_STATUS[v.status]?.label || v.status;
//   return (
//     <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg">
//       {/* colourful status header — mirrors the dashboard StatCard */}
//       <button onClick={onView} className={cn("relative flex items-center gap-3 bg-gradient-to-br p-5 text-left text-white shadow-lg", grad)}>
//         <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
//         <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
//           <Icon className="h-5 w-5" />
//         </div>
//         <div className="relative z-10 min-w-0 flex-1">
//           <p className="truncate font-extrabold">{v.vehicleNumber}</p>
//           <p className="truncate text-xs text-white/80">{spec || "—"}</p>
//         </div>
//         <span className="relative z-10 inline-flex shrink-0 items-center rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
//           {statusLabel}
//         </span>
//       </button>

//       {/* body */}
//       <div className="flex flex-1 flex-col p-4">
//         <div className="grid grid-cols-2 gap-2">
//           <Meta label="Owner" value={OWNER_TYPE[v.ownerType] || v.ownerType || "—"} />
//           <Meta label="Odometer" value={fmtNumber(v.lastOdometer, " km")} />
//         </div>
//         {v.vendorName && <p className="mt-1 truncate text-xs text-slate-400">Vendor: {v.vendorName}</p>}

//         <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
//           {doc ? (
//             <Badge variant={doc.variant}>{doc.label}: {doc.text}</Badge>
//           ) : (
//             <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
//               <CheckCircle2 className="h-3.5 w-3.5" /> Docs OK
//             </span>
//           )}
//           <div className="flex items-center gap-0.5">
//             <Button variant="ghost" size="icon" title="View" onClick={onView}><Eye /></Button>
//             {canUpdate && (
//               <>
//                 <Button variant="ghost" size="icon" title="Change status" onClick={onStatus}><Settings2 /></Button>
//                 <Button variant="ghost" size="icon" title="Edit" onClick={onEdit}><Pencil /></Button>
//               </>
//             )}
//             {canDelete && (
//               <Button variant="ghost" size="icon" title="Delete"
//                 className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={onDelete}><Trash2 /></Button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ── Vehicle status change dialog (shared with the detail page) ── */
// export function VehicleStatusDialog({ vehicle, onClose, onDone, showToast }) {
//   const [status, setStatus] = useState("AVAILABLE");
//   const [busy, setBusy] = useState(false);

//   useEffect(() => {
//     if (vehicle) setStatus(MANUAL_STATUSES.includes(vehicle.status) ? vehicle.status : "AVAILABLE");
//   }, [vehicle]);

//   const save = async () => {
//     setBusy(true);
//     try {
//       await fleetService.changeVehicleStatus(vehicle.publicId, status);
//       showToast("Vehicle status updated.");
//       onClose();
//       await onDone();
//     } catch (e) {
//       showToast(errMsg(e, "Couldn't update status."), "error");
//     } finally {
//       setBusy(false);
//     }
//   };

//   return (
//     <Dialog open={!!vehicle} onOpenChange={(o) => !o && onClose()}>
//       <DialogContent className="max-w-md" onClose={onClose}>
//         <DialogHeader>
//           <DialogTitle>Change status</DialogTitle>
//         </DialogHeader>
//         <DialogBody>
//           <Label required>Status for {vehicle?.vehicleNumber}</Label>
//           <Select value={status} onChange={(e) => setStatus(e.target.value)}>
//             {MANUAL_STATUSES.map((s) => (
//               <option key={s} value={s}>{VEHICLE_STATUS[s].label}</option>
//             ))}
//           </Select>
//           <p className="mt-2 text-xs text-slate-400">
//             “On Trip” is managed automatically by the trip lifecycle and can't be set here.
//           </p>
//         </DialogBody>
//         <DialogFooter>
//           <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
//           <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Update"}</Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }





// src/fleet/FleetVehicles.jsx
// Vehicle list — modern card grid with a KPI strip + chip status filters.
// Server-paginated, searchable, filterable. Part of the Vehicle Diary.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Car, Bus, Plus, Search, Pencil, Trash2, Settings2, Eye,
  CheckCircle2, Route as RouteIcon, Wrench, XCircle,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import CommonPagination from "../components/CommanPegination";
import {
  Button, Input, Select, Label, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  PageShell, PageHeader, GlassCard, LoadingState, EmptyState, ConfirmDialog,
  StatStrip, ChipBar, statusChips, CardGrid, ViewToggle, useViewMode, cn,
  useToast, errMsg, StatusBadge, VEHICLE_STATUS, OWNER_TYPE, expiryInfo, fmtNumber,
} from "../components/fleetUi";

/** Status gradients — same depth/tones as the dashboard StatCards. */
const VEHICLE_GRADIENT = {
  AVAILABLE: "from-green-500 to-emerald-700",
  ON_TRIP: "from-indigo-500 to-violet-700",
  MAINTENANCE: "from-amber-500 to-orange-600",
  OUT_OF_SERVICE: "from-rose-500 to-red-700",
};

/** Most-urgent document expiry across the four vehicle docs (or null). */
function soonestDoc(v) {
  const docs = [
    ["Insurance", v.insuranceExpiry],
    ["RC", v.rcExpiry],
    ["Permit", v.permitExpiry],
    ["PUC", v.pucExpiry],
  ].filter(([, d]) => d);
  if (!docs.length) return null;
  return docs
    .map(([label, d]) => ({ label, ...expiryInfo(d) }))
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9))[0];
}

/** Bus/coach get a bus glyph; everything else a car. */
function vehicleIcon(type) {
  const t = (type || "").toLowerCase();
  return t.includes("bus") || t.includes("coach") ? Bus : Car;
}

// Manual status endpoint rejects ON_TRIP (trip-managed) — offer only these.
const MANUAL_STATUSES = ["AVAILABLE", "MAINTENANCE", "OUT_OF_SERVICE"];

export default function FleetVehicles() {
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState("");
  const [ownerF, setOwnerF] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(12);
  const [view, setView] = useViewMode("vehicles", "grid");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission(P.FLEET_CREATE);
  const canUpdate = hasPermission(P.FLEET_UPDATE);
  const canDelete = hasPermission(P.FLEET_DELETE);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadStats = () =>
    fleetService.getDashboard().then((d) => setStats(d)).catch(() => {});

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fleetService
      .listVehicles({ status: statusF, ownerType: ownerF, search: debounced, page, size })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load vehicles."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [statusF, ownerF, debounced, page, size, showToast]);

  const anyFilter = search || statusF || ownerF;
  const resetFilters = () => { setSearch(""); setStatusF(""); setOwnerF(""); setPage(0); };

  const refetch = async () => {
    const res = await fleetService.listVehicles({ status: statusF, ownerType: ownerF, search: debounced, page, size });
    setItems(res.items); setPagination(res.pagination);
    loadStats();
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await fleetService.deleteVehicle(deleteTarget.publicId);
      showToast(`${deleteTarget.vehicleNumber} moved to Trash.`);
      setDeleteTarget(null);
      await refetch();
    } catch (e) {
      showToast(errMsg(e, "Failed to delete vehicle."), "error");
    } finally {
      setBusy(false);
    }
  };

  const vc = stats?.vehicles ?? {};
  const kpi = [
    { key: "total", label: "Total", value: vc.total, icon: Car, tone: "text-blue-600", accent: "bg-blue-50" },
    { key: "available", label: "Available", value: vc.available, icon: CheckCircle2, tone: "text-green-600", accent: "bg-green-50" },
    { key: "onTrip", label: "On Trip", value: vc.onTrip, icon: RouteIcon, tone: "text-indigo-600", accent: "bg-indigo-50" },
    { key: "maintenance", label: "Maintenance", value: vc.maintenance, icon: Wrench, tone: "text-amber-600", accent: "bg-amber-50" },
    { key: "outOfService", label: "Out of Service", value: vc.outOfService, icon: XCircle, tone: "text-red-600", accent: "bg-red-50" },
  ];

  const totalElements = pagination?.totalElements ?? items.length;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <PageShell>
      {toastNode}

      <PageHeader title="Vehicles" subtitle="Your operational fleet" icon={Car}>
        {canCreate && (
          <Button className="w-full sm:w-auto mt-3 sm:mt-0" onClick={() => navigate("/fleet/vehicles/new")}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Vehicle
          </Button>
        )}
      </PageHeader>

      {stats && (
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <StatStrip items={kpi} />
        </div>
      )}

      <GlassCard className="mb-5">
        {/* Toolbar: search + owner + clear */}
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1 w-full min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by number, make, model…"
              className="pl-10 w-full"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 w-full lg:w-auto">
            <Select value={ownerF} onChange={(e) => { setOwnerF(e.target.value); setPage(0); }} className="flex-1 sm:flex-none min-w-[120px]">
              <option value="">All owners</option>
              {Object.entries(OWNER_TYPE).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="shrink-0">Clear</Button>
            )}
            <ViewToggle value={view} onChange={setView} className="shrink-0" />
          </div>
        </div>
        {/* Status chips */}
        <div className="border-t border-slate-100 px-4 py-3 overflow-x-auto scrollbar-hide">
          <ChipBar
            options={statusChips(VEHICLE_STATUS)}
            value={statusF}
            onChange={(val) => { setStatusF(val); setPage(0); }}
          />
        </div>
      </GlassCard>

      {/* Body */}
      {loading ? (
        <GlassCard><LoadingState label="Loading vehicles…" /></GlassCard>
      ) : items.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={Car}
            title={anyFilter ? "No vehicles match your filters" : "No vehicles yet"}
            hint={anyFilter ? "Try clearing the filters." : "Add your first vehicle to start the diary."}
            action={canCreate && !anyFilter && (
              <Button className="w-full sm:w-auto" onClick={() => navigate("/fleet/vehicles/new")}><Plus className="mr-1.5 h-4 w-4" /> Add Vehicle</Button>
            )}
          />
        </GlassCard>
      ) : (
        <>
          {view === "grid" ? (
            <CardGrid>
              {items.map((v) => (
                <VehicleCard
                  key={v.publicId}
                  v={v}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onView={() => navigate(`/fleet/vehicles/${v.publicId}`)}
                  onEdit={() => navigate(`/fleet/vehicles/${v.publicId}/edit`)}
                  onStatus={() => setStatusTarget(v)}
                  onDelete={() => setDeleteTarget(v)}
                />
              ))}
            </CardGrid>
          ) : (
            <GlassCard>
              <div className="w-full overflow-x-auto">
                <Table className="fleet-table min-w-[800px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((v) => {
                      const doc = soonestDoc(v);
                      const spec = [v.type, v.make, v.model].filter(Boolean).join(" · ");
                      return (
                        <TableRow key={v.publicId} className="cursor-pointer" onClick={() => navigate(`/fleet/vehicles/${v.publicId}`)}>
                          <TableCell>
                            <div className="font-bold text-slate-800">{v.vehicleNumber}</div>
                            {spec && <div className="text-xs text-slate-400">{spec}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-slate-600">{OWNER_TYPE[v.ownerType] || v.ownerType}</div>
                            {v.vendorName && <div className="text-xs text-slate-400">{v.vendorName}</div>}
                          </TableCell>
                          <TableCell>
                            {doc ? <Badge variant={doc.variant}>{doc.label}: {doc.text}</Badge> : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-sm">{fmtNumber(v.lastOdometer, " km")}</TableCell>
                          <TableCell><StatusBadge config={VEHICLE_STATUS} value={v.status} /></TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/fleet/vehicles/${v.publicId}`)}><Eye /></Button>
                              {canUpdate && (
                                <>
                                  <Button variant="ghost" size="icon" title="Change status" onClick={() => setStatusTarget(v)}><Settings2 /></Button>
                                  <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/fleet/vehicles/${v.publicId}/edit`)}><Pencil /></Button>
                                </>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="icon" title="Delete"
                                  className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(v)}><Trash2 /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          )}

          <div className="mt-5 w-full overflow-x-auto pb-4">
            <CommonPagination
              pageIndex={pagination?.page ?? 0}
              pageSize={pagination?.size ?? size}
              totalElements={totalElements}
              totalPages={totalPages}
              goToPage={(p) => setPage(p)}
              changePageSize={(s) => { setSize(s); setPage(0); }}
            />
          </div>
        </>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Move vehicle to Trash?"
        description={deleteTarget ? `“${deleteTarget.vehicleNumber}” will be moved to Trash. Vehicles with diary history can't be deleted — retire them via Out of Service instead.` : ""}
        confirmLabel="Move to Trash"
        busy={busy}
        onConfirm={confirmDelete}
      />

      {/* Status change */}
      <VehicleStatusDialog
        vehicle={statusTarget}
        onClose={() => setStatusTarget(null)}
        onDone={refetch}
        showToast={showToast}
      />
    </PageShell>
  );
}

/* ── Vehicle card ── */
function Meta({ label, value }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function VehicleCard({ v, canUpdate, canDelete, onView, onEdit, onStatus, onDelete }) {
  const doc = soonestDoc(v);
  const spec = [v.type, v.make, v.model].filter(Boolean).join(" · ");
  const Icon = vehicleIcon(v.type);
  const grad = VEHICLE_GRADIENT[v.status] || "from-slate-500 to-slate-700";
  const statusLabel = VEHICLE_STATUS[v.status]?.label || v.status;
  
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg w-full">
      {/* colourful status header */}
      <button onClick={onView} className={cn("relative flex items-center gap-3 bg-gradient-to-br p-4 sm:p-5 text-left text-white shadow-lg", grad)}>
        <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <p className="truncate font-extrabold text-base sm:text-lg">{v.vehicleNumber}</p>
          <p className="truncate text-xs text-white/80">{spec || "—"}</p>
        </div>
        <span className="relative z-10 shrink-0 inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold">
          {statusLabel}
        </span>
      </button>

      {/* body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex gap-2 w-full min-w-0">
          <Meta label="Owner" value={OWNER_TYPE[v.ownerType] || v.ownerType || "—"} />
          <Meta label="Odometer" value={fmtNumber(v.lastOdometer, " km")} />
        </div>
        {v.vendorName && <p className="mt-2 truncate text-xs text-slate-400">Vendor: {v.vendorName}</p>}

        {/* Footer actions - Stacks buttons below badge on extra-small screens */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-y-3 gap-x-2 border-t border-slate-100 pt-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            {doc ? (
              <Badge variant={doc.variant} className="truncate block max-w-full w-fit">
                {doc.label}: {doc.text}
              </Badge>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Docs OK
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-end gap-1 w-full sm:w-auto shrink-0">
            <Button variant="ghost" size="icon" title="View" onClick={onView}><Eye className="h-4 w-4" /></Button>
            {canUpdate && (
              <>
                <Button variant="ghost" size="icon" title="Change status" onClick={onStatus}><Settings2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
              </>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" title="Delete"
                className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── EXPORTED Vehicle status change dialog (shared with the detail page) ── */
export function VehicleStatusDialog({ vehicle, onClose, onDone, showToast }) {
  const [status, setStatus] = useState("AVAILABLE");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (vehicle) setStatus(MANUAL_STATUSES.includes(vehicle.status) ? vehicle.status : "AVAILABLE");
  }, [vehicle]);

  const save = async () => {
    setBusy(true);
    try {
      await fleetService.changeVehicleStatus(vehicle.publicId, status);
      showToast("Vehicle status updated.");
      onClose();
      await onDone();
    } catch (e) {
      showToast(errMsg(e, "Couldn't update status."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full mx-auto" onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Label required>Status for {vehicle?.vehicleNumber}</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full mt-1">
            {MANUAL_STATUSES.map((s) => (
              <option key={s} value={s}>{VEHICLE_STATUS[s].label}</option>
            ))}
          </Select>
          <p className="mt-2 text-xs text-slate-400">
            “On Trip” is managed automatically by the trip lifecycle and can't be set here.
          </p>
        </DialogBody>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
          <Button variant="outline" className="w-full sm:w-auto flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="w-full sm:w-auto flex-1" onClick={save} disabled={busy}>{busy ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}