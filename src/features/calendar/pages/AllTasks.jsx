// features/calendar/pages/AllTasks.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The All Tasks screen: a horizontal tab strip with count badges over a paged grid.
//
// Server-side everything. The tab, the search, the filters, the sort and the page all go to
// GET /api/tasks/list, and the badges come from GET /api/tasks/tab-counts computed from the
// SAME scoped query — so a badge can never disagree with the list it opens. That identity only
// holds while every filter sent to the list is ALSO sent to the counts; adding one to just the
// list is how the two drift. Deliberately unlike AllLeads.jsx, which fetches the newest 100 rows
// once and filters in a useMemo; past 100 leads its counts quietly describe a truncated set.
//
// The tabs are horizontal because the vertical rail they replaced cost 228px of content width
// while the grid was already at its minimum, so every laptop between roughly 1024 and 1330px
// scrolled sideways to reach a column that had nowhere else to go. Nothing about the tabs needed
// the width — five labels and five counts.
//
// Row scope is enforced by the backend (TaskAccessGuard). This page never filters by user; the
// assignee filter narrows WITHIN that scope and cannot widen it.
//
// Writes are gated on TASK_CREATE / TASK_UPDATE / TASK_DELETE. The backend is the real gate — this
// only stops offering a button that 403s after the work of filling it in is already done.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Search, RefreshCw, CalendarClock, AlertTriangle,
  CalendarDays, CalendarRange, Layers, Plus, Check, Pencil, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";

import { usePagedList } from "@shared/api/usePagedList";
import Pager from "@shared/ui/Pager";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import { hasPermission, isSubAgent, P } from "@shared/lib/access";

// Feature-local kit. Kits are never shared across features — see tasksUi.jsx's header.
import {
  Page, Panel, GridHead, GridRow, Cell, GridSkeleton, GridEmpty, GridError,
  Badge, IconBtn, inputCls, selectCls,
} from "../components/tasksUi";

// Same feature, so a relative import. This is the form the calendar already creates and edits
// tasks with; a second one here would be a second set of validation rules over one endpoint.
import AddEventModal from "../components/AddEventModal";
import {
  PRIORITY_META, TASK_PRIORITIES, TASK_STATUSES, TASK_STATUS_LABEL,
} from "../lib/calendarUi";

import taskService from "../api/taskService";

/* ── Columns ──────────────────────────────────────────────────────────────────
   One template drives the header, every row and the skeleton, so a column change
   is a one-line edit rather than three that drift. Status, Priority and Actions
   are what the freed rail width bought. */
const COLS = "140px 1.9fr 104px 100px 0.9fr 1fr 112px 0.9fr 1fr 92px";

/**
 * The header, and which server sort key each column carries.
 *
 * `key: null` = no sort affordance. Offering one the server ignores is worse than offering none:
 * the arrow moves while the order does not. The backend allow-list (TaskServiceImpl.SORTABLE) also
 * accepts `dueAt` — an alias of `dueDate` — plus `startAt` and `createdAt`, which have no column
 * on this grid and so are deliberately not offered.
 */
const COLUMNS = [
  // The tab and the Overdue flag are anchored on COALESCE(startAt, dueDate), which is not a mapped
  // property and cannot be expressed through Sort — so this header orders by dueDate, the column
  // the cell falls back to. A row with a startAt sorts by a date it is not showing.
  { label: "Due At",      key: "dueDate",     first: true },
  { label: "Description", key: "title" },
  { label: "Status",      key: "status" },
  { label: "Priority",    key: "priority" },
  { label: "Trip Source", key: null },
  { label: "Guest",       key: "guest" },
  { label: "For",         key: "bookingCode" },
  { label: "Created By",  key: null },
  { label: "Assigned To", key: "assignee" },
  { label: "Actions",     key: null,          right: true },
];

const TABS = [
  { key: "TODAY",     label: "Today",     countKey: "today",     icon: CalendarClock },
  { key: "YESTERDAY", label: "Yesterday", countKey: "yesterday", icon: CalendarDays },
  { key: "OVERDUE",   label: "Overdue",   countKey: "overdue",   icon: AlertTriangle },
  { key: "UPCOMING",  label: "Upcoming",  countKey: "upcoming",  icon: CalendarRange },
  { key: "ALL",       label: "All",       countKey: "all",       icon: Layers },
];

/** Status → a `Badge` tone. Unknown values fall through to slate and print raw — the AllLeads
 *  idiom: a value the backend added and this file has not heard of is shown, never swallowed. */
const STATUS_TONE = { TODO: "slate", IN_PROGRESS: "blue", DONE: "green", CANCELLED: "slate" };

/** Priority as a dot, in the same colours the calendar board uses (PRIORITY_META), so one task
 *  reads identically on both screens. A dot rather than a second pill: the row already carries a
 *  status pill and two pills side by side stop being scannable. */
const PRIORITY_DOT = {
  LOW: "bg-slate-300", MEDIUM: "bg-blue-400", HIGH: "bg-amber-400", URGENT: "bg-rose-500",
};

/** usePagedList's own default. It keeps its debounced term private, so the counts below re-derive
 *  it — if that default ever changes, the badges lag the list by one keystroke until this does. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The calendar anchor the SERVER uses: COALESCE(startAt, dueDate), startAt first.
 *
 * Printing dueDate first put a date on screen that could contradict the tab the row was sitting
 * in — the tab membership and the overdue flag are both computed from this expression, so the
 * cell has to read it the same way round. One helper, because the desktop row and the mobile card
 * both render it and two copies is how they disagree.
 */
const dueAnchor = (t) => t.startAt || t.dueDate;

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

/**
 * Sort affordance for a column header. Module-level on purpose: declared inside the render body it
 * would be a new component TYPE on every keystroke, so React would unmount and remount all seven
 * header icons on each state change — harmless while it renders one stateless svg, and a bug the
 * moment anyone gives it a transition, a ref or local state.
 */
const SortIcon = ({ k, sortKey, sortDir }) => {
  if (sortKey !== k) return <ChevronsUpDown size={12} className="inline ml-1 opacity-30" />;
  return sortDir === "asc"
    ? <ChevronUp size={12} className="inline ml-1 text-blue-500" />
    : <ChevronDown size={12} className="inline ml-1 text-blue-500" />;
};

export default function AllTasks() {
  const navigate = useNavigate();
  const allowed = hasPermission(P.TASK_READ);

  // READ is not WRITE. TASK_READ alone must land on a grid with no controls on it, not on controls
  // that 403 once the user has filled the form in.
  const canCreate = hasPermission(P.TASK_CREATE);
  const canUpdate = hasPermission(P.TASK_UPDATE);
  const canDelete = hasPermission(P.TASK_DELETE);
  // Hoisted out of the row loop: hasPermission parses a localStorage JSON blob on every call, and
  // the Trip# cell would ask it twice per row.
  const canOpenBooking = hasPermission(P.BOOKING_READ);

  const [tab, setTab] = useState("TODAY");
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(true);

  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sortKey, setSortKey] = useState("dueDate");
  const [sortDir, setSortDir] = useState("asc");

  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);     // task being edited; null = create
  const [modalOpen, setModalOpen] = useState(false);

  // usePagedList reads res.data.data + res.data.pagination, so the fetcher hands back the raw
  // axios response. Memoised: an inline arrow would be a new identity on every render and would
  // re-fire the load effect forever.
  const fetcher = useCallback((params) => taskService.listPaged(params), []);

  // Everything except the tab. The list adds `tab`; the counts must send exactly the rest, or a
  // badge starts describing a different query from the one clicking it opens.
  const filters = useMemo(() => ({
    assignee: assignee || undefined,
    status: status || undefined,
    priority: priority || undefined,
  }), [assignee, status, priority]);

  const {
    rows, loading, error, page, setPage, pageSize, setPageSize,
    q, setQ, total, totalPages, reload,
  } = usePagedList(fetcher, {
    size: 25,
    sortBy: sortKey,
    sortDir,
    filters: useMemo(() => ({ tab, ...filters }), [tab, filters]),
  });

  /* ── Tab counts ───────────────────────────────────────────────────────────
     Debounced to the same 300ms as the list. loadCounts used to depend on the RAW q while the list
     sent the debounced one, so every keystroke fired five COUNT queries — and the badges briefly
     described a search the grid had not run yet. */
  const [countsQ, setCountsQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setCountsQ(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // Same guard usePagedList uses on the list: five counts per request means a slow earlier answer
  // can land after a newer one and leave every badge describing a search nobody is looking at.
  const countsReqId = useRef(0);

  const loadCounts = useCallback(async () => {
    if (!allowed) return;
    const id = ++countsReqId.current;
    setCountsLoading(true);
    try {
      // Counts follow the same search and filters as the list; the tab itself is excluded by design.
      const next = await taskService.tabCounts({ q: countsQ || undefined, ...filters });
      if (id !== countsReqId.current) return;      // a newer request already won
      setCounts(next);
    } catch (err) {
      if (id !== countsReqId.current) return;
      // A failed badge must degrade silently — the interceptor already surfaced anything the user
      // can act on, and a broken count is not worth a toast over a working list.
      if (!isAlreadyReported(err)) console.warn("Task tab counts failed", err);
      setCounts({});
    } finally {
      if (id === countsReqId.current) setCountsLoading(false);
    }
  }, [allowed, countsQ, filters]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  // GET /users/available is CRM_FULL-gated, which a sub-agent does not hold — calling it anyway
  // 403s on every page load and the shared interceptor toasts each one. A sub-agent only ever sees
  // its own rows, so the assignee filter has nothing to offer it either.
  useEffect(() => {
    if (!allowed || isSubAgent()) return;
    taskService.assignableUsers().then(setUsers).catch(() => setUsers([]));
  }, [allowed]);

  useEffect(() => {
    if (error && !isAlreadyReported(error)) {
      toast.error(getErrorMessage(error, "Could not load tasks"));
    }
  }, [error]);

  const refreshAll = useCallback(() => { reload(); loadCounts(); }, [reload, loadCounts]);

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    // No setPage: usePagedList resets to page 0 itself whenever the sort changes.
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setModalOpen(true); };

  const completeTask = async (t) => {
    setBusyId(t.publicId);
    try {
      await taskService.complete(t.publicId);
      toast.success("Task marked complete.");
      refreshAll();                                 // the row may leave this tab entirely
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not complete the task"));
    } finally {
      setBusyId(null);
    }
  };

  const removeTask = async (t) => {
    if (!window.confirm(`Delete "${t.title || t.description || "this task"}"?`)) return;
    setBusyId(t.publicId);
    try {
      await taskService.remove(t.publicId);
      toast.success("Task deleted.");
      refreshAll();
    } catch (err) {
      if (!isAlreadyReported(err)) toast.error(getErrorMessage(err, "Could not delete the task"));
    } finally {
      setBusyId(null);
    }
  };

  const anyFilter = Boolean(q.trim() || assignee || status || priority);
  const clearFilters = () => { setQ(""); setAssignee(""); setStatus(""); setPriority(""); };

  // Mirrors the shared Pager's own visibility rule, so the bordered footer strip can never outlive
  // the control inside it.
  const showPager = totalPages > 1 || total > pageSize;

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

  const newTaskBtn = (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm hover:bg-blue-700 transition-all"
    >
      <Plus className="w-4 h-4" /> New task
    </button>
  );

  return (
    <Page
      icon={ClipboardList}
      title="All Tasks"
      crumb="Tasks"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, guest or trip…"
              className={`${inputCls} pl-9 w-44 sm:w-64`}
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
          {canCreate && newTaskBtn}
        </div>
      }
    >
      {/* ── Tabs ───────────────────────────────────────────────────────────────
          A hairline underline strip, not a card: the rail this replaced was a sticky glass panel
          holding five words, and every pixel it occupied came out of the grid beside it. */}
      <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-slate-200/70" aria-label="Task filters">
        {TABS.map(({ key, label, countKey, icon: Icon }) => {
          const active = tab === key;
          const count = counts?.[countKey];
          const danger = key === "OVERDUE" && count > 0;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={active}
              className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={15} className={active ? "text-blue-600" : danger ? "text-rose-500" : "text-slate-400"} />
              {label}
              {/* tabular-nums keeps the badges from jittering as counts change */}
              <span
                className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums min-w-[22px] text-center ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : danger
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {countsLoading && count == null ? "·" : (count ?? 0)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <Panel className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold text-slate-400 mr-auto">
            {loading ? "Loading…" : `${total} ${total === 1 ? "task" : "tasks"}`}
          </p>

          {/* Every filter here is ALSO in `filters`, which the counts send — see the header. */}
          {users.length > 0 && (
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className={selectCls}
              aria-label="Filter by assignee"
            >
              <option value="">All assignees</option>
              {users.map((u) => (
                <option key={u.publicId} value={u.publicId}>{u.fullName || u.email}</option>
              ))}
            </select>
          )}

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectCls}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={selectCls}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p]?.label ?? p}</option>
            ))}
          </select>

          {anyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-slate-400 hover:text-blue-600 px-2 py-1.5 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Wide grid scrolls inside its own container — the page body must never scroll sideways.
            The stacked mobile cards, the empty state and the error state are all OUTSIDE this box:
            inside it, a 390px phone laid each card out at 1080px, which is exactly the sideways
            scroll the cards exist to avoid. */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[1080px]">
            <GridHead cols={COLS}>
              {COLUMNS.map(({ label, key, first, right }) => (
                <Cell key={label} first={first} right={right} className={key ? "select-none" : ""}>
                  {/* A real <button>, not a span with onClick as the other grids use it: sorting is
                      the only way to reach nine of these columns' orderings, and a span cannot be
                      tabbed to. Preflight makes the button inherit the header's type styles. */}
                  {key ? (
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      aria-label={`Sort by ${label}`}
                      className="inline-flex items-center whitespace-nowrap hover:text-blue-600 focus-visible:text-blue-600 outline-none transition-colors"
                    >
                      {label}<SortIcon k={key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  ) : label}
                </Cell>
              ))}
            </GridHead>

            {loading && <GridSkeleton cols={COLS} rows={6} />}

            {!loading && !error && rows.map((t, i) => {
              const busy = busyId === t.publicId;
              // A finished task stays on the ALL tab, so it has to LOOK finished — dimmed, and its
              // complete action gone. Without this a DONE row was pixel-identical to an open one.
              const closed = t.status === "DONE" || t.status === "CANCELLED";
              return (
                <GridRow key={t.publicId} cols={COLS} index={i} className={closed ? "opacity-60" : ""}>
                  <Cell first>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold whitespace-nowrap ${t.overdue ? "text-rose-700" : "text-slate-700"}`}>
                        {formatDueAt(dueAnchor(t))}
                      </p>
                      {/* Server-derived, not recomputed here: the backend anchors on
                          COALESCE(startAt, dueDate) and the tab membership uses the same
                          expression, so trusting it keeps badge and tab consistent. A label rather
                          than a pill — a pill plus a timestamp does not fit 140px, and the column
                          gave up its slack to Status and Priority. */}
                      {t.overdue && (
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-rose-500">Overdue</p>
                      )}
                    </div>
                  </Cell>

                  <Cell className="!justify-start !text-left">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold text-slate-700 line-clamp-2 ${closed ? "line-through" : ""}`}>
                        {t.description?.trim() || t.title || "—"}
                      </p>
                      {t.description?.trim() && t.title && (
                        <p className="text-[11px] text-slate-400 truncate">{t.title}</p>
                      )}
                    </div>
                  </Cell>

                  <Cell>
                    <Badge tone={STATUS_TONE[t.status] ?? "slate"} className="whitespace-nowrap">
                      {TASK_STATUS_LABEL[t.status] ?? t.status ?? "—"}
                    </Badge>
                  </Cell>

                  <Cell>
                    {t.priority ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 whitespace-nowrap">
                        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] ?? "bg-slate-300"}`} />
                        {PRIORITY_META[t.priority]?.label ?? t.priority}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
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
                    {/* Deep-link to the booking the task carries, not to the unfiltered list — the
                        row already knows which trip it means. Plain text without BOOKING_READ:
                        the target page would only 403. */}
                    {t.bookingCode && t.bookingPublicId && canOpenBooking ? (
                      <button
                        onClick={() => navigate(`/BookingDetails/${t.bookingPublicId}`)}
                        className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline truncate"
                        title={`Open trip ${t.bookingCode}`}
                      >
                        {t.bookingCode}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-600 truncate">{t.bookingCode || "—"}</span>
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

                  <Cell right>
                    <div className="flex items-center gap-0.5">
                      {canUpdate && !closed && (
                        <IconBtn title="Mark complete" tone="emerald" disabled={busy} onClick={() => completeTask(t)}>
                          <Check size={15} />
                        </IconBtn>
                      )}
                      {canUpdate && (
                        <IconBtn title="Edit task" disabled={busy} onClick={() => openEdit(t)}>
                          <Pencil size={14} />
                        </IconBtn>
                      )}
                      {canDelete && (
                        <IconBtn title="Delete task" tone="rose" disabled={busy} onClick={() => removeTask(t)}>
                          <Trash2 size={14} />
                        </IconBtn>
                      )}
                      {!canUpdate && !canDelete && <span className="text-sm text-slate-300">—</span>}
                    </div>
                  </Cell>
                </GridRow>
              );
            })}
          </div>
        </div>

        {/* A failed load is not an empty day — see GridError. */}
        {!loading && error && (
          <GridError
            message={getErrorMessage(error, "The task list could not be loaded.")}
            onRetry={refreshAll}
          />
        )}

        {!loading && !error && rows.length === 0 && (
          <GridEmpty
            icon={ClipboardList}
            title={anyFilter ? "No tasks match these filters" : "Nothing due here"}
            hint={anyFilter
              ? "Try a different name, trip code, assignee or status."
              : "Tasks assigned to you and your team will appear here."}
            action={anyFilter
              ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all"
                >
                  Clear filters
                </button>
              )
              : (canCreate ? newTaskBtn : null)}
          />
        )}

        {/* Mobile: the 10-column grid is desktop-only (GridRow is `hidden md:grid`), so small
            screens get a stacked card per task instead of a sideways scroll. */}
        {!loading && !error && rows.map((t) => {
          const busy = busyId === t.publicId;
          const closed = t.status === "DONE" || t.status === "CANCELLED";
          return (
            <div
              key={`m-${t.publicId}`}
              className={`md:hidden px-5 py-4 border-b border-slate-50 ${closed ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-sm font-bold ${t.overdue ? "text-rose-700" : "text-slate-700"}`}>
                  {formatDueAt(dueAnchor(t))}
                  {t.overdue && (
                    <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wide text-rose-500">Overdue</span>
                  )}
                </span>
                <Badge tone={STATUS_TONE[t.status] ?? "slate"}>
                  {TASK_STATUS_LABEL[t.status] ?? t.status ?? "—"}
                </Badge>
              </div>
              <p className={`text-sm font-semibold text-slate-700 mb-2 ${closed ? "line-through" : ""}`}>
                {t.description?.trim() || t.title || "—"}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                {t.priority && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] ?? "bg-slate-300"}`} />
                    {PRIORITY_META[t.priority]?.label ?? t.priority}
                  </span>
                )}
                {t.bookingCode && (
                  t.bookingPublicId && canOpenBooking
                    ? (
                      <button
                        onClick={() => navigate(`/BookingDetails/${t.bookingPublicId}`)}
                        className="font-bold text-blue-600"
                      >
                        Trip {t.bookingCode}
                      </button>
                    )
                    : <span>Trip <b className="text-slate-600">{t.bookingCode}</b></span>
                )}
                {(t.customerName || t.leadName) && <span>{t.customerName || t.leadName}</span>}
                {t.tripSource && <span>{t.tripSource}</span>}
                <span>{t.assignToName || "Unassigned"}</span>

                {(canUpdate || canDelete) && (
                  <span className="ml-auto flex items-center gap-0.5">
                    {canUpdate && !closed && (
                      <IconBtn title="Mark complete" tone="emerald" disabled={busy} onClick={() => completeTask(t)}>
                        <Check size={15} />
                      </IconBtn>
                    )}
                    {canUpdate && (
                      <IconBtn title="Edit task" disabled={busy} onClick={() => openEdit(t)}>
                        <Pencil size={14} />
                      </IconBtn>
                    )}
                    {canDelete && (
                      <IconBtn title="Delete task" tone="rose" disabled={busy} onClick={() => removeTask(t)}>
                        <Trash2 size={14} />
                      </IconBtn>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {showPager && (
          <div className="px-4 sm:px-5 border-t border-slate-100 bg-slate-50/60">
            <Pager
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
              loading={loading}
              label="tasks"
            />
          </div>
        )}

        {/* Same idiom as OpsCheckpointPanel: say WHY the grid is inert rather than leaving a user
            hunting for an action that was never rendered. */}
        {!canCreate && !canUpdate && !canDelete && (
          <p className="px-5 py-2 text-[10px] font-bold text-slate-400 border-t border-slate-100">
            Read-only — creating or working tasks needs the Tasks permission.
          </p>
        )}
      </Panel>

      {/* The calendar's create/edit form, reused. `users` is empty for a sub-agent, which the modal
          renders as an unassigned-only picker — the same answer the backend would give it. */}
      {(canCreate || canUpdate) && (
        <AddEventModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={refreshAll}
          users={users}
          task={editing}
        />
      )}
    </Page>
  );
}
