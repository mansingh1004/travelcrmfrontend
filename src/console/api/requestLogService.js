import ConsoleAPI, { unwrap } from "./consoleHttp";

/**
 * Platform request logs — every tenant, or one.
 *
 * <p>`tenantPublicId` is the ONLY filter here that the tenant-side service does not have, and that
 * asymmetry is the whole difference between the two portals. The backend does not take it on
 * trust either: RequestLogQueryService honours it only for a platform SuperAdmin and discards it
 * outright for a tenant user, so sending it from the wrong client changes nothing.
 */
const BASE = "/super-admin/request-logs";

/** Only send what was actually chosen — a blank filter must not become `?module=` on the wire. */
const params = ({
  tenantPublicId = "",
  from = "",
  to = "",
  outcome = "",
  httpStatus = "",
  httpMethod = "",
  module = "",
  user = "",
  endpoint = "",
  traceId = "",
  errorCode = "",
  environment = "",
} = {}) => {
  const p = {};
  if (tenantPublicId) p.tenantPublicId = tenantPublicId;
  if (from) p.from = `${from}T00:00:00`;
  if (to) p.to = `${to}T23:59:59`;
  if (outcome) p.outcome = outcome;
  if (httpStatus) p.httpStatus = httpStatus;
  if (httpMethod) p.httpMethod = httpMethod;
  if (module) p.module = module;
  if (user) p.user = user;
  if (endpoint) p.endpoint = endpoint;
  if (traceId) p.traceId = traceId;
  if (errorCode) p.errorCode = errorCode;
  if (environment) p.environment = environment;
  return p;
};

export const requestLogService = {
  list: async (filters = {}, { page = 0, size = 25 } = {}) => {
    const res = await ConsoleAPI.get(BASE, { params: { ...params(filters), page, size } });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  /** Same filters as the list, so the cards can never describe a wider set than the rows below. */
  summary: (filters = {}) =>
    ConsoleAPI.get(`${BASE}/summary`, { params: params(filters) }).then(unwrap),

  detail: (publicId) => ConsoleAPI.get(`${BASE}/${publicId}`).then(unwrap),
};

export default requestLogService;
