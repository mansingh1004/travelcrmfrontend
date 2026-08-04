import API from "@shared/api/http";
import { LABEL_TO_ROLE, mapUserFromApi, unwrap } from "./userMappers";

export const editUserService = {
  // GET /api/users/{publicId}
  getById: async (publicId) => {
    const res = await API.get(`/users/${publicId}`);
    return { data: mapUserFromApi(unwrap(res)) };
  },

  // PUT /api/users/{publicId} — profile update (no password; that has its own endpoint)
  //
  // `email` is the LOGIN identifier and is only sent when the caller supplies one, so existing
  // callers that omit it keep the old no-email behaviour. The server is the authority on whether
  // it accepts the field — see the post-save check in EditUser.jsx, which reports it back to the
  // user if the returned DTO still carries the old address.
  update: async (publicId, data) => {
    const payload = {
      name:        (data.fullName || "").trim(),
      role:        LABEL_TO_ROLE[data.role] || "TRAVEL_AGENT",
      phoneNumber: (data.phone || "").trim() || null,
      isActive:    data.isActive ?? (data.status === "Active"),
      ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
    };
    const res = await API.put(`/users/${publicId}`, payload);
    return { data: mapUserFromApi(unwrap(res)) };
  },

  // POST /api/users/{publicId}/reset-password
  resetPassword: (publicId, newPassword, confirmPassword) =>
    API.post(`/users/${publicId}/reset-password`, { newPassword, confirmPassword }),

  // Convenience: update profile, then reset password if a new one was provided.
  fullUpdate: async (publicId, data) => {
    const result = await editUserService.update(publicId, data);
    if (data.newPassword) {
      await editUserService.resetPassword(publicId, data.newPassword, data.confirmPassword);
    }
    return result;
  },
};

export default editUserService;