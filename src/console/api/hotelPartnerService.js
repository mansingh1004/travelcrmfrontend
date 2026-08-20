import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/hotel-partner";
const stepUpHeaders = (mfaCode) => ({ headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } });

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

  /**
   * One partner's whole history: `{ contactName, contactEmail, events[], messages[], mailboxError }`.
   *
   * `messages` is real correspondence read live from the platform mailbox — envelopes only, both
   * folders, oldest first. It is found by ADDRESS, not by threading headers: the platform mailbox is
   * Gmail by default and Gmail rewrites the Message-ID of everything sent through it, so a stored
   * outbound id would match no reply and the timeline would show "no correspondence" for a partner
   * mid-conversation.
   *
   * `mailboxError` is a soft failure — an unconfigured or unreachable mailbox. The events half is
   * still populated, so render the timeline and note the mail is missing rather than erroring out.
   */
  timeline: (publicId) =>
    ConsoleAPI.get(`${BASE}/invites/${publicId}/timeline`).then(unwrap),

  listRegistrations: ({ status, page = 0, size = 25 } = {}) =>
    ConsoleAPI.get(`${BASE}/registrations`, { params: { status: status || undefined, page, size } })
      .then((res) => ({ rows: res?.data?.data ?? [], pagination: res?.data?.pagination })),

  getRegistration: (publicId) => ConsoleAPI.get(`${BASE}/registrations/${publicId}`).then(unwrap),

  duplicates: (publicId) =>
    ConsoleAPI.get(`${BASE}/registrations/${publicId}/duplicates`).then(unwrap),

  approve: (publicId, mfaCode) =>
    ConsoleAPI.post(`${BASE}/registrations/${publicId}/approve`, null, stepUpHeaders(mfaCode)).then(unwrap),

  reject: (publicId, note, mfaCode) =>
    ConsoleAPI.post(`${BASE}/registrations/${publicId}/reject`, { note }, stepUpHeaders(mfaCode)).then(unwrap),

  requestChanges: (publicId, note, mfaCode) =>
    ConsoleAPI.post(`${BASE}/registrations/${publicId}/request-changes`, { note },
      stepUpHeaders(mfaCode)).then(unwrap),
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
  CHANGES_REQUESTED: { label: "Sent back",       cls: "bg-hue-orange-soft text-hue-orange" },
  APPROVED:          { label: "Approved",        cls: "bg-hue-emerald-soft text-hue-emerald" },
  REJECTED:          { label: "Rejected",        cls: "bg-hue-rose-soft text-hue-rose" },
};
