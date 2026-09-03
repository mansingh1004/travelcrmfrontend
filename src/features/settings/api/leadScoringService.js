// src/features/settings/api/leadScoringService.js
//
// The tenant's Hot / Warm / Cold rules — read, publish, simulate.
//
// Uses the shared client (@shared/api/http) like every other feature service; there is exactly one
// axios instance per auth realm in this tree and a feature must never create its own.
//
// Response envelope: the backend wraps everything in ApiResponse, so `res.data.data` is the payload.
// Unwrapped here rather than at every call site, matching consoleHttp's `unwrap` helper.

import API from "@shared/api/http";

const unwrap = (res) => res?.data?.data ?? res?.data;

export const leadScoringService = {
  /**
   * The field registry — every scoring field with its type, allowed operators and enum options,
   * grouped for the picker.
   *
   * THE RULE BUILDER IS BUILT ENTIRELY FROM THIS. Do not hardcode field keys, operator lists or
   * enum values in the UI: adding a scoring field is one backend registry entry, and anything the
   * frontend duplicates will drift the way LEAD_SOURCES in LeadInformation.jsx did.
   *
   * Returns { [groupName]: [{ key, label, group, type, operators[], options[], available,
   * unavailableReason }] }. Unavailable fields ARE returned — render them disabled with the reason.
   */
  getFields: () => API.get("/leads/scoring/fields").then(unwrap),

  /** The live ruleset. 404s only if the tenant somehow has none — the backfill gives every tenant one. */
  getConfig: () => API.get("/leads/scoring/config").then(unwrap),

  /**
   * Publish a new version. The previous one is deactivated, never edited in place.
   *
   * A 400 comes back with `fieldErrors` keyed the way Spring keys nested collections
   * ("rules[2].conditions[0].operator"), so the builder highlights the offending row inline.
   * Per the app's error policy a 400 is SILENT at the interceptor — the call site must render it.
   */
  saveConfig: (config, note = null, recomputeNow = true) =>
    API.put("/leads/scoring/config", { config, note, recomputeNow }).then(unwrap),

  /** Version history, newest first. */
  getVersions: () => API.get("/leads/scoring/config/versions").then(unwrap),

  /** Republish an earlier version as a NEW version — numbers stay monotonic. */
  restoreVersion: (publicId) =>
    API.post(`/leads/scoring/config/versions/${publicId}/restore`).then(unwrap),

  /**
   * Score a real lead against a DRAFT ruleset. Nothing is saved.
   *
   * Runs the same engine the nightly job does, so the preview IS what will happen — not an
   * approximation. Returns a ScoringResult with the per-condition trace.
   */
  simulate: (leadPublicId, config) =>
    API.post("/leads/scoring/simulate", { leadPublicId, config }).then(unwrap),

  /** The flat snapshot the engine sees for one lead — the "what we know about this lead" panel. */
  getSnapshot: (leadPublicId) =>
    API.get(`/leads/scoring/simulate/${leadPublicId}/snapshot`).then(unwrap),

  /** Re-score every lead now, without publishing a new version. Returns { scanned, changed }. */
  recompute: () => API.post("/leads/scoring/recompute").then(unwrap),
};

export default leadScoringService;
