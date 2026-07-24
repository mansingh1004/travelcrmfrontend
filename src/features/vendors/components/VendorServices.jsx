// // src/components/CreateVendor/VendorServices.jsx

// import { useState } from "react";
// import { Check as FiCheck, Plus as FiPlus, Trash2 as FiTrash2, Hotel as FaHotel, Plane as FaPlane, Bus as FaBus, Ship as FaShip, BookUser as FaPassport, TreePalm as FaUmbrellaBeach, Car as FaCar, ConciergeBell as FaConciergeBell, Route as FaRoute, Flag as MdTour } from "lucide-react";


// const PRESET_SERVICES = [
//   { id:"hotel",         label:"Hotel Accommodation", icon:FaHotel,        color:"blue"   },
//   { id:"flight",        label:"Flight Tickets",       icon:FaPlane,        color:"sky"    },
//   { id:"transport",     label:"Ground Transport",     icon:FaBus,          color:"orange" },
//   { id:"sightseeing",   label:"Sightseeing Tours",    icon:MdTour,         color:"green"  },
//   { id:"cruise",        label:"Cruise Packages",      icon:FaShip,         color:"indigo" },
//   { id:"visa",          label:"Visa Assistance",      icon:FaPassport,     color:"purple" },
//   { id:"resort",        label:"Resort / Villa",       icon:FaUmbrellaBeach,color:"teal"   },
//   { id:"car_rental",    label:"Car Rental",           icon:FaCar,          color:"amber"  },
//   { id:"concierge",     label:"Concierge Service",    icon:FaConciergeBell,color:"rose"   },
//   { id:"itinerary",     label:"Itinerary Planning",   icon:FaRoute,        color:"slate"  },
// ];

// const COLOR_MAP = {
//   blue:  { card:"border-blue-200 bg-blue-50",   icon:"bg-blue-100 text-blue-600",   check:"bg-blue-600",   text:"text-blue-700"   },
//   sky:   { card:"border-sky-200 bg-sky-50",     icon:"bg-sky-100 text-sky-600",     check:"bg-sky-600",    text:"text-sky-700"    },
//   orange:{ card:"border-orange-200 bg-orange-50",icon:"bg-orange-100 text-orange-600",check:"bg-orange-600",text:"text-orange-700" },
//   green: { card:"border-green-200 bg-green-50", icon:"bg-green-100 text-green-600", check:"bg-green-600",  text:"text-green-700"  },
//   indigo:{ card:"border-indigo-200 bg-indigo-50",icon:"bg-indigo-100 text-indigo-600",check:"bg-indigo-600",text:"text-indigo-700" },
//   purple:{ card:"border-purple-200 bg-purple-50",icon:"bg-purple-100 text-purple-600",check:"bg-purple-600",text:"text-purple-700" },
//   teal:  { card:"border-teal-200 bg-teal-50",   icon:"bg-teal-100 text-teal-600",   check:"bg-teal-600",   text:"text-teal-700"   },
//   amber: { card:"border-amber-200 bg-amber-50", icon:"bg-amber-100 text-amber-600", check:"bg-amber-600",  text:"text-amber-700"  },
//   rose:  { card:"border-rose-200 bg-rose-50",   icon:"bg-rose-100 text-rose-600",   check:"bg-rose-600",   text:"text-rose-700"   },
//   slate: { card:"border-slate-200 bg-slate-50", icon:"bg-slate-100 text-slate-600", check:"bg-slate-600",  text:"text-slate-700"  },
// };

// export default function VendorServices({ selectedServices, onToggle, register }) {
//   const [custom, setCustom] = useState("");

//   const handleAddCustom = () => {
//     const trimmed = custom.trim();
//     if (!trimmed) return;
//     onToggle(`custom_${trimmed}`, trimmed);
//     setCustom("");
//   };

//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//       <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4 flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">⚙️</div>
//           <div>
//             <h2 className="text-white font-extrabold text-base">Services Offered</h2>
//             <p className="text-green-100 text-xs">Select all services this vendor provides</p>
//           </div>
//         </div>
//         {selectedServices.length > 0 && (
//           <span className="text-xs bg-white/20 text-white font-bold px-3 py-1.5 rounded-full">
//             {selectedServices.length} selected
//           </span>
//         )}
//       </div>

//       <div className="p-6 space-y-5">
//         {selectedServices.length === 0 && (
//           <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium flex items-center gap-2">
//             ⚠️ Please select at least one service this vendor offers.
//           </div>
//         )}

//         {/* Preset service cards */}
//         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
//           {PRESET_SERVICES.map(svc => {
//             const isSelected = selectedServices.some(s => s.id === svc.id);
//             const c = COLOR_MAP[svc.color];
//             const Icon = svc.icon;
//             return (
//               <button key={svc.id} type="button"
//                 onClick={() => onToggle(svc.id, svc.label)}
//                 className={`relative rounded-xl p-3 border-2 text-left transition-all duration-200
//                   ${isSelected
//                     ? `${c.card} shadow-md ring-2 ring-offset-1 ring-current scale-[1.02]`
//                     : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}>
//                 {/* Check */}
//                 <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center
//                   ${isSelected ? c.check : "bg-slate-100"}`}>
//                   <FiCheck className={`w-2.5 h-2.5 ${isSelected ? "text-white" : "text-slate-300"}`} />
//                 </div>
//                 {/* Icon */}
//                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2
//                   ${isSelected ? c.icon : "bg-slate-100 text-slate-400"}`}>
//                   <Icon className="w-4 h-4" />
//                 </div>
//                 <p className={`text-xs font-bold leading-tight ${isSelected ? c.text : "text-slate-600"}`}>
//                   {svc.label}
//                 </p>
//               </button>
//             );
//           })}
//         </div>

//         {/* Custom service input */}
//         <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
//           <p className="text-xs font-bold text-slate-600 mb-2.5">➕ Add Custom Service</p>
//           <div className="flex gap-2">
//             <input
//               type="text"
//               value={custom}
//               onChange={e => setCustom(e.target.value)}
//               onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddCustom())}
//               placeholder="e.g. Helicopter Transfer, Houseboats, Camping..."
//               className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//                 text-slate-700 placeholder-slate-400 focus:border-green-400 focus:ring-2
//                 focus:ring-green-50 outline-none transition-all"
//             />
//             <button type="button" onClick={handleAddCustom}
//               className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm
//                 font-bold transition-all flex items-center gap-2 shadow-sm">
//               <FiPlus className="w-4 h-4" /> Add
//             </button>
//           </div>
//         </div>

//         {/* Detailed description */}
//         <div className="flex flex-col gap-1.5">
//           <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
//             Detailed Service Description
//           </label>
//           <textarea rows={4} {...register("serviceDescription")}
//             placeholder="Detailed description of all services offered, specialties, unique offerings, packages available..."
//             className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
//               text-slate-700 placeholder-slate-400 focus:border-green-400 focus:ring-2
//               focus:ring-green-50 outline-none transition-all resize-none" />
//         </div>

//         {/* Selected chips */}
//         {selectedServices.length > 0 && (
//           <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
//             {selectedServices.map(svc => (
//               <span key={svc.id}
//                 className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
//                   bg-green-100 text-green-700 border border-green-200">
//                 ✓ {svc.label}
//                 <button type="button" onClick={() => onToggle(svc.id, svc.label)}
//                   className="text-green-500 hover:text-green-700 ml-0.5">
//                   <FiTrash2 className="w-2.5 h-2.5" />
//                 </button>
//               </span>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }








// src/components/CreateVendor/VendorServices.jsx

import { useState } from "react";
import { Check as FiCheck, Plus as FiPlus, Trash2 as FiTrash2, Hotel as FaHotel, Plane as FaPlane, Bus as FaBus, Ship as FaShip, BookUser as FaPassport, TreePalm as FaUmbrellaBeach, Car as FaCar, ConciergeBell as FaConciergeBell, Route as FaRoute, Flag as MdTour } from "lucide-react";

const PRESET_SERVICES = [
  { id:"hotel",        label:"Hotel Accommodation", icon:FaHotel,        color:"blue"   },
  { id:"flight",       label:"Flight Tickets",      icon:FaPlane,        color:"sky"    },
  { id:"transport",    label:"Ground Transport",    icon:FaBus,          color:"orange" },
  { id:"sightseeing",  label:"Sightseeing Tours",   icon:MdTour,         color:"green"  },
  { id:"cruise",       label:"Cruise Packages",     icon:FaShip,         color:"indigo" },
  { id:"visa",         label:"Visa Assistance",     icon:FaPassport,     color:"purple" },
  { id:"resort",       label:"Resort / Villa",      icon:FaUmbrellaBeach,color:"teal"   },
  { id:"car_rental",   label:"Car Rental",          icon:FaCar,          color:"amber"  },
  { id:"concierge",    label:"Concierge Service",   icon:FaConciergeBell,color:"rose"   },
  { id:"itinerary",    label:"Itinerary Planning",  icon:FaRoute,        color:"slate"  },
];

const COLOR_MAP = {
  blue:  { card:"border-blue-200 bg-blue-50",   icon:"bg-blue-100 text-blue-600",   check:"bg-blue-600",   text:"text-blue-700"   },
  sky:   { card:"border-sky-200 bg-sky-50",     icon:"bg-sky-100 text-sky-600",     check:"bg-sky-600",    text:"text-sky-700"    },
  orange:{ card:"border-orange-200 bg-orange-50",icon:"bg-orange-100 text-orange-600",check:"bg-orange-600",text:"text-orange-700" },
  green: { card:"border-green-200 bg-green-50", icon:"bg-green-100 text-green-600", check:"bg-green-600",  text:"text-green-700"  },
  indigo:{ card:"border-indigo-200 bg-indigo-50",icon:"bg-indigo-100 text-indigo-600",check:"bg-indigo-600",text:"text-indigo-700" },
  purple:{ card:"border-purple-200 bg-purple-50",icon:"bg-purple-100 text-purple-600",check:"bg-purple-600",text:"text-purple-700" },
  teal:  { card:"border-teal-200 bg-teal-50",   icon:"bg-teal-100 text-teal-600",   check:"bg-teal-600",   text:"text-teal-700"   },
  amber: { card:"border-amber-200 bg-amber-50", icon:"bg-amber-100 text-amber-600", check:"bg-amber-600",  text:"text-amber-700"  },
  rose:  { card:"border-rose-200 bg-rose-50",   icon:"bg-rose-100 text-rose-600",   check:"bg-rose-600",   text:"text-rose-700"   },
  slate: { card:"border-slate-200 bg-slate-50", icon:"bg-slate-100 text-slate-600", check:"bg-slate-600",  text:"text-slate-700"  },
};

export default function VendorServices({ selectedServices, onToggle, register }) {
  const [custom, setCustom] = useState("");

  const handleAddCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed) return;
    onToggle(`custom_${trimmed}`, trimmed);
    setCustom("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header Updated for Responsiveness */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">⚙️</div>
          <div className="min-w-0">
            <h2 className="text-white font-extrabold text-base sm:text-lg truncate">Services Offered</h2>
            <p className="text-green-100 text-xs sm:text-sm truncate mt-0.5">Select all services  this vendor provides</p>
          </div>
        </div>
        {selectedServices.length > 0 && (
          <span className="text-xs bg-white/20 text-white font-bold px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap">
            {selectedServices.length} selected
          </span>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {selectedServices.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium flex items-center gap-2">
            ⚠️ Please select at least one service this vendor offers.
          </div>
        )}

        {/* Preset service cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PRESET_SERVICES.map(svc => {
            const isSelected = selectedServices.some(s => s.id === svc.id);
            const c = COLOR_MAP[svc.color];
            const Icon = svc.icon;
            return (
              <button key={svc.id} type="button"
                onClick={() => onToggle(svc.id, svc.label)}
                className={`relative rounded-xl p-3 border-2 text-left transition-all duration-200
                  ${isSelected
                    ? `${c.card} shadow-md ring-2 ring-offset-1 ring-current scale-[1.02]`
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}>
                {/* Check */}
                <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center
                  ${isSelected ? c.check : "bg-slate-100"}`}>
                  <FiCheck className={`w-2.5 h-2.5 ${isSelected ? "text-white" : "text-slate-300"}`} />
                </div>
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2
                  ${isSelected ? c.icon : "bg-slate-100 text-slate-400"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className={`text-xs font-bold leading-tight ${isSelected ? c.text : "text-slate-600"}`}>
                  {svc.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom service input - FIXED FOR MOBILE */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-bold text-slate-600 mb-2.5">➕ Add Custom Service</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddCustom())}
              placeholder="e.g. Helicopter Transfer, Houseboats..."
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                text-slate-700 placeholder-slate-400 focus:border-green-400 focus:ring-2
                focus:ring-green-50 outline-none transition-all"
            />
            <button type="button" onClick={handleAddCustom}
              className="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm
                font-bold transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
              <FiPlus className="w-4 h-4 shrink-0" /> Add
            </button>
          </div>
        </div>

        {/* Detailed description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Detailed Service Description
          </label>
          <textarea rows={4} {...register("serviceDescription")}
            placeholder="Detailed description of all services offered, specialties, unique offerings, packages available..."
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
              text-slate-700 placeholder-slate-400 focus:border-green-400 focus:ring-2
              focus:ring-green-50 outline-none transition-all resize-none" />
        </div>

        {/* Selected chips */}
        {selectedServices.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
            {selectedServices.map(svc => (
              <span key={svc.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
                  bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
                ✓ {svc.label}
                <button type="button" onClick={() => onToggle(svc.id, svc.label)}
                  className="text-green-500 hover:text-green-700 ml-0.5 shrink-0">
                  <FiTrash2 className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}