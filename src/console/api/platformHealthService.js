import ConsoleAPI, { unwrap } from "./consoleHttp";

export const platformHealthService = {
  summary: () => ConsoleAPI.get("/super-admin/platform-health").then(unwrap),

  jobs: async ({ page = 0, size = 25, jobKey = "", status = "" } = {}) => {
    const params = { page, size };
    if (jobKey) params.jobKey = jobKey;
    if (status) params.status = status;
    const response = await ConsoleAPI.get("/super-admin/platform-health/jobs", { params });
    return {
      rows: Array.isArray(response?.data?.data) ? response.data.data : [],
      pagination: response?.data?.pagination ?? {},
    };
  },
};

export default platformHealthService;
