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

import { useState } from "react";
import { Plus, Trash2, BedDouble, Bus } from "lucide-react";
import { SearchableSelect } from "@features/leads";
import { ROOM_OCCUPANCY_TYPES, ROOM_AC_TYPES, VEHICLE_TYPES } from "../lib/bookingTripModel";

const CELL =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none " +
  "transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const HEAD = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

/* The running total, under the column it totals.
   It used to live in the Travel Details header as "2 travellers · 5 rooms" — a different card
   entirely from the rows producing it, so adding a room changed a number somewhere else on the
   page. Right-aligned so it lands under the counts rather than under the type selects, which is
   where the eye is already adding up. */
function TotalLine({ children }) {
  return (
    <p className="pt-1 text-right text-xs font-semibold text-slate-500">{children}</p>
  );
}

/* The Travellers counter tile, borrowed deliberately.
   Rooms sit directly beside Travellers on this form and were asking their simplest question — "how
   many?" — through a five-column table with its own headings. Same shape, same height, same type
   scale as TravellerCountFields' CountInput, so the two blocks read as one family. Kept local
   rather than imported: that component owns adult/child reconciliation logic that has nothing to
   do with rooms, and the tile itself is nine lines. */
function CountTile({ label, icon: Icon, value, onChange, min = 0, ariaLabel }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 transition hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        step="1"
        inputMode="numeric"
        value={value ?? ""}
        aria-label={ariaLabel || label}
        onFocus={(event) => event.target.select()}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => onChange(event.target.value)}
        className="w-12 bg-transparent text-right text-sm font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  );
}

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
  const [showBreakdown, setShowBreakdown] = useState(false);

  /* Same collapse rule as the room rows, with the plain case defined by what a vehicle row can
     leave unsaid: no type and no model is "we need N vehicles, decide which later", which two
     numbers — well, one — can express. Name either and the breakdown has to stay open. */
  const isPlainVehicle = (row) =>
    !String(row.vehicleType || "").trim() && !String(row.vehicleId || "").trim();
  const mixed = rows.length > 1 || (rows.length === 1 && !isPlainVehicle(rows[0]));
  const expanded = showBreakdown || mixed;
  const totalVehicles = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  /* Nothing to collapse at zero rows. Vehicles, unlike rooms, start empty — most bookings need
     none — so the section stays exactly as it was until someone adds one: a single Add button,
     no counter reading 0 and no checkbox for a breakdown of nothing. */
  if (!expanded && rows.length === 1) {
    const row = rows[0];
    return (
      <div>
        {/* Flex, not the rooms' 2-column grid: there is one tile here, not two, and the bin should
            hug it rather than be centred in a half-width cell. The bin is ENABLED even at one row —
            a booking may legitimately need no vehicle at all, which is why these rows start empty
            in the first place. Rooms cannot go to zero, so theirs stays disabled. */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 max-w-[220px] flex-1">
            <CountTile
              label="Vehicles"
              icon={Bus}
              value={row.quantity}
              min={1}
              onChange={(next) => onUpdate(row.id, "quantity", next)}
              ariaLabel="Number of vehicles"
            />
          </div>
          <RemoveRowButton
            onClick={() => onRemove(row.id)}
            label="Remove vehicle requirement"
          />
        </div>
        <label className="mt-2 flex w-fit cursor-pointer items-start gap-2 text-xs font-semibold leading-4 text-slate-700">
          <input
            type="checkbox"
            checked={false}
            onChange={(event) => setShowBreakdown(event.target.checked)}
            className="mt-px h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Vehicle type breakdown</span>
        </label>
      </div>
    );
  }

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

      {/* Only once there is a COLUMN to add up. With one row the total is the number already in
          the Qty box, and printing it again directly underneath says nothing — the card header
          carries the at-a-glance figure for that case. */}
      {rows.length > 1 && (
        <TotalLine>
          Total: {totalVehicles} vehicle{totalVehicles === 1 ? "" : "s"}
        </TotalLine>
      )}

      <AddRowButton onClick={onAdd} label="Add vehicle" />

      {/* Only offered once there is something to collapse. Disabled while the rows name a type or
          a model, for the same reason as the room breakdown: collapsing would have to throw that
          away, and a toggle that silently deletes is worse than one that refuses. */}
      {rows.length > 0 && (
        <label
          className={`mt-1 flex w-fit items-start gap-2 text-xs font-semibold leading-4 text-slate-700 ${
            mixed ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          }`}
          title={mixed ? "Leave one row with no type or model to collapse this" : undefined}
        >
          <input
            type="checkbox"
            checked
            disabled={mixed}
            onChange={() => setShowBreakdown(false)}
            className="mt-px h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Vehicle type breakdown</span>
        </label>
      )}
    </div>
  );
}

/* ── Room requirement ───────────────────────────────────────────────────────────────────────── */

/* A row is "plain" while it says nothing a single number cannot: an ordinary Double, no AC
   preference. The moment it says more than that, the collapsed view would be hiding real
   information, so the breakdown is forced open — the same rule TravellerCountFields uses when
   children or infants are present. */
const isPlainRoom = (row) =>
  (row.roomType || "Double") === "Double" && (row.acType || "Any") === "Any";

/**
 * @param rows [{ id, roomType, acType, count, extraBeds }]
 *
 * Multiple rows rather than one row with many columns, because a real party is often mixed:
 * "3 x Double AC + 1 x Triple Non AC" cannot be said with a single set of fields.
 *
 * ── Collapsed by default, exactly like Travellers ─────────────────────────────────────────────
 * That mix is the minority case. Most bookings want "2 rooms" and nothing more, and asking for it
 * through a five-column table — Room Type, AC, Rooms, Extra Beds, bin — made the commonest answer
 * on the form the most laborious one. So the simple case gets two counter tiles, and the table is
 * one checkbox away, which is the arrangement Travellers already uses right above it.
 *
 * Collapsing is not allowed to LOSE anything, so it is refused (checkbox disabled, panel forced
 * open) whenever the rows say more than two numbers could: more than one row, or a row naming a
 * room type or AC preference. Same guard as `kids > 0` on the traveller breakdown.
 */
export function RoomRequirementRows({ rows, onAdd, onRemove, onUpdate, registerRowRef }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const mixed = rows.length > 1 || (rows.length === 1 && !isPlainRoom(rows[0]));
  const expanded = showBreakdown || mixed;
  const totalRooms = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const totalExtraBeds = rows.reduce((sum, row) => sum + (Number(row.extraBeds) || 0), 0);

  /* Collapsed, the two tiles edit the single row directly — there is exactly one, guaranteed by
     `mixed` above and by the remove button being disabled at one row. With no rows at all there is
     nothing to edit, so that case falls through to the Add button on its own. */
  if (!expanded && rows.length === 1) {
    const row = rows[0];
    return (
      <div>
        <div className="grid max-w-sm grid-cols-2 gap-2.5">
          <CountTile
            label="Rooms"
            icon={BedDouble}
            value={row.count}
            min={1}
            onChange={(next) => onUpdate(row.id, "count", next)}
            ariaLabel="Number of rooms"
          />
          <CountTile
            label="Extra Beds"
            icon={BedDouble}
            value={row.extraBeds}
            onChange={(next) => onUpdate(row.id, "extraBeds", next)}
            ariaLabel="Extra beds"
          />
        </div>
        <label className="mt-2 flex w-fit cursor-pointer items-start gap-2 text-xs font-semibold leading-4 text-slate-700">
          <input
            type="checkbox"
            checked={false}
            onChange={(event) => setShowBreakdown(event.target.checked)}
            className="mt-px h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Room type breakdown</span>
        </label>
      </div>
    );
  }

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

      {/* Extra beds are named only when there are any — on the overwhelming majority of bookings
          the count is 0, and "· 0 extra beds" on every one of them is noise around the number that
          actually matters. */}
      {/* Same rule as the vehicle rows — a total under a single row is that row's own number.
          Extra beds are the exception: they are worth stating even for one row, because the header
          badge only carries rooms, so a lone row with extra beds would otherwise have no total
          anywhere. They are named only when there are any; on most bookings the count is 0 and
          "· 0 extra beds" is noise around the number that matters. */}
      {(rows.length > 1 || totalExtraBeds > 0) && (
        <TotalLine>
          Total: {totalRooms} room{totalRooms === 1 ? "" : "s"}
          {totalExtraBeds > 0 && ` · ${totalExtraBeds} extra bed${totalExtraBeds === 1 ? "" : "s"}`}
        </TotalLine>
      )}

      <AddRowButton onClick={onAdd} label="Add room type" />

      {/* The way back. Disabled rather than hidden while the rows hold a real mix: clicking it
          could not collapse anything, and the alternative — dropping the extra rows to make one
          number possible — is data loss dressed up as a toggle. The title says what to undo. */}
      {rows.length > 0 && (
        <label
          className={`mt-1 flex w-fit items-start gap-2 text-xs font-semibold leading-4 text-slate-700 ${
            mixed ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          }`}
          title={mixed ? "Leave one Double / Any row to collapse this" : undefined}
        >
          <input
            type="checkbox"
            checked
            disabled={mixed}
            onChange={() => setShowBreakdown(false)}
            className="mt-px h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Room type breakdown</span>
        </label>
      )}
    </div>
  );
}
