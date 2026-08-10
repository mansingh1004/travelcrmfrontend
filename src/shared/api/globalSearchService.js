// src/shared/api/globalSearchService.js
// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL RECORD SEARCH — the navbar / ⌘K search box.
//
// STATUS: the backend endpoint is NOT built yet. This module is the single place
// the frontend will need to touch when it is, and until then it fails SILENTLY:
// the palette simply shows no "Records" group. Nothing else in the app depends
// on it.
//
// Deliberately a bare `fetch`, not the shared axios client — same idiom as
// notificationService. A search box fires on almost every keystroke, and routing
// those through the staff interceptor would mean a missing endpoint could toast,
// or a transient 401 could bounce someone out of a form mid-typing. The trade is
// that a real 401 here does NOT log out; the next interceptor-backed call does.
//
// ── Backend contract this expects (write it to match, or change BOTH sides) ──
//
//   GET /api/search?q=<term>&limit=<n>
//
//   200 ApiResponse<{ results: [ {
//        type:      "LEAD" | "CUSTOMER" | "BOOKING" | "QUOTATION" | "VENDOR" | "INVOICE",
//        publicId:  "uuid",          // used to build the route
//        title:     "Rahul Verma",   // primary line
//        subtitle:  "Bali · 20 May", // optional secondary line
//        status:    "Confirmed",     // optional chip
//   } ] }>
//
// Results MUST already be tenant-scoped and permission-filtered server-side —
// this box must never become a way to see a record the caller cannot open.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/api/search";

// Once the endpoint answers 404/501 we stop asking for the rest of the session.
// Without this, every keystroke on every page fires a request that cannot succeed.
let unavailable = false;

/** Reset the "endpoint missing" latch — call after deploying the backend, or in tests. */
export function resetAvailability() {
  unavailable = false;
}

/** True once the backend has told us this feature does not exist here. */
export function isUnavailable() {
  return unavailable;
}

// type → where clicking a hit takes you. Routes are the EXISTING ones; nothing new.
const ROUTE = {
  LEAD: (r) => `/EditLead/${r.publicId}`,
  CUSTOMER: (r) => `/CustomerDetails/${r.publicId}`,
  BOOKING: (r) => `/BookingDetails/${r.publicId}`,
  VENDOR: (r) => `/VendorDetails/${r.publicId}`,
  QUOTATION: () => `/allleads`,
  INVOICE: () => `/accounting/invoices`,
};

const LABEL = {
  LEAD: "Lead",
  CUSTOMER: "Customer",
  BOOKING: "Booking",
  VENDOR: "Vendor",
  QUOTATION: "Quotation",
  INVOICE: "Invoice",
};

function normalize(row) {
  const type = String(row?.type || "").toUpperCase();
  const build = ROUTE[type];
  if (!build || !row?.publicId) return null; // unknown type → not clickable, so not shown
  return {
    id: `record:${type}:${row.publicId}`,
    kind: "record",
    type,
    typeLabel: LABEL[type] || type,
    label: row.title || row.name || "(untitled)",
    sublabel: row.subtitle || row.status || "",
    path: build(row),
  };
}

/**
 * Search records across the CRM.
 *
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal }} opts
 * @returns {Promise<Array|null>} normalized hits, or `null` when the feature is
 *          not available here — callers should render nothing for `null`, and an
 *          empty state only for `[]`.
 */
export async function searchRecords(query, { limit = 8, signal } = {}) {
  const q = (query || "").trim();
  if (!q || q.length < 2 || unavailable) return null;

  const token = localStorage.getItem("token");
  if (!token) return null;

  let res;
  try {
    res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&limit=${limit}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err; // caller superseded this keystroke
    return null; // offline / network blip — the box just shows navigation results
  }

  // 404 = not deployed, 501 = deliberately not implemented. Either way, stop asking.
  if (res.status === 404 || res.status === 501) {
    unavailable = true;
    return null;
  }
  if (!res.ok) return null;

  let body;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const rows = body?.data?.results ?? body?.results ?? body?.data ?? [];
  if (!Array.isArray(rows)) return null;
  return rows.map(normalize).filter(Boolean);
}

export default { searchRecords, isUnavailable, resetAvailability };
