

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

// import { FileText as FiFileText, IdCard as FaIdCard, Layers as FaLayerGroup } from "lucide-react";
//
//
// function Field({ label, icon: Icon, error, hint, children }) {
//   return (
//     <div className="flex flex-col gap-1.5">
//       <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
//         {Icon && <Icon className="w-3 h-3 text-indigo-400" />}
//         {label}
//       </label>
//       {children}
//       {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
//       {error && (
//         <p className="text-xs text-red-500 flex items-center gap-1">
//           <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />{error}
//         </p>
//       )}
//     </div>
//   );
// }
//
// export default function CustomerDocuments({ register, errors }) {
//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-4 flex items-center gap-3">
//         <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">🗂️</div>
//         <div>
//           <h2 className="text-white font-extrabold text-base">Document Details</h2>
//           <p className="text-indigo-100 text-xs">Passport, PAN, Aadhar — for visa & booking</p>
//         </div>
//       </div>
//
//       <div className="p-6 space-y-4">
//         {/* Important Dates */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Date of Birth" icon={FiFileText}>
//             <div className="relative">
//               <FiFileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//               <input type="date" {...register("birthday")}
//                 className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                   text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none transition-all" />
//             </div>
//           </Field>
//           <Field label="Anniversary Date" icon={FiFileText}>
//             <div className="relative">
//               <FiFileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//               <input type="date" {...register("anniversary")}
//                 className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                   text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none transition-all" />
//             </div>
//           </Field>
//         </div>
//
//         {/* ID Documents */}
//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//           {[
//             { key: "passportNo", label: "Passport No.", placeholder: "A1234567",    rule: null },
//             // Case-insensitive to match the backend's ^$|^[A-Za-z]{5}[0-9]{4}[A-Za-z]$ — the
//             // uppercase-only rule rejected a lowercase PAN the server would have accepted. The
//             // input force-uppercases as you type, so what is stored stays canonical.
//             { key: "panNo",      label: "PAN Number",   placeholder: "ABCDE1234F",  rule: { pattern: { value: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: "Invalid PAN format" }, onChange: (e) => { e.target.value = e.target.value.toUpperCase(); } } },
//             { key: "aadharNo",   label: "Aadhar Number",placeholder: "1234 5678 9012", rule: null },
//           ].map(({ key, label, placeholder, rule }) => (
//             <Field key={key} label={label} icon={FaIdCard} error={errors[key]?.message}>
//               <div className="relative">
//                 <FaIdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//                 <input placeholder={placeholder} {...register(key, rule || {})}
//                   className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm text-slate-700
//                     placeholder-slate-400 outline-none transition-all
//                     ${errors[key]
//                       ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
//                       : "border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
//                     }`}
//                 />
//               </div>
//             </Field>
//           ))}
//         </div>
//
//         {/* Document Notes */}
//         <Field label="Document Notes" icon={FaLayerGroup}
//           hint="Passport expiry, visa history, special document notes">
//           <textarea rows={3} {...register("documents")}
//             placeholder="Document details, passport expiry dates, visa history, etc."
//             className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//               text-slate-700 placeholder-slate-400 focus:border-indigo-400 focus:ring-2
//               focus:ring-indigo-50 outline-none transition-all resize-none" />
//         </Field>
//       </div>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Create Customer redesign. Shared by Createcustomer.jsx and EditCustomer.jsx.
//
// Adds the validation the old version claimed but did not have: birthday now carries a max (a date
// of birth in the future was accepted), Aadhar a length rule, passport a shape. PAN keeps the
// case-insensitive rule + force-uppercase that was already correct.
// ─────────────────────────────────────────────────────────────────────────────
import { CalendarDays, FileText, IdCard } from "lucide-react";
import { Panel, Field } from "./CustomerInformation";

const TODAY = new Date().toISOString().slice(0, 10);

const control =
  "w-full rounded-lg border bg-white py-2.5 text-sm text-slate-800 outline-none transition " +
  "hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cls = (invalid, icon) =>
  `${control} ${icon ? "pl-9 pr-3" : "px-3"} ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200"}`;

export default function CustomerDocuments({ register, errors }) {
  // Aadhar is 12 digits and nothing else, so the field now refuses the rest while you type: letters
  // are dropped and a 13th digit never lands. The strip has to happen before react-hook-form reads
  // the input, which is why this wraps the registered onChange instead of using register's own
  // { onChange } option — that one fires after the raw value is already in form state, so the last
  // typed letter would survive there even though the box looks clean.
  const aadhar = register("aadharNo", {
    // Spaces stay tolerated for records saved before this rule — opening Edit on one should not
    // flag a field the user never touched.
    pattern: { value: /^$|^\d{4}\s?\d{4}\s?\d{4}$/, message: "Aadhar must be 12 digits" },
  });
  // Conditional rewrite: assigning to value parks the caret at the end, so only do it when
  // something actually had to be removed. Ordinary digit typing leaves the caret alone.
  const onAadharChange = (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
    if (digits !== event.target.value) event.target.value = digits;
    return aadhar.onChange(event);
  };

  return (
    <Panel
      icon={IdCard}
      title="Dates & Documents"
      description="Capture only when needed for visa, ticketing or compliance"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
       
        <Field id="birthday" label="Date of Birth" optional error={errors.birthday?.message}>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("birthday", {
                validate: (value) => !value || value <= TODAY || "Date of birth cannot be in the future",
              })}
              id="birthday"
              type="date"
              max={TODAY}
              aria-invalid={Boolean(errors.birthday)}
              className={cls(errors.birthday, true)}
            />
          </div>
        </Field>

        <Field id="anniversary" label="Anniversary" optional error={errors.anniversary?.message}>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("anniversary", {
                validate: (value) => !value || value <= TODAY || "Anniversary cannot be in the future",
              })}
              id="anniversary"
              type="date"
              max={TODAY}
              aria-invalid={Boolean(errors.anniversary)}
              className={cls(errors.anniversary, true)}
            />
          </div>
        </Field>

        <Field id="passportNo" label="Passport No." optional error={errors.passportNo?.message}>
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("passportNo", {
                maxLength: { value: 30, message: "Must not exceed 30 characters" },
              })}
              id="passportNo"
              placeholder="A1234567"
              className={cls(errors.passportNo, true)}
            />
          </div>
        </Field>

        {/* Case-insensitive to match the backend's ^$|^[A-Za-z]{5}[0-9]{4}[A-Za-z]$ — an
            uppercase-only rule rejected a lowercase PAN the server would have accepted. The input
            force-uppercases as you type so what is stored stays canonical. */}
        <Field id="panNo" label="PAN Number" optional error={errors.panNo?.message}>
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("panNo", {
                pattern: { value: /^$|^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: "Invalid PAN format" },
                onChange: (event) => { event.target.value = event.target.value.toUpperCase(); },
              })}
              id="panNo"
              maxLength={10}
              placeholder="ABCDE1234F"
              aria-invalid={Boolean(errors.panNo)}
              className={`${cls(errors.panNo, true)} uppercase`}
            />
          </div>
        </Field>

        <Field id="aadharNo" label="Aadhar Number" optional error={errors.aadharNo?.message}>
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...aadhar}
              onChange={onAadharChange}
              id="aadharNo"
              inputMode="numeric"
              placeholder="1234 5678 9012"
              aria-invalid={Boolean(errors.aadharNo)}
              className={cls(errors.aadharNo, true)}
            />
          </div>
        </Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <Field
            id="documents"
            label="Document Notes"
            optional
            error={errors.documents?.message}
            hint="Passport expiry, visa history, special document instructions"
          >
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <textarea
                {...register("documents", {
                  maxLength: { value: 2000, message: "Must not exceed 2000 characters" },
                })}
                id="documents"
                rows={2}
                placeholder="Passport expiry dates, visa history, etc."
                className={`${cls(errors.documents, true)} resize-y`}
              />
            </div>
          </Field>
        </div>
      </div>
    </Panel>
  );
}
