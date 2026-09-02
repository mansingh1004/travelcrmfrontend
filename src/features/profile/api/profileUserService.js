import API from "@shared/api/http";
import { mapUserFromApi, unwrap } from "./userMappers";

const userService = {
  // GET /api/users → mapped list
  getAll: async () => {
    const res = await API.get("/users");
    return { data: (unwrap(res) || []).map(mapUserFromApi) };
  },

  // GET /api/users/stats → { total, active, inactive, managers }
  getStats: async () => {
    const res = await API.get("/users/stats");
    return { data: unwrap(res) };
  },

  // GET /api/users/search?query=
  search: async (query) => {
    const res = await API.get("/users/search", { params: { query } });
    return { data: (unwrap(res) || []).map(mapUserFromApi) };
  },

  // DELETE /api/users/{publicId} (soft delete)
  delete: (publicId) => API.delete(`/users/${publicId}`),

  // PATCH /api/users/{publicId}/toggle-status
  toggleStatus: async (publicId) => {
    const res = await API.patch(`/users/${publicId}/toggle-status`);
    return { data: mapUserFromApi(unwrap(res)) };
  },

  // POST /api/users/{publicId}/reset-password
  resetPassword: (publicId, newPassword, confirmPassword) =>
    API.post(`/users/${publicId}/reset-password`, { newPassword, confirmPassword }),

  // PUT /api/users/{publicId}/leave — inclusive date window, both dates required.
  // Only effect server-side: auto-assignment stops picking this user while the window is open.
  // Their login, permissions and existing leads are untouched.
  setLeave: async (publicId, onLeaveFrom, onLeaveTo) => {
    const res = await API.put(`/users/${publicId}/leave`, { onLeaveFrom, onLeaveTo });
    return { data: mapUserFromApi(unwrap(res)) };
  },

  // DELETE /api/users/{publicId}/leave — early return from leave.
  // Separate from setLeave because a null date in a partial update means "unchanged", not "clear".
  clearLeave: async (publicId) => {
    const res = await API.delete(`/users/${publicId}/leave`);
    return { data: mapUserFromApi(unwrap(res)) };
  },
};

export default userService;