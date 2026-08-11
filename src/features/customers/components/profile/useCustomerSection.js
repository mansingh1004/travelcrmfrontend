import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@shared/api/apiError";

/**
 * Load one profile section, once, on first open of its tab.
 *
 * The whole point of the 360 rebuild is that the page makes a single eager call and each tab pays
 * for itself. This hook is where that is enforced:
 *
 *  • It does nothing at all until `enabled` turns true (the tab becomes active).
 *  • Once loaded it never refetches on tab switches — `loadedRef` latches, so flipping between
 *    tabs is free. `reload()` is the explicit escape hatch after a mutation or a failed load.
 *  • A failed load does NOT latch, so reopening the tab retries naturally.
 *
 * Errors are captured, never thrown, and never toasted: a section failing is a section-level
 * condition and the tab renders it in place. In particular a 403 on the Money tab is an expected
 * outcome for an agent without payment permissions, and toasting it would scold them for clicking.
 * The shared interceptor already toasts what it owns; adding a second one here would double up.
 */
export function useCustomerSection(fetcher, { enabled, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadedRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // A change in deps (i.e. a different customer) invalidates whatever was cached.
  useEffect(() => {
    loadedRef.current = false;
    setData(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const value = await fetcher();
      if (!aliveRef.current) return;
      setData(value);
      loadedRef.current = true;
    } catch (err) {
      if (!aliveRef.current) return;
      // Keep the status: the tab renders 403 as "locked" rather than as a failure.
      setError({ status: err?.response?.status, message: getErrorMessage(err, "Could not load this section.") });
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled || loadedRef.current || loading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load]);

  const reload = useCallback(() => {
    loadedRef.current = false;
    return load();
  }, [load]);

  /**
   * Merge fields into the cached record after a successful mutation elsewhere.
   *
   * This exists because the page used to do `Object.assign(section.data, patch)` — mutating a
   * state object in place. It appeared to work only because the sibling `setSummary` call forced
   * the parent to re-render; under React.memo, or StrictMode's double-invoke, the tab would have
   * kept showing the pre-change value. Patching beats a `reload()` here: a status change should
   * not cost a round trip for a field the response already handed back.
   */
  const patch = useCallback((fields) => {
    if (!fields || Object.keys(fields).length === 0) return;
    setData((current) => (current ? { ...current, ...fields } : current));
  }, []);

  return { data, loading, error, reload, patch };
}
