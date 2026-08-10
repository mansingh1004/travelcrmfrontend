// src/shared/api/fxService.js
//
// Exchange rates for the currency converter. Thin: the server already caches per
// TTL (FxRateService), so this layer exists to keep the PALETTE instant — a
// conversion must appear as you type, not one round-trip later.
//
// Three levels, fastest first:
//   1. module memory  — same tab, same session, zero cost
//   2. localStorage   — a reopened tab shows a number before the request lands
//   3. the API        — /api/tools/fx/rates, single-flighted
//
// The cached copy is served immediately and refreshed in the background when it
// ages out, so the converter never blocks on the network. A failed refresh leaves
// the last good rates in place, flagged `stale`, and the UI says how old they are.

import API from "./http";

const STORAGE_KEY = "fx:rates";
/** Past this, the cached copy is still shown but a background refresh is kicked off. */
const CLIENT_TTL_MS = 6 * 60 * 60 * 1000;

/** Nothing known yet — the converter turns this into manual rate entry. */
const EMPTY = { base: "INR", rates: {}, fetchedAt: null, stale: true, source: "UNAVAILABLE" };

let memo = null;
let inflight = null;

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.rates && Object.keys(parsed.rates).length ? parsed : null;
  } catch {
    return null;   // quota-cleared, private mode, or someone else's key shape
  }
}

function writeStorage(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
  } catch {
    /* storage full or blocked — the in-memory copy still works for this session */
  }
}

function isFresh(payload) {
  const at = payload?.cachedAt;
  return Boolean(at) && Date.now() - at < CLIENT_TTL_MS;
}

/**
 * Whatever is known right now, without touching the network. Safe to call on every
 * keystroke — this is what makes the palette's inline conversion feel instant.
 */
export function cachedRates() {
  if (!memo) memo = readStorage();
  return memo || null;
}

async function fetchRates() {
  if (inflight) return inflight;
  inflight = API.get("/tools/fx/rates")
    .then((res) => {
      const data = res?.data?.data ?? res?.data ?? null;
      if (!data || !data.rates || !Object.keys(data.rates).length) {
        // The server answers 200 with an empty map when the provider is unreachable
        // (see FxController) — keep any older copy rather than blanking the UI.
        return memo || EMPTY;
      }
      memo = data;
      writeStorage(data);
      return data;
    })
    .catch(() => memo || readStorage() || EMPTY)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Rates for the converter.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.force] skip the cache and go to the server (the modal's refresh button)
 * @returns {Promise<{base:string, rates:Record<string,number>, fetchedAt:?string, stale:boolean, source:string}>}
 */
export async function getRates({ force = false } = {}) {
  if (force) return fetchRates();

  const cached = cachedRates();
  if (cached && isFresh(cached)) return cached;
  if (cached) {
    fetchRates();     // refresh behind the user; they already have numbers on screen
    return cached;
  }
  return fetchRates();
}
