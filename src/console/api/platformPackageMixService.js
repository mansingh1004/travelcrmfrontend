// src/console/api/platformPackageMixService.js
//
// The platform's own mix-and-match queue.
//
// Agency-to-agency enquiries are NOT here and there is no endpoint for them: answering one would
// mean the platform quoting on somebody else's behalf, under their name, with their money. This
// covers only requests whose seller is the platform — which, without it, nobody could answer at
// all, because the platform has no tenant queue to answer them from.
//
// Both writes are step-up protected server-side, so they take an MFA code like every other console
// write. The reads are not: a code prompt to open a list teaches operators to type codes without
// reading them.

import ConsoleAPI, { unwrap } from "./consoleHttp";
import { SUPERADMIN_MFA_HEADER } from "./userService";

const BASE = "/super-admin/package-marketplace/mix";

const mfa = (mfaCode) => ({ headers: { [SUPERADMIN_MFA_HEADER]: mfaCode } });

/** PagedApiResponse<T> → { items, pagination }. Note `data`, not `content`. */
const paged = (res) => ({
  items: Array.isArray(res?.data?.data) ? res.data.data : [],
  pagination: res?.data?.pagination ?? null,
});

const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const platformPackageMixService = {
  list: async (params = {}) => paged(await ConsoleAPI.get(`${BASE}/requests`, { params: clean(params) })),

  pendingCount: async () =>
    (await ConsoleAPI.get(`${BASE}/requests/pending-count`).then(unwrap))?.count ?? 0,

  get: (publicId) => ConsoleAPI.get(`${BASE}/requests/${publicId}`).then(unwrap),

  respond: (publicId, payload, mfaCode) =>
    ConsoleAPI.post(`${BASE}/requests/${publicId}/respond`, payload, mfa(mfaCode)).then(unwrap),

  decline: (publicId, reason, mfaCode) =>
    ConsoleAPI.post(`${BASE}/requests/${publicId}/decline`, { reason }, mfa(mfaCode)).then(unwrap),
};

/** Status → label and console hue classes. `_default` keeps an unknown value legible. */
export const MIX_STATUS = {
  PENDING: { label: "Awaiting price", cls: "bg-hue-amber-soft text-hue-amber" },
  PRICED: { label: "Priced", cls: "bg-hue-sky-soft text-hue-sky" },
  ACCEPTED: { label: "Accepted", cls: "bg-hue-emerald-soft text-hue-emerald" },
  DECLINED: { label: "Declined", cls: "bg-hue-rose-soft text-hue-rose" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-muted text-body" },
  EXPIRED: { label: "Expired", cls: "bg-muted text-body" },
  _default: { label: "", cls: "bg-muted text-body" },
};

export const mixStatus = (value) =>
  MIX_STATUS[value] ? MIX_STATUS[value] : { ...MIX_STATUS._default, label: value ?? "" };

export default platformPackageMixService;
