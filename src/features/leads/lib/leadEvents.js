// A tiny in-tab bridge from the always-mounted lead-alert SSE provider to screens that own their
// own server-paged data. It avoids opening a second EventSource just to keep All Leads current.

export const LEAD_STATE_CHANGED_EVENT = "travelcrm:lead-state-changed";

export function publishLeadStateChanged(lead) {
  if (!lead?.leadPublicId || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEAD_STATE_CHANGED_EVENT, { detail: lead }));
}
