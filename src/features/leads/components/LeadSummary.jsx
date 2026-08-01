import { User as FiUser, Calendar as FiCalendar, Users as FiUsers, MapPin as FiMapPin, LayoutGrid as FiGrid, CircleCheck as FiCheckCircle, IndianRupee as FaRupeeSign, BedDouble as MdHotel, Plane as MdFlight, Ship as MdDirectionsBoat, MapPin as MdLocationOn, Car as MdDirectionsCar, Shield as MdSecurity, Luggage as MdCardTravel, Eye as MdVisibility } from "lucide-react";


const SERVICE_ICONS = {
  hotel: MdHotel, flight: MdFlight, cruise: MdDirectionsBoat,
  visa: MdCardTravel, sightseeing: MdVisibility, vehicle: MdDirectionsCar,
  insurance: MdSecurity, passport: MdLocationOn,
};

const SERVICE_LABELS = {
  hotel: "Hotel", flight: "Flight", cruise: "Cruise", visa: "Visa",
  sightseeing: "Sightseeing", vehicle: "Vehicle Rental",
  insurance: "Travel Insurance", passport: "Passport Assistance",
};

const fmtINR = (n) =>
  n == null || n === "" || Number.isNaN(Number(n)) ? null : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function SummaryRow({ icon: Icon, label, value, accent = false }) {
  if (!value) return null;
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
        ${accent ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}

export default function LeadSummary({ watch, selectedServices, itinerary }) {
  const name = watch("customerName");
  const travelDate = watch("travelDate");
  // Empty string / undefined ko 0 maano — TravelDetails ke counters 0 se shuru hote
  // hain, isliye yahan `|| 2` jaisa fallback rakha to preview galat count dikhata hai.
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  const rooms = num(watch("rooms"));
  const male = num(watch("male"));
  const female = num(watch("female"));
  const children = num(watch("children"));
  const infants = num(watch("infants"));
  const stage = watch("leadStage");
  const source = watch("leadSource");
  // ── NEW: budget ──
  const budget = watch("budget");

  // Adults = Male + Female (TravelDetails mein counter ab gender-wise hai)
  const adults = male + female;

  const travellers = [
    male > 0 && `${male} Male`,
    female > 0 && `${female} Female`,
    children > 0 && `${children} Child${children > 1 ? "ren" : ""}`,
    infants > 0 && `${infants} Infant${infants > 1 ? "s" : ""}`,
  ].filter(Boolean).join(", ");

  const completedDestinations = itinerary.filter((r) => r.destination).length;
  const totalNights = itinerary.reduce((sum, r) => sum + (r.nights || 1), 0);

  const totalTravellers = adults + children + infants;

  const completeness = [
    !!name,
    !!travelDate,
    totalTravellers > 0,
    selectedServices.length > 0,
    completedDestinations > 0,
  ];
  const completePct = Math.round((completeness.filter(Boolean).length / completeness.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">Lead Completeness</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${completePct === 100 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
          >
            {completePct}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completePct === 100 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${completePct}%` }}
          />
        </div>
        <div className="mt-3 space-y-1">
          {[
            ["Customer Name", !!name],
            ["Travel Date", !!travelDate],
            ["Travellers", totalTravellers > 0],
            ["Services", selectedServices.length > 0],
            ["Itinerary", completedDestinations > 0],
          ].map(([label, done]) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center
                ${done ? "bg-green-500" : "bg-slate-200"}`}
              >
                {done && <FiCheckCircle className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={`text-xs ${done ? "text-slate-600" : "text-slate-400"}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-5 py-3.5">
          <h3 className="text-white font-bold text-sm">Lead Summary</h3>
          <p className="text-slate-300 text-xs">Live preview</p>
        </div>

        <div className="p-4">
          {!name && !travelDate && selectedServices.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                <FiUser className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400">Fill in the form to see a live preview here</p>
            </div>
          ) : (
            <div>
              <SummaryRow icon={FiUser} label="Customer" value={name || "—"} accent />
              <SummaryRow icon={FiCalendar} label="Travel Date" value={travelDate || "—"} />
              <SummaryRow icon={FiUsers} label="Travellers" value={travellers || `${rooms} Room(s)`} />
              {/* ── NEW: Budget row in live preview ── */}
              <SummaryRow icon={FaRupeeSign} label="Budget" value={fmtINR(budget)} accent />
              {completedDestinations > 0 && (
                <SummaryRow
                  icon={FiMapPin}
                  label="Itinerary"
                  value={`${completedDestinations} Destination${completedDestinations > 1 ? "s" : ""} · ${totalNights} Nights`}
                />
              )}
              {stage && <SummaryRow icon={FiGrid} label="Stage" value={stage} />}
              {source && <SummaryRow icon={FiGrid} label="Source" value={source} />}
            </div>
          )}
        </div>
      </div>

      {/* Services */}
      {selectedServices.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <FiGrid className="w-4 h-4 text-green-500" />
            Selected Services
            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full ml-auto">
              {selectedServices.length}
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {selectedServices.map((id) => {
              const Icon = SERVICE_ICONS[id];
              return (
                <div key={id} className="flex items-center gap-2 bg-green-50 rounded-lg px-2.5 py-2 border border-green-100">
                  <Icon className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-green-700 truncate">{SERVICE_LABELS[id]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}