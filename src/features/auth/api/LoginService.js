// src/features/auth/api/LoginService.js
//
// The tenant workspace login. ONE realm: tenant users.
//
// This form used to probe auth/superadmin/login first and fall back to the tenant endpoint, so a
// platform SuperAdmin could sign in here — and AdminLogin then persisted that platform JWT under
// localStorage["token"], the TENANT key. Nothing downstream re-checked the realm: router.jsx gates
// on a token merely existing, so the SuperAdmin got the whole tenant shell, and every tenant
// endpoint that casts the principal to `User` was handed a principal it cannot cast. The
// notification bell was just the first thing to call home on mount, once per page load.
//
// The platform realm has its own login at /superadmin/login, its own token ("sa_token"), and its
// own axios instance — ConsoleLogin's comment states the invariant this file used to break:
// "never `token` — a tenant session must survive alongside it". This form no longer knows the
// platform realm exists, which is the only durable way to keep that true.

import API from "@shared/api/http";

// The credential is a USERNAME now, not an email address. Staff email lost its unique index so an
// agency can share one office mailbox, which left it unable to identify an account; `username` is
// the unique login identity (uq_users_username_active).
//
// `username` is what the backend reads. `email` is still sent with the same value purely as a wire
// compatibility shim — LoginRequestDTO.getLoginIdentifier() prefers `username` and falls back to
// `email`, so this keeps working against a backend deployed either side of the change. Drop the
// `email` key once the backend rollout is done everywhere.
function transformLoginData(username, password) {
  return {
    username: username,
    email: username,
    password: password,
  };
}

export const authService = {
  login: async (username, password) => {
    const response = await API.post("auth/user/login", transformLoginData(username, password));

    // Preserve the REAL tenant role from the backend (TENANT_ADMIN / MANAGER / TRAVEL_AGENT /
    // STAFF / ACCOUNTANT). This was once hard-coded to "user", which made every tenant user
    // appear as STAFF in the UI (Users menu hidden, etc.).
    if (!response.data.role) response.data.role = "user";
    return response;
  },
};
