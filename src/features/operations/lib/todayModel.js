// features/operations/lib/todayModel.js
// ─────────────────────────────────────────────────────────────────────────────
// "Where is this party right now, and what happens today" — worked out as ARITHMETIC ON THE
// PLAN, with no JSX and no network. Everything the Today panel renders comes out of here, so
// the honesty rules live in one file that can be read end to end.
//
// THE ONE THING TO UNDERSTAND BEFORE CHANGING ANYTHING HERE: nothing in this product records
// that a trip started, was delayed, or was changed. There is no actualCheckIn, no arrivedAt, no
// trip-progress state, no position cursor — a grep across the whole booking domain returns
// nothing. So "day 3 of 6, second night in Manali" is not an observation; it is today's date
// minus the travel date, walked against the itinerary as it was SOLD. Every caller must present
// it as planned. The single exception in the whole panel is a FleetTrip whose status is ONGOING,
// because somebody actually hit the start endpoint.
//
// THE SECOND THING: most of what an operations desk wants is a TIME, and this product very
// largely does not store times. BookingServiceItem — the entity that IS the operations record —
// has three LocalDate columns and zero time columns. There is no check-in or check-out time
// anywhere on the tenant hotel master. There is one pickup time and one drop time for an ENTIRE
// booking, so a 05:30 pickup on day 4 has nowhere to live. There is no duration or distance on
// any leg or line, so "4-hour transfer to Shimla" cannot be said. Rather than fill those holes
// with plausible defaults, every event carries a `time.confidence` of 'stated' | 'assumed' |
// 'unknown', and the panel renders the third as "time not recorded". A hard-coded 11:00 check-out
// would become a promise the instant an operator read it down the phone to a customer.
//
// THE THIRD THING: the day boundary. The tenant's timezone is on NO tenant-facing API response
// (verified by grep — the only hits are internal TenantTimeZone usage, Country.timezone, and the
// marketplace order's serviceTimezone). So the browser cannot know the tenant's today, and this
// file derives it from local date PARTS via operationsService.isoDate, prints it so a wrong clock
// is visible rather than silent, and cross-checks the resulting phase against the server-computed
// hoursToDeparture. See resolveToday.
// ─────────────────────────────────────────────────────────────────────────────
import { isoDate } from "../api/operationsService";

/* ── Dates, done by hand ──────────────────────────────────────────────────────
   `new Date("2026-08-19")` parses as UTC MIDNIGHT and renders as the 18th in any negative-offset
   browser; `new Date().toISOString().slice(0,10)` is UTC and drops a day east of Greenwich. Both
   are live bugs elsewhere in this app. Every date here goes through the two helpers below, which
   read and write local parts only. */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** A yyyy-MM-dd (or a yyyy-MM-ddTHH:mm) as a LOCAL midnight Date. Null on anything else. */
export function isoToDate(iso) {
  if (!iso) return null;
  const m = ISO_DAY.exec(String(iso));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from `fromIso` to `toIso`. Rounded, so a DST hour cannot shift a day count. */
export function dayDiff(fromIso, toIso) {
  const a = isoToDate(fromIso);
  const b = isoToDate(toIso);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

export function addIsoDays(iso, days) {
  const d = isoToDate(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/**
 * The TENANT's calendar date of an OffsetDateTime off the wire.
 *
 * READ FROM THE LITERAL, NEVER THROUGH `new Date()`. The offset carried in the string IS the
 * tenant's: BookingOpsRecord.pickupAt / dropAt and BookingOpsCheckpoint.dueAt are all stamped
 * `.atZone(TenantTimeZone.forTenant(...))` server-side, and Jackson serialises an OffsetDateTime
 * in its own offset — verified, not assumed: no `spring.jackson.time-zone` is configured, and
 * since jackson-modules-java8#182 the context zone is only applied when one was set EXPLICITLY.
 * So `2026-08-22T05:30:00+05:30` is the tenant's 22 Aug.
 *
 * Parsing that to an instant and asking the BROWSER which day it was re-zones a fact that was
 * already zoned — a device in UTC buckets a 00:30 IST cut-off into the previous day and the
 * chase list silently loses it. The literal is the only reading that survives a device whose
 * zone is not the tenant's.
 */
export function instantDayIso(iso) {
  if (!iso) return null;
  const m = ISO_DAY.exec(String(iso));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** The tenant's today, as best a browser can know it. See the header. */
export function browserToday() {
  return isoDate(new Date());
}

/* ── Service-line classification ──────────────────────────────────────────────
   BookingServiceItem.serviceType is FREE TEXT (varchar 60). TripPlanProjector writes "Hotel",
   "Vehicle", "Sightseeing", "Flight", "Train" and "Bus", but an agency may rename a line and the
   server itself classifies by lowercase substring — so this does the same, in the same order of
   precedence OpsRowDetail uses, and falls through to OTHER rather than guessing. */

const TYPE_TOKENS = [
  { key: "STAY",  tokens: ["hotel", "stay", "accommodation", "resort", "room", "lodge"] },
  { key: "TRAVEL", tokens: ["flight", "train", "bus", "ferry"] },
  { key: "SIGHT", tokens: ["sightseeing", "activity", "tour", "excursion", "attraction", "ticket"] },
  { key: "VEHICLE", tokens: ["transport", "transfer", "cab", "taxi", "vehicle", "car", "pickup", "drop", "coach", "tempo"] },
];

export function lineKind(serviceType) {
  const t = String(serviceType || "").toLowerCase();
  for (const g of TYPE_TOKENS) if (g.tokens.some((tok) => t.includes(tok))) return g.key;
  return "OTHER";
}

/**
 * Does this line's window contain `date`?
 *
 * HALF-OPEN, and that is load-bearing rather than pedantic: TripPlanProjector reuses one leg's
 * checkOut as the NEXT leg's serviceDate, so a 3-night Manali line is [19th, 22nd) and the Shimla
 * line starts on the 22nd. An inclusive `<=` puts the party in two hotels on every handover day —
 * exactly the bug the exclusive convention exists to prevent. A null endDate means a single day.
 */
export function lineCovers(line, date) {
  const start = line?.serviceDate;
  if (!start || !date) return false;
  const end = line?.endDate || null;
  if (!end) return start === date;
  return start <= date && date < end;
}

/* ── The leg walk ─────────────────────────────────────────────────────────────
   A verbatim repeat of TripPlanProjector.walk. Two implementations of one algorithm can drift,
   which is why STEP 8 of the design wants the server to assemble the day — until then this is
   the client half and it must stay byte-for-byte the same rule. */

/**
 * Legs sorted by dayNumber (nulls last), each handed the dates it occupies.
 *
 * The itinerary @OneToMany carries NO @OrderBy, so what the API returns is arbitrary DB order —
 * rendering it as received scrambles the trip. A zero-night leg does NOT advance the cursor, so a
 * day trip typed into the itinerary correctly sits on the same date as the stay around it.
 */
export function walkLegs(travelDate, legs) {
  if (!travelDate || !Array.isArray(legs) || legs.length === 0) return [];
  const ordered = [...legs].sort((a, b) => {
    const x = a?.dayNumber, y = b?.dayNumber;
    if (x == null && y == null) return 0;
    if (x == null) return 1;          // nulls last
    if (y == null) return -1;
    return x - y;
  });

  const out = [];
  let cursor = travelDate;
  for (const leg of ordered) {
    const nights = Math.max(0, Number(leg?.nights) || 0);
    const end = addIsoDays(cursor, nights);
    out.push({ leg, start: cursor, end, nights });
    cursor = end;
  }
  return out;
}

/** leg.city is the TO half — where the nights are actually spent. */
function legPlace(leg) {
  return leg?.city || leg?.destination || null;
}

/**
 * The place a stay line is in.
 *
 * A stay line carries NO hotel identity and no city — nothing on a booking links a night to a
 * hotel (see the design's backend gaps), so the city has to come from the itinerary window that
 * starts on the same day. Where the operator typed the line by hand and no leg matches, the
 * projector's own phrasing ("3 nights in Calangute") is read after the last " in ", and failing
 * that the title stands on its own. Nothing here invents a place.
 */
function placeForStay(win, legWindows) {
  if (win.leg) return legPlace(win.leg);
  const match = legWindows.find((w) => w.start === win.start);
  if (match) return legPlace(match.leg);
  const title = win.line?.title || "";
  const at = title.lastIndexOf(" in ");
  if (at > -1) return title.slice(at + 4).trim() || null;
  return title || null;
}

/* ── The model ────────────────────────────────────────────────────────────── */

export const PHASE = {
  BEFORE: "BEFORE",
  DEPARTS_TOMORROW: "DEPARTS_TOMORROW",
  IN_TRIP: "IN_TRIP",
  END_UNKNOWN: "END_UNKNOWN",
  ENDED: "ENDED",
};

/**
 * Everything the panel needs about WHEN, in one pure call.
 *
 * @param booking      GET /bookings/{publicId}
 * @param record       GET /operations/bookings/{id}/checkpoints — null is ORDINARY (records are
 *                     provisioned at confirmation only)
 * @param serviceItems GET /bookings/{publicId}/services — [] is ordinary
 * @param today        Injectable for tests. Defaults to the browser's local date parts.
 */
export function resolveToday({ booking, record, serviceItems = [], today } = {}) {
  const tenantToday = today || browserToday();
  const snap = booking?.tripSnapshot || null;
  const travelDate = booking?.travelDate || null;

  /* The end of the trip is stored in two places that can disagree, and is NULL more often than it
     looks: BookingServiceImpl only backfills it when legs exist AND their nights sum above zero.
     The snapshot's copy is preferred so this page and the board row it was opened from print the
     same window. It is NEVER derived from travelDate + nights here — BookingDetails does derive
     its own and the two can differ, which is precisely how one screen tells an operator the party
     comes home on a day the other screen does not. */
  const tripEndDate = snap?.tripEndDate ?? record?.tripEndDate ?? null;

  const legWindows = walkLegs(travelDate, Array.isArray(snap?.itinerary) ? snap.itinerary : []);

  /* WHICH SOURCE DATES THE STAYS. The service lines win where they exist, because the server
     already walked the itinerary into them AND an operator may have edited them since — a hand-
     corrected check-out date is a fact, the sold itinerary is an intention. The leg walk is the
     fallback for a booking whose trip plan was never generated (POST /trip-plan refuses to write
     over existing lines, so a hand-typed booking never gains projected windows). Which one is in
     use is reported back, because the panel says so on screen. */
  const lines = Array.isArray(serviceItems) ? serviceItems : [];
  const stayLines = lines.filter((l) => lineKind(l.serviceType) === "STAY" && l.serviceDate);

  const stayWindows = stayLines.length > 0
    ? stayLines
        .map((line) => ({ line, leg: null, start: line.serviceDate, end: line.endDate || null }))
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    : legWindows
        .filter((w) => w.nights > 0)              // a zero-night leg is a day trip, never a stay
        .map((w) => ({ line: null, leg: w.leg, start: w.start, end: w.end }));

  const staySource = stayLines.length > 0 ? "lines" : legWindows.length > 0 ? "itinerary" : "none";

  /* N and M. travelDate is NOT NULL on `bookings`, so N is always computable. */
  const dayIndex = travelDate ? dayDiff(travelDate, tenantToday) + 1 : null;

  const lastWindowEnd = legWindows.length ? legWindows[legWindows.length - 1].end : null;
  const effectiveEnd = tripEndDate || lastWindowEnd || null;
  const totalDays = travelDate && effectiveEnd ? dayDiff(travelDate, effectiveEnd) + 1 : null;

  /* THE CLOCK CROSS-CHECK. hoursToDeparture was computed SERVER-side against the tenant's clock
     (OpsSeverityCalculator, given OffsetDateTime.now(tenantZone)), so it is the only tenant-clock
     fact a browser can get hold of today. The tolerance band is a full 24h deliberately: departure
     is a wall-clock instant rather than midnight, so anything tighter fires on ordinary bookings.
     Only a breach of a whole day either way is evidence the device's date is wrong. */
  let clockDisagreement = false;
  let serverPhase = null;
  const hours = record?.hoursToDeparture;
  if (hours != null && travelDate) {
    const diff = dayDiff(travelDate, tenantToday);   // > 0 once today is past the travel date
    if (hours > 24) {
      serverPhase = "BEFORE";
      clockDisagreement = diff >= 0;
    } else if (hours < -24) {
      serverPhase = "AFTER";
      clockDisagreement = diff <= 0;
    }
  }

  let phase;
  if (dayIndex == null) phase = PHASE.END_UNKNOWN;
  else if (dayIndex <= -1) phase = PHASE.BEFORE;
  else if (dayIndex === 0) phase = PHASE.DEPARTS_TOMORROW;
  else if (totalDays == null) phase = PHASE.END_UNKNOWN;
  else if (dayIndex > totalDays) phase = PHASE.ENDED;
  else phase = PHASE.IN_TRIP;

  /* On a breach the SERVER's phase wins. Both overrides land on a phase that renders no day list,
     which is the honest outcome: we know the device is wrong, so we do not know which day to show.
     The chase block — which is not date-derived — keeps working, and that is exactly what
     pre-departure and post-return operations is. */
  if (clockDisagreement) {
    if (serverPhase === "BEFORE") phase = PHASE.BEFORE;
    else if (serverPhase === "AFTER") phase = PHASE.ENDED;
  }

  return {
    tenantToday,
    travelDate,
    tripEndDate,
    effectiveEnd,
    dayIndex,
    totalDays,
    phase,
    daysToDeparture: dayIndex != null && dayIndex <= 0 ? 1 - dayIndex : null,
    clockDisagreement,
    serverPhase,
    legWindows,
    stayWindows,
    staySource,
    lines,
  };
}

/**
 * Where the party is on ONE date — the day index, the stay covering it, and the handovers.
 *
 * The covering test is half-open for the reason spelled out on lineCovers: endDate is EXCLUSIVE
 * and is reused as the next stay's start, so `<=` shows Manali and Shimla on the same day.
 */
export function dayFacts(model, date) {
  const { travelDate, stayWindows, legWindows, effectiveEnd } = model;
  const index = travelDate && date ? dayDiff(travelDate, date) + 1 : null;

  const covering = stayWindows.find(
    (w) => w.start <= date && (w.end ? date < w.end : w.start === date)
  ) || null;

  const stay = covering
    ? {
        place: placeForStay(covering, legWindows),
        // A stay with no end date yields no n/m rather than a fabricated one.
        nightIndex: covering.end ? dayDiff(covering.start, date) + 1 : null,
        nightsTotal: covering.end ? dayDiff(covering.start, covering.end) : null,
        window: covering,
      }
    : null;

  const checkingOut = stayWindows.find((w) => w.end && w.end === date && w.start !== w.end) || null;
  const checkingIn = stayWindows.find((w) => w.start === date && (!w.end || w.end !== w.start)) || null;

  // A day trip typed into the itinerary: a zero-night leg, which never advances the cursor and so
  // never covers a night. It belongs on its start date as an event, not as a stay.
  const dayTrips = legWindows.filter((w) => w.nights === 0 && w.start === date);

  return {
    index,
    stay,
    checkingOut,
    checkingOutPlace: checkingOut ? placeForStay(checkingOut, legWindows) : null,
    checkingIn,
    checkingInPlace: checkingIn ? placeForStay(checkingIn, legWindows) : null,
    dayTrips,
    isFirstDay: date === travelDate,
    isLastDay: !!effectiveEnd && date === effectiveEnd,
    inTrip: !!travelDate && date >= travelDate && (!effectiveEnd || date <= effectiveEnd),
  };
}

/* ── Times, and how sure we are ──────────────────────────────────────────────── */

const stated = (text, note) => ({ text, confidence: "stated", note: note || null });
const assumed = (text, note) => ({ text, confidence: "assumed", note: note || null });
const unknown = (note) => ({ text: null, confidence: "unknown", note: note || null });

/** "HH:mm" off a LocalTime or a LocalDateTime. Never through a Date — `new Date("05:30")` is NaN. */
export function clockOf(value) {
  if (!value) return null;
  const s = String(value);
  const t = s.includes("T") ? s.slice(s.indexOf("T") + 1) : s;
  return /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null;
}

/**
 * An OffsetDateTime rendered as the TENANT's wall clock.
 *
 * This is the single highest-stakes formatter on the panel: it is the only clock the schedule
 * ever prints as `stated`, in ink, with no disclaimer — an operator reads it down the phone.
 *
 * It therefore does NOT go through `new Date(...).toLocaleTimeString()`. That converts the
 * instant into the BROWSER's zone, so a 05:30 Asia/Kolkata pickup viewed from a device set to
 * UTC prints "12:00 am" — a wrong time, presented as an agreed one, which is exactly the lie
 * this whole file exists to refuse. The offset in the string is the tenant's (see instantDayIso),
 * so the wall clock is already there to be read: take it, do not recompute it.
 */
export function instantClock(iso) {
  return clockOf(iso);
}

/**
 * `departure.preferredTime` is ONE key folding the flight time or the train time by mode, and the
 * mode arrives as its displayName, never the enum name.
 */
export function preferredTimeNoun(mode) {
  if (mode === "Flight / Airport") return "flight";
  if (mode === "Train / Rail") return "train";
  return "departure";
}

const LONG_HAUL_NOUN = { Flight: "flight", Train: "train", Bus: "bus" };

/** The long-haul word the outbound mode implies, or null for CAR / OTHER (nothing to confirm). */
function outboundNoun(mode) {
  if (mode === "Flight / Airport") return "Flight";
  if (mode === "Train / Rail") return "Train";
  if (mode === "Bus") return "Bus";
  return null;
}

/** dropMode is FREE TEXT, not the DepartureMode enum — matched rather than switched on. */
function returnNoun(dropMode) {
  const m = String(dropMode || "").toLowerCase();
  if (!m) return null;
  if (m.includes("flight") || m.includes("air")) return "Flight";
  if (m.includes("train") || m.includes("rail")) return "Train";
  if (m.includes("bus")) return "Bus";
  return null;
}

const vendorOf = (line) =>
  line && (line.vendorName || line.vendorPhone || line.vendorWhatsapp)
    ? { name: line.vendorName || null, phone: line.vendorPhone || null, whatsapp: line.vendorWhatsapp || null }
    : null;

/**
 * ONE day's events, in a FIXED sequence.
 *
 * The order is by event TYPE and never by a clock, because there is no clock to sort by:
 * BookingServiceItem has zero time columns. Sorting a day by invented times would be a second lie
 * on top of the first. The sequence is the one an operations day actually runs in — pickup,
 * outbound, check-out, transfer, check-in, the night, excursions, the vehicle, the return, the
 * drop — and it is stable, so the list does not reshuffle between two renders of the same day.
 */
export function buildSchedule({ model, booking, record, date }) {
  const rows = [];
  if (!booking || !date) return rows;

  const snap = booking.tripSnapshot || null;
  const dep = snap?.departure || null;
  const drop = snap?.drop || null;
  const facts = dayFacts(model, date);
  const { travelDate, tripEndDate, effectiveEnd, lines } = model;

  const push = (row) => rows.push({ key: `${row.kind}-${rows.length}`, ...row });

  /* 1 — PICKUP. Day one only: BookingTripSnapshot holds exactly ONE pickupDateTime, ONE pickupTime
        and ONE dropTime for the whole booking, so a 05:30 pickup on day 4 has nowhere to live and
        reusing day one's would be a fabrication with a clock on it. */
  if (date === travelDate) {
    /* record.pickupAt IS the precision test. OpsCheckpointPlanner returns pickupAt = null on
       exactly the rung where it fell back to app.ops.default-departure-hour (unset ⇒ 06:00) — while
       departureAt is set on that rung too, which is the trap: departureAt is almost never null, so
       rendering it here would print a house convention as an agreed pickup on most bookings. */
    // Each rung is tested on the RENDERED value, not on the field being present: a value that
    // cannot be turned into a clock must fall through to the next source rather than produce a
    // "stated" time with nothing in it.
    const fromRecord = record?.pickupAt ? instantClock(record.pickupAt) : null;
    const fromSnapDateTime = clockOf(dep?.pickupDateTime);
    const fromSnapTime = clockOf(dep?.pickupTime);

    let time;
    if (fromRecord) time = stated(fromRecord, "pickup time");
    else if (fromSnapDateTime) time = stated(fromSnapDateTime, "pickup time");
    else if (fromSnapTime) time = stated(fromSnapTime, "pickup time");
    else time = unknown("no pickup time was recorded on this booking");

    push({
      kind: "PICKUP",
      title: "Pickup",
      detail: record?.pickupLocation || dep?.pickupAddress || null,
      time,
      vendor: null,
    });
  }

  /* 2 — OUTBOUND LONG-HAUL. Its time is ASSUMED at best. preferredFlightTime / preferredTrainTime
        are what the customer ASKED FOR at enquiry — the columns say PREFERRED — never what was
        ticketed, and OpsCheckpointPlanner does not even consult them. Showing a preferred 09:00
        beside a confirmed booking is how an operator misses a real 06:15 flight. */
  if (date === travelDate) {
    const lineOut = lines.find((l) => lineKind(l.serviceType) === "TRAVEL" && l.serviceDate === travelDate);
    const noun = outboundNoun(dep?.mode) || (lineOut ? String(lineOut.serviceType) : null);
    if (lineOut || noun) {
      const word = (LONG_HAUL_NOUN[noun] || String(noun || "departure")).toLowerCase();
      const pref = clockOf(dep?.preferredTime);
      push({
        kind: "DEPARTURE",
        title: lineOut?.title || `Outbound ${word}`,
        detail: [
          dep?.airport ? `${dep.airport}${dep.airportCode ? ` (${dep.airportCode})` : ""}` : dep?.railwayStation,
          dep?.trainClass,
        ].filter(Boolean).join(" · ") || null,
        time: pref
          ? assumed(pref, `preferred ${preferredTimeNoun(dep?.mode)} time — not a confirmed departure`)
          : unknown(`no ${word} time is recorded on a booking`),
        status: lineOut?.status || null,
        vendor: vendorOf(lineOut),
        confirmationNumber: lineOut?.confirmationNumber || null,
        line: lineOut || null,
      });
    }
  }

  /* 3 — CHECK-OUT. NO TIME EXISTS, anywhere. There is no check-out column on master/hotel/Hotel,
        RoomType, BookingServiceItem, BookingTripLeg or BookingOpsCheckpoint — a grep for
        check.?in/check.?out across the hotel master returns zero hits. The only check-in/out times
        in the product are PlatformHotel's, free-text String(10) on the marketplace catalog, blank
        on hand-created hotels, and unreachable per-night because nothing links a stay to a hotel
        identity. So the row carries the property's PHONE instead: the operator rings and finds out. */
  if (facts.checkingOut) {
    const line = facts.checkingOut.line;
    push({
      kind: "CHECKOUT",
      title: `Check out of ${facts.checkingOutPlace || "the hotel"}`,
      detail: line?.title && line.title !== facts.checkingOutPlace ? line.title : null,
      time: unknown("no check-out time is stored anywhere in this product — ring the property"),
      status: line?.status || null,
      vendor: vendorOf(line),
      confirmationNumber: line?.confirmationNumber || null,
      line: line || null,
    });
  }

  /* 4 — TRANSFER. No clock AND NO DURATION. There is no departure hour for any day but day one,
        and no duration, distance or ETA field on BookingTripLeg, BookingServiceItem,
        BookingTripSnapshot, BookingOpsRecord or BookingOpsCheckpoint. "4-hour transfer to Shimla"
        must not appear on this screen. */
  if (facts.checkingOut && facts.checkingIn) {
    push({
      kind: "TRANSFER",
      title: `Transfer — ${facts.checkingOutPlace || "?"} → ${facts.checkingInPlace || "?"}`,
      detail: null,
      time: unknown("no transfer time or duration is stored on a booking"),
      vendor: null,
    });
  }

  /* 5 — CHECK-IN. Same absence as check-out. The useful facts here are the confirmation number and
        whether the line is CONFIRMED, not a clock. */
  if (facts.checkingIn) {
    const line = facts.checkingIn.line;
    push({
      kind: "CHECKIN",
      title: `Check in to ${facts.checkingInPlace || "the hotel"}`,
      detail: line?.title && line.title !== facts.checkingInPlace ? line.title : null,
      time: unknown("no check-in time is stored anywhere in this product — ring the property"),
      status: line?.status || null,
      vendor: vendorOf(line),
      confirmationNumber: line?.confirmationNumber || null,
      line: line || null,
    });
  }

  /* 6 — THE NIGHT. A state, not an event, so it carries no time slot at all. */
  if (facts.stay) {
    const s = facts.stay;
    push({
      kind: "STAY",
      title: s.nightIndex && s.nightsTotal
        ? `Night ${s.nightIndex} of ${s.nightsTotal} in ${s.place || "—"}`
        : `In ${s.place || "—"}`,
      detail: s.window.line?.title || null,
      time: null,                                   // deliberately no slot — see above
      status: s.window.line?.status || null,
      vendor: vendorOf(s.window.line),
      confirmationNumber: s.window.line?.confirmationNumber || null,
      line: s.window.line || null,
    });
  }

  /* 7 — DAY TRIPS. Zero-night legs, on their start date only. */
  for (const w of facts.dayTrips) {
    push({
      kind: "DAYTRIP",
      title: `Day trip — ${legPlace(w.leg) || "—"}`,
      detail: null,
      time: unknown("a day trip carries no time on the itinerary"),
      vendor: null,
    });
  }

  /* 8 — SIGHTSEEING. TripPlanProjector titles these "Sightseeing in {city}" — the itinerary knows
        the cities and never the excursions, so this cannot say WHICH tour. Sightseeing master data
        does carry suggestedStartTime and estimatedHours, but neither is EVER copied onto a lead, a
        quotation, a booking or a service line, so reaching for it would attach one attraction's
        master hours to a line that is not that attraction. */
  for (const line of lines.filter((l) => lineKind(l.serviceType) === "SIGHT" && lineCovers(l, date))) {
    push({
      kind: "SIGHTSEEING",
      title: line.title || "Sightseeing",
      detail: line.description || null,
      time: unknown("service lines carry no time — this is not scheduled to an hour"),
      status: line.status || null,
      vendor: vendorOf(line),
      confirmationNumber: line.confirmationNumber || null,
      line,
    });
  }

  /* 9 — THE VEHICLE. projectVehicles dates these travelDate → tripEnd, so on most bookings the one
        line covers the whole trip. Labelled "for the trip" rather than "today at HH:MM", which it
        never was. */
  for (const line of lines.filter((l) => lineKind(l.serviceType) === "VEHICLE" && lineCovers(l, date))) {
    const wholeTrip = line.serviceDate === travelDate && !!line.endDate && line.endDate === effectiveEnd;
    push({
      kind: "VEHICLE",
      title: `Vehicle — ${line.title || "at disposal"}`,
      detail: wholeTrip ? "At disposal for the trip" : "At disposal",
      time: unknown("a vehicle line carries no time"),
      status: line.status || null,
      vendor: vendorOf(line),
      confirmationNumber: line.confirmationNumber || null,
      line,
    });
  }

  /* 10 — EVERYTHING ELSE DATED TO THIS DAY. serviceType is free text, so a line an agency named
         "Visa" or "Permit" falls into none of the buckets above. It is still dated to today and it
         is still somebody's job, so it appears rather than being silently dropped by a
         classification this file does not control. Only OTHER lands here — every classified kind
         already has its own row above, and the two travel lines are placed on day one and the last
         day as the outbound and return. */
  for (const line of lines.filter((l) => lineCovers(l, date) && lineKind(l.serviceType) === "OTHER")) {
    push({
      kind: "OTHER",
      title: line.title || line.serviceType || "Service",
      detail: line.serviceType || null,
      time: unknown("service lines carry no time"),
      status: line.status || null,
      vendor: vendorOf(line),
      confirmationNumber: line.confirmationNumber || null,
      line,
    });
  }

  /* 11 — RETURN LONG-HAUL. There is NO return preferred time anywhere: preferredFlightTime and
         preferredTrainTime are the OUTBOUND preference and reusing them here would put the
         customer's departure-day wish on their homeward flight. */
  if (tripEndDate && date === tripEndDate) {
    const lineBack = lines.find((l) => lineKind(l.serviceType) === "TRAVEL" && l.serviceDate === tripEndDate);
    const noun = returnNoun(drop?.mode) || (lineBack ? String(lineBack.serviceType) : null);
    if (lineBack || noun) {
      const word = (LONG_HAUL_NOUN[noun] || String(noun || "journey")).toLowerCase();
      push({
        kind: "RETURN",
        title: lineBack?.title || `Return ${word}`,
        detail: [drop?.city, drop?.country].filter(Boolean).join(", ") || null,
        time: unknown(`no return ${word} time is recorded on a booking`),
        status: lineBack?.status || null,
        vendor: vendorOf(lineBack),
        confirmationNumber: lineBack?.confirmationNumber || null,
        line: lineBack || null,
      });
    }
  }

  /* 12 — DROP. GATED ON tripSnapshot.drop.time, NOT on record.dropAt. OpsCheckpointPlanner
         silently substitutes LocalTime.NOON when dropTime is null and — unlike the departure side —
         there is NO DropTimeSource enum to disclaim it, so an assumed 12:00 and an agreed 12:00
         come off the wire byte-identical. The date half comes from tripEndDate; where that is null
         the whole row is omitted rather than derived from travelDate + nights. */
  if (tripEndDate && date === tripEndDate) {
    const t = clockOf(drop?.time);
    push({
      kind: "DROP",
      title: "Drop / hand-back",
      detail: record?.dropLocation
        || [drop?.city, drop?.country].filter(Boolean).join(", ")
        || null,
      time: t ? stated(t, "agreed drop time") : unknown("no drop time was recorded on this booking"),
      vendor: null,
    });
  }

  return rows;
}

/**
 * What must be chased, for ONE date.
 *
 * ONE READINESS MODEL, NEVER TWO. OpsBoardEntry.readiness (v1, derived from service lines) and
 * BookingOpsCheckpoint (v2, moved by a human) run side by side and can legitimately disagree —
 * showing both makes one thing green and red at once. Where a record exists the checkpoints win,
 * because a human touched them; where it does not, the lines are the only answer there is. The
 * caller says on screen which of the two it is showing.
 *
 * Supplier holds are a separate block on purpose: a release date is a DEADLINE, not a readiness
 * verdict, and it has no equivalent in the checkpoint model.
 */
export function buildChase({ model, record, date, now = new Date() }) {
  const lines = model.lines;

  /* dueAt is the ONLY true clock cut-off in the whole booking domain — a timestamptz chosen over a
     DATE precisely so a checkpoint can say "the 18:00 cut-off". This is what answers "what must I
     chase before this evening". */
  const checkpoints = (record?.checkpoints || [])
    .map((c) => {
      // isAwaitingSupplier() on the server: PENDING or REQUESTED — we have asked, or not yet asked.
      const awaiting = c.status === "PENDING" || c.status === "REQUESTED";
      // isGreen(): CONFIRMED and NOT_APPLICABLE are settled. Everything else is still somebody's
      // problem, including REJECTED and EXPIRED — which is exactly when a due date matters most.
      const open = c.status !== "CONFIRMED" && c.status !== "NOT_APPLICABLE";
      const dueDay = instantDayIso(c.dueAt);
      const lapsed = !!c.dueAt && open && new Date(c.dueAt) < now;
      /* BROKEN is not "awaiting" and that is the whole point of listing it.
         REJECTED, EXPIRED and BLOCKED mean somebody already answered and the answer was no — the
         supplier declined, the hold died, the visa is stuck. Those are the rows an operator most
         needs in front of them, and gating this list on PENDING/REQUESTED dropped every one of
         them. isGreen() on the server draws the line in exactly one place: CONFIRMED and
         NOT_APPLICABLE are settled, everything else is somebody's problem. Follow that. */
      const broken = c.status === "REJECTED" || c.status === "EXPIRED" || c.status === "BLOCKED";
      /* MANDATORY AND OPEN IS A CHASE, dueAt or not.
         Only one checkpoint in the whole nine ever carries a dueAt — the supplier hold. Requiring
         one here meant the chase list was empty on essentially every booking in the product: an
         unsourced hotel two days before departure produced no row at all, on the panel whose one
         job is to say what must be chased. A missing cut-off means "no deadline recorded", not
         "no work outstanding". */
      const pressing = open && c.mandatory;
      // A checkpoint due today that is already CONFIRMED is not a chase — putting it in this list
      // would make a green thing look like outstanding work, on a panel whose entire job is not
      // blurring those two.
      return {
        ...c,
        _lapsed: lapsed,
        _broken: broken && open,
        _dueToday: open && dueDay === date,
        _pressing: pressing,
      };
    })
    .filter((c) => c._lapsed || c._broken || c._dueToday || c._pressing)
    .sort((a, b) => {
      // Worst first, and a lapsed deadline outranks a refusal: the hold is already gone.
      const rank = (c) => (c._lapsed ? 0 : c._broken ? 1 : c._dueToday ? 2 : 3);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      // Within a rank, a stated cut-off sorts before one with none — a row with a deadline is
      // actionable now, a row without is merely outstanding.
      if (!!a.dueAt !== !!b.dueAt) return a.dueAt ? -1 : 1;
      return String(a.dueAt || "").localeCompare(String(b.dueAt || ""));
    });

  /* The v1 fallback: today's lines that are neither CONFIRMED nor CANCELLED. Not a schedule — a
     state list, so no time is needed or shown. */
  const openLines = lines.filter(
    (l) => lineCovers(l, date) && l.status !== "CONFIRMED" && l.status !== "CANCELLED"
  );

  /* A NULL releaseDate means "no hold expiry was AGREED" — never "expires today". The entity
     javadoc is explicit about it, and a panel that reads null as urgent turns every booking red. */
  const holds = lines.filter(
    (l) => l.releaseDate
      && l.releaseDate <= date
      && (l.status === "PENDING" || l.status === "REQUESTED")
  );

  return {
    model: record ? "checkpoints" : "lines",
    checkpoints,
    openLines,
    holds,
    empty: (record ? checkpoints.length === 0 : openLines.length === 0) && holds.length === 0,
  };
}

/**
 * The quotation's day N, matched on the WIRE key `day`.
 *
 * NOT `dayNumber` — QuotationSightseeingDay.dayNumber is the Java field but the DTO ships it as
 * `day`, which is what BookingDetails.jsx reads. Every value under here is unvalidated free text
 * (startTime is VARCHAR(20), the day's own date is VARCHAR(30)); "15:00", "3 PM" and "afternoon"
 * are all legal. It is rendered VERBATIM and in the quotation's own order — never parsed, never
 * sorted by, never used to compute "next in 90 minutes".
 */
export function quotationDayFor(quotation, dayIndex) {
  const days = quotation?.sightseeing?.days;
  if (!Array.isArray(days) || dayIndex == null) return null;
  return days.find((d) => Number(d?.day) === Number(dayIndex)) || null;
}

/**
 * A quotation flight segment whose departure date is EXACTLY this date.
 *
 * String equality, deliberately: depDate is VARCHAR(30) free text with no parser or validator
 * anywhere. An exact match means the agent happened to type ISO and we can quote them their own
 * value back; anything else simply does not match, which is the honest outcome. Nothing here
 * parses a date out of free text.
 */
export function quotationFlightOn(quotation, date) {
  const segs = quotation?.flight?.segments;
  if (!Array.isArray(segs) || !date) return null;
  return segs.find((s) => String(s?.depDate || "").trim() === date) || null;
}
