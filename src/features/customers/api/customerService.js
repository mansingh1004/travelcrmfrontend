// src/services/customerService.js

import API from "@shared/api/http";

/* ─────────────────────────────────────────────────────────────
   CUSTOMER SERVICE
   Base URL : /api/customers
   All methods return an Axios Promise → { data, status, ... }
───────────────────────────────────────────────────────────── */

const customerService = {

  /* ── GET ALL CUSTOMERS ──────────────────────────────────────
     GET /api/customers
     Response: CustomerResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  /* ── PAGED CUSTOMER LIST ────────────────────────────────────
     GET /api/customers?page&size&sortBy&sortDir&q&status&type&tier
     Returns the raw PagedApiResponse envelope: { data: [...], pagination: {...} }.

     Search and filters are SERVER-side. /search-name and /filter return unpaged lists and so
     cannot back a paginated table — the narrowing has to happen in the query that pages. Note the
     enum params take the DISPLAY value ("Active", "VIP", "Gold"); the backend's fromValue()
     accepts either that or the enum name.
  ──────────────────────────────────────────────────────────── */
  list: ({ page = 0, size = 25, sortBy = "createdAt", sortDir = "desc",
           q, status, type, tier } = {}) =>
    API.get("/customers", {
      params: {
        page, size, sortBy, sortDir,
        q: q || undefined,
        status: status || undefined,
        type: type || undefined,
        tier: tier || undefined,
      },
    }),

  /* Back-compat shim for callers that want a plain list. Asks for the max page size explicitly
     rather than silently accepting the server default of 25. */
  getAll: (params = {}) =>
    customerService.list({ size: 200, ...params }),

  /* ── GET CUSTOMER BY ID ─────────────────────────────────────
     GET /api/customers/:id
     Response: CustomerResponseDTO
  ──────────────────────────────────────────────────────────── */
  getById: (id) =>
    API.get(`/customers/${id}`),

  /* ── SEARCH CUSTOMER BY PHONE ───────────────────────────────
     GET /api/customers/search?phone=+919876543210
     Response: CustomerResponseDTO
  ──────────────────────────────────────────────────────────── */
  searchByPhone: (phone) =>
    API.get("/customers/search", {
      params: { phone },
    }),

  /* ── "DO WE ALREADY KNOW THIS PERSON?" ──────────────────────
     GET /api/customers/lookup?phone=&email=
     Response: CustomerMatchResponse
       { matched, matchedOn: PHONE|EMAIL|BOTH, message, customerId, customerCode,
         name, phone, email, city, state, birthday, anniversary, type, tier,
         totalBookings, totalSpent, lastBookingDate }

     NOT the same contract as searchByPhone above, and the difference is the whole point:
       • searchByPhone is a strict phone-only fetch that 404s on no match.
       • this one accepts EITHER identifier and answers 200 with { matched:false } when nobody
         matches, because "this is a new customer" is the ordinary outcome on a lead form, not a
         failed request. A 404 here would make the shared interceptor shout at the clerk on every
         genuinely new enquiry.

     Both params are optional but at least one must be sent; when both are present the backend
     prefers phone (the per-tenant natural key). Matching runs through the same CustomerMatcher that
     links the lead at creation, so this probe can never promise a link the save does not make.

     Returns the match object directly (envelope already unwrapped), or a no-match object if the
     probe itself fails — an advisory lookup must never block data entry.
  ──────────────────────────────────────────────────────────── */
  lookup: async ({ phone, email } = {}) => {
    const params = {};
    if (phone && String(phone).trim()) params.phone = String(phone).trim();
    if (email && String(email).trim()) params.email = String(email).trim();
    if (!params.phone && !params.email) return { matched: false };

    const response = await API.get("/customers/lookup", { params });
    const body = response?.data;
    return body?.data ?? body ?? { matched: false };
  },

  /* ── SEARCH CUSTOMERS BY NAME ───────────────────────────────
     GET /api/customers/search-name?name=Arjun
     Response: CustomerResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  searchByName: (name) =>
    API.get("/customers/search-name", {
      params: { name },
    }),

  /* ── CREATE NEW CUSTOMER ────────────────────────────────────
     POST /api/customers
     Body: CustomerRequestDTO
     {
       name, phone, email, city, state,
       type, tier, status, notes
     }
     Response: CustomerResponseDTO
  ──────────────────────────────────────────────────────────── */
  create: (customerData) =>
    API.post("/customers", customerData),

  /* ── UPDATE CUSTOMER ────────────────────────────────────────
     PUT /api/customers/:id
     Body: CustomerRequestDTO
     Response: CustomerResponseDTO
  ──────────────────────────────────────────────────────────── */
  update: (id, customerData) =>
    API.put(`/customers/${id}`, customerData),

  /* ── UPDATE CUSTOMER STATUS ONLY ───────────────────────────
     PATCH /api/customers/:id/status
     Body: { status: "Active" | "Inactive" | "Blocked" }
     Response: CustomerResponseDTO
  ──────────────────────────────────────────────────────────── */
  updateStatus: (id, status) =>
    API.patch(`/customers/${id}/status`, { status }),

  /* ── UPDATE CUSTOMER TIER ONLY ──────────────────────────────
     PATCH /api/customers/:id/tier
     Body: { tier: "Bronze" | "Silver" | "Gold" | "Platinum" }
     Response: CustomerResponseDTO
  ──────────────────────────────────────────────────────────── */
  updateTier: (id, tier) =>
    API.patch(`/customers/${id}/tier`, { tier }),

  /* ── DELETE CUSTOMER ────────────────────────────────────────
     DELETE /api/customers/:id
     Response: 204 No Content
  ──────────────────────────────────────────────────────────── */
  delete: (id) =>
    API.delete(`/customers/${id}`),

  /* ── FILTER BY status / type / tier (UNPAGED) ───────────────
     GET /api/customers/filter?status=&type=&tier=
     Response: CustomerResponseDTO[]

     The list screen does NOT use this — it passes the same three params to `list`
     above so the narrowing happens in the query that pages. Kept as one method
     rather than the three single-param wrappers it used to be (filterByStatus /
     filterByType / filterByTier), which had no callers anywhere in the tree.
  ──────────────────────────────────────────────────────────── */
  filter: ({ status, type, tier } = {}) =>
    API.get("/customers/filter", {
      params: {
        status: status || undefined,
        type: type || undefined,
        tier: tier || undefined,
      },
    }),

  /* ── GET CUSTOMER BOOKING HISTORY ───────────────────────────
     GET /api/customers/:id/bookings
     Response: CustomerBookingResponse[]  → { id, code, dest, date, amt, status }
  ──────────────────────────────────────────────────────────── */
  getBookingHistory: (id) =>
    API.get(`/customers/${id}/bookings`),

  /* ═══════════════════════════════════════════════════════════
     CUSTOMER 360 PROFILE
     One eager summary + one call per tab, fetched on first open.

     The split is the contract, not an implementation detail: the profile used to
     open with two requests and eagerly pull a booking list the landing tab never
     showed. Now the page makes exactly ONE call on mount (getSummary) and each
     tab pays for itself. Do not "helpfully" prefetch these — that undoes it.
  ═══════════════════════════════════════════════════════════ */

  /* Header + money strip + alert rail + every tab's count badge.
     GET /api/customers/:id/summary → CustomerSummaryResponse

     NOTE the money fields are NOT the list's `spent`:
       • spent        = SUM(customerAmount) over live bookings — matches the finance dashboard.
       • totalBilled  = SUM(totalPayable)   — tax-inclusive, what the customer actually owes.
     Showing one and labelling it the other is what made the old KPI misleading. */
  getSummary: (id) =>
    API.get(`/customers/${id}/summary`),

  /* Enquiries raised by this customer, each with its quotation count.
     GET /api/customers/:id/leads → CustomerLeadRow[]
     Requires LEAD_READ in addition to CUSTOMER_READ. */
  getLeads: (id) =>
    API.get(`/customers/${id}/leads`),

  /* Quotations built for this customer, reached through their enquiries.
     GET /api/customers/:id/quotations → QuotationSummaryDto[]

     Rows carry `leadId` (the lead's publicId) because Quotation has no customer
     column at all — the path is always customer → leads → quotations. Requires
     QUOTATION_READ. */
  getQuotations: (id) =>
    API.get(`/customers/${id}/quotations`),

  /* Merged activity timeline — agent notes plus booking/payment milestones.
     GET /api/customers/:id/timeline?limit= → CustomerTimelineEntry[]
     Server bounds limit to 500. */
  getTimeline: (id, limit = 100) =>
    API.get(`/customers/${id}/timeline`, { params: { limit } }),

  /* Payment ledger + invoices + cancellations, in one response.
     GET /api/customers/:id/money → { payments, invoices, cancellations }

     Gated harder than the rest of the profile (PAYMENT_MANAGE / BOOKING_PROFIT_READ /
     CRM_FULL), so a 403 here is expected for ordinary agents — render the tab as
     locked rather than as an error. */
  getMoney: (id) =>
    API.get(`/customers/${id}/money`),

  /* Portal account state + uploaded-document metadata (no file bytes).
     GET /api/customers/:id/documents → CustomerDocumentsResponse */
  getDocuments: (id) =>
    API.get(`/customers/${id}/documents`),

  /* Campaign sends and drip enrolments aimed at this customer.
     GET /api/customers/:id/marketing → { campaigns, drips }
     Requires MARKETING_READ. Birthday/anniversary sends are NOT here — the backend
     writes no row for them. */
  getMarketing: (id) =>
    API.get(`/customers/${id}/marketing`),

  /* ── GET CUSTOMER STATS SUMMARY ─────────────────────────────
     GET /api/customers/stats
     Response: {
       total, active, inactive, blocked,
       vip, corporate, regular,
       totalRevenue, totalBookings, repeatCustomers
     }
  ──────────────────────────────────────────────────────────── */
  getStats: () =>
    API.get("/customers/stats"),

  /* ── EXPORT CUSTOMERS CSV ───────────────────────────────────
     GET /api/customers/export
     Response: Blob (CSV file)
  ──────────────────────────────────────────────────────────── */
  exportCSV: () =>
    API.get("/customers/export", {
      responseType: "blob",
    }),

};

export default customerService;