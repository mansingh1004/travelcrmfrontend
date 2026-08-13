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

  /** Move one line's operational status — PENDING / CONFIRMED / CANCELLED. */
  setServiceStatus: async (bookingPublicId, itemPublicId, status) => {
    const res = await API.put(
      `/bookings/${bookingPublicId}/services/${itemPublicId}`,
      { status }
    );
    return res?.data?.data ?? null;
  },
};

export default operationsService;
