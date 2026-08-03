

// ─────────────────────────────────────────────────────────────────────────────
// OLD — replaced in Create Customer redesign. Kept verbatim for review/rollback.
//
// This component is rendered by BOTH Createcustomer.jsx and EditCustomer.jsx, which is why the
// redesign happens here: rewriting it once gives Create and Edit the identical UI, as asked.
//
// What was wrong: a 72px saturated gradient header with an emoji glyph for an icon, chip rows
// duplicating the <select> directly above them, labels with no htmlFor, and (in
// CustomerInformation) a phone "search" that awaited a 900ms setTimeout and did nothing.
// ─────────────────────────────────────────────────────────────────────────────

// import { StickyNote as FaRegStickyNote } from "lucide-react";
//
// export default function CustomerNotes({ register }) {
//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-4 flex items-center gap-3">
//         <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">📝</div>
//         <div>
//           <h2 className="text-white font-extrabold text-base">Preferences & Notes</h2>
//           <p className="text-amber-100 text-xs">Travel preferences, special requirements & agent notes</p>
//         </div>
//       </div>
//
//       <div className="p-6">
//         <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
//           <FaRegStickyNote className="w-3 h-3 text-amber-400" />
//           Travel Preferences & Notes
//         </label>
//         <p className="text-xs text-slate-400 mb-2">
//           Meal preferences, seat choices, hotel preferences, favourite destinations, budget range
//         </p>
//         <textarea
//           rows={5}
//           {...register("notes")}
//           placeholder="Customer preferences, special requirements, dietary needs, seat preferences, favourite destinations, hotel preferences, budget range, travel style, etc."
//           className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//             text-slate-700 placeholder-slate-400 focus:border-amber-400 focus:ring-2
//             focus:ring-amber-50 outline-none transition-all resize-none"
//         />
//       </div>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Create Customer redesign. Shared by Createcustomer.jsx and EditCustomer.jsx.
//
// The old version stated the same thing three times — label, hint paragraph, and a 130-character
// placeholder. One label and one short hint is enough; the placeholder now shows the SHAPE of a
// useful note rather than restating the field name.
// ─────────────────────────────────────────────────────────────────────────────
import { StickyNote } from "lucide-react";
import { Panel, Field } from "./CustomerInformation";

const control =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition " +
  "hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function CustomerNotes({ register, errors = {} }) {
  return (
    <Panel
      icon={StickyNote}
      title="Preferences & Notes"
      description="Long-term context that should survive every booking"
    >
      <Field
        id="notes"
        label="Travel Preferences & Notes"
        optional
        error={errors.notes?.message}
        hint="Meal, seat, hotel and accessibility preferences; budget range; travel style"
      >
        <textarea
          {...register("notes", {
            maxLength: { value: 2000, message: "Notes must not exceed 2000 characters" },
          })}
          id="notes"
          rows={4}
          placeholder="Window seat, Jain meal, prefers 4-star and above, travels with elderly parents"
          className={`${control} ${errors.notes ? "border-red-300" : "border-slate-200"} resize-y`}
        />
      </Field>
    </Panel>
  );
}
