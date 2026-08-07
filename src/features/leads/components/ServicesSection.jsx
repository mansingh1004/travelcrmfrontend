
import { Check as FiCheck, LayoutGrid as FiGrid, BedDouble as MdHotel, Plane as MdFlight, Ship as MdDirectionsBoat, MapPin as MdLocationOn, Car as MdDirectionsCar, Shield as MdSecurity, Luggage as MdCardTravel, Eye as MdVisibility } from "lucide-react";


const SERVICES = [
  { id: "hotel", label: "Hotel", icon: MdHotel, color: "blue", desc: "Accommodation booking" },
  { id: "flight", label: "Flight", icon: MdFlight, color: "sky", desc: "Air ticket booking" },
  { id: "cruise", label: "Cruise", icon: MdDirectionsBoat, color: "teal", desc: "Cruise packages" },
  { id: "visa", label: "Visa", icon: MdCardTravel, color: "indigo", desc: "Visa assistance" },
  { id: "sightseeing", label: "Sightseeing", icon: MdVisibility, color: "green", desc: "Tours & activities" },
  { id: "vehicle", label: "Vehicle Rental", icon: MdDirectionsCar, color: "orange", desc: "Transport & transfers" },
  { id: "insurance", label: "Travel Insurance", icon: MdSecurity, color: "purple", desc: "Travel protection" },
  { id: "passport", label: "Passport Assistance", icon: MdLocationOn, color: "rose", desc: "Document support" },
];

const colorMap = {
  blue: {
    card: "border-blue-200 bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    check: "bg-blue-600",
    text: "text-blue-700",
    selected: "border-blue-500 bg-blue-50 shadow-blue-100",
  },
  sky: {
    card: "border-sky-200 bg-sky-50",
    icon: "bg-sky-100 text-sky-600",
    check: "bg-sky-600",
    text: "text-sky-700",
    selected: "border-sky-500 bg-sky-50 shadow-sky-100",
  },
  teal: {
    card: "border-teal-200 bg-teal-50",
    icon: "bg-teal-100 text-teal-600",
    check: "bg-teal-600",
    text: "text-teal-700",
    selected: "border-teal-500 bg-teal-50 shadow-teal-100",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50",
    icon: "bg-indigo-100 text-indigo-600",
    check: "bg-indigo-600",
    text: "text-indigo-700",
    selected: "border-indigo-500 bg-indigo-50 shadow-indigo-100",
  },
  green: {
    card: "border-green-200 bg-green-50",
    icon: "bg-green-100 text-green-600",
    check: "bg-green-600",
    text: "text-green-700",
    selected: "border-green-500 bg-green-50 shadow-green-100",
  },
  orange: {
    card: "border-orange-200 bg-orange-50",
    icon: "bg-orange-100 text-orange-600",
    check: "bg-orange-600",
    text: "text-orange-700",
    selected: "border-orange-500 bg-orange-50 shadow-orange-100",
  },
  purple: {
    card: "border-purple-200 bg-purple-50",
    icon: "bg-purple-100 text-purple-600",
    check: "bg-purple-600",
    text: "text-purple-700",
    selected: "border-purple-500 bg-purple-50 shadow-purple-100",
  },
  rose: {
    card: "border-rose-200 bg-rose-50",
    icon: "bg-rose-100 text-rose-600",
    check: "bg-rose-600",
    text: "text-rose-700",
    selected: "border-rose-500 bg-rose-50 shadow-rose-100",
  },
};

export default function ServicesSection({ selectedServices, onToggle }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <FiGrid className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Services Required</h2>
          <p className="text-green-100 text-xs">Select all applicable travel services</p>
        </div>
      </div>

      <div className="p-6">
        {selectedServices.length === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <span className="text-amber-500">⚠</span>
            Please select at least one service required for this lead.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SERVICES.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            const c = colorMap[service.color];
            const Icon = service.icon;

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onToggle(service.id)}
                
                className={`relative rounded-xl p-3.5 border-2 transition-all duration-200 text-left group
                  ${isSelected
                    ? `${c.selected} shadow-md scale-[1.02]`
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
              >
                {/* Checkmark */}
                <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all
                  ${isSelected ? `${c.check} shadow-sm` : "bg-slate-100"}`}
                >
                  <FiCheck className={`w-2.5 h-2.5 ${isSelected ? "text-white" : "text-slate-300"}`} />
                </div>

                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl ${isSelected ? c.icon : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"} 
                  flex items-center justify-center mb-2.5 transition-all`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                <p className={`text-xs font-bold ${isSelected ? c.text : "text-slate-600"} leading-tight`}>
                  {service.label}
                </p>
                <p className={`text-xs mt-0.5 ${isSelected ? c.text : "text-slate-400"} opacity-80 leading-tight`}>
                  {service.desc}
                </p>
              </button>
            );
          })}
        </div>

        {selectedServices.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedServices.map((id) => {
              const svc = SERVICES.find((s) => s.id === id);
              if (!svc) return null;
              const c = colorMap[svc.color];
              const Icon = svc.icon;
                        // console.log("LEAD SERVICES:", selectedServices, "| Flight ON?", svcOn("Flight"));

              return (
                <span key={id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.icon} border border-current`}>
                  <Icon className="w-3 h-3" />
                  {svc.label}
                </span>
              );
            })}
            
          </div>
        )}



      </div>
    </div>
  );
}