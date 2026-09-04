// src/features/marketplace/api/packageMarketplaceService.js
//
// The third catalog in this feature, and the first that is TWO-SIDED: an agency both browses
// packages and writes its own into the catalog. So this file has a read half (`packages`) and an
// authoring half (`my-packages`), and they are gated by different permissions —
// PACKAGE_MARKETPLACE_VIEW / _QUOTE for the first, _AUTHOR for the second.
//
// Realm: staff. Uses the shared client (`@shared/api/http`) — never its own axios instance, so the
// JWT, the 30s timeout and the shared error policy all apply. Every id in a URL is the UUID
// `publicId`.
//
// Modelled on marketplaceService, NOT on transportMarketplaceService: the latter's `clean()` has no
// array branch (that catalog has no multi-select filters yet), and a faceted package catalog copying
// it would silently drop every ticked box. See the note on `clean` below.

import API from "@shared/api/http";

const BASE = "/package-marketplace";

/** `ApiResponse<T>` → `T`. Falls back to the raw body if a proxy ever answers without the envelope. */
const body = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * Strips empty filters and comma-joins arrays.
 *
 * Two rules, both learned the hard way in the hotel catalog:
 *
 *  - An empty string reaching the wire as `state=` is a *value* to a Spring `@RequestParam`, not an
 *    absence, and filters everything out. `0` and `false` are deliberately kept — page 0 is a real
 *    page, and `available=false` is a real filter.
 *  - An array must be comma-joined (`states=KL,GA`). Axios's default `states[]=KL&states[]=GA` binds
 *    to a parameter literally named `states[]`, which nothing reads — so the grid renders fine and
 *    silently ignores every box the agent ticked.
 */
function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      out[key] = value.join(",");
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Paged reads answer `{items, pagination}`; `items` is always an array so no call site guards `.map`. */
const paged = (res) => ({
  items: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

export const packageMarketplaceService = {
  // ── Browse ────────────────────────────────────────────────────────────────

  /**
   * GET /package-marketplace/packages — paged MarketplacePackageSummaryDto.
   *
   * What comes back is already scoped to what this tenant may see: platform packages that are live,
   * their own packages whatever the state, and other agencies' packages only once listed and
   * approved. There is no client-side filter that could widen that, and none should be added.
   */
  searchPackages: async (params = {}) => {
    const res = await API.get(`${BASE}/packages`, { params: clean(params) });
    return paged(res);
  },

  /**
   * GET /package-marketplace/facets — the filter rail's options WITH counts.
   *
   * Counts are computed per facet with that facet's own selections removed, so after ticking
   * "Kerala" the state list still shows the other states and their counts. Refresh this when a
   * filter is applied, not on every keystroke — the answer does not move while someone types.
   */
  facets: async (params = {}) => body(await API.get(`${BASE}/facets`, { params: clean(params) })),

  /** GET one package. A package this tenant may not see is a 404, never a 403. */
  getPackage: async (publicId) => body(await API.get(`${BASE}/packages/${publicId}`)),

  /**
   * POST /packages/{id}/to-quotation — the reason this catalog is worth having.
   *
   * Produces a real quotation whose grand total is `perPaxPrice × pax` before the agency's own
   * markup. `leadPublicId` is optional: a package can be quoted cold, before the enquiry exists as
   * a lead.
   */
  toQuotation: async (publicId, payload) =>
    body(await API.post(`${BASE}/packages/${publicId}/to-quotation`, payload)),

  // ── Authoring (PACKAGE_MARKETPLACE_AUTHOR) ────────────────────────────────

  listMine: async (params = {}) => {
    const res = await API.get(`${BASE}/my-packages`, { params: clean(params) });
    return paged(res);
  },

  create: async (payload) => body(await API.post(`${BASE}/my-packages`, payload)),

  update: async (publicId, payload) => body(await API.put(`${BASE}/my-packages/${publicId}`, payload)),

  remove: async (publicId) => body(await API.delete(`${BASE}/my-packages/${publicId}`)),

  // ── The four daily edits, each its own narrow call ────────────────────────
  //
  // Separate endpoints rather than one big PUT, and the client must keep them separate: a rate
  // editor that had to send the itinerary back is a rate editor that will one day send it back
  // empty.

  /** Replaces the whole rate table in one save. Does not re-open marketplace review. */
  savePriceSlabs: async (publicId, slabs) =>
    body(await API.put(`${BASE}/my-packages/${publicId}/price-slabs`, { slabs })),

  /**
   * The package's sellable tiers — Basic / Deluxe / Super Deluxe.
   *
   * Prices travel WITH the tier rather than through `savePriceSlabs`: a tier and its rates are one
   * decision ("Deluxe is the Taj at 18,900"), and two calls would let a tier exist for a moment
   * carrying the wrong price. The rate endpoint stays for packages that have no tiers at all.
   *
   * The whole set, not a diff. A tier carrying a publicId updates; one without creates; one that
   * existed and is absent is deactivated server-side, so the price history that references its
   * slabs keeps meaning something.
   */
  saveVariants: async (publicId, variants) =>
    body(await API.put(`${BASE}/my-packages/${publicId}/variants`, { variants })),

  /** The one-click on/off toggle. Works in every status, and changes no catalog version. */
  setAvailability: async (publicId, available) =>
    body(await API.patch(`${BASE}/my-packages/${publicId}/availability`, { available })),

  /**
   * Stay legs + day plan + inclusions/exclusions.
   *
   * Omit a key entirely to leave that collection alone; send `[]` to clear it. Those are different
   * requests and the server treats them differently — do not normalise an absent list to `[]`.
   */
  saveItinerary: async (publicId, payload) =>
    body(await API.put(`${BASE}/my-packages/${publicId}/itinerary`, payload)),

  addImage: async (publicId, payload) =>
    body(await API.post(`${BASE}/my-packages/${publicId}/images`, payload)),

  reorderImages: async (publicId, imagePublicIds) =>
    body(await API.put(`${BASE}/my-packages/${publicId}/images/order`, { imagePublicIds })),

  setCoverImage: async (publicId, imagePublicId) =>
    body(await API.put(`${BASE}/my-packages/${publicId}/images/${imagePublicId}/cover`)),

  deleteImage: async (publicId, imagePublicId) =>
    body(await API.delete(`${BASE}/my-packages/${publicId}/images/${imagePublicId}`)),

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  activate: async (publicId) => body(await API.post(`${BASE}/my-packages/${publicId}/activate`)),

  deactivate: async (publicId) => body(await API.post(`${BASE}/my-packages/${publicId}/deactivate`)),

  /** Offer it to other agencies. Lands in review — an agency cannot approve its own listing. */
  listOnMarketplace: async (publicId) => body(await API.post(`${BASE}/my-packages/${publicId}/list`)),

  /** Stop selling. Immediate, and damages no quotation already built from the package. */
  unlist: async (publicId) => body(await API.post(`${BASE}/my-packages/${publicId}/unlist`)),
};

// ── Vocabularies ────────────────────────────────────────────────────────────
//
// Kept in the service rather than inlined in JSX so the list and the editor cannot drift, and so a
// value the server adds later shows up in one place. Every consumer must tolerate an unmapped value
// — see the `_default` entries.

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

export const PACKAGE_OCCUPANCY = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRIPLE: "Triple",
  QUAD: "Quad",
  CHILD_WITH_BED: "Child with bed",
  CHILD_NO_BED: "Child without bed",
  INFANT: "Infant",
};

/**
 * Catalog status → label + tone. Literal Tailwind class strings so the v4 scanner emits them.
 *
 * `_default` is not defensive padding: the server owns this enum, and a status this build has never
 * heard of must render as itself in neutral grey rather than vanishing.
 */
export const PACKAGE_STATUS = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700" },
  PENDING_REVIEW: { label: "In review", cls: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Live", cls: "bg-emerald-100 text-emerald-800" },
  INACTIVE: { label: "Paused", cls: "bg-slate-100 text-slate-600" },
  SUSPENDED: { label: "Suspended", cls: "bg-rose-100 text-rose-800" },
  REJECTED: { label: "Rejected", cls: "bg-rose-100 text-rose-800" },
  _default: { label: "", cls: "bg-slate-100 text-slate-600" },
};

export const packageStatus = (value) =>
  PACKAGE_STATUS[value] ?? { ...PACKAGE_STATUS._default, label: value ?? "" };

/** `01N Port Blair | 02N Havelock Island` — the route line, from the ordered stay legs. */
export const stayRoute = (legs) =>
  (legs ?? [])
    .map((l) => `${String(l.nights ?? 0).padStart(2, "0")}N ${l.cityName ?? ""}`.trim())
    .join("  |  ");

/** `05 Nights 06 Days`. Returns "" when nights is unstated — never "00 Nights 01 Days". */
export const nightsLabel = (nights) => {
  if (nights === null || nights === undefined) return "";
  return `${String(nights).padStart(2, "0")} Nights ${String(nights + 1).padStart(2, "0")} Days`;
};

export default packageMarketplaceService;
