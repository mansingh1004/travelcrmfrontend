// src/features/bookings/components/RequirementRows.jsx
//
// The two multi-row requirement editors on the booking form: what VEHICLES the trip needs, and
// what ROOMS it needs.
//
// REQUIREMENT, NOT ASSIGNMENT. Both describe what the booking asks for - "2 x 17-seater",
// "3 x Double AC". Neither carries a registration number, a vendor, a driver or a status: those
// are operational facts that only exist once someone fulfils the requirement, they change after
// the booking is made, and they live in the vendor/operations flow. Keeping them apart is what
// lets a booking be sold before any vehicle is allocated.
//
// Both editors follow the same contract as the existing FastItinerary: the parent owns the rows,
// these components only emit add/remove/update. Nothing is stored here.

import { Plus, Trash2, BedDouble, Bus } from "lucide-react";
import { SearchableSelect } from "@features/leads";
import { ROOM_OCCUPANCY_TYPES, ROOM_AC_TYPES, VEHICLE_TYPES } from "../lib/bookingTripModel";

const CELL =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none " +
  "transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const HEAD = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

function AddRowButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2
                 text-xs font-bold text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RemoveRowButton({ onClick, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? "At least one row is kept" : label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-400
                 transition hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/* ── Vehicle requirement ────────────────────────────────────────────────────────────────────── */

/**
 * @param rows      [{ id, vehicleType, vehicleId, model, capacity, quantity }]
 * @param vehicles  vehicle master records — { id, name, type, capacity }. Choosing a model fills
 *                  capacity from the master rather than asking the clerk to retype it.
 */
export function VehicleRequirementRows({ rows, vehicles = [], loading = false, onAdd, onRemove, onUpdate, registerRowRef }) {
  const modelOptions = (type) =>
    (Array.isArray(vehicles) ? vehicles : [])
      // Narrow to the chosen type when there is one; an unset type shows everything rather than
      // an empty list, which would look like the master failed to load.
      .filter((vehicle) => !type || String(vehicle.type || "") === String(type))
      .map((vehicle) => ({
        value: String(vehicle.id ?? vehicle.publicId ?? vehicle.name),
        label: vehicle.capacity ? `${vehicle.name} — ${vehicle.capacity} Seater` : vehicle.name,
      }));

  return (
    <div className="space-y-2">
      {/* Column headers only exist to label rows. Vehicles start empty (most bookings need none),
          and three headings floating above nothing read as a table that failed to load. */}
      {rows.length > 0 && (
        <div className="hidden gap-2 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_88px_36px]">
          <span className={HEAD}>Vehicle Type</span>
          <span className={HEAD}>Model / Capacity</span>
          <span className={HEAD}>Qty</span>
          <span />
        </div>
      )}

      {rows.map((row, index) => (
        /* Phone: each control on its own line, inside a bordered card so one row is visually one
           requirement. Desktop: the four columns line up under the header. The header itself is
           sm:grid — on a phone there is no shared header to align to, so each control carries its
           own aria-label instead. */
        <div
          key={row.id}
          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3
                     sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_88px_36px] sm:items-center sm:rounded-none sm:border-0 sm:p-0"
        >
          <SearchableSelect
            options={VEHICLE_TYPES.map((type) => ({ value: type, label: type }))}
            value={row.vehicleType || ""}
            onChange={(next) => {
              onUpdate(row.id, "vehicleType", next);
              // The chosen model belongs to the OLD type. Leaving it would show e.g. "Bus" with a
              // Sedan model still selected underneath.
              if (row.vehicleId) { onUpdate(row.id, "vehicleId", ""); onUpdate(row.id, "model", ""); onUpdate(row.id, "capacity", ""); }
            }}
            placeholder="Type"
            searchPlaceholder="Search type..."
            icon={Bus}
            accent="blue"
            advanceOnSelect
            triggerRef={index === rows.length - 1 ? registerRowRef : undefined}
          />

          <SearchableSelect
            options={modelOptions(row.vehicleType)}
            value={String(row.vehicleId || "")}
            onChange={(next) => {
              onUpdate(row.id, "vehicleId", next);
              const picked = vehicles.find((vehicle) => String(vehicle.id ?? vehicle.publicId) === String(next));
              // Name AND capacity are stored alongside the id: the booking must still read correctly
              // if the master row is later renamed or removed.
              onUpdate(row.id, "model", picked?.name || "");
              onUpdate(row.id, "capacity", picked?.capacity == null ? "" : String(picked.capacity));
            }}
            placeholder={loading ? "Loading..." : "Model / capacity"}
            searchPlaceholder="Search vehicle..."
            loading={loading}
            accent="blue"
            advanceOnSelect
          />

          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={row.quantity}
            onChange={(event) => onUpdate(row.id, "quantity", event.target.value)}
            className={CELL}
            aria-label="Quantity"
          />

          <RemoveRowButton
            onClick={() => onRemove(row.id)}
            disabled={rows.length === 1}
            label="Remove vehicle requirement"
          />
        </div>
      ))}

      <AddRowButton onClick={onAdd} label="Add vehicle" />
    </div>
  );
}

/* ── Room requirement ───────────────────────────────────────────────────────────────────────── */

/**
 * @param rows [{ id, roomType, acType, count, extraBeds }]
 *
 * Multiple rows rather than one row with many columns, because a real party is often mixed:
 * "3 x Double AC + 1 x Triple Non AC" cannot be said with a single set of fields.
 */
export function RoomRequirementRows({ rows, onAdd, onRemove, onUpdate, registerRowRef }) {
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="hidden gap-2 px-1 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px_104px_36px]">
          <span className={HEAD}>Room Type</span>
          <span className={HEAD}>AC</span>
          <span className={HEAD}>Rooms</span>
          <span className={HEAD}>Extra Beds</span>
          <span />
        </div>
      )}

      {rows.map((row, index) => (
        /* Same responsive treatment as the vehicle rows: a bordered card per row on phones, an
           aligned grid from sm up. Rooms and Extra Beds sit side by side even on a phone — they are
           two small numbers and stacking them wastes a whole line each. */
        <div
          key={row.id}
          className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3
                     sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px_104px_36px] sm:items-center sm:rounded-none sm:border-0 sm:p-0"
        >
          <SearchableSelect
            options={ROOM_OCCUPANCY_TYPES.map((type) => ({ value: type, label: type }))}
            value={row.roomType || ""}
            onChange={(next) => onUpdate(row.id, "roomType", next)}
            placeholder="Room type"
            searchPlaceholder="Search room type..."
            icon={BedDouble}
            accent="blue"
            advanceOnSelect
            triggerRef={index === rows.length - 1 ? registerRowRef : undefined}
          />

          <SearchableSelect
            options={ROOM_AC_TYPES.map((type) => ({ value: type, label: type }))}
            value={row.acType || "Any"}
            onChange={(next) => onUpdate(row.id, "acType", next)}
            placeholder="Any"
            searchable={false}
            accent="blue"
            advanceOnSelect
          />

          <input
            type="number" min="1" inputMode="numeric"
            value={row.count}
            onChange={(event) => onUpdate(row.id, "count", event.target.value)}
            className={CELL}
            aria-label="Number of rooms"
          />

          <input
            type="number" min="0" inputMode="numeric"
            value={row.extraBeds}
            onChange={(event) => onUpdate(row.id, "extraBeds", event.target.value)}
            className={CELL}
            aria-label="Extra beds"
          />

          <RemoveRowButton
            onClick={() => onRemove(row.id)}
            disabled={rows.length === 1}
            label="Remove room requirement"
          />
        </div>
      ))}

      <AddRowButton onClick={onAdd} label="Add room type" />
    </div>
  );
}
