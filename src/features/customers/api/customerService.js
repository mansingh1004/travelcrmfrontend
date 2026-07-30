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

  /* ── GET CUSTOMERS BY STATUS ────────────────────────────────
     GET /api/customers/filter?status=Active
     Response: CustomerResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  filterByStatus: (status) =>
    API.get("/customers/filter", {
      params: { status },
    }),

  /* ── GET CUSTOMERS BY TYPE ──────────────────────────────────
     GET /api/customers/filter?type=VIP
     Response: CustomerResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  filterByType: (type) =>
    API.get("/customers/filter", {
      params: { type },
    }),

  /* ── GET CUSTOMERS BY TIER ──────────────────────────────────
     GET /api/customers/filter?tier=Platinum
     Response: CustomerResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  filterByTier: (tier) =>
    API.get("/customers/filter", {
      params: { tier },
    }),

  /* ── GET CUSTOMER BOOKING HISTORY ───────────────────────────
     GET /api/customers/:id/bookings
     Response: BookingResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  getBookingHistory: (id) =>
    API.get(`/customers/${id}/bookings`),

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