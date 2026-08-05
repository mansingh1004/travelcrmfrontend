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
import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "@shared/ui/toast";
import { hasPermission, P } from "@shared/lib/access";
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
};

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
    };
  }
  const start = defaultDate ? new Date(defaultDate) : new Date();
  if (defaultDate) start.setHours(9, 0, 0, 0);
  return { ...blank, startAt: toLocalInput(start.toISOString()) };
}

export default function AddEventModal({ open, onClose, onSaved, users = [], task = null, defaultDate = null }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const isEdit = !!task;

  // Hidden rather than disabled without BOOKING_READ: the picker's only data source is the booking
  // search, so for those users it could never show anything but a 403 toast.
  const canLinkTrip = hasPermission(P.BOOKING_READ);

  useEffect(() => {
    if (open) setForm(initialForm(task, defaultDate));
  }, [open, task, defaultDate]);

  if (!open) return null;

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
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
    if (!isEdit || !window.confirm("Delete this task/event?")) return;
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

  const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors";
  const lbl = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-4 backdrop-blur-sm">
      <div className="my-4 sm:my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 shrink-0">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4">
          <h3 className="text-lg font-bold text-slate-800">{isEdit ? "Edit Event" : "Add Event"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="space-y-4 px-4 sm:px-6 py-4 sm:py-5">
          <div>
            <label className={lbl}>Title *</label>
            <input className={field} value={form.title} onChange={set("title")} placeholder="e.g. Team standup / Follow up with Amit" autoFocus />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Category</label>
              <select className={field} value={form.category} onChange={set("category")}>
                {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <select className={field} value={form.priority} onChange={set("priority")}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Assign to</label>
              <select className={field} value={form.assignToPublicId} onChange={set("assignToPublicId")}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.publicId} value={u.publicId}>{u.fullName || u.name || u.email}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={field} value={form.status} onChange={set("status")}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Start</label>
              <input type="datetime-local" className={field} value={form.startAt} onChange={set("startAt")} />
            </div>
            <div>
              <label className={lbl}>End</label>
              <input type="datetime-local" className={field} value={form.endAt} onChange={set("endAt")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lbl}>Due date</label>
              <input type="datetime-local" className={field} value={form.dueDate} onChange={set("dueDate")} />
            </div>
            <div className="flex items-end pt-1 sm:pt-0 sm:pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                <input type="checkbox" checked={form.allDay} onChange={set("allDay")} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                All day
              </label>
            </div>
          </div>

          <div>
            <label className={lbl}>Location</label>
            <input className={field} value={form.location} onChange={set("location")} placeholder="e.g. Meeting room / Zoom" />
          </div>

          {canLinkTrip && (
            <div>
              <label className={lbl}>Link to trip</label>
              <TripPicker
                value={form.bookingPublicId}
                label={form.bookingLabel}
                disabled={saving}
                onChange={(bookingPublicId, bookingLabel) =>
                  setForm((f) => ({ ...f, bookingPublicId, bookingLabel }))
                }
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Fills Trip Source, Guest and Trip# on the All Tasks screen.
              </p>
            </div>
          )}

          <div>
            <label className={lbl}>Notes</label>
            <textarea rows={2} className={field} value={form.description} onChange={set("description")} placeholder="Optional details…" />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-3 sm:pt-1">
            {isEdit ? (
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
                onClick={onClose} 
                className="w-full sm:w-auto rounded-xl px-4 py-2.5 sm:py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 sm:border-transparent transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 sm:py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {isEdit ? "Save changes" : "Create event"}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}