// features/operations/pages/Operations.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ONE page that manages the whole booking operation.
//
// This is deliberately not the bookings list with a date filter. That list is
// record-centric — show me BK-0042. This asks the other question: of the parties
// travelling soon, which ones are not ready, and what is missing. Rows are readiness
// signals; the money lives on the booking screen where it belongs.
//
// Everything happens here. Clicking a row opens a panel beside the list rather than
// navigating, because operations scans and acts in the same breath — a page change per
// booking is twenty page changes a morning.
//
// Server-side everything: the tab, the window and the page are all query parameters,
// and the badges come from the SAME predicates the lists use, so a badge can never
// disagree with the list it opens.
//
// There is no search box on purpose: the board endpoint has no text search, and a box
// that quietly does nothing is worse than no box.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Radar, RefreshCw, Layers, PackageSearch, Wallet, PlaneTakeoff, CalendarRange,
  Rows3, CalendarDays,
} from "lucide-react";

import { usePagedList } from "@shared/api/usePagedList";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";

import {
  Page, Panel, GridHead, GridRow, Cell, GridSkeleton, GridEmpty, Pager,
  Badge, ReadinessDots, DaysBadge, SpanBar,
} from "../components/opsUi";
import OpsDetailPanel from "../components/OpsDetailPanel";
import OpsCalendar from "../components/OpsCalendar";
import OpsDaySummary from "../components/OpsDaySummary";
import operationsService, { isoDate, addDays } from "../api/operationsService";

const COLS = "132px 1.5fr 1fr 1.3fr 176px 104px";

const TABS = [
  { key: "ALL",             label: "All",          icon: Layers },
  { key: "UNCONFIRMED",     label: "Unconfirmed",  icon: PackageSearch, danger: true },
  // "Balance pending", not "Payment due" — there is no customer payment schedule anywhere in
  // this product, so nothing here is DUE on a date. It means money still owing.
  { key: "PAYMENT_PENDING", label: "Balance pending", icon: Wallet },
  { key: "DEPARTING_TODAY", label: "Departing today", icon: PlaneTakeoff },
];

/** Horizons the board opens on. Operations looks forward, so there is no "last 30 days". */
const RANGES = [
  { key: "7",  label: "7 days",  days: 7 },
  { key: "14", label: "14 days", days: 14 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
];

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

const nightsBetween = (start, end) => {
  if (!start || !end) return null;
  const dayMs = 86400000;
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / dayMs);
};

export default function Operations() {
  const allowed = hasPermission(P.BOOKING_READ);

  const [tab, setTab] = useState("ALL");
  const [view, setView] = useState("board");
  const [rangeKey, setRangeKey] = useState("14");
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [days, setDays] = useState([]);
  const [daysLoading, setDaysLoading] = useState(true);

  // The window the board looks at. Recomputed only when the preset changes, so the
  // filters object stays stable and does not re-fire the load effect every render.
  const { from, to } = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 14;
    const today = new Date();
    return { from: isoDate(today), to: isoDate(addDays(today, days)) };
  }, [rangeKey]);

  // usePagedList reads res.data.data + res.data.pagination, so the fetcher hands back the
  // raw axios response.
  const fetcher = useCallback((params) => operationsService.board(params), []);

  const {
    rows, meta, loading, error, page, setPage, pageSize, setPageSize, total, totalPages, reload,
  } = usePagedList(fetcher, {
    size: 25,
    filters: useMemo(() => ({ tab, from, to }), [tab, from, to]),
  });

  // A month grid cannot be paged — a trip missing from the calendar reads as a trip that
  // does not exist, which is worse than a list that says "page 2 of 3". So the calendar
  // asks for the server's maximum page instead, and says so plainly when the window holds
  // more than that.
  useEffect(() => {
    setPageSize(view === "calendar" ? 100 : 25);
  }, [view, setPageSize]);

  const calendarTruncated = view === "calendar" && total > rows.length;

  const loadCounts = useCallback(async () => {
    if (!allowed) return;
    setCountsLoading(true);
    try {
      setCounts(await operationsService.tabCounts({ from, to }));
    } catch (err) {
      // A failed badge degrades silently. The interceptor already surfaced anything the
      // user can act on, and a broken count is not worth a toast over a working list.
      if (!isAlreadyReported(err)) console.warn("Operations tab counts failed", err);
      setCounts({});
    } finally {
      setCountsLoading(false);
    }
  }, [allowed, from, to]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const loadDays = useCallback(async () => {
    if (!allowed) return;
    setDaysLoading(true);
    try {
      setDays(await operationsService.daySummary({ from, to }));
    } catch (err) {
      // Same rule as the badges: the summary is a convenience over a working board, so a
      // failure here degrades to no strip rather than a toast on top of the interceptor's.
      if (!isAlreadyReported(err)) console.warn("Operations day summary failed", err);
      setDays([]);
    } finally {
      setDaysLoading(false);
    }
  }, [allowed, from, to]);

  useEffect(() => { loadDays(); }, [loadDays]);

  /**
   * Open a booking from a day card.
   *
   * The card lists every booking that day, but the board is paged and tab-filtered, so the
   * one clicked may not be among the loaded rows. When it is, the full entry opens with its
   * readiness. When it is not, the panel still opens with what the card knows and simply
   * omits the readiness block rather than showing a grid of grey dots that would read as
   * "nothing is ready".
   */
  const openFromSummary = useCallback((bookingPublicId) => {
    const loaded = rows.find((r) => r.bookingPublicId === bookingPublicId);
    if (loaded) { setSelected(loaded); return; }

    for (const day of days) {
      const ref = (day.bookings ?? []).find((b) => b.bookingPublicId === bookingPublicId);
      if (ref) {
        setSelected({
          bookingPublicId: ref.bookingPublicId,
          bookingCode: ref.bookingCode,
          customerName: ref.customerName,
          travelDate: day.date,
          readiness: null,
        });
        return;
      }
    }
  }, [rows, days]);

  useEffect(() => {
    if (error && !isAlreadyReported(error)) {
      toast.error(getErrorMessage(error, "Could not load the operations board"));
    }
  }, [error]);

  // Keep the open drawer on the refreshed row.
  //
  // Confirming a supplier inside the drawer refreshes the board, but `selected` still held the
  // object captured at click time — so the service line moved to Confirmed while the readiness
  // chips above it went on showing the state before the change. Re-pointing at the row that
  // just came back is what makes the panel agree with itself.
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find((r) => r.bookingPublicId === selected.bookingPublicId);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [rows, selected]);

  const refreshAll = useCallback(() => { reload(); loadCounts(); loadDays(); }, [reload, loadCounts, loadDays]);

  const rowsPerPage = meta?.size ?? pageSize ?? 25;
  const fromRow = total === 0 ? 0 : page * rowsPerPage + 1;
  const toRow = Math.min((page + 1) * rowsPerPage, total);

  if (!allowed) {
    return (
      <Page icon={Radar} title="Operations" crumb="Operations">
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

  return (
    <Page
      icon={Radar}
      title="Operations"
      crumb="Operations · what still needs doing"
      actions={
        <div className="flex items-center gap-2">
          {/* Board and calendar are two renderings of ONE query, not two screens.
              Switching keeps the tab, the window and the selected booking. */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-white">
            {[
              { key: "board", label: "Board", Icon: Rows3 },
              { key: "calendar", label: "Calendar", Icon: CalendarDays },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  view === key
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-blue-600"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-white">
            <CalendarRange className="w-4 h-4 text-slate-400 ml-1.5 mr-0.5" />
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                aria-pressed={rangeKey === r.key}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rangeKey === r.key
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-blue-600"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={refreshAll}
            title="Refresh"
            aria-label="Refresh the operations board"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ── Day rollup ──────────────────────────────────────────────────────
            Above everything, because it answers the question that comes before
            "which booking": what does this day actually take. */}
        <OpsDaySummary days={days} loading={daysLoading} onSelectBooking={openFromSummary} />

        {/* ── Exception filters ───────────────────────────────────────────────
            Horizontal, above the board rather than a rail beside it. A 200px rail
            costs the widest column on the screen — the readiness dots — exactly the
            space it needs, and these are four tabs, not a navigation tree. */}
        <nav className="w-full" aria-label="Operations filters">
          <Panel className="overflow-hidden">
            <ul className="flex overflow-x-auto">
              {TABS.map(({ key, label, icon: Icon, danger }) => {
                const active = tab === key;
                const count = counts?.[key];
                const alarming = danger && count > 0;
                return (
                  <li key={key} className="flex-1 min-w-[150px]">
                    <button
                      onClick={() => { setTab(key); setSelected(null); }}
                      aria-pressed={active}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold transition-all border-r border-slate-100 last:border-r-0 whitespace-nowrap ${
                        active
                          ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon size={15} className={active ? "text-white" : alarming ? "text-rose-500" : "text-slate-400"} />
                        <span className="truncate">{label}</span>
                      </span>
                      <span
                        className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums min-w-[22px] text-center ${
                          active
                            ? "bg-white/25 text-white"
                            : alarming
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {countsLoading && count == null ? "·" : (count ?? 0)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </nav>

        {/* ── Board ──────────────────────────────────────────────────────────── */}
        {view === "board" && (
        <Panel className="flex-1 overflow-hidden min-w-0">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-400">
              {loading
                ? "Loading…"
                : total === 0
                  ? "Nothing departing in this window"
                  : <>Showing <span className="text-slate-600">{fromRow} – {toRow}</span> of <span className="text-slate-600">{total}</span> departures</>}
            </p>
            <p className="text-[11px] font-bold text-slate-300 hidden sm:block">
              {fmtDate(from)} – {fmtDate(to)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              <GridHead cols={COLS}>
                <div>Departure</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Booking</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Destination</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Trip</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Readiness</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Suppliers</div>
              </GridHead>

              {loading && <GridSkeleton cols={COLS} rows={6} />}

              {!loading && rows.length === 0 && (
                <GridEmpty
                  icon={Radar}
                  title={tab === "ALL" ? "Nothing departing in this window" : "Nothing outstanding here"}
                  hint={tab === "ALL"
                    ? "Widen the window, or check back when the next departures are booked."
                    : "That is the point of this tab being empty — nothing needs chasing."}
                />
              )}

              {!loading && rows.map((r, i) => {
                const nights = nightsBetween(r.travelDate, r.tripEndDate);
                const isSelected = selected?.bookingPublicId === r.bookingPublicId;
                return (
                  <GridRow
                    key={r.bookingPublicId}
                    cols={COLS}
                    index={i}
                    active={isSelected}
                    onClick={() => setSelected(isSelected ? null : r)}
                  >
                    <Cell first>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700">{fmtDate(r.travelDate)}</p>
                        <DaysBadge days={r.daysToDeparture} />
                      </div>
                    </Cell>

                    <Cell className="!justify-start !text-left">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-blue-600 truncate">{r.bookingCode}</p>
                        <p className="text-[11px] text-slate-500 truncate">{r.customerName || "—"}</p>
                      </div>
                    </Cell>

                    <Cell>
                      <span className="text-sm text-slate-600 truncate">{r.destination || "—"}</span>
                    </Cell>

                    <Cell className="!block !py-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-slate-500">
                          {nights == null ? "End date not set" : `${nights} night${nights === 1 ? "" : "s"}`}
                        </span>
                        <span className="text-[11px] text-slate-400">{fmtDate(r.tripEndDate)}</span>
                      </div>
                      <SpanBar start={r.travelDate} end={r.tripEndDate} windowStart={from} windowEnd={to} />
                    </Cell>

                    <Cell>
                      <ReadinessDots readiness={r.readiness} />
                    </Cell>

                    <Cell>
                      {r.suppliersTotal === 0 ? (
                        <Badge tone="slate">None yet</Badge>
                      ) : (
                        <Badge tone={r.suppliersConfirmed >= r.suppliersTotal ? "green" : "amber"}>
                          {r.suppliersConfirmed} / {r.suppliersTotal}
                        </Badge>
                      )}
                    </Cell>
                  </GridRow>
                );
              })}

              {/* Mobile: the grid is desktop-only, so small screens get a stacked card. */}
              {!loading && rows.map((r) => (
                <button
                  key={`m-${r.bookingPublicId}`}
                  onClick={() => setSelected(r)}
                  className="md:hidden w-full text-left px-5 py-4 border-b border-slate-50"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-blue-600">{r.bookingCode}</span>
                    <DaysBadge days={r.daysToDeparture} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {r.customerName || "—"} · {r.destination || "—"}
                  </p>
                  <p className="text-[11px] text-slate-400 mb-2">
                    {fmtDate(r.travelDate)} → {fmtDate(r.tripEndDate)}
                  </p>
                  <ReadinessDots readiness={r.readiness} />
                </button>
              ))}
            </div>
          </div>

          <Pager page={page} totalPages={totalPages} total={total} from={fromRow} to={toRow} onPage={setPage} />
        </Panel>
        )}

        {/* ── Calendar ────────────────────────────────────────────────────────
            The same rows, drawn on a month. No second fetch. */}
        {view === "calendar" && (
          <div className="flex-1 min-w-0">
            {calendarTruncated && (
              <p className="mb-2 text-[11px] font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
                Showing the first {rows.length} of {total} departures in this window — a month grid cannot page.
                Narrow the range to see them all.
              </p>
            )}
            {loading ? (
              <Panel className="p-10 text-center text-xs font-bold text-slate-400">Loading departures…</Panel>
            ) : (
              <OpsCalendar
                rows={rows}
                windowStart={from}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </div>
        )}

        {/* ── Detail panel ───────────────────────────────────────────────────
            Beside the list, not instead of it: the row stays on screen so the
            context the user clicked from is never lost. */}
        {selected && (
          <OpsDetailPanel
            entry={selected}
            onClose={() => setSelected(null)}
            onChanged={refreshAll}
          />
        )}
      </div>
    </Page>
  );
}
