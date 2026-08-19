// features/operations/pages/OperationsDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One booking, asked the DELIVERY question: can this party leave, and what has to happen today.
//
// WHY THIS IS NOT /BookingDetails/:id. That screen answers the record question — what was sold,
// what is owed, what was invoiced — and answers it well. It already carries the money breakdown,
// the payment history, every voucher and invoice, the quotation's itinerary, the customer card,
// the audit trail and the status transitions. NONE of that is repeated here. What an operator
// cannot get there is on this page: the nine checkpoints and the departure countdown, the
// per-line supplier hold and its release date, and one-tap supplier contact that is logged
// against the booking. The money on this page is three read-only figures and a link, because a
// balance is a reason a trip cannot leave — not because this is a second finance screen.
//
// COMPOSED FROM THE BOOKING, NOT FROM A BOARD ROW. Nothing in the API returns one board row:
// /operations/board is windowed to the tenant's today (span capped at 92 days), only selects
// CONFIRMED/PENDING/COMPLETED, and searches bookingCode and customer name — never a publicId. A
// page built on it would work in dev, where you always arrive by clicking a row that is already
// in the window, and come back empty on a deep link to a trip six months out, one that has
// departed, or a cancelled one. So the page reads GET /bookings/{publicId} (which is also the
// only read that carries tripSnapshot) and lets the two ops components fetch their own.
//
// A BOOKING WITH NO OPS RECORD IS THE ORDINARY CASE, not an error: records are provisioned at
// confirmation, so every pending sale and everything confirmed before the checkpoint model
// shipped has none, and the endpoint 404s rather than returning an empty list. The page must be
// fully useful then — service lines, trip, money and all — and must say why the checkpoints are
// absent instead of showing nine empty rows that read as "nothing is arranged".
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Radar, ArrowLeft, RefreshCw, ShieldCheck, TriangleAlert, MapPin, Users, Bed, Car,
  Wallet, PlaneTakeoff, Clock, UserCog, ExternalLink, Loader2, Ban, Route, Info,
  Accessibility, NotebookPen,
} from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";
// Cross-feature through the barrel only. The ops screens share the notification SSE stream
// rather than opening a second EventSource per tab.
import { notificationService } from "@features/reminders";

import { Page, Panel, Badge, GridEmpty, SeverityBadge, DepartureCountdown, DaysBadge } from "../components/opsUi";
import OpsCheckpointPanel from "../components/OpsCheckpointPanel";
import OpsTodayPanel from "../components/OpsTodayPanel";
import OpsRowDetail from "../components/OpsRowDetail";
import operationsService from "../api/operationsService";

/* ── Formatting ────────────────────────────────────────────────────────────── */

const money = (n) =>
  n == null ? "—" : `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null;

const fmtDateFull = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

/**
 * For the OffsetDateTime fields (departureAt, pickupAt) — already zoned by the server, so the
 * wall clock is READ OUT of the string rather than recomputed from the instant.
 *
 * `new Date(iso).toLocaleString(...)` re-zones into the BROWSER's zone, which is not the tenant's:
 * a 05:30 IST pickup prints "12:00 am" on a device set to UTC. It also made the two halves of
 * `fmtWhen(record.pickupAt) || fmtWhen(dep.pickupDateTime)` below behave differently — the second
 * is a LocalDateTime with no offset and never shifted, the first did. The parts are rebuilt as a
 * local Date purely to reuse the locale's formatting.
 */
const WHEN_PARTS = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const fmtWhen = (iso) => {
  if (!iso) return null;
  const m = WHEN_PARTS.exec(String(iso));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** LocalTime arrives as "HH:mm" or "HH:mm:ss"; nobody needs the seconds. */
const fmtTime = (t) => (t ? String(t).slice(0, 5) : null);

/** Browser-side day count. Only ever used where the server has no answer — see the header. */
const daysUntil = (iso) => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`) - today) / 86400000);
};

/**
 * `departure.preferredTime` is ONE key that folds the flight time or the train time depending on
 * the mode — reading it without checking the mode prints a train's departure under "Flight time".
 * The mode arrives as its displayName ("Flight / Airport", "Train / Rail", "Car / Road", "Bus",
 * "Other"), never the enum name, so the compares are against those exact spellings.
 */
const preferredTimeLabel = (mode) =>
  mode === "Flight / Airport" ? "Flight time"
  : mode === "Train / Rail" ? "Train time"
  : "Preferred time";

/** Statuses that make delivery work pointless or premature — each says so at the top of the page. */
const STATUS_NOTE = {
  CANCELLED: {
    tone: "rose",
    icon: Ban,
    text: "This booking is cancelled. Nothing further should be arranged, and the settlement position lives on its cancellation record — not in the balance below.",
  },
  REFUNDED: {
    tone: "rose",
    icon: Ban,
    text: "This booking has been refunded. Nothing further should be arranged, and the settlement position lives on its cancellation record — not in the balance below.",
  },
  PENDING: {
    tone: "amber",
    icon: TriangleAlert,
    text: "This booking is not confirmed yet. Its checkpoints are created at confirmation, so there is no operational record to work until then.",
  },
  COMPLETED: {
    tone: "slate",
    icon: ShieldCheck,
    text: "This trip is completed. It stays here so the delivery record can still be read.",
  },
};

/** The four PaymentStatus values, and nothing invented: an unknown one falls through to slate. */
const PAY_TONE = { PAID: "green", PARTIAL: "amber", UNPAID: "red", REFUNDED: "slate" };

const NOTE_TONE = {
  rose: "bg-rose-50 border-rose-200 text-rose-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  slate: "bg-slate-50 border-slate-200 text-slate-600",
};

/* ── Rail primitives ───────────────────────────────────────────────────────── */

function RailSection({ icon: Icon, title, children, hint }) {
  return (
    <div className="border-b border-slate-100 last:border-0 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">{title}</p>
        {hint && <span className="ml-auto text-[10px] font-bold text-slate-300">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="text-[11px] font-bold text-slate-400 shrink-0">{label}</span>
      <span className="text-xs font-bold text-slate-700 text-right ml-auto">{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function OperationsDetail() {
  // Same gate as the board (router.jsx guards the route with it too): the page shows booking
  // data and nothing else. Writes are gated separately and per surface — service lines on
  // BOOKING_UPDATE inside OpsRowDetail, checkpoints and the ops owner on OPS_MANAGE.
  const allowed = hasPermission(P.BOOKING_READ);
  const canManageOps = hasPermission(P.OPS_MANAGE);

  const { bookingPublicId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  /* The ops record is NOT fetched here. OpsCheckpointPanel already fetches it, and hands it up
     through onRecord — one request, and one answer: confirming the last mandatory checkpoint
     moves the header's READY TO TRAVEL in the same breath, which a second independent copy
     would not do until something re-fetched it. `recordLoaded` separates "no record" (ordinary)
     from "not asked yet"; `recordError` separates it from "the request failed". */
  const [record, setRecord] = useState(null);
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [recordError, setRecordError] = useState(null);

  const [ownerBusy, setOwnerBusy] = useState(false);

  // Remounts the two ops panels on demand. A reload that is not asked for would throw away a
  // half-typed confirmation number in the panel underneath it, so a change made elsewhere is
  // offered rather than applied.
  const [panelKey, setPanelKey] = useState(0);
  const [stale, setStale] = useState(false);
  // When this tab last wrote. Our own writes come back to us over the tenant-wide SSE stream,
  // and a banner saying the booking changed elsewhere — right after the panel already reloaded
  // itself from the write's response — is a lie with a button on it.
  const selfWriteAt = useRef(0);

  /* Counts writes made anywhere below, so the Today panel re-reads the day's service lines without
     being remounted. `panelKey` cannot do this job: remounting the Today panel would throw away the
     day the operator has stepped to, and every checkpoint write below would silently bounce them
     back to today mid-chase. */
  const [dataVersion, setDataVersion] = useState(0);

  /* ── The booking ─────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!bookingPublicId) return;
    setLoading(true);
    try {
      const data = await operationsService.booking(bookingPublicId);
      setBooking(data);
      setNotFound(!data);
      setFailed(false);
    } catch (err) {
      // 404 and 400 are SILENT at the interceptor by policy, so a deep link to a booking this
      // user may not see would otherwise render a blank page with no explanation anywhere.
      if (err?.response?.status === 404) {
        setNotFound(true);
        setBooking(null);
      } else if (!isAlreadyReported(err)) {
        setFailed(true);
        toast.error(getErrorMessage(err, "Could not load this booking"));
      } else {
        setFailed(true);
      }
      // Anything already on screen is KEPT on a failed refresh. A dropped connection while an
      // operator is mid-chase must not replace a working page with an error card — the toast
      // (or the interceptor's) already said what happened, and the facts on screen are seconds
      // old rather than wrong.
    } finally {
      setLoading(false);
    }
  }, [bookingPublicId]);

  useEffect(() => { load(); }, [load]);

  /* ── Somebody else moved something on THIS booking ───────────────────────
     The push is a ping — { bookingPublicId, checkpointPublicId, rowVersion } — because the
     stream is tenant-wide and filters neither permissions nor sub-agent row scope. So this
     refetches and never patches state from the payload. It is also best-effort with no replay
     on reconnect, which is why the Refresh button stays. */
  const onPing = useCallback((payload) => {
    if (payload?.bookingPublicId !== bookingPublicId) return;
    if (Date.now() - selfWriteAt.current < 5000) return;
    setStale(true);
    // The page's own copy has no editor in it, so it can be refreshed without asking. The Today
    // panel is in the same position — it holds no draft, only the day being viewed, which the
    // version bump deliberately does not disturb.
    setDataVersion((v) => v + 1);
    load();
  }, [bookingPublicId, load]);

  useEffect(() => {
    if (!allowed) return undefined;
    const sub = notificationService.subscribeToSSE({ opsCheckpoint: onPing, opsRecord: onPing });
    return () => sub?.close?.();
  }, [allowed, onPing]);

  /** Anything written from a child panel. */
  const handleChanged = useCallback(() => {
    selfWriteAt.current = Date.now();
    setDataVersion((v) => v + 1);
    load();
  }, [load]);

  const handleRecord = useCallback((next, err) => {
    setRecord(next);
    /* A 404 IS the "no record" answer, not a failure. OpsCheckpointService throws
       ResourceNotFoundException ("This booking has no operations record yet. It is created when
       the booking is confirmed."), so the panel's fetch REJECTS on the single most common case —
       every pending sale and everything confirmed before the checkpoint model shipped. Treating
       that rejection as an error made this page tell the ordinary majority of bookings "Could not
       load the checkpoints" and offer a Try again button that can only 404 again. Only a genuine
       failure — 500, a dropped connection, a 403 — is an error here. */
    const genuineFailure = err && err?.response?.status !== 404;
    setRecordError(genuineFailure ? err : null);
    setRecordLoaded(true);
  }, []);

  const reloadEverything = useCallback(() => {
    setStale(false);
    setPanelKey((k) => k + 1);
    setDataVersion((v) => v + 1);
    load();
  }, [load]);

  /* ── Ops owner ───────────────────────────────────────────────────────────
     Clearing works; naming somebody does not, and the reason is in the API rather than here:
     PUT /operations/bookings/{id}/owner takes ?userId=<internal Long>, and no endpoint in the
     product returns an internal user id — /bookings/assignment/eligible-users, /users/dropdown,
     /users/available and /users all expose publicId UUIDs only, and no ops response resolves
     opsOwnerUserId to a name. Rather than invent a picker that cannot be populated (or a raw
     numeric box that would happily set an id belonging to another tenant — the server does not
     validate it), the page offers the half that is real and says why the other half is missing. */
  const releaseOwner = async () => {
    if (!canManageOps || ownerBusy) return;
    setOwnerBusy(true);
    try {
      selfWriteAt.current = Date.now();
      const updated = await operationsService.assignOpsOwner(bookingPublicId, null);
      if (updated) setRecord(updated);
      toast.success("Handed back to the operations pool");
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not change the operations owner"));
    } finally {
      setOwnerBusy(false);
    }
  };

  /* ── Derived facts ───────────────────────────────────────────────────────── */
  const snap = booking?.tripSnapshot || null;
  const trav = snap?.travellers || {};
  const dep = snap?.departure || null;
  const drop = snap?.drop || null;
  const legs = Array.isArray(snap?.itinerary) ? snap.itinerary : [];
  const rooms = Array.isArray(snap?.roomRequirements) ? snap.roomRequirements : [];
  const vehicles = Array.isArray(snap?.vehicleRequirements) ? snap.vehicleRequirements : [];
  const assistance = snap?.specialAssistance || null;

  // The board's convention, kept so the two screens cannot disagree: infants are excluded
  // because this number sizes rooms and seats. There is no pax field on the booking at all.
  const pax = (Number(trav.totalAdults) || 0) + (Number(trav.children) || 0);
  const nights = legs.reduce((sum, leg) => sum + (Number(leg?.nights) || 0), 0);

  /* The end of the trip. There is no tripEndDate at the booking root — it exists only on the
     trip snapshot (which is what the ops board joins) and on the ops record. Taking the
     snapshot's first keeps this page and the row it was opened from printing the same window;
     BookingDetails derives its own from travelDate + nights, and the two can differ. Where
     neither is stored, this says so rather than inventing the missing date. */
  const tripEndDate = snap?.tripEndDate ?? record?.tripEndDate ?? null;

  const status = (booking?.status || "").toUpperCase();
  const settlementElsewhere = status === "CANCELLED" || status === "REFUNDED";
  const statusNote = STATUS_NOTE[status];

  /**
   * The six keys OpsRowDetail reads off a board row, built from the booking instead.
   *
   * Only bookingPublicId is used in standalone mode (the page header carries the rest), but the
   * whole shape is supplied so the component is not silently depending on the flag.
   */
  const entry = useMemo(() => {
    if (!booking) return null;
    return {
      bookingPublicId: booking.publicId,
      bookingCode: booking.bookingCode,
      customerName: booking.customerNameSnapshot,
      pax,
      travelDate: booking.travelDate,
      tripEndDate,
      balanceDue: booking.pendingAmount,
    };
  }, [booking, pax, tripEndDate]);

  /* ── Shells ──────────────────────────────────────────────────────────────── */

  if (!allowed) {
    return (
      <Page icon={Radar} title="Operations" crumb="Operations">
        <Panel>
          <GridEmpty
            icon={Radar}
            title="You don't have access to Operations"
            hint="Ask your administrator for the Bookings permission."
          />
        </Panel>
      </Page>
    );
  }

  const backButton = (
    <Link
      to="/operations"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
    >
      <ArrowLeft className="w-4 h-4" /> Operations board
    </Link>
  );

  if (loading && !booking) {
    return (
      <Page icon={Radar} title="Loading…" crumb="Operations · delivery" actions={backButton}>
        <Panel className="px-5 py-16">
          <p className="text-center text-xs font-bold text-slate-400">Loading this booking…</p>
        </Panel>
      </Page>
    );
  }

  if (notFound || (!booking && !loading)) {
    return (
      <Page icon={Radar} title="Booking not found" crumb="Operations · delivery" actions={backButton}>
        <Panel>
          <GridEmpty
            icon={Radar}
            title={notFound ? "No booking with that reference" : "Could not load this booking"}
            hint={
              notFound
                ? "It may have been deleted, or it belongs to another agency. Go back to the board and open it from there."
                : "Check the connection and try again."
            }
          />
          {failed && !notFound && (
            <div className="px-5 pb-5 text-center">
              <button
                onClick={load}
                className="px-3.5 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
              >
                Try again
              </button>
            </div>
          )}
        </Panel>
      </Page>
    );
  }

  /* ── The page ────────────────────────────────────────────────────────────── */

  const daysOut = daysUntil(booking.travelDate);
  const ownerId = record?.opsOwnerUserId ?? null;

  return (
    <Page
      icon={Radar}
      title={booking.bookingCode || "Booking"}
      crumb="Operations · what has to happen before this party can leave"
      actions={
        <div className="flex items-center gap-2">
          {backButton}
          <button
            onClick={reloadEverything}
            title="Refresh"
            aria-label="Refresh this booking"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">

        {/* ── Sticky identity + standing ────────────────────────────────────
            Full-bleed inside <Page/>'s padded container, so it reads as a bar rather than a
            card, and sticks to the top of Layout's <main>, which is the scrollport.

            The severity, countdown and ready-to-travel also appear on the checkpoint card
            below — deliberately. This bar is what stays on screen while the operator scrolls
            through nine checkpoints and a dozen service lines, and both are rendered from the
            same record by the same two components, so they cannot disagree. */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/85 backdrop-blur border-b border-slate-200/70">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-sm font-extrabold text-slate-800 truncate max-w-[240px]">
              {booking.customerNameSnapshot || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {booking.destinationSnapshot || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="tabular-nums text-slate-700">{pax || "—"}</span> pax
            </span>
            <span className="text-xs font-bold text-slate-500">
              <span className="text-slate-700">
                {fmtDateFull(booking.travelDate) || "—"}
                {tripEndDate ? ` – ${fmtDate(tripEndDate)}` : ""}
              </span>
              <span className="ml-1.5 text-slate-400">
                {tripEndDate ? "" : nights > 0 ? `· ${nights} nights, end date not set` : "· end date not set"}
              </span>
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Where a record exists, its severity and its HOURS are what somebody recorded
                  against the tenant's clock. Where it does not, the only honest fallback is a
                  day count computed in the browser — labelled as days, never as hours, so it
                  cannot be mistaken for the checkpoint model's countdown. */}
              {record ? (
                <>
                  <SeverityBadge severity={record.severity} />
                  <DepartureCountdown
                    hours={record.hoursToDeparture}
                    sourceLabel={record.departureAtSourceLabel}
                  />
                  {record.readyToTravel ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" /> READY TO TRAVEL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700">
                      <TriangleAlert className="w-3.5 h-3.5" /> MANDATORY WORK OPEN
                    </span>
                  )}
                </>
              ) : (
                <DaysBadge days={daysOut} />
              )}
            </div>
          </div>

          {/* Ops owner. Distinct from the booking's assignedUserName (who SOLD it) — that is
              on the booking screen, and conflating the two is how "who is chasing this" stops
              having an answer. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <UserCog className="w-3.5 h-3.5" /> Operations owner
            </span>
            {!recordLoaded ? (
              <span className="text-[11px] font-bold text-slate-300">…</span>
            ) : !record ? (
              <span className="text-[11px] font-bold text-slate-400">
                Needs an operations record — see below
              </span>
            ) : ownerId == null ? (
              <>
                <Badge tone="amber">Unassigned</Badge>
                {canManageOps && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400"
                    title="PUT /operations/bookings/{id}/owner takes an internal user id, and every user endpoint in the product returns public ids only. Naming an owner from here needs that endpoint to accept a publicId."
                  >
                    <Info className="w-3 h-3" />
                    Naming an owner is not available yet — the API exposes no user list to pick from
                  </span>
                )}
              </>
            ) : (
              <>
                <Badge tone="blue">
                  {/* The API returns the raw internal id and resolves no name for it, so this
                      says exactly what it knows rather than dressing an integer up as a person. */}
                  Assigned · user #{ownerId}
                </Badge>
                {canManageOps && (
                  <button
                    onClick={releaseOwner}
                    disabled={ownerBusy}
                    title="Hand this booking back to the operations pool"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 disabled:opacity-50"
                  >
                    {ownerBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Release
                  </button>
                )}
              </>
            )}

            {stale && (
              <button
                onClick={reloadEverything}
                className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                <RefreshCw className="w-3 h-3" />
                Somebody else changed this booking — reload
              </button>
            )}
          </div>
        </div>

        {/* ── Why this booking may not be workable ──────────────────────────── */}
        {statusNote && (
          <div className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl border ${NOTE_TONE[statusNote.tone]}`}>
            <statusNote.icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs font-bold leading-relaxed">{statusNote.text}</p>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start">

          {/* ══ Left: the work ══════════════════════════════════════════════ */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* ── Where this party is right now, and what happens today ──────────
                FIRST, and in the LEFT column rather than the right rail, because this is WORK
                rather than a description of what was sold — and because a timed day needs the 1fr
                width, not 360px.

                It takes the booking and the record as PROPS: the record is already in this page's
                hands (OpsCheckpointPanel fetches it and hands it up through onRecord), so the now
                strip costs no request at all and cannot disagree with the countdown in the header
                bar above it. The panel fetches only its own optional enrichments — the day's
                service lines, the sold quotation, the fleet trip — each of which may legitimately
                be empty or refused.

                `recordLoaded` is passed rather than inferred from `record` being null, because the
                panel cross-checks the browser's date against the server's hoursToDeparture and must
                not flash a "your clock is wrong" note in the gap before that value has arrived. */}
            <OpsTodayPanel
              booking={booking}
              record={record}
              recordLoaded={recordLoaded}
              refreshKey={dataVersion}
            />

            {/* The nine checkpoints. Rendered by the SAME component the expanded board row
                uses — it self-fetches, self-gates on OPS_MANAGE, and renders NOTHING when
                there is no record. The explanation for that case is the page's job, below. */}
            <OpsCheckpointPanel
              key={`cp-${panelKey}`}
              bookingPublicId={bookingPublicId}
              onChanged={handleChanged}
              onRecord={handleRecord}
            />

            {recordLoaded && !record && (
              <Panel className="px-4 py-4">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs font-extrabold text-slate-700 mb-1">
                      {recordError ? "Could not load the checkpoints" : "No checkpoint record for this booking"}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                      {recordError
                        ? "The nine checkpoints could not be read just now. Everything else on this page is current."
                        : status === "PENDING"
                          ? "Checkpoints are created when a booking is confirmed. Confirm this one on the booking screen and its nine appear here."
                          : "Records are created at confirmation, so anything confirmed before the checkpoint model shipped has none. Nothing is missing — readiness for this booking is what the service lines below say."}
                    </p>
                    {recordError && (
                      <button
                        onClick={() => setPanelKey((k) => k + 1)}
                        className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              </Panel>
            )}

            {/* The service lines, with supplier assignment, hold dates, and logged email /
                WhatsApp / call. The SAME component the board expands, in page mode: no fork,
                no copied markup. `entry` is only mounted once the booking has loaded — its
                header strip reads six fields unguarded, and a null there is a crash, not a
                blank. */}
            {/* Panel's own classes, MINUS `backdrop-blur-md` and `overflow-hidden`, and that
                omission is load-bearing rather than cosmetic. OpsRowDetail renders the supplier
                drawer and the email / WhatsApp / call modals as `fixed inset-0` children of
                itself. A non-none `backdrop-filter` makes an element the containing block for
                its fixed-positioned descendants (Filter Effects L2), so inside a <Panel/> those
                overlays stop being viewport-sized and become box-sized — and `overflow-hidden`
                then clips them. On the board that box is a full-width table so it merely looks
                odd; here the box is the LEFT COLUMN of a 1fr/360px grid, only as tall as the
                service lines, which would leave the page's headline action — one-tap supplier
                contact — rendering as a squashed, clipped card. bg-white/90 stands in for the
                blur so the surface still reads the same. */}
            <div className="bg-white/90 rounded-2xl border border-slate-200/60 shadow-sm px-4 py-4">
              {entry && (
                <OpsRowDetail
                  key={`lines-${panelKey}`}
                  entry={entry}
                  standalone
                  onChanged={handleChanged}
                  /* No onOpenLedger: the money rail already links to the ledger, and two
                     buttons to one screen is how a page starts looking like a duplicate.
                     No onClose either — this is a page, and the way out is the back link. */
                />
              )}
            </div>
          </div>

          {/* ══ Right: the trip, and what it costs to leave ══════════════════ */}
          <aside className="flex flex-col gap-4 min-w-0">

            {/* ── Trip at a glance ─────────────────────────────────────────── */}
            <Panel className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-extrabold text-slate-700">Trip at a glance</p>
                <p className="text-[10px] font-bold text-slate-400">
                  What was sold, as the operator has to deliver it
                </p>
              </div>

              {!snap ? (
                <p className="px-4 py-4 text-[11px] font-bold text-slate-400">
                  This booking was taken without a trip sheet — no route, travellers, rooms or
                  pickup were captured. The service lines are the only description of it.
                </p>
              ) : (
                <>
                  {/* The route reads pickup → leg → leg → drop, day by day. A leg's `city` is the
                      TO half — where the nights are actually spent — and `fromCity` the FROM;
                      printing only the city would turn a transfer day into a stay. */}
                  <RailSection icon={Route} title="Route" hint={nights > 0 ? `${nights}N total` : undefined}>
                    {legs.length === 0 && !dep && !drop ? (
                      <p className="text-[11px] font-bold text-slate-400">No route captured</p>
                    ) : (
                      <ol className="space-y-1">
                        {(dep?.city || dep?.country) && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-8 shrink-0 text-[9px] font-extrabold text-slate-300">PICK</span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {[dep.city, dep.country].filter(Boolean).join(", ")}
                            </span>
                          </li>
                        )}
                        {legs.map((leg, i) => (
                          <li key={i} className="flex items-baseline gap-2">
                            <span className="w-8 shrink-0 text-[9px] font-extrabold text-slate-300 tabular-nums">
                              {leg.dayNumber ? `D${leg.dayNumber}` : "·"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 min-w-0">
                              {leg.fromCity && <span className="text-slate-400">{leg.fromCity} → </span>}
                              {leg.city || leg.destination || "—"}
                            </span>
                            {leg.nights ? (
                              <span className="ml-auto text-[11px] font-extrabold text-sky-600 tabular-nums">
                                {leg.nights}N
                              </span>
                            ) : null}
                          </li>
                        ))}
                        {(drop?.city || drop?.country) && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-8 shrink-0 text-[9px] font-extrabold text-slate-300">DROP</span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {[drop.city, drop.country].filter(Boolean).join(", ")}
                            </span>
                          </li>
                        )}
                      </ol>
                    )}
                  </RailSection>

                  {/* Pickup. The record's pickupAt is preferred where it exists because that is
                      the time the countdown at the top of this page is computed from — showing
                      a different one here would make the two disagree on the same screen. */}
                  {(dep || record?.pickupAt || record?.pickupLocation) && (
                    <RailSection icon={PlaneTakeoff} title="Departure & pickup">
                      <KV label="Mode" value={dep?.mode} />
                      <KV
                        label="From"
                        value={[dep?.city, dep?.country].filter(Boolean).join(", ") || null}
                      />
                      <KV
                        label="Boarding"
                        value={
                          dep?.airport
                            ? `${dep.airport}${dep.airportCode ? ` (${dep.airportCode})` : ""}`
                            : dep?.railwayStation || null
                        }
                      />
                      <KV label="Class" value={dep?.trainClass} />
                      <KV label={preferredTimeLabel(dep?.mode)} value={fmtTime(dep?.preferredTime)} />
                      <KV label="Pickup from" value={record?.pickupLocation || dep?.pickupAddress} />
                      <KV
                        label="Pickup at"
                        value={
                          fmtWhen(record?.pickupAt)
                          || fmtWhen(dep?.pickupDateTime)
                          || fmtTime(dep?.pickupTime)
                        }
                      />
                      <KV label="Vehicle wanted" value={dep?.vehiclePreference} />
                      {record?.departureAt && (
                        <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                          Countdown runs from {fmtWhen(record.departureAt)}
                          {record.departureAtSourceLabel ? ` · ${record.departureAtSourceLabel}` : ""}
                        </p>
                      )}
                    </RailSection>
                  )}

                  {/* Drop. Four fields is all the model has — no airport, no address, and no
                      date, so none is implied here. `mode` is free text on this side, not the
                      departure enum. */}
                  {drop && (drop.city || drop.country || drop.mode || drop.time) && (
                    <RailSection icon={MapPin} title="Drop">
                      <KV label="At" value={[drop.city, drop.country].filter(Boolean).join(", ") || null} />
                      <KV label="Mode" value={drop.mode} />
                      <KV label="Time" value={fmtTime(drop.time)} />
                    </RailSection>
                  )}

                  <RailSection icon={Users} title="Travellers" hint={`${pax || 0} pax`}>
                    <KV label="Adults" value={trav.totalAdults ?? null} />
                    <KV label="Children" value={trav.children ?? null} />
                    {/* Counted separately everywhere because an infant needs a seat from nobody
                        and a bed from nobody — and is still a person to be accounted for. */}
                    <KV label="Infants" value={trav.infants ?? null} />
                    <KV label="Male / female" value={
                      trav.male != null || trav.female != null
                        ? `${trav.male ?? 0} / ${trav.female ?? 0}`
                        : null
                    } />
                    <KV label="Rooms" value={trav.rooms ?? null} />
                    <KV label="Extra beds" value={trav.extraBeds ?? null} />
                  </RailSection>

                  {rooms.length > 0 && (
                    <RailSection icon={Bed} title="Rooms wanted">
                      <ul className="space-y-1">
                        {rooms.map((r, i) => (
                          <li key={i} className="text-xs font-bold text-slate-700">
                            {r.count ? `${r.count} × ` : ""}{r.roomType || "Room"}
                            {r.acType ? <span className="text-slate-400"> · {r.acType}</span> : null}
                            {r.extraBeds ? <span className="text-slate-400"> · +{r.extraBeds} extra bed</span> : null}
                          </li>
                        ))}
                      </ul>
                    </RailSection>
                  )}

                  {vehicles.length > 0 && (
                    <RailSection icon={Car} title="Vehicles wanted">
                      <ul className="space-y-1">
                        {vehicles.map((v, i) => (
                          <li key={i} className="text-xs font-bold text-slate-700">
                            {v.quantity ? `${v.quantity} × ` : ""}{v.model || v.vehicleType || "Vehicle"}
                            {v.capacity ? <span className="text-slate-400"> · {v.capacity} seats</span> : null}
                          </li>
                        ))}
                      </ul>
                    </RailSection>
                  )}

                  {/* Loud on purpose: a wheelchair nobody arranged is found at the airport. */}
                  {assistance?.required && (
                    <RailSection icon={Accessibility} title="Special assistance">
                      <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-xs font-extrabold text-amber-800">
                          Required{assistance.passengerCount ? ` · ${assistance.passengerCount} traveller(s)` : ""}
                        </p>
                        {Array.isArray(assistance.types) && assistance.types.length > 0 && (
                          <p className="text-[11px] font-bold text-amber-700 mt-0.5">
                            {assistance.types.join(", ")}
                          </p>
                        )}
                        {assistance.notes && (
                          <p className="text-[11px] font-bold text-amber-700/80 mt-1 leading-relaxed">
                            {assistance.notes}
                          </p>
                        )}
                      </div>
                    </RailSection>
                  )}

                  {snap.notes && (
                    <RailSection icon={NotebookPen} title="Trip notes">
                      <p className="text-[11px] font-bold text-slate-600 leading-relaxed whitespace-pre-line">
                        {snap.notes}
                      </p>
                    </RailSection>
                  )}
                </>
              )}
            </Panel>

            {/* ── Money, read-only ──────────────────────────────────────────
                Three figures and a link. The breakdown — customer amount, GST, TCS, adjustments,
                margin, the payment history, the invoices — is the booking screen's job and is
                deliberately not repeated. What matters here is only whether an unpaid balance is
                a reason this party should not leave. */}
            <Panel className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-extrabold text-slate-700">Money</p>
                {booking.paymentStatus && (
                  <span className="ml-auto">
                    <Badge tone={PAY_TONE[booking.paymentStatus] ?? "slate"}>
                      {booking.paymentStatus}
                    </Badge>
                  </span>
                )}
              </div>

              <div className="px-4 py-3">
                <KV label="Total payable" value={money(booking.totalPayable)} />
                <KV label="Received" value={money(booking.paidAmount)} />
                <div className="flex items-baseline gap-2 py-1 mt-1 border-t border-slate-100">
                  <span className="text-[11px] font-extrabold text-slate-500">Balance due</span>
                  <span
                    className={`ml-auto text-sm font-extrabold tabular-nums ${
                      settlementElsewhere ? "text-slate-400"
                        : Number(booking.pendingAmount) > 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {/* pendingAmount is forced to 0.00 for CANCELLED and REFUNDED bookings by
                        the server. Printing "₹ 0" there would read as "nothing owed", which is
                        the one thing it does not mean. */}
                    {settlementElsewhere ? "—" : money(booking.pendingAmount)}
                  </span>
                </div>
                {settlementElsewhere && (
                  <p className="text-[10px] font-bold text-slate-400 mt-1 leading-relaxed">
                    Retained, refundable and still-owed amounts for a cancelled booking live on
                    its cancellation record, on the booking screen.
                  </p>
                )}
              </div>

              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/BookingPayments/${booking.publicId}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
                >
                  <Wallet className="w-3.5 h-3.5" /> Payment ledger
                </button>
                <button
                  onClick={() => navigate(`/BookingDetails/${booking.publicId}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Full booking
                </button>
              </div>
            </Panel>

            {/* Who sold it — one line, because "who do I ask about this trip" is an operations
                question even though the answer is a sales fact. */}
            {booking.assignedUserName && (
              <p className="text-[11px] font-bold text-slate-400 px-1 inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Sold by {booking.assignedUserName}
              </p>
            )}
          </aside>
        </div>
      </div>
    </Page>
  );
}
