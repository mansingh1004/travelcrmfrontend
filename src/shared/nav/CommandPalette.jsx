// src/shared/nav/CommandPalette.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One keyboard-first search surface, used by BOTH realms (tenant app + platform
// console) with two skins. It answers the "too many menu items" problem directly:
// you never have to FIND a menu, you type where you want to go.
//
// Three groups, in the order a CRM user actually thinks:
//   1. Records   — leads / customers / bookings (async; see globalSearchService.
//                  The backend is not built yet, so this group is simply absent
//                  until it is — no error, no empty box).
//   2. Go to     — every navigation destination the user is permitted to reach.
//   3. Actions   — create a lead, create a booking, … supplied by the caller.
//
// Styling is token-agnostic: the console skin uses its semantic utilities
// (bg-surface / text-body …), the tenant skin uses the app's slate ramp. Nothing
// here reaches into either realm's modules.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Loader2, Search, X } from "lucide-react";

import { searchDestinations } from "./navModel";
import { searchRecords } from "../api/globalSearchService";

const SKIN = {
  app: {
    overlay: "bg-slate-900/50 backdrop-blur-[2px]",
    panel: "bg-white border border-slate-200 shadow-2xl shadow-slate-900/20",
    input: "text-slate-800 placeholder-slate-400",
    icon: "text-slate-400",
    groupLabel: "text-slate-400",
    row: "text-slate-600",
    rowActive: "bg-blue-50 text-blue-700",
    rowIcon: "text-slate-400",
    rowIconActive: "text-blue-600",
    meta: "text-slate-400",
    kbd: "border-slate-200 bg-slate-50 text-slate-500",
    footer: "border-slate-100 bg-slate-50/70 text-slate-400",
    divider: "border-slate-100",
    chip: "bg-slate-100 text-slate-500",
  },
  console: {
    overlay: "bg-black/55 backdrop-blur-[2px]",
    panel: "bg-surface border border-border shadow-[var(--sa-card-shadow)]",
    input: "text-heading placeholder-muted",
    icon: "text-muted",
    groupLabel: "text-muted",
    row: "text-body",
    rowActive: "bg-accent-soft text-accent-soft-text",
    rowIcon: "text-muted",
    rowIconActive: "text-accent",
    meta: "text-muted",
    kbd: "border-border bg-surface-hover text-muted",
    footer: "border-border bg-surface-hover/40 text-muted",
    divider: "border-border",
    chip: "bg-surface-hover text-muted",
  },
};

const RECORD_DEBOUNCE_MS = 220;

export default function CommandPalette({
  open,
  onClose,
  destinations = [],
  actions = [],
  recents = [],
  onNavigate,
  theme = "app",
  enableRecordSearch = false,
  placeholder = "Search or jump to…",
}) {
  const skin = SKIN[theme] || SKIN.app;
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [records, setRecords] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement;
    setQuery("");
    setCursor(0);
    setRecords(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);

    // Lock the page behind the palette so a trackpad scroll doesn't move it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      // Put focus back where the user left it — opening a palette should not
      // cost you your place in a form.
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  // ── Record search (async, debounced, superseded-safe) ──────────────────────
  useEffect(() => {
    if (!open || !enableRecordSearch) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setRecords(null);
      setRecordsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let alive = true;
    setRecordsLoading(true);

    const timer = window.setTimeout(() => {
      searchRecords(q, { signal: controller.signal })
        .then((rows) => {
          if (alive) setRecords(rows);
        })
        .catch(() => {
          if (alive) setRecords(null); // aborted or failed → group just disappears
        })
        .finally(() => {
          if (alive) setRecordsLoading(false);
        });
    }, RECORD_DEBOUNCE_MS);

    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open, enableRecordSearch]);

  // ── Result groups ──────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const q = query.trim();
    const out = [];

    if (q && Array.isArray(records) && records.length) {
      out.push({ id: "records", label: "Records", rows: records });
    }

    if (!q) {
      if (recents.length) {
        out.push({
          id: "recent",
          label: "Recent",
          rows: recents.map((d) => ({ ...d, kind: "nav" })),
        });
      }
      out.push({
        id: "nav",
        label: recents.length ? "Jump to" : "Go to",
        rows: destinations
          .filter((d) => !recents.some((r) => r.id === d.id))
          .slice(0, 8)
          .map((d) => ({ ...d, kind: "nav" })),
      });
    } else {
      const hits = searchDestinations(destinations, q, 12).map((d) => ({ ...d, kind: "nav" }));
      if (hits.length) out.push({ id: "nav", label: "Go to", rows: hits });
    }

    const matchedActions = q
      ? searchDestinations(
          actions.map((a) => ({ ...a, sectionLabel: "Actions", label: a.label })),
          q,
          6,
        )
      : actions.slice(0, 4);
    if (matchedActions.length) {
      out.push({
        id: "actions",
        label: "Actions",
        rows: matchedActions.map((a) => ({
          ...(actions.find((x) => x.id === a.id) || a),
          kind: "action",
        })),
      });
    }

    return out.filter((g) => g.rows.length);
  }, [query, records, destinations, actions, recents]);

  // Flatten for index-based keyboard traversal across group boundaries.
  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  useEffect(() => {
    setCursor(0);
  }, [query, groups.length]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-row-index="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const run = useCallback(
    (row) => {
      if (!row) return;
      onClose?.();
      if (row.kind === "action") row.run?.();
      else if (row.path) onNavigate?.(row.path);
    },
    [onClose, onNavigate],
  );

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
      return;
    }
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (rows.length ? (c + 1) % rows.length : 0));
      return;
    }
    if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (rows.length ? (c - 1 + rows.length) % rows.length : 0));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setCursor(Math.max(0, rows.length - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      run(rows[cursor]);
    }
  };

  if (!open) return null;

  let index = -1;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[12vh] sm:p-6 sm:pt-[14vh] ${skin.overlay}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and navigate"
        className={`flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl ${skin.panel}`}
        onKeyDown={onKeyDown}
      >
        {/* Query row */}
        <div className={`flex items-center gap-3 border-b px-4 py-3 ${skin.divider}`}>
          <Search size={17} className={skin.icon} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label="Search"
            autoComplete="off"
            spellCheck="false"
            className={`min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none ${skin.input}`}
          />
          {recordsLoading && <Loader2 size={15} className={`animate-spin ${skin.icon}`} />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className={`rounded-md p-1 transition-opacity hover:opacity-70 ${skin.icon}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
          {rows.length === 0 ? (
            <p className={`px-4 py-10 text-center text-sm ${skin.meta}`}>
              {query.trim() ? `Nothing matches “${query.trim()}”` : "Start typing to search"}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="pb-1">
                <p
                  className={`px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] ${skin.groupLabel}`}
                >
                  {group.label}
                </p>
                {group.rows.map((row) => {
                  index += 1;
                  const i = index;
                  const active = i === cursor;
                  const Icon = row.Icon;
                  return (
                    <button
                      key={`${group.id}-${row.id}`}
                      type="button"
                      data-row-index={i}
                      onMouseMove={() => setCursor(i)}
                      onClick={() => run(row)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        active ? skin.rowActive : skin.row
                      }`}
                    >
                      {Icon ? (
                        <Icon
                          size={16}
                          className={`shrink-0 ${active ? skin.rowIconActive : skin.rowIcon}`}
                        />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {row.label}
                        {row.sublabel ? (
                          <span className={`ml-2 text-xs font-normal ${skin.meta}`}>
                            {row.sublabel}
                          </span>
                        ) : null}
                      </span>
                      {row.kind === "record" && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${skin.chip}`}
                        >
                          {row.typeLabel}
                        </span>
                      )}
                      {row.kind === "nav" && row.parentLabel && (
                        <span className={`hidden shrink-0 text-xs sm:block ${skin.meta}`}>
                          {row.parentLabel}
                        </span>
                      )}
                      {active && <CornerDownLeft size={13} className="shrink-0 opacity-60" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Hint bar */}
        <div
          className={`flex items-center justify-between gap-3 border-t px-4 py-2 text-[11px] ${skin.footer}`}
        >
          <span className="flex items-center gap-1.5">
            <kbd className={`rounded border px-1 py-0.5 font-sans ${skin.kbd}`}>↑</kbd>
            <kbd className={`rounded border px-1 py-0.5 font-sans ${skin.kbd}`}>↓</kbd>
            to move
            <kbd className={`ml-2 rounded border px-1 py-0.5 font-sans ${skin.kbd}`}>enter</kbd>
            to open
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <kbd className={`rounded border px-1 py-0.5 font-sans ${skin.kbd}`}>esc</kbd>
            to close
            <ArrowRight size={11} className="ml-1 opacity-50" />
          </span>
        </div>
      </div>
    </div>
  );
}
