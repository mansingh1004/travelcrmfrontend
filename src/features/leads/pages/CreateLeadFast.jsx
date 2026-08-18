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
  PackageCheck,
  Plane,
  Plus,
  Wallet,
  RotateCcw,
  Route,
  Share2,
  ShieldCheck,
  Bus,
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
import DateRangeField from "@shared/ui/DateRangeField";
import TravellerCountFields from "@shared/ui/TravellerCountFields";
import { VehicleRequirementRows, RoomRequirementRows, FastTravelDetails, RouteSegments } from "@features/bookings";
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

/* ── Two entry modes: Full and Rapid ──────────────────────────────────────────────────────────
   RAPID is the BOOKING form's card stack, panel for panel — Customer Details, Vehicle & Room
   Requirement, Travel Details, Travel Itinerary, Services & Notes — built from the booking's OWN
   components (FastTravelDetails, RouteSegments, the two RequirementRows), not from lookalikes of
   them. An agent taking a detailed enquiry answers it exactly where the booking will ask, so the
   conversion stops being a re-typing exercise and the two screens cannot drift apart.

   FULL is this form as it has stood since the 11 Aug merge: one tall Customer card with the
   requirement editors folded into it, the Trip panel, the itinerary and the rail. It holds the
   default for now and its final shape is the owner's call — treat this as the parked mode, not a
   finished design.

   Same RHF fields underneath, same payload, in both. This is a LAYOUT, never a second data model:
   nothing is mode-only, so switching mid-entry cannot drop a value. Every block either mode places
   differently is hoisted to ONE variable (routeBlock, destinationField, qualificationFields) rather
   than written out twice.

   The money rail is deliberately absent from BOTH. Lead has no vendorCost / paidAmount /
   paymentStatus column, and inventing them on the client would send fields the server drops.

   `?mode=` is honoured again — it was ignored while there was only one mode. Both old values still
   resolve: `full` was the retired detailed mode and still names this form, and `quick` (the label
   this screen carried while it was the only one) maps to it too. */
const ENTRY_MODES = ["full", "rapid"];
const MODE_KEY = "leadEntry:mode";
const normalizeMode = (value) => {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "quick" || mode === "quickquote" || mode === "quick-quote") return "full";
  if (mode === "detailed" || mode === "booking") return "rapid";
  return ENTRY_MODES.includes(mode) ? mode : "";
};
const readStickyMode = () => {
  try { return normalizeMode(sessionStorage.getItem(MODE_KEY)); }
  catch { return ""; }
};
const writeStickyMode = (mode) => {
  try { sessionStorage.setItem(MODE_KEY, mode); }
  catch { /* private mode — the preference is a convenience, never a requirement */ }
};

export const blankDefaults = () => ({
  customerName: "", phone: "", email: "", budget: "",
  // A lead created by a staff member starts as Manual Entry, so the required source dropdown is
  // useful immediately instead of opening blank. Sticky state still overrides this with the last
  // source used during the current entry session, and edit mode always loads the saved source.
  leadSource: "Manual Entry", leadType: "Fresh", leadStage: "New Lead",
  assignedUserId: "", birthDate: "", anniversaryDate: "",
  preferredCommunication: "", followUpDate: "", packageType: "",
  travelDate: "", returnDate: "", departCountry: "India", departCity: "",
  departureMode: "", departureAirport: "", airportCode: "", preferredFlightTime: "",
  railwayStation: "", trainClass: "", preferredTrainTime: "",
  pickupAddress: "", pickupDateTime: "", vehiclePreference: "",

  /* ── Where the trip ends, and where the customer lives ────────────────────────────────────────
     Both blocks exist so the BOOKING form stops asking for them. Everything here has a real column
     as of V22 and goes out through transformFormData — unlike the qualification set below, which
     is still UI-only.

     The drop is deliberately NOT part of the departureMode-gated group above: the server clears
     each transport group whose mode does not match, and a party that arrives by train and is
     driven back by the hired car would lose its drop the moment the mode was set. */
  dropCity: "", dropCountry: "", dropMode: "", dropDateTime: "",
  customerCity: "", customerState: "", customerCountry: "India",
  /* Vehicles as rows, mirroring the booking's. `vehiclePreference` above stays as the free-text
     note; this is the structured requirement. Starts EMPTY — an enquiry that needs no vehicle is
     the common case, and a blank row on arrival reads as one that must be filled in. */
  vehicleRequirements: [],
  /* The room MIX, in the booking's shape. Starts with one row rather than empty because a trip
     that needs rooms at all needs at least one, and an empty section reads as "not applicable"
     when the truth is "nobody asked yet" — the same reason the booking form seeds a row. */
  roomRequirements: [{ id: 0, roomType: "Deluxe", acType: "AC", count: 1, extraBeds: 0 }],

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
  /* whatsappSame / whatsappNumber are NOT part of the column-less set around them any more — V22
     gave WhatsApp a column and transformFormData now sends it (as null when "same as phone", so
     there is never a second copy of the number to keep in step). */
  whatsappSame: true,
  whatsappNumber: "",
  occasion: "",
  dateFlexibility: "EXACT",
  dateNote: "",
  decideBy: "",
  /* "Total" or "PER_PERSON" — what the budget number MEANS. No column yet, like the rest of the
     qualification set; it is here so the control has somewhere to live. */
  budgetBasis: "TOTAL",
  /* Source of truth; the child COUNT follows this array, not the other way round. */
  childAges: [],
  referredByName: "",
  agentVerdict: "", competingQuote: false, qualificationNote: "",
  notes: "",
});

let nextRowId = 1;
let nextVehicleRowId = 1;
let nextRoomRowId = 1;

/**
 * Expand the room MIX the agent filled into the per-room allocations the API stores.
 *
 * <p>The two shapes answer different questions and both are worth having. A mix is what a customer
 * says on the phone — "three deluxe, one AC" — and is two boxes to fill. An allocation is what the
 * hotel needs: one row per room, each with its own occupancy. The API models the second, so the
 * expansion happens here rather than asking the agent to type the harder one.
 *
 * <p>Occupancy is spread across the expanded rooms as evenly as it divides, which is exactly what
 * {@code rebalanceRooms} already does for the counts on this form — six adults over three rooms is
 * 2/2/2, seven is 3/2/2. That is a reasonable default, not a claim: the agent can correct any room
 * on the booking, and nothing downstream treats it as confirmed occupancy.
 *
 * <p>Returns [] when no mix was entered, so a lead taken without one behaves exactly as before.
 */
const roomAllocationsFromMix = (mixRows, counts) => {
  const rooms = [];
  (mixRows || []).forEach((row) => {
    const count = Math.max(0, toInt(row.count, 0));
    for (let i = 0; i < count; i += 1) {
      rooms.push({
        roomCategoryPreference: row.roomType || "Any",
        acType: row.acType || "Any",
        bedPreference: "Any",
      });
    }
  });
  if (!rooms.length) return [];

  // Extra beds ride with the mix row that asked for them, so "1 extra bed on the deluxe" does not
  // get averaged onto a room that never wanted one.
  const bedsPerRoom = [];
  (mixRows || []).forEach((row) => {
    const count = Math.max(0, toInt(row.count, 0));
    const beds = balancedCounts(toInt(row.extraBeds), count || 1);
    for (let i = 0; i < count; i += 1) bedsPerRoom.push(beds[i] || 0);
  });

  const adults = balancedCounts(toInt(counts.adults), rooms.length);
  const children = balancedCounts(toInt(counts.children), rooms.length);
  const infants = balancedCounts(toInt(counts.infants), rooms.length);

  return rooms.map((room, index) => ({
    ...room,
    roomNumber: index + 1,
    adults: adults[index] || 0,
    children: children[index] || 0,
    infants: infants[index] || 0,
    extraBeds: bedsPerRoom[index] || 0,
    childAges: Array.from({ length: children[index] || 0 }, () => ""),
  }));
};
export const blankRow = () => ({ id: nextRowId++, destinationId: "", destination: "", cityId: "", city: "", nights: 2 });

/* Rapid mode is a CHAIN — itinerary → services → quotation — and this is the first link's latch.
   A stop counts only when BOTH destination and city are set, which is deliberately the same test
   draftLeadKey uses to drop half-filled rows before seeding the quote and the same pair the backend
   binds @NotBlank on. So a stop that unlocks the next step is always one the quotation can price;
   the gate can never open onto a section the seeder will then ignore. */
const hasCompleteStop = (rows) => (rows || []).some(
  (row) => String(row?.destination || "").trim() && String(row?.city || "").trim(),
);

/* Suggestions for the Vehicles band, offered through a <datalist> rather than a <select>: the
   fleet an agency actually quotes varies by region, and a closed list here would reject a real
   answer. The booking form's own type field is free text for the same reason. */
const VEHICLE_TYPES = [
  "Sedan", "SUV", "Hatchback", "Tempo Traveller", "Mini Bus", "Bus", "Luxury Coach",
];
/* A/C preference on a room. Free-form on the wire (varchar) — this is just the shortlist. */
const AC_TYPE_OPTIONS = ["Any", "AC", "Non-AC"];
const ROOM_CATEGORY_OPTIONS = ["Any", "Standard", "Deluxe", "Premium", "Suite", "Family Room", "Villa"];
const BED_PREFERENCE_OPTIONS = ["Any", "King", "Queen", "Twin", "Double", "Single", "Bunk"];
let nextRoomAllocationId = 1;
const blankRoomAllocation = (roomNumber, values = {}) => ({
  id: `room-${nextRoomAllocationId++}`,
  roomNumber,
  roomCategoryPreference: "Any",
  bedPreference: "Any",
  /* Carried so the shape round-trips and the transform has something to send. Like the two
     preferences above it, this has no CONTROL on this form yet — the room plan edits occupancy
     only — so it stays "Any" until the room-preference band lands. */
  acType: "Any",
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
/* `iconTile` carries the section hue, matching Create Booking so the two intake screens read as one
   product. A long form is scanned before it is read, and a colour is a faster landmark than a
   label. Defaults to the neutral tile, so a panel that names no hue looks exactly as it did. */
function Panel({
  icon: Icon,
  title,
  description,
  action,
  iconTile = "bg-slate-100 text-slate-700",
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
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTile}`}>
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
        className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${expanded ? "border-b border-slate-100" : ""}`}
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
      {expanded && <div className="p-4 sm:p-5">{children}</div>}
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
  /* Rapid renders the notes box in its Services & Notes card, where the booking form keeps it, so
     this panel must NOT render a second one — two textareas both registered as `notes` put the same
     id twice in the document and hand RHF two inputs for one value. Full keeps it here. */
  showNotes = true,
}) {
  return (
    <Panel
      icon={Accessibility} iconTile="bg-teal-100 text-teal-700"
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
        {/* One instruction, in one place. This field carried a hint AND a placeholder that said
            the same thing in two different wordings — "Anything else they said — hotel, food,
            occasion, special requests." above the box and "Preferred hotels, meals, budget,
            occasion and other trip requirements" inside it. Two phrasings of one rule read as two
            rules, and the agent stops to work out the difference.

            The placeholder wins because it is where the eye already is when the box is empty, and
            it disappears once there is something to read instead. */}
        {showNotes && (
        <Field id="notes" label="Notes" optional>
          <textarea
            {...register("notes")}
            id="notes"
            rows={4}
            placeholder="Anything else they said — hotel, food, occasion, special requests"
            className={`${control(false)} resize-y`}
          />
        </Field>
        )}

        {/* No second heading: the panel is already titled "Requirements & Assistance". An
            "Accessibility & Assistance" heading two inches below it was the same words again and
            made one panel look like two — the checkbox says what this is. */}
        <div className="border-t border-slate-100 pt-4">
          {/* One checkbox, and the questions it implies open directly beneath it — the booking
              form's arrangement, and the right one. The switch briefly lived up beside the
              traveller counters, on the reasoning that it is a question about those same people.
              It is, but the answer is almost always no, and putting it there spent a slot in the
              busiest row of the form on a control most enquiries never touch.

              Unticking clears what it revealed: leaving a type and a passenger count behind on a
              lead that no longer needs assistance is how a stale requirement reaches an operations
              board weeks later. */}
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(assistanceRequired)}
              onChange={(event) => {
                const checked = event.target.checked;
                setValue("specialAssistanceRequired", checked, { shouldDirty: true, shouldValidate: true });
                if (!checked) {
                  setValue("specialAssistanceTypes", [], { shouldDirty: true });
                  setValue("assistancePassengerCount", 0, { shouldDirty: true });
                  setValue("specialAssistanceNotes", "", { shouldDirty: true });
                } else if (toInt(getValues("assistancePassengerCount")) < 1) {
                  setValue("assistancePassengerCount", 1, { shouldDirty: true });
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Accessibility className="h-4 w-4 text-blue-600" /> Special assistance required
          </label>

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
/* `data-skip-enter` now applies to FIELDS, not just buttons.
   It used to be honoured on button and [tabindex] only, so marking an input did nothing — which
   meant the Enter walk had to visit every input on the form in DOM order, whether or not the agent
   ever fills it.

   The distinction it buys is between SKIPPING A FIELD IN THE WALK and HIDING IT. This form has
   reversed a hide twice — "Full details" was retired because a note taken on the call could only be
   recorded by reopening the lead, and the traveller-count collapse was reverted for the same
   reason. So nothing is hidden: a skipped field is still on screen, still Tab-reachable, still
   clickable. Enter simply does not stop there on the way down. */
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]):not([data-skip-enter="true"]),' +
  'select:not([disabled]):not([data-skip-enter="true"]),' +
  'textarea:not([disabled]):not([data-skip-enter="true"]),' +
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
  /* The Customer Details header chip — "Checking number…" / "Existing customer" / "New customer",
     the booking form's. A SLOT rather than something computed here, because the lookup, its
     debounce and its result all live on the create page; EditLead does not probe at all and passes
     nothing, leaving the corner to the traveller count alone. */
  contactStatus = null,
  /* Which of the two entry layouts to draw. See ENTRY_MODES: false is Full (this form as it has
     stood), true is Rapid (the booking form's card stack). It only ever changes WHERE a field is
     drawn — every field, rule and handler is shared, so a mid-entry switch keeps the whole form. */
  rapidEntry = false,
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

  /* ── Vehicle requirement rows ────────────────────────────────────────────────────────────────
     Held in RHF like every other field so a failed submit, a reset and the edit-mode seed all keep
     working without a second source of truth. Rows carry a client-side `id` purely as a React key:
     index keys would re-map every input's identity when a row in the middle is removed, which is
     how a delete ends up appearing to clear the wrong row. */
  const vehicleRows = watch("vehicleRequirements") || [];
  const setVehicleRows = useCallback(
    (next) => setValue("vehicleRequirements", next, { shouldDirty: true }),
    [setValue],
  );
  const onAddVehicleRow = useCallback(() => {
    setVehicleRows([
      ...(getValues("vehicleRequirements") || []),
      { id: nextVehicleRowId++, vehicleType: "", model: "", capacity: "", quantity: 1 },
    ]);
  }, [getValues, setVehicleRows]);
  const onUpdateVehicleRow = useCallback((id, patch) => {
    setVehicleRows((getValues("vehicleRequirements") || []).map(
      (row) => (row.id === id ? { ...row, ...patch } : row)
    ));
  }, [getValues, setVehicleRows]);
  const onRemoveVehicleRow = useCallback((id) => {
    setVehicleRows((getValues("vehicleRequirements") || []).filter((row) => row.id !== id));
  }, [getValues, setVehicleRows]);

  /* ── Room MIX, not a room-by-room plan ──────────────────────────────────────────────────────
     The per-room editor was removed from this form for good reason: it asked for a category, a bed
     preference and an age per child FOR EVERY ROOM, on a screen whose whole job is taking an
     enquiry in one pass. Nothing replaced it, so the enquiry stopped carrying any room preference
     at all — "3 Deluxe AC" was known on the call, lost at save, and re-asked at booking.

     This is the booking form's shape instead: a MIX ("2 x Deluxe AC, 1 extra bed"), two or three
     rows at most, which is fast enough to fill while someone is talking. It expands into the
     per-room allocations the API takes at submit time (see roomAllocationsFromMix). */
  const roomRows = watch("roomRequirements") || [];
  const setRoomRows = useCallback(
    (next) => setValue("roomRequirements", next, { shouldDirty: true }),
    [setValue],
  );
  const onAddRoomRow = useCallback(() => {
    setRoomRows([
      ...(getValues("roomRequirements") || []),
      { id: nextRoomRowId++, roomType: "Deluxe", acType: "AC", count: 1, extraBeds: 0 },
    ]);
  }, [getValues, setRoomRows]);
  const onUpdateRoomRow = useCallback((id, patch) => {
    setRoomRows((getValues("roomRequirements") || []).map(
      (row) => (row.id === id ? { ...row, ...patch } : row)
    ));
  }, [getValues, setRoomRows]);
  const onRemoveRoomRow = useCallback((id) => {
    setRoomRows((getValues("roomRequirements") || []).filter((row) => row.id !== id));
  }, [getValues, setRoomRows]);

  /* What the collapsed Vehicle header says. A section that hides filled-in rows behind a chevron
     and shows nothing about them is how a requirement gets forgotten — so once there are rows, the
     header stops offering and starts reporting. Blank when empty, which leaves the description
     ("Add one only if the trip needs transport") in place as the invitation. */
  const vehicleSummary = useMemo(() => {
    const rows = (vehicleRows || []).filter(
      (row) => row && (row.vehicleType || row.model || row.vehicleId),
    );
    if (!rows.length) return null;
    const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 1), 0);
    const named = rows.map((row) => row.model || row.vehicleType).filter(Boolean).join(", ");
    return `${total} vehicle${total === 1 ? "" : "s"}${named ? ` · ${named}` : ""}`;
  }, [vehicleRows]);

  const departureMode = watch("departureMode");
  const assistanceRequired = watch("specialAssistanceRequired");
  const assistanceTypes = watch("specialAssistanceTypes") || [];
  const roomPlanEnabled = Boolean(watch("roomPlanEnabled"));

  const showAdultBreakdown = Boolean(watch("showAdultBreakdown"));
  const totalAdults = toInt(watch("totalAdults"));
  const totalTravellers = totalAdults + toInt(watch("children")) + toInt(watch("infants"));
  const tripStartDate = watch("travelDate");
  const tripEndDate = watch("returnDate");
  const tripDurationLabel = (() => {
    if (!tripStartDate || !tripEndDate) return "";
    const start = Date.parse(`${tripStartDate}T00:00:00Z`);
    const end = Date.parse(`${tripEndDate}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";
    const nights = Math.round((end - start) / 86_400_000);
    const days = nights + 1;
    return `${nights} ${nights === 1 ? "Night" : "Nights"} · ${days} ${days === 1 ? "Day" : "Days"}`;
  })();
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

  /* ── WhatsApp — the booking form's field, finally given a control here ────────────────────────
     `whatsappSame` / `whatsappNumber` have been in blankDefaults and in transformFormData since
     V22 (which sends `customerWhatsapp: null` while the tick is on, so "same as phone" stays ONE
     value rather than a copy that can drift). What was missing was any way to switch the tick off:
     the lead form had no WhatsApp input at all, so the column could only ever be written by the
     BOOKING form — the exact "type it twice" split the V22 columns were added to end. Edit mode
     already round-trips the saved number (applyLead reads lead.customerWhatsapp); it simply had
     nowhere to show it.

     Deliberately NOT register()ed: while the tick is on, the box has to READ the phone field, and
     an input cannot be both RHF-uncontrolled and mirror another value. watch + setValue is the
     same idiom the traveller counters and the vehicle/room rows already use in this component, and
     shouldUnregister is false, so the value reaches handleSubmit either way.
     Mirrors CreateBookingClean's customerWhatsapp / whatsappSameAsPhone pair exactly. */
  /* ── The layout, expressed as three class strings ─────────────────────────────────────────────
     BOTH modes keep the rail: a fixed 320px column carrying Lead Setup and Assistance, sticky under
     the header. Those are short panels of small controls that stop getting better above ~320px, and
     Lead Setup holds the REQUIRED lead source — a field the booking form has no counterpart for, so
     "match the booking" cannot mean "drop it to the bottom of a long stack".

     Rapid briefly ran railless, on the reasoning that the booking has no rail. Wrong trade: it made
     the one required field on the screen the last thing an agent scrolls to, and the booking has no
     rail because it has no lead setup, not because a rail is wrong here.

     Kept as variables rather than inlined because getting this wrong is silent: `lg:col-span-2`
     inside a one-column grid does not mean "full width" — it conjures an implicit second track and
     the page quietly goes back to two columns. The container and the children have to agree, so
     they are decided in one place. */
  const gridCls = "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start";
  const mainCol = compactRail ? "lg:col-start-1" : "lg:col-span-2";
  const railCls = `min-w-0 ${compactRail
    ? "space-y-3.5 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-start-1 lg:row-span-3"
    : "space-y-5 lg:col-start-2 lg:row-start-3"}`;

  /* ── Rapid's Travel Details card is the BOOKING's component, not a copy of it ─────────────────
     Four fields are named differently on the two forms and everything else already matches — the
     mode list is the same five strings ("Flight / Airport", "Train / Rail", "Car / Road", "Bus",
     "Other") and every sub-field (departureAirport, airportCode, railwayStation, trainClass,
     pickupAddress, vehiclePreference, the whole drop group) is spelt the same. So the adapter is a
     four-entry alias table, not a translation layer.

     That equality is what makes the mode switch safe: a value typed in Rapid is displayable in
     Full and vice versa, and the server's "clear the transport group whose mode does not match"
     rule sees the same strings either way. If the two lists ever diverge, this is the seam that
     breaks — keep them in step.

     Built only in Rapid: each watch() here is a live subscription, and Full is the mode being
     typed at 50-100 records a day. */
  const TRAVEL_ALIAS = { tripEndDate: "returnDate", pickupMode: "departureMode", pickupCountry: "departCountry", pickupCity: "departCity" };
  const travelProxy = rapidEntry ? {
    travelDate: watch("travelDate") || "",
    tripEndDate: watch("returnDate") || "",
    pickupMode: watch("departureMode") || "",
    pickupCountry: watch("departCountry") || "",
    pickupCity: watch("departCity") || "",
    pickupAddress: watch("pickupAddress") || "",
    pickupDateTime: watch("pickupDateTime") || "",
    departureAirport: watch("departureAirport") || "",
    airportCode: watch("airportCode") || "",
    preferredFlightTime: watch("preferredFlightTime") || "",
    railwayStation: watch("railwayStation") || "",
    trainClass: watch("trainClass") || "",
    preferredTrainTime: watch("preferredTrainTime") || "",
    vehiclePreference: watch("vehiclePreference") || "",
    dropCity: watch("dropCity") || "",
    dropCountry: watch("dropCountry") || "",
    dropMode: watch("dropMode") || "",
    dropDateTime: watch("dropDateTime") || "",
  } : null;
  const setTravelField = (name, value) =>
    setValue(TRAVEL_ALIAS[name] || name, value, { shouldDirty: true });
  /* FastTravelDetails prints `errors.travelDate` straight into the page, so it wants STRINGS. RHF
     hands back `{message}` objects — passing those renders "[object Object]" under the date field,
     which is how a validation message becomes a bug report. */
  const travelErrors = {
    travelDate: errors.travelDate?.message,
    tripEndDate: errors.returnDate?.message,
  };

  const whatsappSame = watch("whatsappSame") !== false;
  const whatsappTyped = watch("whatsappNumber") || "";
  const whatsappDisplay = whatsappSame ? (watch("phone") || "") : whatsappTyped;
  const toggleWhatsappSame = (checked) => {
    setValue("whatsappSame", checked, { shouldDirty: true });
    /* Unticking seeds the box with the phone rather than emptying it — "same number, different
       handset" is the common correction, so the agent edits a digit or two instead of retyping
       eleven. The typed value is kept when the tick goes back ON (transformFormData already nulls
       it), so tick → untick → tick does not destroy what was entered. */
    if (!checked && !getValues("whatsappNumber")) {
      setValue("whatsappNumber", getValues("phone") || "", { shouldDirty: true });
    }
  };

  /* ── The route, hoisted so both layouts can place it ──────────────────────────────────────────
     Full keeps it where it has always been: at the foot of the Trip panel, under a rule. Rapid
     lifts it into its own "Travel Itinerary" card, which is where CreateBookingClean keeps it.

     Defined ONCE and rendered in one place or the other, never both. The alternative — writing the
     rows out again in the Rapid tree — is exactly the fork the note at the foot of TravelDetails.jsx
     records as the cause of the last silent data-loss bug: two copies of one field drift, and the
     one that drifts is always the one nobody is looking at. It also matters for `#itinerary-group`,
     which save() scrolls to on a half-filled row: two copies would put that id in the document
     twice and the scroll would resolve to whichever mounted first. */
  /* The destination control, hoisted for the same reason as routeBlock: Full shows it in the
     Customer row (it is the first thing said on a call), Rapid slots it into the Travel Details
     card's primaryFields where the booking keeps it. ONE control either way — it reads and writes
     `itinerary[0]` through chooseDestination(), so a second copy would not merely be untidy, it
     would put two nodes named `lead-destination` in the document and give the Enter walk two
     places to stop for one answer. */
  const destinationField = itinerary.length > 0 ? (
    <Field id="lead-destination" label="Destination" hint="Syncs with the first itinerary stop">
      <SearchableSelect
        name="lead-destination"
        options={destinations}
        value={itinerary[0].destinationId ? Number(itinerary[0].destinationId) || itinerary[0].destinationId : ""}
        onChange={(value) => chooseDestination(itinerary[0].id, value)}
        placeholder={itinerary[0].destination || "Where do they want to go?"}
        loading={loadingDestinations}
        searchable
        advanceOnSelect
      />
    </Field>
  ) : null;

  /* Trip Type and Likely to book — lead-only qualification, asked on both layouts. Full keeps
     them in the Trip panel's field grid; Rapid slots them into the Travel Details card beside the
     destination, because that panel does not exist there and these two would otherwise have no
     home at all. */
  const qualificationFields = (
    <>
      <Field id="occasion" label="Trip Type" hint="Helps choose the hotel, pace and vehicle">
        <select {...register("occasion")} id="occasion" className={control(false)}>
          <option value="">Select trip type</option>
          <option value="HONEYMOON">Honeymoon</option>
          <option value="FAMILY">Family</option>
          <option value="SENIOR_CITIZENS">Seniors</option>
          <option value="FRIENDS">Friends</option>
          <option value="CORPORATE">Corporate</option>
          <option value="PILGRIMAGE">Pilgrimage</option>
          <option value="SOLO">Solo</option>
        </select>
      </Field>

      <Field id="decideBy" label="Likely to book" hint="Used to plan the follow-up — not the travel date">
        <select {...register("decideBy")} id="decideBy" className={control(false)}>
          <option value="">Select timeframe</option>
          <option value="IMMEDIATE">Now</option>
          <option value="WITHIN_WEEK">This week</option>
          <option value="WITHIN_MONTH">This month</option>
          <option value="JUST_EXPLORING">Just exploring</option>
        </select>
      </Field>
    </>
  );

  /* ── Rapid's route editor IS the booking's RouteSegments ──────────────────────────────────────
     Two shapes have to meet, and they meet cleanly on one observation: a lead's STOP is a leg's TO.
     Nights belong to the arrival city on both sides, so `city`/`cityId` map straight onto
     `toCity`/`toCityId` and nothing about the saved payload changes — transformFormData still sends
     destination · city · nights · dayNumber · the two ids, exactly as before. That is what keeps the
     lead → quotation chain alive: the prefill seeds its hotel rows off `cityId`/`destinationId`, and
     swapping to an editor that did not carry them would have looked like the booking while quietly
     breaking the one flow on this page that makes money.

     The FROM side is DERIVED, and this is the one honest gap. LeadItineraryRequestDto has no
     from-city column, so a leg's From is chained from the previous leg's To (and from the pickup
     city on leg 1) and held on the row client-side. RouteSegments' own contract calls chaining "a
     default, not a binding", so editing a From still works for the whole session — but a manual
     From that deliberately breaks the chain normalises back to the chained value when the lead is
     reopened. Persisting it is a backend column, which this pass does not touch.

     One destination for the whole route, which is the booking's model: the trip destination comes
     from the Travel Details card and every row is stamped with it as cities are picked, so rows 2..n
     keep the destinationId the quotation needs without a per-row destination select. */
  const tripRow = itinerary[0] || {};
  const tripCityOptions = (rowCities[tripRow.id] || []).map((city) => ({
    value: String(idOf(city)),
    label: String(city?.name || ""),
  }));
  const pickupCityName = String(watch("departCity") || "").trim();
  const dropCityName = String(watch("dropCity") || "").trim();
  /* SEPARATE lists per side, as on the booking: you depart from the pickup and arrive at the drop,
     so offering "Gorakhpur — drop" as a From is an answer that is never right. `name:` is
     RouteSegments' free-text protocol — the id is stored empty and only the name is kept, which the
     payload has always allowed. */
  const routeFromOptions = pickupCityName
    ? [{ value: `name:${pickupCityName}`, label: `${pickupCityName} — pickup` }, ...tripCityOptions]
    : tripCityOptions;
  const routeToOptions = dropCityName
    ? [...tripCityOptions, { value: `name:${dropCityName}`, label: `${dropCityName} — drop` }]
    : tripCityOptions;
  const routeRows = itinerary.map((row, index) => ({
    id: row.id,
    // ?? not ||: an explicitly CLEARED From is an empty string and must stay cleared, not
    // silently re-chain to the previous stop on the next render.
    fromCityId: row.fromCityId ?? (index > 0 ? (itinerary[index - 1].cityId || "") : ""),
    fromCity: row.fromCity ?? (index > 0 ? (itinerary[index - 1].city || "") : pickupCityName),
    toCityId: row.cityId || "",
    toCity: row.city || "",
    nights: row.nights,
  }));
  const updateRouteRow = (rowId, field, value) => {
    if (field === "toCityId") {
      return onUpdateRow(rowId, {
        cityId: value ? String(value) : "",
        // Stamp the trip's destination as the city is chosen. Without it a row picked on leg 3
        // would carry a cityId and no destinationId, and the quotation prefill reads both.
        destinationId: tripRow.destinationId || "",
        destination: tripRow.destination || "",
      });
    }
    if (field === "toCity") return onUpdateRow(rowId, { city: value });
    if (field === "nights") return onUpdateRow(rowId, { nights: value });
    // fromCityId / fromCity ride on the row untouched — client-side only, see above.
    return onUpdateRow(rowId, { [field]: value });
  };
  const routeSummary = routeRows
    .map((row) => row.toCity)
    .filter(Boolean)
    .join(" → ");

  const routeBlock = (
    <>
            {/* ── The route ────────────────────────────────────────────────────────────────────
                Stays at the foot of the panel. It was briefly moved to the top on the reasoning
                that the customer opens the call with the destination — which is true of the CALL,
                but not of the FORM: the itinerary is the step the whole chain hangs off (Services
                unlock behind its confirm button), and a multi-row block with its own Add Stop and
                Done—continue reads as the end of a panel, not the start of one. */}
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
    </>
  );

  return (
    <>
      {/* Fixed rail, proportional main — the booking form's split, for the same reason. The rail
          holds Lead Setup, Services and Assistance: short panels of small controls that stop
          getting better above ~320px. As `3fr` it took ~30% of a 1400px page, so on a wide monitor
          it grew into 420px of half-empty panel while the Customer and Trip fields — the ones that
          actually want width — wrapped a column earlier than they needed to. */}
      <div className={gridCls}>
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
      <div className={`min-w-0 ${mainCol}`}>
      {/* OLD — title="Customer", description="Phone first — an existing lead on this number is
          flagged as you type", opening on a four-across row of Phone · Name · Email · Destination,
          with WhatsApp absent and City / State / Country parked in the optional group at the foot
          of the panel.

          Replaced so this card IS the booking form's Customer Details: same title, same header
          chips, the same Name → Phone → WhatsApp opening row, and the same Email · City · State ·
          Country row under the match strip. An agent who takes an enquiry and then books it now
          answers one card twice instead of two cards that ask the same things in a different order
          and a different place — which is exactly what "the booking asks for it, the lead has
          nowhere to put it" kept producing. Nothing the lead asked for was dropped; the fields the
          booking has no counterpart for (Destination, follow-up, birthday) are still here. */}
      <Panel
        icon={CircleUserRound} iconTile="bg-blue-100 text-blue-700"
        title="Customer Details"
        description="Enter the phone number — an existing customer is matched automatically"
        action={
          /* The booking's two-chip corner, verbatim in intent: the lookup status is transient and
             the headcount is standing, so they cannot take turns in one slot. The flex wraps for
             the reason it wraps there — on a narrow viewport "Existing customer" and "6 travellers"
             together outrun the corner.

             `contactStatus` is a slot the PAGE fills. LeadFormPanels holds no lookup state of its
             own (the probe, its debounce and its match live on CreateLead), and EditLead does not
             probe at all — it passes nothing and the corner simply carries the headcount. */
          <div className="flex flex-wrap items-center justify-end gap-2">
            {contactStatus}
            {totalTravellers > 0 && (
              <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                {totalTravellers} traveller{totalTravellers === 1 ? "" : "s"}
              </span>
            )}
          </div>
        }
      >
        {/* Name → Phone → WhatsApp — the booking's order, for the booking's reason: the name is
            what the agent is told first on a call. "Phone first" stays true of the BEHAVIOUR (the
            duplicate/customer probe still fires off the number, and autofocus still lands there);
            it just stopped needing to be true of the reading order.

            Destination rides on as the fourth column in FULL rather than being demoted below the
            rule: on an enquiry it is the first thing said. In RAPID it moves to the Travel Details
            card's primaryFields slot, which is exactly where CreateBookingClean puts it — so the
            row falls back to the booking's three columns and there is still only ONE destination
            control in the document, never two writing itinerary[0] from different cards. */}
        <div className={`grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 ${rapidEntry ? "lg:grid-cols-3" : "xl:grid-cols-4"}`}>
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

          <Field id="phone" label="Customer Phone" required error={errors.phone?.message}>
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

          {/* ── WhatsApp Number ────────────────────────────────────────────────────────────────
              Brought across from CreateBookingClean's Customer Details, tick and all.

              `whatsappSame` / `whatsappNumber` have been in blankDefaults and in transformFormData
              since V22 (which sends `customerWhatsapp: null` while the tick is on, so "same as
              phone" stays ONE value rather than a copy that can drift). What was missing was any
              way to switch the tick off: the lead form had no WhatsApp input at all, so the column
              could only ever be written by the BOOKING form — the exact "type it twice" split
              those columns were added to end. Edit mode already round-tripped a saved number
              (applyLead reads lead.customerWhatsapp); it simply had nowhere to show it.

              Ticked by default and mirroring the phone, because one handset is the overwhelming
              case — a blank box with no tick would ask every agent, on every enquiry, a question
              whose answer is almost always yes. */}
          <Field id="whatsappNumber" label="WhatsApp Number" optional>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="whatsappNumber"
                data-skip-enter="true"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={whatsappDisplay}
                onChange={(e) => setValue("whatsappNumber", e.target.value.replace(/[^+\d\s\-()]/g, ""), { shouldDirty: true })}
                disabled={whatsappSame}
                placeholder="Same as phone"
                className={`${control(false, true)} disabled:bg-slate-50 disabled:text-slate-500`}
              />
            </div>
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
              <input
                type="checkbox"
                data-skip-enter="true"
                checked={whatsappSame}
                onChange={(e) => toggleWhatsappSame(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              Same as phone
            </label>
          </Field>

          {/* ── Destination, where the call actually starts ─────────────────────────────────
              Nobody rings a travel agent and opens with a date — every call opens "Manali ka
              package chahiye". The only place to record that was the itinerary block at the foot
              of the Trip panel, so the first word the agent heard was the last thing they could
              type.

              NOT A SECOND FIELD. It reads and writes `itinerary[0].destination` directly, through
              the same chooseDestination() the itinerary row uses — so it sets destinationId and
              loads that destination's cities exactly as picking it below would, and editing either
              place moves the same value. There is no copy to fall out of step.

              That distinction is the whole point: a "From" field added earlier this session DID
              keep its own state, went nowhere on save, and sat eight fields above the real one.
              One source of truth, two places to reach it. */}
          {!rapidEntry && destinationField}

            </div>

            {belowPhone}

            {/* ── The rest of the customer record ─────────────────────────────────────────────
                Email · City · State / Province · Country, one four-across row under a rule —
                the booking's second row, in the booking's order, in the booking's place.

                Email came DOWN out of the opening row to get here, and City / State / Country came
                UP out of the optional group at the foot of the panel. That split was the whole
                complaint: the three address fields exist precisely so a converted lead stops making
                the agent retype an address, and they were sitting eight fields below the person
                they describe, where the booking form puts them beside the email.

                City is the residence, not the trip's origin — the hint says so because departCity
                in the Trip panel is a different question, and a Pune customer flying out of Mumbai
                is the ordinary case. */}
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
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

              <Field id="customerCity" label="Customer City" optional hint="Where they live — not where the trip starts">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input {...register("customerCity")} id="customerCity" data-skip-enter="true" placeholder="e.g. Pune" className={control(false, true)} />
                </div>
              </Field>

              <Field id="customerState" label="State / Province" optional>
                <input {...register("customerState")} id="customerState" data-skip-enter="true" placeholder="e.g. Maharashtra" className={control(false)} />
              </Field>

              <Field id="customerCountry" label="Customer Country" optional>
                <input {...register("customerCountry")} id="customerCountry" data-skip-enter="true" placeholder="India" className={control(false)} />
              </Field>
            </div>

            {/* ── Travellers ──────────────────────────────────────────────────────────────────
                Under its own rule and its own heading, which is where the booking puts them and
                what it calls them. Who is going is a fact about the PARTY, and it closes the
                identity half of the card.

                OLD — this block sat directly under {belowPhone} with no rule and no heading, on the
                argument that "Sharma ji, four adults, two kids" is one answer taken in one breath.
                It still is; what changed is that the address row now stands between the contact
                fields and the counters, so there is a seam here whether or not a hairline is drawn,
                and an unlabelled row of numbers under someone's postal address reads as nothing at
                all. The hint stays — it is the one thing that row said which the legends do not. */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Travellers</h3>
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
                /* Rapid passes showRooms={false}, which is what CreateBookingClean passes and for
                   its reason: the Room Requirement rows own that number, and two editors for one
                   value is how they drift apart. Full keeps the counter because it has no separate
                   room card open beside it. `rooms` itself is untouched either way — the counter is
                   hidden, not the field. */
                showRooms={!rapidEntry}
                /* HEADCOUNT FIRST, breakdown underneath and optional — which is the order the
                   question is actually asked in. "Kitne log hain?" gets one number back: "chaar".
                   Only when the answer is not simply adults does the split matter, and then the
                   agent opens it.

                   This is the component's standard mode; the `compact` flag I had passed here was
                   suppressing it and forcing all five counters flat. The flat row was right when
                   the total was a DERIVED read-only tile — it is not, now that the total is the
                   thing you type.

                   Nothing is hidden behind a click that cannot be got back: the breakdown force-
                   opens, and its toggle disables, the moment children or infants are non-zero, so
                   the single box can never claim a party of four that is really six. */
                /* `compact` is gone with Full details. It did exactly two things — hide the
                   "Specify adult gender count" toggle and hide Extra Beds — so rapid could not
                   record a male/female split or an extra bed without switching modes first. Both
                   are back for everyone; the counters are one row either way. */
                /* Budget is FULL only. The booking form has no budget field at all — what the
                   customer said they might spend is an enquiry fact, and by booking time the
                   number that matters is Customer Amount, which lives in the money rail Rapid
                   does not carry. Null here rather than a hidden field: TravellerCountFields
                   simply renders no extra group. The value survives a mode switch. */
                additionalGroup={rapidEntry ? null : (
                  <Field id="budget" label="Budget (roughly)" optional error={errors.budget?.message}>
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

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Budget is</span>
                      {[
                        { value: "TOTAL", label: "Total" },
                        { value: "PER_PERSON", label: "Per person" },
                      ].map((option) => {
                        const active = (watch("budgetBasis") || "TOTAL") === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            data-skip-enter="true"
                            aria-pressed={active}
                            onClick={() => setValue("budgetBasis", option.value, { shouldDirty: true })}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                              active
                                ? "bg-blue-600 text-white"
                                : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
              />

              {/* ── The total, and the one question that changes how a trip is operated ──────
                  Seniors 60+ stood here and is gone. It was a subset of the adults above, which
                  made it the one number on the row that did NOT add up — an agent reading the line
                  had to know it was already counted. What actually belongs beside the counters is
                  their SUM, which is the number the agent reads back to the customer.

                  Derived, never typed: adults + children + infants, the same formula the booking
                  side uses. Infants are in it here because this is "how many people are coming",
                  not "how many seats" — the seat question is the counters themselves.

                  Special assistance sits next to it because it is a question about these same
                  people, asked in the same breath, and because it changes the whole operation of
                  the trip — vehicle, hotel room, airline notification. It used to be reachable
                  only in the right rail, several stops away in the Enter walk.

                  Child ages stay: the hotel's child policy is priced on them, and an age nobody
                  asked for on the call is an age nobody can get afterwards. The ARRAY is the source
                  of truth; raising Children appends a blank rather than rebuilding the list, so
                  ages already typed are never renumbered mid-call.

                  FULL only — the booking form has no child-ages editor. Ages already captured are
                  not lost when Rapid is showing; `childAges` is untouched, just not rendered. */}
              {!rapidEntry && toInt(watch("children")) > 0 && (
              <div className="mt-2.5 grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                {/* The read-only "Total travellers" tile that stood here is gone. With the
                    headcount restored as the TYPED first box above, this was the same number a
                    second time, four inches lower — and the two could disagree for a frame while
                    the breakdown was being edited. One number, one place, and it is the one the
                    agent types. */}

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
              </div>
              )}
              {/* The blue Total Travellers strip is retired. TravellerCountFields' own first box is
                  now labelled "Total Travellers" and, once the breakdown is open, is the derived
                  total — so this was the same number a second time, two inches lower and in a
                  different colour. `totalTravellers` is still computed above; the assistance panel's
                  passenger-count rule validates against it.
              <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                <span …>Total Travellers</span><span …>{totalTravellers}</span>
              </div> */}

              {/* ── What the trip NEEDS ────────────────────────────────────────────────────
                  The room-by-room plan that used to sit here is still gone, and should be: it asked
                  for a category, a bed preference and an age per child FOR EVERY ROOM, on a form
                  whose whole purpose is taking an enquiry in one pass.

                  What replaces it is the BOOKING's shape — a mix, "2 x Deluxe AC", two boxes a row
                  — because the enquiry is where that answer is actually given. The customer says
                  "three deluxe rooms and an Innova" on the call; before this the form had nowhere to
                  put either, so it was lost at save and asked again at booking. The same two editors
                  render on both screens, so what is captured here is literally the shape the booking
                  inherits. Expanded into per-room allocations on submit. */}
              {/* FULL only. In Rapid these two editors move out into their own
                  "Vehicle & Room Requirement" card directly below this one, which is where the
                  booking form puts them — see the panel after this one. Same rows, same handlers,
                  same state; only the chrome around them differs, so nothing can drift between the
                  modes and switching mid-entry keeps every value. */}
              {!rapidEntry && (
              <div className="mt-5 space-y-5 border-t border-slate-100 pt-4">
                <div>
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Vehicle &amp; Room Requirement
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      What the trip needs — not what is finally assigned
                    </p>
                  </div>
                </div>

                {/* Vehicle starts CLOSED. Rooms are asked on almost every enquiry; a vehicle is
                    asked on a minority of them, and an editor sitting open for a question nobody
                    asked is another block of screen between the agent and the next field. Closed it
                    costs one click when it IS needed and nothing when it is not — and once a lead
                    carries vehicles, the collapsed header names them, so it never hides data.
                    Header stays visible either way: the section has to be discoverable, and a
                    requirement the form does not mention is a requirement nobody records. */}
                <Panel
                  icon={Bus} iconTile="bg-amber-100 text-amber-700"
                  title="Vehicle"
                  description="Add one only if the trip needs transport"
                  collapsible
                  defaultOpen={false}
                  summary={vehicleSummary}
                >
                  <VehicleRequirementRows
                    rows={vehicleRows}
                    onAdd={onAddVehicleRow}
                    onRemove={onRemoveVehicleRow}
                    onUpdate={onUpdateVehicleRow}
                  />
                </Panel>

                <section className="min-w-0">
                  <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Rooms</h4>
                  <RoomRequirementRows
                    rows={roomRows}
                    onAdd={onAddRoomRow}
                    onRemove={onRemoveRoomRow}
                    onUpdate={onUpdateRoomRow}
                  />
                </section>
              </div>
              )}
            </div>


            {/* ── Optional details · ON SCREEN, OUT OF THE ENTER WALK ──────────────────
                Every field below carries data-skip-enter. They stay visible, Tab-reachable and
                clickable — an agent who is told a birthday mid-call can still record it without
                reopening the lead, which is the thing this form has twice reverted a redesign to
                protect. What changes is that Enter no longer STOPS on them on the way from the
                phone number to the travel date.

                That gap is five stops on every enquiry, and it is worse than five keystrokes:
                focusNext calls select() on arrival, so each pass-through field sits there with its
                contents highlighted and one stray character overwrites a value the agent never
                meant to touch.

                ── Optional details ─────────────────────────────────────────────────────
                Was its own "Customer Profile" panel in the rail. Same person, two boxes:
                the agent typed a name here and a birthday three panels away, and the folded
                summary had to carry two rows to describe one customer. Merged in, behind a
                rule rather than a second heading — everything above identifies the customer,
                everything below is what you learn about them on the call. */}
            {/* FULL only. What is left in this group after WhatsApp and the address row moved up
                is four lead-only fields — How to contact them, Call them back on, Birth Date,
                Anniversary — and the booking form carries none of them. Birth Date and Anniversary
                it dropped deliberately (its own note: "customer-profile facts, not booking facts,
                and they cost two fields on the fastest-typed screen in the app"); a contact channel
                and a call-back date are enquiry facts that stop mattering once the trip is booked.

                Hidden, not removed: every value still round-trips, so an existing lead's birthday
                survives being opened, edited and saved in Rapid. */}
            {!rapidEntry && (
            <>
            {/* One grid, not a stack. These five were a 2-up row followed by three full-width
                fields, which made the optional half of the panel twice as tall as the half that
                actually identifies the customer. They are all small controls; they belong on the
                same four-column rhythm as the fields above the rule. */}
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* Ordered by when they come up on the call, not by what the record holds.
                  "WhatsApp pe bhej doon?" and "kab call karun?" are asked on nearly every enquiry —
                  the first decides where the quotation goes, the second writes a reminder. A
                  birthday is relationship data picked up in passing, months later, and had no
                  business being the first two boxes an agent's eye landed on down here.

                  The WhatsApp NUMBER used to be planned for this group and now leads the opening
                  row instead — the booking puts it third beside the phone, and matching that card
                  was the point of the change. What is left here is the CHANNEL, which is a
                  different question ("where do I send the quotation?") and has no counterpart on
                  the booking form at all. */}
              <Field id="preferredCommunication" label="How to contact them" optional>
                <div className="relative">
                  <select {...register("preferredCommunication")} id="preferredCommunication" data-skip-enter="true" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select channel</option>
                    {COMMUNICATION_PREFERENCES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>

              <Field id="followUpDate" label="Call them back on" optional hint="Creates a reminder when the lead is saved">
                <input {...register("followUpDate")} id="followUpDate" data-skip-enter="true" type="date" min={today()} className={control(false)} />
              </Field>

              <Field id="birthDate" label="Birth Date" optional>
                <input {...register("birthDate")} id="birthDate" data-skip-enter="true" type="date" max={today()} className={control(false)} />
              </Field>

              <Field id="anniversaryDate" label="Anniversary" optional>
                <input {...register("anniversaryDate")} id="anniversaryDate" data-skip-enter="true" type="date" max={today()} className={control(false)} />
              </Field>

              {/* OLD — Customer City / State / Province / Country stood here.
                  Three fields the BOOKING form has always asked for and this one never did, so
                  every converted lead meant retyping an address the agent had already been given.
                  They have moved UP into the Email · City · State · Country row under the match
                  strip, which is where the booking's Customer Details keeps them — see the note
                  there. Adding them down here fixed the missing-column half of the problem and left
                  the other half: an address recorded eight fields below the person it belongs to,
                  in the group an agent skips when the phone is ringing.

                  They are NOT the same as Pickup City / Country in the Trip panel: that is where
                  the trip starts. A Pune customer flying out of Mumbai is the ordinary case. */}

              {/* Budget moved up beside the traveller counts — see the note there. */}
            </div>
            </>
            )}
          </Panel>
        </div>
        )}

        {/* ── RAPID · Vehicle & Room Requirement ────────────────────────────────────────────────
            CreateBookingClean's card, in its own slot below Customer Details, with the booking's
            title, description, icon tile and corner summary.

            ONE card, two bands — not two cards side by side, and not the collapsed Vehicle panel
            Full uses. Both bands answer the same question ("what does this party need booked"),
            they are filled in together, and as separate cards each sized to its own row count, so
            an empty Vehicle box sat next to three room rows and the pair looked broken. Stacked
            rather than two columns for the booking's reason too: side by side each band had half
            the card for four controls plus a bin, and every select collapsed into abbreviations —
            "Temp…" for Tempo Traveller. A room type you cannot read is a room type nobody checks.

            Vehicle is OPEN here. Full keeps it collapsed because a vehicle is asked on a minority
            of calls and a closed editor is one less block between the agent and the next field;
            Rapid is the mode for the detailed enquiry, and the booking shows it open. Same
            `vehicleRows` / `roomRows` and the same handlers either way — the editors are shared,
            only the chrome around them is per-mode. */}
        {rapidEntry && !foldEnquiry && (
        <div className={`min-w-0 ${mainCol}`}>
          <Panel
            icon={Bus} iconTile="bg-amber-100 text-amber-700"
            title="Vehicle & Room Requirement"
            description="What the trip needs — not what is finally assigned"
            action={vehicleSummary ? (
              <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                {vehicleSummary}
              </span>
            ) : null}
          >
            <div className="space-y-5">
              <section className="min-w-0">
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle</h3>
                  <p className="text-[11px] text-slate-400">Not the vehicle finally assigned</p>
                </div>
                <VehicleRequirementRows
                  rows={vehicleRows}
                  onAdd={onAddVehicleRow}
                  onRemove={onRemoveVehicleRow}
                  onUpdate={onUpdateVehicleRow}
                />
              </section>
              {/* A rule between the two bands, at every width now that they are stacked. */}
              <section className="min-w-0 border-t border-slate-100 pt-5">
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Rooms</h3>
                  <p className="text-[11px] text-slate-400">Room mix for the party</p>
                </div>
                <RoomRequirementRows
                  rows={roomRows}
                  onAdd={onAddRoomRow}
                  onRemove={onRemoveRoomRow}
                  onUpdate={onUpdateRoomRow}
                />
              </section>
            </div>
          </Panel>
        </div>
        )}

        {/* ── 2 · Trip · FULL ──────────────────────────────────────────────────────────────────
            One panel holding dates, departure, drop, the two qualification selects and the route.
            Rapid splits the same fields the way the booking does — Travel Details as its own card,
            the route as its own card — see the two blocks directly below. */}
        {!foldEnquiry && !rapidEntry && (
        <div className={`min-w-0 ${mainCol}`}>
          <Panel
            icon={Route} iconTile="bg-yellow-200 text-yellow-900"
            title="Trip"
            description="Dates, travellers, departure and route in one place"
            action={tripDurationLabel ? (
              <span className="inline-flex w-fit flex-wrap items-center gap-x-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{tripDurationLabel}</span>
              </span>
            ) : null}
          >
            {/* ONE grid for the whole panel. From and Occasion used to sit in a two-up row of
                their own above the dates, which cost a full row of height to show two fields and
                broke the four-across rhythm the rest of the panel reads in. They are ordinary
                fields; they flow with the others.

                Both are questions the old form never asked and the two an experienced agent asks
                first. There is no quote without a departure city — every fare, every transfer and
                every night is priced from it — and Occasion moves more of a quotation than budget
                does: a honeymoon, elderly parents and a friends' group buy three different hotels,
                paces and vehicles at the same price.

                Four across on a wide monitor, two on a laptop — and the breakpoint is xl, not lg,
                which is the whole subtlety. This column always loses 320px to the rail, so at lg
                (1024px) four columns really would be ~150px each and a date picker would not fit.
                By xl (1280px) there is ~900px here and they are ~210px, which is comfortable.

                The panel ran at four across a week ago and I cut it to two outright; that was the
                right worry applied at the wrong breakpoint, and it doubled the height of the
                longest panel on the form for everyone, including the wide screens this is used on. */}
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
              {/* This is `departCity`, promoted — NOT a second "from" field.
                  I added one called `fromCity` and it was decorative: transformFormData whitelists
                  the payload and never sent it, so the departure city an agent typed here went
                  nowhere, while the real one sat eight fields lower in this same panel. Two inputs
                  for one fact, one of them silently dead.

                  departCity is the one wired to everything — it is saved, it is in STICKY_FIELDS so
                  it carries into the next enquiry, it seeds the quotation through draftLeadKey, and
                  the customer lookup prefills it. It belongs where the question is actually asked:
                  first, because every fare and transfer is priced from it. */}
              {/* Match Booking's Pickup vocabulary and keep the three origin answers together.
                  The city is the answer agents ask for first, so it gets the widest control; India
                  remains prefilled and needs no action for the common case. */}
              <div className="min-w-0 sm:col-span-2">
                <Field id="departCity" label="Pickup City" hint="Where the journey starts">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      {...register("departCity")}
                      id="departCity"
                      placeholder="e.g. Pune"
                      className={control(false, true)}
                    />
                  </div>
                </Field>
              </div>

              <Field id="departCountry" label="Pickup Country" optional>
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

              <Field id="departureMode" label="Pickup Mode" optional>
                <div className="relative">
                  <select {...register("departureMode")} id="departureMode" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select mode</option>
                    {DEPARTURE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>

              <div className="min-w-0 sm:col-span-2">
                <Field id="travelDateRange" label="Travel Period" required error={errors.travelDate?.message}>
                  <input type="hidden" {...register("travelDate", { required: "Travel date is required" })} />
                  <input type="hidden" {...register("returnDate")} />
                  <DateRangeField
                    id="travelDateRange"
                    startValue={tripStartDate}
                    endValue={tripEndDate}
                    startLabel="Check-in"
                    endLabel="Check-out"
                    invalid={Boolean(errors.travelDate || errors.returnDate)}
                    onChange={({ start, end }) => {
                      setValue("travelDate", start, { shouldDirty: true, shouldValidate: true });
                      setValue("returnDate", end, { shouldDirty: true });
                    }}
                  />
                </Field>
              </div>

              {qualificationFields}
              {/* OLD — Trip Type and Likely to book were written out here. Hoisted to
                  `qualificationFields` so Rapid can render them too: they are lead-only (the
                  booking never asks either) and this panel is not mounted in Rapid, so leaving
                  them inline would have made two real fields silently unreachable in one of the
                  two modes — the quiet kind of data loss, where nothing errors and the column is
                  just always null.
              <Field id="occasion" label="Trip Type" hint="Helps choose the hotel, pace and vehicle">
                <select {...register("occasion")} id="occasion" className={control(false)}>
                  <option value="">Select trip type</option>
                  <option value="HONEYMOON">Honeymoon</option>
                  <option value="FAMILY">Family</option>
                  <option value="SENIOR_CITIZENS">Seniors</option>
                  <option value="FRIENDS">Friends</option>
                  <option value="CORPORATE">Corporate</option>
                  <option value="PILGRIMAGE">Pilgrimage</option>
                  <option value="SOLO">Solo</option>
                </select>
              </Field>

              <Field id="decideBy" label="Likely to book" hint="Used to plan the follow-up — not the travel date">
                <select {...register("decideBy")} id="decideBy" className={control(false)}>
                  <option value="">Select timeframe</option>
                  <option value="IMMEDIATE">Now</option>
                  <option value="WITHIN_WEEK">This week</option>
                  <option value="WITHIN_MONTH">This month</option>
                  <option value="JUST_EXPLORING">Just exploring</option>
                </select>
              </Field>
              */}
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
                <Field id="preferredFlightTime" label="Preferred Flight Time" optional>
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
                <Field id="preferredTrainTime" label="Preferred Train Time" optional>
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

            {/* ── Drop-off ─────────────────────────────────────────────────────────────────────
                OUTSIDE the three mode blocks above, and that placement is the whole point: the
                server clears whichever transport group the mode does not match, so a party that
                flies in and is driven back would lose its drop the moment the mode was set.
                "Where does the trip end" is true of a trip however the traveller reached it.

                Four fields the BOOKING form has always asked for and this one never did — which is
                why a converted lead arrived with an empty Drop band every time. */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Drop-off</h3>
              <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                <Field id="dropCity" label="Drop City" optional hint="Where the journey ends">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input {...register("dropCity")} id="dropCity" placeholder="e.g. Pune" className={control(false, true)} />
                  </div>
                </Field>

                <Field id="dropCountry" label="Drop Country" optional>
                  <input {...register("dropCountry")} id="dropCountry" placeholder="India" className={control(false)} />
                </Field>

                {/* Free text, not the DEPARTURE_MODES enum: the return is often arranged
                    differently from the arrival ("hotel shuttle", "self-drive"), and the column is
                    a varchar for exactly that reason. The list is a datalist, so the common answers
                    are one keystroke away without rejecting the uncommon ones. */}
                <Field id="dropMode" label="Drop Mode" optional>
                  <input {...register("dropMode")} id="dropMode" list="lead-drop-modes" placeholder="Flight, Train, Car…" className={control(false)} />
                  <datalist id="lead-drop-modes">
                    {DEPARTURE_MODES.map((mode) => <option key={mode} value={mode} />)}
                  </datalist>
                </Field>

                <Field id="dropDateTime" label="Drop Date & Time" optional>
                  <input {...register("dropDateTime")} id="dropDateTime" data-skip-enter="true" type="datetime-local" className={control(false)} />
                </Field>
              </div>
            </div>

            {/* ── Vehicles required ────────────────────────────────────────────────────────────
                Rows, matching the booking's Vehicle Requirement band, so "two Innovas and a Tempo
                Traveller" is recorded as three facts rather than as a sentence in the free-text
                Vehicle Preference above — which the booking could not read, and so asked again. */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicles required</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Optional — leave empty if no vehicle is needed or it is not decided yet
                  </p>
                </div>
                <button
                  type="button"
                  data-skip-enter="true"
                  onClick={onAddVehicleRow}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add vehicle
                </button>
              </div>

              {vehicleRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                  No vehicles added.
                </p>
              ) : (
                <div className="space-y-2">
                  {vehicleRows.map((row, index) => (
                    <div key={row.id} className="grid grid-cols-1 items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 sm:grid-cols-[1.2fr_1.4fr_0.7fr_0.7fr_auto]">
                      <Field id={`vehicleType-${row.id}`} label={index === 0 ? "Type" : ""}>
                        <input
                          value={row.vehicleType}
                          onChange={(event) => onUpdateVehicleRow(row.id, { vehicleType: event.target.value })}
                          list="lead-vehicle-types"
                          placeholder="Sedan, SUV…"
                          className={control(false)}
                        />
                      </Field>
                      <Field id={`vehicleModel-${row.id}`} label={index === 0 ? "Model" : ""}>
                        <input
                          value={row.model}
                          onChange={(event) => onUpdateVehicleRow(row.id, { model: event.target.value })}
                          placeholder="Innova Crysta"
                          className={control(false)}
                        />
                      </Field>
                      <Field id={`vehicleCapacity-${row.id}`} label={index === 0 ? "Seats" : ""}>
                        <input
                          value={row.capacity}
                          onChange={(event) => onUpdateVehicleRow(row.id, { capacity: event.target.value })}
                          type="number"
                          min="0"
                          onWheel={(event) => event.currentTarget.blur()}
                          placeholder="7"
                          className={control(false)}
                        />
                      </Field>
                      <Field id={`vehicleQuantity-${row.id}`} label={index === 0 ? "Qty" : ""}>
                        <input
                          value={row.quantity}
                          onChange={(event) => onUpdateVehicleRow(row.id, { quantity: event.target.value })}
                          type="number"
                          min="1"
                          onWheel={(event) => event.currentTarget.blur()}
                          className={control(false)}
                        />
                      </Field>
                      <button
                        type="button"
                        data-skip-enter="true"
                        onClick={() => onRemoveVehicleRow(row.id)}
                        title="Remove this vehicle"
                        className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <datalist id="lead-vehicle-types">
                    {VEHICLE_TYPES.map((type) => <option key={type} value={type} />)}
                  </datalist>
                </div>
              )}
            </div>

            {/* FULL only. In Rapid the route moves out into its own "Travel Itinerary" card
                below — the booking form's slot for it. See `routeBlock` above: one definition,
                two placements. */}
            {!rapidEntry && routeBlock}
          </Panel>
        </div>
        )}

        {/* ── RAPID · Travel Details ────────────────────────────────────────────────────────────
            Not a lookalike of the booking's card — it IS the booking's card. FastTravelDetails is
            imported through the bookings barrel and handed a proxy of this form, so dates, the
            pickup-mode groups and drop are asked in one shape on both screens and cannot drift.

            The two hidden inputs are not decoration. `travelDate` carries its required rule through
            register(), and the visible control in Full is a DateRangeField that writes via
            setValue — so the rule lives on a hidden input there too. Rapid does not mount the Trip
            panel, so without these the rule would simply not exist in this mode: RHF keeps the
            VALUE when a field unmounts (shouldUnregister is false) but not a rule that was never
            registered, and a lead would save with no travel date in one mode and refuse in the
            other. Registered here, both modes validate identically. */}
        {rapidEntry && !foldEnquiry && (
        <div className={`min-w-0 ${mainCol}`}>
          <input type="hidden" {...register("travelDate", { required: "Travel date is required" })} />
          <input type="hidden" {...register("returnDate")} />
          {/* primaryFields carries Destination ALONE, which is what CreateBookingClean slots in
              here (it pairs it with Package Type; on a lead that select lives in Lead Setup, so it
              is asked once, in the rail, rather than twice on one screen).

              Trip Type and Likely to book USED to ride along here — they are lead-only
              qualification and the booking has neither, so they are Full's alone now. They are
              still rendered by `qualificationFields` in the Trip panel, which is the only place
              they exist; nothing was deleted, and a lead that already carries either keeps it
              through a save made in Rapid.

              This comment sits ABOVE the element rather than between its attributes on purpose. A
              JSX comment in attribute position is not read as a comment at all — the parser sees
              the opening brace and expects a spread, so it fails on the closing one. And a JSX
              comment cannot contain a bare closing brace anywhere in its text either: the
              expression container ends at the first one it meets, mid-sentence. */}
          <FastTravelDetails
            form={travelProxy}
            setField={setTravelField}
            errors={travelErrors}
            primaryFields={destinationField}
          />
        </div>
        )}

        {/* ── RAPID · Travel Itinerary ──────────────────────────────────────────────────────────
            The booking's card AND the booking's editor — RouteSegments itself, through the barrel,
            not a lookalike. Nights belong to the TO city on both sides, so a lead's stop IS a leg's
            TO and the mapping is a rename, not a conversion (see the adapter above `routeBlock`).

            The saved payload is untouched: transformFormData still sends destination · city ·
            nights · dayNumber · destinationId · cityId. That is the part that mattered — the
            quotation prefill seeds its hotel rows off destinationId/cityId, and this is the one
            chain on the page that earns money, so the editor changed and the data did not.

            The one honest gap is the FROM side: LeadItineraryRequestDto has no from-city column, so
            a leg's From is chained from the previous leg's To and held client-side. Editing it
            works all session; a manual From that breaks the chain re-derives on reopen. */}
        {rapidEntry && !foldEnquiry && (
        <div className={`min-w-0 ${mainCol}`}>
          <Panel
            icon={Route} iconTile="bg-yellow-200 text-yellow-900"
            title="Travel Itinerary"
            description="The route, leg by leg — nights are spent at the To city"
            action={tripDurationLabel ? (
              <span className="inline-flex w-fit flex-wrap items-center gap-x-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{tripDurationLabel}</span>
              </span>
            ) : null}
          >
            {/* Same id the Full layout puts on its rows container: save() scrolls here when a stop
                is half filled in, and exactly one of the two layouts is ever mounted. */}
            <div id="itinerary-group">
              <RouteSegments
                rows={routeRows}
                fromCityOptions={routeFromOptions}
                toCityOptions={routeToOptions}
                loadingCities={Boolean(loadingRows[tripRow.id])}
                summary={routeSummary}
                onAdd={onAddRow}
                onRemove={onRemoveRow}
                onUpdate={updateRouteRow}
              />
            </div>
            {/* The rapid chain's confirm button. RouteSegments has no notion of it — it is this
                form's gate, not the booking's — so it rides below the editor rather than inside it,
                and Services stays locked until it is pressed exactly as in Full. */}
            {stepFlow && !itineraryConfirmed && (
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
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

        {/* ── RAPID · Services & Notes ──────────────────────────────────────────────────────────
            CreateBookingClean's last card: violet PackageCheck tile, the chips laid out five across
            with the notes textarea beside them rather than under, and the same 3fr / 2fr split.

            items-start is the fix for oversized chips — without it the grid stretches every cell to
            the tallest one, the textarea, and each chip grows to ~90px. auto-rows-min does the same
            one level down so the chip rows do not stretch either. Both are copied deliberately.

            The CHIPS stay this form's eight services, and the description still says what ticking
            one does here: on a booking a chip is a confirmed inclusion, on an enquiry it opens that
            service's section in the quote below. Same eight labels, same glyphs and hues as the
            booking's picker — what differs is what the tick MEANS, and the card should not claim
            otherwise.

            `notes` moves here in Rapid and is suppressed in Requirements & Assistance (see
            showNotes), so the textarea exists exactly once in the document. */}
        {!servicesLocked && rapidEntry && (
          <div className="min-w-0 lg:col-start-1">
            <Panel
              icon={PackageCheck} iconTile="bg-violet-100 text-violet-700"
              title="Services & Notes"
              description="Tick what to price — each pick opens its section in the quote below"
              action={(
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  {services.length} selected
                </span>
              )}
            >
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div id="services-group">
                  {/* ServiceCard, the same component Full's picker uses — which is also what the
                      booking renders (CreateBookingClean writes the card out inline because its
                      SERVICES are strings and this feature's are objects; the markup is the same
                      card). Rapid briefly had a flat chip here, copied from a version of the
                      booking form that had drifted on develop: it painted the whole card blue on
                      select and swapped the GLYPH for the tick, so a picked strip lost the one
                      signal that says which service each box is. Both screens are back on the
                      coloured-tile card. */}
                  <div className="grid auto-rows-min grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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

                <Field id="notes" label="Trip Notes" optional>
                  <textarea
                    {...register("notes")}
                    id="notes"
                    rows={4}
                    placeholder="Anything else they said — hotel, food, occasion, special requests"
                    className={`${control(false)} resize-y`}
                  />
                </Field>
              </div>
            </Panel>
          </div>
        )}

        {!servicesLocked && !rapidEntry && (
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

        <aside className={railCls}>
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
            icon={UserCheck} iconTile="bg-indigo-100 text-indigo-700"
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
                <div className="relative">
                  <select
                    {...register("leadSource", { required: "Lead source is required" })}
                    id="leadSource"
                    className={`${control(errors.leadSource)} appearance-none pr-9`}
                  >
                    <option value="">{sourcesLoading ? "Loading sources…" : "Select source"}</option>
                    {sourceOptionsFor(leadSourceValue).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
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
                label="Assigned To"
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
              showNotes={!rapidEntry}
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
  /* OLD — `?mode=rapid|full` is retired along with the second mode. It is deliberately just ignored
     rather than redirected: old bookmarks, the quick-action palette and anything that still links
     with the param land on the one form instead of 404ing on a mode that no longer exists.

     There are two modes again (see ENTRY_MODES), so the param is read again — and an old `full`
     link now lands on Rapid, which is the mode that carries the booking's fields. Precedence is
     URL → this session's last choice → quick: an explicit link wins over a habit, and a habit wins
     over the default, so a clerk who works in Rapid all morning is not thrown back to Full on
     every new enquiry. */
  const [entryMode, setEntryMode] = useState(
    () => normalizeMode(searchParams.get("mode")) || readStickyMode() || "full",
  );
  const rapidEntry = entryMode === "rapid";
  const chooseEntryMode = useCallback((mode) => {
    const next = normalizeMode(mode) || "full";
    setEntryMode(next);
    writeStickyMode(next);
  }, []);
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

  /* The accordion used to mount with every section shut, and the agent's first act on the pricing
     block was a click that told it nothing it did not already know.

     The cause is that a service can become ticked WITHOUT going through toggleService: sticky
     carries the previous enquiry's picks into this one, so nothing ever queued a reveal. The
     accordion then rendered with openSection = "" and waited.

     Opened, not revealed — open() sets the section and moves neither the page nor the caret. The
     agent may still be typing in the lead form above when the pricing block appears underneath, and
     stealing the cursor at that moment is precisely the bug that got autoFocus removed from the
     booking form's fast panels.

     Runs once per accordion appearance: the ref latches on the first section it opens and only
     re-arms when the block unmounts (a new enquiry, via resetInlineQuote). */
  const quoteOpenedRef = useRef(false);
  useEffect(() => {
    const first = quoteModel?.enabledCore?.[0];
    if (!first) { quoteOpenedRef.current = false; return; }
    if (quoteOpenedRef.current) return;
    if (pendingQuoteRevealRef.current) return;   // a real reveal is queued; let it win
    quoteOpenedRef.current = true;
    quoteSectionsRef.current?.open(first);
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
          // Drop-off, and where the customer lives — new in V22, so an older lead simply has
          // nulls here and the fields open blank rather than seeding a wrong value.
          dropCity: lead.dropCity ?? "",
          dropCountry: lead.dropCountry ?? "",
          dropMode: lead.dropMode ?? "",
          dropDateTime: String(lead.dropDateTime ?? "").slice(0, 16),
          customerCity: lead.customerCity ?? "",
          customerState: lead.customerState ?? "",
          // Only fall back to the "India" default when the lead genuinely has nothing — a lead
          // saved with a blank country must not silently acquire one on reopen.
          customerCountry: lead.customerCountry ?? "India",
          /* WhatsApp. A null means "same as the phone", which is exactly how it was written — see
             transformFormData — so the tick has to be derived from the absence, not defaulted. */
          whatsappSame: !lead.customerWhatsapp,
          whatsappNumber: lead.customerWhatsapp ?? "",
          // Vehicles come back without the client-side key the rows are tracked by, so it is
          // re-minted here; nothing about it is persisted.
          vehicleRequirements: Array.isArray(lead.vehicleRequirements)
            ? lead.vehicleRequirements.map((row) => ({
                id: nextVehicleRowId++,
                vehicleType: row.vehicleType ?? "",
                vehicleId: row.vehicleId ?? null,
                model: row.model ?? "",
                capacity: row.capacity ?? "",
                quantity: toInt(row.quantity ?? 1, 1),
              }))
            : [],
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
            acType: room.acType || "Any",
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
    /* OLD — apply("departCity", "departure city", customer.city);
       CustomerMatchResponse.city is where the person LIVES. departCity is where the trip starts,
       and this form's own field hint says so in as many words ("Where they live — not where the
       trip starts"), because a Pune customer flying out of Mumbai is the ordinary case. Before V22
       the lead had no residence column, so the departure field was the only box the value could go
       in; it now has one, and this line was still writing a home address into a route.

       It is not merely untidy: "Use this customer" and the ?customerId= seed both run with
       overwrite=true, so clicking it after typing a departure city REPLACED that city with the
       customer's home town. State is written too — the lookup has always returned it (see
       CustomerMatchResponse) and the lead has carried the column since V22; nothing read it.
       This is the same pair CreateBookingClean fills from its own customer search. */
    apply("customerCity", "customer city", customer.city);
    apply("customerState", "state", customer.state);
    /* Country only exists on the FULL customer record (CustomerResponse), not on the lookup probe
       (CustomerMatchResponse) — so this is a no-op on the typing path and fills on the
       ?customerId= arrival, where the whole profile is in hand. `apply` already skips undefined,
       and it skips a value equal to what is there, so the "India" default does not get announced
       as an auto-fill. */
    apply("customerCountry", "country", customer.country);
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
    /* Once a quotation exists, so does its lead — createdQuote.lead IS the saved record. Running
       the create path again writes a SECOND lead for the same customer, with no quotation attached,
       and resetInlineQuote() then discards the priced model.

       Ctrl+Enter has guarded this since the inline quote landed (see the handler below), and the
       Create Quote button guards it too — but both "Save & New" buttons called straight through,
       and "Save & New" is the natural gesture for the next caller the moment a quote is finished.
       So the most likely path to the bug was the one path without the guard.

       Not an error: the agent's intent is "I am done, next caller". The lead is already written, so
       honour it by starting the next enquiry rather than refusing. */
    if (createdQuote && addAnother) {
      startNextEnquiry();
      return;
    }
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
        /* Built from the room MIX the agent filled above, expanded to one row per room.
           This used to pass `loadedRoomAllocationsRef.current` straight through — which meant a NEW
           lead always sent [], because nothing on the form could produce one. The room plan the
           customer gave on the call was simply dropped, and the booking asked for it again.
           An EDITED lead whose mix was never touched still round-trips what it arrived with, so
           reopening and saving an old lead cannot blank a plan this form did not author. */
        roomAllocations: (() => {
          const expanded = roomAllocationsFromMix(data.roomRequirements, {
            adults: adultPayload.totalAdults,
            children: data.children,
            infants: data.infants,
          });
          return expanded.length ? expanded : loadedRoomAllocationsRef.current;
        })(),
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

      /* "Done — continue" was the one control the flow could not finish without and the keyboard
         could not reach. It carries data-skip-enter, has no shortcut of its own, and save() rejects
         EVERY path while itineraryConfirmed is false — so a keyboard-driven agent pressing Ctrl+Enter
         got a toast and a scroll, then had to take their hand off the keyboard to click a button, on
         every single enquiry.

         So Ctrl+Enter advances the chain instead of failing it: confirm, then press again to save.
         Deliberately NOT a new chord — the quotation accordion below owns Alt+0-8, Alt+arrows and
         Esc, and it fires inside this same form, so anything new would collide.

         Only when the itinerary is genuinely shippable. If it is not, the existing guard inside
         save() still runs and still says why. */
      if (stepFlow && !itineraryConfirmed && itineraryConfirmable) {
        confirmItinerary();
        return;
      }

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
          {/* data-skip-enter, and the reason is worth stating: this strip is INJECTED
              ASYNCHRONOUSLY, after the debounced phone probe returns. Without the marker its
              buttons join FOCUSABLE, so the Enter walk's next target changes under the agent's
              fingers between one keystroke and the next — and onFormKeyDown passes Enter through
              on a BUTTON, which activates it. Two of the three buttons below navigate AWAY. A
              half-typed enquiry, with the caller still on the phone, was one stray Enter from
              being gone. They stay fully Tab- and click-reachable. */}
          <button
            type="button"
            data-skip-enter="true"
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
            data-skip-enter="true"
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
          data-skip-enter="true"
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

  /* ── The Customer Details header chip ─────────────────────────────────────────────────────────
     CreateBookingClean's, in the same words and the same corner: a transient "Checking number…"
     while the debounce is in flight, then Existing / New once it lands.

     OLD — this answer was two lines of text UNDER the phone field, inside duplicateStrip:
       ) : checkingContact ? (<p …>Checking existing leads and customers…</p>)
       ) : phoneProbed   ? (<p …>New customer — saving will create a new profile.</p>)
     Same information, but it appeared and vanished directly beneath the field the agent is typing
     into, nudging the rest of the panel as it did. The corner is where the booking puts it and
     where nothing moves.

     What stays in the strip is the two CARDS — the matched customer and the open duplicate lead.
     Those are records with buttons on them, not a status; the chip cannot replace them, and the
     "New customer" case has no card because there is nothing yet to show. */
  const contactStatus = checkingContact ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <LoaderCircle className="h-3 w-3 animate-spin" /> Checking number…
    </span>
  ) : customerMatch ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <Check className="h-3 w-3" /> Existing customer
    </span>
  ) : phoneProbed ? (
    /* The other half of the answer, which this form never gave until now. A match showed a card;
       NO match showed nothing at all, so "we looked and this is someone new" was indistinguishable
       from "we have not looked yet" — and the agent had no way to know whether saving would attach
       to an existing customer or create one. */
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
      <Check className="h-3 w-3" /> New customer
    </span>
  ) : null;

  const duplicateStrip = (customerCard || leadCard) ? (
    <>{customerCard}{leadCard}</>
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
                {editing
                  ? `Edit Lead${leadCode ? ` · ${leadCode}` : ""}`
                  : rapidEntry ? "Rapid" : "Full"}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                {/* The legend has to name what Ctrl+Enter does RIGHT NOW, not what it does
                    eventually. Before the itinerary is confirmed it continues the chain; after it,
                    it prices. A legend that only ever said "create quote" was describing the second
                    press and leaving the agent to discover the first. */}
                <kbd className={kbdCls}>Enter</kbd> next field ·
                <kbd className={`ml-1 ${kbdCls}`}>Ctrl+Enter</kbd>{" "}
                {editing
                  ? "save"
                  : stepFlow && !itineraryConfirmed
                    ? "continue"
                    : "create quote"}
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

                OLD — "The Rapid / Full details segmented control that sat beside it is retired:
                with every full-details field merged into this form there is nothing on the other
                side of it." True while there was one layout. There are two again, and the thing on
                the other side is the BOOKING's card stack rather than a longer version of this
                form — so the control is back, in the same corner, with the modes named for what
                they produce.

                data-skip-enter on both: the Enter walk steps through FIELDS. A layout switch that
                the walk could land on would rearrange the page under a clerk mid-keystroke.

                Rendered in edit too. Both modes read and write the same RHF fields, so this is
                purely how an existing lead is laid out while it is corrected — and an agent who
                works in Rapid should not be thrown into a different form the moment they reopen a
                record they just saved. */}
            <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:flex">
              {[
                { value: "full", label: "Full" },
                { value: "rapid", label: "Rapid" },
              ].map((option) => {
                const active = entryMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-skip-enter="true"
                    aria-pressed={active}
                    onClick={() => chooseEntryMode(option.value)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
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

      <main className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-4">

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
          contactStatus={editing ? null : contactStatus}
          rapidEntry={rapidEntry}
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
