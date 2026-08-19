// features/operations/api/operationsService.js
// ─────────────────────────────────────────────────────────────────────────────
// The operations board's API surface.
//
// Envelope note: /board returns PagedApiResponse ({ data, pagination }), so `board`
// hands back the RAW axios response — usePagedList reads res.data.data and
// res.data.pagination itself. Everything else returns ApiResponse and is unwrapped
// here, so call sites never think about the envelope.
// ─────────────────────────────────────────────────────────────────────────────
import API from "@shared/api/http";

/** yyyy-MM-dd from local date parts. Never toISOString — that is UTC and drops a day west of IST. */
export function isoDate(d) {
  if (!d) return undefined;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const operationsService = {
  /**
   * Bookings departing in the window, nearest departure first.
   *
   * Returns the raw response for usePagedList. `params` carries page/size plus the
   * filters the hook spreads in: { tab, from, to }.
   */
  board: (params) => API.get("/operations/board", { params }),

  /**
   * The window rolled up by departure day.
   *
   * One entry per day that actually has departures — a quiet fortnight returns two cards,
   * not fourteen empty ones.
   */
  daySummary: async (params) => {
    const res = await API.get("/operations/day-summary", { params });
    return res?.data?.data ?? [];
  },

  /** Badge counts, keyed by tab. Each is counted with its own tab's predicate. */
  tabCounts: async (params) => {
    const res = await API.get("/operations/tab-counts", { params });
    return res?.data?.data ?? {};
  },

  /**
   * The five figures across the top — total, ready, action needed, urgent, balance pending.
   *
   * Counted over every booking in the window, NOT over the page on screen: a card that only
   * agreed with the visible ten would teach people the cards cannot be trusted. Takes `search`
   * so the cards follow a search, but never `tab` — the cards are what the tabs are read
   * against, so filtering them by the active tab would make them tautological.
   */
  summary: async (params) => {
    const res = await API.get("/operations/summary", { params });
    return res?.data?.data ?? null;
  },

  /**
   * Turn a booking's sold itinerary into the dated service lines it is delivered against.
   *
   * Resolves to { outcome, createdCount, createdIds } — outcome distinguishes CREATED
   * from ALREADY_PLANNED and NOTHING_TO_PROJECT, so the screen can say which happened
   * instead of claiming success on a no-op.
   */
  generateTripPlan: async (bookingPublicId) => {
    const res = await API.post(`/operations/bookings/${bookingPublicId}/trip-plan`);
    return res?.data?.data ?? null;
  },

  /**
   * The booking one operations screen is about.
   *
   * WHY THE DETAIL PAGE IS COMPOSED FROM THIS AND NOT FROM A BOARD ROW: nothing returns one
   * board row. /operations/board is windowed (from defaults to the tenant's today, the span is
   * capped at 92 days), it only ever selects CONFIRMED / PENDING / COMPLETED bookings, and its
   * search matches bookingCode and customer name — never a publicId. So a deep link to a trip
   * six months out, one that has already left, or a cancelled one comes back with zero rows,
   * which is precisely the case a detail page is opened to answer. This endpoint is keyed by
   * publicId and has none of those windows.
   *
   * Single-booking read, so the response carries `tripSnapshot` — legs, travellers, rooms,
   * vehicles, pickup and drop. The paged list omits it deliberately (LAZY association), so a
   * page cannot be prefilled from a row it was opened from.
   *
   * Costs, margin and vendor identity are NULLED for anyone without BOOKING_PROFIT_READ and the
   * request still 200s — an operations user typically holds neither, so nothing built on this
   * may depend on those fields being present.
   */
  booking: async (bookingPublicId) => {
    const res = await API.get(`/bookings/${bookingPublicId}`);
    return res?.data?.data ?? null;
  },

  /** The service lines behind a row — the detail panel's list. */
  serviceItems: async (bookingPublicId) => {
    const res = await API.get(`/bookings/${bookingPublicId}/services`);
    return res?.data?.data ?? [];
  },

  /**
   * Typeahead over the vendor master for the assign picker.
   *
   * Guarded by VENDOR_READ on the server, which an operations user may not hold — the
   * caller is expected to treat a 403 as "no picker", not as a broken panel. Kept small
   * (20 rows) because a Vendor loads two secondary tables per row.
   */
  searchVendors: async (q) => {
    const res = await API.get("/vendors", {
      params: { q: q || undefined, size: 20, sortBy: "vendorName", sortDir: "asc" },
    });
    return res?.data?.data ?? [];
  },

  /** Assign a supplier to one line, with its confirmation number. */
  assignVendor: async (bookingPublicId, itemPublicId, payload) => {
    const res = await API.put(
      `/bookings/${bookingPublicId}/services/${itemPublicId}/vendor`,
      payload
    );
    return res?.data?.data ?? null;
  },

  /**
   * Patch one service line, and get the whole line back.
   *
   * The server treats every field as optional — null means "leave unchanged"
   * (UpdateBookingServiceItemRequest) — so this is how a confirmation number gets
   * corrected on its own, WITHOUT re-picking the supplier that is already on the line.
   * That matters for permissions, not just clicks: the assign picker needs VENDOR_READ,
   * which an operations user may not hold, while this needs only BOOKING_UPDATE. Routing
   * the confirmation number through assignVendor made the commonest act of the job —
   * typing a reference off a supplier's email — impossible for the people who do it.
   *
   * Returns the persisted line so the caller replaces its copy rather than guessing what
   * the server did with it.
   */
  updateServiceItem: async (bookingPublicId, itemPublicId, patch) => {
    const res = await API.put(
      `/bookings/${bookingPublicId}/services/${itemPublicId}`,
      patch
    );
    return res?.data?.data ?? null;
  },

  /**
   * Move one line's operational status — PENDING / CONFIRMED / CANCELLED.
   *
   * CONFIRMED is refused server-side unless the line already has a supplier
   * (BookingServiceItemServiceImpl.requireVendorBeforeConfirming), so callers must not
   * offer it on an unassigned line. Use assignVendor with a status instead.
   */
  setServiceStatus: (bookingPublicId, itemPublicId, status) =>
    operationsService.updateServiceItem(bookingPublicId, itemPublicId, { status }),

  /* ── Supplier communication ────────────────────────────────────────────────
     Sending is what moves a line to REQUESTED, so these live beside the status
     writes above rather than in a mailbox service. The mailbox is for reading
     mail; this is for doing operations, and every call here is already pinned to
     one booking and one service line. */

  /**
   * A pre-filled supplier email for one line — recipient, subject and body composed
   * from the booking.
   *
   * Side-effect free by contract: opening the composer must not create a thread, or
   * every abandoned draft leaves a phantom conversation on the booking. Safe to call
   * on every open.
   *
   * Returns { to, subject, body, vendorName, vendorContactPerson, recipientResolved }.
   * `recipientResolved` false means the line has no supplier email on file — show the
   * reason rather than an unexplained empty To field.
   */
  vendorEmailDraft: async (bookingPublicId, itemPublicId) => {
    const res = await API.get(
      `/bookings/${bookingPublicId}/services/${itemPublicId}/email/draft`
    );
    return res?.data?.data ?? null;
  },

  /**
   * Send it, log it against the booking, and move the line to REQUESTED.
   *
   * There is deliberately no status argument: the server refuses to let a send produce
   * CONFIRMED. Asking is not the same as being answered, and every version of this that
   * collapsed the two produced a board full of green lines nobody had heard back about.
   * A send moves PENDING → REQUESTED and nothing else.
   *
   * Needs COMM_SEND as well as BOOKING_UPDATE — writing from the agency's own address is
   * a different act from editing a booking. Treat a 403 as "this user cannot send", not
   * as a broken panel.
   *
   * Returns the persisted service line, so the caller replaces its copy instead of
   * guessing what the status and release date became.
   */
  sendVendorEmail: async (bookingPublicId, itemPublicId, payload) => {
    const res = await API.post(
      `/bookings/${bookingPublicId}/services/${itemPublicId}/email`,
      payload
    );
    return res?.data?.data ?? null;
  },

  /**
   * Record a call that already happened — outcome, notes and the next follow-up.
   *
   * The CRM never places the call; this is the part that otherwise goes missing. It does
   * NOT move the line's status: a phone call is a real contact, but it is also how
   * "I rang them, I think they said yes" enters a system as fact.
   */
  /**
   * A pre-composed WhatsApp chase, plus what this tenant can actually do with it.
   *
   * Returns { to, toDisplay, message, deviceLink, vendorName, recipientResolved,
   *           apiAvailable, freeTextAllowed, templateName }.
   *
   * The three capability flags decide the composer's shape and are the SERVER's judgement —
   * they depend on Meta's 24-hour rule and on credentials the browser cannot see. Do not
   * re-derive them here.
   */
  vendorWhatsAppDraft: async (bookingPublicId, itemPublicId) => {
    const res = await API.get(
      `/bookings/${bookingPublicId}/services/${itemPublicId}/whatsapp/draft`
    );
    return res?.data?.data ?? null;
  },

  /**
   * Send a WhatsApp chase, or record one the operator sent themselves.
   *
   * `transport: "API"` goes through the agency's WhatsApp Business account and 422s when that
   * is not connected — it never silently downgrades, because reporting a message as sent when
   * nothing left the building is worse than refusing.
   *
   * `transport: "DEVICE"` records what the operator says they sent from their own WhatsApp
   * after following deviceLink. Weaker evidence, and the only kind available to an agency with
   * no Business API account — which is most of them.
   *
   * Returns the persisted service line, same as the email send.
   */
  sendVendorWhatsApp: async (bookingPublicId, itemPublicId, payload) => {
    const res = await API.post(
      `/bookings/${bookingPublicId}/services/${itemPublicId}/whatsapp`,
      payload
    );
    return res?.data?.data ?? null;
  },

  logVendorCall: async (bookingPublicId, itemPublicId, payload) => {
    const res = await API.post(
      `/bookings/${bookingPublicId}/services/${itemPublicId}/calls`,
      payload
    );
    return res?.data?.data ?? null;
  },

  /* ── The checkpoint model ──────────────────────────────────────────────────
     Distinct from the service-line calls above, and the distinction is the whole
     point. A service line is something the customer bought; a checkpoint is a
     thing that must be true before the party can leave — nine of them, including
     ones no line exists for (vouchers, the pre-departure call). They move
     independently, so they are written independently.

     Every board row already carries `entry.ops` with the same standing in
     summary form. These are for the detail panel, where a checkpoint is edited. */

  /**
   * One booking's ops record and all nine checkpoints.
   *
   * Returns null when the booking has no record — ordinary, and it will stay
   * ordinary until the backfill runs: records are provisioned at confirmation, so
   * anything confirmed before the model shipped has none, and a PENDING sale never
   * gets one. Callers must fall back to the derived readiness map rather than
   * rendering an empty panel.
   */
  checkpoints: async (bookingPublicId) => {
    const res = await API.get(`/operations/bookings/${bookingPublicId}/checkpoints`);
    return res?.data?.data ?? null;
  },

  /**
   * Move one checkpoint. Requires OPS_MANAGE — gate the control, not just the call.
   *
   * `patch` is sparse: send only what changed. Pass `expectedRowVersion` (from the
   * checkpoint you rendered) to make the write optimistic — a 409 means somebody
   * else moved it while the panel was open, and per the app's error policy a 409 is
   * SILENT at the interceptor, so the call site must surface it itself.
   */
  updateCheckpoint: async (checkpointPublicId, patch) => {
    const res = await API.put(`/operations/checkpoints/${checkpointPublicId}`, patch);
    return res?.data?.data ?? null;
  },

  /* ── Optional enrichment for the Today panel ───────────────────────────────
     Three reads that may each legitimately be refused, and none of which the panel may fail on.
     They are listed together because they share one rule: a 403, a 404 or an empty answer means
     the block is ABSENT, never that the page is broken. */

  /**
   * The quotation a booking was sold from — the only per-day, per-activity TIMED plan anywhere
   * in the product.
   *
   * Reached through booking.sourceQuotationPublicId, which is null on any booking taken over the
   * phone. Sits behind QUOTATION_READ (class-level on QuotationController), which an operations
   * executive routinely does not hold — so a 403 is a missing capability, not a failure, and the
   * caller drops the block rather than showing an error.
   *
   * Everything under `sightseeing.days[]` is unvalidated free text: the day's `date` is
   * VARCHAR(30), an activity's `startTime` is VARCHAR(20), and "15:00", "3 PM" and "afternoon"
   * are all legal values. Render them verbatim and in the order they come back. Nothing may
   * parse, sort by, or do arithmetic on them.
   */
  quotation: async (quotationPublicId) => {
    const res = await API.get(`/quotations/${quotationPublicId}`);
    return res?.data?.data ?? null;
  },

  /**
   * The fleet trips somebody planned for this booking in their own Vehicle Diary.
   *
   * THE PARAM IS NAMED bookingId AND TAKES THE BOOKING'S publicId — FleetTripSpecification matches
   * root.get("bookingPublicId"). Passing anything else silently returns nothing.
   *
   * Behind FLEET_READ, and ABSENCE MEANS NOTHING: a fleet trip cannot exist without both a vehicle
   * and a driver from the diary, so an operator who typed a registration by hand has none, and a
   * trip belongs to the OPERATOR's tenant rather than the buying agency's. Never phrase an empty
   * answer as "no vehicle is arranged".
   */
  fleetTrips: async (bookingPublicId) => {
    const res = await API.get("/fleet/trips", {
      params: { bookingId: bookingPublicId, size: 20, page: 0 },
    });
    return res?.data?.data ?? [];
  },

  /**
   * One fleet trip's legs — who was on which vehicle across which half-open window.
   *
   * The trip's own vehicle and driver always point at the CURRENT leg; these rows are the only
   * place an earlier vehicle survives.
   */
  fleetTripLegs: async (tripPublicId) => {
    const res = await API.get(`/fleet/trips/${tripPublicId}/legs`);
    return res?.data?.data ?? [];
  },

  /**
   * Everything the product recorded against this booking, newest last.
   *
   * The Today panel narrows it to the day being read, to answer "what has already been done today"
   * — the question an operator asks before phoning a supplier a second time.
   *
   * COVERAGE IS NOT TOTAL, and a caller should not imply it is. The server builds this from booking
   * lifecycle, payments, invoices, expenses, logged calls and EMAIL messages. WhatsApp is
   * deliberately skipped by BookingTimelineServiceImpl (it filters to CommChannel.EMAIL), so a
   * WhatsApp sent to a supplier leaves no mark here at all.
   *
   * `occurredAt` is a LocalDateTime — the server's own wall clock, with no offset. Compare it by
   * string prefix against a yyyy-MM-dd; re-zoning it would be inventing information.
   */
  timeline: async (bookingPublicId) => {
    const res = await API.get(`/bookings/${bookingPublicId}/timeline`);
    return res?.data?.data ?? [];
  },

  /**
   * Tasks falling inside a window, for the Today panel to narrow to one booking.
   *
   * WHY A WINDOW AND NOT A BOOKING. Task is the ONLY thing in this product that is both linked to a
   * booking and carries a real clock (startAt / endAt / dueDate are Instants — every other dated
   * thing on a booking is a bare LocalDate). But no task endpoint filters by booking: /tasks takes
   * status, priority, category, assignee, from and to, and nothing else. So the day is fetched and
   * the booking is matched here. A day's tasks for one agency is a small list; a per-booking filter
   * on the server would be better and is worth adding, but this needs no backend change to be
   * useful today.
   *
   * Returns a BARE ARRAY — this endpoint answers with List<TaskResponse>, not the ApiResponse
   * envelope the rest of this file unwraps. Reading res.data.data here would silently yield
   * undefined and an empty panel.
   */
  tasksBetween: async (fromIso, toIso) => {
    const res = await API.get("/tasks", { params: { from: fromIso, to: toIso } });
    return Array.isArray(res?.data) ? res.data : (res?.data?.data ?? []);
  },

  /**
   * The people this booking's operations owner can be set to.
   *
   * Reuses the BOOKING ASSIGNMENT roster rather than a new ops-only one: the question
   * "who at this agency can be given a booking to work" has one answer, and a second
   * list would drift from it the first time somebody joined or left.
   *
   * GATED ON BOOKING_CREATE server-side, which an operations executive may not hold —
   * so a 403 here is ORDINARY, not an error. Callers must degrade to showing the
   * current owner without a picker rather than surfacing a failure.
   *
   * Returns [{ id: <publicId UUID>, name, email, role }].
   */
  assignableUsers: async () => {
    const res = await API.get("/bookings/assignment/eligible-users");
    return res?.data?.data ?? [];
  },

  /**
   * Name the operations executive for a booking, or clear it by passing null.
   *
   * Deliberately not the same person as the booking's `assignedUserId`, who sold it.
   * Returns the whole refreshed record, so the caller can replace its copy rather
   * than patching one field.
   *
   * THE ARGUMENT IS A publicId (UUID), not an internal id. The query parameter is still
   * spelled `userId` on the wire — the server renamed only the Java binding — so the URL
   * shape is unchanged and nothing else here had to move.
   */
  assignOpsOwner: async (bookingPublicId, userId) => {
    const res = await API.put(
      `/operations/bookings/${bookingPublicId}/owner`,
      null,
      { params: userId == null ? {} : { userId } }
    );
    return res?.data?.data ?? null;
  },
};

export default operationsService;
