import API from "@shared/api/http";
import { uploadImageViaApi } from "./imageUpload";

/**
 * Vehicle image upload — backend-proxied (quota-enforced + metered).
 * Naam legacy hai; signature same rakhi hai taaki koi caller na toote.
 *
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<string>} secure_url
 */
export function uploadImageToCloudinary(file, onProgress) {
  return uploadImageViaApi("/vehicles/upload-image", file, onProgress);
}

// ============================================================
// RESPONSE NORMALIZER
// ============================================================
export function normalizeVehicleList(responseData) {
  if (Array.isArray(responseData))                          return responseData;
  if (responseData && Array.isArray(responseData.data))     return responseData.data;
  if (responseData && Array.isArray(responseData.vehicles)) return responseData.vehicles;
  return [];
}

// ============================================================
// TRANSFORMER: Frontend formData → Backend DTO
// ============================================================
function transformVehicleData(formData) {
  return {
    name        : formData.name?.trim(),
    type        : formData.type?.trim(),
    capacity    : formData.capacity !== "" && formData.capacity != null
                    ? Number(formData.capacity)
                    : null,
    description : formData.description?.trim() || "",
    // imagePath = Cloudinary secure_url (already uploaded)
    imagePath   : formData.imagePath || null,
    // Supplier link — the operator this vehicle is hired from. Absence never clears one; removing
    // a supplier sends clearVendorLink, which is what the backend requires.
    vendorPublicId  : formData.vendorPublicId || undefined,
    clearVendorLink : formData.clearVendorLink || undefined,
  };
}

// ============================================================
// REVERSE TRANSFORMER: Backend response → Frontend formData
// ============================================================
export function transformVehicleResponse(backendData) {
  return {
    name         : backendData.name        ?? "",
    type         : backendData.type        ?? "",
    capacity     : backendData.capacity    != null
                     ? backendData.capacity.toString()
                     : "",
    description  : backendData.description ?? "",
    image        : backendData.imagePath   ?? backendData.image ?? null,
    imagePreview : backendData.imagePath   ?? backendData.image ?? null,
    imagePath    : backendData.imagePath   ?? backendData.image ?? null,
  };
}

// ============================================================
// VEHICLE SERVICE
// ============================================================
export const vehicleService = {

  // 1. GET ALL
  getAllVehicles: () =>
    API.get("/vehicles"),

  // 2. GET BY ID
  getVehicleById: (publicId) =>
    API.get(`/vehicles/${publicId}`),

  // 3. CREATE — imagePath already in formData (from Cloudinary)
  createVehicle: (formData) =>
    API.post("/vehicles", transformVehicleData(formData)),

  // 4. UPDATE
  updateVehicle: (publicId, formData) =>
    API.put(`/vehicles/${publicId}`, transformVehicleData(formData)),

  // 5. DELETE
  deleteVehicle: (publicId) =>
    API.delete(`/vehicles/${publicId}`),

  // 6. FILTER BY TYPE
  getVehiclesByType: (type) =>
    API.get("/vehicles/filter", { params: { type } }),

  // 7. SEARCH
  searchVehicles: (searchTerm) =>
    API.get("/vehicles/search", { params: { q: searchTerm } }),
};