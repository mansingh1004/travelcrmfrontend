// src/console/api/platformHotelService.js
//
// SuperAdmin management of the global hotel catalog. Platform realm: ConsoleAPI carries `sa_token`
// and its own auth realm, so a 401 here bounces to the CONSOLE login, never the tenant one.
//
// Publish and unpublish are the two actions that change what every tenant on the platform can buy,
// so both require a step-up MFA code — same treatment as a plan change.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/hotel-catalog";

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

  create: (payload) => ConsoleAPI.post(`${BASE}/hotels`, payload).then(unwrap),

  update: (publicId, payload) =>
    ConsoleAPI.put(`${BASE}/hotels/${publicId}`, payload).then(unwrap),

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
  remove: (publicId) => ConsoleAPI.delete(`${BASE}/hotels/${publicId}`).then(unwrap),

  // ── Rooms (no price field — the catalog is descriptive; rates live elsewhere) ──

  addRoom: (hotelPublicId, payload) =>
    ConsoleAPI.post(`${BASE}/hotels/${hotelPublicId}/rooms`, payload).then(unwrap),

  updateRoom: (hotelPublicId, roomPublicId, payload) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}`, payload).then(unwrap),

  deleteRoom: (hotelPublicId, roomPublicId) =>
    ConsoleAPI.delete(`${BASE}/hotels/${hotelPublicId}/rooms/${roomPublicId}`).then(unwrap),

  // ── Meal plans (likewise no price — a meal plan is an inclusion, not a rate) ──

  addMealPlan: (hotelPublicId, payload) =>
    ConsoleAPI.post(`${BASE}/hotels/${hotelPublicId}/meal-plans`, payload).then(unwrap),

  updateMealPlan: (hotelPublicId, mealPlanPublicId, payload) =>
    ConsoleAPI.put(`${BASE}/hotels/${hotelPublicId}/meal-plans/${mealPlanPublicId}`, payload).then(unwrap),

  deleteMealPlan: (hotelPublicId, mealPlanPublicId) =>
    ConsoleAPI.delete(`${BASE}/hotels/${hotelPublicId}/meal-plans/${mealPlanPublicId}`).then(unwrap),
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
