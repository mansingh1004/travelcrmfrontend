// features/operations/pages/Operations.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Operations Board: for a chosen day or range, every party travelling and how ready
// each one is.
//
// This is deliberately not the bookings list with a date filter. That list is record-centric
// — show me BK-0042. This asks the other question: of the parties travelling, which are not
// ready, and what is missing. It is a morning tool, so it is built to be READ fast and driven
// from the keyboard: j/k to move, Enter to open, / to search, Esc to close.
//
// Everything narrows in SQL. The tab, the window, the search and the page are all query
// parameters, and the summary cards and tab badges come from the SAME predicates the list
// uses — so a card can never disagree with the rows underneath it. Anything that could not be
// expressed in the query is not offered as a filter, because a control that quietly returns
// nine rows under a badge claiming forty is worse than no control.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCoreRowModel, getExpandedRowModel, useReactTable, flexRender,
} from "@tanstack/react-table";
import {
  Radar, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronDown,
  Briefcase, CircleCheck, TriangleAlert, CircleAlert, WalletCards, CalendarRange,
} from "lucide-react";

import { usePagedList } from "@shared/api/usePagedList";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";
// Cross-feature, through the barrel only: the ops board shares the notification SSE stream
// rather than opening a second EventSource per tab.
import { notificationService } from "@features/reminders";

import {
  Page, Panel, GridEmpty, Pager, SummaryCard, DimensionCell, OverallBadge,
  DaysBadge, SeverityBadge, DepartureCountdown, COLUMN_DIMENSIONS,
} from "../components/opsUi";
import OpsRowDetail from "../components/OpsRowDetail";
import operationsService, { isoDate, addDays } from "../api/operationsService";

/* ═══════════════════════════════════════════════════════════════════════════
   The window
   ─────────────────────────────────────────────────────────────────────────
   A day, a week, or an explicit range. The chevrons step by whatever the mode
   spans, so ‹ on a week goes back a week rather than a day — stepping by one
   day through a week view is how you lose your place.
   ═══════════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86400000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const fmtLong = (d) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
const weekday = (d) => d.toLocaleDateString("en-IN", { weekday: "short" });

const money = (n) =>
  n == null ? "—" : `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}% of total` : "—");

const nightsBetween = (start, end) => {
  if (!start || !end) return null;
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / DAY_MS);
};

export default function Operations() {
  const allowed = hasPermission(P.BOOKING_READ);
  const navigate = useNavigate();

  const [mode, setMode] = useState("day");          // day | week | custom
  const [anchor, setAnchor] = useState(startOfToday);
  const [custom, setCustom] = useState({ from: isoDate(startOfToday()), to: isoDate(addDays(startOfToday(), 14)) });

  const [tab, setTab] = useState("ALL");            // ALL | ACTION_NEEDED
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  // Counts for the tabs no card carries. The endpoint has always returned all seven; the screen
  // only ever reached five of them, so two states the server can select were unreachable.
  const [tabCounts, setTabCounts] = useState({});

  const [expandedId, setExpandedId] = useState(null);
  const [cursor, setCursor] = useState(-1);

  const searchRef = useRef(null);
  const bodyRef = useRef(null);
  const scrollRef = useRef(null);
  // Visible width of the table's horizontal scroller. The expanded row is a <td> inside a
  // min-w-[1180px] table, so without this its content is 1180px wide too and has to be
  // scrolled sideways to be read on any screen narrower than the table. Pinning it to the
  // scroller's own width is what keeps the detail readable where the board is not.
  const [viewportWidth, setViewportWidth] = useState(0);
  // Set while the expanded row has an inline editor open. The row owns Escape then — both
  // listeners sit on window, so stopPropagation cannot arbitrate between them and this
  // handler has to be the one that stands down.
  const editingRef = useRef(false);
  // A write happened under the open row. The board is refreshed when the row closes rather
  // than on every change: reloading mid-edit flips usePagedList's `loading`, which unmounts
  // every row — including the one being worked in — and replaces it with skeletons.
  const staleRef = useRef(false);

  /* ── Window ─────────────────────────────────────────────────────────────── */
  const { from, to, label } = useMemo(() => {
    if (mode === "custom") {
      return {
        from: custom.from,
        to: custom.to,
        label: `${fmtShort(custom.from)} – ${fmtShort(custom.to)}`,
      };
    }
    if (mode === "week") {
      const end = addDays(anchor, 6);
      return { from: isoDate(anchor), to: isoDate(end), label: `${fmtShort(isoDate(anchor))} – ${fmtLong(end)}` };
    }
    return { from: isoDate(anchor), to: isoDate(anchor), label: `${fmtLong(anchor)} (${weekday(anchor)})` };
  }, [mode, anchor, custom]);

  const step = useCallback((direction) => {
    if (mode === "custom") return;
    setAnchor((a) => addDays(a, direction * (mode === "week" ? 7 : 1)));
  }, [mode]);

  /* ── Search, debounced ──────────────────────────────────────────────────
     300ms: long enough that a booking ref is not four requests, short enough
     that it still feels like typing into the list. */
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  /* ── Rows ───────────────────────────────────────────────────────────────── */
  const fetcher = useCallback((params) => operationsService.board(params), []);

  const {
    rows, meta, loading, error, page, setPage, pageSize, setPageSize, total, totalPages, reload,
  } = usePagedList(fetcher, {
    size: 10,
    filters: useMemo(
      () => ({ tab, from, to, search: search || undefined }),
      [tab, from, to, search],
    ),
  });

  /* ── Summary cards ───────────────────────────────────────────────────────
     Over the whole window, never the page. Follows the search so the cards
     describe what is on screen, but NOT the tab — the cards are what the tabs
     are read against, and "Action needed: 2" on the Action-needed tab would be
     a tautology rather than information. */
  const loadSummary = useCallback(async () => {
    if (!allowed) return;
    setSummaryLoading(true);
    try {
      const params = { from, to, search: search || undefined };
      // Both describe the same window; fetching them together keeps the cards and the tab
      // chips from ever showing counts taken a moment apart.
      const [figures, counts] = await Promise.all([
        operationsService.summary(params),
        operationsService.tabCounts(params).catch(() => ({})),
      ]);
      setSummary(figures);
      setTabCounts(counts ?? {});
    } catch (err) {
      // A failed card degrades silently: the interceptor already surfaced anything actionable,
      // and broken figures are not worth a toast on top of a working list.
      if (!isAlreadyReported(err)) console.warn("Operations summary failed", err);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [allowed, from, to, search]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    if (error && !isAlreadyReported(error)) {
      toast.error(getErrorMessage(error, "Could not load the operations board"));
    }
  }, [error]);

  // Collapse and reset the cursor whenever the underlying set changes. Leaving a row expanded
  // across a filter change points the panel at a booking that is no longer in the list.
  useEffect(() => {
    setExpandedId(null);
    setCursor(-1);
    // The list is being refetched anyway by the filter change itself.
    staleRef.current = false;
  }, [tab, from, to, search, page]);

  const refreshAll = useCallback(() => {
    staleRef.current = false;
    reload();
    loadSummary();
  }, [reload, loadSummary]);

  /**
   * A line changed inside the open row.
   *
   * The cards are reloaded straight away — they are counted over the whole window and are
   * what the tabs are read against, so leaving them wrong is worse than a moment's flicker
   * on five numbers. The ROWS are only marked stale: the row being edited is the one the
   * reload would unmount, and a booking that has just become ready should leave the
   * Action-needed tab when the user closes it, not while they are still working in it.
   */
  const markStale = useCallback(() => {
    staleRef.current = true;
    loadSummary();
  }, [loadSummary]);

  /* ── Somebody else moved a checkpoint ────────────────────────────────────
     The board is a shared queue: two people working the same morning is the normal
     case, not the edge one, and the cost of a stale row here is a supplier phoned
     twice.

     The push is a PING — booking id and a row version, no row data — because the SSE
     stream is tenant-wide and filters neither permissions nor sub-agent row scope. So
     this refetches rather than patching state from the payload.

     Only the CARDS reload immediately; the rows are marked stale exactly as a local
     edit does. Reloading the list under somebody mid-edit is the one thing worse than
     showing them a row a few seconds old. */
  useEffect(() => {
    if (!allowed) return undefined;
    const sub = notificationService.subscribeToSSE({
      opsCheckpoint: () => markStale(),
      opsRecord: () => markStale(),
    });
    return () => sub?.close?.();
  }, [allowed, markStale]);

  /* ── Table ──────────────────────────────────────────────────────────────
     TanStack drives the row model and expansion only; the markup below renders
     it, which is the same headless split the leads grid uses. */
  const columns = useMemo(() => [
    {
      id: "booking",
      header: "Booking Ref / Customer",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-bold text-blue-600 truncate">{row.original.bookingCode}</p>
          <p className="text-[11px] text-slate-500 truncate">{row.original.customerName || "—"}</p>
        </div>
      ),
    },
    {
      id: "destination",
      header: "Destination",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 truncate">{row.original.destination || "—"}</span>
      ),
    },
    {
      id: "pax",
      header: "Pax",
      cell: ({ row }) => (
        <span className="text-sm font-bold text-slate-700 tabular-nums">{row.original.pax ?? "—"}</span>
      ),
    },
    {
      id: "travel",
      header: "Travel Date",
      cell: ({ row }) => {
        const n = nightsBetween(row.original.travelDate, row.original.tripEndDate);
        return (
          <div className="min-w-0">
            <p className="text-sm text-slate-700 whitespace-nowrap">
              {fmtShort(row.original.travelDate)} – {fmtShort(row.original.tripEndDate)}
            </p>
            <p className="text-[10px] font-bold text-slate-400">
              {n == null ? "End date not set" : `${n} night${n === 1 ? "" : "s"}`}
            </p>
          </div>
        );
      },
    },
    ...COLUMN_DIMENSIONS.map((dim) => ({
      id: dim.key,
      header: dim.label,
      cell: ({ row }) => (
        <DimensionCell
          status={row.original.readiness?.[dim.key]}
          count={row.original.dimensionCounts?.[dim.key]}
        />
      ),
    })),
    {
      id: "balance",
      header: "Balance (₹)",
      cell: ({ row }) => {
        const due = Number(row.original.balanceDue ?? 0);
        return (
          <span className={`text-sm font-bold tabular-nums ${due > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {money(row.original.balanceDue)}
          </span>
        );
      },
    },
    {
      id: "overall",
      header: "Overall Status",
      /*
       * Two models, one column, and the checkpoint one wins where it exists.
       *
       * `ops` is null on every booking confirmed before the checkpoint model shipped, and
       * will stay null on those until the backfill runs — so this cannot simply be swapped
       * over. Where a record exists its severity is what somebody actually recorded, in
       * hours rather than days; where it does not, the derived verdict is still the only
       * answer there is and the row must not go blank.
       */
      cell: ({ row }) => {
        const ops = row.original.ops;
        return (
          <div className="flex flex-col items-center gap-1">
            {ops ? <SeverityBadge severity={ops.severity} />
                 : <OverallBadge status={row.original.overallStatus} />}
            {ops?.hoursToDeparture != null
              ? <DepartureCountdown
                  hours={ops.hoursToDeparture}
                  sourceLabel={ops.departureAtSourceLabel}
                />
              : <DaysBadge days={row.original.daysToDeparture} />}
          </div>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.bookingPublicId,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
  });

  const tableRows = table.getRowModel().rows;

  /**
   * Open a row, or close it and settle up.
   *
   * Closing is where a deferred board refresh lands: the user has finished with that
   * booking, so this is the one moment the list may safely re-sort or drop it from the tab.
   */
  const toggleRow = useCallback((id) => {
    if (expandedId === id) {
      setExpandedId(null);
      editingRef.current = false;
      if (staleRef.current) refreshAll();
    } else {
      setExpandedId(id);
    }
  }, [expandedId, refreshAll]);

  /* ── Keyboard ────────────────────────────────────────────────────────────
     j/k and the arrows move a cursor, Enter opens it, Esc closes. Ignored while
     a field has focus, or "j" would be unusable in the search box. */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "Escape") {
        // The expanded row owns Escape while it has an editor open, so a half-typed
        // confirmation number is not thrown away by collapsing the row underneath it.
        if (editingRef.current) return;
        if (typing) { document.activeElement.blur(); return; }
        if (expandedId) { toggleRow(expandedId); return; }
        return;
      }
      if (typing || !tableRows.length) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(tableRows.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter" && cursor >= 0) {
        e.preventDefault();
        toggleRow(tableRows[cursor].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tableRows, cursor, expandedId, toggleRow]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the cursor row in view when it moves off-screen under the sticky header.
  useEffect(() => {
    if (cursor < 0) return;
    bodyRef.current
      ?.querySelector(`[data-row-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const rowsPerPage = meta?.size ?? pageSize ?? 10;
  const fromRow = total === 0 ? 0 : page * rowsPerPage + 1;
  const toRow = Math.min((page + 1) * rowsPerPage, total);

  if (!allowed) {
    return (
      <Page icon={Radar} title="Operations Board" crumb="Operations">
        <Panel>
          <GridEmpty
            icon={Radar}
            title="You don't have access to Operations"
            hint="Ask your administrator for the Bookings permission."
          />
        </Panel>
      </Page>
    );
  }

  const presetBtn = (active) =>
    `px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
      active
        ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
        : "text-slate-500 hover:text-blue-600"
    }`;

  return (
    <Page
      icon={Radar}
      title="Operations Board"
      crumb="Real-time readiness of hotel, vehicle and sightseeing — and the balance still owing"
      actions={
        <button
          onClick={refreshAll}
          title="Refresh"
          aria-label="Refresh the operations board"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="flex flex-col gap-4">

        {/* ── Window controls ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-white">
            <button className={presetBtn(mode === "day" && isoDate(anchor) === isoDate(startOfToday()))}
                    onClick={() => { setMode("day"); setAnchor(startOfToday()); }}>Today</button>
            <button className={presetBtn(mode === "day" && isoDate(anchor) === isoDate(addDays(startOfToday(), 1)))}
                    onClick={() => { setMode("day"); setAnchor(addDays(startOfToday(), 1)); }}>Tomorrow</button>
            <button className={presetBtn(mode === "week")}
                    onClick={() => { setMode("week"); setAnchor(startOfToday()); }}>This Week</button>
            <button className={presetBtn(mode === "custom")}
                    onClick={() => setMode("custom")}>
              <span className="inline-flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" />Custom Range</span>
            </button>
          </div>

          {mode === "custom" ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white">
              <input type="date" value={custom.from} max={custom.to}
                     onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                     aria-label="Range start"
                     className="text-xs font-bold text-slate-600 outline-none" />
              <span className="text-slate-300">→</span>
              <input type="date" value={custom.to} min={custom.from}
                     onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                     aria-label="Range end"
                     className="text-xs font-bold text-slate-600 outline-none" />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => step(-1)} aria-label="Previous"
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-300">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-2 text-sm font-extrabold text-slate-700 whitespace-nowrap tabular-nums">
                {label}
              </span>
              <button onClick={() => step(1)} aria-label="Next"
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-300">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchRef}
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
            placeholder="Search by customer name or booking ref…    /"
            aria-label="Search by customer name or booking reference"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none"
          />
        </div>

        {/* ── The five figures, and the filter ──────────────────────────────
            Each card IS its tab. Ready, Action needed and Urgent partition the window
            exactly — they add up to Total — and each one narrows the list with the very
            predicate it was counted with, so clicking a card showing 2 can only ever open
            2 rows. That is why "Action needed" excludes the urgent ones server-side rather
            than containing them. */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard icon={Briefcase} tone="blue" label="Total Bookings"
                       value={summary?.totalBookings ?? 0} hint={label} loading={summaryLoading}
                       active={tab === "ALL"} onClick={() => setTab("ALL")} />
          <SummaryCard icon={CircleCheck} tone="green" label="Ready to Go"
                       value={summary?.ready ?? 0}
                       hint={pct(summary?.ready ?? 0, summary?.totalBookings ?? 0)} loading={summaryLoading}
                       active={tab === "READY"} onClick={() => setTab(tab === "READY" ? "ALL" : "READY")} />
          <SummaryCard icon={TriangleAlert} tone="amber" label="Action Needed"
                       value={summary?.actionNeeded ?? 0}
                       hint={pct(summary?.actionNeeded ?? 0, summary?.totalBookings ?? 0)} loading={summaryLoading}
                       active={tab === "ACTION_NEEDED"} onClick={() => setTab(tab === "ACTION_NEEDED" ? "ALL" : "ACTION_NEEDED")} />
          <SummaryCard icon={CircleAlert} tone="red" label="Urgent"
                       value={summary?.urgent ?? 0} hint="Travelling today / tomorrow" loading={summaryLoading}
                       active={tab === "URGENT"} onClick={() => setTab(tab === "URGENT" ? "ALL" : "URGENT")} />
          <SummaryCard icon={WalletCards} tone="indigo" label="Total Balance Pending"
                       value={money(summary?.balancePending)} hint="Across all bookings" loading={summaryLoading}
                       active={tab === "PAYMENT_PENDING"} onClick={() => setTab(tab === "PAYMENT_PENDING" ? "ALL" : "PAYMENT_PENDING")} />
        </div>

        {/* ── The two states no card carries ────────────────────────────────
            NOT_PLANNED and UNCONFIRMED are selectable server-side and were counted on every
            request, but nothing on screen could reach them. They are narrower questions than
            the five figures above — "which bookings has nobody broken down yet" is where a
            morning starts — so they read as filters rather than headline numbers. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Quick filters</span>
          {[
            { key: "NOT_PLANNED", label: "Not planned yet" },
            { key: "UNCONFIRMED", label: "Has unconfirmed lines" },
            // The two chase queues. "Unconfirmed" mixes work nobody has started with work sitting
            // in a supplier's inbox, and those want opposite actions — one wants an email sent,
            // the other wants patience or a nudge. These split them.
            { key: "AWAITING_SUPPLIER", label: "Waiting on supplier" },
            // The only filter that catches a failure nobody sees coming: a hotel releases held
            // rooms at its cut-off and tells no one, so the booking looks unchanged until
            // check-in. Red rather than blue because it is a deadline, not a view.
            { key: "HOLD_EXPIRING", label: "Hold expiring", urgent: true },
          ].map(({ key, label, urgent }) => {
            const count = tabCounts?.[key];
            const on = tab === key;
            // A zero here is information, not clutter — "nothing is about to lapse" is the
            // answer an operator opens this row to get. But an urgent chip that is always
            // visible stops being urgent, so it only colours itself when it has rows.
            const hot = urgent && count > 0;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(on ? "ALL" : key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  on
                    ? hot
                      ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                      : "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : hot
                      ? "bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-300"
                      : "bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300"
                }`}
              >
                {label}
                {count != null && (
                  <span className={`tabular-nums ${
                    on ? (hot ? "text-rose-100" : "text-blue-100")
                       : hot ? "text-rose-500" : "text-slate-400"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── The board ────────────────────────────────────────────────────── */}
        <Panel className="overflow-hidden">
          <div ref={scrollRef} className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr>
                  {table.getHeaderGroups()[0].headers.map((header, i) => (
                    <th key={header.id}
                        className={`px-4 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wide border-b border-slate-200 whitespace-nowrap ${
                          i === 0 ? "text-left" : "text-center"
                        }`}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                  <th className="w-10 border-b border-slate-200" />
                </tr>
              </thead>

              <tbody ref={bodyRef}>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-slate-50">
                    {columns.map((c) => (
                      <td key={c.id} className="px-4 py-4">
                        <div className="h-4 rounded bg-slate-100 animate-pulse" />
                      </td>
                    ))}
                    <td />
                  </tr>
                ))}

                {!loading && tableRows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1}>
                      <GridEmpty
                        icon={Radar}
                        title={
                          search ? "No booking matches that search"
                            : tab === "ACTION_NEEDED" ? "Nothing needs attention here"
                            : "Nothing travelling in this window"
                        }
                        hint={
                          search ? "Try the booking reference, or part of the customer's name."
                            : tab === "ACTION_NEEDED" ? "That is the point of this view being empty — everything is arranged and paid."
                            : "Move the date, widen the range, or check back when the next departures are booked."
                        }
                      />
                    </td>
                  </tr>
                )}

                {!loading && tableRows.map((row, index) => {
                  const expanded = expandedId === row.id;
                  const onCursor = cursor === index;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        data-row-index={index}
                        onClick={() => { setCursor(index); toggleRow(row.id); }}
                        aria-expanded={expanded}
                        className={`border-b border-slate-50 cursor-pointer transition-colors ${
                          expanded ? "bg-blue-50/60"
                            : onCursor ? "bg-slate-50 ring-1 ring-inset ring-blue-200"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        {row.getVisibleCells().map((cell, i) => (
                          <td key={cell.id}
                              className={`px-4 py-3 align-middle ${i === 0 ? "text-left" : "text-center"}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                        <td className="px-2 text-slate-300">
                          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180 text-blue-500" : ""}`} />
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td colSpan={columns.length + 1} className="p-0">
                            <OpsRowDetail
                              entry={row.original}
                              width={viewportWidth}
                              onClose={() => toggleRow(row.id)}
                              onChanged={markStale}
                              onEditingChange={(editing) => { editingRef.current = editing; }}
                              onOpenLedger={(e) => navigate(`/BookingPayments/${e.bookingPublicId}`)}
                              onOpenBooking={(e) => navigate(`/BookingDetails/${e.bookingPublicId}`)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400">
              {total === 0 ? "No bookings" : <>Showing <span className="text-slate-600">{fromRow} to {toRow}</span> of <span className="text-slate-600">{total}</span> bookings</>}
            </p>
            <div className="flex items-center gap-3">
              <Pager page={page} totalPages={totalPages} total={total} from={fromRow} to={toRow} onPage={setPage} />
              <select
                value={rowsPerPage}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                aria-label="Rows per page"
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none"
              >
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
          </div>
        </Panel>

        <p className="text-[11px] font-bold text-slate-400 text-center">
          <kbd className="px-1 rounded bg-slate-100">j</kbd> / <kbd className="px-1 rounded bg-slate-100">k</kbd> move ·
          <kbd className="px-1 rounded bg-slate-100 ml-1">Enter</kbd> open ·
          <kbd className="px-1 rounded bg-slate-100 ml-1">/</kbd> search ·
          <kbd className="px-1 rounded bg-slate-100 ml-1">Esc</kbd> close
        </p>

      </div>
    </Page>
  );
}
