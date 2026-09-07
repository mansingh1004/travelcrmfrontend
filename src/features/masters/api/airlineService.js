import API from "@shared/api/http";
import { uploadImageViaApi } from "./imageUpload";

// ============================================================
// IMAGE UPLOAD
// ============================================================

export function uploadAirlineLogo(file, onProgress) {
  return uploadImageViaApi(
    "/airlines/upload-image",
    file,
    onProgress
  );
}

// ============================================================
// RESPONSE NORMALIZER
// ============================================================

export function normalizeAirlineList(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  if (Array.isArray(responseData?.content)) {
    return responseData.content;
  }

  if (Array.isArray(responseData?.data?.content)) {
    return responseData.data.content;
  }

  if (Array.isArray(responseData?.airlines)) {
    return responseData.airlines;
  }

  return [];
}

// ============================================================
// FRONTEND FORM → BACKEND DTO
// ============================================================

function transformAirlineData(formData) {
  return {
    name: formData.name?.trim(),
    iataCode: formData.iata?.trim().toUpperCase(),
    country: formData.country?.trim() || "",
    fleetSize:
      formData.fleet !== "" && formData.fleet != null
        ? Number(formData.fleet)
        : 0,

    // Convert UI format to backend enum format
    status: formData.status?.toUpperCase() || "ACTIVE",

    logoUrl: formData.logoUrl || null,

    // Supplier link — usually the consolidator the agency actually buys tickets through, rarely the
    // carrier itself. Absence never clears one; removing sends clearVendorLink.
    vendorPublicId: formData.vendorPublicId || undefined,
    clearVendorLink: formData.clearVendorLink || undefined,
  };
}

// ============================================================
// BACKEND RESPONSE → FRONTEND MODEL
// ============================================================

export function transformAirlineResponse(backendData, index = 0) {
  const name = backendData.name ?? "";

  const initials =
    backendData.iataCode ??
    backendData.iata ??
    name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const backendStatus = backendData.status ?? "ACTIVE";

  return {
    publicId:
      backendData.publicId ??
      backendData.id,

    id:
      backendData.publicId ??
      backendData.id,

    name,

    iata:
      backendData.iataCode ??
      backendData.iata ??
      initials,

    country:
      backendData.country ??
      "",

    // The supplier tickets are bought through, resolved server-side. Kept on the row so the list
    // card can name it without a second call.
    vendorName: backendData.vendorName ?? null,

    fleet:
      backendData.fleetSize ??
      backendData.fleet ??
      0,

    status:
      backendStatus.charAt(0).toUpperCase() +
      backendStatus.slice(1).toLowerCase(),

    logo:
      backendData.logoUrl ??
      backendData.logo ??
      backendData.imagePath ??
      null,

    logoUrl:
      backendData.logoUrl ??
      backendData.logo ??
      backendData.imagePath ??
      null,

    initials,

    createdAt:
      backendData.createdAt ??
      backendData.createdDate ??
      new Date().toISOString(),

    themeIndex: index,
  };
}

// ============================================================
// AIRLINE SERVICE
// ============================================================

export const airlineService = {
  // 1. GET ALL
  getAllAirlines: () =>
    API.get("/airlines"),

  // 2. GET BY PUBLIC ID
  getAirlineById: (publicId) =>
    API.get(`/airlines/${publicId}`),

  // 3. CREATE
  createAirline: (formData) =>
    API.post(
      "/airlines",
      transformAirlineData(formData)
    ),

  // 4. UPDATE
  updateAirline: (publicId, formData) =>
    API.put(
      `/airlines/${publicId}`,
      transformAirlineData(formData)
    ),

  // 5. DELETE
  deleteAirline: (publicId) =>
    API.delete(`/airlines/${publicId}`),

  // 6. SEARCH
  searchAirlines: (searchTerm) =>
    API.get("/airlines/search", {
      params: { q: searchTerm },
    }),

  // 7. FILTER BY STATUS
  getAirlinesByStatus: (status) =>
    API.get("/airlines/filter", {
      params: { status },
    }),
};