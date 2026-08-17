import ConsoleAPI, { unwrap } from "./consoleHttp";

/**
 * Queue AGE for the SuperAdmin action inbox.
 *
 * Purely additive to what ConsoleHome already fetches: the counts still come from the same services
 * they always did, and this only supplies "how long has the oldest one been waiting". That keeps a
 * failure here cosmetic — the inbox degrades to the counts it showed before, never to an empty page.
 *
 * Returns a map keyed by the backend's ActionInboxQueue constant:
 *   { UPGRADE_REQUESTS: { count, oldestPendingAt, ageTracked }, ... }
 * Queues computed live (expiring access, quota breaches) are deliberately absent — they have no
 * arrival instant, so there is no age to report for them.
 */
export const actionInboxService = {
  ages: async () => {
    const body = await ConsoleAPI.get("/super-admin/action-inbox").then(unwrap);
    const byKey = {};
    for (const entry of body?.queues ?? []) byKey[entry.key] = entry;
    return byKey;
  },
};

export default actionInboxService;
