import { useState } from "react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";

import customerService from "../../api/customerService";

const unwrap = (response) => response?.data?.data ?? response?.data;

/**
 * The three things this page can change about a customer: status, loyalty tier, and existence.
 *
 * ── Why the caches are patched rather than refetched ─────────────────────────────────────────
 * `status` and `tier` live in TWO places at once — the summary (which paints the band's badges)
 * and the cached Overview record (which backs the selects). A PATCH returns the updated customer,
 * so both are patched from that response. Refetching either would cost a round trip for fields the
 * server just handed back, and leaving one stale is how the badge and the select came to disagree
 * after a change.
 *
 * Both patches go through a setState. The Overview cache was previously mutated in place with
 * Object.assign, which rendered correctly only because the sibling setSummary forced a re-render
 * anyway — it would have broken silently under React.memo or StrictMode's double-invoke.
 *
 * ── Error handling ───────────────────────────────────────────────────────────────────────────
 * `isAlreadyReported` first, every time: the shared axios interceptor owns 401/403/429/5xx and has
 * already toasted them. Toasting again would double up. What is left — 400, 404, 409, validation —
 * is silent by design at the interceptor, so the call site must surface it, and does.
 */
export function useCustomerMutations({ id, summary, setSummary, overviewSection, canEdit, showToast, onDeleted }) {
  const [updating, setUpdating] = useState("");

  const applyUpdate = async (kind, call, successMessage, failureMessage) => {
    setUpdating(kind);
    try {
      const patch = pickBadgeFields(unwrap(await call()));
      setSummary((current) => ({ ...current, ...patch }));
      overviewSection.patch(patch);
      showToast(successMessage, "success");
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, failureMessage), "error");
    } finally {
      setUpdating("");
    }
  };

  const updateStatus = (next) => {
    if (!canEdit || next === summary?.status) return undefined;
    return applyUpdate("status",
      () => customerService.updateStatus(id, next),
      "Customer status updated.", "Could not update customer status.");
  };

  const updateTier = (next) => {
    if (!canEdit || next === summary?.tier) return undefined;
    return applyUpdate("tier",
      () => customerService.updateTier(id, next),
      "Loyalty tier updated.", "Could not update loyalty tier.");
  };

  const moveToTrash = async () => {
    // Native confirm, matching the other 17 destructive actions in this app. Replacing it here
    // alone would make this one screen behave differently for no gain; it is a whole-app change.
    if (!window.confirm(`Move ${summary?.name || "this customer"} to Trash?`)) return;
    setUpdating("delete");
    try {
      await customerService.delete(id);
      showToast("Customer moved to Trash.", "success");
      onDeleted();
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Could not move customer to Trash."), "error");
      }
      setUpdating("");
    }
  };

  return { updating, updateStatus, updateTier, moveToTrash };
}

/** The two fields the band's badges and the Overview selects read. */
function pickBadgeFields(updated) {
  if (!updated) return {};
  const patch = {};
  if (updated.status) patch.status = updated.status;
  if (updated.tier) patch.tier = updated.tier;
  return patch;
}
