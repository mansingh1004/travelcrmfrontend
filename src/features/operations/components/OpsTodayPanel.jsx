// features/operations/components/OpsTodayPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The first thing on the operations detail page: where is this party RIGHT NOW, what happens
// today, and what must be chased before this evening.
//
// EVERY POSITION ON THIS PANEL IS PLANNED, NOT OBSERVED. Nothing in the product records that a
// trip started, was delayed or was changed — there is no actualCheckIn, no arrivedAt, no
// trip-progress state and no position cursor anywhere in the booking domain. "Day 3 of 6, second
// night in Manali" is today's date walked against the itinerary as it was sold, and the strip says
// so in as many words. The ONE block permitted to claim something is actually happening is the
// fleet block, and only when a FleetTrip's status is ONGOING, because that means a human hit the
// start endpoint.
//
// TIMES ARE MOSTLY ABSENT AND THE PANEL SAYS SO. A row for an event with no stored time still
// appears — the event still happens — with its slot rendered as "not recorded" and, where it
// helps, the supplier's phone number beside it so the operator can ring and find out. A hard-coded
// 11:00 check-out would be a promise the moment somebody read it to a customer. The arithmetic and
// the honesty rules all live in ../lib/todayModel.js; this file only draws them.
//
// DEGRADES SECTION BY SECTION, NEVER WHOLE. The service lines, the quotation and the fleet trips
// each need a different permission, and every one of them may legitimately be empty, 403 or 404.
// No absence is an error state here — the page's own discipline, copied.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sunrise, PlaneTakeoff, PlaneLanding, LogIn, LogOut, ArrowRightLeft, Moon, Camera,
  CarFront, MapPin, Footprints, ChevronLeft, ChevronRight, TriangleAlert, Info,
  Phone, MessageCircle, CalendarDays, ShieldCheck, FileText, Radar,
} from "lucide-react";

import { isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";

import { Badge } from "./opsUi";
import operationsService from "../api/operationsService";
import {
  PHASE, resolveToday, dayFacts, buildSchedule, buildChase,
  quotationDayFor, quotationFlightOn, browserToday, isoToDate, addIsoDays,
} from "../lib/todayModel";

/* ── Formatting ──────────────────────────────────────────────────────────────
   The page's own forms, kept identical so two dates on one screen cannot be spelled two ways.
   `new Date(iso)` is never used on a LocalDate — that parses as UTC midnight and renders as the
   day before in any negative-offset browser. */

const fmtDayLong = (iso) => {
  const d = isoToDate(iso);
  return d ? d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "—";
};

const fmtDate = (iso) => {
  const d = isoToDate(iso);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
};

/**
 * For the OffsetDateTime fields (dueAt) — read as the TENANT's wall clock, never re-zoned.
 *
 * `new Date(iso).toLocaleString(...)` converts the instant into the BROWSER's zone, so an 18:00
 * IST cut-off reads as 12:30 on a device set to UTC — and a cut-off is the one number on this
 * panel somebody acts on. The offset in the string is the tenant's (the server stamps these with
 * TenantTimeZone and Jackson keeps the offset), so the parts are rebuilt as a local Date purely
 * to reuse the locale's formatting. Identical output for an in-zone device; correct for any other.
 */
const WHEN_PARTS = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const fmtWhen = (iso) => {
  if (!iso) return null;
  const m = WHEN_PARTS.exec(String(iso));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const money = (n) =>
  n == null ? null : `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/* ── Row vocabulary ──────────────────────────────────────────────────────────
   Icons by event KIND, so the day is scannable without reading it. The order the rows arrive in
   is fixed by buildSchedule and is by event type, never by a clock — there is no clock to sort by. */

const KIND_ICON = {
  PICKUP: Sunrise,
  DEPARTURE: PlaneTakeoff,
  CHECKOUT: LogOut,
  TRANSFER: ArrowRightLeft,
  CHECKIN: LogIn,
  STAY: Moon,
  DAYTRIP: Footprints,
  SIGHTSEEING: Camera,
  VEHICLE: CarFront,
  RETURN: PlaneLanding,
  DROP: MapPin,
};

/** ServiceItemStatus — the four the server has, and nothing invented for an unknown one. */
const STATUS_TONE = { CONFIRMED: "green", REQUESTED: "blue", PENDING: "amber", CANCELLED: "slate" };

/**
 * The time slot, and the whole point of this panel.
 *
 * Three renderings that must never be confused with one another:
 *   stated  — somebody recorded this. Printed as a clock, in ink.
 *   assumed — a preference or a house convention, printed with a "~" and its disclaimer. This is
 *             the same device DepartureCountdown already uses for the assumed departure hour, so
 *             the two chips read the same way on one screen.
 *   unknown — no column exists to read. Printed as "not recorded", never as a default. An invented
 *             default is worse than a blank: it becomes a promise as soon as an operator repeats it.
 *
 * `time: null` is a fourth case — a STATE rather than an event (the night in place), which gets a
 * blank slot so the column still lines up.
 */
function TimeSlot({ time }) {
  const base = "w-[86px] shrink-0 pt-0.5";
  if (!time) return <span className={base} />;
  if (time.confidence === "stated") {
    return (
      <span className={`${base} text-xs font-extrabold text-slate-800 tabular-nums`} title={time.note || undefined}>
        {time.text}
      </span>
    );
  }
  if (time.confidence === "assumed") {
    return (
      <span className={`${base} text-xs font-extrabold text-amber-700 tabular-nums`} title={time.note || undefined}>
        {time.text}
        <span className="ml-0.5 font-extrabold text-amber-400">~</span>
      </span>
    );
  }
  return (
    <span className={`${base} text-[10px] font-bold text-slate-300 leading-tight`}>
      time not<br />recorded
    </span>
  );
}

function ScheduleRow({ row }) {
  const Icon = KIND_ICON[row.kind] || CalendarDays;
  const isState = row.kind === "STAY";
  const v = row.vendor;

  return (
    <li className={`flex items-start gap-3 px-3 py-2.5 ${isState ? "bg-slate-50/70" : ""}`}>
      <TimeSlot time={row.time} />
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isState ? "text-slate-400" : "text-slate-500"}`} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-xs font-extrabold ${isState ? "text-slate-600" : "text-slate-800"}`}>
            {row.title}
          </span>
          {row.status && (
            <Badge tone={STATUS_TONE[row.status] ?? "slate"}>
              {row.status}
            </Badge>
          )}
          {row.confirmationNumber && (
            <span className="text-[10px] font-mono text-slate-500">#{row.confirmationNumber}</span>
          )}
        </div>

        {row.detail && (
          <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">{row.detail}</p>
        )}

        {/* Why there is no clock. Said on the row rather than once at the top, because the reason
            differs per event — a check-out has no column anywhere, a flight time is a customer's
            preference, a transfer has neither a start nor a duration. */}
        {row.time?.confidence !== "stated" && row.time?.note && (
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-relaxed">{row.time.note}</p>
        )}

        {/* The supplier, and how to reach them. This is what stands in for the missing check-out
            time: the operator rings the property and asks. vendorPhone is read LIVE off the vendor
            rather than snapshotted, precisely so somebody picks up. */}
        {(v?.name || v?.phone) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {v.name && <span className="text-[11px] font-bold text-slate-600 truncate max-w-[200px]">{v.name}</span>}
            {v.phone && (
              <a
                href={`tel:${v.phone}`}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                <Phone className="w-3 h-3" /> {v.phone}
              </a>
            )}
          </div>
        )}

        {/* An unassigned line is the thing an operator is looking for, so it is said out loud
            rather than left as an absence. */}
        {row.line && !v?.name && row.line.status !== "CANCELLED" && (
          <p className="text-[10px] font-extrabold text-rose-500 mt-1">No supplier named yet</p>
        )}
      </div>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param booking      The page's own copy — this panel never re-fetches it.
 * @param record       The ops record, handed down from OpsCheckpointPanel through the page. Null is
 *                     ORDINARY (records are provisioned at confirmation only), never an error.
 * @param recordLoaded Separates "no record" (ordinary) from "not asked yet", so the chase block can
 *                     explain the absence instead of leaving a hole where nine checkpoints would be.
 * @param refreshKey   Bumped by the page after any write below, so the day's lines re-read.
 */
export default function OpsTodayPanel({ booking, record, recordLoaded, refreshKey = 0 }) {
  const bookingPublicId = booking?.publicId || null;

  /* THE CLOCK IS RE-RESOLVED EVERY MINUTE, not once at mount. An operations desk leaves this page
     open all day; a panel that computed "today" when the tab was opened is showing yesterday's
     schedule by 00:05, with no indication that it has stopped moving. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tenantToday = useMemo(() => browserToday(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [tick]);

  /* ── Today's service lines ────────────────────────────────────────────────
     Fetched here rather than lifted out of OpsRowDetail: that component self-fetches by design and
     forking it to hoist its state would put two copies of the supplier editor in play. One extra
     GET of a small list is the cheaper trade. */
  const [lines, setLines] = useState([]);
  const [linesLoaded, setLinesLoaded] = useState(false);
  const [linesFailed, setLinesFailed] = useState(false);

  const loadLines = useCallback(async () => {
    if (!bookingPublicId) return;
    try {
      setLines(await operationsService.serviceItems(bookingPublicId));
      setLinesFailed(false);
    } catch (err) {
      // Not a toast: the page below is already showing this list and will have said so. A failed
      // read here means the schedule falls back to the itinerary as sold, which the panel labels.
      if (!isAlreadyReported(err)) console.warn("Today panel: service lines failed", err);
      setLines([]);
      setLinesFailed(true);
    } finally {
      setLinesLoaded(true);
    }
  }, [bookingPublicId]);

  useEffect(() => { loadLines(); }, [loadLines, refreshKey]);

  /* ── The model ────────────────────────────────────────────────────────────── */
  const model = useMemo(
    () => resolveToday({ booking, record, serviceItems: lines, today: tenantToday }),
    [booking, record, lines, tenantToday]
  );

  /* ── Which day is on screen ───────────────────────────────────────────────
     Defaults to today and FOLLOWS today across midnight, until the operator steps off it — at
     which point it stays where they put it. `pinned` is what tells those two apart. */
  const [viewDate, setViewDate] = useState(tenantToday);
  const pinned = useRef(true);
  useEffect(() => {
    if (pinned.current) setViewDate(tenantToday);
  }, [tenantToday]);

  const isToday = viewDate === tenantToday;

  const navMin = model.travelDate && model.travelDate < tenantToday ? model.travelDate : tenantToday;
  const navMaxEnd = model.effectiveEnd || model.travelDate || tenantToday;
  const navMax = navMaxEnd > tenantToday ? navMaxEnd : tenantToday;

  const step = (days) => {
    const next = addIsoDays(viewDate, days);
    if (!next || next < navMin || next > navMax) return;
    pinned.current = next === tenantToday;
    setViewDate(next);
  };
  const jumpToday = () => { pinned.current = true; setViewDate(tenantToday); };

  const facts = useMemo(() => dayFacts(model, viewDate), [model, viewDate]);
  const todayFacts = useMemo(() => dayFacts(model, tenantToday), [model, tenantToday]);

  const schedule = useMemo(
    () => buildSchedule({ model, booking, record, date: viewDate }),
    [model, booking, record, viewDate]
  );

  const chase = useMemo(
    () => buildChase({ model, record, date: viewDate, now }),
    [model, record, viewDate, now]
  );

  /* ── Who is travelling, and how to reach them ─────────────────────────────
     BookingResponseDTO carries NO customer phone or email — only the snapshot name. The single
     contact number anywhere in this payload is tripSnapshot.customerWhatsapp, so it serves as both
     the dial and the WhatsApp link rather than pretending two numbers exist.

     Counts come from tripSnapshot.travellers, which the entity documents as the SUMS of the room
     rows. Infants are counted in the headcount and named separately, because a hotel desk and an
     airline count them differently and an operator should not have to guess which we meant. */
  const party = useMemo(() => {
    const t = booking?.tripSnapshot?.travellers || {};
    const contact = booking?.tripSnapshot?.customerWhatsapp || null;
    const bits = [];
    const adults = Number(t.totalAdults) || 0;
    const children = Number(t.children) || 0;
    const infants = Number(t.infants) || 0;
    if (adults) bits.push(`${adults} adult${adults === 1 ? "" : "s"}`);
    if (children) bits.push(`${children} child${children === 1 ? "" : "ren"}`);
    if (infants) bits.push(`${infants} infant${infants === 1 ? "" : "s"}`);
    const extra = Number(t.extraBeds) || 0;
    if (extra) bits.push(`${extra} extra bed${extra === 1 ? "" : "s"}`);
    return {
      phone: contact,
      whatsapp: contact,
      headcount: bits.length ? bits.join(" · ") : null,
      rooms: t.rooms != null ? Number(t.rooms) : null,
    };
  }, [booking]);

  /* ── The quotation this was sold from (optional) ──────────────────────────
     Absent for any booking taken over the phone, and refused outright for an operations executive
     without QUOTATION_READ. Both are ordinary: the block simply does not render. */
  const quotationId = booking?.sourceQuotationPublicId || record?.sourceQuotationPublicId || null;
  const canReadQuotation = hasPermission(P.QUOTATION_READ);
  const [quotation, setQuotation] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!quotationId || !canReadQuotation) { setQuotation(null); return undefined; }
    (async () => {
      try {
        const q = await operationsService.quotation(quotationId);
        if (alive) setQuotation(q);
      } catch (err) {
        // 403 (no grant), 404 (deleted) and anything else all mean the same thing here.
        if (!isAlreadyReported(err)) console.warn("Today panel: quotation unavailable", err);
        if (alive) setQuotation(null);
      }
    })();
    return () => { alive = false; };
  }, [quotationId, canReadQuotation]);

  const quotationDay = useMemo(
    () => quotationDayFor(quotation, facts.index),
    [quotation, facts.index]
  );
  /* THE ONLY CHECK-IN / CHECK-OUT ANYWHERE IN THE PRODUCT.
     No hotel master, platform hotel, room type, policy or service line stores a check-in or
     check-out time — the panel's own check-out row has to render "not recorded" for exactly that
     reason. The sold quotation does carry them, as free text on QuotationHotel.checkIn/checkOut,
     and this is the one place a human ever wrote one down.

     Rendered VERBATIM and attributed to the quotation, never promoted into the schedule rows above:
     the column is an unvalidated String ("12 Noon", "before 11", "" are all legal), it belongs to
     the quotation rather than the booking, and the booking may have been edited since it was sold.
     Showing it as though the booking stated it would turn a sales note into an operational promise. */
  const quotationStays = useMemo(() => {
    const hotels = quotation?.hotel?.hotels;
    if (!Array.isArray(hotels)) return [];
    return hotels.filter((h) => h && (h.checkIn || h.checkOut || h.name));
  }, [quotation]);

  const quotationFlight = useMemo(
    () => quotationFlightOn(quotation, viewDate),
    [quotation, viewDate]
  );

  /* ── The fleet trip (optional) — the ONLY live signal in the product ──────── */
  const canReadFleet = hasPermission(P.FLEET_READ);
  const [fleetTrips, setFleetTrips] = useState([]);
  const [fleetLegs, setFleetLegs] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!bookingPublicId || !canReadFleet) { setFleetTrips([]); return undefined; }
    (async () => {
      try {
        const trips = await operationsService.fleetTrips(bookingPublicId);
        if (alive) setFleetTrips(Array.isArray(trips) ? trips : []);
      } catch (err) {
        if (!isAlreadyReported(err)) console.warn("Today panel: fleet trips unavailable", err);
        if (alive) setFleetTrips([]);
      }
    })();
    return () => { alive = false; };
  }, [bookingPublicId, canReadFleet, refreshKey]);

  /* A trip covering the viewed day. Trip datetimes are LocalDateTime (ISO, with a T), so the day
     is the first ten characters — never a Date parse. endDatetime is INCLUSIVE here: unlike a
     service line's endDate it is not reused as anything else's start. */
  const fleetTrip = useMemo(() => {
    const dayOf = (dt) => (dt ? String(dt).slice(0, 10) : null);
    return fleetTrips.find((t) => {
      const s = dayOf(t.startDatetime);
      const e = dayOf(t.endDatetime) || s;
      return s && viewDate >= s && viewDate <= e;
    }) || null;
  }, [fleetTrips, viewDate]);

  useEffect(() => {
    let alive = true;
    if (!fleetTrip?.publicId) { setFleetLegs([]); return undefined; }
    (async () => {
      try {
        const l = await operationsService.fleetTripLegs(fleetTrip.publicId);
        if (alive) setFleetLegs(Array.isArray(l) ? l : []);
      } catch (err) {
        if (!isAlreadyReported(err)) console.warn("Today panel: fleet legs unavailable", err);
        if (alive) setFleetLegs([]);
      }
    })();
    return () => { alive = false; };
  }, [fleetTrip?.publicId]);

  /* FleetTripLeg.covers() is half-open on instants. LocalDateTime with no offset parses as LOCAL
     in every browser, which is the right reading for a wall-clock column. */
  const liveLeg = useMemo(() => {
    if (!isToday) return null;
    return fleetLegs.find((l) => {
      const s = l.startDatetime ? new Date(l.startDatetime) : null;
      const e = l.endDatetime ? new Date(l.endDatetime) : null;
      if (!s) return false;
      return s <= now && (!e || now < e);
    }) || null;
  }, [fleetLegs, isToday, now]);

  /* ── Standing ─────────────────────────────────────────────────────────────── */
  const status = String(booking?.status || "").toUpperCase();
  const abandoned = status === "CANCELLED" || status === "REFUNDED";

  if (!booking) return null;

  /* The one-line answer. Every branch ends in "planned" or "as sold" — this is the first surface in
     the product that claims to know where a party is mid-trip, and it is arithmetic, not a fact. */
  const nowLine = (() => {
    const { phase, dayIndex, totalDays, daysToDeparture, travelDate, effectiveEnd } = model;
    // travelDate is NOT NULL on `bookings`, so this cannot normally happen — but "Day null" is the
    // shape a missing one would take, and it is not a sentence anybody should ever read.
    if (dayIndex == null) return "No travel date on this booking — there is no day to place it on";
    if (model.clockDisagreement) {
      return model.serverPhase === "AFTER"
        ? "The server says this trip has already ended"
        : "The server says this trip has not departed yet";
    }
    if (phase === PHASE.BEFORE) {
      return `Departs in ${daysToDeparture} day${daysToDeparture === 1 ? "" : "s"} · ${fmtDayLong(travelDate)}`;
    }
    if (phase === PHASE.DEPARTS_TOMORROW) return `Departs tomorrow · ${fmtDayLong(travelDate)}`;
    if (phase === PHASE.ENDED) return `Trip ended ${fmtDate(effectiveEnd)}`;

    const head = totalDays ? `Day ${dayIndex} of ${totalDays}` : `Day ${dayIndex}`;
    const f = todayFacts;
    let where = null;
    if (f.checkingOut && f.checkingIn) {
      where = `Check out of ${f.checkingOutPlace || "—"} · check in to ${f.checkingInPlace || "—"}`
        + (f.stay?.nightIndex ? ` · night ${f.stay.nightIndex} of ${f.stay.nightsTotal} in ${f.stay.place}` : "");
    } else if (f.stay?.nightIndex && f.stay?.nightsTotal) {
      where = `Night ${f.stay.nightIndex} of ${f.stay.nightsTotal} in ${f.stay.place || "—"}`;
    } else if (f.stay) {
      where = `In ${f.stay.place || "—"}`;
    } else if (f.isLastDay) {
      where = "Last day · returning";
    }
    return [head, where].filter(Boolean).join(" · ");
  })();

  const nowTone =
    model.clockDisagreement ? "text-amber-800"
    : model.phase === PHASE.ENDED ? "text-slate-500"
    : "text-slate-800";

  return (
    /* Panel's classes MINUS backdrop-blur-md, matching the service-lines wrapper below on this
       page. A non-none backdrop-filter makes an element the containing block for fixed-positioned
       descendants (Filter Effects L2), so anything that ever grows an overlay inside here would be
       sized to this box instead of the viewport. bg-white/90 stands in for the blur. */
    <div className="bg-white/90 rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

      {/* ── Header. The resolved date is ALWAYS printed, so a device with a wrong clock is
             visible rather than silently showing the wrong day's work. ─────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <Radar className="w-4 h-4 text-blue-600" />
        <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          Today · {fmtDayLong(tenantToday)}
        </p>

        <span
          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wide"
          title="Nothing in this product records that a trip started, was delayed or was changed. This position is today's date walked against the itinerary as it was sold."
        >
          <Info className="w-3 h-3" /> planned
        </span>

        {/* Day nav. An operator reading tomorrow's day still sees today's chase list re-scoped to
            the day they are on, which is the point — "what do I have to do for Thursday". */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => step(-1)}
            disabled={addIsoDays(viewDate, -1) < navMin}
            aria-label="Previous day"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-[11px] font-extrabold text-slate-600 tabular-nums min-w-[92px] text-center">
            {fmtDayLong(viewDate)}
          </span>
          <button
            onClick={() => step(1)}
            disabled={addIsoDays(viewDate, 1) > navMax}
            aria-label="Next day"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {!isToday && (
            <button
              onClick={jumpToday}
              className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── The now strip ────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-100">
        <p className={`text-sm font-extrabold ${nowTone}`}>
          {nowLine}
          {!model.clockDisagreement && (
            <span className="ml-2 text-[11px] font-bold text-slate-400">· planned, as sold</span>
          )}
        </p>

        {/* THE CLOCK CROSS-CHECK. hoursToDeparture was computed server-side on the tenant's clock;
            this device's date disagreeing with it by more than a whole day is the only evidence a
            browser can get that it is showing the wrong day. */}
        {model.clockDisagreement && (
          <p className="mt-1.5 inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
            <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>
              This device&rsquo;s date disagrees with the server — the server&rsquo;s phase is being
              shown, and today&rsquo;s schedule is withheld rather than derived from a clock that is
              in dispute. The server put departure {Math.abs(record?.hoursToDeparture ?? 0)}h
              {record?.hoursToDeparture > 0 ? " away" : " ago"} while this device reads{" "}
              {fmtDayLong(tenantToday)}.
            </span>
          </p>
        )}

        {model.totalDays == null && model.phase === PHASE.END_UNKNOWN && !model.clockDisagreement && (
          <p className="mt-1 text-[11px] font-bold text-slate-400">
            Trip end not recorded — no end date is stored on this booking, and one is never derived
            from the travel date plus nights.
          </p>
        )}

        {/* Which source dated the stays. The two can disagree, and the operator should know which
            they are reading: a hand-corrected line is a fact, the sold itinerary is an intention. */}
        {linesLoaded && (
          <p className="mt-1 text-[10px] font-bold text-slate-400">
            {model.staySource === "lines"
              ? "Days dated from the service lines."
              : model.staySource === "itinerary"
                ? "No stay lines yet — days dated from the itinerary as sold."
                : "No itinerary and no stay lines: only the travel date is known."}
            {linesFailed && " Service lines could not be read just now."}
          </p>
        )}
      </div>

      {abandoned && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 text-rose-500 shrink-0" />
          <p className="text-[11px] font-bold text-rose-800 leading-relaxed">
            This booking is {status.toLowerCase()}. What follows is the delivery record as it stood —
            nothing here should be arranged or chased.
          </p>
        </div>
      )}

      {/* ── The party ─────────────────────────────────────────────────────────
          Every supplier on this panel has a tel: link and the people actually travelling had
          none — on the screen an operator opens when a customer phones mid-trip. Counts sit here
          too: "who do I hand the keys to" and "how many are they" are the same question at a
          hotel desk, and the answer was two screens away. */}
      {(party.phone || party.whatsapp || party.headcount) && (
        <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Party</span>
          {/* customerNameSnapshot, NOT customerName. BookingResponseDTO says so in as many words:
              "customerName → replaced by customerNameSnapshot". Reading the old name yields
              undefined and prints a dash beside a live phone number. */}
          <span className="text-sm font-bold text-slate-800">
            {booking?.customerNameSnapshot || booking?.customerName || "—"}
          </span>

          {party.headcount && (
            <span className="text-[11px] font-bold text-slate-500">{party.headcount}</span>
          )}
          {party.rooms != null && (
            <span className="text-[11px] font-bold text-slate-500">
              {party.rooms} room{party.rooms === 1 ? "" : "s"}
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5">
            {party.phone && (
              <a href={`tel:${party.phone}`}
                 className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300">
                <Phone className="w-3 h-3" /> {party.phone}
              </a>
            )}
            {/* wa.me needs digits only — a stored "+91 98765 10001" produces a dead link otherwise. */}
            {party.whatsapp && (
              <a href={`https://wa.me/${party.whatsapp.replace(/\D/g, "")}`}
                 target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </a>
            )}
          </span>
        </div>
      )}

      {/* ── The day ──────────────────────────────────────────────────────────── */}
      <div className={abandoned ? "opacity-60" : ""}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            {isToday ? "Today’s schedule" : `${fmtDayLong(viewDate)} schedule`}
          </p>
          {facts.index != null && facts.inTrip && (
            <span className="text-[10px] font-bold text-slate-400">
              day {facts.index}{model.totalDays ? ` of ${model.totalDays}` : ""}
            </span>
          )}
          {/* Said once, at the top of the list, because it explains the whole column: the rows are
              in the order an operations day runs, not in time order — there is no time to order by. */}
          <span className="ml-auto text-[10px] font-bold text-slate-300">
            in event order — service lines carry no times
          </span>
        </div>

        {model.clockDisagreement && isToday ? (
          /* The list is date-derived and this device's date is the thing in dispute, so it is
             WITHHELD rather than guessed. The server-implied day cannot be computed here either —
             hoursToDeparture gives an instant, and turning an instant into a calendar day needs the
             tenant's timezone, which is on no tenant-facing response. The chase list below survives
             because its lapsed arm compares real timestamps and never asks what day it is. */
          <p className="px-4 pb-4 text-[11px] font-bold text-slate-400 leading-relaxed">
            The day&rsquo;s schedule is not shown while this device&rsquo;s date and the server
            disagree — a day picked off a wrong clock is worse than none. Step to a specific date
            above to read that day, or fix the device&rsquo;s date. Anything below with a real
            timestamp on it is unaffected.
          </p>
        ) : !facts.inTrip ? (
          <p className="px-4 pb-4 text-[11px] font-bold text-slate-400 leading-relaxed">
            {model.phase === PHASE.BEFORE || model.phase === PHASE.DEPARTS_TOMORROW
              ? "Nothing runs today — the party has not left. What matters before departure is the chase list below."
              : "Nothing runs on this day — it falls outside the trip."}
            {model.travelDate && (
              <> The trip runs {fmtDate(model.travelDate)}
                {model.effectiveEnd ? ` – ${fmtDate(model.effectiveEnd)}` : " onward (end date not recorded)"}.</>
            )}
          </p>
        ) : schedule.length === 0 ? (
          <p className="px-4 pb-4 text-[11px] font-bold text-slate-400 leading-relaxed">
            No dated line or itinerary leg lands on this day. That is not evidence nothing happens —
            a booking whose service lines were typed by hand carries only what somebody entered.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50 pb-1">
            {schedule.map((row) => <ScheduleRow key={row.key} row={row} />)}
          </ul>
        )}
      </div>

      {/* ── The sold quotation (optional) ────────────────────────────────────
             The ONLY per-day, per-activity plan with times anywhere in the product — and every one
             of those values is unvalidated free text. Rendered VERBATIM and in the quotation's own
             order: never parsed, never sorted by, never used to compute "next in 90 minutes". The
             heading names the quotation because the booking may have been edited since. */}
      {(quotationDay || quotationFlight || quotationStays.length > 0) && !abandoned && (
        <div className="px-4 py-3 border-t border-slate-100 bg-indigo-50/30">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <p className="text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider">
              From the quotation this was sold from
            </p>
            {quotationDay?.date && (
              <span className="text-[10px] font-bold text-slate-400">day {quotationDay.day} · {quotationDay.date}</span>
            )}
          </div>

          {Array.isArray(quotationDay?.activities) && quotationDay.activities.length > 0 && (
            <ul className="space-y-1.5">
              {quotationDay.activities.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-[86px] shrink-0 text-[11px] font-extrabold text-slate-600 tabular-nums">
                    {/* Verbatim. "15:00", "3 PM" and "afternoon" are all legal in this column. */}
                    {a.startTime || <span className="font-bold text-slate-300">—</span>}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">{a.attraction || "—"}</p>
                    {a.transfer && <p className="text-[10px] font-bold text-slate-400">{a.transfer}</p>}
                    {/* Meals exist ONLY on the quotation — nothing on the booking side stores them,
                        and they never carry a time. Tags, never a schedule row. */}
                    {Array.isArray(a.meals) && a.meals.length > 0 && (
                      <p className="text-[10px] font-bold text-emerald-700 mt-0.5">{a.meals.join(" · ")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {quotationFlight && (
            <p className="mt-2 text-[11px] font-bold text-slate-600">
              {[quotationFlight.airline, quotationFlight.flightNo].filter(Boolean).join(" ")}
              {quotationFlight.depTime ? ` · dep ${quotationFlight.depTime}` : ""}
              {quotationFlight.from || quotationFlight.to
                ? ` · ${quotationFlight.from || "—"} → ${quotationFlight.to || "—"}`
                : ""}
            </p>
          )}

          {/* Check-in / check-out. The panel's own CHECKOUT row says "time not recorded" because
              no such column exists on any hotel the BOOKING knows about — this is the only place
              anybody wrote one, and it is attributed to the quotation rather than promoted into the
              schedule. Shown for the whole stay list, not filtered to today, because a quoted stay
              carries no date this panel can trust to match against. */}
          {quotationStays.length > 0 && (
            <ul className="mt-2 space-y-1">
              {quotationStays.map((h, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                  <LogIn className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="font-extrabold text-slate-700">{h.name || "Hotel"}</span>
                  {h.city && <span className="font-bold text-slate-400">{h.city}</span>}
                  {h.checkIn && (
                    <span className="font-bold text-slate-600">in {h.checkIn}</span>
                  )}
                  {h.checkOut && (
                    <span className="font-bold text-slate-600">out {h.checkOut}</span>
                  )}
                  {h.roomType && <span className="font-bold text-slate-400">{h.roomType}</span>}
                  {h.mealPlan && <span className="font-bold text-slate-400">{h.mealPlan}</span>}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 text-[10px] font-bold text-slate-400 leading-relaxed">
            Quoted times are free text typed by whoever built the quotation, and the booking may have
            been changed since. They are shown as written and are not a confirmation.
          </p>
        </div>
      )}

      {/* ── Fleet: the one block allowed to say something is actually happening ── */}
      {fleetTrip && !abandoned && (
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <CarFront className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Own fleet</p>
            {fleetTrip.status === "ONGOING" && isToday ? (
              <Badge tone="green">OUT NOW</Badge>
            ) : (
              <Badge tone="slate">{fleetTrip.status}</Badge>
            )}
          </div>

          <p className="text-xs font-bold text-slate-700">
            {[fleetTrip.routeFrom, fleetTrip.routeTo].filter(Boolean).join(" → ") || fleetTrip.purpose || "Trip"}
            {(liveLeg?.vehicleNumber || fleetTrip.vehicleNumber)
              ? ` · ${liveLeg?.vehicleNumber || fleetTrip.vehicleNumber}` : ""}
            {(liveLeg?.driverName || fleetTrip.driverName)
              ? ` · ${liveLeg?.driverName || fleetTrip.driverName}` : ""}
          </p>

          {fleetTrip.status === "ONGOING" && isToday ? (
            <p className="mt-1 text-[10px] font-bold text-emerald-700 leading-relaxed">
              Somebody started this trip in the Vehicle Diary — the only genuinely live signal on this
              page. Note the start time shown by fleet is ONE column overwritten from planned to
              actual, so the planned hour is gone.
            </p>
          ) : (
            <p className="mt-1 text-[10px] font-bold text-slate-400 leading-relaxed">
              Planned in the Vehicle Diary. A trip entered after the fact never passes through
              ONGOING, so this status is not proof of anything either way.
            </p>
          )}
        </div>
      )}

      {/* ── The chase list ───────────────────────────────────────────────────
             ONE readiness model, never two. The checkpoints (moved by a human) where a record
             exists; the service lines (derived) where it does not. They can legitimately disagree,
             and showing both would make one thing green and red at once. */}
      {!abandoned && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              {isToday ? "Chase before this evening" : `Outstanding for ${fmtDate(viewDate)}`}
            </p>
            <span className="text-[10px] font-bold text-slate-400">
              {chase.model === "checkpoints" ? "from the checkpoints" : "from the service lines"}
            </span>
          </div>

          {/* Checkpoints. dueAt is the ONLY true clock cut-off in the booking domain — a
              timestamptz chosen over a DATE so it can say "the 18:00 cut-off". Lapsed first. */}
          {chase.model === "checkpoints" && chase.checkpoints.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {chase.checkpoints.map((c) => (
                <li key={c.publicId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                    c._lapsed || c._broken ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {c.shortCode}
                  </span>
                  <span className="text-xs font-bold text-slate-700">{c.label}</span>
                  <Badge tone={c.status === "REQUESTED" ? "blue" : "amber"}>
                    {c.status}
                  </Badge>
                  {c.sourceLabel && <span className="text-[10px] font-bold text-slate-400">{c.sourceLabel}</span>}
                  {c.vendorName && (
                    <span className="text-[11px] font-bold text-slate-600 truncate max-w-[160px]">{c.vendorName}</span>
                  )}
                  {c.confirmationNumber && (
                    <span className="text-[10px] font-mono text-slate-500">#{c.confirmationNumber}</span>
                  )}
                  {/* The amount rides on the payment checkpoint because a balance is a reason a
                      party should not leave. The DATE beside it is this checkpoint's own dueAt —
                      the only legitimate customer deadline in the product. There is NO customer
                      payment-due column on a booking anywhere, so none is invented here. */}
                  {c.checkpoint === "CUSTOMER_PAYMENT" && booking.pendingAmount > 0 && (
                    <span className="text-[11px] font-extrabold text-rose-600 tabular-nums">
                      {money(booking.pendingAmount)} outstanding
                    </span>
                  )}
                  {/* Only one of the nine checkpoints ever carries a dueAt — the supplier hold. The
                      rest are outstanding work with no recorded deadline, and saying "due —" for
                      those reads as a missing value rather than as the truth, which is that nobody
                      ever set a cut-off. Say which it is. */}
                  <span className={`ml-auto text-[10px] font-extrabold ${
                    c._lapsed || c._broken ? "text-rose-600" : c.dueAt ? "text-amber-600" : "text-slate-400"
                  }`}>
                    {c._lapsed ? `lapsed ${fmtWhen(c.dueAt)}`
                      : c.dueAt ? `due ${fmtWhen(c.dueAt)}`
                      : c._broken ? "needs re-sourcing"
                      : "no deadline recorded"}
                  </span>
                  {(c.note || c.derivationNote) && (
                    <p className="w-full text-[10px] font-bold text-slate-400 pl-8">{c.note || c.derivationNote}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* The v1 fallback: a state list, not a schedule, so it carries no times. */}
          {chase.model === "lines" && chase.openLines.length > 0 && (
            <ul className="space-y-1 mb-2">
              {chase.openLines.map((l) => (
                <li key={l.publicId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase w-16 shrink-0">
                    {l.serviceType || "—"}
                  </span>
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[240px]">{l.title}</span>
                  <Badge tone={STATUS_TONE[l.status] ?? "slate"}>
                    {l.status}
                  </Badge>
                  <span className={`text-[11px] font-bold ${l.vendorName ? "text-slate-600" : "text-rose-500"}`}>
                    {l.vendorName || "no supplier yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Holds are a DEADLINE, not a readiness verdict, so they sit outside the model split
              above. A NULL releaseDate means "no expiry was agreed" — never "expires today"; reading
              null as urgent is what turns every booking red. Only non-null, past-dated and still
              unconfirmed lines appear here. */}
          {chase.holds.length > 0 && (
            <div className="mt-1">
              <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider mb-1">
                Supplier holds
              </p>
              <ul className="space-y-1">
                {chase.holds.map((l) => (
                  <li key={`hold-${l.publicId}`} className="flex flex-wrap items-center gap-x-2">
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[240px]">{l.title}</span>
                    <span className="text-[11px] font-extrabold text-rose-600">
                      Hold lapsed {fmtDate(l.releaseDate)}
                    </span>
                    {l.vendorName && <span className="text-[11px] font-bold text-slate-500">{l.vendorName}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* THE GREEN TICK IS THE MOST DANGEROUS SENTENCE ON THIS PANEL, so it is gated on the
              request that feeds it having actually come back. Both arms of the chase list are
              built from the service lines — the whole open-line arm in the `lines` model, and
              the supplier holds in BOTH — so an unread list makes "nothing to chase" an unknown
              answer wearing a tick. `lines` defaults to [] on a failed read, which is what made
              a 500 on /services render as a clear day. */}
          {chase.empty && (
            linesLoaded && !linesFailed ? (
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                {chase.model === "checkpoints"
                  ? "No checkpoint is due or lapsed for this day, and no supplier hold has run out."
                  : "Nothing dated to this day is outstanding."}
              </p>
            ) : (
              <p className="inline-flex items-start gap-1.5 text-[11px] font-bold text-slate-500">
                <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                {linesFailed
                  ? "The service lines could not be read just now, so supplier holds — and anything outstanding on a line — are unknown for this day rather than clear. Reload before treating it as done."
                  : "Still reading the service lines for this day…"}
              </p>
            )
          )}

          {/* A booking with no record is the ORDINARY case, not a gap: records are provisioned at
              confirmation only, and the backfill is off by default. */}
          {recordLoaded && !record && (
            <p className="mt-2 text-[10px] font-bold text-slate-400 leading-relaxed">
              This booking has no checkpoint record — ordinary for anything confirmed before the
              model shipped, and for anything still pending. The lines above are the only readiness
              answer there is for it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
