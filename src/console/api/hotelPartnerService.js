import ConsoleAPI, { unwrap } from "./consoleHttp";

const BASE = "/super-admin/hotel-partner";

/**
 * SuperAdmin side of hotel-partner onboarding.
 *
 * Note on `create`/`resend`: the response carries `registrationLink`, and that is the ONLY moment the
 * raw token is readable anywhere. The backend stores a SHA-256 hash, so a later list call cannot
 * reconstruct it — the UI must offer "copy link" right there and "resend" (which rotates the token)
 * afterwards, never "show link again".
 */
export const hotelPartnerService = {
  listInvites: ({ status, page = 0, size = 25 } = {}) =>
    ConsoleAPI.get(`${BASE}/invites`, { params: { status: status || undefined, page, size } })
      .then((res) => ({ rows: res?.data?.data ?? [], pagination: res?.data?.pagination })),

  createInvite: (body) => ConsoleAPI.post(`${BASE}/invites`, body).then(unwrap),

  resendInvite: (publicId) => ConsoleAPI.post(`${BASE}/invites/${publicId}/resend`).then(unwrap),

  revokeInvite: (publicId) => ConsoleAPI.delete(`${BASE}/invites/${publicId}`).then(unwrap),

  listRegistrations: ({ status, page = 0, size = 25 } = {}) =>
    ConsoleAPI.get(`${BASE}/registrations`, { params: { status: status || undefined, page, size } })
      .then((res) => ({ rows: res?.data?.data ?? [], pagination: res?.data?.pagination })),

  getRegistration: (publicId) => ConsoleAPI.get(`${BASE}/registrations/${publicId}`).then(unwrap),

  duplicates: (publicId) =>
    ConsoleAPI.get(`${BASE}/registrations/${publicId}/duplicates`).then(unwrap),

  approve: (publicId) => ConsoleAPI.post(`${BASE}/registrations/${publicId}/approve`).then(unwrap),

  reject: (publicId, note) =>
    ConsoleAPI.post(`${BASE}/registrations/${publicId}/reject`, { note }).then(unwrap),

  requestChanges: (publicId, note) =>
    ConsoleAPI.post(`${BASE}/registrations/${publicId}/request-changes`, { note }).then(unwrap),
};

export const INVITE_STATUS = {
  PENDING:   { label: "Sent",      cls: "bg-hue-sky-soft text-hue-sky" },
  OPENED:    { label: "Opened",    cls: "bg-hue-indigo-soft text-hue-indigo" },
  SUBMITTED: { label: "Submitted", cls: "bg-hue-amber-soft text-hue-amber" },
  COMPLETED: { label: "Approved",  cls: "bg-hue-emerald-soft text-hue-emerald" },
  REVOKED:   { label: "Revoked",   cls: "bg-surface-hover text-muted" },
  EXPIRED:   { label: "Expired",   cls: "bg-surface-hover text-muted" },
};

export const REG_STATUS = {
  DRAFT:             { label: "In progress",     cls: "bg-surface-hover text-muted" },
  SUBMITTED:         { label: "Awaiting review", cls: "bg-hue-amber-soft text-hue-amber" },
  CHANGES_REQUESTED: { label: "Sent back",       cls: "bg-hue-sky-soft text-hue-sky" },
  APPROVED:          { label: "Approved",        cls: "bg-hue-emerald-soft text-hue-emerald" },
  REJECTED:          { label: "Rejected",        cls: "bg-hue-rose-soft text-hue-rose" },
};
