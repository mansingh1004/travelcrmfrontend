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

  return (
    <div>
      <div className={`grid grid-cols-2 items-start gap-2.5 sm:grid-cols-4 ${showExtraBeds ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <div className="space-y-2">
          <CountInput name="totalAdults" label="Total Adults" icon={Users} value={values.totalAdults} onChange={onCountChange} invalid={Boolean(error)} focusClass={tone.focus} />
          {showBreakdown && (
            <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold leading-4 text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(values.showAdultBreakdown)}
                onChange={(event) => onToggleBreakdown(event.target.checked)}
                className={`mt-px h-4 w-4 shrink-0 rounded border-slate-300 ${tone.checkbox}`}
              />
              <span>Specify adult gender count</span>
            </label>
          )}
        </div>
        <CountInput name="children" label="Children" icon={Users} value={values.children} onChange={onCountChange} focusClass={tone.focus} />
        <CountInput name="infants" label="Infants" icon={Baby} value={values.infants} onChange={onCountChange} focusClass={tone.focus} />
        <CountInput name="rooms" label="Rooms" icon={BedDouble} value={values.rooms} onChange={onCountChange} min={1} focusClass={tone.focus} />
        {showExtraBeds && <CountInput name="extraBeds" label="Extra Beds" icon={BedDouble} value={values.extraBeds} onChange={onCountChange} focusClass={tone.focus} />}
      </div>

      {showBreakdown && values.showAdultBreakdown && (
        <div className="mt-3 space-y-2">
          <div className="grid max-w-md grid-cols-2 gap-2.5">
            <CountInput name="male" label="Adult Male" icon={Mars} value={values.male} onChange={onCountChange} invalid={Boolean(error)} focusClass={tone.focus} />
            <CountInput name="female" label="Adult Female" icon={Venus} value={values.female} onChange={onCountChange} invalid={Boolean(error)} focusClass={tone.focus} />
          </div>
          {error && <p role="alert" className="text-xs font-medium text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
