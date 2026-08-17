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
