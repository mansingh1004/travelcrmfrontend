// ─────────────────────────────────────────────────────────────────────────────
// NEW — create-form redesign.
//
// Built on the idiom the live booking form already uses (CreateBookingClean + Fast*): flat panels,
// one border, no gradient headers, dense grids. Deliberately NOT a new style language.
//
// What a clerk gets that they did not have:
//   · autofocus on Phone, and Enter advances field-to-field instead of submitting
//   · Ctrl/⌘+Enter saves; Ctrl/⌘+Shift+Enter saves and immediately starts the next record
//   · sticky source/type/assignee/departure carried into the next record (sessionStorage)
//   · duplicate check on the REAL phone field, debounced, shown as an inline strip — prefill is
//     opt-in, so a match can no longer silently overwrite what was typed
//   · validation on blur, inline, never as a toast
//
// LeadInformation / TravelDetails / ItinerarySection / ServicesSection / LeadSummary are all left
// untouched on purpose: EditLead.jsx renders the same five components, and redesigning them here
// would silently redesign Edit too. The panels below are local to this screen.
// ─────────────────────────────────────────────────────────────────────────────




import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  BookUser,
  CalendarDays,
  Camera,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  Download,
  ExternalLink,
  Globe2,
  IndianRupee,
  LayoutGrid,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  Plane,
  Plus,
  Wallet,
  RotateCcw,
  Route,
  Share2,
  ShieldCheck,
  Ship,
  Stamp,
  TrainFront,
  Trash2,
  TriangleAlert,
  UserCheck,
  Zap,
} from "lucide-react";

import { leadService } from "../api/leadService";
import { useLeadSources } from "../lib/useLeadSources";
import SearchableSelect from "../components/SearchableSelect";
import BookFromQuotePanel from "../components/BookFromQuotePanel";
import QuickDestinationModal from "../../masters/components/QuickDestinationModal";
import QuickCityModal from "../../masters/components/QuickCityModal";
// Cross-feature, through the barrel — customers owns "does this person already exist?" and the
// lead form only asks the question.
import { customerService } from "@features/customers";
// Rapid mode prices the enquiry on this same screen. The accordion, its payload builder and its
// validation all come from the Quick Quote page through the barrel, so there is exactly one
// implementation of "what a quick quote is" no matter which screen the agent started on.
import {
  QuickQuoteSections,
  QuotationStyleModal,
  buildQuickQuoteModel,
  quickQuotePayload,
  quickQuoteGrandTotal,
  quickQuoteTotals,
  quotationService,
  rememberQuickQuoteDefaults,
  syncQuickQuotePax,
  syncQuickQuoteServices,
  validateQuickQuote,
} from "@features/quotation";
import { geographyService } from "@shared/api/geographyService";
import { hasPermission, P } from "@shared/lib/access";
import { usePdfDownload } from "@shared/hooks/usePdfDownload";
import PdfDownloadLoader from "@shared/ui/PdfDownloadLoader";
import { buildAdultPayload, deriveAdultBreakdown, getAdultBreakdownError } from "@shared/lib/adultBreakdown";
import TravellerCountFields from "@shared/ui/TravellerCountFields";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";
import { phoneRule } from "@shared/lib/phone";

// Backend LeadType — the priority vocabulary, exactly four values. Keep in step with
// LeadInformation.jsx, AllLeads.jsx and the leads_lead_type_check constraint.
const LEAD_TYPES = ["Fresh", "Hot", "Warm", "Cold"];
const LEAD_STAGES = [
  "New Lead", "Contacted", "Follow Up", "Qualified",
  "Proposal Sent", "Converted", "Reopened", "Lost",
];
// Must be the backend CommunicationPreference display values verbatim — the lead's choice is copied
// straight onto Customer.commPref at conversion, and both sides share one CHECK constraint.
// "Call" was NOT one of them ("Phone Call" is), so picking it 400'd the save with an opaque
// deserialization error carrying no field to show it against.
const COMMUNICATION_PREFERENCES = ["WhatsApp", "Phone Call", "Email", "SMS", "All Channels"];
const PACKAGE_TYPES = ["Family", "Honeymoon", "Group", "Corporate", "Pilgrimage", "Adventure"];
const DEPARTURE_MODES = ["Flight / Airport", "Train / Rail", "Car / Road", "Bus", "Other"];
const ASSISTANCE_TYPES = [
  "Wheelchair Assistance",
  "Senior Citizen Assistance",
  "Special Meal Requirement",
  "Airport Assistance",
];

// ids, not labels — the backend stores these lowercase keys and AllLeads colours off them.
// `icon` / `tile` are presentation only and are read by the rapid-mode service cards. Full-details
// mode and EditLead still render `label` through Chip and never touch them. readStickyServices()
// only reads `id`, so the extra keys are inert everywhere else. The -700 icon foregrounds on amber
// and cyan are deliberate: at -600 those two pastels fall under the 3:1 contrast floor for glyphs.
// Vehicle leads and is the default tick: it is the service almost every enquiry here starts from,
// so it earns the first card and the seeded section. CORE_SERVICES in QuickQuotation.jsx carries the
// same order — the quote's sections are built from THAT list, and a picker whose first card opened
// the second section would read as a bug.
const SERVICES = [
  { id: "vehicle", label: "Vehicle", icon: CarFront, tile: "bg-amber-50 text-amber-700" },
  { id: "hotel", label: "Hotel", icon: BedDouble, tile: "bg-emerald-50 text-emerald-600" },
  { id: "sightseeing", label: "Sightseeing", icon: Camera, tile: "bg-violet-50 text-violet-600" },
  { id: "flight", label: "Flight", icon: Plane, tile: "bg-blue-50 text-blue-600" },
  { id: "cruise", label: "Cruise", icon: Ship, tile: "bg-cyan-50 text-cyan-700" },
  { id: "visa", label: "Visa", icon: Stamp, tile: "bg-rose-50 text-rose-600" },
  { id: "insurance", label: "Insurance", icon: ShieldCheck, tile: "bg-indigo-50 text-indigo-600" },
  { id: "passport", label: "Passport", icon: BookUser, tile: "bg-orange-50 text-orange-600" },
];

const SERVICE_ID_MAP = {
  hotel: "hotel",
  flight: "flight",
  cruise: "cruise",
  visa: "visa",
  sightseeing: "sightseeing",
  vehicle: "vehicle",
  "vehicle rental": "vehicle",
  insurance: "insurance",
  "travel insurance": "insurance",
  passport: "passport",
  "passport assistance": "passport",
};

const normalizeServiceId = (service) => {
  const raw = typeof service === "string"
    ? service
    : service?.id ?? service?.code ?? service?.value ?? service?.label ?? service?.name ?? "";
  const normalized = String(raw).trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  return SERVICE_ID_MAP[normalized] || normalized;
};

const entityName = (value, fallback = "") => {
  if (typeof value === "string") return value.trim();
  return String(value?.name ?? value?.label ?? value?.title ?? fallback ?? "").trim();
};

const toDateInput = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const MODE_FIELDS = {
  "Flight / Airport": ["departureAirport", "airportCode", "preferredFlightTime"],
  "Train / Rail": ["railwayStation", "trainClass", "preferredTrainTime"],
  "Car / Road": ["pickupAddress", "pickupDateTime", "vehiclePreference"],
};

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";
const today = () => new Date().toISOString().slice(0, 10);
const isOpenLead = (lead) => {
  if (!lead) return false;
  const stage = String(lead.leadStage ?? lead.stage ?? "").trim().toLowerCase().replaceAll("_", " ");
  return stage !== "converted" && stage !== "lost";
};

// Shape of "nobody matched". A frozen module constant so every reset points at the same object and
// no effect can accidentally leave half of it behind.
const EMPTY_MATCH = Object.freeze({ lead: null, customer: null });
// Enough to decide the email is worth probing — the field's own @Email rule is the real gate.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return "";
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
};
const MATCH_LABEL = { PHONE: "this phone number", EMAIL: "this email address", BOTH: "this phone and email" };
export const toInt = (value, min = 0) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, n) : min;
};
const extractArray = (value) => {
  const candidates = [value, value?.data, value?.data?.data, value?.content, value?.data?.content];
  return candidates.find(Array.isArray) ?? [];
};
const idOf = (item) => item?.id ?? item?.destinationId ?? item?.cityId ?? item?.publicId ?? "";

/* Sticky fields — the single biggest lever on a 50-100/day screen. A clerk working a batch keeps
   the same source, the same assignee and the same departure city for a whole run, so those ride
   into the next record instead of being retyped. sessionStorage (not local) so it dies with the
   tab and never leaks between staff on a shared machine. */
const STICKY_KEY = "leadEntry:sticky";
const SESSION_COUNT_KEY = "leadEntry:savedCount";
const STICKY_FIELDS = [
  "leadSource", "leadType", "assignedUserId", "departCountry",
  "departCity", "packageType", "preferredCommunication",
];
const readSticky = () => {
  try {
    const raw = sessionStorage.getItem(STICKY_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw);
    return Object.fromEntries(
      STICKY_FIELDS.filter((key) => stored[key]).map((key) => [key, stored[key]])
    );
  } catch { return {}; }
};
const readStickyServices = () => {
  try {
    const raw = sessionStorage.getItem(STICKY_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const validIds = new Set(SERVICES.map(({ id }) => id));
    const selected = Array.isArray(stored.services)
      ? stored.services.filter((id) => validIds.has(id))
      : [];
    // Vehicle is the default tick on a cold form. Sticky still wins once this session has saved a
    // lead — the agent's own last selection is a better guess than any constant.
    return selected.length > 0 ? selected : ["vehicle"];
  } catch { return ["vehicle"]; }
};
const writeSticky = (values, services) => {
  try {
    const slice = {};
    STICKY_FIELDS.forEach((key) => { if (values[key]) slice[key] = values[key]; });
    slice.services = Array.isArray(services) && services.length > 0 ? services : ["vehicle"];
    sessionStorage.setItem(STICKY_KEY, JSON.stringify(slice));
  } catch { /* private mode — sticky is a convenience, never a requirement */ }
};
const readSessionCount = () => {
  try { return toInt(sessionStorage.getItem(SESSION_COUNT_KEY)); }
  catch { return 0; }
};

export const blankDefaults = () => ({
  customerName: "", phone: "", email: "", budget: "",
  leadSource: "", leadType: "Fresh", leadStage: "New Lead",
  assignedUserId: "", birthDate: "", anniversaryDate: "",
  preferredCommunication: "", followUpDate: "", packageType: "",
  travelDate: "", returnDate: "", departCountry: "India", departCity: "",
  departureMode: "", departureAirport: "", airportCode: "", preferredFlightTime: "",
  railwayStation: "", trainClass: "", preferredTrainTime: "",
  pickupAddress: "", pickupDateTime: "", vehiclePreference: "",
  showAdultBreakdown: false, male: null, female: null,
  totalAdults: 2, children: 0, infants: 0, rooms: 1, extraBeds: 0,
  roomPlanEnabled: false,
  specialAssistanceRequired: false, specialAssistanceTypes: [],
  assistancePassengerCount: 0, specialAssistanceNotes: "",

  /* ── Qualification fields — the veteran-agent model ─────────────────────────────────────────
     These change how a quotation is BUILT, not just what is recorded about it: a honeymoon and
     elderly parents are different hotels at the same budget, and "when will you decide" sorts the
     callback list that "when do you travel" cannot.

     ⚠ NONE OF THESE HAVE COLUMNS YET. They live in form state and are deliberately NOT in
     transformFormData's payload, so a lead saved today drops them rather than 400ing on an unknown
     property. That is the agreed order — UI first, migration after — and it is safe only because
     the transform whitelists fields instead of spreading the form object. Do not "fix" it by
     spreading; wire each field when its column lands. */
  tripFor: "",
  whatsappSame: true,
  whatsappNumber: "",
  fromCity: "",
  occasion: "",
  dateFlexibility: "EXACT",
  dateNote: "",
  decideBy: "",
  /* A SUBSET of totalAdults, never a fourth counter — the headcount formula
     (adults + children + infants) must not move because one of the four is 68. */
  seniors60Plus: 0,
  /* Source of truth; the child COUNT follows this array, not the other way round. */
  childAges: [],
  referredByName: "",
  agentVerdict: "", competingQuote: false, qualificationNote: "",
  notes: "",
});

let nextRowId = 1;
export const blankRow = () => ({ id: nextRowId++, destinationId: "", destination: "", cityId: "", city: "", nights: 2 });

/* Rapid mode is a CHAIN — itinerary → services → quotation — and this is the first link's latch.
   A stop counts only when BOTH destination and city are set, which is deliberately the same test
   draftLeadKey uses to drop half-filled rows before seeding the quote and the same pair the backend
   binds @NotBlank on. So a stop that unlocks the next step is always one the quotation can price;
   the gate can never open onto a section the seeder will then ignore. */
const hasCompleteStop = (rows) => (rows || []).some(
  (row) => String(row?.destination || "").trim() && String(row?.city || "").trim(),
);

const ROOM_CATEGORY_OPTIONS = ["Any", "Standard", "Deluxe", "Premium", "Suite", "Family Room", "Villa"];
const BED_PREFERENCE_OPTIONS = ["Any", "King", "Queen", "Twin", "Double", "Single", "Bunk"];
let nextRoomAllocationId = 1;
const blankRoomAllocation = (roomNumber, values = {}) => ({
  id: `room-${nextRoomAllocationId++}`,
  roomNumber,
  roomCategoryPreference: "Any",
  bedPreference: "Any",
  adults: 0,
  children: 0,
  infants: 0,
  extraBeds: 0,
  childAges: [],
  ...values,
});

const balancedCounts = (total, rooms) => Array.from(
  { length: Math.max(1, rooms) },
  (_, index) => Math.floor(total / Math.max(1, rooms)) + (index < total % Math.max(1, rooms) ? 1 : 0),
);

const rebalanceRooms = (current, counts) => {
  const roomCount = Math.max(1, toInt(counts.rooms, 1));
  const rows = Array.from({ length: roomCount }, (_, index) => ({
    ...(current[index] || blankRoomAllocation(index + 1)),
    roomNumber: index + 1,
  }));
  ["adults", "children", "infants", "extraBeds"].forEach((field) => {
    const values = balancedCounts(toInt(counts[field]), roomCount);
    rows.forEach((row, index) => {
      row[field] = values[index];
      if (field === "children") {
        row.childAges = Array.from({ length: values[index] }, (_, ageIndex) => row.childAges?.[ageIndex] ?? "");
      }
    });
  });
  return rows;
};

// ── Local presentational primitives — same shapes as CreateBookingClean's Panel/Field ──────────
/* 34px, not 42. This form is 30-odd fields taken while somebody is on the phone, so the thing that
   matters is how many of them are on screen at once — every 8px of control height costs roughly one
   field off the fold. 13px text keeps that readable at a desk; going smaller would not. */
const controlBase =
  "w-full rounded-lg border bg-white py-2.5 text-sm text-slate-800 outline-none transition " +
  "hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const control = (invalid, icon) =>
  `${controlBase} ${icon ? "pl-9 pr-3" : "px-3"} ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200"}`;

/* `collapsible` folds the panel to its header alone. Distinct from the SummaryRow fold below, and
   the distinction is the whole point: SummaryRow retires a step the agent has FINISHED, this one
   parks a step the agent may never need to open at all (assistance is an exception; lead setup
   arrives prefilled). A finished step must not be re-openable in place — an unfinished-but-parked
   one must be, and it keeps its own identity while closed.

   Two rules make a collapsed panel safe to leave collapsed:
   • The body UNMOUNTS, but `register()` runs on the children the PARENT builds, so every rule is
     still live and every value survives (shouldUnregister defaults to false). Folding hides an
     input; it never drops a field.
   • `forceOpen` therefore has to exist: a failed submit must not leave the offending field
     unmounted, or onInvalid scrolls to nothing. One-way on purpose — it opens the panel and then
     lets go, so the agent can close it again without the error re-slamming it open. */
function Panel({
  icon: Icon,
  title,
  description,
  action,
  collapsible = false,
  defaultOpen = true,
  forceOpen = false,
  summary = null,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  /* Rising edge, adjusted during render rather than in an effect — React re-runs this component
     before committing, so the panel is never painted closed over a field that just failed. An
     effect would paint the closed state first and then cascade a second render, and
     `expanded = open || forceOpen` would go the other way: it would hold the panel open and make
     the header toggle look broken until the error cleared. */
  const [forcedAt, setForcedAt] = useState(forceOpen);
  if (forceOpen !== forcedAt) {
    setForcedAt(forceOpen);
    if (forceOpen) setOpen(true);
  }
  const expanded = !collapsible || open;
  // Collapsed, the summary is the only thing left saying what is inside — so it wins over the
  // description, which describes how to fill the panel in rather than what it currently holds.
  const subtitle = expanded ? description : (summary || description);

  const head = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {collapsible && (
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      )}
    </>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${expanded ? "border-b border-slate-100" : ""}`}
      >
        {collapsible ? (
          // data-skip-enter: Enter walks the form field to field (see FOCUSABLE); a header toggle is
          // not a step in that walk.
          <button
            type="button"
            data-skip-enter="true"
            aria-expanded={expanded}
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            {head}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">{head}</div>
        )}
        {action}
      </div>
      {expanded && <div className="px-4 pb-3.5 pt-3">{children}</div>}
    </section>
  );
}
/* A step the agent cannot start yet — the muted stand-in for a Panel whose turn has not come.
   It stays on the page rather than the section simply vanishing: the form's shape then never
   changes underneath the agent, the next thing to do is named where it will appear, and nobody has
   to wonder where the quotation went. Dashed + slate on purpose — a locked step is not an error. */
function LockedStep({ title, hint, badge = null }) {
  return (
    <section
      aria-disabled="true"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-3.5 sm:px-5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Lock className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-slate-500">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
      </div>
      {badge && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
          {badge}
        </span>
      )}
    </section>
  );
}
/* A finished step, folded to one line. Deliberately not a collapsed <Panel>: a panel that can be
   half-open invites the agent to work inside it, and the whole point of folding is that this step is
   done. Edit unfolds the real thing. */
function SummaryRow({ icon: Icon, title, detail, onEdit }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{detail}</p>
      </div>
      {/* Called with no arguments on purpose — the page's unfold helper takes an optional scroll
          target, and handing it a click event would have it query the DOM for one. */}
      <button
        type="button"
        data-skip-enter="true"
        onClick={() => onEdit?.()}
        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
      >
        Edit
      </button>
    </div>
  );
}
function Field({ id, label, required, optional, error, hint, children }) {
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
/**
 * A choice made by pointing, not by opening a list.
 *
 * Exists for the qualification fields specifically. An agent who has taken enquiries on paper for
 * fifteen years reads three visible options and clicks one; the same three inside a <select> are a
 * list they have to open, scan and close, on every single call. Clicking the active chip clears it.
 */
function ChoiceChips({ options, value, onChange, ariaLabel, allowClear = true }) {
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
            data-skip-enter="true"
            onClick={() => onChange(active && allowClear ? "" : option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* Counter tile. Click-to-select on focus so the clerk overtypes instead of having to clear first —
   copied from FastTravelDetails, where it already earns its keep. */
function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${selected
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
        }`}
    >
      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}
/* Service card — rapid mode only. A sibling of Chip, not a variant of it: Chip is an inline pill
   whose leading tick SHIFTS the label, and it still serves the assistance-type row below, so giving
   it two mutually-exclusive DOM trees would put that row one prop-default away from being redesigned.
   This is the reference's "app card": centred pastel tile, centred label, tick in the top-right.
   The tick is one node in BOTH states (transparent when off) so selecting causes no layout shift,
   and the tile keeps its per-service colour when selected — colour encodes WHICH service, the blue
   edge encodes THAT it is picked. */
function ServiceCard({ icon: Icon, label, tile, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      // The label can still ellipsize in the tightest band (one row of eight between the sm and lg
      // breakpoints), so the full name stays available on hover and to assistive tech.
      title={label}
      className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-0.5 py-3 text-center transition focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 sm:px-1 ${selected
        ? "border-blue-500 ring-1 ring-blue-500"
        : "border-slate-200 hover:border-slate-300"
        }`}
    >
      <span
        className={`absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition ${selected
          ? "bg-blue-600 text-white"
          : "border border-slate-200 bg-white text-transparent group-hover:border-slate-300"
          }`}
      >
        <Check className="h-2 w-2" strokeWidth={3.5} />
      </span>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tile}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className={`w-full truncate text-[9px] font-semibold leading-tight sm:text-[10px] ${selected ? "text-slate-900" : "text-slate-600"}`}>
        {label}
      </span>
    </button>
  );
}

/* One panel, one layout — the two-mode split is retired.
   Full details used to render this as a wide two-column block with a General Requirements textarea,
   and Rapid rendered a stacked version that dropped that textarea altogether. Dropping it was the
   expensive half of the split: a trip note taken on the call could only be recorded by reopening
   the lead afterwards, which costs more than the panel it was meant to save. The notes box now
   rides with the assistance fields in the rail, in every mode.

   Open on arrival. It only earns rail space while the enquiry is being taken — once the itinerary
   is confirmed the whole panel retires to a SummaryRow with the other two, so being open costs
   nothing past the point where it stops being relevant. */
function RequirementsAssistancePanel({
  register,
  errors,
  assistanceRequired,
  assistanceTypes,
  toggleAssistance,
  setValue,
  getValues,
  totalTravellers,
  summary,
}) {
  return (
    <Panel
      icon={Accessibility}
      title="Requirements & Assistance"
      description="Trip preferences and traveller support in one place"
      collapsible
      defaultOpen
      summary={summary}
      forceOpen={Boolean(
        errors.specialAssistanceTypes || errors.assistancePassengerCount || errors.specialAssistanceNotes,
      )}
    >
      <div className="space-y-4">
        <Field id="notes" label="General Requirements" optional hint="Hotels, meals, budget, occasion and other trip-wide preferences.">
          <textarea
            {...register("notes")}
            id="notes"
            rows={4}
            placeholder="Preferred hotels, meals, budget, occasion and other trip requirements"
            className={`${control(false)} resize-y`}
          />
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Accessibility &amp; Assistance</h3>
            <p className="mt-1 text-[11px] text-slate-400">Operational support needed for one or more travellers</p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Special assistance required?</p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Special assistance required">
              {[false, true].map((required) => {
                const selected = Boolean(assistanceRequired) === required;
                return (
                  <button
                    key={String(required)}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setValue("specialAssistanceRequired", required, { shouldDirty: true, shouldValidate: true });
                      if (required && toInt(getValues("assistancePassengerCount")) < 1) {
                        setValue("assistancePassengerCount", 1, { shouldDirty: true });
                      }
                    }}
                    className={`min-w-16 rounded-md px-3 py-1.5 text-xs font-bold transition ${selected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-white hover:text-slate-700"}`}
                  >
                    {required ? "Yes" : "No"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Single column on purpose — the panel lives in the 300px rail now, so the old
              full-details `md:grid-cols-[minmax(0,1fr)_130px]` split would only squeeze both. */}
          {assistanceRequired && (
            <div className="mt-3 grid gap-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">
                  Assistance Type <span className="text-red-500">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {ASSISTANCE_TYPES.map((type) => (
                    <Chip key={type} selected={assistanceTypes.includes(type)} onClick={() => toggleAssistance(type)}>
                      {type}
                    </Chip>
                  ))}
                </div>
                {errors.specialAssistanceTypes && (
                  <p className="mt-1 text-xs text-red-500">{errors.specialAssistanceTypes.message}</p>
                )}
              </div>
              <Field id="assistancePassengerCount" label="Passengers" error={errors.assistancePassengerCount?.message}>
                <input
                  {...register("assistancePassengerCount", {
                    validate: (value) => {
                      if (getValues("specialAssistanceRequired") !== true) return true;
                      const count = toInt(value, 0);
                      if (count < 1) return "At least one passenger needs assistance";
                      if (count > totalTravellers) return "Cannot exceed the total travellers";
                      return true;
                    },
                  })}
                  id="assistancePassengerCount"
                  type="number"
                  min={1}
                  max={Math.max(1, totalTravellers)}
                  onFocus={(event) => event.target.select()}
                  onWheel={(event) => event.currentTarget.blur()}
                  className={control(false)}
                />
              </Field>
              <div>
                <Field id="specialAssistanceNotes" label="Assistance Details" optional error={errors.specialAssistanceNotes?.message}>
                  <input
                    {...register("specialAssistanceNotes", { maxLength: { value: 500, message: "Max 500 characters" } })}
                    id="specialAssistanceNotes"
                    placeholder="Wheelchair type, airport support, mobility details"
                    className={control(errors.specialAssistanceNotes)}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
// Module scope, not component scope — it is a constant, and keeping it out of the components
// means focusNext's useCallback does not need it as a dependency.
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  'button:not([disabled]):not([data-skip-enter="true"]),' +
  '[tabindex]:not([tabindex="-1"]):not([data-skip-enter="true"])';

/**
 * Every field of the lead form, in one place.
 *
 * Exported so EditLead renders THIS definition rather than a copy. That is not tidiness — the
 * comment at the bottom of TravelDetails.jsx records what happened last time Create and Edit each
 * owned their own version of these fields: they drifted onto different names (adultMale/adultFemale
 * vs male/female, totalAdults vs adults), the transformer could only read one set, and every lead
 * update silently wrote 0 over the other. One definition makes that class of bug impossible.
 *
 * The page owns the form, the save path and the keyboard; this owns the reference data and the
 * markup. `belowPhone` is a slot the create page fills with its duplicate strip.
 */
export function LeadFormPanels({
  register,
  errors,
  watch,
  setValue,
  getValues,
  clearErrors,
  services,
  onToggleService,
  itinerary,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  phoneRef,
  belowPhone = null,
  compactRail = false,
  /* Progressive disclosure, CREATE with QUOTATION_CREATE only: Customer → Trip → Itinerary is
     one step, and it hands over to Services only when the agent says it is done. Off everywhere else
     — edit must never lock a field on a record that already exists (a saved lead may legitimately
     carry no itinerary at all).
     The page owns the two flags because a failed submit has to be able to force the fold open. */
  stepFlow = false,
  itineraryConfirmed = false,
  itineraryConfirmable = false,
  onConfirmItinerary = null,
  enquiryCollapsed = false,
  onExpandEnquiry = null,
}) {
  const { withCurrent: sourceOptionsFor, loading: sourcesLoading, error: sourcesError } = useLeadSources();

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [forcedSelf, setForcedSelf] = useState(false);
  const [selfUser, setSelfUser] = useState(null);

  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [rowCities, setRowCities] = useState({});
  const [loadingRows, setLoadingRows] = useState({});
  const [destinationModalRow, setDestinationModalRow] = useState(null);
  const [cityModalRow, setCityModalRow] = useState(null);
  /* Retired with Full details: rapid used to show a picked Lead Source as a read-only chip with a
     "Change" link to buy back rail space, and `rapidSourceEditing` was the latch behind it. The
     merged form renders the searchable select outright — the field is required and never prefilled,
     so a control the agent has to click twice to correct is the wrong saving to make.
  const [rapidSourceEditing, setRapidSourceEditing] = useState(false); */

  const departureMode = watch("departureMode");
  const assistanceRequired = watch("specialAssistanceRequired");
  const assistanceTypes = watch("specialAssistanceTypes") || [];
  const roomPlanEnabled = Boolean(watch("roomPlanEnabled"));

  const showAdultBreakdown = Boolean(watch("showAdultBreakdown"));
  const totalAdults = toInt(watch("totalAdults"));
  const totalTravellers = totalAdults + toInt(watch("children")) + toInt(watch("infants"));
  /* `needsOriginCity` is gone with Full details: the departing city used to appear in rapid only
     when a Flight or Vehicle was ticked, which meant the field a Hotel-only enquiry still wants
     was simply not on the form. It is now always rendered, next to the departing country. */
  // The latch, not the data: Services waits for the agent's explicit continue, so adding a stop
  // later never yanks the picker (and the priced quote under it) back off the screen.
  const servicesLocked = stepFlow && !itineraryConfirmed;
  const foldEnquiry = stepFlow && enquiryCollapsed;

  /* What the two folded rows say. Read straight off the same watches the panels use, so a summary
     can never describe a value the form no longer holds — and computed unconditionally because
     hooks cannot be. Every field here is already subscribed above for other reasons. */
  const childCount = toInt(watch("children"));
  const infantCount = toInt(watch("infants"));
  const roomCount = toInt(watch("rooms")) || 1;
  /* One line for one person. Customer Profile used to fold to a row of its own, so a single
     customer produced two summary rows that each described a different half of them. Budget rides
     along here because it is the only optional field the quotation below reacts to; the rest are
     recorded rather than priced and do not earn space on a folded line. */
  const customerSummary = [
    watch("customerName") || "Unnamed customer",
    watch("phone"),
    `${totalAdults}A${childCount ? ` ${childCount}C` : ""}${infantCount ? ` ${infantCount}I` : ""}`,
    `${roomCount} ${roomCount === 1 ? "room" : "rooms"}`,
    watch("budget") ? `₹${Number(watch("budget")).toLocaleString("en-IN")}` : "",
  ].filter(Boolean).join(" · ");
  const summaryNights = itinerary.reduce((sum, row) => sum + toInt(row.nights), 0);
  const tripSummary = [
    itinerary.map((row) => row.city || row.destination).filter(Boolean).join(" → "),
    summaryNights > 0 ? `${summaryNights}N / ${summaryNights + 1}D` : "",
    watch("travelDate"),
  ].filter(Boolean).join(" · ") || "No stops added";
  const leadSourceValue = watch("leadSource") || "";
  const leadSourceLabel = sourceOptionsFor(leadSourceValue)
    .find((option) => String(option.value) === String(leadSourceValue))?.label || leadSourceValue;
  const assignedUserValue = watch("assignedUserId") || "";
  /* Lead Setup's folded line. Source first because it is the only one of the three the form cannot
     prefill, and the owner label falls back to nothing rather than to the raw id — a numeric id in
     a summary is worse than no owner shown at all. */
  const leadSetupSummary = [
    leadSourceLabel ? `Source: ${leadSourceLabel}` : "Source not set",
    users.find((user) => String(user.value) === String(assignedUserValue))?.label,
  ].filter(Boolean).join(" · ");
  /* Lifted out of RequirementsAssistancePanel because the folded rail needs the same line the panel
     shows when collapsed, and two copies of "what does this panel currently say" is exactly how a
     summary starts lying about the form. It covers BOTH halves of the panel now that the General
     Requirements box has moved in — a summary that only ever said "None" over a filled-in notes
     box is worse than no summary at all. */
  const requirementsSummary = [
    String(watch("notes") || "").trim() ? "Requirements noted" : "",
    assistanceRequired
      ? `Assistance: ${assistanceTypes.length > 0 ? assistanceTypes.join(", ") : "type not chosen yet"}`
      : "",
  ].filter(Boolean).join(" · ") || "Nothing added";

  /* specialAssistanceTypes is written with setValue from the chip row, so it has no rendered input
     to hang rules off — it has to be registered explicitly or it is never validated at all, and the
     red asterisk below would be decoration. */
  useEffect(() => {
    register("specialAssistanceTypes", {
      validate: (types) =>
        getValues("specialAssistanceRequired") !== true ||
        (Array.isArray(types) && types.length > 0) ||
        "Select at least one assistance type",
    });
  }, [getValues, register]);

  useEffect(() => {
    register("totalAdults", {
      validate: () => getAdultBreakdownError(getValues()) || true,
    });
  }, [getValues, register]);

  // ── Reference data. Independent effects, so they run in parallel; none blocks typing. ─────────
  /* The country list is fetched unconditionally now. Rapid used to skip it because it hid the
     Departing Country select; that select is part of the one merged form, so skipping the fetch
     would leave it permanently empty. */
  useEffect(() => {
    if (countries.length > 0) return undefined;
    setLoadingCountries(true);
    let active = true;
    geographyService.getCountries()
      .then((response) => {
        if (!active) return;
        const list = extractArray(response)
          .map((c) => (typeof c === "string" ? c : c?.label || c?.name || c?.countryName))
          .filter(Boolean)
          .map((name) => ({ value: name, label: name }));
        setCountries(list);
      })
      .catch(() => { if (active) setCountries([]); })
      .finally(() => { if (active) setLoadingCountries(false); });
    return () => { active = false; };
  }, [countries.length]);

  useEffect(() => {
    let active = true;
    const loadFallback = async () => {
      try {
        const response = await leadService.getUsers();
        const list = extractArray(response);
        if (!active) return;
        setUsers(list.map((u) => ({ value: u.publicId || u.id, label: u.fullName || u.name || u.username })));
      } catch { if (active) setUsers([]); }
    };

    leadService.getAssignmentRecommendation()
      .then((response) => {
        if (!active) return;
        const rec = response?.data?.data ?? response?.data ?? {};
        if (rec.forcedSelf) {
          const self = rec.self || {};
          setForcedSelf(true);
          setSelfUser({ id: self.id, name: self.name });
          if (self.id && !getValues("assignedUserId")) {
            setValue("assignedUserId", self.id, { shouldValidate: true });
          }
          return;
        }
        const pool = Array.isArray(rec.eligibleUsers) ? rec.eligibleUsers : [];
        setUsers(pool.map((u) => ({
          value: u.id,
          label: typeof u.activeLeads === "number" ? `${u.name} · ${u.activeLeads} active` : u.name,
        })));
        if (!getValues("assignedUserId") && rec.recommendedUserId) {
          setValue("assignedUserId", rec.recommendedUserId, { shouldValidate: true });
        }
      })
      .catch(() => active && loadFallback())
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [getValues, setValue]);

  useEffect(() => {
    let active = true;
    geographyService.getAllDestinations()
      .then((response) => { if (active) setDestinations(extractArray(response)); })
      .catch(() => { if (active) setDestinations([]); })
      .finally(() => { if (active) setLoadingDestinations(false); });
    return () => { active = false; };
  }, []);

  // Switching mode clears the other modes' fields so a Flight lead cannot ship a railway station.
  useEffect(() => {
    const keep = new Set(MODE_FIELDS[departureMode] || []);
    Object.values(MODE_FIELDS).flat().forEach((field) => {
      if (!keep.has(field) && getValues(field)) {
        setValue(field, "", { shouldDirty: true, shouldValidate: false });
      }
    });
  }, [departureMode, getValues, setValue]);

  useEffect(() => {
    if (assistanceRequired) return;
    setValue("specialAssistanceTypes", []);
    setValue("assistancePassengerCount", 0);
    setValue("specialAssistanceNotes", "");
    clearErrors?.(["specialAssistanceTypes", "assistancePassengerCount"]);
  }, [assistanceRequired, clearErrors, setValue]);

  // ── Itinerary row helpers ─────────────────────────────────────────────────────────────────────
  const loadCities = useCallback(async (rowId, destinationId) => {
    if (!destinationId) { setRowCities((c) => ({ ...c, [rowId]: [] })); return []; }
    setLoadingRows((c) => ({ ...c, [rowId]: true }));
    try {
      const cities = extractArray(await geographyService.getCitiesByDestination(destinationId));
      setRowCities((c) => ({ ...c, [rowId]: cities }));
      return cities;
    } catch {
      setRowCities((c) => ({ ...c, [rowId]: [] }));
      return [];
    } finally {
      setLoadingRows((c) => ({ ...c, [rowId]: false }));
    }
  }, []);

  /* Edit opens with rows that carry names but often no ids, because that is what the API returns.
     Resolve them once against the destination master so the selects show the saved values instead
     of rendering blank and inviting the user to re-pick a destination that was already right. */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || loadingDestinations || destinations.length === 0) return;
    const needy = itinerary.filter((row) => !row.destinationId && row.destination);
    if (needy.length === 0) { hydratedRef.current = true; return; }

    hydratedRef.current = true;
    needy.forEach(async (row) => {
      const match = destinations.find(
        (d) => String(d?.name || "").trim().toLowerCase() === String(row.destination).trim().toLowerCase()
      );
      if (!match) return;
      const destinationId = String(idOf(match));
      onUpdateRow(row.id, { destinationId });
      const cities = await loadCities(row.id, destinationId);
      if (!row.city) return;
      const city = cities.find(
        (c) => String(c?.name || "").trim().toLowerCase() === String(row.city).trim().toLowerCase()
      );
      if (city) onUpdateRow(row.id, { cityId: String(idOf(city)) });
    });
  }, [destinations, itinerary, loadCities, loadingDestinations, onUpdateRow]);

  const chooseDestination = async (rowId, destinationId) => {
    const destination = destinations.find((d) => String(idOf(d)) === String(destinationId));
    onUpdateRow(rowId, {
      destinationId: destinationId ? String(destinationId) : "",
      destination: destination?.name || "",
      cityId: "",
      city: "",
    });
    await loadCities(rowId, destinationId);
  };

  const chooseCity = (rowId, cityId) => {
    const city = (rowCities[rowId] || []).find((c) => String(idOf(c)) === String(cityId));
    onUpdateRow(rowId, { cityId: cityId ? String(cityId) : "", city: city?.name || "" });
  };

  const onDestinationCreated = async (saved) => {
    const rowId = destinationModalRow;
    setDestinations((list) => [...list, saved]);
    setDestinationModalRow(null);
    if (rowId != null) await chooseDestination(rowId, idOf(saved));
  };

  const onCityCreated = (saved) => {
    const rowId = cityModalRow;
    setCityModalRow(null);
    if (rowId == null) return;
    setRowCities((c) => ({ ...c, [rowId]: [...(c[rowId] || []), saved] }));
    onUpdateRow(rowId, { cityId: String(idOf(saved)), city: saved.name || "" });
  };

  const cityModalDestination = useMemo(() => {
    if (cityModalRow == null) return null;
    const row = itinerary.find((r) => r.id === cityModalRow);
    return destinations.find((d) => String(idOf(d)) === String(row?.destinationId)) || null;
  }, [cityModalRow, destinations, itinerary]);

  const toggleAssistance = (type) => {
    const next = assistanceTypes.includes(type)
      ? assistanceTypes.filter((t) => t !== type)
      : [...assistanceTypes, type];
    setValue("specialAssistanceTypes", next, { shouldDirty: true, shouldValidate: true });
  };

  const setAdultCount = (name, value) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: name === "totalAdults",
    });
    let roomField = name === "totalAdults" ? "adults" : name;
    let roomValue = value;
    if (name === "male" || name === "female") {
      const otherGender = name === "male" ? "female" : "male";
      const adultTotal = toInt(value) + toInt(getValues(otherGender));
      setValue("totalAdults", adultTotal, { shouldDirty: true, shouldValidate: true });
      roomField = "adults";
      roomValue = adultTotal;
    } else if (name !== "totalAdults") {
      setValue("totalAdults", getValues("totalAdults"), { shouldValidate: true });
    }
    /* The re-split of the party across room rows went with the room-by-room editor. `rooms` is a
       plain count on the form and feeds the quotation directly; nothing downstream needs the
       per-room breakdown any more. */
  };

  const toggleAdultBreakdown = (checked) => {
    setValue("showAdultBreakdown", checked, { shouldDirty: true });
    const currentAdults = toInt(getValues("totalAdults"));
    const currentMale = toInt(getValues("male"));
    const currentFemale = toInt(getValues("female"));
    const hasValidSplit = currentMale + currentFemale === currentAdults;
    setValue("male", checked ? (hasValidSplit ? currentMale : currentAdults) : null, { shouldDirty: true });
    setValue("female", checked ? (hasValidSplit ? currentFemale : 0) : null, { shouldDirty: true });
    setValue("totalAdults", getValues("totalAdults"), { shouldValidate: true });
  };

  // Was `pattern: /^[+\d\s\-()]{7,20}$/`, which accepted spaces, dashes and brackets that the
  // server's @Pattern ("^\\+?[1-9]\\d{7,14}$") rejects — including this field's OWN placeholder,
  // "+91 98765 43210". phoneRule validates the normalised value against the server's exact
  // pattern, so what the placeholder shows now genuinely saves.
  const phoneReg = register("phone", phoneRule);

  // Name must not contain numbers. Registered here so the input can wrap onChange to STRIP digits
  // as they're typed; the pattern is the on-submit backstop, the backend @Pattern is the real gate.
  const nameReg = register("customerName", {
    required: "Customer name is required",
    pattern: { value: /^[\p{L}\s.'-]+$/u, message: "Customer name cannot contain numbers" },
  });

  return (
    <>
      {/* Fixed rail, proportional main — the booking form's split, for the same reason. The rail
          holds Lead Setup, Services and Assistance: short panels of small controls that stop
          getting better above ~320px. As `3fr` it took ~30% of a 1400px page, so on a wide monitor
          it grew into 420px of half-empty panel while the Customer and Trip fields — the ones that
          actually want width — wrapped a column earlier than they needed to. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      {/* ── 1 + 2 folded · what the enquiry says, in two lines ─────────────────────────────────
          Not a third rendering of these fields — just their values, so there is nothing here that
          can drift out of step with the panels below. Either the panels are mounted or these rows
          are; never both, so no id or `name` is ever duplicated in the document. */}
      {foldEnquiry && (
        <div className="min-w-0 space-y-3 lg:col-start-1">
          <SummaryRow icon={CircleUserRound} title="Customer" detail={customerSummary} onEdit={onExpandEnquiry} />
          <SummaryRow icon={Route} title="Trip" detail={tripSummary} onEdit={onExpandEnquiry} />
        </div>
      )}

      {/* No Domestic / International switch, and so no passport block either. The two exist to
          gate each other: the switch's only job was to open the passport questions, and asking a
          Manali enquiry about visas is how a form teaches an agent to skip questions. One form for
          both, and the destination already says which kind of trip it is. */}

      {/* ── 1 · Customer ──────────────────────────────────────────────────────────────────────── */}
      {!foldEnquiry && (
      <div className={`min-w-0 ${compactRail ? "lg:col-start-1" : "lg:col-span-2"}`}>
      <Panel
        icon={CircleUserRound}
        title="Customer"
        description="Phone first — an existing lead on this number is flagged as you type"
      >
        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="phone" label="Phone" required error={errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...phoneReg}
                onChange={(e) => { e.target.value = e.target.value.replace(/[^+\d\s\-()]/g, ""); phoneReg.onChange(e); }}
                ref={(node) => { phoneReg.ref(node); if (phoneRef) phoneRef.current = node; }}
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                className={control(errors.phone, true)}
              />
            </div>
          </Field>

          <Field id="customerName" label="Customer Name" required error={errors.customerName?.message}>
            <input
              {...nameReg}
              onChange={(e) => { e.target.value = e.target.value.replace(/[0-9]/g, ""); nameReg.onChange(e); }}
              id="customerName"
              autoComplete="name"
              placeholder="Full name"
              aria-invalid={Boolean(errors.customerName)}
              aria-describedby={errors.customerName ? "customerName-error" : undefined}
              className={control(errors.customerName)}
            />
          </Field>

          <Field id="email" label="Email" optional error={errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...register("email", {
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                })}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@email.com"
                aria-invalid={Boolean(errors.email)}
                className={control(errors.email, true)}
              />
            </div>
          </Field>

            </div>

            {belowPhone}

            <div className="mt-3 border-t border-slate-100 pt-3">
              {/* The "Travellers & Rooms" heading that sat here is gone: TravellerCountFields now
                  carries its own "Travellers" and "Rooms" legends over the two groups, so this was
                  the same words a second time, one line above them. The hint stays — it is the one
                  thing that row said which the legends do not. */}
              <div className="mb-2 flex justify-end">
                <p className="text-[11px] text-slate-400">Click a number and type to replace it</p>
              </div>
              <TravellerCountFields
                values={{
                  totalAdults: watch("totalAdults"),
                  showAdultBreakdown,
                  male: watch("male"),
                  female: watch("female"),
                  children: watch("children"),
                  infants: watch("infants"),
                  rooms: watch("rooms"),
                  extraBeds: watch("extraBeds"),
                }}
                onCountChange={setAdultCount}
                onToggleBreakdown={toggleAdultBreakdown}
                /* Travellers gets the whole row here. Sharing it with Rooms at 3fr/2fr was fine
                   before this group grew a Seniors box and a strip of child-age chips; now the
                   breakdown has four counters to lay out inside a column that already gives 320px
                   to the rail, and it wrapped into three cramped lines. Rooms drops underneath. */
                wideTravellers
                /* `compact` is gone with Full details. It did exactly two things — hide the
                   "Specify adult gender count" toggle and hide Extra Beds — so rapid could not
                   record a male/female split or an extra bed without switching modes first. Both
                   are back for everyone; the counters are one row either way. */
              />

              {/* ── Who they are, not just how many ─────────────────────────────────────────
                  Seniors is a SUBSET of the adults above, never a fourth counter: the headcount
                  is adults + children + infants and must not move because one of the four is 68.
                  Clamped to the adult count rather than validated after the fact — a number that
                  cannot be wrong needs no error message.

                  Child ages are here because the hotel's child policy runs on them, and an age
                  nobody asked for on the call is an age nobody can get afterwards. The ARRAY is
                  the source of truth; raising Children appends a blank rather than rebuilding the
                  list, so ages already typed are never renumbered mid-call. */}
              <div className="mt-2.5 grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                <Field
                  id="seniors60Plus"
                  label="Seniors 60+"
                  hint="Part of the adult count, not added to it"
                >
                  <input
                    {...register("seniors60Plus")}
                    id="seniors60Plus"
                    type="number"
                    min={0}
                    max={toInt(watch("totalAdults"), 1)}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                      const cap = toInt(watch("totalAdults"), 1);
                      setValue("seniors60Plus", Math.max(0, Math.min(cap, toInt(event.target.value))), {
                        shouldDirty: true,
                      });
                    }}
                    className={control(false)}
                  />
                </Field>

                {toInt(watch("children")) > 0 && (
                  <Field label="Children's ages" hint="Hotel child policy is priced on these">
                    <div className="flex flex-wrap items-center gap-2">
                      {Array.from({ length: toInt(watch("children")) }, (_, index) => (
                        <span
                          key={index}
                          className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800"
                        >
                          <input
                            value={(watch("childAges") || [])[index] ?? ""}
                            onChange={(event) => {
                              const ages = [...(getValues("childAges") || [])];
                              ages[index] = event.target.value;
                              setValue("childAges", ages, { shouldDirty: true });
                            }}
                            type="number"
                            min={0}
                            max={17}
                            aria-label={`Child ${index + 1} age`}
                            className="w-9 bg-transparent text-center outline-none"
                          />
                          yrs
                        </span>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
              {/* The blue Total Travellers strip is retired. TravellerCountFields' own first box is
                  now labelled "Total Travellers" and, once the breakdown is open, is the derived
                  total — so this was the same number a second time, two inches lower and in a
                  different colour. `totalTravellers` is still computed above; the assistance panel's
                  passenger-count rule validates against it.
              <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                <span …>Total Travellers</span><span …>{totalTravellers}</span>
              </div> */}

              {/* The room-by-room plan is gone. It asked for a room category, a bed preference and
                  an age per child, per room — on a form whose whole purpose is to take an enquiry
                  in one pass. It was already edit-only, so no new lead ever carried one; leads that
                  do keep theirs (see the save payload) because the backend regroups them into the
                  booking room mix at conversion. */}
            </div>


            {/* ── Optional details ─────────────────────────────────────────────────────
                Was its own "Customer Profile" panel in the rail. Same person, two boxes:
                the agent typed a name here and a birthday three panels away, and the folded
                summary had to carry two rows to describe one customer. Merged in, behind a
                rule rather than a second heading — everything above identifies the customer,
                everything below is what you learn about them on the call. */}
            {/* One grid, not a stack. These five were a 2-up row followed by three full-width
                fields, which made the optional half of the panel twice as tall as the half that
                actually identifies the customer. They are all small controls; they belong on the
                same four-column rhythm as the fields above the rule. */}
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="birthDate" label="Date of Birth" optional>
                <input {...register("birthDate")} id="birthDate" type="date" max={today()} className={control(false)} />
              </Field>
              <Field id="anniversaryDate" label="Anniversary" optional>
                <input {...register("anniversaryDate")} id="anniversaryDate" type="date" max={today()} className={control(false)} />
              </Field>

              <Field id="preferredCommunication" label="Preferred Contact Channel" optional>
                <div className="relative">
                  <select {...register("preferredCommunication")} id="preferredCommunication" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select channel</option>
                    {COMMUNICATION_PREFERENCES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>
    
              <Field id="budget" label="Indicative Budget (₹)" optional error={errors.budget?.message}>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register("budget", { min: { value: 0, message: "Budget cannot be negative" } })}
                    id="budget"
                    type="number"
                    min={0}
                    step="1000"
                    inputMode="numeric"
                    placeholder="150000"
                    onFocus={(event) => event.target.select()}
                    onWheel={(event) => event.currentTarget.blur()}
                    className={control(errors.budget, true)}
                  />
                </div>
              </Field>
    
              <Field id="followUpDate" label="Follow-up Date" optional hint="Creates a reminder when the lead is saved">
                <input {...register("followUpDate")} id="followUpDate" type="date" min={today()} className={control(false)} />
              </Field>
            </div>
          </Panel>
        </div>
        )}

        {/* ── 2 · Trip ──────────────────────────────────────────────────────────────────────────── */}
        {!foldEnquiry && (
        <div className={`min-w-0 ${compactRail ? "lg:col-start-1" : "lg:col-span-2"}`}>
          <Panel
            icon={Route}
            title="Trip"
            description="Dates, travellers, departure and route in one place"
            action={
              <span className="inline-flex w-fit flex-wrap items-center gap-x-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <span>{toInt(watch("totalAdults"), 1)} Adults</span>
                <span>· {toInt(watch("children"))} Children</span>
                <span>· {toInt(watch("infants"))} Infants</span>
                <span>· {toInt(watch("rooms"), 1)} Rooms</span>
              </span>
            }
          >
            {/* ── Where from, and what kind of trip ────────────────────────────────────────
                Two questions the old form never asked, and the two an experienced agent asks
                first. There is no quote without a departure city — every flight, every transfer
                and every night's cost is measured from it — and Occasion moves more of the
                quotation than budget does: a honeymoon, elderly parents and a friends' group buy
                three different hotels, paces and vehicles at the same price. */}
            <div className="mb-2.5 grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
              <Field
                id="fromCity"
                label="From (departure city)"
                hint="Every fare and transfer is priced from here"
              >
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register("fromCity")}
                    id="fromCity"
                    placeholder="Pune"
                    className={control(false, true)}
                  />
                </div>
              </Field>

              <Field id="occasion" label="Occasion" hint="Changes the hotel, the pace and the vehicle">
                <ChoiceChips
                  ariaLabel="Occasion"
                  value={watch("occasion")}
                  onChange={(value) => setValue("occasion", value, { shouldDirty: true })}
                  options={[
                    { value: "HONEYMOON", label: "Honeymoon" },
                    { value: "FAMILY", label: "Family" },
                    { value: "SENIOR_CITIZENS", label: "Seniors" },
                    { value: "FRIENDS", label: "Friends" },
                    { value: "CORPORATE", label: "Corporate" },
                    { value: "PILGRIMAGE", label: "Pilgrimage" },
                    { value: "SOLO", label: "Solo" },
                  ]}
                />
              </Field>
            </div>

            {/* Four fields, two up. Full details ran these at lg:grid-cols-4, but that was a
                full-width main column; the merged form always keeps the 300px rail, so four
                across would put a date picker and two selects in ~150px each. */}
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
              <Field id="travelDate" label="Travel Date" required error={errors.travelDate?.message}>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register("travelDate", { required: "Travel date is required" })}
                    id="travelDate"
                    type="date"
                    aria-invalid={Boolean(errors.travelDate)}
                    className={control(errors.travelDate, true)}
                  />
                </div>
              </Field>

              {/* When they come back. Optional, because a caller often has a departure in mind and
                  no return yet — but it is the field that decides whether a converted booking is a
                  SPAN or a single point: the backend copies it to the booking's tripEndDate, and
                  without it the operations board can only say "End date not set".

                  `min` is the travel date, so a return before departure cannot be typed at all
                  rather than being rejected on save. */}
              <Field id="returnDate" label="Return Date" optional error={errors.returnDate?.message}>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register("returnDate")}
                    id="returnDate"
                    type="date"
                    min={watch("travelDate") || undefined}
                    aria-invalid={Boolean(errors.returnDate)}
                    className={control(errors.returnDate, true)}
                  />
                </div>
              </Field>

              {/* ── When will they DECIDE ───────────────────────────────────────────────────
                  Different question from "when do they travel", and the more useful one. Travel
                  date sorts the calendar; this sorts the callback list, which is the list an agent
                  actually works from — a January trip somebody wants to book this week outranks a
                  September trip they are still daydreaming about.

                  Worded the way a customer answers, not the way an enum reads. */}
              <Field
                id="decideBy"
                label="Decision expected"
                hint="Not the travel date — this sets the callback order"
              >
                <ChoiceChips
                  ariaLabel="Decision timeframe"
                  value={watch("decideBy")}
                  onChange={(value) => setValue("decideBy", value, { shouldDirty: true })}
                  options={[
                    { value: "IMMEDIATE", label: "Now" },
                    { value: "WITHIN_WEEK", label: "This week" },
                    { value: "WITHIN_MONTH", label: "This month" },
                    { value: "JUST_EXPLORING", label: "Just exploring" },
                  ]}
                />
              </Field>

              <Field id="departCountry" label="Departing Country" optional>
                <SearchableSelect
                  name="departCountry"
                  options={countries}
                  value={watch("departCountry") || ""}
                  onChange={(value) => setValue("departCountry", value, { shouldDirty: true })}
                  placeholder="Select country"
                  loading={loadingCountries}
                  icon={Globe2}
                  searchable
                  advanceOnSelect
                />
              </Field>

              <Field id="departCity" label="Departing City" optional>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input {...register("departCity")} id="departCity" placeholder="e.g. Pune" className={control(false, true)} />
                </div>
              </Field>

              <Field id="departureMode" label="Departure Mode" optional>
                <div className="relative">
                  <select {...register("departureMode")} id="departureMode" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select mode</option>
                    {DEPARTURE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>
            </div>

            {departureMode === "Flight / Airport" && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-sky-100 bg-sky-50/50 p-3 sm:grid-cols-3">
                <Field id="departureAirport" label="Departure Airport" optional>
                  <div className="relative">
                    <Plane className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input {...register("departureAirport")} id="departureAirport" placeholder="Airport name" className={control(false, true)} />
                  </div>
                </Field>
                <Field id="airportCode" label="Airport Code" optional>
                  <input {...register("airportCode")} id="airportCode" maxLength={8} placeholder="DEL" className={`${control(false)} uppercase`} />
                </Field>
                <Field id="preferredFlightTime" label="Preferred Time" optional>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input {...register("preferredFlightTime")} id="preferredFlightTime" type="time" className={control(false, true)} />
                  </div>
                </Field>
              </div>
            )}

            {departureMode === "Train / Rail" && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-violet-100 bg-violet-50/50 p-3 sm:grid-cols-3">
                <Field id="railwayStation" label="Railway Station" optional>
                  <div className="relative">
                    <TrainFront className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input {...register("railwayStation")} id="railwayStation" placeholder="Station name" className={control(false, true)} />
                  </div>
                </Field>
                <Field id="trainClass" label="Train Class" optional>
                  <input {...register("trainClass")} id="trainClass" placeholder="2A, 3A, Sleeper" className={control(false)} />
                </Field>
                <Field id="preferredTrainTime" label="Preferred Time" optional>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input {...register("preferredTrainTime")} id="preferredTrainTime" type="time" className={control(false, true)} />
                  </div>
                </Field>
              </div>
            )}

            {departureMode === "Car / Road" && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-3">
                <Field id="pickupAddress" label="Pickup Address" optional>
                  <input {...register("pickupAddress")} id="pickupAddress" placeholder="Pickup address" className={control(false)} />
                </Field>
                <Field id="pickupDateTime" label="Pickup Date & Time" optional>
                  <input {...register("pickupDateTime")} id="pickupDateTime" type="datetime-local" className={control(false)} />
                </Field>
                <Field id="vehiclePreference" label="Vehicle Preference" optional>
                  <input {...register("vehiclePreference")} id="vehiclePreference" placeholder="Sedan, SUV, Traveller" className={control(false)} />
                </Field>
              </div>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <MapPinned className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800">Itinerary</h3>
                    {/* Optional on the RECORD, required by the rapid flow: the picker and the quote
                        below both hang off a real stop, so rapid says so instead of inviting the
                        agent to skip the one thing that unlocks the rest of the page. */}
                    <p className="mt-0.5 text-xs text-slate-500">
                      {stepFlow
                        ? "Add at least one stop — the services picker unlocks from here"
                        : "Optional — leave blank if the route is not decided yet"}
                    </p>
                  </div>
                </div>
              <button
                type="button"
                data-skip-enter="true"
                onClick={onAddRow}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add Stop
              </button>
              </div>
            <div className="mb-2 hidden grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_96px_34px] gap-3 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
              <span>#</span><span>Destination</span><span>City</span><span>Nights</span><span />
            </div>

            {/* id is the scroll target for the half-filled-row check in save(). */}
            <div id="itinerary-group" className="space-y-2.5">
              {itinerary.map((row, index) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_96px_34px] md:items-center md:border-0 md:bg-transparent md:p-0"
                >
                  <span className="hidden h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 md:flex">
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Destination</span>
                    <div className="flex items-center gap-1.5">
                      <div className="min-w-0 flex-1">
                        <SearchableSelect
                          name={`itinerary.${index}.destination`}
                          options={destinations}
                          value={row.destinationId ? Number(row.destinationId) || row.destinationId : ""}
                          onChange={(value) => chooseDestination(row.id, value)}
                          placeholder={row.destination || "Select destination"}
                          loading={loadingDestinations}
                          searchable
                          advanceOnSelect
                        />
                      </div>
                      <button
                        type="button"
                        data-skip-enter="true"
                        onClick={() => setDestinationModalRow(row.id)}
                        title="Add a new destination"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">City</span>
                    <div className="flex items-center gap-1.5">
                      <div className="min-w-0 flex-1">
                        <SearchableSelect
                          name={`itinerary.${index}.city`}
                          options={rowCities[row.id] || []}
                          value={row.cityId ? Number(row.cityId) || row.cityId : ""}
                          onChange={(value) => chooseCity(row.id, value)}
                          placeholder={
                            !row.destinationId ? "Select destination first"
                              : loadingRows[row.id] ? "Loading..."
                                : row.city || "Select city"
                          }
                          loading={Boolean(loadingRows[row.id])}
                          searchable
                          advanceOnSelect
                        />
                      </div>
                      <button
                        type="button"
                        data-skip-enter="true"
                        disabled={!row.destinationId}
                        onClick={() => setCityModalRow(row.id)}
                        title={row.destinationId ? "Add a new city" : "Select destination first"}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Nights</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step="1"
                      inputMode="numeric"
                      value={row.nights}
                      onFocus={(event) => event.target.select()}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) => onUpdateRow(row.id, { nights: event.target.value })}
                      onBlur={(event) => onUpdateRow(row.id, { nights: toInt(event.target.value) })}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || !event.shiftKey) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (index === itinerary.length - 1) {
                          onAddRow();
                          window.setTimeout(() => {
                            const controls = document.querySelectorAll('button[name^="itinerary."][name$=".destination"]');
                            controls[controls.length - 1]?.focus();
                          }, 0);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <button
                    type="button"
                    data-skip-enter="true"
                    onClick={() => onRemoveRow(row.id)}
                    disabled={itinerary.length === 1}
                    aria-label={`Remove stop ${index + 1}`}
                    className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 md:w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {itinerary.reduce((sum, row) => sum + toInt(row.nights), 0)} nights ·{" "}
                {itinerary.reduce((sum, row) => sum + toInt(row.nights), 0) + 1} days
              </span>
              <span>Enter moves on · Shift+Enter adds the next stop.</span>
            </div>

            {/* The hand-off. Nothing on this form can infer "all stops are in" — there is always room
                for one more — so the agent says it, once, and the chain moves on. Disabled rather
                than hidden while a row is half-filled: the reason it cannot be pressed belongs next
                to the button, not in a toast three steps later. */}
            {stepFlow && !itineraryConfirmed && (
              <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {itineraryConfirmable
                    ? "Add every stop first — continuing opens the services picker and folds this section away."
                    : "Each stop needs a destination and a city."}
                </p>
                <button
                  type="button"
                  data-skip-enter="true"
                  disabled={!itineraryConfirmable}
                  onClick={() => onConfirmItinerary?.()}
                  className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Done — continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            </div>
          </Panel>
        </div>
        )}

        {/* ── Services — deliberately OUT of the right rail ─────────────────────────────────────
            Ticking a service is the act of starting to fill it in (toggleService queues the section
            to open below), so the picker earns main-column width and reads as a card grid instead of
            a 2×4 list squeezed into a 300px rail. This is now the ONLY services picker: the rail's
            Chip grid went with Full details, so there is exactly one `services-group` node in the
            document and save()'s scrollIntoView can only resolve to it. */}
        {servicesLocked && (
          /* Locked, not absent, and the count still shows: sticky pre-ticks Hotel from the previous
             enquiry, so a stub that said nothing would read as "your services were dropped". */
          <div className="min-w-0 lg:col-start-1">
            <LockedStep
              title="Services"
              hint={itineraryConfirmable
                ? "Press “Done — continue” under the itinerary to pick services."
                : "Add your itinerary stops above, then continue."}
              badge={services.length > 0 ? `${services.length} pre-selected` : null}
            />
          </div>
        )}

        {!servicesLocked && (
          <div className="min-w-0 lg:col-start-1">
            <Panel
              icon={LayoutGrid}
              title="Services"
              description="Tick what to price — each pick opens its section in the quote below"
              action={(
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  {services.length} selected
                </span>
              )}
            >
              <div id="services-group">
                {/* All eight on ONE row from sm up — the picker reads as a single strip of choices,
                    not a block to work through. Phones fall back to 4-up; eight 40px cards would be
                    unreadable at 375px. */}
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-1.5 lg:gap-2">
                  {SERVICES.map((service) => (
                    <ServiceCard
                      key={service.id}
                      icon={service.icon}
                      label={service.label}
                      tile={service.tile}
                      selected={services.includes(service.id)}
                      onClick={() => onToggleService(service.id)}
                    />
                  ))}
                </div>
                {errors.services && (
                  <p
                    id="services-error"
                    role="alert"
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-700"
                  >
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    {errors.services.message}
                  </p>
                )}
              </div>
            </Panel>
          </div>
        )}

        {/* Requirements & Assistance had a second copy here, in the main column, for Full details.
            One instance now, at the foot of the rail, so the `notes` textarea can never be in the
            document twice. */}

        <aside className={`min-w-0 ${compactRail ? "space-y-3.5 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-start-1 lg:row-span-3" : "space-y-5 lg:col-start-2 lg:row-start-3"}`}>
          {/* ── The rail, folded · the same retirement Customer and Trip get ──────────────────────
              Three panels in, three lines out, on the SAME `foldEnquiry` flag rather than one of
              their own. That is the point: Edit here and Edit on the Customer row have to restore
              the same screen, and a second flag is how one of them ends up restoring half of it.
              Either the rows are mounted or the panels are — never both, so no input is ever in the
              document twice. */}
          {foldEnquiry && (
            <>
              {/* Same order as the panels below — a folded row and the panel it restores must sit
                  in the same place, or continuing puts the agent somewhere they did not expect. */}
              <SummaryRow icon={UserCheck} title="Lead Setup" detail={leadSetupSummary} onEdit={onExpandEnquiry} />
              <SummaryRow icon={Accessibility} title="Requirements" detail={requirementsSummary} onEdit={onExpandEnquiry} />
            </>
          )}

          {/* Hand-foldable, because it shares the rail with the other panels — and it retires to
              its SummaryRow with them once the itinerary is confirmed. */}
          {!foldEnquiry && <Panel
            icon={UserCheck}
            title="Lead Setup"
            description="Source, type, stage, owner and package"
            collapsible
            /* Open on arrival. Type, stage and owner arrive prefilled but the source does not, and a
               prefill nobody saw is a prefill nobody checked — the panel owning the one field the
               form cannot fill in has to be visible while the enquiry is being taken. It retires to
               its SummaryRow on "Done — continue", so being open costs nothing afterwards. */
            defaultOpen
            summary={leadSetupSummary}
            forceOpen={Boolean(errors.leadSource || errors.leadType || errors.leadStage || errors.assignedUserId)}
          >
            <div className={compactRail ? "space-y-3" : "space-y-4"}>
              <Field
                id="leadSource"
                label="Lead Source"
                required
                error={errors.leadSource?.message || (sourcesError ? "Couldn't load sources — showing the current value only." : undefined)}
              >
                <input type="hidden" {...register("leadSource", { required: "Lead source is required" })} />
                <SearchableSelect
                  name="leadSource"
                  options={sourceOptionsFor(leadSourceValue)}
                  value={leadSourceValue}
                  onChange={(value) => setValue("leadSource", value, { shouldDirty: true, shouldValidate: true })}
                  placeholder="Select source"
                  loading={sourcesLoading}
                  searchable
                  advanceOnSelect
                />
              </Field>

              {/* Type and Stage used to be two hidden inputs in rapid — registered so their rules
                  ran, but with no control to change them, so a Hot lead or a Contacted one could
                  only be recorded by leaving the mode. They are real selects for everyone now; the
                  defaults (Fresh / New Lead) are unchanged, so the fast path still needs no touch. */}
              <div className="grid grid-cols-2 gap-4">
                <Field id="leadType" label="Lead Type" required error={errors.leadType?.message}>
                  <div className="relative">
                    <select {...register("leadType", { required: "Lead type is required" })} id="leadType" className={`${control(errors.leadType)} appearance-none pr-9`}>
                      <option value="">Select type</option>
                      {LEAD_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>

                <Field id="leadStage" label="Stage" required error={errors.leadStage?.message}>
                  <div className="relative">
                    <select {...register("leadStage", { required: "Lead stage is required" })} id="leadStage" className={`${control(errors.leadStage)} appearance-none pr-9`}>
                      {LEAD_STAGES.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
              </div>

              {/* One control, not two. Rapid rendered a read-only "Auto" pill whose only escape
                  hatch was the sentence "Choose an owner in Full details" — a dead end once that
                  mode is gone. The select below IS the auto-assignment: the recommendation effect
                  writes it, so it opens on the recommended owner and can simply be overtyped.
                  `forcedSelf` still wins, because that one is a permission, not a suggestion. */}
              <Field
                id="assignedUserId"
                label="Assign To"
                required
                error={errors.assignedUserId?.message}
                hint={forcedSelf ? undefined : usersLoading
                  ? "Choosing the best owner…"
                  : assignedUserValue ? "Auto-assigned — change it if this lead belongs elsewhere." : undefined}
              >
                {forcedSelf ? (
                  <>
                    <input type="hidden" {...register("assignedUserId", { required: "Assigned user is required" })} />
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <UserCheck className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="truncate text-sm font-semibold text-slate-700">{selfUser?.name || "You"}</span>
                      <span className="ml-auto shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Assigned to you
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <input type="hidden" {...register("assignedUserId", { required: "Assigned user is required" })} />
                    <SearchableSelect
                      name="assignedUserId"
                      options={users}
                      value={watch("assignedUserId") || ""}
                      onChange={(value) => setValue("assignedUserId", value, { shouldDirty: true, shouldValidate: true })}
                      placeholder="Select team member"
                      loading={usersLoading}
                      searchable
                      advanceOnSelect
                    />
                  </>
                )}
              </Field>

              <Field id="packageType" label="Package Type" optional>
                <div className="relative">
                  <select {...register("packageType")} id="packageType" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select package</option>
                    {PACKAGE_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>
            </div>
          </Panel>}

          {/* The rail's Chip copy of the services picker went with Full details. It was the second
              `services-group` node in the file, and the only reason save()'s scrollIntoView had to
              rely on exactly one of the two being mounted. The card grid in the main column is now
              the single picker. */}

          {!foldEnquiry && (
            <RequirementsAssistancePanel
              register={register}
              errors={errors}
              assistanceRequired={assistanceRequired}
              assistanceTypes={assistanceTypes}
              toggleAssistance={toggleAssistance}
              setValue={setValue}
              getValues={getValues}
              totalTravellers={totalTravellers}
              summary={requirementsSummary}
            />
          )}
        </aside>
      </div>

      <QuickDestinationModal
        open={destinationModalRow != null}
        onClose={() => setDestinationModalRow(null)}
        onCreated={onDestinationCreated}
        defaultCountryName="India"
      />
      <QuickCityModal
        open={cityModalRow != null}
        onClose={() => setCityModalRow(null)}
        onCreated={onCityCreated}
        destination={cityModalDestination}
      />
    </>
  );
}
export default function LeadFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [searchParams] = useSearchParams();
  /* `?mode=rapid|full` is retired along with the second mode. It is deliberately just ignored
     rather than redirected: old bookmarks, the quick-action palette and anything that still links
     with the param land on the one form instead of 404ing on a mode that no longer exists. */
  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);
  const phoneRef = useRef(null);

  const {
    register, handleSubmit, watch, setValue, setError, getValues, clearErrors, reset,
    formState: { errors },
  } = useForm({
    // onTouched = validate on first blur, then live. The old form passed no mode, so RHF defaulted
    // to onSubmit and the clerk learned about a bad phone number only after filling forty fields.
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { ...blankDefaults(), ...(editing ? {} : readSticky()) },
  });

  const [services, setServices] = useState(() => (editing ? [] : readStickyServices()));
  const [itinerary, setItinerary] = useState(() => [blankRow()]);
  /* The rapid chain's first latch, read by the Services gate below, by the quotation gate under it
     and by save(). One derivation for all three, so the page can never lock a step it is about to
     demand — the classic dead end where "Select at least one service" points at a locked picker. */
  const itineraryReady = useMemo(() => hasCompleteStop(itinerary), [itinerary]);
  /* A lead's saved room-by-room plan, held exactly as it arrived. There is no editor for it any
     more, so this is the only thing standing between an old lead's plan and being wiped by the
     next save. Empty on create — that form never produced one. */
  const loadedRoomAllocationsRef = useRef([]);

  const [roomAllocations, setRoomAllocations] = useState(() => rebalanceRooms([], {
    rooms: 1, adults: 2, children: 0, infants: 0, extraBeds: 0,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [leadCode, setLeadCode] = useState("");
  /* Two different records, two different consequences, so they are tracked separately:
       lead     — an enquiry from this person already exists. A duplicate risk; nothing is written
                  unless the clerk asks for it.
       customer — this person is an existing client. A prefill opportunity, and the reason the
                  backend has carried GET /api/customers/lookup all along. */
  const [contactMatch, setContactMatch] = useState(EMPTY_MATCH);
  const [checkingContact, setCheckingContact] = useState(false);
  const [autoFilled, setAutoFilled] = useState([]);
  /* ── Rapid Mode is the only mode ─────────────────────────────────────────────────────────────
     There were two: Rapid, and a "Full details" form that was the only place a handful of fields
     existed at all — notes, departing country, lead type, stage, package type, the adult gender
     split, extra beds, and a freely-chosen owner. Every one of those has moved into Rapid, so the
     toggle had nothing left to switch between and is gone with the `?mode=` param, the Alt+1/Alt+2
     shortcut and the blue intro banner.

     What did NOT change is the Rapid flow: sticky header, sticky-field batch entry, the
     itinerary → services → quotation chain with its fold, Ctrl+Enter to price and
     Ctrl+Shift+Enter to save-and-start-the-next. The extra fields ride in the collapsible rail
     panels, which retire to their summary rows the moment the itinerary is confirmed — so the fast
     path is the same number of keystrokes it was. */

  const [savedThisSession, setSavedThisSession] = useState(readSessionCount);

  const rebalanceRoomAllocations = useCallback((counts) => {
    setRoomAllocations((current) => rebalanceRooms(current, counts));
  }, []);

  const updateRoomAllocation = useCallback((roomId, patch) => {
    setRoomAllocations((current) => {
      const next = current.map((room) => {
        if (room.id !== roomId) return room;
        const updated = { ...room, ...patch };
        if (Object.hasOwn(patch, "children")) {
          updated.childAges = Array.from(
            { length: toInt(updated.children) },
            (_, index) => updated.childAges?.[index] ?? "",
          );
        }
        return updated;
      });
      const sum = (field) => next.reduce((total, room) => total + toInt(room[field]), 0);
      setValue("rooms", next.length, { shouldDirty: true });
      setValue("totalAdults", sum("adults"), { shouldDirty: true, shouldValidate: true });
      setValue("children", sum("children"), { shouldDirty: true });
      setValue("infants", sum("infants"), { shouldDirty: true });
      setValue("extraBeds", sum("extraBeds"), { shouldDirty: true });
      setValue("showAdultBreakdown", false, { shouldDirty: true });
      setValue("male", null, { shouldDirty: true });
      setValue("female", null, { shouldDirty: true });
      return next;
    });
  }, [setValue]);

  const phone = watch("phone");
  const email = watch("email");
  // A clerk with no CUSTOMER_READ would get a 403 on every probe, and the shared interceptor toasts
  // 403s — one per keystroke burst. Their lead form simply does not run the customer half.
  const canReadLeads = useMemo(() => hasPermission(P.LEAD_READ), []);
  const canReadCustomers = useMemo(() => hasPermission(P.CUSTOMER_READ), []);
  const canCreateQuotation = useMemo(
    () => hasPermission(P.QUOTATION_CREATE) && hasPermission(P.LEAD_READ),
    [],
  );
  const canUpdateQuotation = useMemo(() => hasPermission(P.QUOTATION_UPDATE), []);
  const canUseCombinedContactLookup = useMemo(
    () => hasPermission(P.LEAD_READ) && hasPermission(P.CUSTOMER_READ),
    [],
  );

  /* Retired with the second mode. It existed to tear the inline quote down when the agent left
     Rapid — without it `createdQuote` survived into full-details and relabelled the primary button
     "Update Quotation", whose handler then bailed on the now-null model and did nothing at all.
     With one mode there is nothing to leave, so the whole hazard is gone rather than handled.
  const changeEntryMode = (nextRapidEntry) => {
    setRapidEntry(nextRapidEntry);
    if (!nextRapidEntry) resetInlineQuote();
  }; */

  /* ── Price the enquiry without leaving this screen ───────────────────────────────────────────
     This page used to take the enquiry and then NAVIGATE to /quick-quote to price it, so a single
     phone call spanned two pages and a page load. The quotation accordion now renders below this
     form: the model is seeded live from the trip details as they are typed, and one click writes the
     lead and its quotation back to back.

     Only create, only with QUOTATION_CREATE — an agent who cannot write quotations gets the same
     lead form with no pricing block under it, exactly as before. */
  const quoteInline = !editing && canCreateQuotation;
  /* The step chain — itinerary → services → quotation — exists to feed the quote, so it is scoped to
     exactly the agents who get a quote: same condition as quoteInline, deliberately not a looser
     one. Without QUOTATION_CREATE there is no pricing block to protect, and gating Services there
     would only add a lock to a form that has nothing behind it. Edit is untouched for the same
     reason: it locks nothing today, and must not start locking a record that already exists. */
  const stepFlow = quoteInline;
  /* The agent's explicit "I am done adding stops". Nothing infers this — the form can always take
     one more stop, so a rule like "every row is filled" would open Services after the first one and
     then slam it shut the moment Add Stop appended a blank row, tearing a half-priced quotation off
     the screen mid-call. Latched on purpose: once continued, adding a sixth stop never re-locks. */
  const [itineraryConfirmed, setItineraryConfirmed] = useState(false);
  /* Steps 1-2 of the form (Customer, Trip) fold into summary rows once the agent continues, so the
     screen belongs to whichever step is actually being worked on. ONE flag for both panels, not one
     each: every path that has to force them back open — a failed submit, a manual scroll target
     inside a folded panel — then has a single thing to flip and cannot half-restore the form. */
  const [enquiryCollapsed, setEnquiryCollapsed] = useState(false);
  /* Confirm is offered only when the itinerary is actually shippable: at least one real stop and no
     row carrying half a pair. Letting it through on a half-filled row would just move the same
     rejection to the save, three steps later, with the offending row folded out of sight by then. */
  const itineraryConfirmable = useMemo(() => itineraryReady && !itinerary.some(
    (row) => Boolean(String(row.destination || "").trim()) !== Boolean(String(row.city || "").trim()),
  ), [itinerary, itineraryReady]);

  /* Both halves of the latch fire together: the picker unlocks and the enquiry folds, so the screen
     belongs to the step that just became actionable. Scrolled, not focused — the service cards are
     buttons, and landing focus on the first one would make a stray Enter tick it. */
  /* "There is enough here to price" — the agent pressing "Done — continue", which is a deliberate
     step in the chain rather than anything the form infers. With one mode this is exactly
     itineraryConfirmed; it keeps a name of its own because the two gates below read better asking
     whether the quote is ready than asking about the itinerary. */
  const quoteReady = itineraryConfirmed;

  const confirmItinerary = useCallback(() => {
    setItineraryConfirmed(true);
    setEnquiryCollapsed(true);
    window.setTimeout(() => {
      document.getElementById("services-group")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  }, []);

  /* The one way back into a folded field. A collapsed panel is UNMOUNTED, so focus() and
     scrollIntoView() on anything inside it are silent no-ops — which is precisely how a submit
     button comes to read as dead. Unfold, let React commit, then aim. */
  const revealEnquiry = useCallback((selector = null) => {
    setEnquiryCollapsed(false);
    if (!selector) return;
    window.setTimeout(() => {
      const node = document.querySelector(selector);
      node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }, 0);
  }, []);

  const [quoteModel, setQuoteModel] = useState(null);
  const [createdQuote, setCreatedQuote] = useState(null);
  /* Whether the inline booking panel is showing. Closed by default: most quotes are sent and slept
     on, and a booking form open under every one of them would be noise on the common path. */
  const [bookOpen, setBookOpen] = useState(false);
  /* BOOKING_CREATE, not the LEAD_CREATE that opened this page — an agent who takes enquiries is not
     necessarily the person who commits the agency to a supplier. The backend enforces the same
     split, so without this the button would exist only to produce a 403. */
  const canBook = useMemo(() => hasPermission(P.BOOKING_CREATE), []);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteStyleOpen, setQuoteStyleOpen] = useState(false);
  const quoteSectionsRef = useRef(null);
  // Auto-seeding stops the moment the agent touches the quote. Without this, typing one more
  // itinerary stop would silently wipe the rooms and prices already entered below.
  const quoteTouchedRef = useRef(false);
  const [quoteTouched, setQuoteTouched] = useState(false);
  /* Every path that starts a fresh enquiry — Clear, Save & New, Next enquiry, leaving rapid mode —
     has to come through here. Missing any one of them left the PREVIOUS customer's rows, prices and
     quotation id loaded against the new lead, so "Update Quotation" would overwrite the quote that
     had just been sent to someone else. Declared before its callers so nothing can use a stale copy. */
  const resetInlineQuote = useCallback(() => {
    setCreatedQuote(null);
    setQuoteModel(null);
    // Belongs here for the reason above, not next to its button: an open booking panel left over
    // from the last enquiry would be holding the PREVIOUS customer's vendor cost and advance, ready
    // to confirm against the new lead.
    setBookOpen(false);
    quoteTouchedRef.current = false;
    setQuoteTouched(false);
    // The step chain resets with the quote, not separately — every one of those paths already routes
    // through here, so there is no fifth place to forget. A blank enquiry that kept the latch would
    // show Services unlocked over an empty itinerary, and one that kept the fold would open on two
    // summary rows describing the customer who just left.
    setItineraryConfirmed(false);
    setEnquiryCollapsed(false);
  }, []);
  const {
    downloadPdf: runQuotePdfDownload,
    isDownloading: quotePdfBusy,
    progress: quotePdfProgress,
    progressSupported: quotePdfProgressSupported,
  } = usePdfDownload();

  const customerNameValue = watch("customerName");
  const travelDateValue = watch("travelDate");
  const departCityValue = watch("departCity");
  const adultsValue = watch("totalAdults");
  const childrenValue = watch("children");
  const infantsValue = watch("infants");
  const roomsValue = watch("rooms");
  const extraBedsValue = watch("extraBeds");

  /* The lead record this form is ABOUT to save, in the shape buildQuickQuoteModel reads. Nothing is
     fetched — that is the point: the quote is built before the lead exists. Half-filled itinerary
     rows are dropped here because they are the form's own blank template, not real stops. */
  const draftLeadKey = useMemo(() => JSON.stringify({
    customerName: customerNameValue || "",
    travelDate: travelDateValue || "",
    departCity: departCityValue || "",
    adults: toInt(adultsValue, 1),
    totalAdults: toInt(adultsValue, 1),
    children: toInt(childrenValue),
    infants: toInt(infantsValue),
    rooms: toInt(roomsValue, 1),
    extraBeds: toInt(extraBedsValue),
    services,
    itinerary: itinerary
      .filter((row) => String(row.destination || "").trim() && String(row.city || "").trim())
      .map((row) => ({
        destination: row.destination,
        city: row.city,
        nights: toInt(row.nights, 1),
      })),
    roomAllocations: [],
  }), [customerNameValue, travelDateValue, departCityValue, adultsValue, childrenValue,
    infantsValue, roomsValue, extraBedsValue, services, itinerary]);

  // Serialised, not an object: the dependency has to compare by VALUE or every keystroke anywhere on
  // the form would rebuild the model from a new object identity and reset the quote.
  useEffect(() => {
    if (!quoteInline) {
      setQuoteModel(null);
      return;
    }
    if (quoteTouchedRef.current) return;
    setQuoteModel(buildQuickQuoteModel(JSON.parse(draftLeadKey)));
  }, [quoteInline, draftLeadKey]);

  /* A service ticked above must grow its section here even after the quote has been edited and
     auto-seeding has stopped — otherwise adding Vehicle mid-call would silently do nothing.
     syncQuickQuoteServices returns the SAME object when nothing changed, so this cannot loop. */
  const servicesKey = services.join("|");
  useEffect(() => {
    if (!quoteInline || !quoteTouchedRef.current) return;
    setQuoteModel((current) => syncQuickQuoteServices(current, servicesKey ? servicesKey.split("|") : []));
  }, [quoteInline, servicesKey]);

  /* The same problem as the services sync above, for the party size.
     The seed already splits travellers across rooms correctly, but seeding stops the moment the
     quote is touched — and picking a hotel touches it. From then on, correcting the party from 2 to
     6 upstairs left the hotel's room lines still saying 2 adults, and the quote went out priced for
     a party that was never coming. Serialised into a string for the same reason as draftLeadKey: the
     dependency has to compare by VALUE or every keystroke on the form would rebuild the room lines.
     syncQuickQuotePax leaves any stay the agent has hand-shaped alone and returns the same object
     when nothing changed, so this cannot loop. */
  const paxKey = [
    toInt(adultsValue, 1), toInt(childrenValue), toInt(infantsValue),
    toInt(roomsValue, 1), toInt(extraBedsValue),
  ].join("|");
  useEffect(() => {
    if (!quoteInline || !quoteTouchedRef.current) return;
    const [adults, children, infants, rooms, extraBeds] = paxKey.split("|").map(Number);
    setQuoteModel((current) => syncQuickQuotePax(current, { adults, children, infants, rooms, extraBeds }));
  }, [quoteInline, paxKey]);

  /* Open the section a just-ticked service created, once the model actually carries it.
     `focus` is the difference between the two places a service can be ticked from. From the picker
     above, the new section appears directly underneath it — both are already on screen, so opening
     it must NOT move the page (see the reveal effect in QuickQuoteSections). From the "Also need"
     strip inside the accordion, the new section is hoisted to the TOP of the accordion, i.e. above
     the viewport the agent is looking at, so that one has to be scrolled to. Passing a field
     selector is what asks reveal() to scroll, and it lands the cursor in the first field too. */
  const pendingQuoteRevealRef = useRef(null);
  useEffect(() => {
    const pending = pendingQuoteRevealRef.current;
    if (!pending) return;
    if (!quoteModel?.enabledCore?.includes(pending.id)) return;
    pendingQuoteRevealRef.current = null;
    /* Always with a field selector, which is what asks reveal() to SCROLL — and to land the cursor
       in the section's first input.

       This used to pass null when the tick came from the Services picker, on the reasoning that the
       picker and the section beneath it were both already on screen so moving the page would be
       jarring. That holds on a short form and stops holding on this one: with the trip details, the
       itinerary rows and eight service cards above it, the section a tick creates is routinely below
       the fold, and the agent was left looking at the picker wondering whether anything happened.
       Ticking a service IS the request to fill it in, so go there. */
    quoteSectionsRef.current?.reveal(pending.id, "[data-quick-field]");
  }, [quoteModel]);

  /* Finishing a section just collapses it — no scrolling. The loop is tick a service → fill it →
     done → tick the next one, and the page staying still is what makes that loop fast. */
  const handleSectionDone = useCallback(() => {
    quoteSectionsRef.current?.close();
  }, []);

  const updateQuoteModel = useCallback((updater) => {
    if (!quoteTouchedRef.current) {
      quoteTouchedRef.current = true;
      setQuoteTouched(true);
    }
    setQuoteModel(updater);
  }, []);

  // Explicit re-seed. Offered only once the quote is dirty, because until then it is already live.
  const resyncQuoteFromLead = () => {
    quoteTouchedRef.current = false;
    setQuoteTouched(false);
    setQuoteModel(buildQuickQuoteModel(JSON.parse(draftLeadKey)));
    showToast("Quotation re-seeded from the current trip details.", "success");
  };

  const quoteTotals = useMemo(() => quickQuoteTotals(quoteModel), [quoteModel]);

  useEffect(() => {
    if (!editing) phoneRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;

    leadService.getLeadById(id)
      .then((response) => {
        if (!active) return;
        const body = response?.data;
        const lead = body?.data?.data ?? body?.data ?? body ?? {};
        setLeadCode(lead.leadCode || "");

        const assignedUserId =
          lead.assignedUserId ?? lead.assignedUserPublicId ?? lead.assignToPublicId ??
          lead.assignedToPublicId ?? lead.assignedUser?.publicId ?? lead.assignedUser?.id ??
          lead.assignTo?.publicId ?? lead.assignTo?.id ?? "";
        const adultPrefill = deriveAdultBreakdown({
          totalAdults: lead.totalAdults ?? lead.adults ?? lead.adultCount,
          male: lead.male ?? lead.maleCount,
          female: lead.female ?? lead.femaleCount,
        });

        reset({
          ...blankDefaults(),
          customerName: lead.customerName ?? lead.customer?.name ?? lead.name ?? "",
          phone: lead.phone ?? lead.mobile ?? lead.contactNumber ?? lead.customer?.phone ?? "",
          email: lead.email ?? lead.customer?.email ?? "",
          budget: lead.budget ?? lead.estimatedValue ?? "",
          leadSource: lead.leadSource ?? lead.source ?? "",
          leadType: lead.leadType ?? lead.type ?? "Fresh",
          leadStage: lead.leadStage ?? lead.stage ?? "New Lead",
          assignedUserId,
          birthDate: toDateInput(lead.birthDate ?? lead.dateOfBirth ?? lead.dob),
          anniversaryDate: toDateInput(lead.anniversaryDate ?? lead.marriageAnniversary ?? lead.anniversary),
          preferredCommunication:
            lead.preferredCommunication ?? lead.communicationPreference ?? lead.commPref ?? "",
          followUpDate: toDateInput(lead.followUpDate ?? lead.followupDate ?? lead.nextFollowUpDate),
          packageType: lead.packageType ?? lead.tripType ?? "",
          travelDate: toDateInput(lead.travelDate ?? lead.tripDate ?? lead.departureDate),
          returnDate: toDateInput(lead.returnDate),
          departCountry: lead.departCountry ?? lead.departureCountry ?? "India",
          departCity: lead.departCity ?? lead.departureCity ?? "",
          departureMode: lead.departureMode ?? lead.transportMode ?? "",
          departureAirport: lead.departureAirport ?? lead.airportName ?? "",
          airportCode: lead.airportCode ?? lead.departureAirportCode ?? "",
          preferredFlightTime: String(lead.preferredFlightTime ?? lead.flightTime ?? "").slice(0, 5),
          railwayStation: lead.railwayStation ?? lead.departureStation ?? "",
          trainClass: lead.trainClass ?? lead.railClass ?? "",
          preferredTrainTime: String(lead.preferredTrainTime ?? lead.trainTime ?? "").slice(0, 5),
          pickupAddress: lead.pickupAddress ?? lead.roadPickupAddress ?? "",
          pickupDateTime: String(lead.pickupDateTime ?? lead.pickupAt ?? "").slice(0, 16),
          vehiclePreference: lead.vehiclePreference ?? lead.preferredVehicle ?? "",
          rooms: toInt(lead.rooms ?? lead.roomCount ?? lead.noOfRooms ?? 1, 1),
          ...adultPrefill,
          children: toInt(lead.children ?? lead.childCount ?? 0),
          infants: toInt(lead.infants ?? lead.infantCount ?? 0),
          extraBeds: toInt(lead.extraBeds ?? lead.extraBedCount ?? 0),
          specialAssistanceRequired: Boolean(
            lead.specialAssistanceRequired ?? lead.needsSpecialAssistance ??
            (Array.isArray(lead.specialAssistanceTypes) && lead.specialAssistanceTypes.length > 0)
          ),
          specialAssistanceTypes: Array.isArray(lead.specialAssistanceTypes)
            ? lead.specialAssistanceTypes
            : Array.isArray(lead.assistanceTypes) ? lead.assistanceTypes : [],
          assistancePassengerCount: toInt(lead.assistancePassengerCount ?? lead.assistancePassengers ?? 0),
          specialAssistanceNotes: lead.specialAssistanceNotes ?? lead.assistanceNotes ?? "",
          notes: lead.notes ?? lead.note ?? lead.remarks ?? lead.requirements ?? "",
        });

        const rawServices = lead.services ?? lead.selectedServices ?? lead.requiredServices ?? [];
        setServices([
          ...new Set((Array.isArray(rawServices) ? rawServices : []).map(normalizeServiceId).filter(Boolean)),
        ]);

        const rawItinerary = lead.itinerary ?? lead.itineraries ?? lead.travelItinerary ?? [];
        const rows = (Array.isArray(rawItinerary) ? rawItinerary : []).map((row) => ({
          ...blankRow(),
          destinationId: row.destinationId ?? row.destinationPublicId ?? row.destination?.id ?? row.destination?.publicId ?? "",
          destination: entityName(row.destination, row.destinationName ?? row.destinationLabel ?? ""),
          cityId: row.cityId ?? row.cityPublicId ?? row.city?.id ?? row.city?.publicId ?? "",
          city: entityName(row.city, row.cityName ?? row.cityLabel ?? ""),
          nights: Math.max(0, toInt(row.nights ?? row.noOfNights ?? row.stayNights ?? 1)),
        }));
        setItinerary(rows.length > 0 ? rows : [blankRow()]);

        const savedAllocations = Array.isArray(lead.roomAllocations) ? lead.roomAllocations : [];
        /* The room-by-room plan has no editor on this form any more, but a lead saved when it did
           still carries one, and the backend regroups it into the booking's room MIX at conversion
           time. Held verbatim so saving an old lead cannot silently destroy it — an edit form that
           deletes what it chose not to show you is worse than one that shows too much. */
        loadedRoomAllocationsRef.current = savedAllocations;
        setValue("roomPlanEnabled", savedAllocations.length > 0, { shouldDirty: false });
        if (savedAllocations.length > 0) {
          setRoomAllocations(savedAllocations.map((room, index) => blankRoomAllocation(index + 1, {
            id: room.id || room.publicId || `saved-room-${index + 1}`,
            roomNumber: room.roomNumber || index + 1,
            roomCategoryPreference: room.roomCategoryPreference || "Any",
            bedPreference: room.bedPreference || "Any",
            adults: toInt(room.adults),
            children: toInt(room.children),
            infants: toInt(room.infants),
            extraBeds: toInt(room.extraBeds),
            childAges: Array.isArray(room.childAges) ? room.childAges : [],
          })));
        } else {
          setRoomAllocations(rebalanceRooms([], {
            rooms: toInt(lead.rooms ?? 1, 1),
            adults: adultPrefill.totalAdults,
            children: toInt(lead.children),
            infants: toInt(lead.infants),
            extraBeds: toInt(lead.extraBeds),
          }));
        }
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Failed to load the lead."), "error");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [editing, id, reset, setValue, showToast]);

  /* ── Contact check: is this person already in the CRM? ───────────────────────────────────────
     Debounced against the real Phone and Email fields. The old form had a SECOND phone box that the
     clerk had to retype into and press Search, so in practice nobody ever ran it — and it only ever
     asked about LEADS, by PHONE.

     Both books are now asked, on either identifier:
       • leads/search        → "there is already an enquiry from them"      (duplicate risk)
       • customers/lookup    → "they are an existing client"                (prefill opportunity)

     The customer half is the one the backend was already built for: CustomerController.lookup's
     javadoc calls itself "the probe behind the lead form's Customer found popup", it answers 200
     with matched:false for the common no-match case, and it runs the SAME CustomerMatcher that links
     the lead at creation — so this can never promise a link the save does not make. It was simply
     never called from here.

     A miss stays silent. At 100 records a day, a toast saying "nobody found" on every one of them is
     pure noise. */
  const probeContact = useCallback(async (rawPhone, rawEmail) => {
    if (canUseCombinedContactLookup) {
      try {
        const response = await leadService.lookupQuickQuoteContact({ phone: rawPhone, email: rawEmail });
        const body = response?.data;
        const combined = body?.data?.data ?? body?.data ?? body ?? {};
        return {
          lead: isOpenLead(combined.lead) ? combined.lead : null,
          customer: combined.customer?.matched ? combined.customer : null,
        };
      } catch {
        // Mixed-version deployments can briefly have the new UI ahead of the endpoint. The existing
        // two calls remain a safe fallback and keep contact checking non-blocking.
      }
    }

    // Phone first — it is the per-tenant natural key. Email is the fallback, which is what lets an
    // enquiry that arrives by email still find its own history.
    const identifiers = [rawPhone, rawEmail].filter(Boolean);

    const findLead = async () => {
      if (!canReadLeads) return null;
      for (const identifier of identifiers) {
        const found = await leadService.findLeadByContact(identifier);
        if (isOpenLead(found)) return found;
      }
      return null;
    };

    const [lead, customer] = await Promise.all([
      findLead().catch(() => null),
      canReadCustomers
        ? customerService.lookup({ phone: rawPhone, email: rawEmail }).catch(() => null)
        : Promise.resolve(null),
    ]);

    return { lead, customer: customer?.matched ? customer : null };
  }, [canReadCustomers, canReadLeads, canUseCombinedContactLookup]);

  /* Blank-only by design. The clerk is still typing while this lands, and a lookup that overwrites a
     name they just corrected is worse than no lookup at all. "Use this customer" is the explicit,
     overwriting version of the same call. Returns the labels of what it actually wrote so the strip
     can say precisely that, instead of implying the whole form was rewritten. */
  const prefillFromCustomer = useCallback((customer, { overwrite = false } = {}) => {
    if (!customer) return [];
    const written = [];
    const apply = (field, label, value) => {
      if (value == null || value === "") return;
      const current = getValues(field);
      if (!overwrite && String(current ?? "").trim() !== "") return;
      if (String(current ?? "") === String(value)) return;
      setValue(field, value, { shouldDirty: true, shouldValidate: false });
      written.push(label);
    };
    // Phone is never written back — the caret is in it.
    apply("customerName", "name", customer.name);
    apply("email", "email", customer.email);
    apply("departCity", "departure city", customer.city);
    apply("birthDate", "birth date", toDateInput(customer.birthday));
    apply("anniversaryDate", "anniversary", toDateInput(customer.anniversary));
    return written;
  }, [getValues, setValue]);

  const lastPrefilledCustomer = useRef("");

  useEffect(() => {
    if (editing) return undefined;
    const rawPhone = String(phone || "").trim();
    const rawEmail = String(email || "").trim();
    const phoneReady = rawPhone.replace(/\D/g, "").length >= 7;
    const emailReady = EMAIL_PATTERN.test(rawEmail);

    if (!phoneReady && !emailReady) {
      setContactMatch(EMPTY_MATCH);
      setAutoFilled([]);
      lastPrefilledCustomer.current = "";
      return undefined;
    }

    let active = true;
    setCheckingContact(true);
    const timer = window.setTimeout(async () => {
      const match = await probeContact(
        phoneReady ? rawPhone : "",
        emailReady ? rawEmail : "",
      );
      if (!active) return;
      setContactMatch(match);
      setCheckingContact(false);

      // Auto-fill once per matched customer. Without the guard every re-probe (the clerk keeps
      // typing) would re-announce the same fill.
      const customerKey = match.customer?.customerId || "";
      if (customerKey && customerKey !== lastPrefilledCustomer.current) {
        lastPrefilledCustomer.current = customerKey;
        setAutoFilled(prefillFromCustomer(match.customer));
      } else if (!customerKey) {
        lastPrefilledCustomer.current = "";
        setAutoFilled([]);
      }
    }, 500);

    return () => { active = false; window.clearTimeout(timer); setCheckingContact(false); };
  }, [editing, phone, email, probeContact, prefillFromCustomer]);

  /* ── Arrived from a customer profile: /createlead?customerId=<publicId> ──────────────────
     The profile's "New enquiry" buttons used to navigate here with nothing attached, so the clerk
     re-keyed the phone number of the person they were looking at one second earlier.

     Unlike the debounced probe above this one DOES write the phone: that guard exists because the
     caret is in the phone field while the clerk types, and here nobody has typed anything. It runs
     once, only on create, and stamps lastPrefilledCustomer so the probe that fires straight after
     (the phone it just wrote is a valid number) recognises the same customer and stays quiet. */
  useEffect(() => {
    if (editing) return undefined;
    const customerPublicId = searchParams.get("customerId");
    if (!customerPublicId) return undefined;

    let active = true;
    customerService.getById(customerPublicId)
      .then((response) => {
        if (!active) return;
        const customer = response?.data?.data ?? response?.data;
        if (!customer) return;

        if (customer.phone) {
          setValue("phone", customer.phone, { shouldDirty: true, shouldValidate: false });
        }
        const written = prefillFromCustomer(customer, { overwrite: true });
        setAutoFilled(written);
        setContactMatch({ lead: null, customer });
        lastPrefilledCustomer.current = customer.customerId || "";
      })
      // Silent: the deep link is a convenience. A stale or unreachable id must leave a usable blank
      // form, not an error the clerk has to dismiss before typing.
      .catch(() => {});

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, searchParams, prefillFromCustomer, setValue]);

  /* Clearing the strip has to clear the "already prefilled this one" ref too, or the next record for
     the SAME customer would show the card with no prefill and look broken. */
  const resetContactMatch = () => {
    setContactMatch(EMPTY_MATCH);
    setAutoFilled([]);
    lastPrefilledCustomer.current = "";
  };

  const useMatchedCustomer = () => {
    const written = prefillFromCustomer(contactMatch.customer, { overwrite: true });
    setAutoFilled(written);
    showToast(
      written.length > 0
        ? `Loaded ${contactMatch.customer?.name || "customer"} into the form.`
        : "Form already matches this customer.",
      "success",
    );
  };

  /* `fromQuote` marks a tick that came from the "Also need" strip inside the accordion rather than
     from the Services picker above — the only difference is whether revealing the new section is
     allowed to scroll. See the reveal effect. */
  const toggleService = (id, { fromQuote = false } = {}) => {
    setServices((list) => {
      const next = list.includes(id) ? list.filter((s) => s !== id) : [...list, id];
      /* Ticking a service is the request to fill it in. Rather than making the agent tick, scroll and
         then hunt for the matching section, the section this service just created is opened for them
         — the effect below fires it once the model actually carries the service, because the model is
         rebuilt from `services` and the section does not exist until it is. Untick opens nothing. */
      if (quoteInline && !list.includes(id)) pendingQuoteRevealRef.current = { id, focus: fromQuote };
      return next;
    });
    clearErrors("services");
  };
  // Handed to the accordion so a service can be added without leaving the panel being filled in.
  const addServiceFromQuote = (id) => toggleService(id, { fromQuote: true });

  const addRow = () => setItinerary((rows) => [...rows, blankRow()]);
  const removeRow = (rowId) =>
    setItinerary((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== rowId) : rows));
  const updateRow = useCallback((rowId, patch) => {
    setItinerary((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }, []);

  const focusNext = useCallback((from) => {
    const root = formRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
      (node) => node === from || node.offsetParent !== null
    );
    const next = nodes[nodes.indexOf(from) + 1];
    if (!next) return;
    next.focus();
    if (typeof next.select === "function" && /^(text|number|tel|email|search)$/.test(next.type || "")) {
      next.select();
    }
  }, []);

  const applyServerFieldErrors = (error, fallback) => {
    const fieldErrors = getFieldErrors(error) || {};
    const own = getValues();
    const inline = Object.keys(fieldErrors).filter((name) => name in own);
    inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));
    if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
  };

  /* RHF refuses to call save() when a rule fails, and by default does it in complete silence — no
     scroll, no message. On a form this tall the offending field is usually off-screen (an unresolved
     Assign To, three panels up, is the classic one), so BOTH Save and Save & New read as dead
     buttons. Every submit path routes its invalid case through here. */
  const onInvalid = (formErrors) => {
    const first = Object.keys(formErrors || {})[0];
    if (!first) return;
    const aim = () => {
      const root = formRef.current;
      // The visible control first: assignedUserId's registered input is type="hidden" and cannot take
      // focus or be scrolled to, but its Field wrapper carries the id.
      const node = root?.querySelector(`[name="${first}"]:not([type="hidden"])`)
        || document.getElementById(first)
        || root?.querySelector(`[name="${first}"]`);
      node?.focus?.();
      (node?.closest?.("div") || node)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    };
    /* Phone, name and travel date all live in the panels that fold once the itinerary is confirmed,
       and folded means unmounted — the lookup above would find nothing and this handler would go
       back to doing exactly what it was written to stop. RHF keeps the values through the unmount
       (shouldUnregister defaults to false), so the rule that failed is real; only its input is
       missing. Unfold, let React commit, then aim. */
    /* Deferred unconditionally, not just for the enquiry fold: Lead Setup and Special Assistance
       open themselves off `errors` (Panel's forceOpen), and React has not committed that render
       when this runs — aiming synchronously would query the DOM one frame too early and find the
       collapsed panel's body still missing, which is the exact failure this handler exists to
       prevent. One tick costs nothing on the path that was already open. */
    if (enquiryCollapsed) setEnquiryCollapsed(false);
    window.setTimeout(aim, 0);
    showToast(formErrors[first]?.message || "Please fix the highlighted fields.", "error");
  };


  const save = async (
    data,
    {
      addAnother = false,
      createQuotation = false,
    } = {},
  ) => {
    /* Checked in the order the rapid chain presents them — itinerary, then services, then the quote.
       The services rule used to run first, which now dead-ends: with the picker locked until a stop
       exists, "Select at least one service" would scroll to a control the agent cannot operate. The
       full-details form has no gate, so the reorder costs it nothing — the same two rules, still
       both enforced, just named in the order the page asks for them. */

    /* An itinerary row with only ONE of destination/city cannot go to the server — the backend binds
       both @NotBlank and one bad row rejects the whole lead — and must not be dropped silently
       either, because somebody typed it. Rows left completely blank are the form's own template and
       the transformer ignores those; this names the half-filled ones instead of letting the save
       come back as a 400 whose field path matches nothing on screen. */
    const incompleteRow = itinerary.findIndex((row) =>
      Boolean(String(row.destination || "").trim()) !== Boolean(String(row.city || "").trim()));
    if (incompleteRow >= 0) {
      showToast(
        `Itinerary stop ${incompleteRow + 1}: choose both a destination and a city, or clear the row.`,
        "error",
      );
      // Through revealEnquiry, not a bare scroll: #itinerary-group lives inside the Trip panel, which
      // is folded away by this point in the flow.
      revealEnquiry("#itinerary-group");
      return;
    }

    /* Rapid create gates Services on a real stop, so the itinerary is required there for EVERY save
       path, not just the one that also writes a quotation — otherwise Save & New would demand
       services the agent was never allowed to tick. `createQuotation` keeps its own clause for the
       cases the gate does not cover (full details, and edit-in-rapid where nothing is locked). */
    if ((stepFlow || createQuotation) && !itineraryReady) {
      showToast(
        stepFlow
          ? "Add an itinerary stop — destination and city — to unlock services and pricing."
          : "Choose a destination and city so the quotation can be prefilled.",
        "error",
      );
      revealEnquiry("#itinerary-group");
      return;
    }

    /* Pressing the header's Create Quote before continuing. Without this the run would reach
       validateQuickQuote below, fail on an unpriced section and then ask the accordion — which is
       not mounted yet — to reveal it: a toast pointing at nothing. Say what the next step actually
       is instead. Sticky pre-ticks a service, so services.length alone would not have caught it. */
    if (stepFlow && !itineraryConfirmed) {
      showToast("Press “Done — continue” under the itinerary to pick services and price them.", "error");
      revealEnquiry("#itinerary-group");
      return;
    }

    if (services.length === 0) {
      // Inline, beside the picker — the old form raised this as a toast, which interrupts and then
      // disappears, leaving nothing next to the control that caused it.
      setError("services", { type: "manual", message: "Select at least one service." });
      document.getElementById("services-group")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    /* Rapid mode prices on this page, so the quotation is checked BEFORE the lead is written.
       Creating the lead first and then failing on the quote would leave a half-done record behind
       and force the agent to hunt for it in the list. The accordion is told which section to open
       and which field to land on, so the cause is on screen, not in a toast. */
    if (createQuotation && quoteInline) {
      const problem = validateQuickQuote(quoteModel);
      if (problem) {
        // Every offending section is marked inline; the toast covers the one problem the accordion
        // has no panel for (a missing quotation title).
        quoteSectionsRef.current?.showProblems();
        if (problem.section) quoteSectionsRef.current?.reveal(problem.section, problem.field || null);
        showToast(problem.message, "error");
        return;
      }
    }

    /* The "every room holds at least one traveller" check went with the editor. It guarded input
       this form no longer takes, and a validation that can fail on a field nobody can see is a
       dead end: the toast pointed at #room-allocation-group, which is not in the document. */

    clearErrors("services");
    setSubmitting(true);

    try {
      const adultPayload = buildAdultPayload(data);
      const payload = {
        ...data,
        assignedUserId: data.assignedUserId || null,
        rooms: toInt(data.rooms, 1),
        extraBeds: toInt(data.extraBeds),
        male: adultPayload.male,
        female: adultPayload.female,
        totalAdults: adultPayload.totalAdults,
        adults: adultPayload.totalAdults,
        children: toInt(data.children),
        infants: toInt(data.infants),
        assistancePassengerCount: data.specialAssistanceRequired ? toInt(data.assistancePassengerCount) : 0,
        /* Passed straight through, never rebuilt. Nothing on this form edits the room-by-room plan
           now; a new lead sends [] (as it always did — the editor was edit-only), and an old lead
           sends back exactly what it arrived with. */
        roomAllocations: loadedRoomAllocationsRef.current,
        budget: data.budget === "" || data.budget == null || Number.isNaN(Number(data.budget))
          ? null
          : Number(data.budget),
      };

      if (editing) {
        await leadService.updateLead(id, payload, services, itinerary);
        showToast(`Lead "${data.customerName}" updated.`, "success");
        navigate("/allleads");
        return;
      }

      const response = await leadService.createLead(payload, services, itinerary);
      const created = response?.data?.data ?? response?.data;
      const leadPublicId = created?.publicId || created?.id;

      // Follow-up has no column on Lead: the durable record is a LeadLog, and LeadLogServiceImpl is
      // what raises the Reminder. Unchanged from the previous implementation.
      if (leadPublicId && data.followUpDate) {
        try {
          await leadService.addLog(leadPublicId, {
            comment: `Follow-up scheduled for ${data.followUpDate} at lead creation.`,
            createReminder: true,
            followUpDate: data.followUpDate,
            stage: data.leadStage || null,
          });
        } catch {
          showToast("Lead created, but the follow-up reminder could not be scheduled.", "warning");
        }
      }

      writeSticky(data, services);
      const nextSessionCount = savedThisSession + 1;
      setSavedThisSession(nextSessionCount);
      try { sessionStorage.setItem(SESSION_COUNT_KEY, String(nextSessionCount)); }
      catch { /* progress count is optional */ }

      if (createQuotation) {
        if (!leadPublicId) {
          showToast(
            "Lead was created, but quotation could not be opened because the lead ID was not returned.",
            "warning",
          );

          navigate("/allleads");
          return;
        }

        /* One page. In rapid mode the quotation the agent just built below is written straight
           after the lead and the screen STAYS — no navigation, no reload, no losing the context of
           the call. Full mode keeps the original two-step handoff to /quick-quote. */
        if (quoteInline && quoteModel) {
          try {
            const response = await quotationService.createQuotation(
              quickQuotePayload({ model: quoteModel, lead: created, leadId: leadPublicId }),
            );
            const body = response?.data?.data || response?.data || {};
            const newQuotationId = body.publicId || body.id;
            if (!newQuotationId) throw new Error("Quotation was saved but its ID was not returned.");
            // Markup / tax / discount type and the inclusions boilerplate ride into the next
            // enquiry, the same way the lead's own sticky fields do. Only after the server accepted
            // the quotation — see rememberQuickQuoteDefaults.
            rememberQuickQuoteDefaults(quoteModel);
            setCreatedQuote({
              id: String(newQuotationId),
              quoteNo: body.quoteNo == null ? "" : String(body.quoteNo),
              leadPublicId: String(leadPublicId),
              leadCode: created?.leadCode || "",
              lead: created,
            });
            showToast(`${created?.leadCode || "Lead"} and its quotation are ready to send.`, "success");
          } catch (error) {
            // The lead IS saved — say so, so nobody re-enters it chasing the quotation error.
            if (!isAlreadyReported(error)) {
              showToast(
                getErrorMessage(error, "Lead was created, but the quotation could not be saved."),
                "error",
              );
            }
          }
          return;
        }

        showToast(
          `${created?.leadCode || "Lead"} created successfully. Continue with the quotation.`,
          "success",
        );

        navigate(
          `/createquotation?leadId=${encodeURIComponent(String(leadPublicId))}`,
          { state: { lead: created, quickQuote: true } },
        );

        return;
      }

      if (addAnother) {
        // No navigation, no 1.2s timeout. Blank record, sticky fields kept, cursor already in
        // Phone — this is the whole point of the redesign for a 50-100/day operator.
        reset({ ...blankDefaults(), ...readSticky() });
        setServices(readStickyServices());
        setItinerary([blankRow()]);
        loadedRoomAllocationsRef.current = [];
        resetContactMatch();
        // The quote belongs to the lead that was just written, not to the blank one now on screen.
        resetInlineQuote();
        showToast(`${created?.leadCode || "Lead"} saved — next record ready.`, "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => phoneRef.current?.focus(), 0);
      } else {
        showToast(`Lead for "${data.customerName}" created successfully.`, "success");
        navigate("/allleads");
      }
    } catch (error) {
      if (isAlreadyReported(error)) return;
      applyServerFieldErrors(error, editing ? "Failed to update lead. Try again." : "Failed to create lead. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onFormKeyDown = (event) => {
    /* The quotation accordion below has its own key map (Enter walks its fields, Alt+1…8 jumps
       between its sections) and it sits INSIDE this form, so its keydown fires first and bubbles
       here. Without this guard Enter would move the caret twice. Anything the accordion handled is
       already done.

       Alt+1 / Alt+2 used to switch entry mode from anywhere on the form, and are retired with it —
       which also settles the collision the guard above was written for: Alt+2 inside the accordion
       is now unambiguously "jump to section 2". */
    if (event.defaultPrevented) return;
    if (event.key !== "Enter") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      // Once the quotation exists the lead does too, so Ctrl+Enter has to UPDATE. Re-running the
      // create path here wrote a second lead and a second quotation for the same customer.
      if (createdQuote) { updateInlineQuote(); return; }
      const addAnother = !editing && event.shiftKey; // batch-next is a create-only shortcut
      const createQuotation = !editing && !addAnother && canCreateQuotation;
      handleSubmit((data) => save(data, { addAnother, createQuotation }), onInvalid)();
      return;
    }
    const target = event.target;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      // Implicit submission is the enemy here: a 30-field form should never be created because
      // someone pressed Enter after the third field.
      event.preventDefault();
      focusNext(target);
    }
  };

  const clearForm = () => {
    reset({ ...blankDefaults(), ...readSticky() });
    setServices(readStickyServices());
    setItinerary([blankRow()]);
    loadedRoomAllocationsRef.current = [];
    resetContactMatch();
    resetInlineQuote();
    /* Deferred, unlike before: clearing from a folded enquiry means the Phone input is not in the
       document yet — resetInlineQuote only just asked for the unfold, and phoneRef is null until
       React commits it. A synchronous focus() here was a silent no-op and the batch loop lost its
       cursor. The Save & New path has always done it this way. */
    window.setTimeout(() => phoneRef.current?.focus(), 0);
  };

  /* ── Actions on the quotation this page just created ─────────────────────────────────────────
     The quote is not finished when it is saved, it is finished when the customer has it — so the
     share link and the PDF are offered right here rather than only on the standalone Quick Quote
     page. All three reuse the same plumbing that page uses: same endpoint, same design picker,
     same streaming download hook. */
  const updateInlineQuote = async () => {
    if (!createdQuote?.id || !quoteModel) return;
    // QUOTATION_CREATE does not imply QUOTATION_UPDATE — the standalone page checks this before it
    // PUTs, and so must this one, or the agent gets an interceptor 403 with no idea why.
    if (!canUpdateQuotation) {
      showToast("You can create quotations, but you do not have permission to update this one.", "error");
      return;
    }
    const problem = validateQuickQuote(quoteModel);
    if (problem) {
      if (problem.section) quoteSectionsRef.current?.reveal(problem.section, problem.field || null);
      showToast(problem.message, "error");
      return;
    }
    setQuoteBusy(true);
    try {
      // includeLead:false — re-sending leadId asks the backend for a fresh lead snapshot, which
      // would overwrite the customer/PAX context captured when the quotation was created.
      await quotationService.updateQuotation(createdQuote.id, quickQuotePayload({
        model: quoteModel,
        lead: createdQuote.lead,
        leadId: createdQuote.leadPublicId,
        includeLead: false,
      }));
      showToast("Quotation updated.", "success");
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not update the quotation."), "error");
    } finally {
      setQuoteBusy(false);
    }
  };

  const copyQuoteShareLink = async () => {
    if (!createdQuote?.id) return;
    try {
      const response = await quotationService.getShareLink(createdQuote.id);
      const link = response?.data?.data?.shareUrl || response?.data?.shareUrl || "";
      if (!link) throw new Error("The share link was not returned.");
      try {
        await navigator.clipboard.writeText(link);
        showToast("Share link copied!", "success");
      } catch {
        // The clipboard API needs a secure context. Showing the URL still lets the agent copy it.
        showToast(link, "success");
      }
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Failed to generate the share link."), "error");
    }
  };

  const exportQuotePdfAs = async (style) => {
    setQuoteStyleOpen(false);
    if (!createdQuote?.id) return;
    try {
      // Readable business code in the file name — never the raw UUID when a quote number exists.
      const code = createdQuote.quoteNo || String(createdQuote.id).slice(0, 8).toUpperCase();
      await runQuotePdfDownload({
        endpoint: `/quotations/${createdQuote.id}/pdf`,
        params: style ? { style } : undefined,
        fileName: `TravelCRM-Quotation-${code}.pdf`,
      });
      showToast("PDF downloaded successfully!", "success");
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Failed to generate PDF."), "error");
    }
  };

  // Back to a blank enquiry without a page load — the batch case this whole mode exists for.
  // clearForm() already calls resetInlineQuote(), so the quote goes with it.
  const startNextEnquiry = () => {
    clearForm();
    // NOT window.scrollTo — the app shell is h-screen/overflow-hidden and <main> is the scrollport,
    // so scrolling the document is a no-op and the clerk was left at the bottom of the page.
    formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> Loading lead…
      </div>
    );
  }

  /* One slot under the Phone field carrying both answers. They are stacked rather than merged
     because they mean different things and can both be true: a repeat client (green — reuse their
     details) who also has an enquiry still open (amber — do not raise a second one). */
  const customerMatch = contactMatch.customer;
  const duplicate = contactMatch.lead;

  const customerCard = customerMatch ? (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <CircleUserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 text-xs">
            <p className="font-bold text-emerald-900">
              Existing customer found with {MATCH_LABEL[customerMatch.matchedOn] || "this contact"}
            </p>
            <p className="mt-0.5 truncate text-emerald-800">
              {[customerMatch.name, customerMatch.customerCode, customerMatch.city]
                .filter(Boolean).join(" · ")}
            </p>
            {/* Relationship context is what makes the strip worth reading — a clerk decides
                differently for a 6-booking repeat client than for a row that merely exists. */}
            {(customerMatch.totalBookings > 0 || customerMatch.lastBookingDate) && (
              <p className="mt-0.5 truncate text-[11px] text-emerald-700">
                {[
                  customerMatch.totalBookings > 0
                    ? `${customerMatch.totalBookings} booking${customerMatch.totalBookings === 1 ? "" : "s"}`
                    : "",
                  inr(customerMatch.totalSpent) ? `${inr(customerMatch.totalSpent)} lifetime` : "",
                  customerMatch.lastBookingDate ? `last travel ${customerMatch.lastBookingDate}` : "",
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={useMatchedCustomer}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
          >
            Use this customer
          </button>
        </div>
      </div>
      {autoFilled.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-emerald-200/70 pt-2 text-[11px] text-emerald-700">
          <Check className="mt-0.5 h-3 w-3 shrink-0" />
          {/* Names exactly what was written. Blank fields only — anything already typed is left
              alone, so this list is never a surprise. */}
          Auto-filled the blank fields: {autoFilled.join(", ")}. Anything you had already typed was left as-is.
        </p>
      )}
    </div>
  ) : null;

  const leadCard = duplicate ? (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 text-xs">
          <p className="font-bold text-amber-900">A lead already exists for this contact</p>
          <p className="mt-0.5 truncate text-amber-800">
            {[duplicate.leadCode, duplicate.customerName, duplicate.leadStage].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {canCreateQuotation && (
          <button
            type="button"
            onClick={() => navigate(
              `/createquotation?leadId=${encodeURIComponent(String(duplicate.publicId || duplicate.id))}`,
              { state: { lead: duplicate, quickQuote: true } },
            )}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            Quote existing lead
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/EditLead/${duplicate.publicId || duplicate.id}`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </button>
      </div>
    </div>
  ) : null;

  /* Same digit test the probe effect uses to decide the number is worth looking up. Repeated
     rather than shared because the effect's copy is scoped to the raw value it debounced; both
     answer "is this a phone number yet", and if that rule ever changes it must change in both. */
  const phoneProbed = String(phone || "").replace(/\D/g, "").length >= 7;

  const duplicateStrip = (customerCard || leadCard) ? (
    <>{customerCard}{leadCard}</>
  ) : checkingContact ? (
    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
      <LoaderCircle className="h-3 w-3 animate-spin" /> Checking existing leads and customers…
    </p>
  ) : phoneProbed ? (
    /* The other half of the answer, which this form never gave. A match showed a card; NO match
       showed nothing at all, so "we looked and this is someone new" was indistinguishable from
       "we have not looked yet" — and the agent had no way to know whether saving would attach to
       an existing customer or create one. The booking form has always said which of the two it is;
       this now does too. */
    <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
      <CircleUserRound className="h-3 w-3" /> New customer — saving will create a new profile.
    </p>
  ) : null;

  // Filled slate-100 chips read as the old kit; a white chip with a 1px border is the flat rule.
  const kbdCls = "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500";

  return (
    <form
      ref={formRef}
      onSubmit={(event) => handleSubmit((data) => save(data, { addAnother: false }), onInvalid)(event)}
      onKeyDown={onFormKeyDown}
      noValidate
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: FONT }}
    >
      {/* The header is pinned instead of the action bar. A bottom-sticky bar is a no-op on this
          page — the app shell scrolls <main>, and this bar is its parent's last child, so it has
          nowhere to travel — while the header is the FIRST child of a min-h-screen form and has the
          whole form to stick through. Clear / Save & New / Create Quote ride along with it. */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/allleads")}
              aria-label="Back to leads"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {editing ? `Edit Lead${leadCode ? ` · ${leadCode}` : ""}` : "Quick Quote"}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                <kbd className={kbdCls}>Enter</kbd> next field ·
                <kbd className={`ml-1 ${kbdCls}`}>Ctrl+Enter</kbd> {!editing ? "create quote" : "save"}
                {!editing && (
                  <>
                    {" · "}<kbd className={kbdCls}>Ctrl+Shift+Enter</kbd> save &amp; next
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The session counter lives up here — the blue banner that used to carry it is dropped,
                so a batch clerk no longer re-reads onboarding copy on every enquiry.
                The Rapid / Full details segmented control that sat beside it is retired: with every
                full-details field merged into this form there is nothing on the other side of it. */}
            {!editing && savedThisSession > 0 && (
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 sm:inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {savedThisSession} saved this session
              </span>
            )}
            <button type="button" onClick={editing ? () => navigate("/allleads") : clearForm} disabled={submitting} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:flex">
              <RotateCcw className="h-3.5 w-3.5" /> {editing ? "Cancel" : "Clear"}
            </button>
            {!editing && <button
              type="button"
              onClick={handleSubmit((data) => save(data, { addAnother: true }), onInvalid)}
              disabled={submitting}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" /> Save &amp; New
            </button>}
            {!editing && canCreateQuotation ? (
              <>
                <button
                  type="button"
                  // Same action as the accordion's last-section button — once the quotation exists
                  // this becomes an update, so the two controls can never mean different things.
                  onClick={createdQuote
                    ? updateInlineQuote
                    : handleSubmit((data) => save(data, { createQuotation: true }), onInvalid)}
                  disabled={submitting || quoteBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                >
                  {(submitting || quoteBusy) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {submitting ? "Creating..." : createdQuote ? "Update Quote" : "Create Quote"}
                </button>
              </>
            ) : (
              /* Editing, or creating without QUOTATION_CREATE. The old condition here was
                 `(!rapidEntry || editing)`, which resolved to FALSE for a LEAD_CREATE agent with no
                 quotation permission working in rapid — they got no primary control in the header
                 (and none in the action bar either, which used the same test), leaving "Save & New"
                 as the only way to write a lead at all. With one mode the else branch is simply
                 "not the Create Quote case", so that hole closes on its own. */
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm">
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Saving..." : editing ? "Save Changes" : "Save Lead"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-5">

        <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Enquiry details</p>

        {/* The blue intro banner went with Full details. It carried the mode toggle (nothing left
            to toggle), the session counter (now in the sticky header, where a batch clerk sees it
            without scrolling) and a paragraph of onboarding copy re-read on every one of 50-100
            enquiries a day. */}

        <LeadFormPanels
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          getValues={getValues}
          clearErrors={clearErrors}
          services={services}
          onToggleService={toggleService}
          itinerary={itinerary}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateRow={updateRow}
          phoneRef={phoneRef}
          belowPhone={editing ? null : duplicateStrip}
          compactRail
          stepFlow={stepFlow}
          itineraryConfirmed={itineraryConfirmed}
          itineraryConfirmable={itineraryConfirmable}
          onConfirmItinerary={confirmItinerary}
          enquiryCollapsed={enquiryCollapsed}
          onExpandEnquiry={revealEnquiry}
        />

        {/* ── The quotation, on this same page ────────────────────────────────────────────────
            Rapid mode only. Everything above is the lead form, unchanged; from here down the agent
            prices the enquiry without a navigation. The sections are exactly the ones ticked in the
            Services panel above, so the accordion renders with showServices={false} rather than
            offering a second full picker — but it does get onAddService, so a service can be ADDED
            from inside the section being filled in without scrolling back up to that panel.

            Last link of the chain: the builder appears only once there is something to price — a
            real itinerary stop AND at least one ticked service. Before that it is a locked stub, not
            an empty accordion. Sticky pre-ticks Hotel from the previous enquiry, so services.length
            alone would have opened the whole pricing block on a blank form, which is the thing the
            chain exists to prevent; itineraryReady is what actually holds it shut. */}
        {quoteInline && !(quoteModel && quoteReady && services.length > 0) && (
          <section className="space-y-3">
            <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Quotation</p>
            <LockedStep
              title="Pricing"
              hint={quoteReady
                ? "Tick a service above and its section opens here, seeded from the trip details."
                : "Finish the itinerary and continue — services come first."}
            />
          </section>
        )}

        {quoteInline && quoteModel && quoteReady && services.length > 0 && (
          <section id="quick-quote-builder" className="space-y-3">
            <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Quotation</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Pricing</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Seeded from the services and itinerary above. Open a section, fill it, press Next.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Duplicates the summary strip's subtotal on purpose: that one is the at-a-glance
                    number at the top of a long page, this one sits at the point of edit. */}
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-500">Running subtotal</p>
                  <p className="text-lg font-black leading-tight tabular-nums text-slate-900">
                    ₹{quoteTotals.subtotal.toLocaleString("en-IN")}
                  </p>
                </div>
                {quoteTouched && !createdQuote && (
                  <button
                    type="button"
                    onClick={resyncQuoteFromLead}
                    title="Rebuild the quotation from the trip details above — your entries below are replaced"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Resync
                  </button>
                )}
              </div>
            </div>

            {/* The "No services ticked" notice that used to sit here is gone, not moved: this block
                only mounts when services.length > 0, so it was unreachable. Its job — telling the
                agent what to do next — is the locked stub's now, and the stub says it BEFORE the
                pricing header rather than underneath it.
            {services.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <TriangleAlert className="h-4 w-4" />
                </span>
                <p className="text-xs text-slate-500">
                  <span className="font-bold text-slate-800">No services ticked.</span>{" "}
                  Pick one — from the panel above or the strip below — and its section appears here.
                </p>
              </div>
            )}
            */}

            {/* No submitSlot here on purpose: with sections collapsing as they are finished there is
                no "last" one to hang the submit off. Create Quick Quote lives in the sticky header
                and in the action bar below, both reachable from any scroll position. */}
            <QuickQuoteSections
              ref={quoteSectionsRef}
              model={quoteModel}
              setModel={updateQuoteModel}
              showServices={false}
              onSectionDone={handleSectionDone}
              // The picker above stays the one place a service is UNticked; this only adds, from
              // inside whichever section the agent is currently filling in.
              onAddService={addServiceFromQuote}
              // Without this the accordion swallowed Ctrl+Enter and the shortcut was dead for every
              // field inside the quote — the one place an agent is most likely to press it.
              onRequestSave={() => {
                if (createdQuote) { updateInlineQuote(); return; }
                handleSubmit((data) => save(data, { createQuotation: true }), onInvalid)();
              }}
            />

            {createdQuote && (
              /* White card + an emerald status pill, not an emerald card. Colour belongs to pills
                 and icon tiles here; a tinted card plus four tinted buttons made the one real next
                 action indistinguishable from the three secondary ones. */
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      Quotation{createdQuote.quoteNo ? ` ${createdQuote.quoteNo}` : ""}
                    </p>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Created
                    </span>
                  </div>
                  {createdQuote.leadCode && (
                    <p className="mt-0.5 text-xs text-slate-500">{createdQuote.leadCode}</p>
                  )}
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyQuoteShareLink}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteStyleOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(
                      `/createquotation?leadId=${encodeURIComponent(createdQuote.leadPublicId)}&quotationId=${encodeURIComponent(createdQuote.id)}`,
                    )}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Full editor
                  </button>
                  {/* Emerald, and to the left of "Next enquiry", because at this exact moment the
                      customer is either saying yes or they are not. Every other button here assumes
                      the answer comes later. */}
                  {!bookOpen && canBook && (
                    <button
                      type="button"
                      onClick={() => setBookOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <Wallet className="h-3.5 w-3.5" /> Book now
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={startNextEnquiry}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Next enquiry
                  </button>
                </div>

                {/* Inline, not a modal or a route. The quote is on screen, the customer is on the
                    phone or at the desk, and the whole point is that saying yes costs no navigation.
                    A modal here would cover the very figures the agent is reading back. */}
                {bookOpen && createdQuote.lead && (
                  <div className="w-full">
                    <BookFromQuotePanel
                      lead={createdQuote.lead}
                      quotationId={createdQuote.id}
                      quotedAmount={quickQuoteGrandTotal(quoteModel)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            <span className="font-bold text-red-500">*</span> Required fields are marked.
            {!editing
              ? " Ctrl+Enter creates the quote; Ctrl+Shift+Enter saves and starts the next lead."
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate("/allleads")} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none">
              Cancel
            </button>
            {!editing && <button
              type="button"
              onClick={handleSubmit((data) => save(data, { addAnother: true }), onInvalid)}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
            >
              <Plus className="h-4 w-4" /> Save &amp; New
            </button>}

            {!editing && canCreateQuotation && (
              <button
                type="button"
                // The same action as the accordion's last-section button — once the quotation
                // exists it becomes an update, so the two can never disagree about what pressing
                // the primary control does. `quoteInline &&` is kept as the model's liveness test:
                // it is what guarantees "Update Quote" is never offered over a null model.
                onClick={quoteInline && createdQuote
                  ? updateInlineQuote
                  : handleSubmit(
                    (data) =>
                      save(data, {
                        createQuotation: true,
                      }),
                    onInvalid,
                  )}
                disabled={submitting || quoteBusy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                {(submitting || quoteBusy)
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : <Zap className="h-4 w-4" />}
                {/* Same words as the header control, which fires the same handler — two names for
                    one action reads as two different actions. */}
                {quoteInline && createdQuote ? "Update Quote" : "Create Quote"}
              </button>
            )}

            {/* Editing, or creating without QUOTATION_CREATE — the same hole the header block
                describes: `(editing || !rapidEntry)` left a quotation-less create agent with no
                Save Lead button on either bar. */}
            {(editing || !canCreateQuotation) && (
              <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Saving..." : editing ? "Save Changes" : "Save Lead"}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Quotation delivery, for the quote this page just created. Same dialog and same overlay the
          Quick Quote page and the full builder use. */}
      {quoteStyleOpen && createdQuote && (
        <QuotationStyleModal
          savedStyle={quoteModel?.templateStyle || "CLASSIC"}
          onSelect={exportQuotePdfAs}
          onClose={() => setQuoteStyleOpen(false)}
        />
      )}
      <PdfDownloadLoader
        open={quotePdfBusy}
        documentType="Quotation"
        progress={quotePdfProgress}
        progressSupported={quotePdfProgressSupported}
      />
    </form>
  );
}
