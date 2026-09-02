// // features/calendar/components/AddEventModal.jsx
// // Create / edit a Task (which doubles as a calendar event). Used by the "Add Event" button and by
// // clicking an editable event on the calendar.
// import { useEffect, useState } from "react";
// import { X, Loader2 } from "lucide-react";
// import { toast } from "@shared/ui/toast";
// import taskService from "../api/taskService";
// import {
//   TASK_CATEGORIES, CATEGORY_LABEL, TASK_PRIORITIES, PRIORITY_META,
//   TASK_STATUSES, TASK_STATUS_LABEL, toLocalInput, fromLocalInput,
// } from "../lib/calendarUi";

// const blank = {
//   title: "", description: "", category: "MEETING", priority: "MEDIUM", status: "TODO",
//   assignToPublicId: "", allDay: false, startAt: "", endAt: "", dueDate: "", location: "",
// };

// function initialForm(task, defaultDate) {
//   if (task) {
//     return {
//       title: task.title || "",
//       description: task.description || "",
//       category: task.category || "GENERAL",
//       priority: task.priority || "MEDIUM",
//       status: task.status || "TODO",
//       assignToPublicId: task.assignToPublicId || "",
//       allDay: !!task.allDay,
//       startAt: toLocalInput(task.startAt),
//       endAt: toLocalInput(task.endAt),
//       dueDate: toLocalInput(task.dueDate),
//       location: task.location || "",
//     };
//   }
//   const start = defaultDate ? new Date(defaultDate) : new Date();
//   if (defaultDate) start.setHours(9, 0, 0, 0);
//   return { ...blank, startAt: toLocalInput(start.toISOString()) };
// }

// export default function AddEventModal({ open, onClose, onSaved, users = [], task = null, defaultDate = null }) {
//   const [form, setForm] = useState(blank);
//   const [saving, setSaving] = useState(false);
//   const isEdit = !!task;

//   useEffect(() => {
//     if (open) setForm(initialForm(task, defaultDate));
//   }, [open, task, defaultDate]);

//   if (!open) return null;

//   const set = (k) => (e) => {
//     const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
//     setForm((f) => ({ ...f, [k]: v }));
//   };

//   const submit = async (e) => {
//     e.preventDefault();
//     if (!form.title.trim()) {
//       toast.error("Title is required.");
//       return;
//     }
//     const payload = {
//       title: form.title.trim(),
//       description: form.description.trim() || null,
//       category: form.category,
//       priority: form.priority,
//       status: form.status,
//       assignToPublicId: form.assignToPublicId || null,
//       allDay: form.allDay,
//       startAt: fromLocalInput(form.startAt),
//       endAt: fromLocalInput(form.endAt),
//       dueDate: fromLocalInput(form.dueDate),
//       location: form.location.trim() || null,
//     };
//     setSaving(true);
//     try {
//       if (isEdit) {
//         await taskService.update(task.publicId, payload);
//         toast.success("Event updated.");
//       } else {
//         await taskService.create(payload);
//         toast.success("Event created.");
//       }
//       onSaved?.();
//       onClose?.();
//     } catch (err) {
//       toast.error(err?.response?.data?.message || "Could not save the event.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const remove = async () => {
//     if (!isEdit || !window.confirm("Delete this task/event?")) return;
//     setSaving(true);
//     try {
//       await taskService.remove(task.publicId);
//       toast.success("Deleted.");
//       onSaved?.();
//       onClose?.();
//     } catch (err) {
//       toast.error(err?.response?.data?.message || "Could not delete.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
//   const lbl = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

//   return (
//     <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
//       <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
//         <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
//           <h3 className="text-lg font-bold text-slate-800">{isEdit ? "Edit Event" : "Add Event"}</h3>
//           <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
//             <X size={18} />
//           </button>
//         </div>

//         <form onSubmit={submit} className="space-y-4 px-6 py-5">
//           <div>
//             <label className={lbl}>Title *</label>
//             <input className={field} value={form.title} onChange={set("title")} placeholder="e.g. Team standup / Follow up with Amit" autoFocus />
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className={lbl}>Category</label>
//               <select className={field} value={form.category} onChange={set("category")}>
//                 {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className={lbl}>Priority</label>
//               <select className={field} value={form.priority} onChange={set("priority")}>
//                 {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
//               </select>
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className={lbl}>Assign to</label>
//               <select className={field} value={form.assignToPublicId} onChange={set("assignToPublicId")}>
//                 <option value="">Unassigned</option>
//                 {users.map((u) => <option key={u.publicId} value={u.publicId}>{u.fullName || u.name || u.email}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className={lbl}>Status</label>
//               <select className={field} value={form.status} onChange={set("status")}>
//                 {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
//               </select>
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className={lbl}>Start</label>
//               <input type="datetime-local" className={field} value={form.startAt} onChange={set("startAt")} />
//             </div>
//             <div>
//               <label className={lbl}>End</label>
//               <input type="datetime-local" className={field} value={form.endAt} onChange={set("endAt")} />
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className={lbl}>Due date</label>
//               <input type="datetime-local" className={field} value={form.dueDate} onChange={set("dueDate")} />
//             </div>
//             <div className="flex items-end pb-2">
//               <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
//                 <input type="checkbox" checked={form.allDay} onChange={set("allDay")} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
//                 All day
//               </label>
//             </div>
//           </div>

//           <div>
//             <label className={lbl}>Location</label>
//             <input className={field} value={form.location} onChange={set("location")} placeholder="e.g. Meeting room / Zoom" />
//           </div>

//           <div>
//             <label className={lbl}>Notes</label>
//             <textarea rows={2} className={field} value={form.description} onChange={set("description")} placeholder="Optional details…" />
//           </div>

//           <div className="flex items-center justify-between pt-1">
//             {isEdit ? (
//               <button type="button" onClick={remove} disabled={saving} className="text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">
//                 Delete
//               </button>
//             ) : <span />}
//             <div className="flex gap-2">
//               <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
//               <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
//                 {saving && <Loader2 size={15} className="animate-spin" />}
//                 {isEdit ? "Save changes" : "Create event"}
//               </button>
//             </div>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }








// features/calendar/components/AddEventModal.jsx
// Create / edit a Task (which doubles as a calendar event). Used by the "Add Event" button and by
// clicking an editable event on the calendar.
//
// This modal is the ONLY surface in the product that creates, edits or deletes a task, so anything
// a task can carry has to be reachable from here — both of its references (trip and lead), and both
// of its calendar anchors. Anything it omits is unreachable, not merely inconvenient.
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Search, UserRound, AlertCircle, AlertTriangle, Lock } from "lucide-react";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";
import { isAlreadyReported } from "@shared/api/apiError";
import { leadService } from "@features/leads";
import taskService from "../api/taskService";
import TripPicker, { tripLabel } from "./TripPicker";
import {
  TASK_CATEGORIES, CATEGORY_LABEL, TASK_PRIORITIES, PRIORITY_META,
  TASK_STATUSES, TASK_STATUS_LABEL, toLocalInput, fromLocalInput,
} from "../lib/calendarUi";

const blank = {
  title: "", description: "", category: "MEETING", priority: "MEDIUM", status: "TODO",
  assignToPublicId: "", allDay: false, startAt: "", endAt: "", dueDate: "", location: "",
  // Trip link. `bookingLabel` is display-only and never posted — it exists so the chip can render
  // without re-fetching the booking the task already carries a snapshot of.
  bookingPublicId: "", bookingLabel: "",
  // Lead link — same deal, `leadLabel` is display-only.
  leadPublicId: "", leadLabel: "",
};

/** "Amit Sharma · LD-1042" — what the task row will show once linked. */
function leadLabel(name, code) {
  return [name, code].filter(Boolean).join(" · ");
}

function initialForm(task, defaultDate) {
  if (task) {
    return {
      title: task.title || "",
      description: task.description || "",
      category: task.category || "GENERAL",
      priority: task.priority || "MEDIUM",
      status: task.status || "TODO",
      assignToPublicId: task.assignToPublicId || "",
      allDay: !!task.allDay,
      startAt: toLocalInput(task.startAt),
      endAt: toLocalInput(task.endAt),
      dueDate: toLocalInput(task.dueDate),
      location: task.location || "",
      // TaskResponse already carries the snapshots, so editing a linked task shows the chip with
      // no extra request.
      bookingPublicId: task.bookingPublicId || "",
      bookingLabel: tripLabel(task.bookingCode, task.customerName),
      leadPublicId: task.leadPublicId || "",
      leadLabel: task.leadName || "",
    };
  }
  const start = defaultDate ? new Date(defaultDate) : new Date();
  if (defaultDate) start.setHours(9, 0, 0, 0);
  return { ...blank, startAt: toLocalInput(start.toISOString()) };
}

/* ── Lead picker ──────────────────────────────────────────────────────────────────────────────
   The lead half of the question TripPicker asks, and the only route to leadPublicId — the backend
   has accepted it since the task module shipped and nothing in the UI ever sent it.
   It matters most to exactly the users TripPicker hides itself from: without BOOKING_READ a trip
   can never be linked, and TaskServiceImpl.applyReferences falls back to the LEAD's customer name
   and source when a task has no booking, so this is their only way to fill the grid's Guest and
   Trip Source columns instead of reading "—" forever.

   It lives here rather than beside TripPicker because it is that control with a different data
   source and this modal is its only caller.
   ───────────────────────────────────────────────────────────────────────────────────────────── */
const LEAD_RESULTS = 8;
const LEAD_DEBOUNCE_MS = 300;
const LEAD_MIN_CHARS = 2;

function LeadPicker({ value, label, onChange, disabled = false, allowClear = true }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // Re-picking over an existing link: the chip replaces the search box, so changing a lead needs a
  // way back to it that does not go through clearing — which is what `allowClear` may forbid.
  const [changing, setChanging] = useState(false);

  // Only the newest request may render — same newest-wins guard as TripPicker.
  const reqId = useRef(0);

  const fetchLeads = useCallback(async (term) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      // Below MIN_CHARS this is the plain first page, i.e. the most recent leads — the same
      // "show me something before I type" behaviour the trip picker has.
      const res = await leadService.listLeads({
        size: LEAD_RESULTS,
        q: term.length >= LEAD_MIN_CHARS ? term : undefined,
      });
      if (id !== reqId.current) return;
      setResults(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      if (id !== reqId.current) return;
      // A picker that can't load must not block task creation, and the interceptor already
      // surfaced anything actionable (a 403 here just means no LEAD_READ).
      if (!isAlreadyReported(err)) console.warn("Lead search failed", err);
      setResults([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  const searching = !value || changing;

  useEffect(() => {
    if (!open || !searching) return;
    const t = setTimeout(() => fetchLeads(query.trim()), LEAD_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, open, searching, fetchLeads]);

  const select = (l) => {
    onChange(l.publicId || l.id, leadLabel(l.customerName, l.leadCode));
    setQuery("");
    setResults([]);
    setOpen(false);
    setChanging(false);
  };

  const clear = () => {
    onChange("", "");
    setQuery("");
    setOpen(false);
  };

  const field =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

  // ── Linked: a chip, like the trip one. Violet is the lead colour everywhere else in the app
  //    (the bell's LEAD dot), so the two chips are told apart at a glance.
  if (value && !changing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound size={15} className="shrink-0 text-violet-600" />
          <span className="truncate text-sm font-semibold text-slate-700">
            {label || "Linked lead"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => { setChanging(true); setOpen(true); }}
            disabled={disabled}
            className="rounded-lg px-2 py-1 text-[11px] font-bold text-violet-700 transition-colors hover:bg-white disabled:opacity-50"
          >
            Change
          </button>
          {allowClear && (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              title="Remove lead link"
              aria-label="Remove lead link"
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-rose-600 disabled:opacity-50"
            >
              <X size={15} />
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className={`${field} pl-9`}
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Search lead name, phone or code… (optional)"
        aria-label="Link to lead"
        autoComplete="off"
      />
      {loading && (
        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
      )}

      {changing && (
        <button
          type="button"
          onClick={() => { setChanging(false); setQuery(""); setOpen(false); }}
          className="mt-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
        >
          Keep the current lead
        </button>
      )}

      {open && (
        // preventDefault on mousedown keeps the input from blurring before the click lands —
        // without it the list closes and the selection never fires.
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {!loading && results.length === 0 && (
            <p className="px-3 py-3 text-xs font-medium text-slate-400">
              {query.trim().length >= LEAD_MIN_CHARS ? "No leads match." : "Start typing to search leads."}
            </p>
          )}
          {results.map((l) => (
            <button
              key={l.publicId || l.id}
              type="button"
              onClick={() => select(l)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-violet-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-700">
                  {l.customerName || "Unnamed lead"}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {l.leadCode || "—"}
                  {l.phone ? ` · ${l.phone}` : ""}
                </span>
              </span>
              {l.leadStage && (
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">{l.leadStage}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddEventModal({ open, onClose, onSaved, users = [], task = null, defaultDate = null }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState({});
  const isEdit = !!task;

  // Write gating. The backend @PreAuthorize is the real gate; this only stops a TASK_READ-only user
  // filling in the whole form to earn a 403 on Create. Read-only rather than hidden, because the
  // modal is also how anyone reads a task's detail — hiding it would take that away too.
  const canSave = hasPermission(isEdit ? P.TASK_UPDATE : P.TASK_CREATE);
  const canDelete = hasPermission(P.TASK_DELETE);
  const readOnly = !canSave;

  // Hidden rather than disabled without BOOKING_READ: the picker's only data source is the booking
  // search, so for those users it could never show anything but a 403 toast. Same rule for leads.
  const canLinkTrip = hasPermission(P.BOOKING_READ);
  const canLinkLead = hasPermission(P.LEAD_READ);

  // A lead link that is already SAVED cannot be removed: UpdateTaskRequest carries clearBookingLink
  // but has no lead equivalent, so a null leadPublicId reads as "unchanged" server-side. Offering an
  // X there would look like it worked and change nothing. Re-linking to a different lead does work.
  const canUnlinkLead = !(isEdit && task.leadPublicId);

  const panelRef = useRef(null);
  const openerRef = useRef(null);
  // What the form looked like when it opened — the dirty check a close is confirmed against.
  const pristineRef = useRef(blank);
  // The Escape listener is registered once per open and would otherwise close over a permanently
  // stale `saving` / `form`. Reading through refs keeps the guard honest without re-registering it
  // on every keystroke. (Same fix as QuickCityModal.)
  const savingRef = useRef(false);
  savingRef.current = saving;
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (!open) return;
    const next = initialForm(task, defaultDate);
    setForm(next);
    pristineRef.current = next;
    setErrs({});
  }, [open, task, defaultDate]);

  /* Every close path goes through here: X, Cancel, Escape and the backdrop. Discarding typing
     without asking is the one thing a dismissible dialog must not do, and window.confirm is what
     the app already uses for that (Mailbox's "Discard this draft?"). */
  const requestClose = useCallback(() => {
    if (savingRef.current) return;   // a save in flight owns the modal until it settles
    const dirty = JSON.stringify(formRef.current) !== JSON.stringify(pristineRef.current);
    if (dirty && !window.confirm("Discard your changes to this event?")) return;
    onClose?.();
  }, [onClose]);

  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  /* Dialog behaviour — Escape, focus containment, focus return, scroll lock. Written out rather
     than borrowed from marketplaceUi's <Modal/>, which does the same thing: UI kits are
     feature-local and calendar has none.

     Deps are [open] alone ON PURPOSE. The parent passes an inline arrow as onClose, so a
     requestClose dep would re-run this on every Calendar render — and the cleanup returns focus to
     the opener, which would yank the caret out of the form mid-edit. */
  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The title input carries autoFocus and has already claimed focus by now; this only pulls it in
    // when nothing did (a read-only modal has no enabled field to land on), because a dialog nobody
    // is focused inside is one Tab lands behind.
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll(
          "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      // Focus can also be sitting OUTSIDE the panel (a click that landed on nothing focusable), and
      // then neither edge below matches and Tab walks straight into the page behind — the exact
      // hole this trap exists to close.
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open]);

  if (!open) return null;

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    // Editing a field clears its own error; start and end share one, so moving either clears it.
    setErrs((p) => ({ ...p, [k]: "", ...(k === "startAt" ? { endAt: "" } : null) }));
  };

  // A task with neither anchor is board-only: the calendar plots startAt (or dueDate when startAt
  // is null) and four of the five All Tasks tabs are date windows, so it drops out of both.
  const noAnchor = !form.startAt && !form.dueDate;
  // Not an error — logging something you were meant to do last week is ordinary — but it is also
  // how a mistyped year hides a task in the Overdue tab on the day it is created.
  const dueInPast = !!form.dueDate && new Date(form.dueDate).getTime() < Date.now();

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (form.startAt && form.endAt && new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) {
      e.endAt = "End must be after the start.";
    }
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (readOnly) return;              // belt and braces — the Save button is not rendered either
    const e = validate();
    if (Object.keys(e).length) {
      setErrs(e);
      toast.error(e.title || e.endAt);
      return;
    }
    // Saving a board-only task is legitimate (the backend documents it), so this asks rather than
    // blocks — it just must not happen by accident, which is what an unanswered date field is.
    if (noAnchor && !window.confirm(
      "This event has no start time and no due date, so it will only show on the task board — "
      + "not on the calendar, and not in the Today, Overdue or Upcoming tabs.\n\nSave it anyway?",
    )) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priority: form.priority,
      status: form.status,
      assignToPublicId: form.assignToPublicId || null,
      allDay: form.allDay,
      startAt: fromLocalInput(form.startAt),
      endAt: fromLocalInput(form.endAt),
      dueDate: fromLocalInput(form.dueDate),
      location: form.location.trim() || null,
      // The backend resolves this within the tenant and snapshots bookingCode / guest / trip source
      // onto the row — that is what fills the For, Guest and Trip Source columns on All Tasks.
      bookingPublicId: form.bookingPublicId || null,
    };
    // The lead route to the same columns: guest name from the lead, Trip Source from its source.
    //
    // Sent ONLY when the user actually (re)linked it — unlike bookingPublicId, re-sending an
    // unchanged value here is NOT inert. applyReferences re-resolves a non-null leadPublicId through
    // leadAccessGuard.requireVisible(..., "LEAD_READ"), and ScopeResolver hands back the role default
    // (OWN for TRAVEL_AGENT/STAFF/SUB_AGENT, TEAM for MANAGER) whether or not the caller holds the
    // permission at all. A task can be yours while its lead is a colleague's, so echoing the link back
    // untouched would 404 "Lead not found" and reject the whole save for everyone below Scope.ALL.
    // On create, task is null, so a freshly picked lead still goes through.
    if (form.leadPublicId && form.leadPublicId !== (task?.leadPublicId || "")) {
      payload.leadPublicId = form.leadPublicId;
    }
    // A null bookingPublicId means "unchanged" on a partial update, never "clear" — so removing an
    // existing link needs the explicit flag, or the chip's X would silently do nothing.
    if (isEdit && task.bookingPublicId && !form.bookingPublicId) {
      payload.clearBookingLink = true;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await taskService.update(task.publicId, payload);
        toast.success("Event updated.");
      } else {
        await taskService.create(payload);
        toast.success("Event created.");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save the event.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit || !canDelete) return;
    if (!window.confirm("Delete this task/event?")) return;
    setSaving(true);
    try {
      await taskService.remove(task.publicId);
      toast.success("Deleted.");
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete.");
    } finally {
      setSaving(false);
    }
  };

  // The invalid variant SWAPS the border class rather than appending one: two border-colour
  // utilities on the same element resolve by stylesheet order, not by the order they are written
  // here, so appending would leave the colour to chance.
  const fieldBase = "w-full rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const field = `${fieldBase} border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100`;
  const fieldBad = `${fieldBase} border border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-50`;
  const lbl = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const errLine = "mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600";
  const warnLine = "mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-4 backdrop-blur-sm"
      // Backdrop close, same idiom as the lead log modals: only a click that landed on the overlay
      // itself counts, never one that bubbled out of the form.
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-title"
        tabIndex={-1}
        className="my-4 sm:my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 shrink-0 focus:outline-none"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4">
          <h3 id="add-event-title" className="text-lg font-bold text-slate-800">{isEdit ? "Edit Event" : "Add Event"}</h3>
          <button type="button" onClick={requestClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {readOnly && (
          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 sm:px-6 py-3">
            <Lock size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] font-semibold leading-relaxed text-amber-700">
              {isEdit
                ? "Read-only — you do not have the Task Update permission, so this event can be viewed but not changed."
                : "Read-only — you do not have the Task Create permission, so this form cannot be saved."}
              {" "}Ask a tenant admin to grant it under Users → permissions.
            </p>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={submit} className="space-y-4 px-4 sm:px-6 py-4 sm:py-5">
          <div>
            <label className={lbl}>Title *</label>
            <input className={errs.title ? fieldBad : field} value={form.title} onChange={set("title")} disabled={readOnly} placeholder="e.g. Team standup / Follow up with Amit" autoFocus />
            {errs.title && <p className={errLine}><AlertCircle size={12} className="shrink-0" />{errs.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Category</label>
              <select className={field} value={form.category} onChange={set("category")} disabled={readOnly}>
                {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <select className={field} value={form.priority} onChange={set("priority")} disabled={readOnly}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Assign to</label>
              <select className={field} value={form.assignToPublicId} onChange={set("assignToPublicId")} disabled={readOnly}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.publicId} value={u.publicId}>{u.fullName || u.name || u.email}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={field} value={form.status} onChange={set("status")} disabled={readOnly}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Start</label>
              <input type="datetime-local" className={field} value={form.startAt} onChange={set("startAt")} disabled={readOnly} />
            </div>
            <div>
              <label className={lbl}>End</label>
              <input type="datetime-local" className={errs.endAt ? fieldBad : field} value={form.endAt} onChange={set("endAt")} disabled={readOnly} />
              {errs.endAt && <p className={errLine}><AlertCircle size={12} className="shrink-0" />{errs.endAt}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Due date</label>
              <input type="datetime-local" className={field} value={form.dueDate} onChange={set("dueDate")} disabled={readOnly} />
              {dueInPast && <p className={warnLine}><AlertTriangle size={12} className="shrink-0" />This due date has already passed — it opens overdue.</p>}
            </div>
            <div className="flex items-end pt-1 sm:pt-0 sm:pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                <input type="checkbox" checked={form.allDay} onChange={set("allDay")} disabled={readOnly} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed" />
                All day
              </label>
            </div>
          </div>

          {noAnchor && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-[11px] font-semibold leading-relaxed text-amber-700">
                No start time and no due date: this event will only appear on the task board — not on the
                calendar, and not in the Today, Overdue or Upcoming tabs. Set either one to make it findable.
              </p>
            </div>
          )}

          <div>
            <label className={lbl}>Location</label>
            <input className={field} value={form.location} onChange={set("location")} disabled={readOnly} placeholder="e.g. Meeting room / Zoom" />
          </div>

          {canLinkTrip && (
            <div>
              <label className={lbl}>Link to trip</label>
              <TripPicker
                value={form.bookingPublicId}
                label={form.bookingLabel}
                disabled={saving || readOnly}
                onChange={(bookingPublicId, bookingLabel) =>
                  setForm((f) => ({ ...f, bookingPublicId, bookingLabel }))
                }
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Fills Trip Source, Guest and Trip# on the All Tasks screen.
              </p>
            </div>
          )}

          {canLinkLead && (
            <div>
              <label className={lbl}>Link to lead</label>
              <LeadPicker
                value={form.leadPublicId}
                label={form.leadLabel}
                disabled={saving || readOnly}
                allowClear={canUnlinkLead}
                onChange={(leadPublicId, nextLabel) =>
                  setForm((f) => ({ ...f, leadPublicId, leadLabel: nextLabel }))
                }
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Fills Guest and Trip Source when there is no trip — the only way to fill them without
                booking access.{!canUnlinkLead && " A saved lead link can be changed, but not removed."}
              </p>
            </div>
          )}

          <div>
            <label className={lbl}>Notes</label>
            <textarea rows={2} className={field} value={form.description} onChange={set("description")} disabled={readOnly} placeholder="Optional details…" />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-3 sm:pt-1">
            {isEdit && canDelete ? (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="w-full sm:w-auto text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50 py-2 sm:py-0 border border-rose-100 sm:border-transparent rounded-xl sm:rounded-none bg-rose-50 sm:bg-transparent transition-colors"
              >
                Delete
              </button>
            ) : <span className="hidden sm:block" />}

            <div className="flex flex-col-reverse sm:flex-row w-full sm:w-auto gap-2 sm:gap-3">
              <button
                type="button"
                onClick={requestClose}
                className="w-full sm:w-auto rounded-xl px-4 py-2.5 sm:py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 sm:border-transparent transition-colors"
              >
                {readOnly ? "Close" : "Cancel"}
              </button>
              {/* No Save at all without the permission — a disabled button invites a fight with the
                  form; the banner above says why it is gone. */}
              {!readOnly && (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 sm:py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {isEdit ? "Save changes" : "Create event"}
                </button>
              )}
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}