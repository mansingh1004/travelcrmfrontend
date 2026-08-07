// features/calendar/pages/AllTasks.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The All Tasks screen: a left rail of date tabs with count badges + a paged grid.
//
// Server-side everything. The tab, the search, the sort and the page all go to
// GET /api/tasks/list, and the badges come from GET /api/tasks/tab-counts computed from the
// SAME scoped query — so a badge can never disagree with the list it opens. That is deliberately
// unlike AllLeads.jsx, which fetches the newest 100 rows once and filters in a useMemo; past 100
// leads its counts quietly describe a truncated set.
//
// Row scope is enforced by the backend (TaskAccessGuard). This page never filters by user.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Search, RefreshCw, CalendarClock, AlertTriangle,
  CalendarDays, CalendarRange, Layers,
} from "lucide-react";

import { usePagedList } from "@shared/api/usePagedList";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";

// Feature-local kit. Kits are never shared across features — see tasksUi.jsx's header.
import {
  Page, Panel, GridHead, GridRow, Cell, GridSkeleton, GridEmpty, Pager,
  Badge, inputCls,
} from "../components/tasksUi";

import taskService from "../api/taskService";

/* ── Columns ──────────────────────────────────────────────────────────────────
   One template drives the header, every row and the skeleton, so a column change
   is a one-line edit rather than three that drift. */
const COLS = "150px 1.6fr 1fr 1fr 120px 1fr 1fr";

const TABS = [
  { key: "TODAY",     label: "Today",     countKey: "today",     icon: CalendarClock },
  { key: "YESTERDAY", label: "Yesterday", countKey: "yesterday", icon: CalendarDays },
  { key: "OVERDUE",   label: "Overdue",   countKey: "overdue",   icon: AlertTriangle },
  { key: "UPCOMING",  label: "Upcoming",  countKey: "upcoming",  icon: CalendarRange },
  { key: "ALL",       label: "All",       countKey: "all",       icon: Layers },
];

/** Due At — time only when it falls today, otherwise a short date + time. */
function formatDueAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${time}`;
}

export default function AllTasks() {
  const navigate = useNavigate();
  const allowed = hasPermission(P.TASK_READ);

  const [tab, setTab] = useState("TODAY");
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(true);

  // usePagedList reads res.data.data + res.data.pagination, so the fetcher hands back the raw
  // axios response. Memoised: an inline arrow would be a new identity on every render and would
  // re-fire the load effect forever.
  const fetcher = useCallback((params) => taskService.listPaged(params), []);

  const {
    rows, meta, loading, error, page, setPage, q, setQ, total, totalPages, reload,
  } = usePagedList(fetcher, {
    size: 25,
    sortBy: "dueDate",
    sortDir: "asc",
    filters: useMemo(() => ({ tab }), [tab]),
  });

  const loadCounts = useCallback(async () => {
    if (!allowed) return;
    setCountsLoading(true);
    try {
      // Counts follow the same search term as the list; the tab itself is excluded by design.
      setCounts(await taskService.tabCounts({ q: q.trim() || undefined }));
    } catch (err) {
      // A failed badge must degrade silently — the interceptor already surfaced anything the user
      // can act on, and a broken count is not worth a toast over a working list.
      if (!isAlreadyReported(err)) console.warn("Task tab counts failed", err);
      setCounts({});
    } finally {
      setCountsLoading(false);
    }
  }, [allowed, q]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  useEffect(() => {
    if (error && !isAlreadyReported(error)) {
      toast.error(getErrorMessage(error, "Could not load tasks"));
    }
  }, [error]);

  const refreshAll = () => { reload(); loadCounts(); };

  const from = total === 0 ? 0 : page * (meta?.size ?? 25) + 1;
  const to = Math.min((page + 1) * (meta?.size ?? 25), total);

  if (!allowed) {
    return (
      <Page icon={ClipboardList} title="All Tasks" crumb="Tasks">
        <Panel>
          <GridEmpty
            icon={ClipboardList}
            title="You don't have access to Tasks"
            hint="Ask your administrator for the Tasks permission."
          />
        </Panel>
      </Page>
    );
  }

  return (
    <Page
      icon={ClipboardList}
      title="All Tasks"
      crumb="Tasks"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, guest or trip…"
              className={`${inputCls} pl-9 w-64`}
              aria-label="Search tasks"
            />
          </div>
          <button
            onClick={refreshAll}
            title="Refresh"
            aria-label="Refresh tasks"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Left rail ────────────────────────────────────────────────────────
            Vertical by design; every other tab strip in this app is horizontal,
            so this is new markup rather than a reused component. */}
        <nav className="lg:w-52 shrink-0" aria-label="Task filters">
          <Panel className="overflow-hidden lg:sticky lg:top-20">
            <ul className="flex lg:flex-col overflow-x-auto lg:overflow-visible">
              {TABS.map(({ key, label, countKey, icon: Icon }) => {
                const active = tab === key;
                const count = counts?.[countKey];
                const danger = key === "OVERDUE" && count > 0;
                return (
                  <li key={key} className="flex-1 lg:flex-none">
                    <button
                      onClick={() => setTab(key)}
                      aria-pressed={active}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold transition-all border-b border-slate-50 whitespace-nowrap ${
                        active
                          ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon size={15} className={active ? "text-white" : danger ? "text-rose-500" : "text-slate-400"} />
                        <span className="truncate">{label}</span>
                      </span>
                      {/* tabular-nums keeps the badges from jittering as counts change */}
                      <span
                        className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums min-w-[22px] text-center ${
                          active
                            ? "bg-white/25 text-white"
                            : danger
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

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        <Panel className="flex-1 overflow-hidden min-w-0">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400">
              {loading
                ? "Loading…"
                : total === 0
                  ? "No items"
                  : <>Showing <span className="text-slate-600">{from} – {to}</span> of <span className="text-slate-600">{total}</span> items</>}
            </p>
          </div>

          {/* Wide grid scrolls inside its own container — the page body must never scroll sideways */}
          <div className="overflow-x-auto">
            <div className="min-w-[1080px]">
              <GridHead cols={COLS}>
                <div>Due At</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Description</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Trip Source</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Guest</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">For</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Created By</div>
                <div className="border-l border-slate-200/70 pl-3 text-center">Assigned To</div>
              </GridHead>

              {loading && <GridSkeleton cols={COLS} rows={6} />}

              {!loading && rows.length === 0 && (
                <GridEmpty
                  icon={ClipboardList}
                  title={q ? "No tasks match your search" : "Nothing due here"}
                  hint={q
                    ? "Try a different name, trip code or description."
                    : "Tasks assigned to you and your team will appear here."}
                />
              )}

              {!loading && rows.map((t, i) => (
                <GridRow key={t.publicId} cols={COLS} index={i}>
                  <Cell first>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                        {formatDueAt(t.dueDate || t.startAt)}
                      </span>
                      {/* Server-derived, not recomputed here: the backend anchors on
                          COALESCE(startAt, dueDate) and the tab membership uses the same
                          expression, so trusting it keeps badge and tab consistent. */}
                      {t.overdue && <Badge tone="red">Overdue</Badge>}
                    </div>
                  </Cell>

                  <Cell className="!justify-start !text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 line-clamp-2">
                        {t.description?.trim() || t.title || "—"}
                      </p>
                      {t.description?.trim() && t.title && (
                        <p className="text-[11px] text-slate-400 truncate">{t.title}</p>
                      )}
                    </div>
                  </Cell>

                  <Cell>
                    <span className="text-sm text-slate-600 truncate">{t.tripSource || "—"}</span>
                  </Cell>

                  <Cell>
                    <span className="text-sm text-slate-600 truncate">
                      {t.customerName || t.leadName || "—"}
                    </span>
                  </Cell>

                  <Cell>
                    {t.bookingCode ? (
                      <button
                        onClick={() => navigate("/Allbookings")}
                        className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline truncate"
                        title={`Trip ${t.bookingCode}`}
                      >
                        {t.bookingCode}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </Cell>

                  <Cell>
                    <span className="text-sm text-slate-600 truncate">{t.createdByName || "—"}</span>
                  </Cell>

                  <Cell>
                    {t.assignToName
                      ? <span className="text-sm font-semibold text-slate-700 truncate">{t.assignToName}</span>
                      : <Badge tone="amber">Unassigned</Badge>}
                  </Cell>
                </GridRow>
              ))}

              {/* Mobile: the 7-column grid is desktop-only (GridRow is `hidden md:grid`), so
                  small screens get a stacked card per task instead of a sideways scroll. */}
              {!loading && rows.map((t) => (
                <div key={`m-${t.publicId}`} className="md:hidden px-5 py-4 border-b border-slate-50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-700">
                      {formatDueAt(t.dueDate || t.startAt)}
                    </span>
                    {t.overdue && <Badge tone="red">Overdue</Badge>}
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    {t.description?.trim() || t.title || "—"}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                    {t.bookingCode && <span>Trip <b className="text-blue-600">{t.bookingCode}</b></span>}
                    {(t.customerName || t.leadName) && <span>{t.customerName || t.leadName}</span>}
                    {t.tripSource && <span>{t.tripSource}</span>}
                    <span>{t.assignToName || "Unassigned"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPage={setPage}
          />
        </Panel>
      </div>
    </Page>
  );
}
