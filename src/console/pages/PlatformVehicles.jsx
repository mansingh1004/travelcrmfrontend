// src/console/pages/PlatformVehicles.jsx
//
// The platform's own transport catalog — the supply side of the Transport Marketplace, and the only
// place vehicles enter it. Nothing a tenant can browse exists until a row here is published.
//
// Sibling of PlatformHotels. Same realm, same shape: a list, an editor, and a publish switch that is
// deliberately separate from saving. Creating mints a DRAFT; publishing is the act that makes a
// product sellable, so it is never a side effect of typing.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Eye, EyeOff, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { transportAdminService as svc } from "../api/transportAdminService";
import { ConsolePageHeader, ConsolePanel } from "../components/ConsoleUi";
import { ConsoleTable, ConsolePager } from "../components/ConsoleTable";

const PAGE_SIZE = 20;

/** Mirrors `TransportVehicleType` loosely — the field is a free string server-side, so this is a
    convenience list rather than a constraint. An operator can still type something new. */
const VEHICLE_TYPES = [
  "SEDAN", "HATCHBACK", "SUV", "MUV", "TEMPO_TRAVELLER", "MINI_BUS", "BUS", "COACH", "LUXURY",
];

const STATUS_TONE = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-amber-50 text-amber-800",
  INACTIVE: "bg-slate-100 text-slate-600",
  SUSPENDED: "bg-red-50 text-red-700",
};

const EMPTY = {
  name: "",
  vehicleType: "SEDAN",
  passengerCapacity: "",
  luggageCapacity: "",
  airConditioned: true,
  description: "",
  primaryImageUrl: "",
  amenities: "",
  countryCode: "IN",
  stateName: "",
  cityName: "",
  cityCode: "",
  coverageNote: "",
  supplierVendorPublicId: "",
};

export default function PlatformVehicles() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(0);
  // The list endpoint takes q + status; without them a catalog of any size is unusable and a DRAFT
  // nobody published is invisible among the live rows.
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null); // { publicId? } | null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Rate cards are loaded with the vehicle rather than with the list: they are only ever shown in
  // the editor, and a list of twenty vehicles would otherwise drag every rate row with it.
  const [rates, setRates] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { rows: data, pagination: meta } = await svc.listVehicles({
        page, size: PAGE_SIZE, q: query || undefined, status: statusFilter || undefined,
      });
      setRows(data);
      setPagination(meta);
    } catch (e) {
      setError(e?.normalized?.message ?? "Could not load the vehicle catalog.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setForm(EMPTY);
    setRates([]);
    setFormError("");
    setEditing({});
  }

  async function startEdit(row) {
    setFormError("");
    setEditing({ publicId: row.publicId });
    // The list row is enough to open on, so the drawer never blanks; the full read then fills in the
    // rates the list does not carry.
    let full = row;
    try {
      full = (await svc.getVehicle(row.publicId)) ?? row;
    } catch {
      // Keep the row we have. Rates simply stay empty rather than the editor refusing to open.
    }
    setRates(full.rates ?? []);
    setForm({
      ...EMPTY,
      ...full,
      passengerCapacity: full.passengerCapacity ?? "",
      luggageCapacity: full.luggageCapacity ?? "",
      supplierVendorPublicId: full.supplierVendorPublicId ?? "",
      // The wire carries a list; the editor is one comma-separated box, because a chip editor for
      // six words is more machinery than the job needs.
      amenities: Array.isArray(full.amenities) ? full.amenities.join(", ") : "",
    });
  }

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        vehicleType: form.vehicleType,
        passengerCapacity: form.passengerCapacity === "" ? null : Number(form.passengerCapacity),
        luggageCapacity: form.luggageCapacity === "" ? null : Number(form.luggageCapacity),
        airConditioned: !!form.airConditioned,
        description: form.description?.trim() || null,
        primaryImageUrl: form.primaryImageUrl?.trim() || null,
        amenities: form.amenities
          ? form.amenities.split(",").map((a) => a.trim()).filter(Boolean)
          : [],
        countryCode: form.countryCode?.trim() || null,
        stateName: form.stateName?.trim() || null,
        cityName: form.cityName?.trim() || null,
        cityCode: form.cityCode?.trim() || null,
        coverageNote: form.coverageNote?.trim() || null,
        supplierVendorPublicId: form.supplierVendorPublicId?.trim() || null,
      };
      if (editing.publicId) await svc.updateVehicle(editing.publicId, payload);
      else await svc.createVehicle(payload);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e?.normalized?.message ?? "Could not save that vehicle.");
    } finally {
      setSaving(false);
    }
  }

  /** Publish/unpublish is its own verb, never a save side effect — it is what makes a row sellable. */
  async function togglePublish(row) {
    try {
      if (row.status === "ACTIVE") await svc.unpublishVehicle(row.publicId);
      else await svc.publishVehicle(row.publicId);
      await load();
    } catch (e) {
      setError(e?.normalized?.message ?? "Could not change that vehicle's status.");
    }
  }

  /** Refuses server-side while any tenant holds a projection — that refusal is the safety, not this. */
  async function remove(row) {
    try {
      await svc.deleteVehicle(row.publicId);
      await load();
    } catch (e) {
      setError(e?.normalized?.message ?? "Could not delete that vehicle.");
    }
  }

  const columns = useMemo(
    () => [
      {
        id: "vehicle",
        header: "Vehicle",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-semibold text-heading">{row.original.name}</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {String(row.original.vehicleType ?? "").replace(/_/g, " ")}
              {row.original.passengerCapacity ? ` · ${row.original.passengerCapacity} pax` : ""}
              {row.original.airConditioned ? " · AC" : ""}
            </div>
          </div>
        ),
      },
      {
        id: "where",
        header: "Reports from",
        accessorKey: "cityName",
        cell: ({ row }) => (
          <div className="min-w-0 text-body">
            {[row.original.cityName, row.original.stateName, row.original.countryCode]
              .filter(Boolean)
              .join(", ") || "—"}
          </div>
        ),
      },
      {
        id: "held",
        header: "Held by",
        accessorKey: "linkedTenantCount",
        cell: ({ row }) => (
          <div className="whitespace-nowrap tabular-nums text-body">
            {row.original.linkedTenantCount ?? 0} agenc{(row.original.linkedTenantCount ?? 0) === 1 ? "y" : "ies"}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              STATUS_TONE[row.original.status] ?? STATUS_TONE.INACTIVE
            }`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => togglePublish(row.original)}
              title={row.original.status === "ACTIVE" ? "Unpublish — blocks new sale, breaks nothing sold" : "Publish — tenants can see and request it"}
              className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-body hover:bg-page"
            >
              {row.original.status === "ACTIVE" ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              onClick={() => remove(row.original)}
              title="Delete — refused while any agency holds a copy"
              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Transport marketplace"
        title="Platform vehicles"
        description="The catalog agencies browse. Creating a vehicle mints a draft; publishing is what makes it sellable."
        actions={
          <div className="flex gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus size={14} /> Add a vehicle
            </button>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(term.trim()); }}
          className="flex items-center gap-2"
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, type or city"
            className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
          />
          <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page">
            Search
          </button>
        </form>
        <div className="flex gap-1.5">
          {[["", "All"], ["DRAFT", "Draft"], ["ACTIVE", "Published"], ["INACTIVE", "Unpublished"], ["SUSPENDED", "Suspended"]].map(
            ([value, label]) => (
              <button
                key={value || "all"}
                onClick={() => { setStatusFilter(value); setPage(0); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  statusFilter === value ? "bg-accent text-white" : "border border-border text-body hover:bg-page"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      <ConsolePanel>
        <ConsoleTable
          columns={columns}
          rows={rows}
          state={loading ? "loading" : "ready"}
          onRowClick={startEdit}
          emptyTitle="No vehicles in the catalog"
          emptyHint="Add one, then publish it — agencies see nothing until you do."
        />
        <ConsolePager page={page} size={PAGE_SIZE} total={pagination.totalElements || 0} onPage={setPage} />
      </ConsolePanel>

      {editing && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setEditing(null)} />
          <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
              <h2 className="text-lg font-bold text-heading">
                {editing.publicId ? "Edit vehicle" : "New vehicle"}
              </h2>
              <button onClick={() => setEditing(null)} className="text-muted hover:text-body">
                <X size={18} />
              </button>
            </header>

            <div className="space-y-4 px-6 py-5">
              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {formError}
                </p>
              )}

              <F label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted">Type</span>
                  <select
                    value={form.vehicleType}
                    onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-1.5 text-sm text-body">
                  <input
                    type="checkbox"
                    checked={!!form.airConditioned}
                    onChange={(e) => setForm((f) => ({ ...f, airConditioned: e.target.checked }))}
                  />
                  Air conditioned
                </label>
                <F label="Passengers" type="number" value={form.passengerCapacity} onChange={(v) => setForm((f) => ({ ...f, passengerCapacity: v }))} />
                <F label="Luggage pieces" type="number" value={form.luggageCapacity} onChange={(v) => setForm((f) => ({ ...f, luggageCapacity: v }))} />
              </div>

              {/* Where the driver REPORTS FROM. It is also what a tenant's import resolves against —
                  and transport deliberately refuses to invent a city they do not have, so a wrong
                  value here turns into a 409 on their side rather than a silently wrong master row. */}
              <div className="grid gap-3 sm:grid-cols-3">
                <F label="City" value={form.cityName} onChange={(v) => setForm((f) => ({ ...f, cityName: v }))} />
                <F label="State" value={form.stateName} onChange={(v) => setForm((f) => ({ ...f, stateName: v }))} />
                <F label="Country code" value={form.countryCode} onChange={(v) => setForm((f) => ({ ...f, countryCode: v }))} />
              </div>

              <F label="Coverage note" value={form.coverageNote} onChange={(v) => setForm((f) => ({ ...f, coverageNote: v }))} />
              <F label="Amenities" value={form.amenities} onChange={(v) => setForm((f) => ({ ...f, amenities: v }))} hint="Comma separated — water, charger, child seat" />
              <F label="Image URL" value={form.primaryImageUrl} onChange={(v) => setForm((f) => ({ ...f, primaryImageUrl: v }))} />

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-muted">Description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
                />
              </label>

              <F
                label="Supplier vendor publicId"
                value={form.supplierVendorPublicId}
                onChange={(v) => setForm((f) => ({ ...f, supplierVendorPublicId: v }))}
                hint="Optional. Ties the listing to the operator it belongs to."
              />

              {/* Rates hang off a product publicId, so there is nothing to attach them to until the
                  vehicle has been created once. */}
              {editing.publicId && (
                <RateCards
                  vehiclePublicId={editing.publicId}
                  rates={rates}
                  onChanged={async () => {
                    const full = await svc.getVehicle(editing.publicId);
                    setRates(full?.rates ?? []);
                  }}
                />
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !form.name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Car size={14} /> {saving ? "Saving…" : editing.publicId ? "Save" : "Create as draft"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function F({ label, value, onChange, type = "text", hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rate cards.

   DISPLAY-ONLY by design: they drive no pricing in v1. They exist so the person approving an order
   can see what the platform actually contracted while typing the approval figure — without them the
   approver is guessing, which is how a margin quietly goes negative.

   `netRate` is the platform's cost and must NEVER reach a tenant. It is safe here because this file
   is console-only; nothing in `features/` may import this component or the service behind it.

   Only reachable once the vehicle exists — a rate hangs off a product publicId, so the section is
   hidden while creating and appears after the first save.
   ═══════════════════════════════════════════════════════════════════════════ */

const RATE_MODELS = [
  "FLAT_PER_TRANSFER", "FLAT_PER_VEHICLE", "PER_KILOMETRE", "PER_DAY", "PER_HOUR",
  "PACKAGE", "ROUTE_FIXED", "CUSTOM_QUOTE",
];

const RATE_SERVICE_TYPES = [
  "AIRPORT_TRANSFER", "RAILWAY_TRANSFER", "POINT_TO_POINT", "LOCAL_PACKAGE",
  "OUTSTATION_ONE_WAY", "OUTSTATION_ROUND_TRIP", "MULTI_DAY_TOUR", "HOURLY_RENTAL", "CUSTOM",
];

const EMPTY_RATE = {
  serviceType: "POINT_TO_POINT",
  rateModel: "FLAT_PER_TRANSFER",
  netRate: "",
  currency: "INR",
  rateCode: "",
  includedKm: "",
  includedHours: "",
  extraKmRate: "",
  extraHourRate: "",
  driverAllowance: "",
  nightHalt: "",
  inclusionsText: "",
  active: true,
};

function RateCards({ vehiclePublicId, rates, onChanged }) {
  const [draft, setDraft] = useState(EMPTY_RATE);
  const [editingRate, setEditingRate] = useState(null); // publicId | null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

  function loadForEdit(r) {
    setDraft({
      ...EMPTY_RATE,
      ...r,
      netRate: r.netRate ?? "",
      includedKm: r.includedKm ?? "",
      includedHours: r.includedHours ?? "",
      extraKmRate: r.extraKmRate ?? "",
      extraHourRate: r.extraHourRate ?? "",
      driverAllowance: r.driverAllowance ?? "",
      nightHalt: r.nightHalt ?? "",
      inclusionsText: r.inclusionsText ?? "",
    });
    setEditingRate(r.publicId);
    setOpen(true);
  }

  function reset() {
    setDraft(EMPTY_RATE);
    setEditingRate(null);
    setErr("");
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const payload = {
        serviceType: draft.serviceType,
        rateModel: draft.rateModel,
        netRate: num(draft.netRate),
        currency: draft.currency || "INR",
        rateCode: draft.rateCode?.trim() || null,
        includedKm: num(draft.includedKm),
        includedHours: num(draft.includedHours),
        extraKmRate: num(draft.extraKmRate),
        extraHourRate: num(draft.extraHourRate),
        driverAllowance: num(draft.driverAllowance),
        nightHalt: num(draft.nightHalt),
        inclusionsText: draft.inclusionsText?.trim() || null,
        active: !!draft.active,
      };
      if (editingRate) await svc.updateRate(vehiclePublicId, editingRate, payload);
      else await svc.addRate(vehiclePublicId, payload);
      reset();
      setOpen(false);
      await onChanged();
    } catch (e) {
      setErr(e?.normalized?.message ?? "Could not save that rate.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r) {
    setBusy(true);
    setErr("");
    try {
      await svc.deleteRate(vehiclePublicId, r.publicId);
      if (editingRate === r.publicId) reset();
      await onChanged();
    } catch (e) {
      setErr(e?.normalized?.message ?? "Could not delete that rate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-heading">Contracted rates</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            What the platform pays the operator. Shown to whoever approves an order so the figure they
            type has something behind it — these drive no pricing on their own, and no agency ever sees
            them.
          </p>
        </div>
        <button
          onClick={() => {
            reset();
            setOpen((o) => !o);
          }}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page"
        >
          {open ? "Close" : "Add a rate"}
        </button>
      </div>

      {err && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      {rates.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {rates.map((r) => (
            <li key={r.publicId} className="flex items-center gap-3 px-3 py-2">
              <button onClick={() => loadForEdit(r)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold text-heading">
                  {String(r.serviceType ?? "").replace(/_/g, " ")}
                  <span className="ml-2 font-normal text-muted">
                    {String(r.rateModel ?? "").replace(/_/g, " ").toLowerCase()}
                  </span>
                  {!r.active && <span className="ml-2 text-[11px] font-semibold text-muted">(inactive)</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {[
                    r.rateCode,
                    r.includedKm ? `${r.includedKm} km` : null,
                    r.includedHours ? `${r.includedHours} hr` : null,
                    r.extraKmRate ? `+${r.extraKmRate}/km` : null,
                    r.driverAllowance ? `DA ${r.driverAllowance}` : null,
                    r.nightHalt ? `NH ${r.nightHalt}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </button>
              <div className="shrink-0 text-right tabular-nums text-sm font-semibold text-heading">
                {r.netRate == null ? "—" : `${r.currency === "INR" ? "₹" : `${r.currency} `}${Number(r.netRate).toLocaleString("en-IN")}`}
              </div>
              <button
                onClick={() => remove(r)}
                disabled={busy}
                title="Delete this rate"
                className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No rates recorded. The vehicle still sells — every listing is on request — but whoever
          approves will be working without the contracted figures.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-page p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted">Service</span>
              <select
                value={draft.serviceType}
                onChange={(e) => set("serviceType", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
              >
                {RATE_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted">Charged as</span>
              <select
                value={draft.rateModel}
                onChange={(e) => set("rateModel", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-body outline-none focus:ring-2 focus:ring-focus"
              >
                {RATE_MODELS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Net rate" type="number" value={draft.netRate} onChange={(v) => set("netRate", v)} />
            <F label="Currency" value={draft.currency} onChange={(v) => set("currency", v)} />
            <F label="Rate code" value={draft.rateCode} onChange={(v) => set("rateCode", v)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <F label="Included km" type="number" value={draft.includedKm} onChange={(v) => set("includedKm", v)} />
            <F label="Included hours" type="number" value={draft.includedHours} onChange={(v) => set("includedHours", v)} />
            <F label="Extra / km" type="number" value={draft.extraKmRate} onChange={(v) => set("extraKmRate", v)} />
            <F label="Extra / hour" type="number" value={draft.extraHourRate} onChange={(v) => set("extraHourRate", v)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Driver allowance" type="number" value={draft.driverAllowance} onChange={(v) => set("driverAllowance", v)} />
            <F label="Night halt" type="number" value={draft.nightHalt} onChange={(v) => set("nightHalt", v)} />
          </div>

          <F label="What it includes" value={draft.inclusionsText} onChange={(v) => set("inclusionsText", v)} />

          <label className="flex items-center gap-2 text-sm text-body">
            <input type="checkbox" checked={!!draft.active} onChange={(e) => set("active", e.target.checked)} />
            Active
          </label>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-body hover:bg-page"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : editingRate ? "Update rate" : "Add rate"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
