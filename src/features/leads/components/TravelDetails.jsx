



// import { useEffect, useState } from "react";
// import { 
//   Calendar as FiCalendar, 
//   Globe as FiGlobe, 
//   MapPin as FiMapPin, 
//   House as FiHome, 
//   Users as FiUsers, 
//   PersonStanding as MdChildCare, 
//   Baby as MdBabyChangingStation, 
//   BedDouble as MdHotel, 
//   Accessibility, 
//   Mars, 
//   Venus 
// } from "lucide-react";

// import { geographyService } from "@shared/api/geographyService";
// import { getErrorMessage } from "@shared/api/apiError";
// import SearchableSelect from "./SearchableSelect";

// /** Empty string ko 0 banao — warna adults + children string concat ho jaata hai */
// const toNum = (v) => {
//   const n = Number(v);
//   return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
// };

// function NumberInput({ label, icon: Icon, value, onChange, min = 0, max = Infinity, color = "blue" }) {
//   const colorMap = {
//     blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", btn: "bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-700" },
//     green: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", btn: "bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-700" },
//     orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", btn: "bg-orange-100 hover:bg-orange-200 active:bg-orange-300 text-orange-700" },
//     purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", btn: "bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-700" },
//     rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", btn: "bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-700" },
//   };
//   const c = colorMap[color];

//   const handleInputChange = (e) => {
//     const raw = e.target.value;
//     if (raw === "") {
//       onChange("");
//       return;
//     }
//     const val = parseInt(raw, 10);
//     if (!Number.isNaN(val)) {
//       onChange(Math.min(max, Math.max(min, val)));
//     }
//   };

//   const handleBlur = () => {
//     if (value === "" || value === null || value === undefined || value < min) {
//       onChange(min);
//     }
//   };

//   const numValue = toNum(value);

//   return (
//     <div
//       className={`${c.bg} rounded-xl border ${c.border} min-w-0 p-2.5 sm:p-3
//         flex flex-col items-center gap-2
//         sm:flex-row sm:items-center sm:justify-between sm:gap-2 h-full`}
//     >
//       <div className="flex items-center gap-1.5 min-w-0 max-w-full">
//         <Icon className={`w-4 h-4 shrink-0 ${c.text}`} />
//         <span
//           title={label}
//           className="text-[11px] sm:text-sm font-semibold text-slate-600 truncate whitespace-nowrap"
//         >
//           {label}
//         </span>
//       </div>
//       <div className="flex items-center gap-1 shrink-0">
//         <button
//           type="button"
//           aria-label={`Decrease ${label}`}
//           onClick={() => onChange(Math.max(min, numValue - 1))}
//           className={`w-8 h-8 sm:w-7 sm:h-7 shrink-0 rounded-lg ${c.btn} font-bold text-base sm:text-sm transition-colors flex items-center justify-center select-none`}
//         >
//           −
//         </button>
//         <input
//           type="number"
//           inputMode="numeric"
//           aria-label={label}
//           value={value}
//           onChange={handleInputChange}
//           onBlur={handleBlur}
//           className={`w-9 sm:w-8 text-center text-base font-bold bg-transparent outline-none ${c.text}
//             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
//         />
//         <button
//           type="button"
//           aria-label={`Increase ${label}`}
//           onClick={() => onChange(Math.min(max, numValue + 1))}
//           className={`w-8 h-8 sm:w-7 sm:h-7 shrink-0 rounded-lg ${c.btn} font-bold text-base sm:text-sm transition-colors flex items-center justify-center select-none`}
//         >
//           +
//         </button>
//       </div>
//     </div>
//   );
// }
//this is 
// export default function TravelDetails({
//   register,
//   watch,
//   setValue,
//   getValues,
// }) {
//   const [countries, setCountries] = useState([]);
//   const [loadingCountries, setLoadingCountries] = useState(true);
//   const [error, setError] = useState(null);

//   const roomsRaw = watch("rooms") ?? 0;
//   const maleRaw = watch("male") ?? 0;
//   const femaleRaw = watch("female") ?? 0;
//   const childrenRaw = watch("children") ?? 0;
//   const infantsRaw = watch("infants") ?? 0;
//   const extraBedsRaw = watch("extraBeds") ?? 0;
  
//   // Handicap states
//   const needsHandicap = watch("needsHandicap") ?? false;
//   const handicapRaw = watch("handicap") ?? 0;

//   const rooms = toNum(roomsRaw);
//   const male = toNum(maleRaw);
//   const female = toNum(femaleRaw);
//   const children = toNum(childrenRaw);
//   const infants = toNum(infantsRaw);
//   const extraBeds = toNum(extraBedsRaw);
//   const handicap = toNum(handicapRaw);

//   const adults = male + female;

//   useEffect(() => {
//     if (toNum(getValues?.("adults")) !== adults) {
//       setValue("adults", adults, { shouldDirty: false, shouldValidate: false });
//     }
//   }, [adults, getValues, setValue]);

//   useEffect(() => {
//     let active = true;
//     const loadCountries = async () => {
//       setLoadingCountries(true);
//       setError(null);
//       try {
//         const response = await geographyService.getCountries();
//         const rawCountries = Array.isArray(response)
//           ? response
//           : Array.isArray(response?.data)
//             ? response.data
//             : Array.isArray(response?.data?.data)
//               ? response.data.data
//               : [];

//         const countryOptions = rawCountries
//           .map((country) => {
//             const countryName = typeof country === "string" ? country.trim() : String(country?.label || country?.name || country?.countryName || "").trim();
//             if (!countryName) return null;
//             return { value: countryName, label: countryName };
//           })
//           .filter(Boolean);

//         if (!active) return;
//         setCountries(countryOptions);

//         const currentCountry = typeof getValues === "function" ? getValues("departCountry") : watch("departCountry");
//         const matchingCountry = countryOptions.find((country) => country.value.toLowerCase() === String(currentCountry || "").trim().toLowerCase());
//         const indiaOption = countryOptions.find((country) => country.value.toLowerCase() === "india");

//         if (matchingCountry) {
//           setValue("departCountry", matchingCountry.value, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
//         } else if (!currentCountry && indiaOption) {
//           setValue("departCountry", indiaOption.value, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
//         }
//       } catch (err) {
//         if (!active) return;
//         console.error("Country loading error:", err);
//         setCountries([]);
//         setError(getErrorMessage(err, "Couldn't load countries."));
//       } finally {
//         if (active) setLoadingCountries(false);
//       }
//     };

//     loadCountries();
//     return () => { active = false; };
//   }, [getValues, setValue, watch]);

//   const totalTravellers = adults + children + handicap;
//   const summary = [
//     male > 0 && `${male} Male`,
//     female > 0 && `${female} Female`,
//     children > 0 && `${children} Child${children > 1 ? "ren" : ""}`,
//     handicap > 0 && `${handicap} Handicap`,
//     infants > 0 && `${infants} Infant${infants > 1 ? "s" : ""}`,
//     extraBeds > 0 && `${extraBeds} Extra Bed${extraBeds > 1 ? "s" : ""}`,
//     rooms > 0 && `${rooms} Room${rooms > 1 ? "s" : ""}`,
//   ].filter(Boolean).join(" · ");

//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3.5 sm:px-6 sm:py-4 flex items-center gap-3">
//         <div className="w-8 h-8 shrink-0 rounded-lg bg-white/20 flex items-center justify-center">
//           <FiGlobe className="w-4 h-4 text-white" />
//         </div>
//         <div className="min-w-0">
//           <h2 className="text-white font-bold text-sm sm:text-base truncate">Travel Details</h2>
//           <p className="text-teal-100 text-[11px] sm:text-xs truncate">Departure, dates &amp; traveller information</p>
//         </div>
//       </div>

//       <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
//         <div className="flex flex-col gap-1.5">
//           <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
//             <FiCalendar className="w-3.5 h-3.5 shrink-0 text-teal-500" />
//             Travel Date <span className="text-red-500">*</span>
//           </label>
//           <div className="relative">
//             <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//             <input
//               type="date"
//               className="w-full appearance-none pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
//               {...register("travelDate")}
//             />
//           </div>
//         </div>

//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <div className="flex flex-col gap-1.5 min-w-0">
//             <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
//               <FiGlobe className="w-3.5 h-3.5 shrink-0 text-teal-500" />
//               Departing Country
//             </label>
//             <SearchableSelect
//               options={countries}
//               value={watch("departCountry") || ""}
//               onChange={(value) => {
//                 setValue("departCountry", value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
//               }}
//               placeholder="Select country"
//               loading={loadingCountries}
//               icon={FiGlobe}
//               searchable
//             />
//             {error && <span className="text-xs text-red-500">Failed to load countries: {error}</span>}
//           </div>

//           <div className="flex flex-col gap-1.5 min-w-0">
//             <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
//               <FiMapPin className="w-3.5 h-3.5 shrink-0 text-teal-500" />
//               Departing City
//             </label>
//             <div className="relative">
//               <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//               <input
//                 type="text"
//                 placeholder="Enter departing city"
//                 className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
//                 {...register("departCity")}
//               />
//             </div>
//           </div>
//         </div>

//         {/* --- Main Counters & Yes/No Toggle Grid --- */}
//         {/* Rooms ko side by side rakhne ke liye humne iska order thoda badla hai */}
//         <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
//           <NumberInput label="Male" icon={Mars} value={maleRaw} onChange={(v) => setValue("male", v)} color="blue" />
//           <NumberInput label="Female" icon={Venus} value={femaleRaw} onChange={(v) => setValue("female", v)} color="rose" />
//           <NumberInput label="Children" icon={MdChildCare} value={childrenRaw} onChange={(v) => setValue("children", v)} color="orange" />
//           <NumberInput label="Infants" icon={MdBabyChangingStation} value={infantsRaw} onChange={(v) => setValue("infants", v)} color="green" />
//           <NumberInput label="Extra Beds" icon={MdHotel} value={extraBedsRaw} onChange={(v) => setValue("extraBeds", v)} color="orange" />
          
//           {/* Rooms (Row 3, Col 1 on Large screens) */}
//           <NumberInput label="Rooms" icon={FiHome} value={roomsRaw} onChange={(v) => setValue("rooms", v)} color="blue" />

//           {/* Yes/No Toggle (Rooms ke side mein, bachi hui jagah cover karega) */}
//           <div className="col-span-full lg:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between bg-purple-50 rounded-xl p-3 border border-purple-200 gap-3">
//             <div className="flex items-center gap-2">
//               <Accessibility className="w-5 h-5 text-purple-600" />
//               <span className="text-sm font-semibold text-purple-800">Require Handicap Assistance?</span>
//             </div>
//             <div className="flex bg-white p-1 rounded-lg border border-purple-100 shadow-sm shrink-0">
//               <button
//                 type="button"
//                 onClick={() => {
//                   setValue("needsHandicap", true);
//                   if (toNum(handicapRaw) === 0) setValue("handicap", 1);
//                 }}
//                 className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${
//                   needsHandicap ? "bg-purple-600 text-white shadow" : "text-purple-600 hover:bg-purple-50"
//                 }`}
//               >
//                 Yes
//               </button>
//               <button
//                 type="button"
//                 onClick={() => {
//                   setValue("needsHandicap", false);
//                   setValue("handicap", 0);
//                   // Jab 'No' ho, saare checkboxes bhi clear kar do
//                   setValue("handicapReqs", {}); 
//                 }}
//                 className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${
//                   !needsHandicap ? "bg-purple-600 text-white shadow" : "text-purple-600 hover:bg-purple-50"
//                 }`}
//               >
//                 No
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* --- Handicap Requirements Section (Tabhi dikhega jab Yes select hoga) --- */}
//         {needsHandicap && (
//           <div className="mt-2 p-4 bg-purple-50/60 rounded-xl border border-purple-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            
//             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
//               <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
//                 <span className="w-2 h-2 rounded-full bg-purple-500"></span>
//                 Select Required Assistance
//               </h3>
              
//               {/* Handicap Count bhi humne yahin rakh diya hai taaki flow acha lage */}
//               <div className="w-full sm:w-64">
//                 <NumberInput label="Handicap" icon={Accessibility} value={handicapRaw} onChange={(v) => setValue("handicap", v)} color="purple" />
//               </div>
//             </div>

//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               {[
//                 { id: "wheelchairAccess", label: "Wheelchair Accessible" },
//                 { id: "groundFloor", label: "Ground Floor Room" },
//                 { id: "rollInShower", label: "Roll-in Shower" },
//                 { id: "visualAlerts", label: "Visual/Hearing Alerts" }
//               ].map((req) => (
//                 <label 
//                   key={req.id} 
//                   className="flex items-center gap-3 p-3 rounded-xl border border-purple-100 bg-white cursor-pointer hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
//                 >
//                   <input
//                     type="checkbox"
//                     className="w-4 h-4 text-purple-600 bg-purple-50 border-purple-300 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
//                     {...register(`handicapReqs.${req.id}`)}
//                   />
//                   <span className="text-sm font-medium text-slate-700 group-hover:text-purple-700">
//                     {req.label}
//                   </span>
//                 </label>
//               ))}
//             </div>
//           </div>
//         )}

//         {totalTravellers > 0 && (
//           <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl px-3 sm:px-4 py-3 border border-teal-100 flex items-start sm:items-center gap-3">
//             <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
//               <FiUsers className="w-4 h-4 text-teal-600" />
//             </div>
//             <div className="min-w-0">
//               <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Traveller Summary</p>
//               <p className="text-xs sm:text-sm font-bold text-slate-700 break-words leading-relaxed">{summary}</p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }










// prasad code -------------------------------------
import { useEffect, useState } from "react";
import { 
  Calendar as FiCalendar, 
  Globe as FiGlobe, 
  MapPin as FiMapPin, 
  House as FiHome, 
  Users as FiUsers, 
  PersonStanding as MdChildCare, 
  Baby as MdBabyChangingStation, 
  BedDouble as MdHotel, 
  Accessibility, 
  Check, 
  Mars, 
  Venus, 
  UserRound, 
  UtensilsCrossed, 
  Plane, 
  FileText 
} from "lucide-react";

import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage } from "@shared/api/apiError";
import SearchableSelect from "./SearchableSelect";

const MAX_WHOLE_NUMBER = 999;

const ASSISTANCE_TYPES = [
  "Wheelchair Assistance",
  "Senior Citizen Assistance",
  "Special Meal Requirement",
  "Airport Assistance",
];

/* Icon + one-line hint per type. */
const ASSISTANCE_META = {
  "Wheelchair Assistance": { icon: Accessibility, hint: "Ramp, aisle or cabin" },
  "Senior Citizen Assistance": { icon: UserRound, hint: "Slow boarding, extra support" },
  "Special Meal Requirement": { icon: UtensilsCrossed, hint: "Jain, veg, diabetic" },
  "Airport Assistance": { icon: Plane, hint: "Meet & assist on arrival" },
};

const NOTES_MAX_LENGTH = 500;

const toWholeNumber = (value, min = 0, max = MAX_WHOLE_NUMBER) => {
  const numberValue = Number(value);
  const safeMax = Math.max(min, max);

  if (!Number.isFinite(numberValue)) {
    return min;
  }

  return Math.min(safeMax, Math.max(min, Math.floor(numberValue)));
};

const sanitizeWholeInput = (value, min = 0, max = MAX_WHOLE_NUMBER) => {
  const textValue = String(value ?? "").trim();

  if (!textValue || textValue.startsWith("-")) {
    return min;
  }

  const integerPart = textValue.match(/\d+/)?.[0];

  if (!integerPart) {
    return min;
  }

  return toWholeNumber(integerPart, min, max);
};

const wholeNumberRules = (label, min = 0, max = MAX_WHOLE_NUMBER) => ({
  validate: (value) => {
    const textValue = String(value ?? "").trim();
    const numberValue = Number(value);

    if (textValue.startsWith("-")) {
      return `${label} cannot be negative`;
    }

    if (textValue && !/^\d+$/.test(textValue)) {
      return `${label} must be a whole number`;
    }

    if (!Number.isFinite(numberValue)) {
      return min > 0 ? `${label} must be at least ${min}` : true;
    }

    if (Math.floor(numberValue) !== numberValue) {
      return `${label} must be a whole number`;
    }

    if (numberValue < min) {
      return min > 0 ? `${label} must be at least ${min}` : `${label} cannot be negative`;
    }

    if (numberValue > max) {
      return `${label} cannot exceed ${max}`;
    }

    return true;
  },
});

const getPassengerTotals = (values = {}) => {
  const male = toWholeNumber(values.male);
  const female = toWholeNumber(values.female);
  const totalAdults = male + female;
  const children = toWholeNumber(values.children);
  const infants = toWholeNumber(values.infants);

  return {
    male,
    female,
    totalAdults,
    children,
    infants,
    rooms: toWholeNumber(values.rooms, 1),
    extraBeds: toWholeNumber(values.extraBeds),
    totalTravellers: totalAdults + children + infants,
  };
};

function FieldError({ message }) {
  if (!message) return null;

  return (
    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
      <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />
      {message}
    </p>
  );
}

function PassengerNumberInput({
  name,
  label,
  icon: Icon,
  value,
  setValue,
  register,
  error,
  min = 0,
  max = MAX_WHOLE_NUMBER,
  color = "blue",
  readOnly = false,
  validate,
  // Small muted line under the label. Used by Total Adults to show what the number is made of.
  hint,
}) {
  const colorMap = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", button: "bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-700" },
    green: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", button: "bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-700" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", button: "bg-orange-100 hover:bg-orange-200 active:bg-orange-300 text-orange-700" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", button: "bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-700" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", button: "bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-700" },
    slate: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", button: "bg-slate-100 text-slate-500" },
  };
  const colors = colorMap[color] || colorMap.blue;
  const inputValue = readOnly ? toWholeNumber(value, min, max) : value;
  const numericValue = toWholeNumber(inputValue, min, max);
  const baseRules = wholeNumberRules(label, min, max);
  
  const registration = register(name, {
    validate: (fieldValue) => {
      const baseResult = baseRules.validate(fieldValue);
      return baseResult === true && validate ? validate(fieldValue) : baseResult;
    },
  });

  const updateValue = (nextValue) => {
    setValue(name, nextValue, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  const handleKeyDown = (event) => {
    if (["-", "+", ".", "e", "E"].includes(event.key)) {
      event.preventDefault();
    }
  };

  const handleChange = (event) => {
    updateValue(sanitizeWholeInput(event.target.value, min, max));
  };

  const handleBlur = (event) => {
    registration.onBlur(event);
    updateValue(toWholeNumber(inputValue, min, max));
  };

  return (
    <div className="min-w-0 flex flex-col">
      <div
        className={`${colors.bg} rounded-xl border ${error ? "border-red-300" : colors.border} h-full min-w-0 p-2.5 sm:p-3
          flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2`}
      >
        <div className="min-w-0 max-w-full">
          <label htmlFor={name} className="flex items-center gap-1.5 min-w-0 max-w-full text-[11px] sm:text-xs font-semibold leading-tight text-slate-600">
            <Icon className={`w-4 h-4 shrink-0 ${colors.text}`} />
            <span title={label} className="min-w-0 break-words">{label}</span>
          </label>
          {hint && (
            <p className="text-[10px] font-semibold text-slate-400 leading-tight mt-0.5 pl-[22px] break-words">
              {hint}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              onClick={() => updateValue(Math.max(min, numericValue - 1))}
              className={`w-8 h-8 sm:w-7 sm:h-7 shrink-0 rounded-lg ${colors.button} font-bold text-base sm:text-sm transition-colors flex items-center justify-center select-none`}
            >
              -
            </button>
          )}

          <input
            {...registration}
            id={name}
            type="number"
            min={min}
            max={max}
            step={1}
            inputMode="numeric"
            readOnly={readOnly}
            aria-readonly={readOnly}
            value={inputValue}
            onChange={readOnly ? undefined : handleChange}
            onBlur={handleBlur}
            onKeyDown={readOnly ? undefined : handleKeyDown}
            className={`w-10 sm:w-9 text-center text-base font-bold outline-none [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              ${readOnly ? "cursor-not-allowed bg-white/60 rounded-lg py-1.5 text-slate-500" : `bg-transparent ${colors.text}`}`}
          />

          {!readOnly && (
            <button
              type="button"
              aria-label={`Increase ${label}`}
              onClick={() => updateValue(Math.min(Math.max(min, max), numericValue + 1))}
              className={`w-8 h-8 sm:w-7 sm:h-7 shrink-0 rounded-lg ${colors.button} font-bold text-base sm:text-sm transition-colors flex items-center justify-center select-none`}
            >
              +
            </button>
          )}
        </div>
      </div>
      <FieldError message={error?.message} />
    </div>
  );
}

function SpecialAssistanceToggle({ required, onChange }) {
  return (
    <div className="min-w-0">
      <div className="bg-teal-50 rounded-xl border border-teal-200 min-w-0 p-2.5 sm:p-3 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <label className="flex items-center gap-1.5 min-w-0 max-w-full text-[11px] sm:text-xs font-semibold leading-tight text-slate-600">
          <Accessibility className="w-4 h-4 shrink-0 text-teal-600" />
          <span className="min-w-0 break-words">Special Assistance Required?</span>
        </label>

        <div className="inline-flex shrink-0 rounded-lg border border-teal-200 bg-white p-0.5">
          {[
            { label: "No", value: false },
            { label: "Yes", value: true },
          ].map((option) => {
            const selected = required === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onChange(option.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all
                  ${selected ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:text-teal-700"}`}
                aria-pressed={selected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// UPDATED ASSISTANCE TYPE CARD (SERVICES DESIGN)
// ==========================================
function AssistanceTypeCard({ type, selected, onToggle }) {
  const meta = ASSISTANCE_META[type] || {};
  const Icon = meta.icon || Accessibility;

  return (
    /* A button, exactly like ServicesSection — not a label wrapping a hidden checkbox.
       An sr-only checkbox is still focusable, and clicking the card handed focus to a 1px
       element pulled out of the layout, which made the browser scroll to "reveal" it. The card
       jumped on every pick. aria-pressed carries the on/off state the checkbox used to. */
    <button
      type="button"
      onClick={() => onToggle(type)}
      aria-pressed={selected}
      className={`relative rounded-xl p-3.5 border-2 transition-all duration-200 text-left group cursor-pointer block w-full
        ${selected
          ? "border-teal-500 bg-teal-50 shadow-teal-100 shadow-md scale-[1.02]"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }`}
    >
      {/* Checkmark */}
      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all
        ${selected ? "bg-teal-600 shadow-sm" : "bg-slate-100"}`}
      >
        <Check className={`w-2.5 h-2.5 ${selected ? "text-white" : "text-slate-300"}`} strokeWidth={3} />
      </div>

      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 transition-all
        ${selected ? "bg-teal-100 text-teal-600" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"}`}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Label */}
      <p className={`text-xs font-bold leading-tight ${selected ? "text-teal-700" : "text-slate-600"}`}>
        {type}
      </p>
      {meta.hint && (
        <p className={`text-xs mt-0.5 opacity-80 leading-tight ${selected ? "text-teal-700" : "text-slate-400"}`}>
          {meta.hint}
        </p>
      )}
    </button>
  );
}

function TravelDetails({
  register,
  watch,
  setValue,
  getValues,
  errors = {},
  clearErrors,
  trigger,
}) {
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryError, setCountryError] = useState(null);

  const maleRaw = watch("male") ?? 0;
  const femaleRaw = watch("female") ?? 0;
  const childrenRaw = watch("children") ?? 0;
  const infantsRaw = watch("infants") ?? 0;
  const roomsRaw = watch("rooms") ?? 1;
  const extraBedsRaw = watch("extraBeds") ?? 0;
  
  const specialAssistanceRequired = watch("specialAssistanceRequired") === true;
  const watchedAssistanceTypes = watch("specialAssistanceTypes");
  const specialAssistanceTypes = Array.isArray(watchedAssistanceTypes) ? watchedAssistanceTypes : [];
  const assistancePassengerCountRaw = watch("assistancePassengerCount") ?? 0;
  const specialAssistanceNotes = watch("specialAssistanceNotes") ?? "";

  const notesLength = specialAssistanceNotes.length;
  const notesTone = notesLength >= NOTES_MAX_LENGTH
    ? "text-red-500"
    : notesLength > NOTES_MAX_LENGTH * 0.85
      ? "text-amber-600"
      : "text-slate-400";

  const totals = getPassengerTotals({
    male: maleRaw,
    female: femaleRaw,
    children: childrenRaw,
    infants: infantsRaw,
    rooms: roomsRaw,
    extraBeds: extraBedsRaw,
  });

  useEffect(() => {
    register("specialAssistanceRequired");
    register("specialAssistanceTypes", {
      validate: (types) => {
        const enabled = getValues("specialAssistanceRequired") === true;
        return !enabled || (Array.isArray(types) && types.length > 0) || "Select at least one assistance type";
      },
    });
  }, [getValues, register]);

  useEffect(() => {
    const currentTotalAdults = toWholeNumber(getValues("totalAdults"));
    if (currentTotalAdults !== totals.totalAdults) {
      setValue("totalAdults", totals.totalAdults, { shouldDirty: false, shouldTouch: false, shouldValidate: true });
    }
  }, [getValues, setValue, totals.totalAdults]);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      setLoadingCountries(true);
      setCountryError(null);

      try {
        const response = await geographyService.getCountries();
        const rawCountries = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.data?.data) ? response.data.data : [];

        const countryOptions = rawCountries
          .map((country) => {
            const countryName = typeof country === "string" ? country.trim() : String(country?.label || country?.name || country?.countryName || "").trim();
            return countryName ? { value: countryName, label: countryName } : null;
          })
          .filter(Boolean);

        if (!active) return;
        setCountries(countryOptions);

        const currentCountry = getValues("departCountry");
        const matchingCountry = countryOptions.find((country) => country.value.toLowerCase() === String(currentCountry || "").trim().toLowerCase());
        const indiaOption = countryOptions.find((country) => country.value.toLowerCase() === "india");

        if (matchingCountry) {
          setValue("departCountry", matchingCountry.value, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
        } else if (!currentCountry && indiaOption) {
          setValue("departCountry", indiaOption.value, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
        }
      } catch (error) {
        if (!active) return;
        setCountries([]);
        setCountryError(getErrorMessage(error, "Couldn't load countries."));
      } finally {
        if (active) setLoadingCountries(false);
      }
    };

    loadCountries();
    return () => { active = false; };
  }, [getValues, setValue]);

  useEffect(() => {
    if (specialAssistanceRequired) return;

    setValue("specialAssistanceTypes", [], { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    setValue("assistancePassengerCount", 0, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    setValue("specialAssistanceNotes", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    clearErrors?.(["specialAssistanceTypes", "assistancePassengerCount", "specialAssistanceNotes"]);
  }, [clearErrors, setValue, specialAssistanceRequired]);

  useEffect(() => {
    if (!specialAssistanceRequired || totals.totalTravellers < 1) return;

    const assistancePassengerCount = toWholeNumber(assistancePassengerCountRaw, 1);
    if (assistancePassengerCount > totals.totalTravellers) {
      setValue("assistancePassengerCount", totals.totalTravellers, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }
  }, [assistancePassengerCountRaw, setValue, specialAssistanceRequired, totals.totalTravellers]);

  const setAssistanceRequired = (required) => {
    setValue("specialAssistanceRequired", required, { shouldDirty: true, shouldTouch: true, shouldValidate: true });

    if (required && toWholeNumber(getValues("assistancePassengerCount")) < 1) {
      setValue("assistancePassengerCount", 1, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }

    if (!required) {
      setValue("specialAssistanceTypes", [], { shouldDirty: true, shouldTouch: true, shouldValidate: false });
      setValue("assistancePassengerCount", 0, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
      setValue("specialAssistanceNotes", "", { shouldDirty: true, shouldTouch: true, shouldValidate: false });
      clearErrors?.(["specialAssistanceTypes", "assistancePassengerCount", "specialAssistanceNotes"]);
      return;
    }
    trigger?.(["specialAssistanceTypes", "assistancePassengerCount"]);
  };

  const toggleAssistanceType = (type) => {
    const nextTypes = specialAssistanceTypes.includes(type)
      ? specialAssistanceTypes.filter((item) => item !== type)
      : [...specialAssistanceTypes, type];

    setValue("specialAssistanceTypes", nextTypes, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  const summary = [
    totals.male > 0 && `${totals.male} Male`,
    totals.female > 0 && `${totals.female} Female`,
    totals.children > 0 && `${totals.children} Child${totals.children > 1 ? "ren" : ""}`,
    totals.infants > 0 && `${totals.infants} Infant${totals.infants > 1 ? "s" : ""}`,
    totals.rooms > 0 && `${totals.rooms} Room${totals.rooms > 1 ? "s" : ""}`,
    totals.extraBeds > 0 && `${totals.extraBeds} Extra Bed${totals.extraBeds > 1 ? "s" : ""}`,
  ].filter(Boolean).join(" - ");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3.5 sm:px-6 sm:py-4 flex items-center gap-3">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-white/20 flex items-center justify-center">
          <FiGlobe className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-white font-bold text-sm sm:text-base truncate">Travel Details</h2>
          <p className="text-teal-100 text-[11px] sm:text-xs truncate">Departure, dates &amp; traveller information</p>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
            <FiCalendar className="w-3.5 h-3.5 shrink-0 text-teal-500" />
            Travel Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              className="w-full appearance-none pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
              {...register("travelDate")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
              <FiGlobe className="w-3.5 h-3.5 shrink-0 text-teal-500" />
              Departing Country
            </label>
            <SearchableSelect
              options={countries}
              value={watch("departCountry") || ""}
              onChange={(value) => {
                setValue("departCountry", value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
              }}
              placeholder="Select country"
              loading={loadingCountries}
              icon={FiGlobe}
              searchable
            />
            {countryError && <span className="text-xs text-red-500">Failed to load countries: {countryError}</span>}
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
              <FiMapPin className="w-3.5 h-3.5 shrink-0 text-teal-500" />
              Departing City
            </label>
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter departing city"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                  focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
                {...register("departCity")}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Passenger Details</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            <PassengerNumberInput name="male" label="Male" icon={Mars} value={maleRaw} setValue={setValue} register={register} error={errors.male} color="blue" />
            <PassengerNumberInput name="female" label="Female" icon={Venus} value={femaleRaw} setValue={setValue} register={register} error={errors.female} color="rose" />
            {/* readOnly — it is male + female. The hint spells that out so the number never looks
                like a figure someone forgot to edit. */}
            <PassengerNumberInput
              name="totalAdults"
              label="Total Adults"
              hint={`${totals.male} Male · ${totals.female} Female`}
              icon={FiUsers}
              value={totals.totalAdults}
              setValue={setValue}
              register={register}
              error={errors.totalAdults}
              color="slate"
              readOnly
            />
            <PassengerNumberInput name="children" label="Children" icon={MdChildCare} value={childrenRaw} setValue={setValue} register={register} error={errors.children} color="orange" />
            <PassengerNumberInput name="infants" label="Infants" icon={MdBabyChangingStation} value={infantsRaw} setValue={setValue} register={register} error={errors.infants} color="green" />
            <PassengerNumberInput name="rooms" label="Rooms" icon={FiHome} value={roomsRaw} setValue={setValue} register={register} error={errors.rooms} min={1} color="blue" />
            <PassengerNumberInput name="extraBeds" label="Extra Beds" icon={MdHotel} value={extraBedsRaw} setValue={setValue} register={register} error={errors.extraBeds} color="orange" />
            
            <SpecialAssistanceToggle required={specialAssistanceRequired} onChange={setAssistanceRequired} />
            
            {specialAssistanceRequired && (
              <PassengerNumberInput
                name="assistancePassengerCount"
                label="Assistance Passengers"
                icon={FiUsers}
                value={assistancePassengerCountRaw}
                setValue={setValue}
                register={register}
                error={errors.assistancePassengerCount}
                min={1}
                max={Math.max(1, totals.totalTravellers)}
                color="green"
                validate={(value) => {
                  if (!specialAssistanceRequired) return true;
                  const passengerCount = toWholeNumber(value, 1);
                  if (passengerCount < 1) return "Passenger assistance count must be at least 1";
                  if (passengerCount > totals.totalTravellers) return "Assistance passenger count cannot exceed total travellers";
                  return true;
                }}
              />
            )}
          </div>
        </div>

        {specialAssistanceRequired && (
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 sm:p-4 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-teal-100">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                <Accessibility className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Special Assistance</h4>
              {specialAssistanceTypes.length > 0 && (
                <span className="ml-auto shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white">
                  {specialAssistanceTypes.length} selected
                </span>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Assistance Type <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {ASSISTANCE_TYPES.map((type) => (
                  <AssistanceTypeCard
                    key={type}
                    type={type}
                    selected={specialAssistanceTypes.includes(type)}
                    onToggle={toggleAssistanceType}
                  />
                ))}
              </div>
              <FieldError message={errors.specialAssistanceTypes?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="specialAssistanceNotes" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <FileText className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                Special Assistance Notes
                <span className="text-xs font-medium text-slate-400">(optional)</span>
              </label>

              <div className={`relative rounded-xl border bg-white transition-all
                ${errors.specialAssistanceNotes ? "border-red-300 ring-2 ring-red-50" : "border-slate-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-50"}`}>
                <textarea
                  id="specialAssistanceNotes"
                  rows={3}
                  maxLength={NOTES_MAX_LENGTH}
                  placeholder="Example: One elderly passenger needs wheelchair assistance from check-in to the aircraft door."
                  className="w-full min-h-[96px] px-3.5 py-3 pb-7 rounded-xl bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none resize-none"
                  {...register("specialAssistanceNotes", {
                    maxLength: { value: NOTES_MAX_LENGTH, message: `Special assistance notes cannot exceed ${NOTES_MAX_LENGTH} characters` },
                  })}
                />
                <span className={`absolute bottom-2 right-3 text-[11px] font-semibold tabular-nums transition-colors ${notesTone}`}>
                  {notesLength}/{NOTES_MAX_LENGTH}
                </span>
              </div>
              <FieldError message={errors.specialAssistanceNotes?.message} />
            </div>
          </div>
        )}

        {totals.totalTravellers > 0 && (
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl px-3 sm:px-4 py-3 border border-teal-100 flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <FiUsers className="w-4 h-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Traveller Summary</p>
              <p className="text-xs sm:text-sm font-bold text-slate-700 break-words leading-relaxed">{summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* One component for both Create and Edit.
   There used to be two — CreateLeadTravelDetails and EditTravelDetails — and they drifted onto
   different field names (adultMale/adultFemale vs male/female, totalAdults vs adults). The
   transformer could only read one set, so every lead update silently wrote 0 over the other.
   A single component makes that class of bug impossible. */
export default TravelDetails;