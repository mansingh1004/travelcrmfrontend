

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

// import { useState } from "react";
// import { User as FiUser, Phone as FiPhone, Mail as FiMail, Search as FiSearch, ChevronDown as FiChevronDown, CircleCheck as FiCheckCircle, Crown as FaCrown, UserRound as FaUserTie, MessageCircleMore as FaCommentDots, Contact as MdOutlineContactPhone } from "lucide-react";
// import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";
//
//
// /* These four lists must mirror the backend enums exactly — CustomerType, CommunicationPreference,
//    LoyaltyTier and CustomerStatus. The wire format is each constant's @JsonValue displayName
//    ("Phone Call", not PHONE_CALL), and fromValue() throws on anything else.
//    "Regular" (CustomerType) and "Blocked" (CustomerStatus) were missing here while the backend
//    accepted both. That is a data-loss bug on the EDIT form, not just a gap on create: a <select>
//    silently discards a value matching no <option>, so opening and saving a Regular/Blocked
//    customer rewrote them to the fallback. Same failure LEAD_SOURCES had. */
// const CUSTOMER_TYPES = ["Individual", "Regular", "Corporate", "VIP", "Group", "Agent"];
// const COMM_PREFS     = ["WhatsApp", "SMS", "Email", "Phone Call", "All Channels"];
// const LOYALTY_TIERS  = ["Bronze", "Silver", "Gold", "Platinum"];
// const CUSTOMER_STATUS= ["Active", "Inactive", "Blocked"];
//
// const TYPE_COLORS = {
//   Individual:{ bg:"bg-blue-50",   text:"text-blue-700",   border:"border-blue-200"   },
//   Regular:   { bg:"bg-slate-50",  text:"text-slate-700",  border:"border-slate-200"  },
//   Corporate: { bg:"bg-indigo-50", text:"text-indigo-700", border:"border-indigo-200" },
//   VIP:       { bg:"bg-amber-50",  text:"text-amber-700",  border:"border-amber-200"  },
//   Group:     { bg:"bg-teal-50",   text:"text-teal-700",   border:"border-teal-200"   },
//   Agent:     { bg:"bg-purple-50", text:"text-purple-700", border:"border-purple-200" },
// };
// const TIER_CONFIG = {
//   Bronze:  "🥉", Silver: "🥈", Gold: "🥇", Platinum: "💎",
// };
//
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
//           <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />
//           {error}
//         </p>
//       )}
//     </div>
//   );
// }
//
// function TextInput({ icon: Icon, error, ...props }) {
//   return (
//     <div className="relative">
//       {Icon && (
//         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
//           <Icon className="w-4 h-4" />
//         </div>
//       )}
//       <input
//         className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 rounded-xl border text-sm text-slate-700
//           placeholder-slate-400 outline-none transition-all
//           ${error
//             ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
//             : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
//           }`}
//         {...props}
//       />
//     </div>
//   );
// }
//
// function SelectInput({ icon: Icon, options, placeholder, ...props }) {
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
//         {options.map(o => <option key={o} value={o}>{o}</option>)}
//       </select>
//       <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//     </div>
//   );
// }
//
// export default function CustomerInformation({ register, errors, watch, setValue }) {
//   const [searching,  setSearching]  = useState(false);
//   const [searchTel,  setSearchTel]  = useState("");
//
//   const selectedType = watch("type");
//   const selectedTier = watch("tier");
//   const selectedComm = watch("commPref");
//
//   const handleSearch = async () => {
//     if (!searchTel.trim()) return;
//     setSearching(true);
//     // ── BACKEND: replace setTimeout with real API call ───────
//     // const res = await customerService.searchByPhone(searchTel);
//     // setValue("name", res.data.name); setValue("email", res.data.email); ...
//     await new Promise(r => setTimeout(r, 900));
//     setSearching(false);
//   };
//
//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       {/* Header */}
//       <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center gap-3">
//         <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">👤</div>
//         <div>
//           <h2 className="text-white font-extrabold text-base">Customer Information</h2>
//           <p className="text-blue-100 text-xs">Basic contact details — name, phone & email</p>
//         </div>
//       </div>
//
//       <div className="p-6 space-y-5">
//         {/* Phone search */}
//         <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
//           <p className="text-xs font-extrabold text-blue-700 mb-2.5 flex items-center gap-1.5">
//             <FiSearch className="w-3.5 h-3.5" /> Search Existing Customer by Phone
//           </p>
//           <div className="flex gap-2">
//             <input
//               type="tel"
//               value={searchTel}
//               onChange={e => setSearchTel(e.target.value)}
//               onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleSearch())}
//               placeholder="Enter phone to auto-fill if customer exists..."
//               className="flex-1 px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-sm
//                 text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2
//                 focus:ring-blue-100 outline-none transition-all"
//             />
//             <button type="button" onClick={handleSearch} disabled={searching}
//               className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm
//                 font-bold transition-all flex items-center gap-2 disabled:opacity-60 shadow-sm">
//               {searching
//                 ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
//                 : <FiSearch className="w-4 h-4" />}
//               {searching ? "Searching..." : "Search"}
//             </button>
//           </div>
//         </div>
//
//         {/* Name + Phone */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Full Name" required icon={FiUser} error={errors.name?.message}>
//             <TextInput
//               icon={FiUser} placeholder="Enter customer full name" error={errors.name}
//               {...register("name", { required: "Full name is required" })}
//             />
//           </Field>
//           <Field label="Phone Number" required icon={FiPhone} error={errors.phone?.message}
//             hint="Include country code e.g. +91 98765 43210">
//             <TextInput
//               type="tel" icon={FiPhone} placeholder="+91 98765 43210" error={errors.phone}
//               {...register("phone", {
//                 required: "Phone number is required",
//                 pattern: { value: /^[+\d\s\-()\u00A0]{7,16}$/, message: "Enter a valid phone number" },
//               })}
//             />
//           </Field>
//         </div>
//
//         {/* Email + Alternate Phone */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Email Address" icon={FiMail} error={errors.email?.message}>
//             <TextInput
//               type="email" icon={FiMail} placeholder="customer@email.com" error={errors.email}
//               {...register("email", {
//                 pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
//               })}
//             />
//           </Field>
//           <Field label="Alternate Phone" icon={MdOutlineContactPhone}>
//             <TextInput type="tel" icon={MdOutlineContactPhone}
//               placeholder="+91 87654 32109" {...register("alternatePhone")} />
//           </Field>
//         </div>
//
//         {/* Type + Communication */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Customer Type" required icon={FaUserTie}>
//             <SelectInput icon={FaUserTie} options={CUSTOMER_TYPES}
//               {...register("type", { required: true })} />
//             <div className="flex flex-wrap gap-1.5 mt-2">
//               {CUSTOMER_TYPES.map(t => {
//                 const c = TYPE_COLORS[t] || TYPE_COLORS.Individual;
//                 return (
//                   <button key={t} type="button" onClick={() => setValue("type", t)}
//                     className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all
//                       ${selectedType === t
//                         ? `${c.border} ${c.bg} ${c.text} shadow-sm scale-105`
//                         : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                     {t === "VIP" && "👑 "}{t}
//                   </button>
//                 );
//               })}
//             </div>
//           </Field>
//
//           <Field label="Communication Preference" icon={FaCommentDots}>
//             <SelectInput icon={FaCommentDots} options={COMM_PREFS} {...register("commPref")} />
//             <div className="flex flex-wrap gap-1.5 mt-2">
//               {[
//                 { label: "WhatsApp", icon: <FaWhatsapp className="w-3 h-3" />, color: "text-green-600 bg-green-50 border-green-200" },
//                 { label: "SMS",      icon: <FiPhone className="w-3 h-3" />,    color: "text-blue-600 bg-blue-50 border-blue-200"    },
//                 { label: "Email",    icon: <FiMail className="w-3 h-3" />,     color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
//               ].map(({ label, icon, color }) => (
//                 <button key={label} type="button" onClick={() => setValue("commPref", label)}
//                   className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all
//                     ${selectedComm === label ? `${color} shadow-sm` : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                   {icon} {label}
//                 </button>
//               ))}
//             </div>
//           </Field>
//         </div>
//
//         {/* Tier + Status */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <Field label="Loyalty Tier" icon={FaCrown}>
//             <SelectInput icon={FaCrown} options={LOYALTY_TIERS} {...register("tier")} />
//             <div className="flex gap-1.5 mt-2">
//               {LOYALTY_TIERS.map(t => (
//                 <button key={t} type="button" onClick={() => setValue("tier", t)}
//                   className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all
//                     ${selectedTier === t
//                       ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
//                       : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                   {TIER_CONFIG[t]} {t}
//                 </button>
//               ))}
//             </div>
//           </Field>
//           <Field label="Status" icon={FiCheckCircle}>
//             <SelectInput icon={FiCheckCircle} options={CUSTOMER_STATUS} {...register("status")} />
//           </Field>
//         </div>
//       </div>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Create Customer redesign. Shared by Createcustomer.jsx AND EditCustomer.jsx, so both
// screens are guaranteed to look and behave identically.
//
// Flat panel, one border, neutral icon tile, lucide instead of emoji — the idiom already proven by
// CreateBookingClean.jsx. The thirteen chip buttons that shadowed the Type / Comm-Pref / Tier
// selects are gone: they cost 13 tab stops and 104px, the comm-pref row only offered 3 of the 5
// real values, and every one of those fields is pre-defaulted and rarely touched.
//
// `belowPhone` is a slot the page fills with the duplicate/restore strip. Keeping it a slot means
// Edit can pass nothing and this component stays presentation-only.
// ─────────────────────────────────────────────────────────────────────────────
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  CircleUserRound,
  Contact,
  Crown,
  Mail,
  MessageCircleMore,
  Phone,
} from "lucide-react";

/* These four lists must mirror the backend enums exactly — CustomerType, CommunicationPreference,
   LoyaltyTier and CustomerStatus. The wire format is each constant's @JsonValue displayName
   ("Phone Call", not PHONE_CALL), and fromValue() throws on anything else. */
export const CUSTOMER_TYPES = ["Individual", "Regular", "Corporate", "VIP", "Group", "Agent"];
export const COMM_PREFS = ["WhatsApp", "SMS", "Email", "Phone Call", "All Channels"];
export const LOYALTY_TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
export const CUSTOMER_STATUS = ["Active", "Inactive", "Blocked"];

const control =
  "w-full rounded-lg border bg-white py-2.5 text-sm text-slate-800 outline-none transition " +
  "hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cls = (invalid, icon) =>
  `${control} ${icon ? "pl-9 pr-3" : "px-3"} ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200"}`;

export function Panel({ icon: Icon, title, description, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* htmlFor + id on every field. The old Field closed its <label> before {children}, so none of the
   19 labels was associated with anything — clicking one focused nothing. */
export function Field({ id, label, required, optional, error, hint, children }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Select({ id, icon: Icon, invalid, children, ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
      <select id={id} {...props} className={`${cls(invalid, Boolean(Icon))} appearance-none pr-9`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/**
 * The stored value is always rendered as an option, even if it is not in our list.
 *
 * A <select> silently discards a value matching no <option>, and the next save then writes whatever
 * it fell back to. The four lists above are hand-maintained copies of enums that live in another
 * repo, so the day someone adds a constant server-side this form would quietly rewrite it. Same
 * guard as leads/lib/useLeadSources.js withCurrent().
 */
const withCurrent = (options, current) =>
  !current || options.includes(current) ? options : [current, ...options];

export default function CustomerInformation({
  register,
  errors,
  watch,
  phoneRef,
  belowPhone = null,
}) {
  const phoneReg = register("phone", {
    required: "Phone number is required",
    pattern: { value: /^[+\d\s\-()\u00A0]{7,16}$/, message: "Enter a valid phone number" },
  });

  return (
    <Panel
      icon={CircleUserRound}
      title="Identity & Contact"
      description="Only name and phone are required — everything else can be filled in later"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Phone first: it is the per-tenant natural key and it drives the duplicate check. */}
        <div className="lg:col-span-1">
          <Field id="phone" label="Phone" required error={errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...phoneReg}
                ref={(node) => { phoneReg.ref(node); if (phoneRef) phoneRef.current = node; }}
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                className={cls(errors.phone, true)}
              />
            </div>
          </Field>
        </div>

        <Field id="name" label="Full Name" required error={errors.name?.message}>
          <div className="relative">
            <CircleUserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("name", {
                required: "Full name is required",
                maxLength: { value: 150, message: "Name must not exceed 150 characters" },
              })}
              id="name"
              autoComplete="name"
              placeholder="Customer full name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              className={cls(errors.name, true)}
            />
          </div>
        </Field>

        <Field id="email" label="Email" optional error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("email", {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                maxLength: { value: 150, message: "Email must not exceed 150 characters" },
              })}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="customer@email.com"
              aria-invalid={Boolean(errors.email)}
              className={cls(errors.email, true)}
            />
          </div>
        </Field>

        <Field id="alternatePhone" label="Alternate Phone" optional error={errors.alternatePhone?.message}>
          <div className="relative">
            <Contact className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              {...register("alternatePhone", {
                maxLength: { value: 20, message: "Must not exceed 20 characters" },
              })}
              id="alternatePhone"
              type="tel"
              placeholder="+91 87654 32109"
              className={cls(errors.alternatePhone, true)}
            />
          </div>
        </Field>
      </div>

      {/* Duplicate / restore strip lives directly under the row that owns the phone number. */}
      {belowPhone}

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {/*
          "No preference set" is a REAL, selectable state, not a placeholder.

          comm_pref is the one nullable column of these four: CustomerServiceImpl.applyDefaults()
          back-fills type/tier/status and deliberately leaves commPref alone, because the backend
          models "the customer never told us" as distinct from "the customer wants WhatsApp".
          EditCustomer used to coalesce that null to "WhatsApp" on load and post it straight back,
          so opening a record to fix an address silently opted the customer into WhatsApp — and
          commPref is a live marketing segment field (MarketingFieldCatalog / SegmentEvaluator),
          so that is a consent problem, not a cosmetic one. Making the empty state explicit and
          selectable is what lets the value round-trip untouched.
        */}
        <Field
          id="commPref"
          label="Preferred Communication"
          optional
          hint="Leave unset if the customer has not said"
        >
          <Select id="commPref" icon={MessageCircleMore} {...register("commPref")}>
            <option value="">No preference set</option>
            {withCurrent(COMM_PREFS, watch("commPref")).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </Field>

        <Field id="type" label="Customer Type" optional error={errors.type?.message}>
          <Select id="type" icon={Building2} invalid={Boolean(errors.type)} {...register("type")}>
            {withCurrent(CUSTOMER_TYPES, watch("type")).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </Field>

        <Field id="tier" label="Loyalty Tier" optional>
          <Select id="tier" icon={Crown} {...register("tier")}>
            {withCurrent(LOYALTY_TIERS, watch("tier")).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </Field>

        <Field id="status" label="Status" optional>
          <Select id="status" icon={BadgeCheck} {...register("status")}>
            {withCurrent(CUSTOMER_STATUS, watch("status")).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Panel>
  );
}
