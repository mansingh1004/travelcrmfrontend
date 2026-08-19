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
};

export default function PlatformVehicles() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null); // { publicId? } | null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { rows: data, pagination: meta } = await svc.listVehicles({ page, size: PAGE_SIZE });
      setRows(data);
      setPagination(meta);
    } catch (e) {
      setError(e?.normalized?.message ?? "Could not load the vehicle catalog.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setForm(EMPTY);
    setFormError("");
    setEditing({});
  }

  function startEdit(row) {
    setForm({
      ...EMPTY,
      ...row,
      passengerCapacity: row.passengerCapacity ?? "",
      luggageCapacity: row.luggageCapacity ?? "",
      // The wire carries a list; the editor is one comma-separated box, because a chip editor for
      // six words is more machinery than the job needs.
      amenities: Array.isArray(row.amenities) ? row.amenities.join(", ") : "",
    });
    setFormError("");
    setEditing({ publicId: row.publicId });
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
