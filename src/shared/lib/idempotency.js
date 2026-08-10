// src/shared/lib/idempotency.js
//
// A stable per-form idempotency key, for endpoints that require an `Idempotency-Key` header.
//
// Lives in shared/ because more than one feature needs it: creating a booking and converting a lead
// both hard-require the header (BookingController:64, LeadConversionController:45 — the request is
// rejected with 400 without it), and the marketplace submit does too. Reaching into
// `@features/marketplace` for it from bookings would be a dependency between two unrelated features
// in the wrong direction; this is cross-cutting infrastructure, so it belongs here.
//
// (`features/marketplace/components/marketplaceUi.jsx` still carries its own copy. It works and is
// in use, so it is deliberately left alone rather than refactored as a side effect of a bug fix.)

import { useCallback, useState } from "react";

const makeKey = (prefix) => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Older browsers / non-secure contexts: crypto.randomUUID is unavailable outside HTTPS and
  // localhost. Uniqueness per form instance is all that is needed — this key is scoped to one
  // tenant and one submit, never a global identifier.
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Returns `{ key, reset }`.
 *
 * **Stable across re-renders AND across failed submits — that is the entire point.** Retrying after
 * a 500, a timeout or a dropped connection must reuse the same key, so the server recognises the
 * retry and returns the booking it already created instead of minting a second one. Generating a
 * fresh key per call (say, inside the API service) would defeat the mechanism completely: a
 * double-clicked button would send two different keys and create two bookings.
 *
 * Call `reset()` only after a submit the user considers finished — a successful save, or a
 * "Save & New" that starts a genuinely new record. Never in a catch block.
 */
export function useIdempotencyKey(prefix = "req") {
  const [key, setKey] = useState(() => makeKey(prefix));
  return {
    key,
    reset: useCallback(() => setKey(makeKey(prefix)), [prefix]),
  };
}
