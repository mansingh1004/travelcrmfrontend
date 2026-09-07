// src/features/masters/api/CruiseService.js
// ─────────────────────────────────────────────────────────────
// Cruise Master — the last master page that ran on hardcoded seed data.
//
// The backend has served /api/cruises since the master module shipped; nothing on the frontend
// ever called it, so the page showed two invented cruises ("Azure Horizon", "Pearl of the Pacific")
// that looked exactly like real records and could be typed into a real quotation.
//
// Follows the precedent Vehiclas.jsx set: NO silent fake-data fallback. A failure shows a failure
// and an empty tenant shows an empty state — a fabricated row is worse than a blank screen.
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";

/** Paged envelope OR bare array, whichever the endpoint answers with. */
export function normalizeCruiseList(responseData) {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.content)) return responseData.content;
  return [];
}

/**
 * Backend CruiseDto → the shape this page's UI already speaks.
 *
 * The page was written against seed objects with `id`, `created` and `roomTypes[].price`, so the
 * translation happens here rather than by rewriting every JSX reference — the same approach
 * HotelService and VehicleService take.
 */
export function transformCruiseResponse(dto) {
  if (!dto) return null;
  return {
    // The API is keyed by the internal id on this master (see CruiseController), so that is what
    // update/delete send back. publicId is carried for the day this master migrates to it.
    id: dto.cruiseId ?? dto.id,
    publicId: dto.publicId ?? null,
    name: dto.name ?? "",
    description: dto.description ?? "",
    image: dto.image ?? null,
    imagePreview: dto.image ?? null,
    cityId: dto.cityId ?? null,
    cityName: dto.cityName ?? "",
    // Who the agency buys this sailing through. Null until a supplier is linked or a self-vendor is
    // minted — lazy by design, so absence is ordinary.
    vendorName: dto.vendorName ?? null,
    roomTypes: (dto.roomTypes ?? []).map((r) => ({
      id: r.roomTypeId ?? r.id,
      publicId: r.publicId ?? null,
      name: r.name ?? "",
      capacity: r.capacity ?? null,
      price: r.price ?? 0,
      description: r.description ?? "",
    })),
    created: (dto.createdAt || "").slice(0, 10),
  };
}

/** The page's form → CreateCruiseRequest / UpdateCruiseRequest. */
function transformCruiseData(form) {
  return {
    name: form.name?.trim(),
    description: form.description || null,
    // A data: URL from a local preview is not an image the server can store; only a real uploaded
    // URL is sent. The cruise master has no upload endpoint of its own yet.
    image: form.image && !String(form.image).startsWith("data:") ? form.image : null,
    cityId: form.cityId ?? null,
    roomTypes: (form.roomTypes ?? []).map((r) => ({
      name: r.name?.trim(),
      capacity: r.capacity === "" || r.capacity == null ? null : Number(r.capacity),
      price: r.price === "" || r.price == null ? null : Number(r.price),
      description: r.description || null,
    })),
    // Supplier link — sent only when the form named one; clearing is explicit, because a missing
    // field must never wipe a supplier somebody chose.
    vendorPublicId: form.vendorPublicId || undefined,
    clearVendorLink: form.clearVendorLink || undefined,
  };
}

const cruiseService = {
  /** GET /api/cruises — paged; the page asks for a big page and filters in the browser. */
  getAllCruises: (params = {}) =>
    API.get("/cruises", { params: { page: 0, size: 200, ...params } }),

  getCruise: (id) => API.get(`/cruises/${id}`),

  createCruise: (form) => API.post("/cruises", transformCruiseData(form)),

  updateCruise: (id, form) => API.put(`/cruises/${id}`, transformCruiseData(form)),

  deleteCruise: (id) => API.delete(`/cruises/${id}`),
};

export { cruiseService, transformCruiseData };
export default cruiseService;
