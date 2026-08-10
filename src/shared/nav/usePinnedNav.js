// src/shared/nav/usePinnedNav.js
// ─────────────────────────────────────────────────────────────────────────────
// Pins ("keep this where I can reach it") and recents ("where I actually was")
// for a nav registry. Both are stored per REALM by a namespace string, so the
// tenant app and the platform console can never read each other's list.
//
// Storage holds destination IDS, not paths: a route can be renamed without
// silently emptying every user's pinned rail.
//
// A tiny event bus keeps every mount in sync — the sidebar and the app launcher
// both render pin state, and a star clicked in one has to light up in the other
// without a reload. `storage` alone would not do it: the browser fires that event
// in OTHER tabs only.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";

const CHANGED = "nav-store-changed";
const MAX_PINS = 8;
const MAX_RECENTS = 5;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : fallback;
  } catch {
    return fallback; // malformed cache is not worth a crash in the app shell
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — pins are a convenience, never a hard failure */
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: { key } }));
}

/** Subscribe to same-tab writes AND other-tab `storage` events for one key. */
function useStoredList(key, initial = []) {
  const [list, setList] = useState(() => read(key, initial));

  useEffect(() => {
    const sync = (e) => {
      if (e?.detail?.key && e.detail.key !== key) return;
      if (e?.key && e.key !== key) return; // native `storage` event
      setList(read(key, initial));
    };
    setList(read(key, initial));
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
    // `initial` is a literal at every call site; re-subscribing on identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [list, useCallback((next) => write(key, next), [key])];
}

/**
 * Pinned destination ids, newest last, capped at MAX_PINS.
 * `defaults` seeds a brand-new user so the rail is never empty on first login.
 */
export function usePins(namespace, defaults = []) {
  const key = `nav:${namespace}:pins`;
  const [pins, setPins] = useStoredList(key, defaults);

  const isPinned = useCallback((id) => pins.includes(id), [pins]);

  const toggle = useCallback(
    (id) => {
      const next = pins.includes(id)
        ? pins.filter((p) => p !== id)
        : [...pins, id].slice(-MAX_PINS);
      setPins(next);
      return !pins.includes(id);
    },
    [pins, setPins],
  );

  const reset = useCallback(() => setPins(defaults), [setPins, defaults]);

  return { pins, isPinned, toggle, reset, max: MAX_PINS };
}

/**
 * The last MAX_RECENTS destinations visited, most recent first. Records whenever
 * `activeId` changes, which is exactly one write per navigation.
 */
export function useRecents(namespace, activeId) {
  const key = `nav:${namespace}:recents`;
  const [recents, setRecents] = useStoredList(key, []);

  useEffect(() => {
    if (!activeId) return;
    const current = read(key, []);
    if (current[0] === activeId) return; // same page re-rendered — not a new visit
    write(key, [activeId, ...current.filter((r) => r !== activeId)].slice(0, MAX_RECENTS));
  }, [activeId, key]);

  return { recents, clear: useCallback(() => setRecents([]), [setRecents]) };
}

/**
 * Which sidebar sections are collapsed. Stored as the COLLAPSED set, not the open
 * one: a section added to the registry later then defaults to open instead of
 * being invisible to everyone who has ever saved a preference.
 */
export function useCollapsedSections(namespace) {
  const key = `nav:${namespace}:collapsed`;
  const [collapsed, setCollapsed] = useStoredList(key, []);

  const isCollapsed = useCallback((id) => collapsed.includes(id), [collapsed]);
  const toggle = useCallback(
    (id) =>
      setCollapsed(
        collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id],
      ),
    [collapsed, setCollapsed],
  );

  return { collapsed, isCollapsed, toggle };
}

/**
 * Remembered desktop rail state: `true` = icon rail (which expands on hover),
 * `false` = pinned open.
 *
 * `defaultCollapsed` applies only when the user has never chosen — an explicit "0"
 * must keep the rail pinned open, so the check is against the stored string rather
 * than its truthiness.
 */
export function useRailCollapsed(namespace, defaultCollapsed = false) {
  const key = `nav:${namespace}:rail`;
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? defaultCollapsed : stored === "1";
    } catch {
      return defaultCollapsed;
    }
  });
  const set = useCallback(
    (next) => {
      setValue(next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set];
}

/** Convenience: resolve a list of ids back to destination objects, dropping stale ones. */
export function useResolvedIds(ids, destinations) {
  return useMemo(() => {
    const byId = new Map(destinations.map((d) => [d.id, d]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [ids, destinations]);
}
