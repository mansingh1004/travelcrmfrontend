// // src/components/CreateVendor/VendorInformation.jsx

// import { User as FiUser, Phone as FiPhone, Mail as FiMail, ChevronDown as FiChevronDown, CircleCheck as FiCheckCircle, Hotel as FaHotel, Plane as FaPlane, Bus as FaBus, MapPinned as FaMapMarkedAlt, Handshake as FaHandshake, FileSignature as FaFileContract, Building2 as MdBusiness, Contact as MdOutlineContactPhone, Sparkles as HiSparkles } from "lucide-react";
// import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";


// const VENDOR_TYPES     = ["Hotel", "Airlines", "Transport", "DMC", "Travel Agency", "Car Rental", "Cruise", "Insurance"];
// const CONTRACT_TYPES   = ["Rate Contract", "Commission Based", "Fixed Price", "Retainer", "Per-Trip"];
// const PAYMENT_TERMS    = ["Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Advance", "50% Advance", "On Completion"];
// // Backend VendorStatus enum is serialized as UPPERCASE names.
// const VENDOR_STATUSES  = ["ACTIVE", "INACTIVE", "SUSPENDED", "BLACKLISTED"];
// const COMM_PREFS       = ["WhatsApp", "Email", "Phone Call", "SMS"];

// // "PARTIALLY_PAID" -> "Partially Paid"
// const enumLabel = (v) =>
//   (v || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// const TYPE_CONFIG = {
//   Hotel:         { icon: FaHotel,       bg:"bg-blue-50",   text:"text-blue-700",   border:"border-blue-200"   },
//   Airlines:      { icon: FaPlane,       bg:"bg-sky-50",    text:"text-sky-700",    border:"border-sky-200"    },
//   Transport:     { icon: FaBus,         bg:"bg-orange-50", text:"text-orange-700", border:"border-orange-200" },
//   DMC:           { icon: FaMapMarkedAlt,bg:"bg-teal-50",   text:"text-teal-700",   border:"border-teal-200"   },
//   "Travel Agency":{ icon: FaHandshake, bg:"bg-purple-50", text:"text-purple-700", border:"border-purple-200" },
//   "Car Rental":  { icon: FaBus,         bg:"bg-amber-50",  text:"text-amber-700",  border:"border-amber-200"  },
//   Cruise:        { icon: FaPlane,       bg:"bg-indigo-50", text:"text-indigo-700", border:"border-indigo-200" },
//   Insurance:     { icon: FaFileContract,bg:"bg-rose-50",   text:"text-rose-700",   border:"border-rose-200"   },
// };

// /* ── Shared tiny helpers ── */
// function Field({ label, required, icon: Icon, error, hint, children }) {
//   return (
//     <div className="flex flex-col gap-1.5">
//       <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
//         {Icon && <Icon className="w-3 h-3 text-blue-400" />}
//         {label}
//         {required && <span className="text-red-500 ml-0.5 normal-case">*</span>}
//       </label>
//       {children}
//       {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
//       {error && (
//         <p className="text-xs text-red-500 flex items-center gap-1">
//           <span className="w-1 h-1 rounded-full bg-red-500 inline-block flex-shrink-0" />{error}
//         </p>
//       )}
//     </div>
//   );
// }

// function TextInput({ icon: Icon, error, ...props }) {
//   return (
//     <div className="relative">
//       {Icon && (
//         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
//           <Icon className="w-4 h-4" />
//         </div>
//       )}
//       <input
//         className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 rounded-xl border text-sm
//           text-slate-700 placeholder-slate-400 outline-none transition-all
//           ${error
//             ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
//             : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
//           }`}
//         {...props}
//       />
//     </div>
//   );
// }

// function SelectInput({ icon: Icon, options, placeholder, labelFn, ...props }) {
//   return (
//     <div className="relative">
//       {Icon && (
//         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
//           <Icon className="w-4 h-4" />
//         </div>
//       )}
//       <select
//         className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-8 py-2.5 rounded-xl border border-slate-200
//           bg-white text-sm text-slate-700 outline-none appearance-none cursor-pointer transition-all
//           focus:border-blue-400 focus:ring-2 focus:ring-blue-50`}
//         {...props}
//       >
//         {placeholder && <option value="">{placeholder}</option>}
//         {options.map(o => <option key={o} value={o}>{labelFn ? labelFn(o) : o}</option>)}
//       </select>
//       <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//     </div>
//   );
// }

// export default function VendorInformation({ register, errors, watch, setValue }) {
//   const selectedType   = watch("vendorType");
//   const selectedComm   = watch("commPref");


//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       {/* Header */}
//       <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">🤝</div>
//           <div>
//             <h2 className="text-white font-extrabold text-base">Vendor Information</h2>
//             <p className="text-blue-100 text-xs">Company details, type & contact person</p>
//           </div>
//         </div>
//         <span className="text-xs bg-white/20 text-white font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
//           <HiSparkles className="w-3 h-3" /> Code auto-generated
//         </span>
//       </div>

//       <div className="p-6 space-y-5">
//         {/* Vendor Name + Type */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Vendor Name" required icon={MdBusiness} error={errors.vendorName?.message}>
//             <TextInput
//               icon={MdBusiness}
//               placeholder="Enter company / vendor name"
//               error={errors.vendorName}
//               {...register("vendorName", { required: "Vendor name is required" })}
//             />
//           </Field>
//           <Field label="Vendor Type" required icon={FaHotel} error={errors.vendorType?.message}>
//             <SelectInput
//               icon={FaHotel}
//               options={VENDOR_TYPES}
//               placeholder="Select vendor type"
//               {...register("vendorType", { required: "Vendor type is required" })}
//             />
//           </Field>
//         </div>

//         {/* Type pills */}
//         {selectedType && (
//           <div className="flex flex-wrap gap-2">
//             {VENDOR_TYPES.map(t => {
//               const c = TYPE_CONFIG[t];
//               if (!c) return null;
//               const Icon = c.icon;
//               return (
//                 <button key={t} type="button" onClick={() => setValue("vendorType", t)}
//                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all
//                     ${selectedType === t
//                       ? `${c.border} ${c.bg} ${c.text} shadow-sm scale-105`
//                       : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                   <Icon className="w-3 h-3" /> {t}
//                 </button>
//               );
//             })}
//           </div>
//         )}

//         {/* Contact + Phone */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Contact Person" icon={FiUser}>
//             <TextInput
//               icon={FiUser}
//               placeholder="Primary contact name"
//               {...register("contactPerson")}
//             />
//           </Field>
//           <Field label="Phone Number" required icon={FiPhone} error={errors.phone?.message}
//             hint="Include country code e.g. +91 98765 43210">
//             <TextInput
//               type="tel"
//               icon={FiPhone}
//               placeholder="+91 98765 43210"
//               error={errors.phone}
//               {...register("phone", {
//                 required: "Phone number is required",
//                 pattern: { value: /^[+\d\s\-()\u00A0]{7,16}$/, message: "Enter a valid phone number" },
//               })}
//             />
//           </Field>
//         </div>

//         {/* Email + Alternate Phone */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Email Address" icon={FiMail} error={errors.email?.message}>
//             <TextInput
//               type="email"
//               icon={FiMail}
//               placeholder="vendor@company.com"
//               error={errors.email}
//               {...register("email", {
//                 pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
//               })}
//             />
//           </Field>
//           <Field label="Alternate Phone" icon={MdOutlineContactPhone}>
//             <TextInput
//               type="tel"
//               icon={MdOutlineContactPhone}
//               placeholder="+91 87654 32109"
//               {...register("alternatePhone")}
//             />
//           </Field>
//         </div>

//         {/* WhatsApp Number */}
//         <Field label="WhatsApp Number" icon={FaWhatsapp}
//           hint="Leave blank if same as phone number">
//           <TextInput
//             type="tel"
//             icon={FaWhatsapp}
//             placeholder="+91 98765 43210"
//             {...register("whatsapp")}
//           />
//         </Field>

//         {/* Contract Type + Payment Terms */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Contract Type" icon={FaFileContract}>
//             <SelectInput
//               icon={FaFileContract}
//               options={CONTRACT_TYPES}
//               {...register("contractType")}
//             />
//           </Field>
//           <Field label="Payment Terms" icon={FiCheckCircle}>
//             <SelectInput
//               icon={FiCheckCircle}
//               options={PAYMENT_TERMS}
//               {...register("paymentTerms")}
//             />
//           </Field>
//         </div>

//         {/* Communication Preference + Status */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Communication Preference" icon={FaWhatsapp}>
//             <div>
//               <SelectInput
//                 icon={FaWhatsapp}
//                 options={COMM_PREFS}
//                 {...register("commPref")}
//               />
//               <div className="flex flex-wrap gap-1.5 mt-2">
//                 {[
//                   { label:"WhatsApp", icon:<FaWhatsapp className="w-3 h-3"/>, color:"text-green-600 bg-green-50 border-green-200" },
//                   { label:"Email",    icon:<FiMail className="w-3 h-3"/>,     color:"text-indigo-600 bg-indigo-50 border-indigo-200" },
//                   { label:"Phone Call",icon:<FiPhone className="w-3 h-3"/>,   color:"text-blue-600 bg-blue-50 border-blue-200" },
//                 ].map(({ label, icon, color }) => (
//                   <button key={label} type="button"
//                     onClick={() => setValue("commPref", label)}
//                     className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all
//                       ${selectedComm === label ? `${color} shadow-sm` : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                     {icon} {label}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </Field>
//           <Field label="Status" icon={FiCheckCircle}>
//             <SelectInput
//               icon={FiCheckCircle}
//               options={VENDOR_STATUSES}
//               labelFn={enumLabel}
//               {...register("status")}
//             />
//           </Field>
//         </div>
//       </div>
//     </div>
//   );
// }








// src/components/CreateVendor/VendorInformation.jsx

import { User as FiUser, Phone as FiPhone, Mail as FiMail, ChevronDown as FiChevronDown, CircleCheck as FiCheckCircle, Hotel as FaHotel, Plane as FaPlane, Bus as FaBus, MapPinned as FaMapMarkedAlt, Handshake as FaHandshake, FileSignature as FaFileContract, Building2 as MdBusiness, Contact as MdOutlineContactPhone, Sparkles as HiSparkles } from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";

const VENDOR_TYPES     = ["Hotel", "Airlines", "Transport", "DMC", "Travel Agency", "Car Rental", "Cruise", "Insurance"];
const CONTRACT_TYPES   = ["Rate Contract", "Commission Based", "Fixed Price", "Retainer", "Per-Trip"];
const PAYMENT_TERMS    = ["Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Advance", "50% Advance", "On Completion"];
// Backend VendorStatus enum is serialized as UPPERCASE names.
const VENDOR_STATUSES  = ["ACTIVE", "INACTIVE", "SUSPENDED", "BLACKLISTED"];
const COMM_PREFS       = ["WhatsApp", "Email", "Phone Call", "SMS"];

// "PARTIALLY_PAID" -> "Partially Paid"
const enumLabel = (v) =>
  (v || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const TYPE_CONFIG = {
  Hotel:         { icon: FaHotel,        bg:"bg-blue-50",   text:"text-blue-700",   border:"border-blue-200"   },
  Airlines:      { icon: FaPlane,        bg:"bg-sky-50",    text:"text-sky-700",    border:"border-sky-200"    },
  Transport:     { icon: FaBus,          bg:"bg-orange-50", text:"text-orange-700", border:"border-orange-200" },
  DMC:           { icon: FaMapMarkedAlt, bg:"bg-teal-50",   text:"text-teal-700",   border:"border-teal-200"   },
  "Travel Agency":{ icon: FaHandshake,   bg:"bg-purple-50", text:"text-purple-700", border:"border-purple-200" },
  "Car Rental":  { icon: FaBus,          bg:"bg-amber-50",  text:"text-amber-700",  border:"border-amber-200"  },
  Cruise:        { icon: FaPlane,        bg:"bg-indigo-50", text:"text-indigo-700", border:"border-indigo-200" },
  Insurance:     { icon: FaFileContract, bg:"bg-rose-50",   text:"text-rose-700",   border:"border-rose-200"   },
};

/* ── Shared tiny helpers ── */
function Field({ label, required, icon: Icon, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {Icon && <Icon className="w-3 h-3 text-blue-400" />}
        {label}
        {required && <span className="text-red-500 ml-0.5 normal-case">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-red-500 inline-block flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

function TextInput({ icon: Icon, error, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 rounded-xl border text-sm
          text-slate-700 placeholder-slate-400 outline-none transition-all
          ${error
            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
            : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          }`}
        {...props}
      />
    </div>
  );
}

function SelectInput({ icon: Icon, options, placeholder, labelFn, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <select
        className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-8 py-2.5 rounded-xl border border-slate-200
          bg-white text-sm text-slate-700 outline-none appearance-none cursor-pointer transition-all
          focus:border-blue-400 focus:ring-2 focus:ring-blue-50`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{labelFn ? labelFn(o) : o}</option>)}
      </select>
      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

export default function VendorInformation({ register, errors, watch, setValue }) {
  const selectedType   = watch("vendorType");
  const selectedComm   = watch("commPref");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header (Updated for strict responsiveness) */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xl">
            🤝
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-extrabold text-base sm:text-lg truncate">
              Vendor Information
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm truncate mt-0.5">
              Company details, type & contact person
            </p>
          </div>
        </div>
        <div className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 w-fit">
          <HiSparkles className="w-3 h-3 shrink-0" /> Code auto-generated
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Vendor Name + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vendor Name" required icon={MdBusiness} error={errors.vendorName?.message}>
            <TextInput
              icon={MdBusiness}
              placeholder="Enter company / vendor name"
              error={errors.vendorName}
              {...register("vendorName", { required: "Vendor name is required" })}
            />
          </Field>
          <Field label="Vendor Type" required icon={FaHotel} error={errors.vendorType?.message}>
            <SelectInput
              icon={FaHotel}
              options={VENDOR_TYPES}
              placeholder="Select vendor type"
              {...register("vendorType", { required: "Vendor type is required" })}
            />
          </Field>
        </div>

        {/* Type pills */}
        {selectedType && (
          <div className="flex flex-wrap gap-2">
            {VENDOR_TYPES.map(t => {
              const c = TYPE_CONFIG[t];
              if (!c) return null;
              const Icon = c.icon;
              return (
                <button key={t} type="button" onClick={() => setValue("vendorType", t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                    ${selectedType === t
                      ? `${c.border} ${c.bg} ${c.text} shadow-sm scale-105`
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                  <Icon className="w-3 h-3" /> {t}
                </button>
              );
            })}
          </div>
        )}

        {/* Contact + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contact Person" icon={FiUser}>
            <TextInput
              icon={FiUser}
              placeholder="Primary contact name"
              {...register("contactPerson")}
            />
          </Field>
          <Field label="Phone Number" required icon={FiPhone} error={errors.phone?.message}
            hint="Include country code e.g. +91 98765 43210">
            <TextInput
              type="tel"
              icon={FiPhone}
              placeholder="+91 98765 43210"
              error={errors.phone}
              {...register("phone", {
                required: "Phone number is required",
                pattern: { value: /^[+\d\s\-()\u00A0]{7,16}$/, message: "Enter a valid phone number" },
              })}
            />
          </Field>
        </div>

        {/* Email + Alternate Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email Address" icon={FiMail} error={errors.email?.message}>
            <TextInput
              type="email"
              icon={FiMail}
              placeholder="vendor@company.com"
              error={errors.email}
              {...register("email", {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
              })}
            />
          </Field>
          <Field label="Alternate Phone" icon={MdOutlineContactPhone}>
            <TextInput
              type="tel"
              icon={MdOutlineContactPhone}
              placeholder="+91 87654 32109"
              {...register("alternatePhone")}
            />
          </Field>
        </div>

        {/* WhatsApp Number */}
        <Field label="WhatsApp Number" icon={FaWhatsapp}
          hint="Leave blank if same as phone number">
          <TextInput
            type="tel"
            icon={FaWhatsapp}
            placeholder="+91 98765 43210"
            {...register("whatsapp")}
          />
        </Field>

        {/* Contract Type + Payment Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contract Type" icon={FaFileContract}>
            <SelectInput
              icon={FaFileContract}
              options={CONTRACT_TYPES}
              {...register("contractType")}
            />
          </Field>
          <Field label="Payment Terms" icon={FiCheckCircle}>
            <SelectInput
              icon={FiCheckCircle}
              options={PAYMENT_TERMS}
              {...register("paymentTerms")}
            />
          </Field>
        </div>

        {/* Communication Preference + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Communication Preference" icon={FaWhatsapp}>
            <div>
              <SelectInput
                icon={FaWhatsapp}
                options={COMM_PREFS}
                {...register("commPref")}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label:"WhatsApp", icon:<FaWhatsapp className="w-3 h-3"/>, color:"text-green-600 bg-green-50 border-green-200" },
                  { label:"Email",    icon:<FiMail className="w-3 h-3"/>,     color:"text-indigo-600 bg-indigo-50 border-indigo-200" },
                  { label:"Phone Call",icon:<FiPhone className="w-3 h-3"/>,   color:"text-blue-600 bg-blue-50 border-blue-200" },
                ].map(({ label, icon, color }) => (
                  <button key={label} type="button"
                    onClick={() => setValue("commPref", label)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all
                      ${selectedComm === label ? `${color} shadow-sm` : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          </Field>
          <Field label="Status" icon={FiCheckCircle}>
            <SelectInput
              icon={FiCheckCircle}
              options={VENDOR_STATUSES}
              labelFn={enumLabel}
              {...register("status")}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}