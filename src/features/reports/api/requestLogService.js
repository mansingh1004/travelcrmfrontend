import API from "@shared/api/http";

/**
 * Request logs for the signed-in tenant.
 *
 * <p><b>There is no tenant parameter here, and adding one would do nothing.</b> The backend
 * (RequestLogQueryService) resolves the scope from TenantContext — set from a signed JWT claim —
 * and discards any tenantPublicId a tenant caller sends without examining it. The absence of the
 * field in this file is therefore documentation, not the enforcement; the enforcement is server
 * side, which is what spec §10 asks for.
 */
const BASE = "/request-logs";

const params = ({
  from = "", to = "", outcome = "", httpStatus = "", httpMethod = "",
  module = "", user = "", endpoint = "", traceId = "", errorCode = "",
} = {}) => {
  const p = {};
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
  return p;
};

export const requestLogService = {
  list: async (filters = {}, { page = 0, size = 25 } = {}) => {
    const res = await API.get(BASE, { params: { ...params(filters), page, size } });
    const body = res?.data ?? {};
    return { rows: body.data ?? [], pagination: body.pagination ?? {} };
  },

  summary: async (filters = {}) => {
    const res = await API.get(`${BASE}/summary`, { params: params(filters) });
    return res?.data?.data ?? null;
  },

  detail: async (publicId) => {
    const res = await API.get(`${BASE}/${publicId}`);
    return res?.data?.data ?? null;
  },
};

export default requestLogService;
