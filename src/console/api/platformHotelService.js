// src/console/api/platformHotelService.js
//
// SuperAdmin management of the global hotel catalog. Platform realm: ConsoleAPI carries `sa_token`
// and its own auth realm, so a 401 here bounces to the CONSOLE login, never the tenant one.
//
// Publish and unpublish are the two actions that change what every tenant on the platform can buy,
// so both require a step-up MFA code — same treatment as a plan change.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/marketplace";

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

export const platformHotelService = {
  /**
   * Paged catalog list. `unwrap` yields only the rows, so the pagination block is read separately —
   * the list lives in `data`, NOT `content`.
   *
   * @returns {Promise<{items: Array, pagination: Object|null}>}
   */
  list: async ({ page = 0, size = 24, sortBy = "name", sortDir = "asc", status, q } = {}) => {
    const res = await ConsoleAPI.get(`${BASE}/hotels`, {
      params: clean({ page, size, sortBy, sortDir, status, q }),
    });
    const rows = res?.data?.data;
    return {
      items: Array.isArray(rows) ? rows : [],
      pagination: res?.data?.pagination ?? null,
    };
  },

  /** Full detail: rooms, meal plans and how many tenants have imported it. */
  get: (publicId) => ConsoleAPI.get(`${BASE}/hotels/${publicId}`).then(unwrap),

  create: (payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  update: (publicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/hotels/${publicId}`, payload, stepUpHeaders(mfaCode)).then(unwrap),

  /** Refused with 400 unless the hotel has at least one ACTIVE room. Step-up guarded. */
  publish: (publicId, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels/${publicId}/publish`, null, stepUpHeaders(mfaCode)).then(unwrap),

  /**
   * Withdraw from sale. Existing tenant projections survive as SOURCE_INACTIVE — this stops new
   * business, it never deletes what a tenant already imported. Step-up guarded.
   *
   * @param {"INACTIVE"|"SUSPENDED"} target
   */
  unpublish: (publicId, target = "INACTIVE", reason, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels/${publicId}/unpublish`, null, {
      params: clean({ target, reason }),
      ...stepUpHeaders(mfaCode),
    }).then(unwrap),

  /** 409 when any tenant has imported it — unpublish is the correct verb in that case. */
  remove: (publicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/hotels/${publicId}`, stepUpHeaders(mfaCode)).then(unwrap),

  // ── Rooms (no price field — the catalog is descriptive; rates live elsewhere) ──

  addRoom: (hotelPublicId, payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels/${hotelPublicId}/rooms`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  updateRoom: (hotelPublicId, roomPublicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  deleteRoom: (hotelPublicId, roomPublicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}`,
      stepUpHeaders(mfaCode)).then(unwrap),

  // ── Property photos ─────────────────────────────────────────────────────
  //
  // Two steps, always: `uploadImage` puts the file on the CDN and returns a URL, then `addImage`
  // attaches that URL to the hotel. The upload endpoint deliberately stores nothing — an operator
  // picks photos while the form is open, and on a new hotel there is no id to attach them to yet.
  //
  // Step-up on all three, like rooms and rates: a gallery change bumps catalogVersion, so it
  // re-syncs into every tenant's copy of the hotel. It is not a local edit however much it looks
  // like one.

  addImage: (hotelPublicId, payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels/${hotelPublicId}/images`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  /**
   * Caption, category, order, or promote to cover.
   *
   * Every field is optional and absent means "leave it alone" — the server guards each one. Send
   * `primary: true` to promote; never send `primary: false` to demote, because the cover is released
   * by promoting a different photo, not by clearing the flag on this one.
   */
  updateImage: (hotelPublicId, imagePublicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/images/${imagePublicId}`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  deleteImage: (hotelPublicId, imagePublicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/hotels/${hotelPublicId}/images/${imagePublicId}`,
      stepUpHeaders(mfaCode)).then(unwrap),

  // ── Google listing ──────────────────────────────────────────────────────
  //
  // Two calls on purpose. SEARCH offers candidates; BIND stores the one a human picked. A single
  // "match automatically" call would be right most of the time and silently wrong the rest — and a
  // wrong place id does not fail, it puts another property's reviews on this hotel's page.

  /** Candidate Google listings. A read: no step-up, nothing stored. Empty list is a normal answer. */
  searchGoogle: async (hotelPublicId, q) =>
    (await ConsoleAPI.get(`${BASE}/hotels/${hotelPublicId}/google/search`, {
      params: clean({ q }),
    }).then(unwrap)) ?? [],

  /**
   * The same search for a hotel that does not exist yet.
   *
   * The per-hotel variant defaults its query from the stored name and address; a hotel being CREATED
   * has neither, only a half-filled form. Without this the operator could link a listing only after
   * saving, on another screen — the second trip that gets skipped and leaves the column null.
   */
  searchGoogleFreeform: async ({ q, lat, lng }) =>
    (await ConsoleAPI.get(`${BASE}/google/search`, { params: clean({ q, lat, lng }) })
      .then(unwrap)) ?? [],

  /** Bind the chosen listing, or pass a blank placeId to unbind. Step-up: it changes what tenants see. */
  bindGoogle: (hotelPublicId, placeId, mfaCode) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/google`, { placeId: placeId ?? "" },
      stepUpHeaders(mfaCode)).then(unwrap),

  // ── Meal plans (likewise no price — a meal plan is an inclusion, not a rate) ──

  /**
   * Rates, nested under the room they price.
   *
   * <p>New: a catalog rate could previously only be born by promoting an approved partner
   * submission, so a hotel a SuperAdmin created by hand could hold rooms and never a price — a
   * listing that cannot be sold. `netRate` is required (zero allowed: a complimentary child rate is
   * a real answer), unlike its partner-side twin, which is nullable because that form autosaves a
   * half-typed draft and enforces completeness only at submit.</p>
   */
  /**
   * Upload a catalog photo, get its public URL back.
   *
   * Its own endpoint because every other upload in the app sits on the TENANT chain behind a tenant
   * permission, which a SuperAdmin on the sa_token chain does not carry — the console could only
   * take a URL typed by hand. Returns the URL rather than attaching it, since the operator may be
   * filling a hotel that does not exist yet.
   */
  uploadImage: (file, onProgress) => {
    const body = new FormData();
    body.append("file", file);
    return ConsoleAPI.post(`${BASE}/hotels/upload-image`, body, {
      headers: { "Content-Type": "multipart/form-data" },
      // Generous: a 10 MB photo on a slow uplink beats the shared 30s default, and an axios timeout
      // produces no error.response at all, so it would surface as an unexplained failure.
      timeout: 120000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then((res) => unwrap(res)?.imagePath);
  },

  addRate: (hotelPublicId, roomPublicId, payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}/rates`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  updateRate: (hotelPublicId, roomPublicId, ratePublicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}/rates/${ratePublicId}`,
      payload, stepUpHeaders(mfaCode))
      .then(unwrap),

  deleteRate: (hotelPublicId, roomPublicId, ratePublicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}/rates/${ratePublicId}`,
      stepUpHeaders(mfaCode))
      .then(unwrap),

  addMealPlan: (hotelPublicId, payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/hotels/${hotelPublicId}/meal-plans`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  updateMealPlan: (hotelPublicId, mealPlanPublicId, payload, mfaCode) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/meal-plans/${mealPlanPublicId}`, payload,
      stepUpHeaders(mfaCode)).then(unwrap),

  deleteMealPlan: (hotelPublicId, mealPlanPublicId, mfaCode) =>
    ConsoleAPI.delete(`${BASE}/hotels/${hotelPublicId}/meal-plans/${mealPlanPublicId}`,
      stepUpHeaders(mfaCode)).then(unwrap),
};

/** Catalog lifecycle. Only ACTIVE is sellable and visible to tenants. */
export const CATALOG_STATUS = {
  DRAFT:     { label: "Draft",     className: "bg-slate-100 text-slate-600" },
  ACTIVE:    { label: "Published", className: "bg-green-50 text-green-700" },
  INACTIVE:  { label: "Withdrawn", className: "bg-amber-50 text-amber-700" },
  SUSPENDED: { label: "Suspended", className: "bg-red-50 text-red-600" },
};

export const MEAL_PLAN_CODES = [
  { value: "EP",     label: "EP — Room Only" },
  { value: "CP",     label: "CP — Breakfast" },
  { value: "MAP",    label: "MAP — Breakfast + 1 Meal" },
  { value: "AP",     label: "AP — All Meals" },
  { value: "CUSTOM", label: "Custom" },
];

export default platformHotelService;
