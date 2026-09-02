// src/console/pages/PlatformVehicles.jsx
//
// The platform's own transport catalog — the supply side of the Transport Marketplace, and the only
// place vehicles enter it. Nothing a tenant can browse exists until a row here is published.
//
// Sibling of PlatformHotels, and now built from the same kit: card/table shell, `ViewToggle`, chip
// filter and `Pager`. What a card shows is what a catalog operator needs at a glance — publish state,
// where the driver reports from, how many it seats, and how many agencies have taken a copy.
//
// The editor moved to its own route (PlatformVehicleEditor). It was a `max-w-xl` drawer, which showed
// a fraction of a form that carries identity, capacity, coverage, presentation and a rate table.
//
// Paging, search and the status filter are SERVER-side; search is debounced rather than submitted, so
// the list narrows as the operator types.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Eye, EyeOff, MapPin, Plus, Search, Trash2, Users } from "lucide-react";
import {
  PageShell, PageHeader, GlassCard, HotelStyles,
  Input, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  EmptyState, SkeletonCards, Pager, ChipBar, ViewToggle, useViewMode,
  useToast, cn,
} from "../components/hotelUi";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { transportAdminService as svc } from "../api/transportAdminService";

const PAGE_SIZE = 12;

const STATUS_CHIPS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Published" },
  { value: "INACTIVE", label: "Unpublished" },
  { value: "SUSPENDED", label: "Suspended" },
];

const STATUS_TONE = {
  ACTIVE: "bg-hue-emerald-soft text-hue-emerald",
  DRAFT: "bg-hue-amber-soft text-hue-amber",
  INACTIVE: "bg-surface-hover text-muted",
  SUSPENDED: "bg-hue-rose-soft text-hue-rose",
};

export default function PlatformVehicles() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useViewMode("platform-vehicles", "grid");

  // Debounced so typing does not fire a request per keystroke; resets to page 0 because a filtered
  // result set has no page 3 to stay on.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    let alive = true;
    setRows(null);
    svc
      .listVehicles({ page, size: PAGE_SIZE, q: debouncedQ || undefined, status: status || undefined })
      .then(({ rows: data, pagination: meta }) => {
        if (!alive) return;
        setRows(data);
        setPagination(meta);
      })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        showToast(e?.normalized?.message ?? "Could not load the vehicle catalog.", "error");
      });
    return () => { alive = false; };
  }, [page, status, debouncedQ, showToast]);

  useEffect(load, [load]);

  /* Publish, unpublish and delete each carry `@RequireSuperAdminStepUp` server-side: the first two
     change what every agency on the platform can buy, and the third is irreversible. The code is
     collected by the modal and threaded through — passing none looked fine locally only because
     `app.super-admin.dev-login.enabled=true` short-circuits the check, and was a 403 in production. */
  const [pending, setPending] = useState(null); // {kind:"publish"|"delete", row}
  const [busy, setBusy] = useState(false);

  /** Publish/unpublish is its own verb, never a save side effect — it is what makes a row sellable. */
  async function togglePublish(row, mfaCode) {
    try {
      if (row.status === "ACTIVE") await svc.unpublishVehicle(row.publicId, mfaCode);
      else await svc.publishVehicle(row.publicId, mfaCode);
      load();
    } catch (e) {
      showToast(e?.normalized?.message ?? "Could not change that vehicle's status.", "error");
    }
  }

  /** Refuses server-side while any tenant holds a projection — that refusal is the safety, not this. */
  async function remove(row, mfaCode) {
    try {
      await svc.deleteVehicle(row.publicId, mfaCode);
      load();
    } catch (e) {
      showToast(e?.normalized?.message ?? "Could not delete that vehicle.", "error");
    }
  }

  async function runPending(mfaCode) {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "delete") await remove(pending.row, mfaCode);
      else await togglePublish(pending.row, mfaCode);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const pagerProps = useMemo(() => {
    const total = pagination?.totalElements ?? (rows?.length ?? 0);
    const totalPages = pagination?.totalPages ?? 1;
    const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const to = Math.min(total, (page + 1) * PAGE_SIZE);
    return { page, totalPages, total, from, to };
  }, [pagination, page, rows]);

  /* A row opens the READ view, not the form. Landing straight in an editor put the only way to look
     at a listing behind the only way to change it — an operator checking what a coach seats had a
     live form under the cursor. Edit is a click taken from the detail page. */
  const openDetail = (row) => navigate(`/console/transport-catalog/${row.publicId}`);

  return (
    <PageShell>
      <HotelStyles />
      <PageHeader
        title="Transport Catalog"
        subtitle="Vehicles the platform sells to every agency"
        icon={Car}
      >
        <Button size="sm" onClick={() => navigate("/console/transport-catalog/new")}>
          <Plus className="h-4 w-4" /> Add Vehicle
        </Button>
      </PageHeader>

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, type or city…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <ChipBar
              options={STATUS_CHIPS}
              value={status}
              onChange={(v) => { setStatus(v); setPage(0); }}
            />
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </GlassCard>

      {rows === null ? (
        <SkeletonCards count={6} />
      ) : rows.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={Car}
            title="No vehicles in the catalog"
            hint={q || status ? "Try a different search or filter." : "Add one, then publish it — agencies see nothing until you do."}
            action={!q && !status ? <Button size="sm" onClick={() => navigate("/console/transport-catalog/new")}><Plus className="h-4 w-4" /> Add Vehicle</Button> : null}
          />
        </GlassCard>
      ) : view === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((v) => (
              <VehicleCard
                key={v.publicId}
                vehicle={v}
                onOpen={() => openDetail(v)}
                onTogglePublish={() => setPending({ kind: "publish", row: v })}
                onRemove={() => setPending({ kind: "delete", row: v })}
              />
            ))}
          </div>
          <div className="mt-4"><Pager {...pagerProps} onPage={setPage} /></div>
        </>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Reports from</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Held by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.publicId} className="cursor-pointer" onClick={() => openDetail(v)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {v.primaryImageUrl ? (
                        <img src={v.primaryImageUrl} alt="" className="h-10 w-14 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-surface-hover">
                          <Car className="h-4 w-4 text-muted" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-body">{v.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{typeLine(v)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-body">{placeLine(v) || "—"}</span>
                  </TableCell>
                  <TableCell>{v.passengerCapacity ?? "—"}</TableCell>
                  <TableCell>{heldBy(v)}</TableCell>
                  <TableCell><VehicleStatusBadge value={v.status} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <PublishButton row={v} onClick={() => setPending({ kind: "publish", row: v })} />
                      <DeleteButton onClick={() => setPending({ kind: "delete", row: v })} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager {...pagerProps} onPage={setPage} />
        </GlassCard>
      )}

      {pending && (
        <SuperAdminMfaActionModal
          title={
            pending.kind === "delete"
              ? "Confirm vehicle deletion"
              : pending.row.status === "ACTIVE" ? "Confirm unpublish" : "Confirm publish"
          }
          description={
            pending.kind === "delete"
              ? `This permanently removes ${pending.row.name} from the catalog. It is refused while any agency still holds a copy.`
              : pending.row.status === "ACTIVE"
                ? `This withdraws ${pending.row.name} from sale. Orders already placed and copies already imported are untouched.`
                : `This puts ${pending.row.name} on sale to every agency on the platform.`
          }
          confirmLabel={
            pending.kind === "delete"
              ? "Delete vehicle"
              : pending.row.status === "ACTIVE" ? "Unpublish" : "Publish"
          }
          saving={busy}
          onClose={busy ? undefined : () => setPending(null)}
          onConfirm={runPending}
        />
      )}
    </PageShell>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

const typeLine = (v) =>
  [
    String(v.vehicleType ?? "").replace(/_/g, " "),
    v.passengerCapacity ? `${v.passengerCapacity} pax` : null,
    v.airConditioned ? "AC" : null,
  ]
    .filter(Boolean)
    .join(" · ");

const placeLine = (v) => [v.cityName, v.stateName, v.countryCode].filter(Boolean).join(", ");

const heldBy = (v) => {
  const n = v.linkedTenantCount ?? 0;
  return `${n} agenc${n === 1 ? "y" : "ies"}`;
};

/** The catalog has its own statuses, so it does not reuse the kit's HOTEL_STATUS map. */
export function VehicleStatusBadge({ value }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_TONE[value] ?? STATUS_TONE.INACTIVE)}>
      {value ?? "—"}
    </span>
  );
}

function PublishButton({ row, onClick }) {
  const published = row.status === "ACTIVE";
  return (
    <button
      onClick={onClick}
      title={published ? "Unpublish — blocks new sale, breaks nothing sold" : "Publish — agencies can see and request it"}
      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-body transition hover:bg-surface-hover"
    >
      {published ? <EyeOff size={13} /> : <Eye size={13} />}
    </button>
  );
}

function DeleteButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Delete — refused while any agency holds a copy"
      className="rounded-lg border border-hue-rose/25 px-2 py-1 text-xs font-semibold text-hue-rose transition hover:bg-hue-rose-soft"
    >
      <Trash2 size={13} />
    </button>
  );
}

function VehicleCard({ vehicle: v, onOpen, onTogglePublish, onRemove }) {
  return (
    <GlassCard className="group overflow-hidden transition-all hover:shadow-md hfade-up">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative overflow-hidden">
          {v.primaryImageUrl ? (
            <img
              src={v.primaryImageUrl}
              alt={v.name}
              loading="lazy"
              className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-surface-hover">
              <Car className="h-8 w-8 text-border-strong" />
            </div>
          )}
          <div className="absolute left-3 top-3"><VehicleStatusBadge value={v.status} /></div>
          {/* Where a hotel card carries a star rating, a vehicle carries what it IS — the type and
              whether it is air conditioned are the two things an operator scans for. */}
          <div className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-body backdrop-blur">
            {String(v.vehicleType ?? "").replace(/_/g, " ")}{v.airConditioned ? " · AC" : ""}
          </div>
        </div>
        <div className="p-4">
          <h3 className="mb-1 truncate font-extrabold text-heading">{v.name}</h3>
          <p className="mb-3 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {placeLine(v) || "Reporting city not set"}
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Metric icon={Users} label="Seats" value={v.passengerCapacity ?? "—"} />
            <Metric icon={Car} label="Held by" value={v.linkedTenantCount ?? 0} />
          </div>
        </div>
      </button>

      {/* Outside the card button: nesting a button inside a button is invalid, and these two are
          destructive enough that they must never be hit while aiming for "open". */}
      <div className="flex items-center justify-end gap-1.5 border-t border-surface-hover px-4 py-2.5">
        <PublishButton row={v} onClick={onTogglePublish} />
        <DeleteButton onClick={onRemove} />
      </div>
    </GlassCard>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-surface-hover py-2">
      <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-body">
        {Icon && <Icon className="h-3.5 w-3.5 text-focus" />}{value}
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
