// src/features/bookings/api/bookingService.js
//
// Booking API client. Base URL is `http://localhost:8080/api` (see shared/api/http.js), so every
// path here starts at `/bookings`. Throughout, a booking/payment/service "id" is its publicId
// (UUID) — never the internal Long — matching the backend `{publicId}` path variables.
//
// Enum note: the backend binds enums case-sensitively (no case-insensitive Jackson config), so
// status / payment-method / service-status values are sent UPPERCASE. The UI shows Title-case and
// these helpers normalise on the way out.

import API from "@shared/api/http";

/** UI label ("Confirmed", "Bank Transfer") → backend enum token ("CONFIRMED", "BANK_TRANSFER"). */
const toEnum = (v) =>
  v == null || v === "" ? undefined : String(v).trim().toUpperCase().replace(/[\s-]+/g, "_");

// Drop null/undefined/empty params so the query string stays clean and the backend reads an
// absent filter as "no filter" (never search=&status=).
const cleanParams = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

const bookingService = {

  // ── Core CRUD ──────────────────────────────────────────────────────────────
  // Legacy positional — kept for the CreateBooking dropdown callers. Do NOT reshape.
  getAll: (page = 0, size = 1000, sortBy = "createdAt", sortDir = "desc") =>
    API.get("/bookings", { params: { page, size, sortBy, sortDir } }),

  // ── SERVER-SIDE PAGINATED LIST (search + status + payment + month filters) ──────────────
  // Powers Allbookings via usePagedList. Shape matches the hook's fetcher:
  // { page, size, sortBy, sortDir, q, ...filters }. `q` → backend `search`; status/paymentStatus
  // are normalised to backend enum tokens; empty/undefined filters are stripped (⇒ widen to all).
  list: ({ page = 0, size = 25, sortBy = "createdAt", sortDir = "desc",
           q, status, paymentStatus, bookingMonth, travelMonth } = {}) =>
    API.get("/bookings", {
      params: cleanParams({
        page, size, sortBy, sortDir,
        search: q,
        status: toEnum(status),
        paymentStatus: toEnum(paymentStatus),
        bookingMonth: bookingMonth || undefined,
        travelMonth: travelMonth || undefined,
      }),
    }),

  getById: (publicId) => API.get(`/bookings/${publicId}`),

  getByCode: (code) => API.get(`/bookings/code/${code}`),

  // Chronological operational audit for the booking detail Activity tab.
  getTimeline: (publicId) => API.get(`/bookings/${publicId}/timeline`),

  create: (bookingData) => API.post("/bookings", bookingData),

  convertFromLead: (leadPublicId, payload) =>
    API.post(`/leads/${leadPublicId}/convert-to-booking`, payload),

  // Staff selectable in the "Assigned To" dropdown on the create + convert forms. Requires
  // BOOKING_CREATE; a user without it never sees the control, so a 403 here is not expected.
  getEligibleAssignees: () => API.get("/bookings/assignment/eligible-users"),

  // POST /bookings/preview — dry-run of the money the server would stamp on create:
  // { customerAmount, vendorCost?, paidAmount?, overseasTourPackage?,
  //   applyGst?, gstInclusive?, applyTcs? } →
  // { customerAmount, gst, tcs, totalPayable, netProfit, pendingAmount, paymentStatus }.
  // The create form renders these verbatim — the UI never computes tax itself.
  //
  // The three tax flags are TRI-STATE: null/undefined means "follow the tenant's accounting
  // settings", true/false is an explicit override for this booking. Never coerce them to a boolean
  // on the way out — sending false where the user chose nothing pins today's default onto the row.
  //
  // Under gstInclusive the posted customerAmount is the GROSS, and the RETURNED customerAmount is
  // the pre-tax base derived out of it — which is what the booking actually stores. Render that,
  // not the number the user typed, wherever "taxable value" is shown.
  previewFinancials: (body) => API.post("/bookings/preview", body),

  update: (publicId, bookingData) => API.put(`/bookings/${publicId}`, bookingData),

  // Booking status: backend enum is UPPERCASE (CONFIRMED | PENDING | COMPLETED | REFUNDED).
  // CANCELLED must go through cancel() — the backend rejects it here.
  updateStatus: (publicId, status, reason) =>
    API.patch(`/bookings/${publicId}/status`, { status: toEnum(status), reason }),

  // Legacy running-total top-up (kept for compatibility). New UI records payments via the
  // itemised ledger (addPayment) instead so each receipt is a visible row.
  updatePayment: (publicId, { amount, paymentDate, paymentReference, notes } = {}) =>
    API.patch(`/bookings/${publicId}/payment`, { amount, paymentDate, paymentReference, notes }),

  // ── Cancellation, refund & documents ────────────────────────────────────────
  // The BACKEND computes every rupee. The UI submits proposed figures and renders exactly what
  // these endpoints return — it must never recompute a retained/refund amount in JS.

  // Dry-run preview of a cancellation. Optional { overrideChargeBase, vendorRecoverable } show the
  // exact figures of a proposed waiver/override before confirming. Returns the itemised quote.
  getCancellationPreview: (publicId, { overrideChargeBase, vendorRecoverable } = {}) =>
    API.get(`/bookings/${publicId}/cancellation/preview`, {
      params: { overrideChargeBase, vendorRecoverable },
    }),

  // Confirm the cancellation. `payload` may be the bare action string (back-compat) or the full body:
  //   { action, reason?, overrideChargeBase?, overrideReason?, vendorRecoverable? }
  // action: "MOVE_TO_LEAD" | "PERMANENT_DELETE_LEAD". Override fields require BOOKING_REFUND.
  cancel: (publicId, payload) =>
    API.post(`/bookings/${publicId}/cancel`,
      typeof payload === "string" ? { action: payload } : payload),

  // Frozen refund position of a cancelled booking (due / paid-out / remaining). 404 if never cancelled.
  getCancellationSummary: (publicId) =>
    API.get(`/bookings/${publicId}/cancellation`),

  // Record one refund disbursement against a cancelled booking. `payload`:
  //   { amount, method?, reference?, refundDate?, notes?, idempotencyKey? }
  // Requires BOOKING_REFUND. The backend caps the amount to what's still refundable and issues a voucher.
  refund: (publicId, payload) =>
    API.post(`/bookings/${publicId}/cancellation/refund`, payload),

  // Cancellation note (Credit Note when refunded, Debit Note when the customer owes) — PDF blob.
  getCreditNote: (publicId) =>
    API.get(`/bookings/${publicId}/cancellation/credit-note`, { responseType: "blob" }),

  // Refund voucher — PDF blob. Available only after a refund has been disbursed.
  getRefundVoucher: (publicId) =>
    API.get(`/bookings/${publicId}/cancellation/refund-voucher`, { responseType: "blob" }),

  delete: (publicId) => API.delete(`/bookings/${publicId}`),

  getByCustomer: (customerId) => API.get(`/bookings/customer/${customerId}`),

  // Backend expects `keyword` (was mistakenly `q` before).
  search: (keyword) => API.get("/bookings/search", { params: { keyword } }),

  // Enum params are normalised; month params are 1–12 integers.
  filter: ({ status, paymentStatus, bookingMonth, travelMonth, customerId,
             fromDate, toDate, minAmount, maxAmount } = {}) =>
    API.get("/bookings/filter", {
      params: {
        status: toEnum(status),
        paymentStatus: toEnum(paymentStatus),
        bookingMonth, travelMonth, customerId, fromDate, toDate, minAmount, maxAmount,
      },
    }),

  getStats: () => API.get("/bookings/stats"),

  getPageSummary: (page = 0, size = 10) =>
    API.get("/bookings/page-summary", { params: { page, size } }),

  exportCSV: () => API.get("/bookings/export", { responseType: "blob" }),

  // ── Payment ledger ─────────────────────────────────────────────────────────
  // GET  /bookings/{id}/payments
  getPayments: (bookingId) => API.get(`/bookings/${bookingId}/payments`),

  // POST /bookings/{id}/payments
  // body: { amount, paymentType?, paymentMethod?, paymentAccount?, paidByName?,
  //         receivedByUserPublicId?, paymentDate?, paymentTime?, reference?, notes?,
  //         serviceItemPublicId? }
  //
  // paymentMethod is a free label ("Bank Transfer", "Credit Card", …) and paymentAccount is the
  // bank/cash-box it landed in — both sent as-is. paymentTime is "HH:mm" and is genuinely optional:
  // omit it rather than sending a made-up 00:00.
  //
  // NOTE — recording a payment needs only BOOKING_READ. There is no permission check to run before
  // showing the form; whoever can see the booking can book its money.
  addPayment: (bookingId, data) => API.post(`/bookings/${bookingId}/payments`, data),

  // POST /bookings/{id}/payments/batch — several receipts in ONE transaction.
  // body: { payments: [row, ...] } (max 50), each row the same shape as addPayment.
  // The over-payment ceiling applies to the batch TOTAL, so rows that individually fit but together
  // exceed the balance are rejected as a set and nothing is written.
  addPayments: (bookingId, rows) =>
    API.post(`/bookings/${bookingId}/payments/batch`, { payments: rows }),

  // PUT /bookings/{id}/payments/{paymentId} — correct a recorded entry. Requires PAYMENT_MANAGE.
  // FULL representation, not a patch: every field is written, so omitting one CLEARS it.
  // `amendmentReason` is mandatory and is stored with the amending user + timestamp.
  updatePaymentEntry: (bookingId, paymentId, data) =>
    API.put(`/bookings/${bookingId}/payments/${paymentId}`, data),

  // DELETE /bookings/{id}/payments/{paymentId} — requires PAYMENT_MANAGE.
  deletePayment: (bookingId, paymentId) =>
    API.delete(`/bookings/${bookingId}/payments/${paymentId}`),

  // ── Payment receipts (optional evidence on a ledger row) ────────────────────
  // Bytes live in Postgres and are served only through the authenticated download below — there is
  // no public URL to embed. Attaching is OPTIONAL everywhere: a payment with no receipt is complete.
  // Upload rides BOOKING_READ (same as recording the payment); DELETE needs PAYMENT_MANAGE.

  getPaymentAttachments: (bookingId, paymentId) =>
    API.get(`/bookings/${bookingId}/payments/${paymentId}/attachments`),

  // multipart `file` — JPG / PNG / WEBP / PDF, 10 MB, counted against the tenant's storage quota
  // (a 403 here means the plan's storage is full, not that permission is missing).
  uploadPaymentAttachment: (bookingId, paymentId, file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return API.post(`/bookings/${bookingId}/payments/${paymentId}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress,
    });
  },

  // The bytes, as a blob — hand res.data to openBlob()/downloadBlob(). Fetched through the shared
  // client so the JWT is attached; an <img src> pointing at this path would be unauthenticated.
  getPaymentAttachmentFile: (bookingId, paymentId, attachmentId) =>
    API.get(`/bookings/${bookingId}/payments/${paymentId}/attachments/${attachmentId}/file`,
      { responseType: "blob" }),

  deletePaymentAttachment: (bookingId, paymentId, attachmentId) =>
    API.delete(`/bookings/${bookingId}/payments/${paymentId}/attachments/${attachmentId}`),

  // ── Expense ledger (money OUT to vendors — mirror of the payment ledger) ────
  // POST /bookings/{id}/expenses — BULK create; body is { expenses: [row, ...] } (max 50).
  // Row: { category?, costType? ("VENDOR"|"INTERNAL"), description, vendorName?, amount,
  //        paymentStatus? ("CREDIT"|"PARTIAL"|"PAID" — read as intent), paymentMode?,
  //        expenseDate, dueDate?, paidAmount?, referenceNumber?, notes? }
  // The server settles the money itself (paidAmount/status/outstanding are re-derived) and
  // recalculates the booking's netProfit from INTERNAL rows — render what it returns.
  addExpenses: (bookingId, body) => API.post(`/bookings/${bookingId}/expenses`, body),

  // GET /bookings/{id}/expenses — ledger rows, most recent cost first. Each row carries the
  // server-derived outstandingAmount, paymentStatus and overdue flag — never recompute them.
  getExpenses: (bookingId) => API.get(`/bookings/${bookingId}/expenses`),

  // GET /bookings/{id}/expenses/summary — totals + vendor-payable/overdue rollup
  // (totalExpense/totalVendorExpense/totalInternalCosts/totalPaid/totalOutstanding/
  //  overdueOutstanding/expenseCount/unsettledCount/overdueCount).
  getExpenseSummary: (bookingId) => API.get(`/bookings/${bookingId}/expenses/summary`),

  // PUT /bookings/{id}/expenses/{expenseId} — patch semantics, null/absent = leave unchanged.
  // paidAmount is CUMULATIVE ("disbursed so far", NOT a delta) and alone is honoured as PARTIAL
  // intent; { paymentStatus: "PAID" } settles the line in full. The stored status is always
  // re-derived server-side from the money.
  updateExpense: (bookingId, expenseId, body) =>
    API.put(`/bookings/${bookingId}/expenses/${expenseId}`, body),

  // DELETE /bookings/{id}/expenses/{expenseId} — soft delete; profit recalcs if it was INTERNAL.
  deleteExpense: (bookingId, expenseId) =>
    API.delete(`/bookings/${bookingId}/expenses/${expenseId}`),

  // ── Service line items + vendor assignment ──────────────────────────────────
  // GET  /bookings/{id}/services
  getServices: (bookingId) => API.get(`/bookings/${bookingId}/services`),

  // POST /bookings/{id}/services
  // body: { serviceType?, title, description?, serviceDate?, endDate?, status?, cost?, vendorCost?, confirmationNumber?, notes? }
  addService: (bookingId, data) =>
    API.post(`/bookings/${bookingId}/services`, { ...data, status: toEnum(data?.status) }),

  // PUT /bookings/{id}/services/{serviceId}
  updateService: (bookingId, serviceId, data) =>
    API.put(`/bookings/${bookingId}/services/${serviceId}`, {
      ...data,
      status: toEnum(data?.status),
    }),

  // DELETE /bookings/{id}/services/{serviceId}
  deleteService: (bookingId, serviceId) =>
    API.delete(`/bookings/${bookingId}/services/${serviceId}`),

  // PUT /bookings/{id}/services/{serviceId}/vendor
  // body: { vendorPublicId, vendorCost?, confirmationNumber? }
  assignVendor: (bookingId, serviceId, data) =>
    API.put(`/bookings/${bookingId}/services/${serviceId}/vendor`, data),

  // Vendor dropdown for the assign modal (uses the vendors module list endpoint).
  getVendors: () => API.get("/vendors", { params: { page: 0, size: 1000 } }),

  // ── Documents (server-rendered PDF, on-the-fly) ─────────────────────────────
  // Each returns an axios blob response; hand `res.data` to downloadBlob()/openBlob().
  getInvoice: (bookingId) =>
    API.get(`/bookings/${bookingId}/invoice`, { responseType: "blob" }),

  getVoucher: (bookingId) =>
    API.get(`/bookings/${bookingId}/voucher`, { responseType: "blob" }),

  getServiceVoucher: (bookingId, serviceId) =>
    API.get(`/bookings/${bookingId}/services/${serviceId}/voucher`, { responseType: "blob" }),

  // send-voucher (email) remains a backend stub; the PDF endpoints above are the real deliverables.
  sendVoucher: (bookingId) => API.post(`/bookings/${bookingId}/send-voucher`),

  // ── GST invoice (the SAME accounting invoice the accountant issues) ──────────
  // Bridge endpoints under the booking; generation is tenant-admin + accountant only
  // (backend gate ACCOUNTING_INVOICE_MANAGE), listing/PDF need only BOOKING_READ.
  getGstInvoices: (bookingId) =>
    API.get(`/bookings/${bookingId}/gst-invoices`),
  issueGstInvoice: (bookingId, data) =>
    API.post(`/bookings/${bookingId}/gst-invoices`, data),
  gstInvoicePdf: (bookingId, invoiceId) =>
    API.get(`/bookings/${bookingId}/gst-invoices/${invoiceId}/pdf`, { responseType: "blob" }),
  cancelGstInvoice: (bookingId, invoiceId, reason) =>
    API.post(`/bookings/${bookingId}/gst-invoices/${invoiceId}/cancel`, { reason }),
};

export default bookingService;
