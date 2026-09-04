// src/console/api/platformPackageService.js
//
// SuperAdmin management of the global package catalog. Platform realm: ConsoleAPI carries
// `sa_token` and its own auth realm, so a 401 here bounces to the CONSOLE login, never the tenant
// one.
//
// This catalog has TWO jobs the hotel and vehicle ones do not split apart, because it is two-sided:
//
//   1. Authoring the platform's own packages — create, edit, publish.
//   2. Reviewing AGENCY listings — an agency asked to sell its own package to every other agency,
//      and only the platform can say yes.
//
// Every write carries a step-up MFA code. `transportAdminService` once omitted it and appeared to
// work only because `app.super-admin.dev-login.enabled` short-circuits the check locally — in
// production every save was a 403. Never drop the `mfaCode` argument to "simplify" a call.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/package-marketplace";

const stepUpHeaders = (mfaCode) => ({
  headers: { [SUPERADMIN_MFA_HEADER]: mfaCode },
});

/** Drop empty filters — an empty string is a *value* to a Spring `@RequestParam`, not "no filter". */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Paged reads answer `{items, pagination}` — rows live in `data`, NOT `content`. */
const paged = (res) => ({
  items: Array.isArray(res?.data?.data) ? res.data.data : [],
  pagination: res?.data?.pagination ?? null,
});

export const platformPackageService = {
  // ── Reads ─────────────────────────────────────────────────────────────────

  /** Every package in every state, including agencies' private drafts. */
  list: async ({ page = 0, size = 25, status } = {}) =>
    paged(await ConsoleAPI.get(`${BASE}/packages`, { params: clean({ page, size, status }) })),

  /** Agency listings waiting for a decision, oldest first. */
  reviewQueue: async ({ page = 0, size = 25 } = {}) =>
    paged(await ConsoleAPI.get(`${BASE}/review-queue`, { params: clean({ page, size }) })),

  get: (publicId) => ConsoleAPI.get(`${BASE}/packages/${publicId}`).then(unwrap),

  // ── Platform authoring ────────────────────────────────────────────────────

  create: (payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/packages`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  update: (publicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/packages/${publicId}`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  saveItinerary: (publicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/packages/${publicId}/itinerary`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  savePriceSlabs: (publicId, slabs, mfaCode) =>
    ConsoleAPI.put(`${BASE}/packages/${publicId}/price-slabs`, { slabs }, stepUpHeaders(mfaCode)).then(unwrap),

  /**
   * The package's tiers — Basic / Deluxe / Super Deluxe — with their hotels, vehicle and own rates.
   *
   * <p>The endpoint has existed since tiers shipped and nothing here called it, so a platform
   * package created from this console could never have any. The demo catalog's tiered packages were
   * written by the seeder, which is why the gap stayed invisible: the console could display tiers it
   * had no way to author.</p>
   *
   * <p>Step-up protected like every other write here — replacing the tiers replaces what is on sale.</p>
   */
  saveVariants: (publicId, variants, mfaCode) =>
    ConsoleAPI.put(`${BASE}/packages/${publicId}/variants`, { variants }, stepUpHeaders(mfaCode)).then(unwrap),

  addImage: (publicId, payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/packages/${publicId}/images`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  /**
   * Which photo leads.
   *
   * <p>Not cosmetic on a catalog sold on its photographs — the cover IS the card. The console could
   * add and delete photos but never choose one, so the cover was whatever went up first.</p>
   */
  setCoverImage: (publicId, imagePublicId, mfaCode) =>
    ConsoleAPI.put(`${BASE}/packages/${publicId}/images/${imagePublicId}/cover`, null, stepUpHeaders(mfaCode))
      .then(unwrap),

  /** The gallery order, as a full list of ids. A partial list would leave the rest unordered. */
  reorderImages: (publicId, imagePublicIds, mfaCode) =>
    ConsoleAPI.put(`${BASE}/packages/${publicId}/images/order`, { imagePublicIds }, stepUpHeaders(mfaCode))
      .then(unwrap),

  deleteImage: (publicId, imagePublicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/packages/${publicId}/images/${imagePublicId}`, stepUpHeaders(mfaCode)).then(unwrap),

  remove: (publicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/packages/${publicId}`, stepUpHeaders(mfaCode)).then(unwrap),

  /**
   * Upload a photo, then attach the returned URL with `addImage`.
   *
   * Returns the URL STRING, not an object. `TabPhotos.jsx` destructures `{imagePath}` off the twin
   * of this method and posts `imageUrl: undefined` as a result — read the return value directly.
   *
   * No step-up: uploading bytes changes nothing anyone can buy until the URL is attached, and that
   * attach is guarded. Requiring a fresh code per photo is how people start pasting URLs by hand.
   */
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await ConsoleAPI.post(`${BASE}/upload-image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap(res)?.imagePath;
  },

  // ── Publish lifecycle ─────────────────────────────────────────────────────

  /** Refused with 409 unless the package has stay legs and at least one active price slab. */
  publish: (publicId, mfaCode) =>
    ConsoleAPI.post(`${BASE}/packages/${publicId}/publish`, null, stepUpHeaders(mfaCode)).then(unwrap),

  /**
   * Withdraw from sale.
   *
   * `target` is explicit: INACTIVE is "not selling right now" and the owning agency can lift it,
   * SUSPENDED is the platform's decision and they cannot. Two different acts — say which.
   */
  unpublish: (publicId, { target = "INACTIVE", reason } = {}, mfaCode) =>
    ConsoleAPI.post(`${BASE}/packages/${publicId}/unpublish`, null, {
      ...stepUpHeaders(mfaCode),
      params: clean({ target, reason }),
    }).then(unwrap),

  // ── Agency listing review ─────────────────────────────────────────────────

  approveListing: (publicId, mfaCode) =>
    ConsoleAPI.post(`${BASE}/packages/${publicId}/approve-listing`, null, stepUpHeaders(mfaCode)).then(unwrap),

  /** A reason is required — the agency has to know what to fix. Sent as a query param, not a body. */
  rejectListing: (publicId, reason, mfaCode) =>
    ConsoleAPI.post(`${BASE}/packages/${publicId}/reject-listing`, null, {
      ...stepUpHeaders(mfaCode),
      params: { reason },
    }).then(unwrap),
};

/**
 * Catalog status → label + tone, defined ONCE here rather than in each page.
 *
 * The hotel and vehicle catalogs duplicate their status maps across three files each and they have
 * already drifted. Tokens, not raw palette classes: inside `console/` a raw `slate-*`/`blue-*`
 * resolves to the tenant palette and carries no dark-mode partner.
 */
export const PACKAGE_STATUS = {
  DRAFT: { label: "Draft", cls: "bg-muted text-body" },
  PENDING_REVIEW: { label: "In review", cls: "bg-hue-amber-soft text-hue-amber" },
  ACTIVE: { label: "Live", cls: "bg-hue-emerald-soft text-hue-emerald" },
  INACTIVE: { label: "Paused", cls: "bg-muted text-body" },
  SUSPENDED: { label: "Suspended", cls: "bg-hue-rose-soft text-hue-rose" },
  REJECTED: { label: "Rejected", cls: "bg-hue-rose-soft text-hue-rose" },
  _default: { label: "", cls: "bg-muted text-body" },
};

export const packageStatus = (value) =>
  PACKAGE_STATUS[value] ?? { ...PACKAGE_STATUS._default, label: value ?? "" };

export const PACKAGE_CATEGORY = {
  BASIC: "Basic",
  DELUXE: "Deluxe",
  SUPER_DELUXE: "Super Deluxe",
  LUXURY: "Luxury",
};

export const PACKAGE_REGION = {
  NORTH: "North",
  SOUTH: "South",
  EAST: "East",
  WEST: "West",
  CENTRAL: "Central",
  NORTH_EAST: "North East",
  UNION_TERRITORY: "Union Territory",
};

/**
 * Sharing basis, as words.
 *
 * Deliberately duplicated from the tenant service rather than imported across the realm boundary:
 * `console/` never imports from `features/`, and the day this console needs a label the tenant app
 * does not — an internal note beside a rate, say — a shared constant would have to grow a flag.
 */
export const PACKAGE_OCCUPANCY = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRIPLE: "Triple",
  QUAD: "Quad",
  CHILD_WITH_BED: "Child with bed",
  CHILD_NO_BED: "Child without bed",
  INFANT: "Infant",
};

export default platformPackageService;
