// src/fleet/FleetDrivers.jsx
// Driver list — modern card grid with a KPI strip + chip status filters.
// Server-paginated, searchable, with status change + delete.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IdCard, Plus, Search, Pencil, Trash2, Settings2, Phone, Route as RouteIcon,
  CheckCircle2, UserX,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import CommonPagination from "../components/CommanPegination";
import {
  Button, Input, Select, Label, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  PageShell, PageHeader, GlassCard, LoadingState, EmptyState, ConfirmDialog,
  StatCard, StatCardRow, ChipBar, statusChips, CardGrid, ViewToggle, useViewMode, cn,
  useToast, errMsg, StatusBadge, DRIVER_STATUS, expiryInfo,
} from "../components/fleetUi";

/** First-letters avatar for a driver name. */
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

/** Status gradients — same depth/tones as the dashboard StatCards. */
const DRIVER_GRADIENT = {
  ACTIVE: "from-green-500 to-emerald-700",
  INACTIVE: "from-slate-500 to-slate-700",
};

export default function FleetDrivers() {
  const navigate = useNavigate();
  const { showToast, toastNode } = useToast();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusF, setStatusF] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(12);
  const [view, setView] = useViewMode("drivers", "grid");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission(P.FLEET_CREATE);
  const canUpdate = hasPermission(P.FLEET_UPDATE);
  const canDelete = hasPermission(P.FLEET_DELETE);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => fleetService.listDrivers({ status: statusF, search: debounced, page, size });
  const loadStats = () => fleetService.getDashboard().then((d) => setStats(d)).catch(() => {});

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .then((res) => { if (alive) { setItems(res.items); setPagination(res.pagination); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load drivers."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusF, debounced, page, size, showToast]);

  const refetch = async () => {
    const res = await load();
    setItems(res.items); setPagination(res.pagination);
    loadStats();
  };

  const anyFilter = search || statusF;
  const resetFilters = () => { setSearch(""); setStatusF(""); setPage(0); };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await fleetService.deleteDriver(deleteTarget.publicId);
      showToast(`${deleteTarget.name} moved to Trash.`);
      setDeleteTarget(null);
      await refetch();
    } catch (e) {
      showToast(errMsg(e, "Failed to delete driver."), "error");
    } finally {
      setBusy(false);
    }
  };

  const dc = stats?.drivers ?? {};
  const inactive = dc.total != null && dc.active != null ? dc.total - dc.active : undefined;
  // Gradient KPI cards, matching Bookings — same colour vocabulary across the app: blue = volume,
  // green = healthy, indigo = in motion, slate = derived/idle.
  const kpi = [
    { key: "total", label: "Total", value: dc.total, icon: <IdCard />, tone: "blue" },
    { key: "active", label: "Active", value: dc.active, icon: <CheckCircle2 />, tone: "green" },
    { key: "onTrip", label: "On Trip", value: dc.onTrip, icon: <RouteIcon />, tone: "indigo" },
    { key: "inactive", label: "Inactive", value: inactive, icon: <UserX />, tone: "slate" },
  ];

  /** Clicking a driver opens their detail page — profile, licence, trips and cash position. */
  const openDriver = (d) => navigate(`/fleet/drivers/${d.publicId}`);

  return (
    <PageShell>
      {toastNode}

      <PageHeader title="Drivers" subtitle="Your roster of drivers" icon={IdCard}>
        {canCreate && (
          <Button onClick={() => navigate("/fleet/drivers/new")}><Plus /> Add Driver</Button>
        )}
      </PageHeader>

      {stats && (
        <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
          {kpi.map((k) => <StatCard key={k.key} {...k} />)}
        </StatCardRow>
      )}

      <GlassCard className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by name, phone, licence…"
              className="pl-10"
            />
          </div>
          {anyFilter && <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>}
          <ViewToggle value={view} onChange={setView} className="sm:ml-auto" />
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <ChipBar
            options={statusChips(DRIVER_STATUS)}
            value={statusF}
            onChange={(val) => { setStatusF(val); setPage(0); }}
          />
        </div>
      </GlassCard>

      {loading ? (
        <GlassCard><LoadingState label="Loading drivers…" /></GlassCard>
      ) : items.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={IdCard}
            title={anyFilter ? "No drivers match your filters" : "No drivers yet"}
            hint={anyFilter ? "Try clearing the filters." : "Add your first driver."}
            action={canCreate && !anyFilter && (
              <Button onClick={() => navigate("/fleet/drivers/new")}><Plus /> Add Driver</Button>
            )}
          />
        </GlassCard>
      ) : (
        <>
          {view === "grid" ? (
            <CardGrid>
              {items.map((d) => (
                <DriverCard
                  key={d.publicId}
                  d={d}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onOpen={() => openDriver(d)}
                  onEdit={() => navigate(`/fleet/drivers/${d.publicId}/edit`)}
                  onStatus={() => setStatusTarget(d)}
                  onDelete={() => setDeleteTarget(d)}
                />
              ))}
            </CardGrid>
          ) : (
            <GlassCard>
              <Table className="fleet-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Driver</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => {
                    const lic = d.licenseExpiry ? expiryInfo(d.licenseExpiry) : null;
                    return (
                      <TableRow key={d.publicId} className="cursor-pointer"
                                onClick={() => openDriver(d)}>
                        <TableCell>
                          <div className="font-bold text-slate-800">{d.name}</div>
                          {d.licenseNumber && <div className="text-xs text-slate-400">{d.licenseNumber}</div>}
                        </TableCell>
                        <TableCell>
                          {d.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <Phone className="h-3.5 w-3.5 text-slate-400" /> {d.phone}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {lic ? <Badge variant={lic.variant}>{lic.text}</Badge> : <span className="text-xs text-slate-300">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge config={DRIVER_STATUS} value={d.status} />
                            {d.onTrip && <Badge variant="blue">On trip</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* Row navigates; the action cell must not, or Delete both opens the
                              dialog and leaves the page under it. */}
                          <div className="flex items-center justify-end gap-0.5"
                               onClick={(e) => e.stopPropagation()}>
                            {canUpdate && (
                              <>
                                <Button variant="ghost" size="icon" title="Change status" onClick={() => setStatusTarget(d)}><Settings2 /></Button>
                                <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/fleet/drivers/${d.publicId}/edit`)}><Pencil /></Button>
                              </>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" title="Delete"
                                className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(d)}><Trash2 /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </GlassCard>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Move driver to Trash?"
        description={deleteTarget ? `“${deleteTarget.name}” will be moved to Trash. Drivers with trip history can't be deleted — set them Inactive instead.` : ""}
        confirmLabel="Move to Trash"
        busy={busy}
        onConfirm={confirmDelete}
      />

      <DriverStatusDialog
        driver={statusTarget}
        onClose={() => setStatusTarget(null)}
        onDone={refetch}
        showToast={showToast}
      />
    </PageShell>
  );
}

/* ── Driver card ── */
function DriverCard({ d, canUpdate, canDelete, onOpen, onEdit, onStatus, onDelete }) {
  const lic = d.licenseExpiry ? expiryInfo(d.licenseExpiry) : null;
  const grad = DRIVER_GRADIENT[d.status] || "from-indigo-500 to-violet-600";
  const statusLabel = DRIVER_STATUS[d.status]?.label || d.status;
  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      {/* colourful status header — mirrors the dashboard StatCard */}
      <div className={cn("relative flex items-center gap-3 bg-gradient-to-br p-5 text-white shadow-lg", grad)}>
        <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-extrabold">
          {initials(d.name)}
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <p className="truncate font-extrabold">{d.name}</p>
          {d.licenseNumber && <p className="truncate text-xs text-white/80">{d.licenseNumber}</p>}
        </div>
        <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
          <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">{statusLabel}</span>
          {d.onTrip && <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">On trip</span>}
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2 text-slate-600">
            <Phone className="h-3.5 w-3.5 text-slate-400" /> {d.phone || "—"}
          </p>
          <p className="flex items-center gap-2 text-slate-600">
            <IdCard className="h-3.5 w-3.5 text-slate-400" />
            {lic ? <Badge variant={lic.variant}>Licence: {lic.text}</Badge> : <span className="text-slate-400">No licence date</span>}
          </p>
        </div>

        {/* stopPropagation on the whole action row: the card itself opens the detail page, and
            without this a Delete click would fire BOTH the dialog and the navigation. */}
        <div
          className="mt-auto flex items-center justify-end gap-0.5 border-t border-slate-100 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {canUpdate && (
            <>
              <Button variant="ghost" size="icon" title="Change status" onClick={onStatus}><Settings2 /></Button>
              <Button variant="ghost" size="icon" title="Edit" onClick={onEdit}><Pencil /></Button>
            </>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" title="Delete"
              className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={onDelete}><Trash2 /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverStatusDialog({ driver, onClose, onDone, showToast }) {
  const [status, setStatus] = useState("ACTIVE");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (driver) setStatus(driver.status || "ACTIVE"); }, [driver]);

  const save = async () => {
    setBusy(true);
    try {
      await fleetService.changeDriverStatus(driver.publicId, status);
      showToast("Driver status updated.");
      onClose();
      await onDone();
    } catch (e) {
      showToast(errMsg(e, "Couldn't update status."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" onClose={onClose}>
        <DialogHeader><DialogTitle>Change status</DialogTitle></DialogHeader>
        <DialogBody>
          <Label required>Status for {driver?.name}</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(DRIVER_STATUS).map(([k, c]) => (
              <option key={k} value={k}>{c.label}</option>
            ))}
          </Select>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}