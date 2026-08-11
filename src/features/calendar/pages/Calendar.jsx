// // features/calendar/pages/Calendar.jsx
// // Unified Task & Team Calendar — month grid + KPI cards + left/right rails + Board + Workload.
// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   ChevronLeft, ChevronRight, ChevronDown, Plus, Loader2, CalendarCheck2, Briefcase, IndianRupee, Plane,
//   BedDouble, Stamp, Users, TrendingUp, LayoutGrid, List as ListIcon, CalendarDays, BarChart3,
//   Check, Clock,
// } from "lucide-react";
// import { toast } from "@shared/ui/toast";
// import { isSubAgent, isTenantAdmin, isManager } from "@shared/lib/access";
// import calendarService from "../api/calendarService";
// import taskService from "../api/taskService";
// import AddEventModal from "../components/AddEventModal";
// import TaskBoard from "../components/TaskBoard";
// import {
//   SOURCE_ORDER, SOURCE_META, metaFor, metaKeyFor, PRIORITY_META, MONTHS, WEEKDAYS,
//   monthMatrix, gridWindow, addMonths, isSameDay, dateKey, eventDayKey, fmtMoney, fmtTime, fmtDayLabel,
// } from "../lib/calendarUi";

// /* ── Small presentational pieces ─────────────────────────────────────────────── */

// function EventChip({ ev, onClick }) {
//   const meta = metaFor(ev);
//   const clickable = ev.source === "TASK";
//   return (
//     <button
//       type="button"
//       onClick={clickable ? (e) => { e.stopPropagation(); onClick(ev); } : undefined}
//       title={ev.title + (ev.subtitle ? " — " + ev.subtitle : "")}
//       className={`flex w-full items-center gap-1 rounded-md px-1.5 py-[3px] text-left text-[11px] font-medium ring-1 ${meta.chip} ${clickable ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
//     >
//       <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
//       {!ev.allDay && ev.start && <span className="shrink-0 tabular-nums opacity-70">{fmtTime(ev.start)}</span>}
//       <span className="truncate">{ev.title}</span>
//     </button>
//   );
// }

// // Colourful KPI palettes — literal class strings so Tailwind's JIT keeps them.
// const KPI_PALETTE = {
//   blue:    { card: "from-blue-50 to-blue-100/40 ring-blue-100",       icon: "bg-blue-600",    value: "text-blue-700" },
//   emerald: { card: "from-emerald-50 to-emerald-100/40 ring-emerald-100", icon: "bg-emerald-600", value: "text-emerald-700" },
//   amber:   { card: "from-amber-50 to-amber-100/40 ring-amber-100",    icon: "bg-amber-500",   value: "text-amber-700" },
//   indigo:  { card: "from-indigo-50 to-indigo-100/40 ring-indigo-100", icon: "bg-indigo-600",  value: "text-indigo-700" },
//   yellow:  { card: "from-yellow-50 to-yellow-100/40 ring-yellow-100", icon: "bg-yellow-500",  value: "text-yellow-700" },
//   rose:    { card: "from-rose-50 to-rose-100/40 ring-rose-100",       icon: "bg-rose-600",    value: "text-rose-700" },
//   cyan:    { card: "from-cyan-50 to-cyan-100/40 ring-cyan-100",       icon: "bg-cyan-600",    value: "text-cyan-700" },
//   green:   { card: "from-green-50 to-green-100/40 ring-green-100",    icon: "bg-green-600",   value: "text-green-700" },
// };

// function KpiCard({ icon: Icon, color, label, value }) {
//   const p = KPI_PALETTE[color] || KPI_PALETTE.blue;
//   return (
//     <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-br p-3.5 shadow-sm ring-1 transition hover:shadow-md ${p.card}`}>
//       <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ${p.icon}`}><Icon size={20} /></div>
//       <div className="min-w-0">
//         <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
//         <p className={`truncate text-xl font-extrabold ${p.value}`}>{value}</p>
//       </div>
//     </div>
//   );
// }

// function RailCard({ title, children, className = "", bodyClassName = "", accent = "bg-slate-300" }) {
//   return (
//     <div className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>
//       <h4 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-bold text-slate-700">
//         <span className={`h-4 w-1.5 rounded-full ${accent}`} />{title}
//       </h4>
//       <div className={`min-h-0 ${bodyClassName}`}>{children}</div>
//     </div>
//   );
// }

// function RailList({ items, empty }) {
//   if (!items || items.length === 0) return <p className="py-2 text-xs text-slate-400">{empty}</p>;
//   return (
//     <ul className="divide-y divide-slate-50">
//       {items.map((ev) => {
//         const meta = metaFor(ev);
//         return (
//           <li key={ev.id} className="flex items-start gap-2.5 py-2">
//             <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
//             <div className="min-w-0 flex-1">
//               <p className="truncate text-[13px] font-semibold text-slate-700">{ev.title}</p>
//               {ev.subtitle && <p className="truncate text-[11px] text-slate-400">{ev.subtitle}</p>}
//             </div>
//             <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-slate-400">
//               {ev.amount != null ? fmtMoney(ev.amount) : !ev.allDay ? fmtTime(ev.start) : ""}
//             </span>
//           </li>
//         );
//       })}
//     </ul>
//   );
// }

// /* ── Workload view ───────────────────────────────────────────────────────────── */

// function WorkloadView({ reloadKey }) {
//   const [rows, setRows] = useState([]);
//   const [loading, setLoading] = useState(true);
//   useEffect(() => {
//     setLoading(true);
//     taskService.workload()
//       .then((d) => setRows(Array.isArray(d) ? d : []))
//       .catch(() => toast.error("Could not load workload."))
//       .finally(() => setLoading(false));
//   }, [reloadKey]);

//   if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>;
//   // Scale against the busiest WORKLOAD SCORE — todo + inProgress + activeLeads + openReminders, sent
//   // by the backend (UserWorkload.score()) and the exact number the load-based lead assignment picks
//   // the minimum of. The rows arrive already sorted by it.
//   //
//   // This deliberately no longer scales by `total + activeLeads`. `total` counts DONE tasks, so
//   // finishing work made someone's bar LONGER and pushed them up this list, while auto-assignment —
//   // which never counted DONE — kept sending them leads. The two views disagreed, and the harder
//   // someone worked the more this screen misrepresented them.
//   const scoreOf = (r) => r.workloadScore ?? ((r.todo || 0) + (r.inProgress || 0) + (r.activeLeads || 0) + (r.openReminders || 0));
//   const maxLoad = Math.max(1, ...rows.map(scoreOf));

//   return (
//     <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
//       <h3 className="mb-4 text-base font-bold text-slate-800">Team Workload</h3>
//       {rows.length === 0 ? (
//         <p className="py-8 text-center text-sm text-slate-400">No workload yet.</p>
//       ) : (
//         <div className="space-y-3">
//           {rows.map((r) => {
//             const leads = r.activeLeads || 0;
//             const reminders = r.openReminders || 0;
//             const score = scoreOf(r);
//             return (
//               <div key={r.assigneePublicId || "unassigned"} className="flex items-center gap-4">
//                 <div className="w-40 shrink-0 truncate text-sm font-semibold text-slate-700">{r.assigneeName}</div>
//                 {/* The bar shows only what the SCORE is made of. `done` is reported as a chip but is
//                     deliberately absent here — completed work is not load, and drawing it as load is
//                     what made the busiest-looking person the one who had finished the most. */}
//                 <div className="flex h-6 flex-1 overflow-hidden rounded-lg bg-slate-100"
//                      title={`Workload ${score} = ${r.todo} to-do + ${r.inProgress} in progress + ${leads} active leads + ${reminders} open reminders`}>
//                   <div className="bg-slate-400" style={{ width: `${(r.todo / maxLoad) * 100}%` }} />
//                   <div className="bg-blue-500" style={{ width: `${(r.inProgress / maxLoad) * 100}%` }} />
//                   <div className="bg-indigo-500" style={{ width: `${(leads / maxLoad) * 100}%` }} />
//                   <div className="bg-amber-500" style={{ width: `${(reminders / maxLoad) * 100}%` }} />
//                 </div>
//                 <div className="flex w-72 shrink-0 flex-wrap items-center justify-end gap-1.5 text-[11px] font-semibold">
//                   <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white" title="Workload score — new leads go to the lowest">{score}</span>
//                   <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">{leads} leads</span>
//                   <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{r.todo} to-do</span>
//                   <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">{r.inProgress} wip</span>
//                   {reminders > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{reminders} rem</span>}
//                   <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{r.done} done</span>
//                   {r.overdue > 0 && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{r.overdue}!</span>}
//                 </div>
//               </div>
//             );
//           })}
//           <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-400">
//             <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Active Leads</span>
//             <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />To Do</span>
//             <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />In Progress</span>
//             <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Open Reminders</span>
//             <span className="ml-auto">New leads are auto-assigned to the lowest workload.</span>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ── Main page ───────────────────────────────────────────────────────────────── */

// export default function Calendar() {
//   const subAgent = isSubAgent();
//   // Team Workload is a manager-facing roll-up (whole-team task + lead load), so the tab is
//   // limited to the roles that actually manage a team: Tenant Admin and Manager. Other operational
//   // roles (Travel Agent, Staff, Accountant) still hold CRM_FULL server-side but don't get the tab.
//   const canSeeWorkload = isTenantAdmin() || isManager();
//   const [view, setView] = useState("month");
//   const [cursor, setCursor] = useState(() => new Date());
//   const [selectedDay, setSelectedDay] = useState(() => new Date());
//   const [events, setEvents] = useState([]);
//   const [summary, setSummary] = useState(null);
//   const [myTasks, setMyTasks] = useState([]);
//   const [users, setUsers] = useState([]);
//   const [enabled, setEnabled] = useState(() => new Set(SOURCE_ORDER));
//   const [loading, setLoading] = useState(true);
//   const [reloadKey, setReloadKey] = useState(0);
//   const [modalOpen, setModalOpen] = useState(false);
//   const [editingTask, setEditingTask] = useState(null);
//   const [defaultDate, setDefaultDate] = useState(null);
//   const [kpiOpen, setKpiOpen] = useState(false);   // top KPI accordion — collapsed by default

//   const bump = useCallback(() => setReloadKey((k) => k + 1), []);

//   // Assignable users (once)
//   useEffect(() => { taskService.assignableUsers().then(setUsers).catch(() => {}); }, []);

//   // Calendar feed for the visible month grid
//   useEffect(() => {
//     const { from, to } = gridWindow(cursor);
//     setLoading(true);
//     calendarService.events({ from, to })
//       .then((d) => setEvents(Array.isArray(d) ? d : []))
//       .catch(() => toast.error("Could not load the calendar."))
//       .finally(() => setLoading(false));
//   }, [cursor, reloadKey]);

//   // Dashboard summary (tenant-wide, CRM_FULL) + My Tasks
//   useEffect(() => {
//     if (!subAgent) {
//       calendarService.summary().then(setSummary).catch(() => setSummary(null));
//     }
//     taskService.my().then((d) => setMyTasks(Array.isArray(d) ? d : [])).catch(() => {});
//   }, [subAgent, reloadKey]);

//   const filtered = useMemo(
//     () => events.filter((e) => enabled.has(metaKeyFor(e))),
//     [events, enabled]
//   );

//   const eventsByDay = useMemo(() => {
//     const map = new Map();
//     for (const ev of filtered) {
//       const k = eventDayKey(ev);
//       if (!k) continue;
//       if (!map.has(k)) map.set(k, []);
//       map.get(k).push(ev);
//     }
//     for (const list of map.values()) {
//       list.sort((a, b) => (a.allDay === b.allDay ? new Date(a.start) - new Date(b.start) : a.allDay ? -1 : 1));
//     }
//     return map;
//   }, [filtered]);

//   const categoryCounts = useMemo(() => {
//     const c = {};
//     for (const ev of events) { const k = metaKeyFor(ev); c[k] = (c[k] || 0) + 1; }
//     return c;
//   }, [events]);

//   const upcoming = useMemo(() => {
//     const now = Date.now();
//     return [...filtered]
//       .filter((e) => e.start && new Date(e.start).getTime() >= now - 3600_000)
//       .sort((a, b) => new Date(a.start) - new Date(b.start))
//       .slice(0, 6);
//   }, [filtered]);

//   const openNew = (date) => { setEditingTask(null); setDefaultDate(date || selectedDay); setModalOpen(true); };
//   const openEdit = async (ev) => {
//     try {
//       const task = await taskService.getById(ev.referencePublicId);
//       setEditingTask(task); setDefaultDate(null); setModalOpen(true);
//     } catch { toast.error("Could not open this task."); }
//   };
//   const completeMyTask = async (t) => {
//     try { await taskService.complete(t.publicId); toast.success("Task completed."); bump(); }
//     catch { toast.error("Could not complete the task."); }
//   };
//   const toggleSource = (key) =>
//     setEnabled((prev) => {
//       const next = new Set(prev);
//       next.has(key) ? next.delete(key) : next.add(key);
//       return next;
//     });

//   const today = new Date();
//   const tabs = [
//     { key: "month", label: "Month", icon: CalendarDays },
//     { key: "agenda", label: "Agenda", icon: ListIcon },
//     { key: "board", label: "Board", icon: LayoutGrid },
//     ...(canSeeWorkload ? [{ key: "workload", label: "Workload", icon: BarChart3 }] : []),
//   ];

//   const showRails = (view === "month" || view === "agenda");

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-slate-50 to-slate-50 p-4 md:p-6">
//       {/* Header */}
//       <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
//         <div className="flex items-center gap-2">
//           <h1 className="mr-2 flex items-center gap-2 text-xl font-bold">
//             <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
//               <CalendarDays size={18} />
//             </span>
//             <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Calendar</span>
//           </h1>
//           <button onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}
//             className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Today</button>
//           <button onClick={() => setCursor((c) => addMonths(c, -1))} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={18} /></button>
//           <button onClick={() => setCursor((c) => addMonths(c, 1))} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"><ChevronRight size={18} /></button>
//           <span className="ml-1 text-lg font-bold text-slate-700">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
//           {loading && <Loader2 size={16} className="ml-1 animate-spin text-slate-400" />}
//         </div>
//         <div className="flex items-center gap-2">
//           <div className="flex rounded-xl bg-slate-100 p-1">
//             {tabs.map((t) => (
//               <button key={t.key} onClick={() => setView(t.key)}
//                 className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${view === t.key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
//                 <t.icon size={15} />{t.label}
//               </button>
//             ))}
//           </div>
//           <button onClick={() => openNew(null)} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-md">
//             <Plus size={16} />Add Event
//           </button>
//         </div>
//       </div>

//       {/* KPI cards — collapsible accordion (collapsed by default); 2 rows of 4 when open */}
//       {summary && (
//         <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
//           <button type="button" onClick={() => setKpiOpen((o) => !o)}
//             className="flex w-full items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-white px-4 py-3 text-left transition hover:from-blue-100 hover:via-indigo-100">
//             <span className="flex items-center gap-2.5 text-sm font-bold text-slate-700">
//               <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
//                 <BarChart3 size={15} />
//               </span>
//               Today's Overview
//               {!kpiOpen && (
//                 <span className="ml-1 hidden items-center gap-2 text-[11px] font-medium text-slate-500 sm:inline-flex">
//                   · <span className="text-blue-600">{summary.todaysFollowups} follow-ups</span>
//                   · <span className="text-emerald-600">{summary.activeTrips} trips</span>
//                   · <span className="text-amber-600">{fmtMoney(summary.paymentsDueAmount)} due</span>
//                 </span>
//               )}
//             </span>
//             <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${kpiOpen ? "rotate-180" : ""}`} />
//           </button>
//           {kpiOpen && (
//             <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4 md:grid-cols-4">
//               <KpiCard icon={CalendarCheck2} color="blue" label="Today's Follow-ups" value={summary.todaysFollowups} />
//               <KpiCard icon={Briefcase} color="emerald" label="Active Trips" value={summary.activeTrips} />
//               <KpiCard icon={IndianRupee} color="amber" label="Payments Due" value={fmtMoney(summary.paymentsDueAmount)} />
//               <KpiCard icon={Plane} color="indigo" label="Flights Today" value={summary.flightsToday} />
//               <KpiCard icon={BedDouble} color="yellow" label="Hotel Check-ins" value={summary.hotelCheckinsToday} />
//               <KpiCard icon={Stamp} color="rose" label="Visa Appointments" value={summary.visaToday} />
//               <KpiCard icon={Users} color="cyan" label="New Leads" value={summary.newLeadsToday} />
//               <KpiCard icon={TrendingUp} color="green" label="Revenue this Month" value={fmtMoney(summary.revenueThisMonth)} />
//             </div>
//           )}
//         </div>
//       )}

//       {/* Body */}
//       {view === "board" ? (
//         <TaskBoard reloadKey={reloadKey} onEdit={(t) => { setEditingTask(t); setDefaultDate(null); setModalOpen(true); }} onAdd={() => openNew(null)} />
//       ) : view === "workload" && canSeeWorkload ? (
//         <WorkloadView reloadKey={reloadKey} />
//       ) : (
//         <div className="space-y-4">
//           {/* Main row — left rail + big calendar (equal-height columns) */}
//           <div className="grid grid-cols-12 items-stretch gap-4">
//             {/* Left rail */}
//             {showRails && (
//               <div className="col-span-12 flex flex-col gap-4 xl:col-span-3">
//                 <RailCard title={`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`} accent="bg-blue-500">
//                   <MiniCalendar cursor={cursor} selectedDay={selectedDay} today={today} eventsByDay={eventsByDay}
//                     onPick={(d) => { setSelectedDay(d); if (d.getMonth() !== cursor.getMonth()) setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} />
//                 </RailCard>

//                 <RailCard title="Event Categories" accent="bg-fuchsia-500">
//                   <ul className="space-y-1">
//                     {SOURCE_ORDER.map((key) => {
//                       const meta = SOURCE_META[key];
//                       const on = enabled.has(key);
//                       return (
//                         <li key={key}>
//                           <button onClick={() => toggleSource(key)}
//                             className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 ${on ? "" : "opacity-40"}`}>
//                             <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
//                               <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />{meta.label}
//                             </span>
//                             <span className="text-xs font-bold text-slate-400">{categoryCounts[key] || 0}</span>
//                           </button>
//                         </li>
//                       );
//                     })}
//                   </ul>
//                 </RailCard>

//                 {/* My Tasks fills the remaining column height so there's no dead space */}
//                 <RailCard title="My Tasks" accent="bg-emerald-500" className="flex-1" bodyClassName="flex-1 overflow-y-auto">
//                   {myTasks.length === 0 ? <p className="py-2 text-xs text-slate-400">You're all caught up 🎉</p> : (
//                     <ul className="space-y-2">
//                       {myTasks.map((t) => {
//                         const pr = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
//                         return (
//                           <li key={t.publicId} className="flex items-center gap-2">
//                             <button onClick={() => completeMyTask(t)} title="Mark complete"
//                               className="grid h-4 w-4 shrink-0 place-items-center rounded border border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500">
//                               <Check size={11} />
//                             </button>
//                             <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{t.title}</span>
//                             <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${pr.chip}`}>{pr.label}</span>
//                           </li>
//                         );
//                       })}
//                     </ul>
//                   )}
//                 </RailCard>
//               </div>
//             )}

//             {/* Calendar — now spans 9/12 and stretches to full column height */}
//             <div className={showRails ? "col-span-12 xl:col-span-9" : "col-span-12"}>
//               {view === "agenda"
//                 ? <AgendaView eventsByDay={eventsByDay} cursor={cursor} onEdit={openEdit} onAddDay={openNew} />
//                 : <MonthGrid cursor={cursor} today={today} selectedDay={selectedDay} eventsByDay={eventsByDay}
//                     onEdit={openEdit} onPickDay={(d) => setSelectedDay(d)} onAddDay={openNew} />}
//             </div>
//           </div>

//           {/* Dashboard strip — full-width, fills the bottom of the page */}
//           {showRails && summary && (
//             <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
//               <RailCard title="Today's Schedule" accent="bg-blue-500">
//                 <RailList items={summary.todaysSchedule} empty="Nothing scheduled today." />
//               </RailCard>

//               <RailCard title="Payment Due Summary" accent="bg-amber-500">
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 p-3 ring-1 ring-rose-100">
//                     <p className="text-[11px] font-semibold text-rose-500">Total Overdue</p>
//                     <p className="text-lg font-bold text-rose-700">{fmtMoney(summary.paymentDueSummary?.totalOverdue)}</p>
//                     <p className="text-[11px] text-rose-400">{summary.paymentDueSummary?.overdueCount || 0} bookings</p>
//                   </div>
//                   <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 ring-1 ring-amber-100">
//                     <p className="text-[11px] font-semibold text-amber-600">Due Today</p>
//                     <p className="text-lg font-bold text-amber-700">{fmtMoney(summary.paymentDueSummary?.dueToday)}</p>
//                     <p className="text-[11px] text-amber-500">{summary.paymentDueSummary?.dueTodayCount || 0} bookings</p>
//                   </div>
//                 </div>
//               </RailCard>

//               <RailCard title="Upcoming Events" accent="bg-violet-500">
//                 <RailList items={upcoming.map((e) => ({ ...e, subtitle: fmtDayLabel(e.start) + (e.subtitle ? " · " + e.subtitle : "") }))} empty="Nothing coming up." />
//               </RailCard>

//               <RailCard title="Trips Starting Today" accent="bg-emerald-500"><RailList items={summary.tripsStartingToday} empty="No trips starting today." /></RailCard>
//               <RailCard title="Flight Departures" accent="bg-indigo-500"><RailList items={summary.flightDepartures} empty="No departures today." /></RailCard>
//               <RailCard title="Hotel Check-ins" accent="bg-yellow-500"><RailList items={summary.hotelCheckins} empty="No check-ins today." /></RailCard>
//               <RailCard title="Visa Appointments" accent="bg-rose-500"><RailList items={summary.visaAppointments} empty="No appointments today." /></RailCard>
//             </div>
//           )}
//         </div>
//       )}

//       <AddEventModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={bump}
//         users={users} task={editingTask} defaultDate={defaultDate} />
//     </div>
//   );
// }

// /* ── Month grid ──────────────────────────────────────────────────────────────── */

// function MonthGrid({ cursor, today, selectedDay, eventsByDay, onEdit, onPickDay, onAddDay }) {
//   const weeks = monthMatrix(cursor);
//   return (
//     <div className="flex h-full min-h-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
//       <div className="grid shrink-0 grid-cols-7 border-b border-slate-100 bg-slate-50/60">
//         {WEEKDAYS.map((d) => <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{d}</div>)}
//       </div>
//       <div className="grid flex-1 grid-cols-7 auto-rows-fr">
//         {weeks.flat().map((date, i) => {
//           const inMonth = date.getMonth() === cursor.getMonth();
//           const isToday = isSameDay(date, today);
//           const isSel = isSameDay(date, selectedDay);
//           const dayEvents = eventsByDay.get(dateKey(date)) || [];
//           const shown = dayEvents.slice(0, 4);
//           const more = dayEvents.length - shown.length;
//           return (
//             <div key={i} onClick={() => { onPickDay(date); }}
//               className={`group flex min-h-[104px] cursor-pointer flex-col border-b border-r border-slate-100 p-1.5 transition ${inMonth ? "bg-white" : "bg-slate-50/50"} ${isSel ? "ring-2 ring-inset ring-blue-400" : ""} hover:bg-blue-50/40 ${i % 7 === 6 ? "border-r-0" : ""}`}>
//               <div className="mb-1 flex shrink-0 items-center justify-between">
//                 <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? "bg-blue-600 text-white" : inMonth ? "text-slate-600" : "text-slate-300"}`}>{date.getDate()}</span>
//                 <button onClick={(e) => { e.stopPropagation(); onAddDay(date); }}
//                   className="rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-blue-600"><Plus size={13} /></button>
//               </div>
//               <div className="space-y-1 overflow-hidden">
//                 {shown.map((ev) => <EventChip key={ev.id} ev={ev} onClick={onEdit} />)}
//                 {more > 0 && <div className="px-1 text-[10px] font-semibold text-slate-400">+ {more} more</div>}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// /* ── Agenda view ─────────────────────────────────────────────────────────────── */

// function AgendaView({ eventsByDay, cursor, onEdit, onAddDay }) {
//   const days = [...eventsByDay.entries()]
//     .filter(([k]) => { const d = new Date(k + "T00:00:00"); return d.getMonth() === cursor.getMonth(); })
//     .sort((a, b) => (a[0] < b[0] ? -1 : 1));
//   return (
//     <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
//       {days.length === 0 ? (
//         <p className="py-16 text-center text-sm text-slate-400">No events this month.</p>
//       ) : (
//         <div className="space-y-5">
//           {days.map(([k, list]) => (
//             <div key={k}>
//               <div className="mb-2 flex items-center gap-2">
//                 <Clock size={14} className="text-slate-300" />
//                 <h4 className="text-sm font-bold text-slate-700">{fmtDayLabel(k + "T00:00:00")}</h4>
//                 <span className="text-xs text-slate-400">· {list.length}</span>
//               </div>
//               <div className="space-y-1.5 pl-6">
//                 {list.map((ev) => <EventChip key={ev.id} ev={ev} onClick={onEdit} />)}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// /* ── Mini calendar ───────────────────────────────────────────────────────────── */

// function MiniCalendar({ cursor, selectedDay, today, eventsByDay, onPick }) {
//   const weeks = monthMatrix(cursor);
//   return (
//     <div>
//       <div className="mb-1 grid grid-cols-7">
//         {WEEKDAYS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-semibold text-slate-400">{d[0]}</div>)}
//       </div>
//       <div className="grid grid-cols-7 gap-0.5">
//         {weeks.flat().map((date, i) => {
//           const inMonth = date.getMonth() === cursor.getMonth();
//           const isToday = isSameDay(date, today);
//           const isSel = isSameDay(date, selectedDay);
//           const has = (eventsByDay.get(dateKey(date)) || []).length > 0;
//           return (
//             <button key={i} onClick={() => onPick(date)}
//               className={`relative grid h-7 place-items-center rounded-lg text-[11px] font-medium transition ${isToday ? "bg-blue-600 text-white" : isSel ? "bg-blue-100 text-blue-700" : inMonth ? "text-slate-600 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-50"}`}>
//               {date.getDate()}
//               {has && !isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-400" />}
//             </button>
//           );
//         })}
//       </div>
//     </div>
//   );
// }









// features/calendar/pages/Calendar.jsx
// Unified Task & Team Calendar — month grid + KPI cards + left/right rails + Board + Workload.
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Loader2, CalendarCheck2, Briefcase, IndianRupee, Plane,
  BedDouble, Stamp, Users, TrendingUp, LayoutGrid, List as ListIcon, CalendarDays, BarChart3,
  Check, Clock,
} from "lucide-react";
import { toast } from "@shared/ui/toast";
import { isSubAgent, isTenantAdmin, isManager } from "@shared/lib/access";
import calendarService from "../api/calendarService";
import taskService from "../api/taskService";
import AddEventModal from "../components/AddEventModal";
import TaskBoard from "../components/TaskBoard";
import {
  SOURCE_ORDER, SOURCE_META, metaFor, metaKeyFor, PRIORITY_META, MONTHS, WEEKDAYS,
  monthMatrix, gridWindow, addMonths, isSameDay, dateKey, eventDayKey, expandStayNights, fmtMoney, fmtTime, fmtDayLabel,
} from "../lib/calendarUi";

/* ── Small presentational pieces ─────────────────────────────────────────────── */

function EventChip({ ev, onClick }) {
  const meta = metaFor(ev);
  const clickable = ev.source === "TASK";
  
  return (
    <div className="group relative w-full">
      {/* The main visible calendar chip */}
      <button
        type="button"
        onClick={clickable ? (e) => { e.stopPropagation(); onClick(ev); } : undefined}
        className={`flex w-full items-center gap-1 rounded-md px-1.5 py-[3px] text-left text-[11px] font-medium ring-1 transition-colors ${meta.chip} ${clickable ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
        {!ev.allDay && ev.start && <span className="shrink-0 tabular-nums opacity-70">{fmtTime(ev.start)}</span>}
        <span className="truncate">{ev.title}</span>
        {/*
          A stay now appears on every night it spans, so without this each of them would read
          "Check-in" — telling the user a guest arrived four days running. The marker says which
          night of the stay this is; the first one is left unmarked because that one IS the arrival.
        */}
        {ev._night && !ev._night.first && (
          <span className="ml-auto shrink-0 tabular-nums text-[10px] opacity-70">
            {ev._night.index}/{ev._night.total}
          </span>
        )}
      </button>

      {/* Dynamic Colored Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-1.5 flex w-max max-w-[220px] -translate-x-1/2 flex-col items-center opacity-0 transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
        {/* Tooltip box uses ${meta.chip} to match the event color */}
        <div className={`whitespace-normal rounded-lg px-3 py-2 text-center text-xs font-bold leading-relaxed shadow-xl ring-1 ${meta.chip}`}>
          {ev.title}
          {ev._night && (
            <span className="mt-1 block text-[10px] font-medium opacity-80">
              {ev._night.first
                ? `Check-in · night 1 of ${ev._night.total}`
                : `Night ${ev._night.index} of ${ev._night.total}`}
            </span>
          )}
          {ev.subtitle && <span className="mt-1 block text-[10px] font-medium opacity-80">{ev.subtitle}</span>}
        </div>
        {/* Arrow uses border-t-current to automatically match text color */}
        <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-current opacity-80" />
      </div>
    </div>
  );
}

const KPI_PALETTE = {
  blue:    { card: "from-blue-50 to-blue-100/40 ring-blue-100",      icon: "bg-blue-600",    value: "text-blue-700" },
  emerald: { card: "from-emerald-50 to-emerald-100/40 ring-emerald-100", icon: "bg-emerald-600", value: "text-emerald-700" },
  amber:   { card: "from-amber-50 to-amber-100/40 ring-amber-100",    icon: "bg-amber-500",   value: "text-amber-700" },
  indigo:  { card: "from-indigo-50 to-indigo-100/40 ring-indigo-100", icon: "bg-indigo-600",  value: "text-indigo-700" },
  yellow:  { card: "from-yellow-50 to-yellow-100/40 ring-yellow-100", icon: "bg-yellow-500",  value: "text-yellow-700" },
  rose:    { card: "from-rose-50 to-rose-100/40 ring-rose-100",       icon: "bg-rose-600",    value: "text-rose-700" },
  cyan:    { card: "from-cyan-50 to-cyan-100/40 ring-cyan-100",       icon: "bg-cyan-600",    value: "text-cyan-700" },
  green:   { card: "from-green-50 to-green-100/40 ring-green-100",    icon: "bg-green-600",   value: "text-green-700" },
};

function KpiCard({ icon: Icon, color, label, value }) {
  const p = KPI_PALETTE[color] || KPI_PALETTE.blue;
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-br p-3.5 shadow-sm ring-1 transition hover:shadow-md ${p.card}`}>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ${p.icon}`}><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`truncate text-xl font-extrabold ${p.value}`}>{value}</p>
      </div>
    </div>
  );
}

function RailCard({ title, children, className = "", bodyClassName = "", accent = "bg-slate-300" }) {
  return (
    <div className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>
      <h4 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-bold text-slate-700">
        <span className={`h-4 w-1.5 rounded-full ${accent}`} />{title}
      </h4>
      <div className={`min-h-0 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function RailList({ items, empty }) {
  if (!items || items.length === 0) return <p className="py-2 text-xs text-slate-400">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-50">
      {items.map((ev) => {
        const meta = metaFor(ev);
        return (
          <li key={ev.id} className="flex items-start gap-2.5 py-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-700">{ev.title}</p>
              {ev.subtitle && <p className="truncate text-[11px] text-slate-400">{ev.subtitle}</p>}
            </div>
            <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-slate-400">
              {ev.amount != null ? fmtMoney(ev.amount) : !ev.allDay ? fmtTime(ev.start) : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Workload view ───────────────────────────────────────────────────────────── */

function WorkloadView({ reloadKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    taskService.workload()
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Could not load workload."))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>;
  
  const scoreOf = (r) => r.workloadScore ?? ((r.todo || 0) + (r.inProgress || 0) + (r.activeLeads || 0) + (r.openReminders || 0));
  const maxLoad = Math.max(1, ...rows.map(scoreOf));

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="mb-4 text-base font-bold text-slate-800">Team Workload</h3>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No workload yet.</p>
      ) : (
        <div className="space-y-4 sm:space-y-3">
          {rows.map((r) => {
            const leads = r.activeLeads || 0;
            const reminders = r.openReminders || 0;
            const score = scoreOf(r);
            return (
              <div key={r.assigneePublicId || "unassigned"} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-slate-50 pb-3 sm:border-none sm:pb-0">
                <div className="w-full sm:w-40 shrink-0 truncate text-sm font-semibold text-slate-700">{r.assigneeName}</div>
                <div className="flex h-6 w-full sm:flex-1 overflow-hidden rounded-lg bg-slate-100"
                     title={`Workload ${score} = ${r.todo} to-do + ${r.inProgress} in progress + ${leads} active leads + ${reminders} open reminders`}>
                  <div className="bg-slate-400" style={{ width: `${(r.todo / maxLoad) * 100}%` }} />
                  <div className="bg-blue-500" style={{ width: `${(r.inProgress / maxLoad) * 100}%` }} />
                  <div className="bg-indigo-500" style={{ width: `${(leads / maxLoad) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(reminders / maxLoad) * 100}%` }} />
                </div>
                <div className="flex w-full sm:w-72 shrink-0 flex-wrap items-center sm:justify-end gap-1.5 text-[11px] font-semibold">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white" title="Workload score">{score}</span>
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">{leads} leads</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{r.todo} to-do</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">{r.inProgress} wip</span>
                  {reminders > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{reminders} rem</span>}
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{r.done} done</span>
                  {r.overdue > 0 && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{r.overdue}!</span>}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 text-[11px] text-slate-400 border-t border-slate-100 sm:border-none">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Active Leads</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />To Do</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />In Progress</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Open Reminders</span>
            <span className="sm:ml-auto w-full sm:w-auto mt-1 sm:mt-0">New leads are auto-assigned to the lowest workload.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────────── */

export default function Calendar() {
  const subAgent = isSubAgent();
  const canSeeWorkload = isTenantAdmin() || isManager();
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [enabled, setEnabled] = useState(() => new Set(SOURCE_ORDER));
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultDate, setDefaultDate] = useState(null);
  const [kpiOpen, setKpiOpen] = useState(false);

  const bump = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => { taskService.assignableUsers().then(setUsers).catch(() => {}); }, []);

  useEffect(() => {
    const { from, to } = gridWindow(cursor);
    setLoading(true);
    calendarService.events({ from, to })
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Could not load the calendar."))
      .finally(() => setLoading(false));
  }, [cursor, reloadKey]);

  useEffect(() => {
    if (!subAgent) {
      calendarService.summary().then(setSummary).catch(() => setSummary(null));
    }
    taskService.my().then((d) => setMyTasks(Array.isArray(d) ? d : [])).catch(() => {});
  }, [subAgent, reloadKey]);

  const filtered = useMemo(
    () => events.filter((e) => enabled.has(metaKeyFor(e))),
    [events, enabled]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of filtered) {
      // A hotel stay is a SPAN, not a point: it occupies every night between check-in and
      // check-out, and the day view has to show the guest on each of them. Every other source is
      // genuinely a single moment and passes through untouched — expandStayNights returns
      // `[ev]` unless there is a real multi-night range to expand.
      const parts = ev.source === "HOTEL_CHECKIN" ? expandStayNights(ev) : [ev];
      for (const part of parts) {
        const k = eventDayKey(part);
        if (!k) continue;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(part);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.allDay === b.allDay ? new Date(a.start) - new Date(b.start) : a.allDay ? -1 : 1));
    }
    return map;
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const c = {};
    for (const ev of events) { const k = metaKeyFor(ev); c[k] = (c[k] || 0) + 1; }
    return c;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...filtered]
      .filter((e) => e.start && new Date(e.start).getTime() >= now - 3600_000)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 6);
  }, [filtered]);

  const openNew = (date) => { setEditingTask(null); setDefaultDate(date || selectedDay); setModalOpen(true); };
  const openEdit = async (ev) => {
    try {
      const task = await taskService.getById(ev.referencePublicId);
      setEditingTask(task); setDefaultDate(null); setModalOpen(true);
    } catch { toast.error("Could not open this task."); }
  };
  const completeMyTask = async (t) => {
    try { await taskService.complete(t.publicId); toast.success("Task completed."); bump(); }
    catch { toast.error("Could not complete the task."); }
  };
  const toggleSource = (key) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const today = new Date();
  const tabs = [
    { key: "month", label: "Month", icon: CalendarDays },
    { key: "agenda", label: "Agenda", icon: ListIcon },
    { key: "board", label: "Board", icon: LayoutGrid },
    ...(canSeeWorkload ? [{ key: "workload", label: "Workload", icon: BarChart3 }] : []),
  ];

  const showRails = (view === "month" || view === "agenda");

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-slate-50 to-slate-50 p-3 sm:p-4 md:p-6">
      
      {/* Header — Fully Responsive Flex-Wrap */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left Side: Title & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 flex items-center gap-2 text-xl font-bold w-full sm:w-auto mb-2 sm:mb-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              <CalendarDays size={18} />
            </span>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Calendar</span>
          </h1>
          <button onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Today</button>
          <div className="flex items-center">
            <button onClick={() => setCursor((c) => addMonths(c, -1))} className="rounded-l-lg border border-r-0 border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={18} /></button>
            <button onClick={() => setCursor((c) => addMonths(c, 1))} className="rounded-r-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"><ChevronRight size={18} /></button>
          </div>
          <span className="ml-1 text-base sm:text-lg font-bold text-slate-700 whitespace-nowrap">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
          {loading && <Loader2 size={16} className="ml-1 animate-spin text-slate-400" />}
        </div>

        {/* Right Side: Tabs & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Scrollable tabs container */}
          <div className="flex w-full overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setView(t.key)}
                className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${view === t.key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <t.icon size={15} />{t.label}
              </button>
            ))}
          </div>
          <button onClick={() => openNew(null)} className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-md">
            <Plus size={16} />Add Event
          </button>
        </div>
      </div>

      {/* KPI cards — collapsible accordion */}
      {summary && (
        <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <button type="button" onClick={() => setKpiOpen((o) => !o)}
            className="flex w-full items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-white px-4 py-3 text-left transition hover:from-blue-100 hover:via-indigo-100">
            <span className="flex items-center gap-2.5 text-sm font-bold text-slate-700">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
                <BarChart3 size={15} />
              </span>
              Today's Overview
              {!kpiOpen && (
                <span className="ml-1 hidden items-center gap-2 text-[11px] font-medium text-slate-500 md:inline-flex">
                  · <span className="text-blue-600">{summary.todaysFollowups} follow-ups</span>
                  · <span className="text-emerald-600">{summary.activeTrips} trips</span>
                  · <span className="text-amber-600">{fmtMoney(summary.paymentsDueAmount)} due</span>
                </span>
              )}
            </span>
            <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${kpiOpen ? "rotate-180" : ""}`} />
          </button>
          {kpiOpen && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={CalendarCheck2} color="blue" label="Today's Follow-ups" value={summary.todaysFollowups} />
              <KpiCard icon={Briefcase} color="emerald" label="Active Trips" value={summary.activeTrips} />
              <KpiCard icon={IndianRupee} color="amber" label="Payments Due" value={fmtMoney(summary.paymentsDueAmount)} />
              <KpiCard icon={Plane} color="indigo" label="Flights Today" value={summary.flightsToday} />
              <KpiCard icon={BedDouble} color="yellow" label="Hotel Check-ins" value={summary.hotelCheckinsToday} />
              <KpiCard icon={Stamp} color="rose" label="Visa Appointments" value={summary.visaToday} />
              <KpiCard icon={Users} color="cyan" label="New Leads" value={summary.newLeadsToday} />
              <KpiCard icon={TrendingUp} color="green" label="Revenue this Month" value={fmtMoney(summary.revenueThisMonth)} />
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {view === "board" ? (
        <TaskBoard reloadKey={reloadKey} onEdit={(t) => { setEditingTask(t); setDefaultDate(null); setModalOpen(true); }} onAdd={() => openNew(null)} />
      ) : view === "workload" && canSeeWorkload ? (
        <WorkloadView reloadKey={reloadKey} />
      ) : (
        <div className="space-y-4">
          {/* Main row — left rail + big calendar */}
          <div className="grid grid-cols-12 items-stretch gap-4">
            {/* Left rail */}
            {showRails && (
              <div className="col-span-12 flex flex-col gap-4 xl:col-span-3">
                <RailCard title={`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`} accent="bg-blue-500">
                  <MiniCalendar cursor={cursor} selectedDay={selectedDay} today={today} eventsByDay={eventsByDay}
                    onPick={(d) => { setSelectedDay(d); if (d.getMonth() !== cursor.getMonth()) setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} />
                </RailCard>

                <RailCard title="Event Categories" accent="bg-fuchsia-500">
                  <ul className="space-y-1">
                    {SOURCE_ORDER.map((key) => {
                      const meta = SOURCE_META[key];
                      const on = enabled.has(key);
                      return (
                        <li key={key}>
                          <button onClick={() => toggleSource(key)}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 ${on ? "" : "opacity-40"}`}>
                            <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />{meta.label}
                            </span>
                            <span className="text-xs font-bold text-slate-400">{categoryCounts[key] || 0}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </RailCard>

                <RailCard title="My Tasks" accent="bg-emerald-500" className="flex-1" bodyClassName="flex-1 overflow-y-auto max-h-[300px] xl:max-h-full">
                  {myTasks.length === 0 ? <p className="py-2 text-xs text-slate-400">You're all caught up 🎉</p> : (
                    <ul className="space-y-2">
                      {myTasks.map((t) => {
                        const pr = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
                        return (
                          <li key={t.publicId} className="flex items-center gap-2">
                            <button onClick={() => completeMyTask(t)} title="Mark complete"
                              className="grid h-4 w-4 shrink-0 place-items-center rounded border border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500">
                              <Check size={11} />
                            </button>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{t.title}</span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${pr.chip}`}>{pr.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </RailCard>
              </div>
            )}

            {/* Calendar Grid */}
            <div className={showRails ? "col-span-12 xl:col-span-9" : "col-span-12"}>
              {view === "agenda"
                ? <AgendaView eventsByDay={eventsByDay} cursor={cursor} onEdit={openEdit} onAddDay={openNew} />
                : <MonthGrid cursor={cursor} today={today} selectedDay={selectedDay} eventsByDay={eventsByDay}
                    onEdit={openEdit} onPickDay={(d) => setSelectedDay(d)} onAddDay={openNew} />}
            </div>
          </div>

          {/* Dashboard strip */}
          {showRails && summary && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <RailCard title="Today's Schedule" accent="bg-blue-500">
                <RailList items={summary.todaysSchedule} empty="Nothing scheduled today." />
              </RailCard>

              <RailCard title="Payment Due Summary" accent="bg-amber-500">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 p-3 ring-1 ring-rose-100">
                    <p className="text-[11px] font-semibold text-rose-500">Total Overdue</p>
                    <p className="text-[15px] sm:text-lg font-bold text-rose-700 truncate">{fmtMoney(summary.paymentDueSummary?.totalOverdue)}</p>
                    <p className="text-[11px] text-rose-400">{summary.paymentDueSummary?.overdueCount || 0} bookings</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 ring-1 ring-amber-100">
                    <p className="text-[11px] font-semibold text-amber-600">Due Today</p>
                    <p className="text-[15px] sm:text-lg font-bold text-amber-700 truncate">{fmtMoney(summary.paymentDueSummary?.dueToday)}</p>
                    <p className="text-[11px] text-amber-500">{summary.paymentDueSummary?.dueTodayCount || 0} bookings</p>
                  </div>
                </div>
              </RailCard>

              <RailCard title="Upcoming Events" accent="bg-violet-500">
                <RailList items={upcoming.map((e) => ({ ...e, subtitle: fmtDayLabel(e.start) + (e.subtitle ? " · " + e.subtitle : "") }))} empty="Nothing coming up." />
              </RailCard>

              <RailCard title="Trips Starting Today" accent="bg-emerald-500"><RailList items={summary.tripsStartingToday} empty="No trips starting today." /></RailCard>
              <RailCard title="Flight Departures" accent="bg-indigo-500"><RailList items={summary.flightDepartures} empty="No departures today." /></RailCard>
              <RailCard title="Hotel Check-ins" accent="bg-yellow-500"><RailList items={summary.hotelCheckins} empty="No check-ins today." /></RailCard>
              <RailCard title="Visa Appointments" accent="bg-rose-500"><RailList items={summary.visaAppointments} empty="No appointments today." /></RailCard>
            </div>
          )}
        </div>
      )}

      <AddEventModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={bump}
        users={users} task={editingTask} defaultDate={defaultDate} />
    </div>
  );
}

/* ── Month grid ──────────────────────────────────────────────────────────────── */

function MonthGrid({ cursor, today, selectedDay, eventsByDay, onEdit, onPickDay, onAddDay }) {
  const weeks = monthMatrix(cursor);
  return (
    <div className="relative flex h-full min-h-[640px] flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      {/* Horizontal Scroll wrapper for mobile */}
      <div className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Force minimum width so it doesn't crush the 7 columns */}
        <div className="flex h-full min-w-[700px] flex-col">
          
          <div className="grid shrink-0 grid-cols-7 border-b border-slate-100 bg-slate-50/60">
            {WEEKDAYS.map((d) => <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{d}</div>)}
          </div>
          
          <div className="grid flex-1 grid-cols-7 auto-rows-fr">
            {weeks.flat().map((date, i) => {
              const inMonth = date.getMonth() === cursor.getMonth();
              const isToday = isSameDay(date, today);
              const isSel = isSameDay(date, selectedDay);
              const dayEvents = eventsByDay.get(dateKey(date)) || [];
              const shown = dayEvents.slice(0, 4);
              const more = dayEvents.length - shown.length;
              return (
                <div key={i} onClick={() => { onPickDay(date); }}
                  className={`group/day flex min-h-[104px] cursor-pointer flex-col border-b border-r border-slate-100 p-1.5 transition ${inMonth ? "bg-white" : "bg-slate-50/50"} ${isSel ? "ring-2 ring-inset ring-blue-400" : ""} hover:bg-blue-50/40 ${i % 7 === 6 ? "border-r-0" : ""}`}>
                  <div className="mb-1 flex shrink-0 items-center justify-between">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? "bg-blue-600 text-white" : inMonth ? "text-slate-600" : "text-slate-300"}`}>{date.getDate()}</span>
                    <button onClick={(e) => { e.stopPropagation(); onAddDay(date); }}
                      className="rounded p-0.5 text-slate-300 opacity-0 transition lg:group-hover/day:opacity-100 hover:bg-slate-100 hover:text-blue-600"><Plus size={13} /></button>
                  </div>
                  {/* Removed overflow-hidden so the tooltip can escape */}
                  <div className="space-y-1 relative">
                    {shown.map((ev) => <EventChip key={ev.id} ev={ev} onClick={onEdit} />)}
                    {more > 0 && <div className="px-1 text-[10px] font-semibold text-slate-400">+ {more} more</div>}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Agenda view ─────────────────────────────────────────────────────────────── */

function AgendaView({ eventsByDay, cursor, onEdit, onAddDay }) {
  const days = [...eventsByDay.entries()]
    .filter(([k]) => { const d = new Date(k + "T00:00:00"); return d.getMonth() === cursor.getMonth(); })
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-200">
      {days.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No events this month.</p>
      ) : (
        <div className="space-y-5">
          {days.map(([k, list]) => (
            <div key={k}>
              <div className="mb-2 flex items-center gap-2">
                <Clock size={14} className="text-slate-300" />
                <h4 className="text-sm font-bold text-slate-700">{fmtDayLabel(k + "T00:00:00")}</h4>
                <span className="text-xs text-slate-400">· {list.length}</span>
              </div>
              <div className="space-y-1.5 pl-6">
                {list.map((ev) => <EventChip key={ev.id} ev={ev} onClick={onEdit} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mini calendar ───────────────────────────────────────────────────────────── */

function MiniCalendar({ cursor, selectedDay, today, eventsByDay, onPick }) {
  const weeks = monthMatrix(cursor);
  return (
    <div>
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-semibold text-slate-400">{d[0]}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.flat().map((date, i) => {
          const inMonth = date.getMonth() === cursor.getMonth();
          const isToday = isSameDay(date, today);
          const isSel = isSameDay(date, selectedDay);
          const has = (eventsByDay.get(dateKey(date)) || []).length > 0;
          return (
            <button key={i} onClick={() => onPick(date)}
              className={`relative grid h-7 lg:h-8 place-items-center rounded-lg text-[11px] font-medium transition ${isToday ? "bg-blue-600 text-white" : isSel ? "bg-blue-100 text-blue-700" : inMonth ? "text-slate-600 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-50"}`}>
              {date.getDate()}
              {has && !isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}