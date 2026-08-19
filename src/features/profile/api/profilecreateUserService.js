import API from "@shared/api/http";
import { LABEL_TO_ROLE, mapUserFromApi, unwrap } from "./userMappers";

export const createUserService = {
  // POST /api/users
  create: async (form) => {
    const payload = {
      name:        (form.fullName || "").trim(),
      username:    (form.username.trim()),
      email:       (form.email || "").trim(),
      password:    form.password,
      role:        LABEL_TO_ROLE[form.role] || "TRAVEL_AGENT",
      phoneNumber: (form.phone || "").trim() || null,
    };
    const res = await API.post("/users", payload);
    return { data: mapUserFromApi(unwrap(res)) };
  },

  // GET /api/users/check-email?email= → { available: boolean }
  checkEmail: async (email) => {
    const res = await API.get("/users/check-email", { params: { email } });
    return unwrap(res);
  },
};

export default createUserService;