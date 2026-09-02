// // features/calendar/components/TaskBoard.jsx
// // Kanban board over /api/tasks — columns TODO / IN PROGRESS / DONE. Move a card with its status
// // dropdown; click a card to edit. Cancelled tasks are hidden.
// import { useEffect, useState, useCallback } from "react";
// import { Loader2, Plus, CalendarClock, User2 } from "lucide-react";
// import { toast } from "@shared/ui/toast";
// import taskService from "../api/taskService";
// import {
//   BOARD_COLUMNS, TASK_STATUS_LABEL, TASK_STATUSES, PRIORITY_META, CATEGORY_LABEL, fmtDayLabel,
// } from "../lib/calendarUi";

// const COLUMN_ACCENT = {
//   TODO: "border-t-slate-400",
//   IN_PROGRESS: "border-t-blue-500",
//   DONE: "border-t-emerald-500",
// };

// export default function TaskBoard({ reloadKey, onEdit, onAdd }) {
//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const load = useCallback(() => {
//     setLoading(true);
//     taskService.list()
//       .then((data) => setTasks(Array.isArray(data) ? data : []))
//       .catch(() => toast.error("Could not load tasks."))
//       .finally(() => setLoading(false));
//   }, []);

//   useEffect(() => { load(); }, [load, reloadKey]);

//   const move = async (task, status) => {
//     if (status === task.status) return;
//     const prev = tasks;
//     setTasks((ts) => ts.map((t) => (t.publicId === task.publicId ? { ...t, status } : t)));
//     try {
//       await taskService.changeStatus(task.publicId, status);
//     } catch (err) {
//       setTasks(prev);
//       toast.error(err?.response?.data?.message || "Could not move the task.");
//     }
//   };

//   if (loading) {
//     return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>;
//   }

//   const byStatus = (s) => tasks.filter((t) => t.status === s);

//   return (
//     <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
//       {BOARD_COLUMNS.map((col) => {
//         const items = byStatus(col);
//         return (
//           <div key={col} className={`rounded-2xl border-t-4 bg-slate-50/70 p-3 ${COLUMN_ACCENT[col]}`}>
//             <div className="mb-3 flex items-center justify-between px-1">
//               <h3 className="text-sm font-bold text-slate-700">{TASK_STATUS_LABEL[col]}</h3>
//               <div className="flex items-center gap-2">
//                 <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
//                 {col === "TODO" && (
//                   <button onClick={onAdd} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-blue-600" title="Add task">
//                     <Plus size={16} />
//                   </button>
//                 )}
//               </div>
//             </div>

//             <div className="space-y-2.5">
//               {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">Nothing here</p>}
//               {items.map((t) => {
//                 const pr = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
//                 return (
//                   <div key={t.publicId} className="group rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
//                     <button onClick={() => onEdit?.(t)} className="mb-2 block w-full text-left text-sm font-semibold text-slate-800 hover:text-blue-600">
//                       {t.title}
//                     </button>
//                     <div className="mb-2 flex flex-wrap items-center gap-1.5">
//                       <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${pr.chip}`}>{pr.label}</span>
//                       <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{CATEGORY_LABEL[t.category] || t.category}</span>
//                       {t.overdue && <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Overdue</span>}
//                     </div>
//                     <div className="flex items-center justify-between text-[11px] text-slate-400">
//                       <span className="inline-flex items-center gap-1 truncate">
//                         <User2 size={12} />{t.assignToName || "Unassigned"}
//                       </span>
//                       {(t.dueDate || t.startAt) && (
//                         <span className="inline-flex items-center gap-1 whitespace-nowrap">
//                           <CalendarClock size={12} />{fmtDayLabel(t.dueDate || t.startAt)}
//                         </span>
//                       )}
//                     </div>
//                     <select
//                       value={t.status}
//                       onChange={(e) => move(t, e.target.value)}
//                       className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 focus:border-blue-400 focus:outline-none"
//                     >
//                       {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
//                     </select>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// }



// features/calendar/components/TaskBoard.jsx
// Kanban board over /api/tasks — columns TODO / IN PROGRESS / DONE. Move a card with its status
// dropdown; click a card to edit. Cancelled tasks are never fetched — no column renders them.
import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, CalendarClock, User2 } from "lucide-react";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";
import taskService from "../api/taskService";
import {
  BOARD_COLUMNS, TASK_STATUS_LABEL, TASK_STATUSES, PRIORITY_META, CATEGORY_LABEL, fmtDayLabel,
} from "../lib/calendarUi";

const COLUMN_ACCENT = {
  TODO: "border-t-slate-400",
  IN_PROGRESS: "border-t-blue-500",
  DONE: "border-t-emerald-500",
};

// One page per column, extended by "Load more". This board used to call taskService.list(), which
// hits the UNPAGED GET /api/tasks and pulled the tenant's ENTIRE task table into the browser on
// every open and every reloadKey bump — and DONE only ever grows, so that download got worse with
// age. GET /tasks/list is the capped route (the server clamps size at 200).
const COLUMN_PAGE_SIZE = 25;

// Per-column ordering. TODO/IN_PROGRESS are outstanding work, so the nearest due date leads.
// DONE is what needed bounding: the endpoint takes no date window and completedAt is not in the
// server's sort allow-list, so newest-created-first is the window — one page of recent work
// instead of every task the tenant has ever finished. Older ones stay reachable via Load more.
const COLUMN_SORT = {
  TODO:        { sortBy: "dueDate",   sortDir: "asc" },
  IN_PROGRESS: { sortBy: "dueDate",   sortDir: "asc" },
  DONE:        { sortBy: "createdAt", sortDir: "desc" },
};

// tab=ALL is the only tab that does not restrict to the open statuses — the four date tabs would
// drop every DONE row. The per-column status filter is also what keeps CANCELLED off the wire:
// BOARD_COLUMNS has no column for it, so fetching it only ever paid to throw the rows away.
const fetchColumn = (col, page) =>
  taskService
    .listPaged({ tab: "ALL", status: col, page, size: COLUMN_PAGE_SIZE, ...COLUMN_SORT[col] })
    .then((res) => ({
      rows: Array.isArray(res?.data?.data) ? res.data.data : [],
      pagination: res?.data?.pagination ?? null,
    }));

// Move one unit of the server total from one column to another. Unknown keys are skipped on
// purpose — CANCELLED is a legal destination in the dropdown and has no column to credit.
const shiftTotal = (m, from, to) => {
  const next = { ...m };
  if (next[from]) next[from] = { ...next[from], total: Math.max(0, next[from].total - 1) };
  if (next[to]) next[to] = { ...next[to], total: next[to].total + 1 };
  return next;
};

export default function TaskBoard({ reloadKey, onEdit, onAdd }) {
  // The backend gates these with TASK_CREATE / TASK_UPDATE; without the same gate here a viewer
  // gets a status dropdown and an add button that only ever answer 403.
  const canCreate = hasPermission(P.TASK_CREATE);
  const canUpdate = hasPermission(P.TASK_UPDATE);

  const [tasks, setTasks] = useState([]);
  // Per column: { page, total, hasNext }. `total` is the SERVER count — the header badge shows it
  // rather than the loaded rows, which are only the pages fetched so far.
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all(BOARD_COLUMNS.map((col) => fetchColumn(col, 0)))
      .then((pages) => {
        setTasks(pages.flatMap((p) => p.rows));
        setMeta(Object.fromEntries(BOARD_COLUMNS.map((col, i) => [col, {
          page: 0,
          total: pages[i].pagination?.totalElements ?? pages[i].rows.length,
          hasNext: Boolean(pages[i].pagination?.hasNext),
        }])));
      })
      .catch(() => toast.error("Could not load tasks."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const loadMore = async (col) => {
    const cur = meta[col];
    if (!cur?.hasNext || loadingMore) return;
    setLoadingMore(col);
    try {
      const next = await fetchColumn(col, cur.page + 1);
      // A card someone else moved between the two requests can reappear in a page we already hold;
      // append by publicId so the board can never render the same key twice.
      setTasks((ts) => {
        const seen = new Set(ts.map((t) => t.publicId));
        return [...ts, ...next.rows.filter((t) => !seen.has(t.publicId))];
      });
      setMeta((m) => ({
        ...m,
        [col]: {
          page: cur.page + 1,
          total: next.pagination?.totalElements ?? m[col].total,
          hasNext: Boolean(next.pagination?.hasNext),
        },
      }));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not load more tasks.");
    } finally {
      setLoadingMore(null);
    }
  };

  const move = async (task, status) => {
    if (status === task.status) return;
    const prev = tasks;
    const prevMeta = meta;
    setTasks((ts) => ts.map((t) => (t.publicId === task.publicId ? { ...t, status } : t)));
    // The badge counts the server total now, not the rows on screen, so the optimistic move has to
    // shift it by hand — and put it back together with the rows when the PATCH fails.
    setMeta((m) => shiftTotal(m, task.status, status));
    try {
      await taskService.changeStatus(task.publicId, status);
    } catch (err) {
      setTasks(prev);
      setMeta(prevMeta);
      toast.error(err?.response?.data?.message || "Could not move the task.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }

  const byStatus = (s) => tasks.filter((t) => t.status === s);

  return (
    /* 
      Responsive Layout: 
      - Mobile: Horizontal scroll with snap (swipeable columns)
      - Desktop (md+): Standard 3-column CSS grid 
    */
    <div className="flex snap-x snap-mandatory overflow-x-auto pb-4 md:grid md:grid-cols-3 gap-4 md:overflow-visible md:pb-0">
      {BOARD_COLUMNS.map((col) => {
        const items = byStatus(col);
        return (
          <div 
            key={col} 
            className={`w-[85vw] shrink-0 snap-center md:w-auto rounded-2xl border-t-4 bg-slate-50/70 p-3 sm:p-4 ${COLUMN_ACCENT[col]}`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-700">{TASK_STATUS_LABEL[col]}</h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{meta[col]?.total ?? items.length}</span>
                {col === "TODO" && canCreate && (
                  <button onClick={onAdd} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-blue-600 shadow-sm transition-all" title="Add task">
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">Nothing here</p>}
              {items.map((t) => {
                const pr = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
                return (
                  <div key={t.publicId} className="group rounded-xl bg-white p-3.5 sm:p-3 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
                    <button onClick={() => onEdit?.(t)} className="mb-2.5 block w-full text-left text-sm font-semibold text-slate-800 hover:text-blue-600">
                      {t.title}
                    </button>
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${pr.chip}`}>{pr.label}</span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{CATEGORY_LABEL[t.category] || t.category}</span>
                      {t.overdue && <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Overdue</span>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1 truncate max-w-[50%]">
                        <User2 size={12} className="shrink-0" />
                        <span className="truncate">{t.assignToName || "Unassigned"}</span>
                      </span>
                      {(t.dueDate || t.startAt) && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <CalendarClock size={12} className="shrink-0" />
                          {fmtDayLabel(t.dueDate || t.startAt)}
                        </span>
                      )}
                    </div>
                    {/* Disabled rather than hidden: without TASK_UPDATE the card must still say
                        which column it is in, it just can't be moved out of it. */}
                    <select
                      value={t.status}
                      onChange={(e) => move(t, e.target.value)}
                      disabled={!canUpdate}
                      title={canUpdate ? undefined : "You don't have permission to move tasks"}
                      className={`mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none ${canUpdate ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                    >
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                );
              })}

              {/* Only a page of each column is on screen; this is how the rest is reached. */}
              {meta[col]?.hasNext && (
                <button
                  onClick={() => loadMore(col)}
                  disabled={loadingMore === col}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white/60 py-2 text-[11px] font-bold text-slate-500 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60"
                >
                  {loadingMore === col
                    ? <><Loader2 size={12} className="animate-spin" />Loading…</>
                    : `Load more (${Math.max(0, (meta[col].total ?? 0) - items.length)} left)`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}