// src/services/userMappers.js
// ─────────────────────────────────────────────────────────────
// Adapts the backend user contract (publicId / name / Role enum /
// isActive, wrapped in ApiResponse<T>) to the shape the profile
// pages render (id / fullName / role label / status string).
//
// Backend conventions (do not expose internal Long id):
//   UserResponseDTO { publicId, name, email, role, phoneNumber, isActive, createdAt }
//   Envelope        ApiResponse { success, message, data, statusCode, timestamp }
// ─────────────────────────────────────────────────────────────

// Backend Role enum → UI label.
export const ROLE_TO_LABEL = {
  SUPERADMIN:   "Super Admin",
  TENANT_ADMIN: "Organization Admin",
  MANAGER:      "Manager",
  TRAVEL_AGENT: "Travel Agent",
  STAFF:        "Staff",
  ACCOUNTANT:   "Account",
  SUB_AGENT:    "Sub-agent",
};

// UI label → backend Role. A tenant admin may assign any tenant role
// (Staff, Manager, Travel Agent, Organization Admin, Account).
export const LABEL_TO_ROLE = {
  "Organization Admin": "TENANT_ADMIN",
  Manager:              "MANAGER",
  "Travel Agent":       "TRAVEL_AGENT",
  Staff:                "STAFF",
  Account:              "ACCOUNTANT",
};

// Pulls the payload out of the ApiResponse envelope. Falls back to the raw
// body for any endpoint that isn't wrapped.
export function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Maps a backend UserResponseDTO to the page model. `username` is derived from
// the email local-part for display only (the backend has no username column).
export function mapUserFromApi(d) {
  if (!d) return null;
  return {
    id:          d.publicId,
    publicId:    d.publicId,
    username:    (d.email || "").split("@")[0],
    fullName:    d.name,
    name:        d.name,
    email:       d.email,
    phone:       d.phoneNumber || "",
    phoneNumber: d.phoneNumber || "",
    role:        ROLE_TO_LABEL[d.role] || "Staff",
    status:      d.isActive ? "Active" : "Inactive",
    isActive:    !!d.isActive,
    createdAt:   fmtDate(d.createdAt),
    lastUpdated: "—",
    lastLogin:   "—",
    permissions: { pages: 0, total: 0 },
  };
}
