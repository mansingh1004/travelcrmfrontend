import { useEffect, useState } from "react";
import {
  Accessibility,
  Bus,
  CalendarDays,
  Car,
  ChevronDown,
  Clock3,
  Globe2,
  MapPin,
  Plane,
  TrainFront,
} from "lucide-react";

import { geographyService } from "@shared/api/geographyService";
import TravellerCountFields from "@shared/ui/TravellerCountFields";
import { SearchableSelect } from "@features/leads";

const MODES = ["Flight / Airport", "Train / Rail", "Car / Road", "Bus", "Other"];
const ASSISTANCE_TYPES = [
  "Wheelchair Assistance",
  "Senior Citizen Assistance",
  "Special Meal Requirement",
  "Airport Assistance",
];

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

function IconField({ label, icon: Icon, required, error, children }) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-slate-400" /> {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function FastTravelDetails({ form, setField, errors = {}, onBlurField }) {
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  useEffect(() => {
    let active = true;
    geographyService.getCountries()
      .then((list) => {
        if (active) setCountries(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setCountries([]);
      })
      .finally(() => {
        if (active) setLoadingCountries(false);
      });
    return () => { active = false; };
  }, []);

  // OLD — replaced in create-form redesign
  // const changeMode = (mode) => {
  //   setField("departureMode", mode);
  //   const fields = {
  //     "Flight / Airport": ["departureAirport", "airportCode", "preferredFlightTime"],
  //     "Train / Rail": ["railwayStation", "trainClass", "preferredTrainTime"],
  //     "Car / Road": ["pickupAddress", "pickupDateTime", "vehiclePreference"],
  //   };
  //   const active = new Set(fields[mode] || []);
  //   Object.values(fields).flat().forEach((name) => {
  //     if (!active.has(name) && form[name]) setField(name, "");
  //   });
  // };
  //
  // A native <select> fires onChange for EVERY option the keyboard passes through. Arrowing from
  // "Flight / Airport" down to "Car / Road" therefore landed on "Train / Rail" on the way and wiped
  // the airport, code and time the clerk had already typed — destructive, silent, and only on the
  // keyboard path we are otherwise asking people to use.
  //
  // The clearing was also redundant: handleSubmit already spreads ONLY the active mode's keys into
  // tripSnapshot.departure (CreateBookingClean.jsx), so a stale railwayStation sitting in state was
  // never going to reach the payload. Dropping the wipe fixes the bug and costs nothing.
  const changeMode = (mode) => setField("departureMode", mode);

  const toggleAssistance = (type) => {
    const selected = form.specialAssistanceTypes.includes(type);
    setField(
      "specialAssistanceTypes",
      selected
        ? form.specialAssistanceTypes.filter((item) => item !== type)
        : [...form.specialAssistanceTypes, type]
    );
  };

  const toggleAdultBreakdown = (checked) => {
    setField("showAdultBreakdown", checked);
    setField("male", checked ? String(Number(form.male) || 0) : null);
    setField("female", checked ? String(Number(form.female) || 0) : null);
  };

  const totalAdults = Number(form.totalAdults) || 0;
  const totalTravellers = totalAdults + (Number(form.children) || 0) + (Number(form.infants) || 0);
  const savedCountryMissing = form.departCountry && !countries.some((country) => country.name === form.departCountry);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Travel Details & Travellers</h2>
          <p className="mt-0.5 text-xs text-slate-500">Type through the fields in one keyboard-friendly sequence</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
          {totalTravellers} traveller{totalTravellers === 1 ? "" : "s"} · {form.rooms || 0} room{Number(form.rooms) === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IconField label="Travel Date" icon={CalendarDays} required error={errors.travelDate}>
            {/* OLD — replaced in create-form redesign: same input without `min`. validate() already
                rejects a past travel date, but only on submit; `min` stops the picker offering one
                at all, which is the cheaper correction for a clerk moving fast. */}
            <input name="travelDate" type="date" min={new Date().toISOString().slice(0, 10)} value={form.travelDate} onChange={(event) => setField("travelDate", event.target.value)} onBlur={() => onBlurField?.("travelDate")} aria-invalid={Boolean(errors.travelDate)} className={`${inputClass} ${errors.travelDate ? "border-red-300" : ""}`} />
          </IconField>

          <IconField label="Departure Country" icon={Globe2}>
            <SearchableSelect
              options={[
                ...(savedCountryMissing ? [{ value: form.departCountry, label: form.departCountry }] : []),
                ...countries.map((country) => ({ value: country.name, label: country.name })),
              ]}
              value={form.departCountry}
              onChange={(value) => setField("departCountry", value)}
              placeholder="Select country"
              loading={loadingCountries}
              searchable
            />
          </IconField>

          <IconField label="Departure City" icon={MapPin}>
            <input value={form.departCity} onChange={(event) => setField("departCity", event.target.value)} placeholder="e.g. Pune" className={inputClass} />
          </IconField>

          <IconField label="Departure Mode" icon={Bus}>
            <div className="relative">
              <select value={form.departureMode} onChange={(event) => changeMode(event.target.value)} className={`${inputClass} appearance-none pr-9`}>
                <option value="">Select mode</option>
                {MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </IconField>
        </div>

        {form.departureMode === "Flight / Airport" && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-sky-100 bg-sky-50/50 p-3 sm:grid-cols-3">
            <IconField label="Departure Airport" icon={Plane}>
              {/* OLD — replaced in create-form redesign
                  <input autoFocus value={form.departureAirport} ... />
                  autoFocus here stole focus the instant the block mounted. On the keyboard path the
                  mode <select> fires onChange per arrow key, so choosing a mode with arrows yanked
                  the caret out of the select after the first keypress — you could not keep arrowing
                  to the mode you actually wanted. It also scrolled the page on every mount. */}
              <input value={form.departureAirport} onChange={(event) => setField("departureAirport", event.target.value)} placeholder="Airport name" className={inputClass} />
            </IconField>
            <IconField label="Airport Code (optional)" icon={Plane}>
              <input value={form.airportCode} onChange={(event) => setField("airportCode", event.target.value.toUpperCase())} maxLength={8} placeholder="DEL" className={`${inputClass} uppercase`} />
            </IconField>
            <IconField label="Preferred Flight Time" icon={Clock3}>
              <input type="time" value={form.preferredFlightTime} onChange={(event) => setField("preferredFlightTime", event.target.value)} className={inputClass} />
            </IconField>
          </div>
        )}

        {form.departureMode === "Train / Rail" && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-violet-100 bg-violet-50/50 p-3 sm:grid-cols-3">
            <IconField label="Railway Station" icon={TrainFront}>
              {/* OLD — replaced in create-form redesign: <input autoFocus ... /> — see the airport
                  field above for why autoFocus had to go. */}
              <input value={form.railwayStation} onChange={(event) => setField("railwayStation", event.target.value)} placeholder="Station name" className={inputClass} />
            </IconField>
            <IconField label="Train Class (optional)" icon={TrainFront}>
              <input value={form.trainClass} onChange={(event) => setField("trainClass", event.target.value)} placeholder="2A, 3A, Sleeper" className={inputClass} />
            </IconField>
            <IconField label="Preferred Train Time" icon={Clock3}>
              <input type="time" value={form.preferredTrainTime} onChange={(event) => setField("preferredTrainTime", event.target.value)} className={inputClass} />
            </IconField>
          </div>
        )}

        {form.departureMode === "Car / Road" && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-3">
            <IconField label="Pickup Address" icon={MapPin}>
              {/* OLD — replaced in create-form redesign: <input autoFocus ... /> — see the airport
                  field above for why autoFocus had to go. */}
              <input value={form.pickupAddress} onChange={(event) => setField("pickupAddress", event.target.value)} placeholder="Pickup address" className={inputClass} />
            </IconField>
            <IconField label="Pickup Date & Time" icon={CalendarDays}>
              <input type="datetime-local" value={form.pickupDateTime} onChange={(event) => setField("pickupDateTime", event.target.value)} className={inputClass} />
            </IconField>
            <IconField label="Vehicle Preference" icon={Car}>
              <input value={form.vehiclePreference} onChange={(event) => setField("vehiclePreference", event.target.value)} placeholder="Sedan, SUV, Traveller" className={inputClass} />
            </IconField>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Travellers & Rooms</h3>
            <p className="text-[11px] text-slate-400">Click a number and type to replace it</p>
          </div>
          <TravellerCountFields
            values={form}
            onCountChange={setField}
            onToggleBreakdown={toggleAdultBreakdown}
            theme="teal"
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.specialAssistanceRequired} onChange={(event) => {
              const checked = event.target.checked;
              setField("specialAssistanceRequired", checked);
              if (!checked) {
                setField("specialAssistanceTypes", []);
                setField("assistancePassengerCount", "0");
                setField("specialAssistanceNotes", "");
              } else if (!(Number(form.assistancePassengerCount) > 0)) {
                setField("assistancePassengerCount", "1");
              }
            }} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
            <Accessibility className="h-4 w-4 text-teal-600" /> Special assistance required
          </label>

          {form.specialAssistanceRequired && (
            <div className="mt-3 grid gap-3 rounded-lg border border-teal-100 bg-teal-50/40 p-3 lg:grid-cols-[1fr_150px_1fr]">
              <div className="flex flex-wrap gap-2">
                {ASSISTANCE_TYPES.map((type) => {
                  const selected = form.specialAssistanceTypes.includes(type);
                  return <button key={type} type="button" onClick={() => toggleAssistance(type)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{type}</button>;
                })}
              </div>
              <div>
                <label className={labelClass}>Passengers</label>
                <input type="number" min="1" max={Math.max(totalTravellers, 1)} value={form.assistancePassengerCount} onFocus={(event) => event.target.select()} onChange={(event) => setField("assistancePassengerCount", event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Assistance Notes</label>
                <input value={form.specialAssistanceNotes} onChange={(event) => setField("specialAssistanceNotes", event.target.value)} placeholder="Specific support required" className={inputClass} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
