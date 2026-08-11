import { Baby, BedDouble, Mars, Users, Venus } from "lucide-react";

import { getAdultBreakdownError, toAdultCount } from "@shared/lib/adultBreakdown";

const THEMES = {
  blue: {
    focus: "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100",
    checkbox: "text-blue-600 focus:ring-blue-500",
  },
  teal: {
    focus: "focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100",
    checkbox: "text-teal-600 focus:ring-teal-500",
  },
};

function CountInput({ name, label, icon: Icon, value, onChange, min = 0, invalid, focusClass }) {
  return (
    <label className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 transition ${
      invalid
        ? "border-red-300 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100"
        : `border-slate-200 hover:border-slate-300 ${focusClass}`
    }`}>
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{label}</span>
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        step="1"
        inputMode="numeric"
        value={value ?? ""}
        aria-invalid={invalid || undefined}
        onFocus={(event) => event.target.select()}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => onChange(name, event.target.value)}
        onBlur={(event) => onChange(name, toAdultCount(event.target.value, min))}
        className="w-12 bg-transparent text-right text-sm font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  );
}

export default function TravellerCountFields({
  values,
  onCountChange,
  onToggleBreakdown,
  theme = "blue",
  compact = false,
  showBreakdownInCompact = false,
  showExtraBedsInCompact = false,
}) {
  const tone = THEMES[theme] || THEMES.blue;
  const error = getAdultBreakdownError(values);
  const showBreakdown = !compact || showBreakdownInCompact;
  const showExtraBeds = !compact || showExtraBedsInCompact;

  /* Headcount first, composition on demand.
     The agent types ONE number — how many people are travelling — and only opens the breakdown when
     the party is not all adults. Before, Adults / Children / Infants were three boxes to tab through
     on every enquiry, and the overwhelming majority of them are "4 adults".

     `kids > 0` FORCES the panel open, and that is not a nicety: collapsed, the single box is labelled
     "Total Travellers" and writes `totalAdults`, which is only truthful while there are no children
     or infants. An edit-mode lead carrying 2 children would otherwise show "Total Travellers: 2" over
     a hidden 2 more. The checkbox is disabled in that state rather than left looking stuck — clicking
     it could not collapse anything, and the alternative (zeroing the children to allow it) is data
     loss dressed up as a toggle. */
  const kids = toAdultCount(values.children) + toAdultCount(values.infants);
  const expanded = showBreakdown && (Boolean(values.showAdultBreakdown) || kids > 0);
  const totalTravellers = toAdultCount(values.totalAdults) + kids;

  /* Two groups, 60 / 40 — not one flat row of five counters.
     Adults / Children / Infants answer "who is travelling"; Rooms / Extra Beds answer "how do we
     house them". Sitting them in one undifferentiated grid made Rooms read as a fourth kind of
     person, which is exactly the slip that produces a 4-adult booking in 4 rooms. The 3:2 split
     gives the three traveller counters room to stay legible while the two housing counters stay
     visibly a separate answer.

     The gender breakdown moved INSIDE the travellers group. It was rendered below the whole grid,
     which put "Adult Male / Adult Female" under the Rooms column on a wide screen — the one place
     it must never appear to belong. */
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[3fr_2fr]">
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Travellers
        </legend>
        {/* One box, and its label depends on what it currently means. Collapsed it IS the whole
            party (children and infants are zero, enforced above); expanded it is only the adults,
            and Adult Male + Adult Female must reconcile to it — the rule getAdultBreakdownError has
            always applied and nothing downstream changed.

            Longer than the third-of-a-grid tile it used to be, but capped to the SAME max-width as
            the 2×2 breakdown block below it — same height, same type size, same right edge. Left at
            full column width it overhung the counters underneath and the group stopped reading as
            one block. */}
        {showBreakdown ? (
          <div className="max-w-sm">
            <CountInput
              name="totalAdults"
              label={expanded ? "Total Adults" : "Total Travellers"}
              icon={Users}
              value={values.totalAdults}
              onChange={onCountChange}
              invalid={Boolean(error)}
              focusClass={tone.focus}
            />
          </div>
        ) : (
          /* Compact hosts suppress the breakdown toggle, so children and infants have no other home
             and stay inline rather than becoming unreachable. */
          <div className="grid grid-cols-2 items-start gap-2.5 sm:grid-cols-3">
            <CountInput name="totalAdults" label="Total Adults" icon={Users} value={values.totalAdults} onChange={onCountChange} invalid={Boolean(error)} focusClass={tone.focus} />
            <CountInput name="children" label="Children" icon={Users} value={values.children} onChange={onCountChange} focusClass={tone.focus} />
            <CountInput name="infants" label="Infants" icon={Baby} value={values.infants} onChange={onCountChange} focusClass={tone.focus} />
          </div>
        )}

        {showBreakdown && (
          <label
            className={`mt-2 flex w-fit items-start gap-2 text-xs font-semibold leading-4 text-slate-700 ${
              kids > 0 ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            }`}
            title={kids > 0 ? "Clear children and infants to collapse the breakdown" : undefined}
          >
            <input
              type="checkbox"
              checked={expanded}
              disabled={kids > 0}
              onChange={(event) => onToggleBreakdown(event.target.checked)}
              className={`mt-px h-4 w-4 shrink-0 rounded border-slate-300 ${tone.checkbox}`}
            />
            <span>Traveller breakdown</span>
          </label>
        )}

        {expanded && (
          <div className="mt-2.5 space-y-2">
            {/* A capped 2×2 block. Four across left each counter about as wide as its own label
                ("Adult Female" truncated); letting two-up run the full column width overshot the
                other way. The max-width lands them between the two — longer than the original
                tiles, not as long as the Total box above. 2×2 also stays tidy, which a 3-column
                layout of four counters does not. */}
            <div className="grid max-w-sm grid-cols-2 gap-2.5">
              <CountInput name="male" label="Adult Male" icon={Mars} value={values.male} onChange={onCountChange} invalid={Boolean(error)} focusClass={tone.focus} />
              <CountInput name="female" label="Adult Female" icon={Venus} value={values.female} onChange={onCountChange} invalid={Boolean(error)} focusClass={tone.focus} />
              <CountInput name="children" label="Children" icon={Users} value={values.children} onChange={onCountChange} focusClass={tone.focus} />
              <CountInput name="infants" label="Infants" icon={Baby} value={values.infants} onChange={onCountChange} focusClass={tone.focus} />
            </div>
            {error ? (
              <p role="alert" className="text-xs font-medium text-red-500">{error}</p>
            ) : (
              /* Children and infants ADD to the headcount, they are not carved out of it — so the
                 running total is shown the moment the breakdown is open, rather than letting the
                 agent discover on the next screen that "4 travellers" became 6. */
              <p className="text-[11px] font-semibold text-slate-500">
                {totalTravellers} traveller{totalTravellers === 1 ? "" : "s"} in total
              </p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Rooms
        </legend>
        <div className={`grid items-start gap-2.5 ${showExtraBeds ? "grid-cols-2" : "grid-cols-1"}`}>
          <CountInput name="rooms" label="Rooms" icon={BedDouble} value={values.rooms} onChange={onCountChange} min={1} focusClass={tone.focus} />
          {showExtraBeds && <CountInput name="extraBeds" label="Extra Beds" icon={BedDouble} value={values.extraBeds} onChange={onCountChange} focusClass={tone.focus} />}
        </div>
      </fieldset>
    </div>
  );
}
