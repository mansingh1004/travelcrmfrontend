import { useEffect, useMemo, useState } from "react";
import {
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
import { SearchableSelect } from "@features/leads";
import { tripDuration, durationLabel } from "../lib/bookingTripModel";


const MODES = ["Flight / Airport", "Train / Rail", "Car / Road", "Bus", "Other"];
// ASSISTANCE_TYPES moved to CreateBookingClean with the Special assistance block it labels.

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

/**
 * A labelled band inside this panel.
 *
 * The redesign first put Pickup/Drop, Vehicles and Rooms in three panels of their own, which broke
 * one job — "describe the trip" — into four cards the eye had to reassemble. They are all Travel
 * Details, so they are all bands of this one panel now, separated by a rule and a small heading.
 */
function Band({ title, hint, children }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
        {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

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

export default function FastTravelDetails({
  form, setField, errors = {}, onBlurField,
  /* Vehicle and Room Requirement used to be two bands at the bottom of this panel. They now live
     together in their own "Vehicle & Room Requirement" card above Travel Details — the same two
     headings appearing in two places on one page read as two different questions. Each of those
     bands reports its own total now, so nothing about them comes down here at all. */
  /* Destination + Package Type, rendered by the PAGE and slotted into the first row here.
     They came from the removed Booking Details card and belong beside the travel dates, but their
     state, master loading and validation all live in the page — passing them as markup keeps that
     ownership rather than threading eight props (options, loading, error, blur, …) through. */
  primaryFields = null,
}) {
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  /* "5 Nights / 6 Days", derived from the two dates rather than stored, so the label and the dates
     can never disagree. Blank while either date is missing or the range is inverted — a duration
     of "-2 Nights" is worse than none. */
  const durationText = useMemo(
    () => durationLabel(tripDuration(form.travelDate, form.tripEndDate)),
    [form.travelDate, form.tripEndDate]
  );

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
  //   setField("pickupMode", mode);
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
  const changeMode = (mode) => setField("pickupMode", mode);

  /* The header badge is gone along with its two inputs. It reported rooms and then travellers, and
     both of those are now edited in OTHER cards — a number that changes here when you type over
     there is exactly the confusion the Requirement totals were moved to fix. The trip DURATION
     badge below still belongs: it is derived from the two dates in this panel. */
  const savedCountryMissing = form.pickupCountry && !countries.some((country) => country.name === form.pickupCountry);

  /* The option value is the country NAME, not its id — departCountry is a name string all the way
     into the payload. A saved country the master no longer lists keeps its own row so the field
     never renders empty over real data. */
  const countryOptions = useMemo(() => [
    ...(savedCountryMissing ? [{ value: form.pickupCountry, label: form.pickupCountry }] : []),
    ...countries.map((country) => ({ value: country.name, label: country.name })),
  ], [countries, form.pickupCountry, savedCountryMissing]);


  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Travel Details</h2>
          <p className="mt-0.5 text-xs text-slate-500">Type through the fields in one keyboard-friendly sequence</p>
        </div>
        {/* The trip length, in the corner. Unlike the travellers and rooms badges that used to sit
            here, this one is DERIVED FROM THIS PANEL — the two dates a few lines below it — so it
            cannot be changed from another card while you are looking at it. Renders only once both
            dates are set and the range makes sense; durationLabel returns "" otherwise, and a
            corner reading "0 Nights" on an empty form says nothing. */}
        {durationText ? (
          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {durationText}
          </span>
        ) : null}
      </div>

      {/* space-y-6 between bands, and each Band draws its own top rule — so the panel reads as one
          sequence of labelled groups rather than an undifferentiated wall of inputs. */}
      <div className="space-y-6 p-4 sm:p-5">
        {/* Dates + Pickup share the first block: they are what the clerk types first, and both are
            four-across on desktop, two on tablet, one on phone. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* ── Travel period ────────────────────────────────────────────────────────────────
              ONE control spanning two columns, the way a hotel site asks for a stay: check-in and
              check-out sit inside a single bordered box with the duration underneath. As two
              separate fields they read as unrelated dates, and the nights count had nowhere to
              live that clearly belonged to both. */}
          {/* Two columns wide, and no wider: on its own row a full-width date pair would put the
              two inputs a screen apart. sm:col-span-2 keeps them adjacent at every breakpoint. */}
          <div className="min-w-0 sm:col-span-2 lg:max-w-lg">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> Travel Date
                <span className="text-red-500">*</span>
              </span>
            </label>

            <div className={`rounded-lg border bg-white ${errors.travelDate || errors.tripEndDate ? "border-red-300" : "border-slate-200"}`}>
              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="min-w-0 px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Start</span>
                  {/* Still `travelDate`: this IS the trip's start and remains the column the server
                      stores, reports and filters on. Only the label changed. */}
                  <input
                    name="travelDate"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.travelDate}
                    onChange={(event) => setField("travelDate", event.target.value)}
                    onBlur={() => onBlurField?.("travelDate")}
                    aria-invalid={Boolean(errors.travelDate)}
                    aria-label="Trip start date"
                    className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 outline-none"
                  />
                </div>
                <div className="min-w-0 px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">End</span>
                  {/* `min` is the start date, so the picker cannot offer a trip that ends before it
                      begins — the same cheap correction the start date's own `min` makes. */}
                  <input
                    name="tripEndDate"
                    type="date"
                    min={form.travelDate || undefined}
                    value={form.tripEndDate || ""}
                    onChange={(event) => setField("tripEndDate", event.target.value)}
                    aria-label="Trip end date"
                    className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 outline-none"
                  />
                </div>
              </div>

              {durationText ? (
                <p className="border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-blue-600">
                  {durationText}
                </p>
              ) : null}
            </div>

            {(errors.travelDate || errors.tripEndDate) && (
              <p className="mt-1 text-xs text-red-500">{errors.travelDate || errors.tripEndDate}</p>
            )}
          </div>

          {/* Destination + Package Type — WHERE the trip goes and WHAT it is, beside WHEN. The
              three used to be split across two cards for no reason other than history. */}
          {primaryFields}
        </div>

        {/* ── Pickup ───────────────────────────────────────────────────────────────────────────
            Its own band with the SAME four fields in the SAME order as Drop below. They used to
            share a row with the travel period, which left Pickup Time and Mode alone on a second
            row with two empty columns beside them — the gap in the middle of this panel. */}
        <Band title="Pickup" hint="Where the trip starts — need not match the destination">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* DATE and time, not time alone — a pickup the night before an early flight is a
                different fact from one on the travel date, and the time on its own cannot say so.
                Bound to `pickupDateTime`, the field this form has always had: BookingDetails
                already renders it as "Pickup At" and the lead prefill already maps it. It used to
                appear only under Car/Road; a pickup has a time whatever the mode, so it lives in
                the PICKUP band now and shows for all of them. */}
            <IconField label="Pickup Date & Time" icon={CalendarDays}>
              <input type="datetime-local" value={form.pickupDateTime || ""} onChange={(event) => setField("pickupDateTime", event.target.value)} className={inputClass} />
            </IconField>

            <IconField label="Pickup Mode" icon={Bus}>
              <div className="relative">
                <select value={form.pickupMode} onChange={(event) => changeMode(event.target.value)} className={`${inputClass} appearance-none pr-9`}>
                  <option value="">Select mode</option>
                  {MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </IconField>

            {/* FREE TEXT, deliberately. A pickup point is routinely outside the sold destination —
                a Nepal package boarding at Gorakhpur — so a picker scoped to the destination could
                not express it, and one scoped to every city in the master is a haystack.
                What makes this work with the route: whatever is typed here is MERGED into the
                itinerary's city options, so "Gorakhpur" becomes selectable as a leg alongside the
                destination's own cities. */}
            <IconField label="Pickup City" icon={MapPin}>
              <input value={form.pickupCity} onChange={(event) => setField("pickupCity", event.target.value)} placeholder="e.g. Gorakhpur" className={inputClass} />
            </IconField>
            {/* OLD — a native <select> over the whole country master. ~200 rows behind a control
                whose only keyboard affordance is "jump to the next option starting with this
                letter", which it then forgets. Create Lead already answers this field with the
                combobox; typing "uni" reaches United Arab Emirates instead of cycling U-names.
                The value is still the country NAME, exactly as the payload expects. */}
            <IconField label="Pickup Country" icon={Globe2}>
              <SearchableSelect
                options={countryOptions}
                value={form.pickupCountry || ""}
                onChange={(next) => setField("pickupCountry", next)}
                placeholder={loadingCountries ? "Loading countries..." : "Select country"}
                searchPlaceholder="Type a country..."
                loading={loadingCountries}
                accent="teal"
                advanceOnSelect
                className="hover:border-slate-300"
              />
            </IconField>
          </div>

        {form.pickupMode === "Flight / Airport" && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-sky-100 bg-sky-50/50 p-3 sm:grid-cols-3">
            <IconField label="Pickup Airport" icon={Plane}>
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

        {form.pickupMode === "Train / Rail" && (
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

        {/* Two columns, not three: dropping the duplicated "Pickup Date & Time" left this block a
            field short and a third of it empty. */}
        {form.pickupMode === "Car / Road" && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-2">
            <IconField label="Pickup Address" icon={MapPin}>
              {/* OLD — replaced in create-form redesign: <input autoFocus ... /> — see the airport
                  field above for why autoFocus had to go. */}
              <input value={form.pickupAddress} onChange={(event) => setField("pickupAddress", event.target.value)} placeholder="Pickup address" className={inputClass} />
            </IconField>
            {/* "Pickup Date & Time" used to sit here and asked the same question twice: the PICKUP
                band above already has a Pickup Time for every mode, and the DATE half duplicated
                Trip Start Date. Removed rather than kept for Road only, because a pickup time is
                not a road-specific fact — a flight or train pickup has one too.
                `pickupDateTime` is still written to tripSnapshot.departure so an older booking that
                stored one keeps it; it is simply no longer asked for here. */}
            <IconField label="Vehicle Preference" icon={Car}>
              <input value={form.vehiclePreference} onChange={(event) => setField("vehiclePreference", event.target.value)} placeholder="Sedan, SUV, Traveller" className={inputClass} />
            </IconField>
          </div>
        )}
        </Band>

        {/* ── Drop ─────────────────────────────────────────────────────────────────────────────
            Same four fields as pickup, one band lower, so the two ends of the journey read as a
            pair. Neither is validated against the destination and both may be the same city. */}
        <Band title="Drop" hint="Where the trip finishes — need not match the destination or the pickup">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Date + time, matching Pickup. The return leg of a trip is just as likely to cross
                midnight — an overnight bus dropping at 6am is a different fact from 6am the day
                the trip ends, and a bare time cannot tell them apart. */}
            <IconField label="Drop Date & Time" icon={CalendarDays}>
              <input type="datetime-local" value={form.dropDateTime || ""} onChange={(event) => setField("dropDateTime", event.target.value)} className={inputClass} />
            </IconField>
            <IconField label="Drop Mode" icon={Bus}>
              <div className="relative">
                <select value={form.dropMode || ""} onChange={(event) => setField("dropMode", event.target.value)} className={`${inputClass} appearance-none pr-9`}>
                  <option value="">Select mode</option>
                  {MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </IconField>
            {/* Free text for the same reason as Pickup, and merged into the route's options the
                same way — so a drop city outside the destination closes the last leg. */}
            <IconField label="Drop City" icon={MapPin}>
              <input value={form.dropCity || ""} onChange={(event) => setField("dropCity", event.target.value)} placeholder="e.g. Gorakhpur" className={inputClass} />
            </IconField>
            <IconField label="Drop Country" icon={Globe2}>
              <input value={form.dropCountry || ""} onChange={(event) => setField("dropCountry", event.target.value)} placeholder="India" className={inputClass} />
            </IconField>
          </div>
        </Band>

        {/* Travellers AND Special assistance both moved to Customer Details. Assistance was left
            here at first on the reasoning that a wheelchair at the gate is a fact about the
            journey — but it asks "how many of the party need it", so it cannot be read without the
            headcount, and the headcount now lives in the other card. Two panels apart, the cap and
            the number it caps were invisible to each other. They travel together. */}
      </div>
    </section>
  );
}
