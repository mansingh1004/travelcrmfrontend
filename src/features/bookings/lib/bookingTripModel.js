// src/features/bookings/lib/bookingTripModel.js
//
// Vocabulary and pure helpers for the redesigned booking trip model — Pickup/Drop, Vehicle
// Requirement, Room Requirement and the FROM -> TO route.
//
// WHY A SEPARATE FILE. CreateBookingClean.jsx is already ~2.1k lines and serves BOTH create and
// edit (features/bookings/index.js exports it twice). Everything here is pure and testable, so it
// stays out of the JSX.
//
// WHY THESE LISTS ARE NEW RATHER THAN REUSED. quotation/Constants.js does export ROOM_TYPES, but
// they are hotel CATEGORIES - "Standard", "Deluxe", "Suite", "Family Room". A booking's room
// requirement is about OCCUPANCY - how many beds the party needs - which is a different axis:
// a Deluxe room can be a Double or a Triple. Reusing that list would have looked like reuse and
// quietly produced unanswerable requirements ("3 x Suite" says nothing about headcount).
//
// The VEHICLE types below DO mirror the vehicle master (masters/pages/Vehiclas.jsx), which stores
// { name, type, capacity }. Type is the free axis there too, so the list is kept in sync by hand;
// capacity comes off the master record when a model is chosen.

/** Occupancy, not hotel grade. See note above on why quotation's ROOM_TYPES are not reused. */
export const ROOM_OCCUPANCY_TYPES = ["Single", "Double", "Triple", "Quad", "Family", "Other"];

/** "Any" is the default: most bookings do not care, and forcing a choice invents a requirement. */
export const ROOM_AC_TYPES = ["Any", "AC", "Non AC"];

/** Mirrors the `type` values used by the vehicle master. */
export const VEHICLE_TYPES = ["Sedan", "SUV", "Tempo Traveller", "Bus", "Tourist Bus", "Other"];

/** Pickup / drop transport modes. Same vocabulary the departure block already used, so a legacy
 *  booking's `departure.mode` maps straight across with no translation table. */
export const TRAVEL_MODES = ["Flight / Airport", "Train / Rail", "Car / Road", "Bus", "Other"];

/* ── Row factories ──────────────────────────────────────────────────────────────────────────── */

// Rows need a stable key that survives reordering and removal. An array index does not: deleting
// row 0 makes row 1 become index 0, React reuses the DOM node, and whatever the user had focused
// jumps to a different row's input mid-edit.
let rowSequence = 1;
export const nextRowId = () => rowSequence++;

export const emptyVehicleRow = () => ({
  id: nextRowId(), vehicleType: "", vehicleId: "", model: "", capacity: "", quantity: "1",
});

export const emptyRoomRow = () => ({
  id: nextRowId(), roomType: "Double", acType: "Any", count: "1", extraBeds: "0",
});

export const emptyRouteRow = (fromCity = "", fromCityId = "") => ({
  id: nextRowId(),
  fromCityId, fromCity,
  toCityId: "", toCity: "",
  nights: "1",
});

/* ── Trip duration ──────────────────────────────────────────────────────────────────────────── */

/**
 * Nights and days between two yyyy-mm-dd strings.
 *
 * Parsed as UTC (`Date.UTC` on the split parts) rather than `new Date("2026-08-18")` so the result
 * cannot shift by a day for a user east or west of UTC — a trip that reads "4 nights" in Delhi and
 * "3 nights" in London would be a bug nobody could reproduce.
 *
 * Days = nights + 1 for any real trip; a same-day trip is 0 nights / 1 day.
 */
export function tripDuration(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const toUtc = (value) => {
    const [y, m, d] = String(value).split("-").map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
  };
  const from = toUtc(startDate);
  const to = toUtc(endDate);
  if (from == null || to == null) return null;
  const nights = Math.round((to - from) / 86_400_000);
  if (nights < 0) return { nights: 0, days: 0, invalid: true };
  return { nights, days: nights + 1, invalid: false };
}

/** "5 Nights / 6 Days" — the label the form shows beside the two date inputs. */
export const durationLabel = (duration) =>
  !duration || duration.invalid
    ? ""
    : `${duration.nights} Night${duration.nights === 1 ? "" : "s"} / ${duration.days} Day${duration.days === 1 ? "" : "s"}`;

/* ── Route helpers ──────────────────────────────────────────────────────────────────────────── */

/** Sum of nights across route rows. Blank/garbage rows count as 0 rather than NaN. */
export const totalRouteNights = (rows = []) =>
  rows.reduce((sum, row) => sum + (Number(row?.nights) || 0), 0);

/**
 * The trip as one line: "Gorakhpur -> Kathmandu -> Pokhara -> Gorakhpur".
 *
 * Built from each row's FROM plus the last row's TO, so a chained route reads once rather than
 * repeating every shared city. Repeats are deliberately preserved — a route may legitimately
 * return through a city it already visited.
 */
export function routeSummary(rows = []) {
  const filled = rows.filter((row) => row?.fromCity || row?.toCity);
  if (!filled.length) return "";
  const stops = [];
  filled.forEach((row, index) => {
    if (index === 0 && row.fromCity) stops.push(row.fromCity);
    else if (row.fromCity && row.fromCity !== filled[index - 1]?.toCity) stops.push(row.fromCity);
    // The nights ride with the city they belong to — "Mumbai 2N" — so the summary line says the
    // same thing the rows do, and a stop with no overnight simply carries no badge.
    if (row.toCity) {
      const nights = Number(row.nights) || 0;
      stops.push(nights > 0 ? `${row.toCity} ${nights}N` : row.toCity);
    }
  });
  return stops.join(" → ");
}

/**
 * Non-blocking checks for the route.
 *
 * Returns WARNINGS, never errors: an itinerary that does not yet add up is a normal intermediate
 * state while the clerk is typing, and blocking the save would make the form unusable. The
 * project's convention is to block only on data the server will reject.
 *
 * Deliberately NOT checked: repeated cities. A -> B -> A is a valid round trip.
 */
export function routeWarnings({ rows = [], tripNights = null, pickupCity = "", dropCity = "" }) {
  const warnings = [];
  const filled = rows.filter((row) => row?.fromCity || row?.toCity);
  if (!filled.length) return warnings;

  const routeNights = totalRouteNights(rows);
  if (tripNights != null && routeNights !== tripNights) {
    warnings.push(
      `Route adds up to ${routeNights} night${routeNights === 1 ? "" : "s"}, but the travel period is ${tripNights}.`
    );
  }

  const first = filled[0];
  if (pickupCity && first.fromCity && first.fromCity !== pickupCity) {
    warnings.push(`Route starts at ${first.fromCity} but pickup is ${pickupCity}.`);
  }

  const last = filled[filled.length - 1];
  if (dropCity && last.toCity && last.toCity !== dropCity) {
    warnings.push(`Route ends at ${last.toCity} but drop-off is ${dropCity}.`);
  }

  // A gap mid-route usually means a stop was deleted, and the trip silently teleports.
  for (let i = 1; i < filled.length; i += 1) {
    const previousTo = filled[i - 1].toCity;
    const currentFrom = filled[i].fromCity;
    if (previousTo && currentFrom && previousTo !== currentFrom) {
      warnings.push(`Leg ${i + 1} starts at ${currentFrom} but the previous leg ended at ${previousTo}.`);
      break;   // one gap message is enough; listing every leg is noise
    }
  }

  return warnings;
}
