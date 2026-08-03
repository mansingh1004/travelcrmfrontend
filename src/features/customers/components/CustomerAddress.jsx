

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

// import { MapPin as FiMapPin, ChevronDown as FiChevronDown, Building as MdLocationCity } from "lucide-react";
//
//
// const INDIA_STATES = [
//   "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
//   "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
//   "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
//   "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
//   "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
//   "Delhi","Chandigarh","Jammu & Kashmir","Ladakh",
// ];
//
// function Field({ label, icon: Icon, error, children }) {
//   return (
//     <div className="flex flex-col gap-1.5">
//       <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
//         {Icon && <Icon className="w-3 h-3 text-teal-400" />}
//         {label}
//       </label>
//       {children}
//       {error && (
//         <p className="text-xs text-red-500 flex items-center gap-1">
//           <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />{error}
//         </p>
//       )}
//     </div>
//   );
// }
//
// export default function CustomerAddress({ register, errors }) {
//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4 flex items-center gap-3">
//         <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">📍</div>
//         <div>
//           <h2 className="text-white font-extrabold text-base">Address Details</h2>
//           <p className="text-teal-100 text-xs">City, state and full address</p>
//         </div>
//       </div>
//
//       <div className="p-6 space-y-4">
//         {/* City + State */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="City" icon={MdLocationCity}>
//             <div className="relative">
//               <MdLocationCity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//               <input placeholder="Mumbai" {...register("city")}
//                 className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                   text-slate-700 placeholder-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all" />
//             </div>
//           </Field>
//           <Field label="State" icon={FiMapPin}>
//             <div className="relative">
//               <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//               <select {...register("state")}
//                 className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                   text-slate-700 outline-none appearance-none cursor-pointer transition-all
//                   focus:border-teal-400 focus:ring-2 focus:ring-teal-50">
//                 <option value="">Select state</option>
//                 {INDIA_STATES.map(s => <option key={s}>{s}</option>)}
//               </select>
//               <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//             </div>
//           </Field>
//         </div>
//
//         {/* Full Address */}
//         <Field label="Full Address" icon={FiMapPin}>
//           <textarea rows={2} {...register("address")}
//             placeholder="House / Flat No., Street, Area, Locality..."
//             className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//               text-slate-700 placeholder-slate-400 focus:border-teal-400 focus:ring-2
//               focus:ring-teal-50 outline-none transition-all resize-none" />
//         </Field>
//
//         {/* Pincode */}
//         <Field label="Pincode / ZIP" icon={FiMapPin} error={errors.pincode?.message}>
//           <div className="relative">
//             <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//             <input placeholder="400001"
//               {...register("pincode", {
//                 pattern: { value: /^\d{4,8}$/, message: "Enter a valid pincode" },
//               })}
//               className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm text-slate-700
//                 placeholder-slate-400 outline-none transition-all
//                 ${errors.pincode
//                   ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
//                   : "border-slate-200 bg-white focus:border-teal-400 focus:ring-2 focus:ring-teal-50"
//                 }`}
//             />
//           </div>
//         </Field>
//       </div>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Create Customer redesign. Shared by Createcustomer.jsx and EditCustomer.jsx.
// Panel / Field / Select are imported from CustomerInformation so all four sections stay in one
// visual language and there is a single place to change it.
// ─────────────────────────────────────────────────────────────────────────────
import { Building, MapPin } from "lucide-react";
import { Panel, Field, Select } from "./CustomerInformation";

const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh",
];

const control =
  "w-full rounded-lg border bg-white py-2.5 text-sm text-slate-800 outline-none transition " +
  "hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cls = (invalid, icon) =>
  `${control} ${icon ? "pl-9 pr-3" : "px-3"} ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200"}`;

export default function CustomerAddress({ register, errors }) {
  return (
    <Panel icon={MapPin} title="Address" description="All optional — used for invoices and courier">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="city" label="City" optional error={errors.city?.message}>
          <div className="relative">
            <Building className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("city", { maxLength: { value: 100, message: "Must not exceed 100 characters" } })}
              id="city"
              autoComplete="address-level2"
              placeholder="Mumbai"
              className={cls(errors.city, true)}
            />
          </div>
        </Field>

        <Field id="state" label="State" optional>
          <Select id="state" icon={MapPin} {...register("state")}>
            <option value="">Select state</option>
            {INDIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </Select>
        </Field>

        {/* inputMode="numeric" added — a pincode is digits, and on mobile this is the difference
            between a dial pad and a full QWERTY keyboard. */}
        <Field id="pincode" label="Pincode / ZIP" optional error={errors.pincode?.message}>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("pincode", {
                pattern: { value: /^$|^\d{4,8}$/, message: "Enter a valid pincode" },
              })}
              id="pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="400001"
              aria-invalid={Boolean(errors.pincode)}
              className={cls(errors.pincode, true)}
            />
          </div>
        </Field>

        <div className="sm:col-span-2 lg:col-span-1">
          <Field id="address" label="Full Address" optional error={errors.address?.message}>
            <input
              {...register("address", { maxLength: { value: 1000, message: "Must not exceed 1000 characters" } })}
              id="address"
              autoComplete="street-address"
              placeholder="House / flat, street, area"
              className={cls(errors.address)}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}
