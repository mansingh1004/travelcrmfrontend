// src/features/marketplace/api/packageMixService.js
//
// Mix and match — compose across a package's tiers, price it, send it, answer it.
//
// Both sides live here for the same reason they share a controller: the agency that sends an
// enquiry on Monday answers one on Tuesday, and splitting the client would make "my requests" and
// "requests to me" look like two products.
//
// NOTHING HERE SENDS A PRICE. The estimate and the request both post choices — tier ids and city
// names — and the server looks the rates up. A client that could send an amount could send any
// amount, and the estimate would stop being the author's published figure.

import API from "@shared/api/http";

const BASE = "/package-marketplace/mix";

/** ApiResponse<T> → T. */
const body = (res) => res?.data?.data ?? res?.data;

/** PagedApiResponse<T> → { items, pagination }. Note `data`, not `content`. */
const paged = (res) => ({
  items: Array.isArray(res?.data?.data) ? res.data.data : [],
  pagination: res?.data?.pagination ?? null,
});

/** Drops undefined/empty params so a blank filter is absent rather than `?status=`. */
const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const packageMixService = {
  // ── Buying ──────────────────────────────────────────────────────────────

  /**
   * Price a selection without sending it.
   *
   * A POST because the selection is a body — but it writes nothing, and the builder calls it on
   * every change.
   */
  estimate: async (packagePublicId, selection) =>
    body(await API.post(`${BASE}/packages/${packagePublicId}/estimate`, selection)),

  create: async (packagePublicId, selection) =>
    body(await API.post(`${BASE}/packages/${packagePublicId}/requests`, selection)),

  listMine: async (params = {}) => paged(await API.get(`${BASE}/requests`, { params: clean(params) })),

  get: async (publicId) => body(await API.get(`${BASE}/requests/${publicId}`)),

  withdraw: async (publicId) => body(await API.post(`${BASE}/requests/${publicId}/withdraw`)),

  /** Take the price. Optionally attaches a lead; the quotation is created either way. */
  accept: async (publicId, leadPublicId) =>
    body(await API.post(`${BASE}/requests/${publicId}/accept`, leadPublicId ? { leadPublicId } : {})),

  // ── Selling ─────────────────────────────────────────────────────────────

  listQueue: async (params = {}) => paged(await API.get(`${BASE}/queue`, { params: clean(params) })),

  pendingCount: async () => body(await API.get(`${BASE}/queue/pending-count`))?.count ?? 0,

  respond: async (publicId, payload) =>
    body(await API.post(`${BASE}/requests/${publicId}/respond`, payload)),

  /** Either side. Who is acting, and whether they may, is decided on the server. */
  decline: async (publicId, reason) =>
    body(await API.post(`${BASE}/requests/${publicId}/decline`, { reason })),
};

/**
 * Status → label and chip classes.
 *
 * `_default` is not padding: the server owns this enum, and a status this build has not heard of
 * must still render legibly rather than as a blank chip.
 */
export const MIX_STATUS = {
  PENDING: { label: "Awaiting price", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  PRICED: { label: "Priced", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  ACCEPTED: { label: "Accepted", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  DECLINED: { label: "Declined", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  EXPIRED: { label: "Expired", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  _default: { label: "", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const mixStatus = (value) =>
  MIX_STATUS[value] ? MIX_STATUS[value] : { ...MIX_STATUS._default, label: value ?? "" };

export default packageMixService;
