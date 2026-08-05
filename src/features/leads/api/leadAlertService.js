// src/features/leads/api/leadAlertService.js
//
// The claim window's HTTP surface: the incoming-leads feed, its tiles, and the four ownership
// actions. Live updates arrive over SSE (see useLeadAlerts); these are what the page loads with and
// what it re-syncs from after a reconnect.
//
// Uses the shared axios client, so the JWT, the 401 logout and the centralised error toasts all
// apply. Per the error contract in shared/api/authRealm.js, 400/404/409 are SILENT here — they are
// about the data the user just acted on, so the CALL SITE renders them. That is deliberate for
// claim: a lost race is a 409 the row itself must explain ("now owned by Priya"), not a floating
// toast that vanishes before the user looks at the list.

import API from "@shared/api/http";

/** ApiResponse envelope: { message, data }. Same unwrap the console client uses. */
const unwrap = (res) => res?.data?.data ?? res?.data;

export const leadAlertService = {
  // ── Reads ────────────────────────────────────────────────────────────────

  /** Every lead currently open to claim, newest first. */
  async getOpenLeads() {
    const res = await API.get("/leads/alerts/open");
    // Always an array: the list renders `.map` unguarded, and one bad response should show an
    // empty screen rather than crash the route into RouteErrorBoundary.
    return unwrap(res) ?? [];
  },

  /** The four tiles — newToday, openToClaim, avgFirstResponseSeconds, slaBreaches, slaTargetSeconds. */
  async getStats() {
    const res = await API.get("/leads/alerts/stats");
    return unwrap(res) ?? {};
  },

  /** The ownership timeline for one lead, oldest first. */
  async getAssignmentHistory(publicId) {
    const res = await API.get(`/leads/${publicId}/assignment-history`);
    return unwrap(res) ?? [];
  },

  /**
   * The assignable-user pool — the reassign picker's only source, and the only place the client can
   * learn its OWN publicId (`self.id`).
   *
   * Two mismatches to know about. It is gated on LEAD_CREATE while /reassign is gated on
   * LEAD_REASSIGN_LOCKED, so a manager can legitimately hold the action and be refused the dropdown;
   * the caller must degrade rather than treat a 403 as a fault. And `eligibleUsers` is populated only
   * for privileged assigners — an agent gets `self` and an empty pool.
   */
  async getAssignmentPool() {
    const res = await API.get("/leads/assignment/recommendation");
    return unwrap(res) ?? {};
  },

  // ── Ownership actions ────────────────────────────────────────────────────

  /**
   * Claim a lead, overriding its current owner.
   *
   * `expectedClaimVersion` is REQUIRED and must be the version the user actually saw. Passing
   * anything else — a re-read, a default 0 — turns the server's compare-and-swap into a blind
   * overwrite that always wins, which is exactly the race it exists to stop.
   *
   * Throws on 409 (someone got there first). The rejection carries
   * `details: { claimLost, reason, currentOwnerName, claimVersion }` — see claimLostInfo().
   */
  async claim(publicId, expectedClaimVersion, note) {
    const res = await API.post(`/leads/${publicId}/claim`, {
      expectedClaimVersion,
      note,
    });
    return unwrap(res);
  },

  /** Mark first contact — locks the lead and stops the SLA clock. Does NOT change the owner. */
  async markContacted(publicId, note) {
    const res = await API.post(`/leads/${publicId}/contacted`, { note });
    return unwrap(res);
  },

  /** Move a LOCKED lead to another owner. Manager/admin only (LEAD_REASSIGN_LOCKED). */
  async reassign(publicId, assignedUserId, note) {
    const res = await API.post(`/leads/${publicId}/reassign`, { assignedUserId, note });
    return unwrap(res);
  },

  /** Undo an accidental "Mark Contacted" — only from Contacted. Manager/admin only. */
  async reopenClaim(publicId, note) {
    const res = await API.post(`/leads/${publicId}/reopen-claim`, { note });
    return unwrap(res);
  },
};

/**
 * Pull the structured lost-claim payload off a rejected claim, or null if this was some other error.
 *
 * The backend answers a lost race with 409 + `details.claimLost`, naming the winner and the fresh
 * version. Reading that is what lets the row say "now owned by Priya" and re-arm its button with a
 * version that will actually match — instead of the user clicking a dead button forever because
 * their cached version can never win again.
 */
export function claimLostInfo(err) {
  const details = err?.response?.data?.details;
  if (!details?.claimLost) return null;
  return {
    reason: details.reason,                       // VERSION_STALE | ALREADY_CONTACTED | TERMINAL_STAGE | NOT_LOCKED
    ownerName: details.currentOwnerName ?? null,
    claimVersion: details.claimVersion ?? 0,
    message: err?.response?.data?.message ?? "Someone else claimed this lead first.",
  };
}

/**
 * The single branch point for every way a claim-window action can fail, normalised into what the UI
 * actually has to decide: does the row stay and stay clickable, or does it go?
 *
 * Four shapes arrive on the same button and they are NOT distinguishable by status alone:
 *
 *  - 409 + `details.claimLost` — a lost race. `VERSION_STALE` is retryable and the body carries the
 *    fresh version to retry WITH; `ALREADY_CONTACTED` / `TERMINAL_STAGE` mean the lead is gone.
 *  - 409 without `details` — a refused reopen. Same status, same `code: CONFLICT`, no claimLost
 *    block; only `message` is meaningful.
 *  - 404 — deleted, or locked-and-now-out-of-scope. The backend cannot tell these apart and neither
 *    can we, deliberately: revealing which would leak the existence of other teams' leads.
 *  - 403 `PERMISSION_DENIED` with the pool message — the caller holds LEAD_CLAIM but can never own a
 *    lead (inactive, locked, or a sub-agent). Distinct from a missing-permission 403 because it is
 *    permanent for the session and the button should stop offering itself.
 *
 * Returns null for anything else, which is the caller's signal to fall through to the generic
 * error path (the interceptor has usually already spoken).
 */
export function claimFailure(err) {
  const status = err?.response?.status;
  const body = err?.response?.data;

  const lost = claimLostInfo(err);
  if (lost) {
    return {
      ...lost,
      // VERSION_STALE is the only outcome where the lead is still open and still winnable.
      retryable: lost.reason === "VERSION_STALE",
      gone: lost.reason === "ALREADY_CONTACTED" || lost.reason === "TERMINAL_STAGE",
    };
  }

  if (status === 404) {
    return {
      reason: "GONE",
      ownerName: null,
      claimVersion: null,
      message: "This lead is no longer available.",
      retryable: false,
      gone: true,
    };
  }

  // MODULE_NOT_ENABLED shares this status and is handled by the interceptor's upgrade path.
  if (status === 403 && body?.code === "PERMISSION_DENIED" && body?.message) {
    return {
      reason: "INELIGIBLE",
      ownerName: null,
      claimVersion: null,
      message: body.message,
      retryable: false,
      gone: false,
    };
  }

  if (status === 409 && body?.message) {
    return {
      reason: "REFUSED",
      ownerName: null,
      claimVersion: null,
      message: body.message,
      retryable: false,
      gone: false,
    };
  }

  return null;
}

export default leadAlertService;
