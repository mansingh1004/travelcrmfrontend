// features/leads/pages/LeadFormV2.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Lead capture, regrouped the way a veteran agent qualifies on the phone.
//
// The organising idea is NOT the data model — it is the order of a 60-second call.
// An agent does not qualify a trip, they qualify a DEAL, so the form asks the four
// things that actually move a quotation and asks them in the order they come up:
// who is calling, where from and where to, when, how many, and what they will spend.
//
// Three fields here earn their place by changing the answer, not by recording it:
//   · FROM city — there is no quote without it. Not optional.
//   · Occasion  — a honeymoon, elderly parents and a friends' group are three
//                 different hotels, paces and vehicles at the same budget.
//   · Decide by — "when do you travel" sorts the calendar; "when will you decide"
//                 sorts the CALLBACK LIST, which is the one an agent works from.
//
// ⚠ PREVIEW. Every field below renders and holds state, but only the ones that
// already have columns are saved today. trip type, trip-for, from-city, occasion,
// date flexibility, decide-by, seniors, child ages, budget range/basis/not-disclosed,
// referred-by, the passport block and the agent verdict have NO backing columns yet —
// the migration is deliberately deferred. Nothing here posts them, so nothing here
// can silently drop them either.
//
// Visual language is flat and hairline — one border, no shadow, no blur, 13px
// controls — deliberately NOT the glass-card kit the older screens use. This is a
// dense data-entry surface read at a desk with a phone against one ear.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from "react";
import {
  ArrowDownRight, CalendarDays, Flame, IndianRupee, MapPin, Phone, Plane, Users,
} from "lucide-react";

/* ── Primitives ────────────────────────────────────────────────────────────────
   Local on purpose. The shared kits in this app are glass/gradient; borrowing one
   here would drag the whole look back and leave this screen half-converted. */

const ctrl =
  "h-[34px] w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] " +
  "text-slate-800 outline-none transition placeholder:text-slate-400 " +
  "focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Group({ n, icon: Icon, title, children }) {
  return (
    <section className="border-t border-slate-200 pt-3.5 pb-1">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="min-w-[14px] text-[11px] text-slate-400 tabular-nums">{n}</span>
        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h3 className="text-sm font-medium text-slate-800">{title}</h3>
      </div>
      {children}
    </section>
  );
}

/** 12px label + control. `add` marks a field the veteran model introduces. */
function F({ label, req, add, hint, children }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
        {label}
        {req && <span className="text-rose-500">*</span>}
        {add && (
          <span
            className="rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-medium text-blue-600"
            title="Added by the veteran-agent model"
          >
            +
          </span>
        )}
      </p>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Segmented picker. Arrow keys move within it, so it never costs a Tab stop each. */
function Segmented({ options, value, onChange, ariaLabel, tone = "slate" }) {
  const refs = useRef([]);
  const onKey = (event, index) => {
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
    if (next == null) return;
    event.preventDefault();
    const target = (next + options.length) % options.length;
    onChange(options[target].value);
    refs.current[target]?.focus();
  };
  const on = tone === "accent"
    ? "bg-blue-600 text-white"
    : "bg-slate-800 text-white";
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1.5">
      {options.map((option, index) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!value && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKey(event, index)}
            className={`h-8 flex-1 rounded-md px-3 text-[13px] transition ${
              active ? on : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small chips, for choices that are a vocabulary rather than a binary. */
function Chips({ options, value, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? "" : option.value)}
            className={`rounded-md px-2.5 py-1 text-[12px] transition ${
              active
                ? "bg-blue-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const TRIP_FOR = [
  { value: "SELF", label: "Khud" },
  { value: "PARENTS", label: "Parents" },
  { value: "FAMILY", label: "Family" },
  { value: "GROUP", label: "Group" },
  { value: "CORPORATE", label: "Corporate" },
];

const OCCASION = [
  { value: "HONEYMOON", label: "Honeymoon" },
  { value: "FAMILY", label: "Family" },
  { value: "SENIOR_CITIZENS", label: "Senior citizens" },
  { value: "FRIENDS", label: "Friends" },
  { value: "CORPORATE", label: "Corporate" },
  { value: "PILGRIMAGE", label: "Pilgrimage" },
  { value: "SOLO", label: "Solo" },
  { value: "OTHER", label: "Other" },
];

const FLEX = [
  { value: "EXACT", label: "Exact" },
  { value: "MONTH", label: "Month" },
  { value: "FESTIVAL", label: "Festival" },
  { value: "UNSURE", label: "Not sure" },
];

/* Deliberately worded as the customer says it, not as an enum reads. "Abhi" and
   "Bas dekh rahe hain" are the two answers that decide whether this lead is called
   back today or next month. */
const DECIDE_BY = [
  { value: "IMMEDIATE", label: "Abhi" },
  { value: "WITHIN_WEEK", label: "1 hafta" },
  { value: "WITHIN_MONTH", label: "1 mahina" },
  { value: "JUST_EXPLORING", label: "Bas dekh rahe hain" },
];

const VERDICT = [
  { value: "HOT", label: "Hot", on: "bg-rose-600 text-white" },
  { value: "WARM", label: "Warm", on: "bg-amber-500 text-white" },
  { value: "COLD", label: "Cold", on: "bg-slate-500 text-white" },
];

const blank = {
  tripType: "DOMESTIC",
  mobile: "", whatsappSame: true, whatsappNumber: "", name: "", email: "", tripFor: "",
  fromCity: "", destination: "", nights: "", occasion: "", packageType: "",
  dateFlexibility: "EXACT", travelStart: "", travelEnd: "", dateNote: "", decideBy: "",
  adults: 2, seniors: 0, children: 0, infants: 0, childAges: [],
  budgetMin: "", budgetMax: "", budgetBasis: "TOTAL", budgetNotDisclosed: false,
  source: "", referredByName: "",
  passportStatus: "", visaRequired: false, passportExpiry: "",
  verdict: "", competingQuote: false, qualificationNote: "",
};

export default function LeadFormV2() {
  const [form, setForm] = useState(blank);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const international = form.tripType === "INTERNATIONAL";

  /* Ages follow the COUNT, and the array stays the source of truth: raising children
     appends an empty age rather than rebuilding the list, so ages already typed are
     never renumbered out from under the agent. */
  const setChildren = (raw) => {
    const next = Math.max(0, Math.min(20, Number(raw) || 0));
    setForm((current) => {
      const ages = current.childAges.slice(0, next);
      while (ages.length < next) ages.push("");
      return { ...current, children: next, childAges: ages };
    });
  };

  const setAge = (index, value) => setForm((current) => {
    const ages = [...current.childAges];
    ages[index] = value;
    return { ...current, childAges: ages };
  });

  /* Seniors are a SUBSET of adults, not a fourth counter — the headcount must not
     change when one of the four turns out to be 68. Clamped rather than validated:
     a number that cannot be wrong needs no error message. */
  const setSeniors = (raw) => set("seniors", Math.max(0, Math.min(Number(form.adults) || 0, Number(raw) || 0)));

  const headcount = useMemo(
    () => (Number(form.adults) || 0) + (Number(form.children) || 0) + (Number(form.infants) || 0),
    [form.adults, form.children, form.infants],
  );

  /* Enter walks the form instead of submitting it. A 30-field enquiry must never be
     created because someone pressed Enter after the third box. */
  const onKeyDown = (event) => {
    if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
    const tag = event.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") return;
    event.preventDefault();
    const fields = Array.from(
      event.currentTarget.querySelectorAll("input,select,textarea,button:not([tabindex='-1'])"),
    ).filter((node) => !node.disabled && node.offsetParent !== null);
    const at = fields.indexOf(event.target);
    fields[Math.min(fields.length - 1, at + 1)]?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <div className="mx-auto w-full max-w-[900px] px-4 py-6">
        <form onKeyDown={onKeyDown} className="rounded-xl border border-slate-200 bg-white px-6 py-5">

          <div className="mb-3.5 flex items-center justify-between">
            <h1 className="text-[15px] font-medium text-slate-900">New lead</h1>
            <p className="text-[12px] text-slate-400">
              <span className="rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-medium text-blue-600">+</span>
              {" "}= veteran ka addition
            </p>
          </div>

          {/* ── 0 · Trip type ────────────────────────────────────────────────────
              Above everything because it changes the form under it: International is
              the only thing that opens the passport block. */}
          <div className="rounded-md bg-blue-50/70 px-3 py-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] text-blue-700">
              0 · Trip type <span className="text-rose-500">*</span>
            </p>
            <Segmented
              ariaLabel="Trip type"
              tone="accent"
              value={form.tripType}
              onChange={(value) => set("tripType", value)}
              options={[
                { value: "DOMESTIC", label: "Domestic" },
                { value: "INTERNATIONAL", label: "International" },
              ]}
            />
          </div>

          {/* ── 1 · Contact ─────────────────────────────────────────────────────── */}
          <Group n="1" icon={Phone} title="Contact">
            <div className="grid gap-2.5 sm:grid-cols-[1.1fr_1fr_1fr]">
              <F label="Mobile" req>
                <input
                  autoFocus
                  value={form.mobile}
                  onChange={(event) => set("mobile", event.target.value.replace(/[^+\d\s-]/g, ""))}
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98xxxxxxxx"
                  className={ctrl}
                />
              </F>
              <F label="Name" req>
                <input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Caller" className={ctrl} />
              </F>
              <F label="Kiske liye" add>
                <select value={form.tripFor} onChange={(event) => set("tripFor", event.target.value)} className={ctrl}>
                  <option value="">Khud / parents / group</option>
                  {TRIP_FOR.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </F>
            </div>

            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1.1fr_1fr_1fr]">
              <F label="WhatsApp">
                <label className="flex h-[34px] items-center gap-2 rounded-md border border-slate-200 px-2.5 text-[13px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.whatsappSame}
                    onChange={(event) => set("whatsappSame", event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Same as mobile
                </label>
              </F>
              {!form.whatsappSame && (
                <F label="WhatsApp number">
                  <input value={form.whatsappNumber} onChange={(event) => set("whatsappNumber", event.target.value)} type="tel" className={ctrl} />
                </F>
              )}
              <F label="Email" hint="Optional — voucher aur quote yahin jaayega">
                <input value={form.email} onChange={(event) => set("email", event.target.value)} type="email" placeholder="optional" className={ctrl} />
              </F>
            </div>
          </Group>

          {/* ── 2 · Kahan se, kahan tak ─────────────────────────────────────────── */}
          <Group n="2" icon={MapPin} title="Kahan se, kahan tak">
            <div className="grid gap-2.5 sm:grid-cols-[1fr_1.3fr_0.7fr]">
              <F label="From" req add hint="Iske bina quote banta hi nahi">
                <input value={form.fromCity} onChange={(event) => set("fromCity", event.target.value)} placeholder="Pune" className={ctrl} />
              </F>
              <F label="Destination" req>
                <input value={form.destination} onChange={(event) => set("destination", event.target.value)} placeholder="Manali, Bali…" className={ctrl} />
              </F>
              <F label="Nights">
                <input value={form.nights} onChange={(event) => set("nights", event.target.value)} type="number" min="0" placeholder="5" className={ctrl} />
              </F>
            </div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <F label="Occasion" add hint="Budget se bada lever — hotel, pace, vehicle sab isse badalte hain">
                <select value={form.occasion} onChange={(event) => set("occasion", event.target.value)} className={ctrl}>
                  <option value="">Honeymoon / family / group</option>
                  {OCCASION.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </F>
              <F label="Package" add>
                <Segmented
                  ariaLabel="Package scope"
                  value={form.packageType}
                  onChange={(value) => set("packageType", value)}
                  options={[
                    { value: "LAND_ONLY", label: "Land only" },
                    { value: "WITH_FLIGHTS", label: "With flights" },
                  ]}
                />
              </F>
            </div>
          </Group>

          {/* ── 3 · Kab ─────────────────────────────────────────────────────────── */}
          <Group n="3" icon={CalendarDays} title="Kab">
            <div className="mb-2">
              <Chips
                ariaLabel="Date flexibility"
                options={FLEX}
                value={form.dateFlexibility}
                onChange={(value) => set("dateFlexibility", value || "EXACT")}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_1.1fr]">
              <F label={form.dateFlexibility === "EXACT" ? "Start" : "Approx start"}>
                <input value={form.travelStart} onChange={(event) => set("travelStart", event.target.value)} type="date" className={ctrl} />
              </F>
              <F label={form.dateFlexibility === "EXACT" ? "End" : "Approx end"}>
                <input
                  value={form.travelEnd}
                  onChange={(event) => set("travelEnd", event.target.value)}
                  type="date"
                  min={form.travelStart || undefined}
                  className={ctrl}
                />
              </F>
              <F label="Decide by" add hint="Travel date se alag — callback list yahi banati hai">
                <select
                  value={form.decideBy}
                  onChange={(event) => set("decideBy", event.target.value)}
                  className={`${ctrl} ${form.decideBy ? "border-blue-300 text-blue-700" : ""}`}
                >
                  <option value="">Kab tak decide karenge?</option>
                  {DECIDE_BY.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </F>
            </div>
            {form.dateFlexibility !== "EXACT" && (
              <div className="mt-2.5">
                <F label="Note" hint='"Diwali ke aas paas", "school chhutti mein"'>
                  <input value={form.dateNote} onChange={(event) => set("dateNote", event.target.value)} className={ctrl} />
                </F>
              </div>
            )}
          </Group>

          {/* ── 4 · Kitne log ───────────────────────────────────────────────────── */}
          <Group n="4" icon={Users} title="Kitne log">
            <div className="grid gap-2.5 sm:grid-cols-4">
              <F label="Adults" req>
                <input value={form.adults} onChange={(event) => set("adults", event.target.value)} type="number" min="1" className={ctrl} />
              </F>
              <F label="Seniors 60+" add hint="Adults ka hissa, alag count nahi">
                <input value={form.seniors} onChange={(event) => setSeniors(event.target.value)} type="number" min="0" max={form.adults || 0} className={ctrl} />
              </F>
              <F label="Children">
                <input value={form.children} onChange={(event) => setChildren(event.target.value)} type="number" min="0" className={ctrl} />
              </F>
              <F label="Infants">
                <input value={form.infants} onChange={(event) => set("infants", event.target.value)} type="number" min="0" className={ctrl} />
              </F>
            </div>

            {form.children > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-slate-500">Ages:</span>
                {form.childAges.map((age, index) => (
                  <span key={index} className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[12px] text-amber-800">
                    <input
                      value={age}
                      onChange={(event) => setAge(index, event.target.value)}
                      type="number"
                      min="0"
                      max="17"
                      aria-label={`Child ${index + 1} age`}
                      className="w-9 bg-transparent text-center outline-none"
                    />
                    yrs
                  </span>
                ))}
                <span className="text-[11px] text-slate-400">· hotel child policy inhi pe chalti hai</span>
              </div>
            )}

            <p className="mt-2.5 text-[11px] text-slate-400">
              Headcount <span className="font-medium text-slate-600">{headcount}</span> — seniors isme already gine gaye hain
            </p>
          </Group>

          {/* ── 5 · Budget ──────────────────────────────────────────────────────── */}
          <Group n="5" icon={IndianRupee} title="Budget">
            <div className="grid gap-2.5 sm:grid-cols-[0.65fr_0.65fr_1fr]">
              <F label="Min">
                <input
                  value={form.budgetMin}
                  onChange={(event) => set("budgetMin", event.target.value)}
                  type="number" min="0" step="5000" placeholder="50000"
                  disabled={form.budgetNotDisclosed}
                  className={`${ctrl} disabled:bg-slate-50 disabled:text-slate-400`}
                />
              </F>
              <F label="Max">
                <input
                  value={form.budgetMax}
                  onChange={(event) => set("budgetMax", event.target.value)}
                  type="number" min="0" step="5000" placeholder="100000"
                  disabled={form.budgetNotDisclosed}
                  className={`${ctrl} disabled:bg-slate-50 disabled:text-slate-400`}
                />
              </F>
              <F label="Basis">
                <Segmented
                  ariaLabel="Budget basis"
                  value={form.budgetBasis}
                  onChange={(value) => set("budgetBasis", value)}
                  options={[
                    { value: "TOTAL", label: "Total" },
                    { value: "PER_PERSON", label: "Per person" },
                  ]}
                />
              </F>
            </div>
            {/* An explicit answer, not an empty box. "Customer ne bataya nahi" and
                "agent ne poocha hi nahi" are different facts, and only one of them
                is worth calling back about. */}
            <label className="mt-2.5 flex w-fit items-center gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={form.budgetNotDisclosed}
                onChange={(event) => set("budgetNotDisclosed", event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Customer ne budget nahi bataya
            </label>
          </Group>

          {/* ── 6 · Source ──────────────────────────────────────────────────────── */}
          <Group n="6" icon={ArrowDownRight} title="Source">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <F label="Source" req>
                <select value={form.source} onChange={(event) => set("source", event.target.value)} className={ctrl}>
                  <option value="">Select</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="WEBSITE">Website</option>
                  <option value="GOOGLE_ADS">Google Ads</option>
                  <option value="SOCIAL_MEDIA">Social Media</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="MANUAL">Manual Entry</option>
                  <option value="OTHER">Other</option>
                </select>
              </F>
              {form.source === "REFERRAL" && (
                <F label="Referred by" add hint="Customer ya sub-agent — dono ek saath nahi">
                  <input value={form.referredByName} onChange={(event) => set("referredByName", event.target.value)} placeholder="Naam se dhoondhein" className={ctrl} />
                </F>
              )}
            </div>
            {/* JustDial and the other machine channels are deliberately absent: LeadSource
                marks them MACHINE_ONLY, so they arrive through the ingest gateway and are
                never something an agent picks by hand. */}
          </Group>

          {/* ── International only ──────────────────────────────────────────────── */}
          {international && (
            <Group n="7" icon={Plane} title="Passport & visa">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <F label="Passport">
                  <select value={form.passportStatus} onChange={(event) => set("passportStatus", event.target.value)} className={ctrl}>
                    <option value="">Status</option>
                    <option value="VALID">Valid</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="IN_PROCESS">Apply kiya hai</option>
                    <option value="NOT_HELD">Hai hi nahi</option>
                  </select>
                </F>
                <F label="Expiry">
                  <input value={form.passportExpiry} onChange={(event) => set("passportExpiry", event.target.value)} type="date" className={ctrl} />
                </F>
                <F label="Visa">
                  <label className="flex h-[34px] items-center gap-2 rounded-md border border-slate-200 px-2.5 text-[13px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.visaRequired}
                      onChange={(event) => set("visaRequired", event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Visa chahiye
                  </label>
                </F>
              </div>
            </Group>
          )}

          {/* ── Post-call · Agent verdict ───────────────────────────────────────
              Below the rule and outside the numbered run, because it is not part of
              the call — it is what the agent thinks the moment they hang up. Never
              blocks the save; a lead with no verdict is a lead nobody has judged yet,
              which is honest. */}
          <div className="mt-3.5 border-t border-slate-200 pt-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="mb-2.5 flex items-center gap-2">
                <Flame className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="text-[13px] font-medium text-slate-800">
                  Agent verdict{" "}
                  <span className="rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-medium text-blue-600">+</span>
                </span>
                <span className="ml-auto text-[12px] text-slate-400">call ke turant baad, optional</span>
              </div>

              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                {VERDICT.map((option) => {
                  const active = form.verdict === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set("verdict", active ? "" : option.value)}
                      className={`rounded-md px-3 py-1 text-[12px] transition ${
                        active ? option.on : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={form.competingQuote}
                  onClick={() => set("competingQuote", !form.competingQuote)}
                  className={`ml-2 rounded-md px-3 py-1 text-[12px] transition ${
                    form.competingQuote
                      ? "bg-slate-800 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Aur jagah se quote liya hai
                </button>
              </div>

              <input
                value={form.qualificationNote}
                onChange={(event) => set("qualificationNote", event.target.value)}
                placeholder='Ek line note — "beta US se pay karega, mother ke liye hai"'
                className={ctrl}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3.5">
            <p className="text-[11px] text-slate-400">
              <kbd className="rounded bg-slate-100 px-1">Enter</kbd> agla field ·{" "}
              <kbd className="rounded bg-slate-100 px-1">Ctrl</kbd>+
              <kbd className="rounded bg-slate-100 px-1">Enter</kbd> save
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(blank)} className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50">
                Clear
              </button>
              <button type="button" disabled title="Preview only — the new fields have no columns yet" className="rounded-md bg-blue-600 px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50">
                Save lead
              </button>
            </div>
          </div>
        </form>

        <p className="mt-3 text-center text-[11px] text-slate-400">
          Preview — naye fields render hote hain par save nahi hote, columns abhi bane nahi hain.
        </p>
      </div>
    </div>
  );
}
