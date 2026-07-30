// src/services/vendorService.js
// ─────────────────────────────────────────────────────────────
// Vendor Service Layer — Travel CRM
// Handles all API calls for Vendors.jsx & CreateVendor.jsx
// Uses shared axiosInstance (JWT + error interceptors)
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";

/* ─────────────────────────────────────────────────────────────
   VENDOR SERVICE
   Base URL : /api/vendors
   All methods return Axios Promise → { data, status, headers }
───────────────────────────────────────────────────────────── */

/* The table's column keys are DTO field names; the backend sorts by ENTITY property names.
   Three of them differ, and an unmapped key silently falls back to createdAt server-side — which
   looks like "sorting is broken" rather than an error. Mapped here, once. */
const SORT_KEY_MAP = {
  name: "vendorName",
  code: "vendorCode",
  type: "vendorType",
};

const vendorService = {

  /* ── PAGED VENDOR LIST ──────────────────────────────────────
     GET /api/vendors?page&size&sortBy&sortDir&q&status&type&payStatus
     Returns the raw PagedApiResponse envelope: { data: [...], pagination: {...} }.

     Search and filters are SERVER-side. The standalone /search and /filter endpoints return
     unpaged lists, so they cannot back a paginated table — narrowing has to happen in the same
     query that pages. Drive this through `usePagedList`.
  ──────────────────────────────────────────────────────────── */
  list: ({ page = 0, size = 25, sortBy = "vendorName", sortDir = "asc",
           q, status, type, payStatus } = {}) =>
    API.get("/vendors", {
      params: {
        page, size,
        sortBy: SORT_KEY_MAP[sortBy] ?? sortBy,
        sortDir,
        q: q || undefined,
        status: status || undefined,
        type: type || undefined,
        payStatus: payStatus || undefined,
      },
    }),

  /* ── GET ALL VENDORS ────────────────────────────────────────
     Back-compat shim for callers that want a plain list (e.g. a booking's vendor dropdown).
     Explicitly asks for the max page size instead of silently taking the server default of 10.
  ──────────────────────────────────────────────────────────── */
  getAll: (params = {}) =>
    vendorService.list({ size: 200, ...params }),

  /* ── GET VENDOR BY ID ───────────────────────────────────────
     GET /api/vendors/:id
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  getById: (id) =>
    API.get(`/vendors/${id}`),

  /* ── GET VENDOR BY CODE ─────────────────────────────────────
     GET /api/vendors/code/VND001
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  getByCode: (code) =>
    API.get(`/vendors/code/${code}`),

  /* ── CREATE VENDOR ──────────────────────────────────────────
     POST /api/vendors
     Body: VendorRequestDTO
     {
       vendorName, vendorType, contactPerson,
       phone, alternatePhone, email, whatsapp,
       contractType, paymentTerms, commPref, status,
       city, state, country, address, pincode, coverageAreas,
       services: ["Hotel", "Breakfast"],
       serviceDescription,
       commissionRate, currency, creditPeriod,
       creditLimit, openingBalance,
       bankName, accountName, accountNumber, ifscCode, upiId,
       gstNumber, panNumber,
       notes, specialConditions
     }
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  create: (vendorData) =>
    API.post("/vendors", vendorData),

  /* ── UPDATE VENDOR ──────────────────────────────────────────
     PUT /api/vendors/:id
     Body: VendorRequestDTO (full update)
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  update: (id, vendorData) =>
    API.put(`/vendors/${id}`, vendorData),

  /* ── UPDATE VENDOR STATUS ONLY ──────────────────────────────
     PATCH /api/vendors/:id/status
     Body: { status: "Active" | "Inactive" | "Blacklisted" }
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  updateStatus: (id, status) =>
    API.patch(`/vendors/${id}/status`, { status }),

  /* ── UPDATE VENDOR PAYMENT STATUS ───────────────────────────
     PATCH /api/vendors/:id/payment
     Body: { payStatus: "Paid" | "Partial" | "Unpaid", amountPaid: 50000 }
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  updatePayment: (id, paymentData) =>
    API.patch(`/vendors/${id}/payment`, paymentData),

  /* ── DELETE VENDOR ──────────────────────────────────────────
     DELETE /api/vendors/:id
     Response: 204 No Content
  ──────────────────────────────────────────────────────────── */
  delete: (id) =>
    API.delete(`/vendors/${id}`),

  /* ── FILTER VENDORS ─────────────────────────────────────────
     GET /api/vendors/filter
     Params: status, type, payStatus
     Response: VendorResponseDTO[]

     Usage:
       vendorService.filter({ status: "Active", type: "Hotel" })
       vendorService.filter({ payStatus: "Partial" })
  ──────────────────────────────────────────────────────────── */
  filter: (params = {}) =>
    API.get("/vendors/filter", { params }),

  /* ── SEARCH VENDORS ─────────────────────────────────────────
     GET /api/vendors/search?q=Royal
     Response: VendorResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  search: (query) =>
    API.get("/vendors/search", {
      params: { q: query },
    }),

  /* ── GET VENDORS BY TYPE ────────────────────────────────────
     GET /api/vendors/type/Hotel
     Response: VendorResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  getByType: (type) =>
    API.get(`/vendors/type/${type}`),

  /* ── GET VENDOR STATS ───────────────────────────────────────
     GET /api/vendors/stats
     Response: {
       total, active, inactive, blacklisted,
       totalByType: { Hotel, Airlines, Transport, DMC },
       totalBusiness, totalPaid, totalOutstanding,
       avgRating, totalBookings
     }
  ──────────────────────────────────────────────────────────── */
  getStats: () =>
    API.get("/vendors/stats"),

  /* ── GET VENDOR BOOKINGS ────────────────────────────────────
     GET /api/vendors/:id/bookings
     Response: BookingResponseDTO[]
  ──────────────────────────────────────────────────────────── */
  getBookings: (id) =>
    API.get(`/vendors/${id}/bookings`),

  /* ── RATE / REVIEW VENDOR ───────────────────────────────────
     POST /api/vendors/:id/rating
     Body: { rating: 4.5, review: "Excellent service" }
     Response: VendorResponseDTO
  ──────────────────────────────────────────────────────────── */
  rateVendor: (id, ratingData) =>
    API.post(`/vendors/${id}/rating`, ratingData),

  /* ── EXPORT VENDORS CSV ─────────────────────────────────────
     GET /api/vendors/export
     Response: Blob (CSV file)
  ──────────────────────────────────────────────────────────── */
  exportCSV: () =>
    API.get("/vendors/export", {
      responseType: "blob",
    }),

  /* ── SEND EMAIL TO VENDOR ───────────────────────────────────
     POST /api/vendors/:id/send-email
     Body: { subject, message }
     Response: { message: "Email sent successfully" }
  ──────────────────────────────────────────────────────────── */
  sendEmail: (id, emailData) =>
    API.post(`/vendors/${id}/send-email`, emailData),

};

export default vendorService;