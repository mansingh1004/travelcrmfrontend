import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Accessibility,
  ArrowLeft,
  BadgeIndianRupee,
  BedDouble,
  Bus,
  Camera,
  CarFront,
  Plane,
  Sparkles,
  Route,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  IndianRupee,
  LoaderCircle,
  Mail,
  PackageCheck,
  Phone,
  Store,
  Plus,
  RotateCcw,
  UserCheck,
  Wallet,
} from "lucide-react";

import bookingService from "../api/bookingService";
import FastTravelDetails from "../components/FastTravelDetails";
import TravellerCountFields from "@shared/ui/TravellerCountFields";
import RouteSegments from "../components/RouteSegments";
import { VehicleRequirementRows, RoomRequirementRows } from "../components/RequirementRows";
import {
  emptyRouteRow, emptyRoomRow, emptyVehicleRow, nextRowId,
  tripDuration, totalRouteNights, routeSummary, routeWarnings,
} from "../lib/bookingTripModel";
import { vehicleService } from "@features/masters";
import { customerService } from "@features/customers";
import { leadService, SearchableSelect } from "@features/leads";
import { vendorService } from "@features/vendors";
import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";
import { buildAdultPayload, deriveAdultBreakdown, getAdultBreakdownError } from "@shared/lib/adultBreakdown";
import { useIdempotencyKey } from "@shared/lib/idempotency";
import { useToast } from "@shared/ui/toast";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

/* Sticky fields — see the matching block in CreateLead. A clerk working a batch of bookings keeps
   the same destination, assignee and departure city for a whole run; carrying them into the next
   record is the single biggest saving on a 50-100/day screen. sessionStorage, so it dies with the
   tab and never leaks between staff sharing a machine. */
const STICKY_KEY = "bookingEntry:sticky";
const STICKY_FIELDS = ["destination", "destinationId", "packageType", "assignedUserId", "departCountry", "departCity"];
const readSticky = () => {
  try {
    const raw = sessionStorage.getItem(STICKY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};
const writeSticky = (values) => {
  try {
    const slice = {};
    STICKY_FIELDS.forEach((key) => { if (values[key]) slice[key] = values[key]; });
    sessionStorage.setItem(STICKY_KEY, JSON.stringify(slice));
  } catch { /* private mode — sticky is a convenience, never a requirement */ }
};

/* Advance payment modes. Imported from the payments ledger rather than retyped: BookingPayments
   already owns this vocabulary as PAYMENT_METHODS against the `paymentMethod` field, and a second
   copy here would drift from the list every receipt is actually recorded against. */
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Credit Card", "Debit Card", "Cheque", "Online", "Wallet", "Other"];
/* Five services, in the order they are usually decided: the vehicle and the hotel are settled
   first on most trips, add-ons last.
   Cruise, Visa and Passport were REMOVED from this form — they are rare enough here that they cost
   every booking a second row of chips. Removing them from the picker does NOT remove them from
   existing bookings: `services` is a free array on the payload, an older booking that carries
   "Visa" keeps it, and the toggle below matches case-insensitively so nothing already selected is
   silently dropped on edit. */
const SERVICES = ["Vehicle", "Hotel", "Flight", "Sightseeing", "Add-on"];

/* Glyph and tile per service, matching the picker on Create Lead (CreateLead.jsx:133) so the same
   service is the same colour wherever it is offered — an agent moving between the two screens reads
   the strip by colour before reading the labels. Add-on has no counterpart there and takes the one
   hue the other four leave free. Keyed off the SERVICES strings so that list stays the single place
   the set is decided. */
const SERVICE_TILES = {
  Vehicle: { icon: CarFront, tile: "bg-amber-50 text-amber-700" },
  Hotel: { icon: BedDouble, tile: "bg-emerald-50 text-emerald-600" },
  Flight: { icon: Plane, tile: "bg-blue-50 text-blue-600" },
  Sightseeing: { icon: Camera, tile: "bg-violet-50 text-violet-600" },
  "Add-on": { icon: Sparkles, tile: "bg-rose-50 text-rose-600" },
};

/* Came across with the Special assistance block from FastTravelDetails, unchanged — these strings
   are stored verbatim in tripSnapshot.specialAssistance.types, so editing the list would orphan the
   selections on every booking already saved. */
const ASSISTANCE_TYPES = [
  "Wheelchair Assistance",
  "Senior Citizen Assistance",
  "Special Meal Requirement",
  "Airport Assistance",
];
const PACKAGE_TYPES = ["Family", "Honeymoon", "Group", "Corporate", "Pilgrimage", "Adventure"];

const phonePattern = /^[+\d\s\-()]{7,20}$/;

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* The server's PaymentStatus enum → display. REFUNDED can never come out of a create preview. */
const PAY_STATUS_LABEL = { UNPAID: "Unpaid", PARTIAL: "Partial", PAID: "Paid" };
const PAY_STATUS_TONE = { UNPAID: "text-rose-600", PARTIAL: "text-amber-600", PAID: "text-emerald-600" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const today = () => new Date().toISOString().slice(0, 10);
const unwrap = (response) => response?.data?.data ?? response?.data;

const unwrapList = (response) => {
  const value = response?.data;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.content)) return value.data.content;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value)) return value;
  return [];
};

const destinationIdOf = (destination) =>
  destination?.id ?? destination?.destinationId ?? destination?.publicId ?? "";

const dateInput = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const normalizeDepartureMode = (value) => {
  const key = String(value || "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
  return {
    FLIGHT: "Flight / Airport",
    FLIGHT_AIRPORT: "Flight / Airport",
    TRAIN: "Train / Rail",
    TRAIN_RAIL: "Train / Rail",
    CAR: "Car / Road",
    OWN_CAR: "Car / Road",
    CAR_ROAD: "Car / Road",
    BUS: "Bus",
    OTHER: "Other",
  }[key] || value || "";
};

let itinerarySequence = 2;

const initialForm = () => ({
  customerPhone: "",
  // WhatsApp is a SEPARATE reachable number: the phone on file is often a landline or a spouse's
  // handset. Defaults to mirroring the phone because that is the common case — see whatsappSameAsPhone.
  customerWhatsapp: "",
  whatsappSameAsPhone: true,
  customerName: "",
  customerEmail: "",
  customerCity: "",
  // The customer DTO already carries `state` (see customers/api/customerService.js), so this is a
  // real field rather than a new one. It is NOT derived from the city: the City master has no
  // state/province column today, so nothing can resolve "Pune" to "Maharashtra" yet.
  customerState: "",
  // NO field for this on CustomerRequestDTO (it carries city + state only), so it is held against
  // the booking snapshot rather than invented on the customer payload — see the contract note.
  customerCountry: "",
  birthday: "",
  anniversary: "",
  destinationId: "",
  destination: "",
  // travelDate REMAINS the trip's start and is still what the server stores and reports on. The end
  // date is additive; deriving one from the other would be wrong in both directions.
  travelDate: "",
  tripEndDate: "",
  // NOT a travel date. bookingDate is when the booking was taken — it defaults to today and is what
  // the ledger and the booking list order by. Keeping it separate is deliberate.
  bookingDate: today(),
  packageType: "",
  departCountry: "India",
  departCity: "",
  departureMode: "",
  departureAirport: "",
  airportCode: "",
  preferredFlightTime: "",
  railwayStation: "",
  trainClass: "",
  preferredTrainTime: "",
  pickupAddress: "",
  pickupDateTime: "",
  vehiclePreference: "",

  // ── Pickup / Drop ──────────────────────────────────────────────────────────────────────────
  // Replaces the single "departure" block, which could only describe how the party LEFT. A trip
  // also has to be brought back, and the two ends differ (fly out, drive home).
  //
  // Neither has to sit inside the sold destination, and both may be the SAME city: a Nepal package
  // is routinely picked up and dropped at Gorakhpur. Nothing here validates against `destination`.
  //
  // The legacy departCountry/departCity/departureMode above are kept in state and still written to
  // the payload, so a booking saved by this form is still readable by anything that only knows the
  // old shape.
  pickupCountry: "India",
  pickupCountryId: "",
  pickupCity: "",
  pickupCityId: "",
  pickupMode: "",
  dropCountry: "India",
  dropCountryId: "",
  dropCity: "",
  dropCityId: "",
  dropMode: "",
  dropDateTime: "",

  // What the booking REQUIRES, not what operations later assigns. No registration, vendor, driver
  // or status here — those appear once a requirement is fulfilled and belong to that flow.
  // Vehicles start EMPTY: most bookings need none, and a pre-seeded blank row reads as a
  // requirement someone forgot to fill. Rooms start with one, because a stay always has at least one.
  vehicleRequirements: [],
  roomRequirements: [emptyRoomRow()],

  rooms: "1",
  showAdultBreakdown: false,
  male: null,
  female: null,
  children: "0",
  infants: "0",
  extraBeds: "0",
  totalAdults: "2",
  specialAssistanceRequired: false,
  specialAssistanceTypes: [],
  assistancePassengerCount: "0",
  specialAssistanceNotes: "",
  // Route legs, FROM -> TO, with the nights spent at the TO city. Keeps the `itinerary` key rather
  // than introducing a second one, so the payload shape the server already receives is unchanged in
  // NAME; only the fields inside each row grow (see the payload builder, which still writes the old
  // destination/city/nights alongside the new from/to).
  itinerary: [emptyRouteRow()],
  services: [],
  tripNotes: "",
  customerAmount: "",
  // Supplier the vendorCost is owed to. Empty = none chosen, which also keeps vendorCost disabled.
  vendorPublicId: "",
  vendorCost: "",
  paidAmount: "0",
  // How the advance was taken. Same vocabulary as the payments ledger (see PAYMENT_METHODS).
  paymentMethod: "",
  // Drives TCS when the tenant's policy is overseas-only. NO LONGER EDITABLE on this form — the
  // checkbox was removed with the rest of the TCS controls — but the field stays: it is part of the
  // DTO, edit mode loads whatever a booking was saved with, and the payload still carries it. A new
  // booking therefore declares itself domestic, which is what stops the server adding TCS.
  overseasTourPackage: false,
  // ── Per-booking tax overrides — TRI-STATE, and the null matters ────────────────────────────
  //
  // null = "not decided here, follow the tenant's accounting settings"; true/false = an explicit
  // answer for this booking. They are NOT booleans: a plain false would mean "this booking says no"
  // and would pin an answer onto every booking anyone merely opened, overriding the tenant's own
  // configuration. The UI's third state ("Default") is what writes the null back.
  //
  // gstInclusive additionally changes what `customerAmount` MEANS on the way in — under inclusive
  // it is the gross the customer pays and the server derives the pre-tax base out of it, returning
  // that base as the preview's customerAmount.
  applyGst: null,
  gstInclusive: null,
  /* applyTcs is the ONE exception to the null-means-default rule above, and it is deliberate.
     TCS was removed from this form entirely — no toggle, no overseas checkbox — so there is no
     longer any way for a user to say "not on this one". Left as null it means "follow the tenant
     policy", and where that policy collects TCS the booking quietly picked up a charge nobody on
     this screen asked for or could see: budget 100 + GST 5 came out as a Total Payable of 110.
     false says it outright — this form does not collect TCS — which is the whole point of taking
     the controls away. The tenant's Accounting Settings are untouched and still govern every other
     surface; this is only what THIS form asserts about the bookings it writes. */
  applyTcs: false,
  // ── Agent / agency commission ──────────────────────────────────────────────────────────────
  // What this booking owes whoever brought it. An empty commissionType means no arrangement, which
  // is the ordinary case — the fields stay collapsed until someone says there is one.
  //
  // ⚠ Do NOT also record the same commission as a "Commission" expense row: that category is an
  // INTERNAL cost and already reduces profit, so entering it twice deducts it twice.
  commissionPayeeName: "",
  commissionType: "",
  commissionValue: "",
  commissionStatus: "PENDING",
  commissionPaidOn: "",
  commissionNotes: "",
  assignedUserId: "",
  leadPublicId: "",
  status: "PENDING",
});

/**
 * A three-way segmented control for a nullable boolean.
 *
 * A checkbox cannot express what these fields mean. `null` is not "off" — it is "nobody decided
 * here, follow the tenant's setting" — and collapsing it to false would pin an explicit answer onto
 * every booking anyone merely opened, silently overriding the tenant's own tax configuration.
 * Comparison is by identity so `null` and `false` stay distinct options.
 */
function TriToggle({ label, value, onChange, options, hint }) {
  // null is a real, selectable option ("Default"), so identity comparison is required —
  // a truthiness test would light Default and "No" at the same time.
  const isDefault = value === null || value === undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] font-semibold text-slate-400 underline-offset-2 hover:text-blue-600 hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      <div className="mt-2 flex w-full gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-xs font-bold transition-all ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs font-normal leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}


/* `iconTile` is optional and defaults to the neutral grey every panel already had — a Panel used
   anywhere else keeps the old look without being told to.

   On this form every card passes one. A booking is entered top to bottom in one sitting, and six
   identical grey glyphs gave the eye nothing to scroll back to; a distinct hue per card turns the
   page into landmarks. They stay in the 100-200 band so they read as tinted paper rather than as
   status: none of these mean anything, they only tell the cards apart. Yellow sits a step deeper
   than the rest because at 100 it is indistinguishable from white. */
function Panel({ icon: Icon, title, description, action, iconTile = "bg-slate-100 text-slate-700", children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTile}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({ label, required, optional, error, children }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* A Field shaped like one cell of the Travel Date box: caption above value, both inside the
   border, same padding — which is what makes the three boxes come out the same height without
   any of them being told what that height is. The leading blank line stands in for the label
   Field would have drawn, so the box starts level with Travel Date's. */
function PrimaryBox({ caption, required, optional, error, hint, children }) {
  return (
    <div className="min-w-0">
      <span aria-hidden="true" className="mb-1.5 block text-xs font-semibold">&nbsp;</span>
      <div className={`rounded-lg border bg-white px-3 py-2 ${error ? "border-red-300" : "border-slate-200"}`}>
        <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {caption}
          {required && <span className="ml-0.5 text-red-500">*</span>}
          {optional && <span className="ml-1 font-medium normal-case tracking-normal text-slate-300">(optional)</span>}
        </span>
        <div className="relative">{children}</div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-amber-600">{hint}</p>}
    </div>
  );
}

export default function BookingFormPage() {
  const navigate = useNavigate();
  const { leadId: routeLeadId, id: routeBookingId } = useParams();
  // ?customerId= — set when the clerk started from a customer profile. See the seed effect below.
  const [searchParams] = useSearchParams();
  const editing = Boolean(routeBookingId);
  const { showToast } = useToast();

  // OLD — replaced in create-form redesign
  // const [form, setForm] = useState(initialForm);
  // Seeded blank every time, so a clerk entering a batch retyped destination / assignee /
  // departure city on every single record.
  const [form, setForm] = useState(() => ({ ...initialForm(), ...(editing ? {} : readSticky()) }));
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  const phoneRef = useRef(null);
  // Monotonic ticket for customer lookups — see searchCustomer. Anything that invalidates the
  // number a request was about (an edit, a form reset) bumps it, which voids the reply in flight.
  const searchTicket = useRef(0);

  useEffect(() => { if (!editing) phoneRef.current?.focus(); }, [editing]);
  const [customerMode, setCustomerMode] = useState("idle");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [syncCustomer, setSyncCustomer] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLead, setLoadingLead] = useState(Boolean(routeLeadId));
  const [loadingBooking, setLoadingBooking] = useState(editing);
  /* What the server had when this edit opened. Two things read it, and both are about the
     difference between "the clerk changed this" and "the form is echoing what it loaded":
       • the travel-date rule, which must not treat an untouched past date as a new past booking;
       • the update payload, which must send money only when it actually changed — see handleSubmit. */
  const loadedRef = useRef({ travelDate: "", customerAmount: "", vendorPublicId: "", vendorCost: "", paidAmount: "" });
  const [bookingCode, setBookingCode] = useState("");
  /* POST /bookings rejects a request with no Idempotency-Key (400). One key per form instance,
     held across failed submits so a retry after a timeout replays the original create instead of
     making a second booking; reset only after a save the user considers finished. */
  const { key: idempotencyKey, reset: resetIdempotencyKey } = useIdempotencyKey("bk");
  /* Where a lead-seeded Customer Amount came from, so the field can say so. Without it the clerk
     sees a number they did not type and has no way to tell whether it is the quoted price or a
     leftover — which is exactly when someone "corrects" a correct figure. Holds the seeded amount
     too, so the note disappears the moment they edit it and it stops describing the box. */
  const [amountOrigin, setAmountOrigin] = useState(null);
  const [leads, setLeads] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [destinationError, setDestinationError] = useState("");

  const setField = useCallback((name, value) => {
    setForm((current) => {
      const next = { ...current, [name]: value };
      // Clearing the vendor clears its cost. The input is disabled without a vendor, so a stale
      // amount left behind would be invisible on screen and still be submitted — a supplier cost
      // charged against a booking with no supplier.
      if (name === "vendorPublicId" && !value) next.vendorCost = "";
      return next;
    });
    setErrors((current) => {
      const stale = name === "vendorPublicId" ? ["vendorPublicId", "vendorCost"] : [name];
      if (!stale.some((key) => current[key])) return current;
      const next = { ...current };
      stale.forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  const controlClass = (name, icon = false) => [
    "w-full rounded-lg border bg-white py-2.5 text-sm text-slate-800 outline-none transition",
    icon ? "pl-9 pr-3" : "px-3",
    errors[name]
      ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
  ].join(" ");

  // OLD — replaced in create-form redesign
  // const searchCustomer = useCallback(async (phone, seed = {}) => {
  //   ... returned undefined ...
  //
  // Two things were missing for direct bookings. The lookup could only be driven by hand (Search
  // button / Enter), and it reported nothing back. It now takes { auto } for the debounced lookup
  // below, and returns { mode, customer } — mode being "existing" | "new" | "idle".
  //
  // It has to hand back the matched customer, not just the mode: handleSubmit awaits this and then
  // builds the payload in the same tick, where setSelectedCustomer has not flushed yet. Reading the
  // state there would put `customerPublicId: undefined` on an "existing" booking.
  const searchCustomer = useCallback(async (phone, seed = {}, { auto = false } = {}) => {
    const cleanPhone = String(phone || "").trim();
    if (!phonePattern.test(cleanPhone)) {
      setErrors((current) => ({ ...current, customerPhone: "Enter a valid phone number" }));
      return { mode: "idle", customer: null };
    }

    // Every lookup takes a ticket, and only the newest one is allowed to write. The clerk types on
    // while a request is in flight, and changePhone voids the ticket the moment the number changes,
    // so a reply about the old number cannot land on the new one — the 404 branch in particular
    // writes `customerPhone: cleanPhone` and would otherwise pull the digits back out from under
    // the caret. Dropping the stale reply also leaves the mode at "idle", which is exactly what
    // re-arms the effect below to look up the number the clerk actually ended on.
    const ticket = (searchTicket.current += 1);
    const superseded = () => ticket !== searchTicket.current;

    setSearchingCustomer(true);
    setErrors((current) => {
      const next = { ...current };
      delete next.customerPhone;
      delete next.customer;
      return next;
    });

    try {
      const customer = unwrap(await customerService.searchByPhone(cleanPhone));
      if (superseded()) return { mode: "idle", customer: null };
      setSelectedCustomer(customer);
      setCustomerMode("existing");
      setSyncCustomer(false);
      // OLD — every field was overwritten unconditionally:
      //   customerName: customer?.name || seed.customerName || current.customerName,
      // Correct for the Search button, which is an explicit "load this customer". Wrong for the
      // debounced lookup: the block is unlocked while it is in flight, so a clerk on a slow
      // connection can be several fields deep when the response lands. An auto hit fills blanks
      // only and never overwrites live keystrokes — including the phone still under the caret.
      setForm((current) => {
        const take = (incoming, mine) => (auto && String(mine || "").trim() ? mine : (incoming || mine));
        return {
          ...current,
          customerPhone: take(customer?.phone, cleanPhone),
          customerName: take(customer?.name || seed.customerName, current.customerName),
          customerEmail: take(customer?.email || seed.customerEmail, current.customerEmail),
          customerCity: take(customer?.city || seed.customerCity, current.customerCity),
          birthday: dateInput(take(customer?.birthday || seed.birthday, current.birthday)),
          anniversary: dateInput(take(customer?.anniversary || seed.anniversary, current.anniversary)),
        };
      });
      return { mode: "existing", customer };
    } catch (error) {
      if (superseded()) return { mode: "idle", customer: null };
      if (error?.response?.status === 404) {
        setSelectedCustomer(null);
        setCustomerMode("new");
        setSyncCustomer(false);
        setForm((current) => ({
          ...current,
          customerPhone: cleanPhone,
          customerName: seed.customerName || current.customerName,
          customerEmail: seed.customerEmail || current.customerEmail,
          customerCity: seed.customerCity || current.customerCity,
          birthday: dateInput(seed.birthday || current.birthday),
          anniversary: dateInput(seed.anniversary || current.anniversary),
        }));
        return { mode: "new", customer: null };
      }
      // Toasts even on the auto path: a failed lookup means the duplicate check did NOT happen, and
      // the clerk is about to type a customer that may already exist. Silence here creates the
      // duplicate. Staying in "idle" is what keeps submit from guessing — see handleSubmit.
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Could not search for this customer."), "error");
      }
      setCustomerMode("idle");
      return { mode: "idle", customer: null };
    } finally {
      setSearchingCustomer(false);
    }
  }, [showToast]);

  /* Debounced auto-lookup — the reason the Search button existed at all.
     On the lead path applyLead calls searchCustomer for you, so the customer block came alive on
     its own. A direct booking has no lead and therefore no phone to resolve, so the form sat in
     "idle" with every customer field disabled until someone found the Search button. Now typing a
     valid number is enough: this resolves it in the background and the block is already unlocked
     (see customerFieldsLocked) so the clerk can keep filling the form straight through.
     The ref keeps one number to one lookup — without it the error path re-fires forever, because a
     failure leaves the mode in "idle", which is exactly the condition that triggers this. */
  const autoSearchedPhone = useRef("");
  useEffect(() => {
    if (editing) return undefined;
    const phone = String(form.customerPhone || "").trim();
    if (!phonePattern.test(phone)) return undefined;
    if (customerMode !== "idle") return undefined;      // already resolved for this number
    if (autoSearchedPhone.current === phone) return undefined;
    if (loadingLead || searchingCustomer) return undefined;

    const timer = setTimeout(() => {
      autoSearchedPhone.current = phone;
      searchCustomer(phone, {}, { auto: true });
    }, 500);
    return () => clearTimeout(timer);
  }, [editing, form.customerPhone, customerMode, loadingLead, searchingCustomer, searchCustomer]);

  const applyLead = useCallback((lead) => {
    if (!lead) return;

    // getLeadById populates latestQuotation (LeadServiceImpl:482), so this is present on the
    // lead-detail read this page uses — not just on the list.
    const quotedTotal = lead.latestQuotation?.grandTotal;
    setAmountOrigin(
      quotedTotal != null
        ? { amount: String(quotedTotal), version: lead.latestQuotation?.version || null }
        : null
    );

    const firstLeg = Array.isArray(lead.itinerary) ? lead.itinerary[0] : null;
    const destinationName = typeof firstLeg?.destination === "string"
      ? firstLeg.destination
      : firstLeg?.destination?.name || lead.destination || "";
    const seed = {
      customerName: lead.customerName || lead.customer?.name || "",
      customerEmail: lead.email || lead.customer?.email || "",
      customerCity: lead.departCity || lead.customer?.city || "",
      birthday: lead.birthDate || lead.birthday || "",
      anniversary: lead.anniversaryDate || lead.anniversary || "",
    };
    const adultPrefill = deriveAdultBreakdown({
      totalAdults: lead.totalAdults ?? lead.adults ?? lead.adultCount,
      male: lead.male ?? lead.maleCount,
      female: lead.female ?? lead.femaleCount,
    });
    /* A lead's itinerary is a LIST OF STAYS (destination + city + nights), not a route: it says
       where the party wants to go, never how they move between stops. Each stay therefore becomes
       the TO city of a leg, and the FROM is chained from the previous stay — which reconstructs
       the obvious route without inventing any city the lead did not name. The first leg's FROM is
       left for the pickup sync below to fill. */
    const leadStays = Array.isArray(lead.itinerary) && lead.itinerary.length
      ? lead.itinerary.map((item) => ({
          cityId: item.cityId || item.city?.id || item.city?.publicId || "",
          city: typeof item.city === "string"
            ? item.city
            : item.city?.name
              || (typeof item.destination === "string" ? item.destination : item.destination?.name)
              || "",
          nights: String(item.nights ?? 0),
        }))
      : null;

    const itinerary = leadStays
      ? leadStays.map((stay, index) => ({
          id: itinerarySequence++,
          fromCityId: index === 0 ? "" : leadStays[index - 1].cityId,
          fromCity: index === 0 ? "" : leadStays[index - 1].city,
          toCityId: stay.cityId,
          toCity: stay.city,
          nights: stay.nights,
        }))
      : null;

    setForm((current) => ({
      ...current,
      ...seed,
      customerPhone: lead.phone || lead.customer?.phone || "",
      leadPublicId: lead.publicId || lead.id || "",
      destinationId: firstLeg?.destinationId || firstLeg?.destination?.id || lead.destinationId || current.destinationId,
      destination: destinationName || current.destination,
      travelDate: dateInput(lead.travelDate) || current.travelDate,
      packageType: lead.packageType || lead.tripType || current.packageType,
      departCountry: lead.departCountry || lead.departureCountry || current.departCountry,
      departCity: lead.departCity || lead.departureCity || current.departCity,
      departureMode: normalizeDepartureMode(lead.departureMode || lead.transportMode) || current.departureMode,
      /* A lead has no pickup/drop concept — it records where the traveller DEPARTS FROM, which is
         exactly this booking's pickup. Mapped across so a lead-created booking arrives with its
         pickup filled rather than blank. Drop is left empty: the lead never carried a return, and
         defaulting it to the pickup would invent a round trip nobody stated. */
      pickupCountry: lead.departCountry || lead.departureCountry || current.pickupCountry,
      pickupCity: lead.departCity || lead.departureCity || current.pickupCity,
      pickupMode: normalizeDepartureMode(lead.departureMode || lead.transportMode) || current.pickupMode,
      departureAirport: lead.departureAirport || lead.airportName || current.departureAirport,
      airportCode: lead.airportCode || lead.departureAirportCode || current.airportCode,
      preferredFlightTime: String(lead.preferredFlightTime || lead.flightTime || current.preferredFlightTime).slice(0, 5),
      railwayStation: lead.railwayStation || lead.departureStation || current.railwayStation,
      trainClass: lead.trainClass || lead.railClass || current.trainClass,
      preferredTrainTime: String(lead.preferredTrainTime || lead.trainTime || current.preferredTrainTime).slice(0, 5),
      pickupAddress: lead.pickupAddress || lead.roadPickupAddress || current.pickupAddress,
      pickupDateTime: String(lead.pickupDateTime || lead.pickupAt || current.pickupDateTime).slice(0, 16),
      vehiclePreference: lead.vehiclePreference || lead.preferredVehicle || current.vehiclePreference,
      rooms: String(lead.rooms ?? current.rooms),
      showAdultBreakdown: adultPrefill.showAdultBreakdown,
      male: adultPrefill.male == null ? null : String(adultPrefill.male),
      female: adultPrefill.female == null ? null : String(adultPrefill.female),
      totalAdults: String(adultPrefill.totalAdults),
      children: String(lead.children ?? current.children),
      infants: String(lead.infants ?? current.infants),
      extraBeds: String(lead.extraBeds ?? current.extraBeds),
      specialAssistanceRequired: Boolean(lead.specialAssistanceRequired ?? lead.needsSpecialAssistance),
      specialAssistanceTypes: Array.isArray(lead.specialAssistanceTypes) ? lead.specialAssistanceTypes : current.specialAssistanceTypes,
      assistancePassengerCount: String(lead.assistancePassengerCount ?? current.assistancePassengerCount),
      specialAssistanceNotes: lead.specialAssistanceNotes || lead.assistanceNotes || current.specialAssistanceNotes,
      itinerary: itinerary || current.itinerary,
      tripNotes: lead.notes || current.tripNotes,
      /* Seeded from the LATEST QUOTATION, with budget only as a fallback.
         Budget is what the customer said they might spend at enquiry time; the quotation's grand
         total is what was actually put to them in writing, and it is the figure the booking should
         be for. The convert-to-booking modal has carried the quotation all along (its placeholder
         literally reads "Carried from quotation") — this path was the one still seeding budget, so
         the same lead produced two different amounts depending on which button the agent pressed.
         A lead that was never quoted still falls back to budget, which beats an empty box. */
      customerAmount:
        quotedTotal != null ? String(quotedTotal)
          : lead.budget != null ? String(lead.budget)
            : current.customerAmount,
      services: Array.isArray(lead.services)
        ? lead.services.map((item) => typeof item === "string" ? item : item.serviceType || item.name).filter(Boolean)
        : current.services,
      assignedUserId: lead.assignedUserId || lead.assignedUser?.publicId || lead.assignedUser?.id || current.assignedUserId,
    }));

    const phone = lead.phone || lead.customer?.phone;
    if (phone) searchCustomer(phone, seed);
  }, [searchCustomer]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      leadService.getAllLeads(0, 200),
      bookingService.getEligibleAssignees(),
      geographyService.getAllDestinations(),
      vendorService.getAll(),
    ]).then(([leadResult, assigneeResult, destinationResult, vendorResult]) => {
      if (!active) return;
      if (leadResult.status === "fulfilled") setLeads(unwrapList(leadResult.value));
      if (assigneeResult.status === "fulfilled") {
        const list = unwrap(assigneeResult.value);
        setAssignees(Array.isArray(list) ? list : []);
      }
      // Vendors gate the Vendor Cost field. A failure here leaves the list empty and the cost
      // disabled — which is the correct degraded state, not a broken one: no vendor could be chosen,
      // so no vendor cost should be attributable. The spend still goes in through the expense ledger.
      if (vendorResult.status === "fulfilled") {
        const list = unwrap(vendorResult.value);
        setVendors(
          (Array.isArray(list) ? list : []).filter((v) => v?.publicId && v?.vendorName)
        );
      }
      setLoadingVendors(false);
      if (destinationResult.status === "fulfilled") {
        const list = destinationResult.value;
        setDestinations(Array.isArray(list) ? list : []);
      } else {
        setDestinationError(getErrorMessage(destinationResult.reason, "Could not load destinations."));
      }
      setLoadingDestinations(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;

    const loadBooking = async () => {
      try {
        const booking = unwrap(await bookingService.getById(routeBookingId)) || {};
        let customer = null;
        if (booking.customerId) {
          try { customer = unwrap(await customerService.getById(booking.customerId)); }
          catch { customer = null; }
        }
        if (!active) return;

        const snapshot = booking.tripSnapshot || {};
        const departure = snapshot.departure || {};
        const travellers = snapshot.travellers || {};
        const assistance = snapshot.specialAssistance || {};
        /* Pickup falls back to the legacy `departure` block, so a booking saved before this
           redesign opens with its pickup populated instead of three blank fields. Drop has no
           legacy equivalent — it simply did not exist — so it starts empty rather than guessing. */
        const pickup = snapshot.pickup || {};
        const drop = snapshot.drop || {};
        const adultPrefill = deriveAdultBreakdown({
          totalAdults: travellers.totalAdults,
          male: travellers.male,
          female: travellers.female,
        });
        /* Route rows, tolerant of both shapes.
           A row saved by this form has fromCity/toCity. A LEGACY row has only destination/city —
           its `city` was the place stayed in, which is this model's TO city, so it maps there and
           the FROM is left for the clerk. That keeps every old booking readable and editable
           rather than silently emptying its itinerary. */
        const itinerary = Array.isArray(snapshot.itinerary) && snapshot.itinerary.length > 0
          ? snapshot.itinerary.map((item) => ({
              id: itinerarySequence++,
              fromCityId: item.fromCityId || "",
              fromCity: item.fromCity || "",
              toCityId: item.toCityId || "",
              toCity: item.toCity || item.city || item.destination || "",
              nights: String(item.nights ?? 0),
            }))
          : [emptyRouteRow()];

        loadedRef.current = {
          travelDate: dateInput(booking.travelDate),
          customerAmount: booking.customerAmount == null ? "" : String(booking.customerAmount),
          vendorPublicId: booking.vendorPublicId || "",
          vendorCost: booking.vendorCost == null ? "" : String(booking.vendorCost),
          paidAmount: booking.paidAmount == null ? "0" : String(booking.paidAmount),
          // Only the TYPE is needed here, and only to answer one question on save: did this booking
          // have a commission that the form no longer does? That is the case clearCommission exists
          // for, and a null on the wire cannot express it.
          commissionType: booking.commissionType || "",
        };
        setBookingCode(booking.bookingCode || "");
        setSelectedCustomer(customer || {
          id: booking.customerId,
          publicId: booking.customerId,
          name: booking.customerNameSnapshot || "Customer",
        });
        setCustomerMode("existing");
        setSyncCustomer(false);
        setForm({
          ...initialForm(),
          customerPhone: customer?.phone || customer?.mobile || "",
          customerName: booking.customerNameSnapshot || customer?.name || "",
          customerEmail: customer?.email || "",
          customerCity: customer?.city || customer?.address?.city || "",
          customerState: customer?.state || customer?.address?.state || "",
          customerCountry: snapshot.customerCountry || customer?.country || "",
          // A saved WhatsApp number is by definition a deliberate one, so the mirror starts OFF and
          // the stored value is shown as-is. With no stored number the mirror stays on, which is
          // also right: an older booking never captured one.
          customerWhatsapp: snapshot.customerWhatsapp || "",
          whatsappSameAsPhone: !snapshot.customerWhatsapp,
          birthday: dateInput(customer?.birthday || customer?.birthDate),
          anniversary: dateInput(customer?.anniversary || customer?.anniversaryDate),
          destinationId: booking.destinationId || "",
          destination: booking.destinationSnapshot || "",
          travelDate: dateInput(booking.travelDate),
          tripEndDate: dateInput(snapshot.tripEndDate),
          bookingDate: dateInput(booking.bookingDate),
          packageType: snapshot.packageType || "",
          // Pickup falls back to the legacy departure block; drop has no legacy source.
          pickupCountry: pickup.country || departure.country || "India",
          pickupCountryId: pickup.countryId || "",
          pickupCity: pickup.city || departure.city || "",
          pickupCityId: pickup.cityId || "",
          pickupMode: normalizeDepartureMode(pickup.mode || departure.mode),
          dropCountry: drop.country || "India",
          dropCountryId: drop.countryId || "",
          dropCity: drop.city || "",
          dropCityId: drop.cityId || "",
          dropMode: normalizeDepartureMode(drop.mode),
          dropDateTime: String(drop.dateTime || "").slice(0, 16),
          vehicleRequirements: (Array.isArray(snapshot.vehicleRequirements) ? snapshot.vehicleRequirements : [])
            .map((row) => ({
              id: nextRowId(),
              vehicleType: row.vehicleType || "",
              vehicleId: row.vehicleId || "",
              model: row.model || "",
              capacity: row.capacity == null ? "" : String(row.capacity),
              quantity: String(row.quantity ?? 1),
            })),
          // An older booking has no room rows — fall back to one row carrying the flat counts it
          // did store, so its rooms/extraBeds are not lost on the way into the new editor.
          roomRequirements: Array.isArray(snapshot.roomRequirements) && snapshot.roomRequirements.length > 0
            ? snapshot.roomRequirements.map((row) => ({
                id: nextRowId(),
                roomType: row.roomType || "Double",
                acType: row.acType || "Any",
                count: String(row.count ?? 1),
                extraBeds: String(row.extraBeds ?? 0),
              }))
            : [{
                id: nextRowId(), roomType: "Double", acType: "Any",
                count: String(travellers.rooms ?? 1), extraBeds: String(travellers.extraBeds ?? 0),
              }],
          departCountry: departure.country || "India",
          departCity: departure.city || "",
          departureMode: normalizeDepartureMode(departure.mode),
          departureAirport: departure.airport || "",
          airportCode: departure.airportCode || "",
          preferredFlightTime: String(departure.preferredTime || "").slice(0, 5),
          railwayStation: departure.railwayStation || "",
          trainClass: departure.trainClass || "",
          preferredTrainTime: String(departure.preferredTime || "").slice(0, 5),
          pickupAddress: departure.pickupAddress || "",
          pickupDateTime: String(departure.pickupDateTime || "").slice(0, 16),
          vehiclePreference: departure.vehiclePreference || "",
          rooms: String(travellers.rooms ?? 1),
          showAdultBreakdown: adultPrefill.showAdultBreakdown,
          male: adultPrefill.male == null ? null : String(adultPrefill.male),
          female: adultPrefill.female == null ? null : String(adultPrefill.female),
          totalAdults: String(adultPrefill.totalAdults),
          children: String(travellers.children ?? 0),
          infants: String(travellers.infants ?? 0),
          extraBeds: String(travellers.extraBeds ?? 0),
          specialAssistanceRequired: Boolean(assistance.required),
          specialAssistanceTypes: Array.isArray(assistance.types) ? assistance.types : [],
          assistancePassengerCount: String(assistance.passengerCount ?? 0),
          specialAssistanceNotes: assistance.notes || "",
          itinerary,
          services: Array.isArray(booking.services) ? booking.services : [],
          tripNotes: snapshot.notes || "",
          customerAmount: booking.customerAmount == null ? "" : String(booking.customerAmount),
          vendorPublicId: booking.vendorPublicId || "",
          vendorCost: booking.vendorCost == null ? "" : String(booking.vendorCost),
          paidAmount: booking.paidAmount == null ? "0" : String(booking.paidAmount),
          overseasTourPackage: Boolean(booking.overseasTourPackage),
          // Kept TRI-STATE on load: `?? null` preserves "inheriting the tenant setting", which
          // Boolean() would flatten to false. Flattening here would mean that merely opening and
          // saving a booking pins today's tenant default onto it forever — the same class of bug
          // LEAD_SOURCES has on the lead form.
          applyGst: booking.applyGst ?? null,
          gstInclusive: booking.gstInclusive ?? null,
          /* applyTcs takes `?? false`, not `?? null`, for the reason set out in the defaults above.
             The distinction still matters though: an EXPLICIT true was a real decision somebody
             made about a real booking, and it survives being opened here — only the null case,
             which means "nobody ever decided", picks up this form's stance of not collecting TCS.
             So an old booking saved as overseas keeps its TCS (and, since there is no TCS row any
             more, keeps it silently inside Total Payable); one that was merely inheriting the
             tenant policy stops doing so. */
          applyTcs: booking.applyTcs ?? false,
          commissionPayeeName: booking.commissionPayeeName || "",
          commissionType: booking.commissionType || "",
          // The agreed TERMS, not the computed rupees — a percent commission must load back as the
          // percent, or opening and saving a booking would freeze today's amount as a flat fee.
          commissionValue: booking.commissionValue == null ? "" : String(booking.commissionValue),
          commissionStatus: booking.commissionStatus || "PENDING",
          commissionPaidOn: booking.commissionPaidOn || "",
          commissionNotes: booking.commissionNotes || "",
          assignedUserId: booking.assignedUserId || "",
          leadPublicId: booking.sourceLeadPublicId || booking.leadId || "",
          status: booking.status || "PENDING",
        });
      } catch (error) {
        if (active && !isAlreadyReported(error)) {
          showToast(getErrorMessage(error, "Could not load the booking."), "error");
        }
      } finally {
        if (active) setLoadingBooking(false);
      }
    };

    loadBooking();
    return () => { active = false; };
  }, [editing, routeBookingId, showToast]);

  useEffect(() => {
    if (editing || !routeLeadId) return undefined;
    let active = true;
    leadService.getLeadById(routeLeadId)
      .then((response) => { if (active) applyLead(unwrap(response)); })
      .catch((error) => {
        if (active && !isAlreadyReported(error)) {
          showToast(getErrorMessage(error, "Could not load the selected lead."), "error");
        }
      })
      .finally(() => { if (active) setLoadingLead(false); });
    return () => { active = false; };
  }, [applyLead, editing, routeLeadId, showToast]);

  /* ── Arrived from a customer profile: /CreateBooking?customerId=<publicId> ──────────────────
     The profile's "New booking" buttons used to land here on an empty form, so the clerk retyped
     the phone number of the customer they were looking at and waited for the lookup to find them
     again.

     Skipped when a lead is in the route: a lead conversion already carries its own customer, and
     letting both seed the form would make which one wins depend on which request returned first.

     Sets customerMode to "existing" directly rather than routing through searchCustomer, because
     we have the customer by publicId — going back through a phone search would be a second
     round-trip that can only find the same row, or fail on a formatting difference. */
  useEffect(() => {
    if (editing || routeLeadId) return undefined;
    const customerPublicId = searchParams.get("customerId");
    if (!customerPublicId) return undefined;

    let active = true;
    customerService.getById(customerPublicId)
      .then((response) => {
        if (!active) return;
        const customer = unwrap(response);
        if (!customer) return;

        setSelectedCustomer(customer);
        setCustomerMode("existing");
        setSyncCustomer(false);
        setForm((current) => ({
          ...current,
          customerPhone: customer.phone || current.customerPhone,
          customerName: customer.name || current.customerName,
          customerEmail: customer.email || current.customerEmail,
          customerCity: customer.city || current.customerCity,
          birthday: dateInput(customer.birthday || current.birthday),
          anniversary: dateInput(customer.anniversary || current.anniversary),
        }));
      })
      // Silent, like the lead-seed path's sibling cases: a stale deep link must leave a usable
      // blank form rather than an error to dismiss before typing.
      .catch(() => {});

    return () => { active = false; };
  }, [editing, routeLeadId, searchParams]);

  const handleLeadChange = async (leadPublicId) => {
    setField("leadPublicId", leadPublicId);
    if (!leadPublicId) return;
    setLoadingLead(true);
    try {
      applyLead(unwrap(await leadService.getLeadById(leadPublicId)));
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not load the selected lead."), "error");
    } finally {
      setLoadingLead(false);
    }
  };

  const changePhone = (value) => {
    setField("customerPhone", value);
    // Re-arm the auto-lookup and void any reply still in flight. Editing the number means the
    // resolved customer no longer describes what is in the box — including when the edit lands
    // back on a number that was already looked up once.
    autoSearchedPhone.current = "";
    searchTicket.current += 1;
    if (customerMode !== "idle") {
      setCustomerMode("idle");
      setSelectedCustomer(null);
      setSyncCustomer(false);
    }
  };

  // OLD — replaced in create-form redesign
  // const toggleService = (service) => {
  //   setForm((current) => ({
  //     ...current,
  //     services: current.services.includes(service)
  //       ? current.services.filter((item) => item !== service)
  //       : [...current.services, service],
  //   }));
  // };
  // Case-insensitive, matching the chip's selected check — otherwise clicking a lead-prefilled
  // "hotel" chip appended "Hotel" instead of removing it, and the payload carried both.
  const toggleService = (service) => {
    setForm((current) => {
      const has = current.services.some((item) => String(item).toLowerCase() === service.toLowerCase());
      return {
        ...current,
        services: has
          ? current.services.filter((item) => String(item).toLowerCase() !== service.toLowerCase())
          : [...current.services, service],
      };
    });
  };

  /* WhatsApp mirrors the phone while the box is ticked — including every later edit to the phone,
     which is the whole point: a number corrected after the fact must not leave a stale WhatsApp
     behind. Unticking stops the mirror and keeps whatever was last shown as the starting value, so
     the clerk edits a number rather than an empty field. */
  const whatsappNumber = form.whatsappSameAsPhone ? form.customerPhone : form.customerWhatsapp;

  const setWhatsappSameAsPhone = (checked) =>
    setForm((current) => ({
      ...current,
      whatsappSameAsPhone: checked,
      customerWhatsapp: checked ? "" : (current.customerWhatsapp || current.customerPhone),
    }));

  /* Travel period → "5 Nights / 6 Days", and the night count the route is measured against.
     Recomputed from the two dates rather than stored, so the two can never disagree. */
  const duration = useMemo(
    () => tripDuration(form.travelDate, form.tripEndDate),
    [form.travelDate, form.tripEndDate]
  );

  /* Room rows rolled back up into the two flat counters the rest of the app still reads. Without
     this, moving the UI to a room MIX would have silently zeroed "rooms" everywhere it is shown. */
  const roomTotals = useMemo(() => ({
    rooms: form.roomRequirements.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    extraBeds: form.roomRequirements.reduce((sum, row) => sum + (Number(row.extraBeds) || 0), 0),
  }), [form.roomRequirements]);

  /* Came across with the Travellers block from FastTravelDetails, unchanged.
     Opening the breakdown SEEDS male/female to "0" so the two boxes render as numbers rather than
     blanks; closing it writes null, which is what marks "no gender split recorded" as distinct from
     a recorded 0. getAdultBreakdownError relies on that distinction. */
  const toggleAdultBreakdown = (checked) => {
    setField("showAdultBreakdown", checked);
    setField("male", checked ? String(Number(form.male) || 0) : null);
    setField("female", checked ? String(Number(form.female) || 0) : null);
  };

  /* No traveller badge came across with the block. Travel Details needed one because travellers
     were buried among six other bands; here the block leads with its own "Total Travellers" tile,
     so a pill in the panel header would be the same number twice — and that header slot is already
     saying something that changes (Checking number… / Existing customer / New customer). */

  /* Came across with Special assistance. Toggling a chip off removes it rather than storing a
     false — the payload carries the list of what IS required, not a map of every option. */
  const toggleAssistanceType = (type) => {
    const selected = form.specialAssistanceTypes.includes(type);
    setField(
      "specialAssistanceTypes",
      selected
        ? form.specialAssistanceTypes.filter((item) => item !== type)
        : [...form.specialAssistanceTypes, type]
    );
  };

  // Caps the assistance passenger count — the party cannot have more people needing help than it has.
  const totalTravellers =
    (Number(form.totalAdults) || 0) + (Number(form.children) || 0) + (Number(form.infants) || 0);

  /* Counts for the two bands' own headings — the same at-a-glance summary Travel Details carries
     for travellers, but one per band rather than one for the card.

     They were a single joined pill in the card header. Two figures under one label made the reader
     work out which number belonged to which band, and the zero rule below could only be applied to
     the pair: vehicle rows start empty, and "0 vehicles · 2 rooms" reports an absence as if it were
     an answer. Split, each band answers for itself — an empty vehicle list hides its own count and
     leaves the room count standing. The rule itself is unchanged: a pill reading "0" is worse than
     no pill, so a count of zero renders nothing at all. */
  const vehicleCount = useMemo(
    () => form.vehicleRequirements.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    [form.vehicleRequirements]
  );
  const roomCount = roomTotals.rooms;

  const routeNights = useMemo(() => totalRouteNights(form.itinerary), [form.itinerary]);
  const tripRouteSummary = useMemo(() => routeSummary(form.itinerary), [form.itinerary]);

  /* WARNINGS, not errors. A route mid-edit routinely does not add up, and this form's convention
     is to block only on what the server will reject. */
  const tripRouteWarnings = useMemo(
    () => routeWarnings({
      rows: form.itinerary,
      tripNights: duration && !duration.invalid ? duration.nights : null,
      pickupCity: form.pickupCity,
      dropCity: form.dropCity,
    }),
    [form.itinerary, duration, form.pickupCity, form.dropCity]
  );

  /* Cities OF THE CHOSEN DESTINATION — the route's own vocabulary.
     Scoped rather than the whole master: a Nepal booking's legs are Nepali cities, and offering
     every city the tenant has ever entered turns the leg picker into a haystack. Refetched when
     the destination changes. */
  const [destinationCities, setDestinationCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  useEffect(() => {
    if (!form.destinationId) { setDestinationCities([]); return undefined; }
    let active = true;
    setLoadingCities(true);
    geographyService
      .getCitiesByDestination(form.destinationId)
      .then((list) => { if (active) setDestinationCities(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setDestinationCities([]); })
      .finally(() => { if (active) setLoadingCities(false); });
    return () => { active = false; };
  }, [form.destinationId]);

  /* ── The route's city options: destination cities + whatever Pickup/Drop say ─────────────────
     Pickup and Drop are free text precisely because they are often OUTSIDE the destination — a
     Nepal package boarding at Gorakhpur. Merging those two typed values in is what lets such a
     city be chosen as a leg without opening the picker up to the entire master.

     They carry no master id, so they are keyed `name:<city>`; RouteSegments stores that as a name
     with an empty id, which the payload already tolerates (ids have always been optional there).
     De-duplicated case-insensitively, so typing a city that IS in the destination list does not
     produce two identical options. */
  const buildCityOptions = useCallback((extraCity, extraLabel) => {
    const options = destinationCities.map((city) => ({
      value: String(city.id),
      label: city.name,
    }));
    const seen = new Set(destinationCities.map((city) => String(city.name || "").trim().toLowerCase()));

    const name = String(extraCity || "").trim();
    if (name && !seen.has(name.toLowerCase())) {
      // Prepended, not appended: it is the likeliest answer for this end of the journey, so it
      // should be the first thing in the list rather than something to scroll past.
      options.unshift({ value: `name:${name}`, label: `${name} — ${extraLabel}` });
    }
    return options;
  }, [destinationCities]);

  /* FROM gets the destination's cities plus the PICKUP city; TO gets them plus the DROP city.
     Split rather than merging both into both, because the two ends are not interchangeable: you
     depart from the pickup and arrive at the drop, and offering "Gorakhpur — drop" as a From on
     leg 1 is an answer that is never right. */
  const fromCityOptions = useMemo(
    () => buildCityOptions(form.pickupCity, "pickup"),
    [buildCityOptions, form.pickupCity]
  );
  const toCityOptions = useMemo(
    () => buildCityOptions(form.dropCity, "drop"),
    [buildCityOptions, form.dropCity]
  );

  /* Vehicle master, for the requirement rows' model/capacity picker. Failure is silent: the type
     and quantity are still usable without it, and a toast on page load for an optional lookup is
     noise. */
  const [vehicleMaster, setVehicleMaster] = useState([]);
  const [loadingVehicleMaster, setLoadingVehicleMaster] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.resolve(vehicleService.getAllVehicles?.())
      .then((res) => {
        if (!active) return;
        const list = res?.data?.data ?? res?.data ?? [];
        setVehicleMaster(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (active) setVehicleMaster([]); })
      .finally(() => { if (active) setLoadingVehicleMaster(false); });
    return () => { active = false; };
  }, []);

  /* ── Pickup → first leg's FROM, Drop → last leg's TO ─────────────────────────────────────────
     The three are one journey, so the route should not ask again for a city the clerk already
     named. What makes this safe rather than destructive is WHEN it writes:

       • only into an EMPTY cell, or one still holding the PREVIOUS pickup/drop value — i.e. a cell
         the clerk has not touched. A city they typed themselves is never overwritten;
       • the previous value is tracked in a ref, so "still matches the old pickup" can be told
         apart from "happens to equal it by coincidence".

     Anything it declines to change surfaces through routeWarnings ("Route starts at X but pickup
     is Y") — a visible mismatch the clerk resolves, rather than a silent correction. */
  const lastSynced = useRef({ pickupCityId: "", pickupCity: "", dropCityId: "", dropCity: "" });

  useEffect(() => {
    const previous = lastSynced.current;
    lastSynced.current = {
      pickupCityId: form.pickupCityId, pickupCity: form.pickupCity,
      dropCityId: form.dropCityId, dropCity: form.dropCity,
    };
    if (!form.pickupCity && !form.dropCity) return;

    setForm((current) => {
      const rows = current.itinerary;
      if (!rows.length) return current;

      const untouched = (row, side, prevId, prevName) =>
        (!row[`${side}CityId`] && !row[`${side}City`])
        || (prevId && row[`${side}CityId`] === prevId)
        || (!prevId && prevName && row[`${side}City`] === prevName);

      let changed = false;
      const next = rows.slice();

      if (form.pickupCity && untouched(next[0], "from", previous.pickupCityId, previous.pickupCity)) {
        if (next[0].fromCityId !== form.pickupCityId || next[0].fromCity !== form.pickupCity) {
          next[0] = { ...next[0], fromCityId: form.pickupCityId, fromCity: form.pickupCity };
          changed = true;
        }
      }

      const lastIndex = next.length - 1;
      if (form.dropCity && untouched(next[lastIndex], "to", previous.dropCityId, previous.dropCity)) {
        if (next[lastIndex].toCityId !== form.dropCityId || next[lastIndex].toCity !== form.dropCity) {
          // 0 nights with it: arriving at the drop is the journey home, not a stay. Only applied
          // where this sync is already allowed to write — a leg the agent has filled in keeps both
          // its city and its nights.
          next[lastIndex] = {
            ...next[lastIndex], toCityId: form.dropCityId, toCity: form.dropCity, nights: "0",
          };
          changed = true;
        }
      }

      return changed ? { ...current, itinerary: next } : current;
    });
    // Deliberately keyed on the pickup/drop city ONLY. Adding `form.itinerary` would re-run this on
    // every keystroke in the route and fight the clerk for the cell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pickupCityId, form.pickupCity, form.dropCityId, form.dropCity]);

  /* A new leg CHAINS off the last one: its FROM is seeded with the previous leg's TO, because
     retyping the city you just arrived in is pure friction. Seeding happens once, at insert —
     editing an existing row never rewrites its neighbours, so a deliberate manual correction
     cannot be silently undone. Any resulting gap surfaces as a warning instead. */
  const addItineraryRow = () => setForm((current) => {
    const last = current.itinerary[current.itinerary.length - 1];
    return {
      ...current,
      itinerary: [...current.itinerary, emptyRouteRow(last?.toCity || "", last?.toCityId || "")],
    };
  });

  /* Choosing a TO on the LAST leg opens the next one automatically.
     A trip is entered as a chain — arrive somewhere, then say where you go next — and making the
     clerk reach for "Add stop" between every pair is the friction this removes.

     It stops on its own: the new leg only appears when the chosen city is NOT the drop city, so
     naming the drop closes the route instead of adding an empty row after it. With no drop city
     set yet, every pick opens another leg, which is exactly the "keep going" case. */
  const updateItineraryRow = (id, field, value) => {
    setForm((current) => {
      const index = current.itinerary.findIndex((item) => item.id === id);
      const itinerary = current.itinerary.map((item) => (item.id === id ? { ...item, [field]: value } : item));

      const isLastRow = index === itinerary.length - 1;
      const settingTo = field === "toCity" || field === "toCityId";
      if (!isLastRow || !settingTo) return { ...current, itinerary };

      const row = itinerary[index];
      const toName = String(row.toCity || "").trim();
      // Wait for the NAME. `toCityId` and `toCity` are written as two separate updates, and firing
      // on the id would append a leg before the city it chains from is even known.
      if (field === "toCityId" || !toName) return { ...current, itinerary };

      /* Arriving back at the DROP city closes the route — and that leg is a journey home, not a
         stay, so its nights are set to 0 rather than left at the default 1.
         This is the one place the "nights belong to the To city" rule needs explaining, and the
         cheapest explanation is not having to make the decision: an agent who never touches the
         field still gets a correct round trip. It stays editable for the rare case where the party
         really does overnight at the drop point before flying out. */
      const drop = String(current.dropCity || "").trim();
      if (drop && toName.toLowerCase() === drop.toLowerCase()) {
        return {
          ...current,
          itinerary: itinerary.map((item) => (item.id === id ? { ...item, nights: "0" } : item)),
        };
      }

      /* The new leg opens ALREADY CLOSED to the drop city, at 0 nights — so the route is a
         complete round trip at every moment, not a dangling half-leg the agent has to remember to
         finish. Adding another stop is then just changing that To, which opens the next
         pre-closed leg behind it. Nobody has to type the way home. */
      const nextLeg = emptyRouteRow(row.toCity, row.toCityId);
      return {
        ...current,
        itinerary: [
          ...itinerary,
          drop
            ? { ...nextLeg, toCityId: current.dropCityId || "", toCity: current.dropCity, nights: "0" }
            : nextLeg,
        ],
      };
    });
  };

  const removeItineraryRow = (id) => setForm((current) => ({
    ...current,
    itinerary: current.itinerary.length > 1
      ? current.itinerary.filter((item) => item.id !== id)
      : current.itinerary,
  }));

  /* Vehicle + room requirement rows. One generic pair rather than four near-identical handlers:
     the only thing that differs is which array and which factory. */
  const addRow = (key, factory) => () =>
    setForm((current) => ({ ...current, [key]: [...current[key], factory()] }));

  const updateRow = (key) => (id, field, value) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    }));

  // Vehicles may go to zero (most bookings need none); rooms keep at least one, because a stay
  // always has rooms and an empty table reads as "not asked yet".
  const removeRow = (key, keepAtLeastOne) => (id) =>
    setForm((current) => ({
      ...current,
      [key]: keepAtLeastOne && current[key].length <= 1
        ? current[key]
        : current[key].filter((row) => row.id !== id),
    }));

  const availableLeads = useMemo(() => leads.filter((lead) =>
    !(lead.leadStage === "Converted" || lead.convertedBookingPublicId) ||
    String(lead.publicId || lead.id) === String(form.leadPublicId)
  ), [form.leadPublicId, leads]);

  // OLD — code, name and phone were crushed into one label:
  //   label: [lead.leadCode, lead.customerName, lead.phone].filter(Boolean).join(" · ")
  // One long line per row truncated before the phone on a narrow column, and a phone search lit up
  // a match the clerk could not see. The phone is a second line now, and still searchable.
  const leadOptions = useMemo(() => [
    { value: "", label: "Direct booking (no linked lead)" },
    ...availableLeads.map((lead) => {
      const phone = lead.phone || lead.customer?.phone || "";
      return {
        value: lead.publicId || lead.id,
        label: [
          lead.leadCode || "Lead",
          lead.customerName || lead.customer?.name || "Customer",
        ].filter(Boolean).join(" · "),
        sublabel: phone,
        keywords: [phone, lead.destination].filter(Boolean).join(" "),
      };
    }),
  ], [availableLeads]);

  const matchedDestination = destinations.find((destination) =>
    (form.destinationId && String(destinationIdOf(destination)) === String(form.destinationId)) ||
    (!form.destinationId && String(destination.name || "").trim().toLowerCase() === form.destination.trim().toLowerCase())
  );
  const destinationSelectValue = matchedDestination
    ? String(destinationIdOf(matchedDestination))
    : form.destination ? "__saved_destination__" : "";

  /* Destination and Assigned To were native <select>s. On a native select a keystroke only jumps to
     the next option starting with that letter and the browser forgets it a second later, so on a
     destination master of any size the clerk could not type their way to a row — which is what
     "search stops at the first letter" was. Both are the app's combobox now, same one Create Lead
     uses, so typing runs a real multi-letter query. */
  const destinationOptions = useMemo(() => [
    ...(destinationSelectValue === "__saved_destination__"
      ? [{ value: "__saved_destination__", label: `${form.destination} (saved)` }]
      : []),
    ...destinations.map((destination) => ({
      value: String(destinationIdOf(destination)),
      label: destination.name || "",
    })),
  ], [destinations, destinationSelectValue, form.destination]);

  const assigneeOptions = useMemo(() => [
    { value: "", label: "Current user" },
    ...assignees.map((user) => {
      const label = user.name || user.fullName || user.email || "";
      return {
        value: String(user.id ?? user.publicId ?? ""),
        label,
        sublabel: user.email && user.email !== label ? user.email : "",
        keywords: user.email || "",
      };
    }),
  ], [assignees]);

  // OLD — replaced in create-form redesign
  // const validate = () => {
  //   const next = {};
  //   if (!phonePattern.test(form.customerPhone.trim())) next.customerPhone = "Enter a valid phone number";
  //   if (customerMode === "idle") next.customer = "Search customer phone before creating the booking";
  //   if (customerMode === "new" && !form.customerName.trim()) next.customerName = "Customer name is required";
  //   if (form.customerEmail && !emailPattern.test(form.customerEmail)) next.customerEmail = "Enter a valid email";
  //   if (!form.destination.trim()) next.destination = "Destination is required";
  //   if (!form.travelDate) next.travelDate = "Travel date is required";
  //   else if (form.travelDate < today()) next.travelDate = "Travel date cannot be in the past";
  //   if (!(Number(form.customerAmount) > 0)) next.customerAmount = "Amount must be greater than 0";
  //   if (!(Number(form.vendorCost) > 0)) next.vendorCost = "Vendor cost must be greater than 0";
  //   if (Number(form.paidAmount) < 0) next.paidAmount = "Advance cannot be negative";
  //   setErrors(next);
  //   return Object.keys(next).length === 0;
  // };
  //
  // One monolithic function that only ever ran from handleSubmit, so nothing was checked until the
  // Create button at the bottom of the page. Split into per-field rules so the SAME rule can run on
  // blur — the clerk learns about a bad email while still looking at the email box, not four panels
  // later. setField still clears a field's error on the first keystroke (so the red goes away as
  // soon as you start fixing it) and the blur handler puts it back if it is still wrong.
  const FIELD_RULES = {
    customerPhone: (f) => (!editing && !phonePattern.test(String(f.customerPhone || "").trim()) ? "Enter a valid phone number" : ""),
    // OLD — closed over `customerMode` directly. handleSubmit can now resolve the mode mid-submit,
    // and that resolution is not in state yet when this runs, so the mode is passed in instead.
    customerName: (f, mode) => (!editing && mode === "new" && !String(f.customerName || "").trim() ? "Customer name is required" : ""),
    customerEmail: (f) => (!editing && f.customerEmail && !emailPattern.test(f.customerEmail) ? "Enter a valid email" : ""),
    destination: (f) => (!String(f.destination || "").trim() ? "Destination is required" : ""),
    /* "Not in the past" is a rule about SCHEDULING a trip, so it applies to the date the clerk
       picks — not to the one the form loaded. A booking spends most of its life with its travel date
       behind it (mid-trip, or travelled and awaiting settlement), and because the edit form
       round-trips every field, this rule used to make a booking permanently uneditable the day the
       trip started: no amount correction, no assignee change, no services. The backend's matching
       @FutureOrPresent has been dropped from UpdateBookingRequestDTO for the same reason. */
    travelDate: (f) => {
      if (!f.travelDate) return "Travel date is required";
      if (editing && f.travelDate === loadedRef.current.travelDate) return "";
      return f.travelDate < today() ? "Travel date cannot be in the past" : "";
    },
    customerAmount: (f) => (!(Number(f.customerAmount) > 0) ? "Amount must be greater than 0" : ""),
    // Vendor cost is now REQUIRED ONLY WHEN A VENDOR IS CHOSEN, mirroring the relaxed backend
    // contract (optional, inclusive @DecimalMin(0)). Naming a supplier and then leaving the amount
    // blank is the one combination that is meaningless — it records a payee owed nothing.
    vendorCost: (f) => {
      if (!f.vendorPublicId) return "";
      return !(Number(f.vendorCost) > 0) ? "Enter the cost for the selected vendor" : "";
    },
    paidAmount: (f) => (Number(f.paidAmount) < 0 ? "Advance cannot be negative" : ""),
    totalAdults: (f) => getAdultBreakdownError(f),
  };

  const blurField = (name) => {
    const rule = FIELD_RULES[name];
    if (!rule) return;
    /* A field you have not filled in yet is BLANK, not wrong.
       Blur fires when focus merely passes through — the caret starts in Customer Phone, and the
       moment the clerk moved to Customer Name to start typing, the phone went red on a form nobody
       had touched. Same for Total Budget, which greeted every new booking with "Amount must be
       greater than 0". Errors that are already on screen before you have done anything teach people
       to ignore red, which is what makes the real ones cost something.

       So blur only ever CLEARS an error on an empty field; it never raises one. Malformed input is
       still caught on blur (a half-typed number, a bad email), because that field is not empty, and
       everything missing is caught by validate() on submit, which also focuses the first offender.
       The one place this is softer than before: choose a vendor, tab past Vendor Budget, and you
       hear about the missing cost at submit rather than immediately. */
    if (!String(form[name] ?? "").trim()) {
      setErrors((current) => {
        if (!current[name]) return current;
        const next = { ...current };
        delete next[name];
        return next;
      });
      return;
    }
    const message = rule(form, customerMode);
    setErrors((current) => {
      if (!message && !current[name]) return current;
      const next = { ...current };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  };

  // OLD — `const validate = () => {` reading `customerMode` from the closure.
  // handleSubmit resolves the customer before validating, and that resolution has not reached state
  // yet, so the mode it settled on is threaded through instead of re-read here.
  const validate = (mode = customerMode) => {
    const next = {};
    Object.entries(FIELD_RULES).forEach(([name, rule]) => {
      const message = rule(form, mode);
      if (message) next[name] = message;
    });
    // OLD — "Search customer phone before creating the booking"
    // Reaching submit still in "idle" no longer means the clerk skipped a step: the phone is valid
    // (FIELD_RULES.customerPhone owns the invalid case and renders in this same slot) and submit has
    // already awaited a lookup. The only way to be here is a lookup that failed, so say that.
    if (!editing && mode === "idle") next.customer = "Could not check this number — press Search and try again";
    setErrors(next);

    // Put the caret on the first thing that is wrong. Without this, a failed submit on a form this
    // tall just re-renders errors somewhere off-screen and the clerk has to hunt for them.
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      const node = formRef.current?.querySelector(`[name="${firstInvalid}"]`)
        || formRef.current?.querySelector(`#${CSS.escape(firstInvalid)}`);
      if (node?.focus) node.focus();
      else phoneRef.current?.focus();
      node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
    return Object.keys(next).length === 0;
  };

  // OLD — replaced in create-form redesign
  // const handleSubmit = async (event) => {
  //   event.preventDefault();
  //   if (submitting || !validate()) return;
  // Signature now carries `addAnother` so the same path serves Save and Save & New.
  const handleSubmit = async (event, { addAnother = false } = {}) => {
    event?.preventDefault?.();
    if (submitting) return;

    // Resolve the customer BEFORE validating. The debounced lookup may not have landed — a fast
    // typist can reach Create inside its 500ms window — and the old code answered that by refusing
    // to submit and telling the clerk to press Search, i.e. to do by hand the one thing the form
    // now does for them. Awaiting it here also keeps the duplicate check unskippable: if the lookup
    // fails the mode stays "idle", validate() blocks, and no customer is guessed into existence.
    let mode = customerMode;
    let matched = selectedCustomer;
    if (!editing && mode === "idle" && phonePattern.test(String(form.customerPhone || "").trim())) {
      const resolved = await searchCustomer(form.customerPhone);
      mode = resolved.mode;
      matched = resolved.customer;
    }
    if (!validate(mode)) return;

    // `matched`, not selectedCustomer: when the lookup above is what settled the mode, its
    // setSelectedCustomer has not flushed and the state still reads null.
    const customer = editing ? null : mode === "existing"
      ? {
          customerPublicId: matched?.id || matched?.publicId,
          ...(syncCustomer ? {
            sync: {
              name: form.customerName.trim() || null,
              email: form.customerEmail.trim() || null,
              birthday: form.birthday || null,
              anniversary: form.anniversary || null,
            },
          } : {}),
        }
      : {
          newCustomer: {
            name: form.customerName.trim(),
            phone: form.customerPhone.trim(),
            email: form.customerEmail.trim() || null,
            city: form.customerCity.trim() || null,
            // `state` is already part of CustomerRequestDTO (see customers/api/customerService.js),
            // so this is an existing field the booking form simply never sent.
            state: form.customerState.trim() || null,
            birthday: form.birthday || null,
            anniversary: form.anniversary || null,
          },
        };

    const adultPayload = buildAdultPayload(form);
    const payload = {
      customer,
      destination: form.destination.trim(),
      travelDate: form.travelDate,
      tripSnapshot: {
        packageType: form.packageType || null,
        // Trip END date. travelDate above remains the START and is still the column the server
        // reports and filters on; this rides in the snapshot because promoting it to a real column
        // is a backend change. See the contract note in the Phase 1 report.
        tripEndDate: form.tripEndDate || null,
        // WhatsApp is NOT part of CustomerRequestDTO, so it is deliberately NOT sent on `customer`
        // — inventing a field there would 400 or be dropped silently. Held against the booking
        // until the customer entity gains one.
        customerWhatsapp: (whatsappNumber || "").trim() || null,
        // Same reason as the WhatsApp number above: CustomerRequestDTO has city and state but no
        // country, so sending one there would be dropped or rejected.
        customerCountry: form.customerCountry.trim() || null,
        // ── Pickup / Drop ─────────────────────────────────────────────────────────────────────
        // Neither is validated against `destination`: a Nepal package picked up and dropped at
        // Gorakhpur is a normal booking, and pickup and drop may be the same city.
        pickup: {
          countryId: form.pickupCountryId || null,
          country: form.pickupCountry.trim() || null,
          cityId: form.pickupCityId || null,
          city: form.pickupCity.trim() || null,
          mode: form.pickupMode || null,
          // Full timestamp, not a bare time: an early-morning flight is often picked up the night
          // before, which a time alone cannot express.
          dateTime: form.pickupDateTime || null,
        },
        drop: {
          countryId: form.dropCountryId || null,
          country: form.dropCountry.trim() || null,
          cityId: form.dropCityId || null,
          city: form.dropCity.trim() || null,
          mode: form.dropMode || null,
          // Full timestamp, same as pickup — a drop can fall on a different date to the trip's end.
          dateTime: form.dropDateTime || null,
        },
        // What the trip REQUIRES. Registration, vendor, driver and status are operational facts
        // that appear after fulfilment and are deliberately absent here.
        vehicleRequirements: form.vehicleRequirements
          /* A quantity ALONE is a requirement now, so it has to survive this filter.
             This used to be `row.vehicleType || row.model`, on the reasoning that a row with
             neither was one someone had opened and forgotten to fill. That stopped being true when
             the vehicle rows gained a collapsed view: "3 vehicles, type decided later" is a
             deliberate answer given through a single counter, and a row carrying it has no type and
             no model by design. Under the old filter it was dropped in silence on save — the clerk
             saw 3 in the box and the booking stored nothing.
             A row only exists because someone pressed Add vehicle, so keeping it is right. */
          .filter((row) => row.vehicleType || row.model || Number(row.quantity) > 0)
          .map((row) => ({
            vehicleType: row.vehicleType || null,
            vehicleId: row.vehicleId || null,
            model: row.model || null,
            capacity: row.capacity === "" ? null : Number(row.capacity),
            quantity: Number(row.quantity) || 1,
          })),
        roomRequirements: form.roomRequirements
          .filter((row) => row.roomType)
          .map((row) => ({
            roomType: row.roomType,
            acType: row.acType || "Any",
            count: Number(row.count) || 1,
            extraBeds: Number(row.extraBeds) || 0,
          })),
        // KEPT, and still written. Anything that only understands the old shape — an older client,
        // a report, a saved booking's read path — keeps working unchanged.
        departure: {
          country: form.pickupCountry.trim() || null,
          city: form.pickupCity.trim() || null,
          mode: form.pickupMode || null,
          // Hoisted OUT of the Car/Road branch below. The field is asked for every mode now, and
          // BookingDetails reads exactly this key to show "Pickup At" — leaving it road-only would
          // have made a flight pickup time vanish from the booking it was entered on.
          pickupDateTime: form.pickupDateTime || null,
          ...(form.pickupMode === "Flight / Airport" ? {
            airport: form.departureAirport.trim() || null,
            airportCode: form.airportCode.trim().toUpperCase() || null,
            preferredTime: form.preferredFlightTime || null,
          } : {}),
          ...(form.pickupMode === "Train / Rail" ? {
            railwayStation: form.railwayStation.trim() || null,
            trainClass: form.trainClass.trim() || null,
            preferredTime: form.preferredTrainTime || null,
          } : {}),
          ...(form.pickupMode === "Car / Road" ? {
            pickupAddress: form.pickupAddress.trim() || null,
            vehiclePreference: form.vehiclePreference.trim() || null,
          } : {}),
        },
        travellers: {
          // Rolled up from the room requirement rows when there are any, so the flat counters the
          // rest of the app still reads (booking list, details header, reports) stay correct now
          // that the UI edits a mix rather than a single number. Falls back to the plain field for
          // a booking with no rows.
          rooms: roomTotals.rooms || Number(form.rooms) || 0,
          male: adultPayload.male,
          female: adultPayload.female,
          totalAdults: adultPayload.totalAdults,
          children: Number(form.children) || 0,
          infants: Number(form.infants) || 0,
          extraBeds: roomTotals.extraBeds || Number(form.extraBeds) || 0,
        },
        specialAssistance: {
          required: form.specialAssistanceRequired,
          types: form.specialAssistanceRequired ? form.specialAssistanceTypes : [],
          passengerCount: form.specialAssistanceRequired ? Number(form.assistancePassengerCount) || 0 : 0,
          notes: form.specialAssistanceRequired ? form.specialAssistanceNotes.trim() || null : null,
        },
        /* Route legs. Each item carries BOTH shapes:
             • fromCity/toCity (+ ids) — the route, what this form now edits;
             • destination/city/nights — the legacy keys, so a reader that predates this change
               still shows the stay. `city` is the TO city because that is where the nights are
               spent, which is exactly what the old field meant.
           IDs are persisted for the first time. The previous version stored names only, which is
           why re-opening a saved booking lost every city id and the cascade had to be re-picked. */
        itinerary: form.itinerary
          .filter((item) => String(item.fromCity || "").trim() || String(item.toCity || "").trim())
          .map((item, index) => ({
            fromCityId: item.fromCityId || null,
            fromCity: String(item.fromCity || "").trim() || null,
            toCityId: item.toCityId || null,
            toCity: String(item.toCity || "").trim() || null,
            nights: Number(item.nights) || 0,
            dayNumber: index + 1,
            // legacy mirror
            destination: String(item.toCity || "").trim() || null,
            city: String(item.toCity || "").trim() || null,
          })),
        notes: form.tripNotes.trim() || null,
      },
      bookingDate: form.bookingDate || null,
      customerAmount: Number(form.customerAmount),
      // Both null when no vendor was chosen. vendorCost is optional on the backend now and stores 0;
      // the supplier spend for such a booking comes from the expense ledger instead.
      vendorPublicId: form.vendorPublicId || null,
      vendorCost: form.vendorCost === "" ? null : Number(form.vendorCost),
      paidAmount: Number(form.paidAmount) || 0,
      // How that advance was taken. Same key the payments ledger uses, and only sent when there is
      // an advance for it to describe — a mode with no payment behind it is noise on the record.
      ...(Number(form.paidAmount) > 0 && form.paymentMethod
        ? { paymentMethod: form.paymentMethod }
        : {}),
      overseasTourPackage: form.overseasTourPackage,
      applyGst: form.applyGst,
      gstInclusive: form.gstInclusive,
      applyTcs: form.applyTcs,
      // Sent only when an arrangement was actually made. An empty type means "no commission", and
      // the server reads a null type exactly that way — no need for a separate flag on create.
      commissionPayeeName: form.commissionType ? (form.commissionPayeeName?.trim() || null) : null,
      commissionType: form.commissionType || null,
      commissionValue: form.commissionType && form.commissionValue !== "" ? Number(form.commissionValue) : null,
      commissionStatus: form.commissionType ? (form.commissionStatus || "PENDING") : null,
      commissionPaidOn: form.commissionType && form.commissionStatus === "PAID"
        ? (form.commissionPaidOn || null) : null,
      commissionNotes: form.commissionType ? (form.commissionNotes?.trim() || null) : null,
      services: form.services,
      assignedUserId: form.assignedUserId || null,
      leadPublicId: form.leadPublicId || null,
    };

    setSubmitting(true);
    try {
      if (editing) {
        /* Money goes out ONLY when the clerk actually changed it. UpdateBookingRequestDTO is a patch
           contract where null means "leave alone", and re-sending an unchanged figure is not
           harmless:

           • vendorCost — on a marketplace-linked booking the server ADDS the marketplace payable to
             whatever the client sends, because the stored value is defined as "typed + marketplace"
             (BookingServiceImpl: "adding the sum again would double-count it"). The form loads the
             stored, already-inclusive figure, so every plain re-save inflated vendorCost by the
             payable again and deflated netProfit by the same amount — compounding per edit, and
             frozen permanently into the credit note once the booking is cancelled.
           • customerAmount — a non-null value marks the request as an amount change, which
             re-derives the totals and re-syncs commissions on a save that changed neither.
           • paidAmount — an unchanged value is a no-op the server has to reason about; a changed one
             is deliberately still sent, and the server records it as a ledger adjustment.

           undefined keys are dropped by JSON.stringify, so they never reach the wire. */
        const ifChanged = (key, value) =>
          String(form[key] ?? "") === String(loadedRef.current[key] ?? "") ? undefined : value;

        /* Unlinking the vendor needs its own flag. Under the patch contract null means "leave
           alone", so an emptied dropdown could not be expressed at all — the booking would silently
           keep the supplier the clerk just removed. clearVendor says it explicitly, and the cost is
           sent as 0 alongside, because a booking with no supplier owes no supplier money. */
        const vendorCleared =
          Boolean(loadedRef.current.vendorPublicId) && !form.vendorPublicId;

        await bookingService.update(routeBookingId, {
          destination: payload.destination,
          travelDate: payload.travelDate,
          bookingDate: payload.bookingDate,
          vendorPublicId: ifChanged("vendorPublicId", payload.vendorPublicId),
          clearVendor: vendorCleared ? true : undefined,
          customerAmount: ifChanged("customerAmount", payload.customerAmount),
          // A cleared vendor sends an explicit 0 rather than the null ifChanged would produce —
          // null is "leave alone", which would strand the old cost on a booking with no supplier.
          vendorCost: vendorCleared ? 0 : ifChanged("vendorCost", payload.vendorCost),
          paidAmount: ifChanged("paidAmount", payload.paidAmount),
          overseasTourPackage: payload.overseasTourPackage,

          /* Tax overrides collide with the patch contract: null means "leave unchanged" on the
             wire, but null is ALSO the stored value meaning "inherit the tenant setting". One
             field cannot carry both readings, so patch-semantics wins and going BACK to inherit
             is expressed by its own flag. Sent only when a control actually moved to Default —
             otherwise an ordinary edit would reset overrides it never touched. */
          clearTaxOverrides:
            ["applyGst", "gstInclusive", "applyTcs"].some(
              (k) => loadedRef.current[k] != null && form[k] == null
            ) || undefined,
          // undefined is dropped by JSON.stringify, so an unset override never reaches the wire.
          applyGst:     form.applyGst     ?? undefined,
          gstInclusive: form.gstInclusive ?? undefined,
          applyTcs:     form.applyTcs     ?? undefined,

          /* Commission under the same patch contract. Removing an arrangement cannot be expressed by
             sending nulls — those mean "leave alone" — so it gets its own flag, exactly like
             clearVendor. Sent only when the booking HAD a commission and the form no longer does. */
          clearCommission:
            (loadedRef.current.commissionType && !form.commissionType) ? true : undefined,
          commissionPayeeName: form.commissionType ? (payload.commissionPayeeName ?? "") : undefined,
          commissionType:      form.commissionType || undefined,
          commissionValue:     form.commissionType ? payload.commissionValue : undefined,
          commissionStatus:    form.commissionType ? payload.commissionStatus : undefined,
          commissionPaidOn:    form.commissionType ? payload.commissionPaidOn : undefined,
          commissionNotes:     form.commissionType ? (payload.commissionNotes ?? "") : undefined,
          services: payload.services,
          assignedUserId: payload.assignedUserId,
          tripSnapshot: payload.tripSnapshot,
          status: form.status || null,
        });
        showToast(`Booking ${bookingCode || ""} updated successfully.`, "success");
        navigate(`/BookingDetails/${routeBookingId}`);
        return;
      }

      const booking = unwrap(await bookingService.create(payload, idempotencyKey));
      writeSticky(form);
      const id = booking?.publicId || booking?.id;

      // Retire the key only now the record is genuinely finished. Doing it in the catch — or on
      // every submit — would hand a retry a NEW key, and the retry would create a second booking
      // instead of replaying the first, which is the exact failure the header exists to stop.
      resetIdempotencyKey();

      // OLD — replaced in create-form redesign
      // showToast(`Booking ${booking?.bookingCode || ""} created successfully.`, "success");
      // navigate(id ? `/BookingDetails/${id}` : "/Allbookings");
      //
      // Always navigating away meant the next record cost a trip back to the list, a click on New,
      // a lazy-chunk download and three mount fetches. resetForm() was already sitting right here,
      // unused — Save & New just calls it.
      if (addAnother) {
        resetForm();
        showToast(`${booking?.bookingCode || "Booking"} saved — next record ready.`, "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => phoneRef.current?.focus(), 0);
      } else {
        showToast(`Booking ${booking?.bookingCode || ""} created successfully.`, "success");
        navigate(id ? `/BookingDetails/${id}` : "/Allbookings");
      }
    } catch (error) {
      if (isAlreadyReported(error)) return;

      // OLD — replaced in create-form redesign
      // if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not create the booking."), "error");
      //
      // A 400 VALIDATION_ERROR carries fieldErrors, and those belong beside the input that caused
      // them. Flattening every server failure into one generic toast is what made a rejected field
      // impossible to find on a form this tall. Mirrors applyServerFieldErrors in CreateLead.
      const fieldErrors = getFieldErrors(error) || {};
      const known = Object.keys(fieldErrors).filter((name) => name in form);
      if (known.length > 0) {
        setErrors((current) => {
          const next = { ...current };
          known.forEach((name) => { next[name] = fieldErrors[name]; });
          return next;
        });
        const node = formRef.current?.querySelector(`[name="${known[0]}"]`);
        node?.focus?.();
        node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      } else {
        showToast(getErrorMessage(error, editing ? "Could not update the booking." : "Could not create the booking."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Keyboard: Enter advances, Ctrl+Enter saves, Ctrl+Shift+Enter saves and starts the next ────
  /* Enter-to-advance walks this list in DOM order.
     `button` USED TO BE unqualified, which is what made Enter delete itinerary rows: a leg is
     From → To → Nights → 🗑, so Enter from Nights focused the bin, and onFormKeyDown returns early
     for a BUTTON — leaving the browser's native "Enter activates the focused button" to fire.
     Two Enters after choosing a To and the row was gone.
     Excluding tabindex="-1" buttons takes destructive actions out of the typing path entirely;
     they stay clickable and reachable by Tab is opt-in per button. */
  const FOCUSABLE =
    'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
    'button:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';

  const focusNext = (from) => {
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
  };

  const onFormKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      handleSubmit(event, { addAnother: !editing && event.shiftKey });
      return;
    }
    const target = event.target;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      // Enter used to submit from ~18 of the 20 inputs. On a form this size that is a record
      // created three fields in.
      event.preventDefault();
      focusNext(target);
    }
  };

  // ── Server-computed money preview ─────────────────────────────────────────
  // GST / TCS / total / net profit come from POST /bookings/preview — the same calculator and
  // tenant accounting settings the create path itself runs. The browser never guesses a tax rate;
  // the old inline block under the money fields showed only client-derivable figures and said
  // "GST / TCS calculated on save" — this replaces that wait with the real numbers, live.
  const [preview, setPreview] = useState(null);
  const [previewState, setPreviewState] = useState("idle"); // idle | loading | ready | error
  const previewTicket = useRef(0);

  const previewAmount = Number(form.customerAmount);
  const previewVendor = form.vendorCost === "" ? null : Number(form.vendorCost);
  const previewPaid = Number(form.paidAmount) || 0;

  useEffect(() => {
    const ticket = ++previewTicket.current;
    // No synchronous setState in the effect body (react-hooks/set-state-in-effect): the panel
    // derives its visibility from `previewActive` at render, so an invalid amount needs no state
    // reset here — stale figures are simply not shown, and the ticket voids replies in flight.
    if (!previewAmount || previewAmount <= 0) return undefined;
    const timer = window.setTimeout(async () => {
      if (previewTicket.current !== ticket) return;
      setPreviewState("loading");
      try {
        const data = unwrap(await bookingService.previewFinancials({
          customerAmount: previewAmount,
          vendorCost: previewVendor,
          paidAmount: previewPaid,
          overseasTourPackage: form.overseasTourPackage,
          // Sent as-is, nulls included: null is "follow the tenant setting" on the wire too, and
          // coercing to false here would make the preview quote tax the save would not.
          applyGst: form.applyGst,
          gstInclusive: form.gstInclusive,
          applyTcs: form.applyTcs,
        }));
        if (previewTicket.current !== ticket) return; // stale reply — a newer request owns the panel
        setPreview(data);
        setPreviewState("ready");
      } catch {
        if (previewTicket.current !== ticket) return;
        // Silent by design: the preview is ambient (not user-initiated), and every figure is
        // recomputed authoritatively on save anyway. The panel renders its own fallback text.
        setPreview(null);
        setPreviewState("error");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [previewAmount, previewVendor, previewPaid, form.overseasTourPackage,
      form.applyGst, form.gstInclusive, form.applyTcs]);

  // Render-time gate for the Computed panel: with no valid amount the panel shows its hint and
  // any leftover preview/previewState from a previous amount is ignored rather than reset.
  const previewActive = Number.isFinite(previewAmount) && previewAmount > 0;

  /* Does this booking say anything about tax of its own, or is it simply following the tenant?
     Drives the "Custom" chip, and it tracks applyGst because that is now the only tax control on
     the screen. gstInclusive is deliberately excluded even though it is still a real stored flag:
     it has no control of its own any more, so a booking saved tax-inclusive would light the chip
     over a toggle sitting unset — a "Custom" nobody can see, let alone reset. applyTcs is excluded
     for the same reason. */
  const taxOverridden = form.applyGst != null;

  /* Balance = what is owed − what has been taken.
     Derived, never a field: two boxes for one number is how they end up disagreeing.
     Prefers the SERVER's totalPayable (which includes GST/TCS) and falls back to the plain budget
     until the preview lands — the label beside it says which of the two is being shown, so the
     figure is never ambiguous. The frontend does not compute tax; it only subtracts. */
  const balanceDue = (
    preview?.totalPayable != null ? Number(preview.totalPayable) : (Number(form.customerAmount) || 0)
  ) - (Number(form.paidAmount) || 0);


  /* What the commission works out to, shown live beside the control.
     Mirrors BookingCommissionCalculator deliberately — a percent is of the PRE-TAX base, never the
     total payable — but it is a PREVIEW only: the server recomputes and stores its own figure, and
     that one wins. Kept in JS rather than fetched because it is arithmetic on two numbers already
     on screen, and a round-trip per keystroke for that would be absurd. */
  const commissionPreview = form.commissionType === "FLAT"
    ? Math.max(0, Number(form.commissionValue) || 0)
    : form.commissionType === "PERCENT"
      ? Math.max(0, ((Number(previewAmount) || 0) * (Number(form.commissionValue) || 0)) / 100)
      : 0;

  // OLD — replaced in create-form redesign
  // const resetForm = () => {
  //   setForm(initialForm());
  //   ...
  // };
  // Keeps the sticky slice so Save & New does not throw away the destination/assignee the clerk is
  // working a batch of. "Clear" passes { keepSticky: false } for a genuinely blank slate.
  const resetForm = ({ keepSticky = true } = {}) => {
    setForm({ ...initialForm(), ...(keepSticky ? readSticky() : {}) });
    setErrors({});
    setSelectedCustomer(null);
    setCustomerMode("idle");
    setSyncCustomer(false);
    // Save & New reuses this component instance, so the ref would otherwise still be holding the
    // previous record's number and suppress the auto-lookup if the next booking is for that person.
    // The ticket bump stops a lookup still in flight from repopulating the blank form behind it.
    autoSearchedPhone.current = "";
    searchTicket.current += 1;
  };

  if (loadingBooking || (loadingLead && routeLeadId && !form.leadPublicId)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> Loading {editing ? "booking" : "lead"} details...
      </div>
    );
  }

  // OLD — replaced in create-form redesign
  // const customerFieldsLocked = customerMode === "idle" || (customerMode === "existing" && !syncCustomer);
  //
  // Bare "idle" disabled the whole customer block until a lookup had run. On the lead path that was
  // invisible (applyLead runs the lookup for you), so it only ever bit direct bookings — the one
  // flow where every field has to be typed by hand, and where the clerk was met with five dead
  // inputs. A valid phone number is now enough to open the block; the debounced lookup still runs
  // underneath and still swaps to the matched-customer card if that number is already a customer.
  /* "idle" no longer locks anything. Gating the block on a VALID phone was the last remnant of
     phone-first data entry, and it survived the redesign that put Customer Name first — so the very
     first field on the page was dead until the second one was filled in correctly. On a call the
     name is what you are told first.

     Nothing is lost by unlocking it. The auto-lookup already refuses to overwrite live keystrokes
     (`take()` in searchCustomer keeps what is typed whenever auto === true), so a name entered
     before the match lands survives it; the explicit Search button still loads the matched
     customer's details, because that is a deliberate "fetch this person". And a booking still
     cannot be created without a phone — FIELD_RULES.customerPhone enforces that at submit, which
     is where a missing required field belongs. */
  const customerFieldsLocked = editing || (customerMode === "existing" && !syncCustomer);

  return (
    // OLD — replaced in create-form redesign
    // <form id="create-booking-form" onSubmit={handleSubmit} noValidate className="min-h-screen bg-slate-50">
    //   <header className="border-b border-slate-200 bg-white shadow-sm">
    //     <div className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4">
    // The page carried no fontFamily, and this app applies Plus Jakarta Sans per page — there is no
    // global rule — so Create Booking silently rendered in the browser default.
    <form
      id="create-booking-form"
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={onFormKeyDown}
      noValidate
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: FONT }}
    >
      <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {editing ? `Edit Booking${bookingCode ? ` · ${bookingCode}` : ""}` : "Create Booking"}
              </h1>
              {/* OLD — replaced in create-form redesign
                  <p ...>Complete customer and confirmed travel details</p>
                  Replaced with the keyboard contract: on a 50-100/day screen the shortcuts are
                  worth more subtitle space than a restatement of the page title. */}
              <p className="hidden text-xs text-slate-500 sm:block">
                <kbd className="rounded bg-slate-100 px-1">Enter</kbd> next field ·
                <kbd className="ml-1 rounded bg-slate-100 px-1">Ctrl+Enter</kbd> save
                {!editing && <>{" · "}<kbd className="rounded bg-slate-100 px-1">Ctrl+Shift+Enter</kbd> save &amp; new</>}
              </p>
            </div>
          </div>
          {/* OLD — replaced in create-form redesign
              <button type="button" onClick={resetForm} ...>Clear</button>
              <button type="submit" ...>Create Booking</button>
              `onClick={resetForm}` handed React's click event straight in as the options object.
              Harmless by luck (keepSticky destructured to undefined → default true), but it meant
              Clear could never actually clear the sticky slice. Now explicit. */}
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={editing ? () => navigate("/Allbookings") : () => resetForm({ keepSticky: false })} disabled={submitting} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex">
              <RotateCcw className="h-3.5 w-3.5" /> {editing ? "Cancel" : "Clear"}
            </button>
            {!editing && <button type="button" onClick={(event) => handleSubmit(event, { addAnother: true })} disabled={submitting || searchingCustomer} className="hidden items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:inline-flex">
              <Plus className="h-3.5 w-3.5" /> Save &amp; New
            </button>}
            <button type="submit" disabled={submitting || searchingCustomer} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? (editing ? "Saving..." : "Creating...") : editing ? "Save Changes" : "Create Booking"}
            </button>
          </div>
        </div>
      </header>

      {/* OLD — replaced in create-form redesign
          <main className="w-full space-y-5 px-0 py-4">
          No max-width and no horizontal padding, so on a wide monitor the fields stretched
          full-bleed edge to edge and the eye had to travel the whole screen between label and
          input. Matches CreateLead's container now. */}
      {/* OLD — replaced when the money rail landed
          <main className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-4">
          Single column. Money + the computed figures now live in a sticky right rail so they stay
          in view while the clerk scrolls the trip detail — DOM order also puts the amounts last,
          which is where Enter-advance should land them. On <lg the rail stacks below the panels. */}
      <main className="mx-auto w-full max-w-[1400px] px-4 py-4">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">
        {/* OLD — description="Search phone first; existing data will be reused automatically"
            The lookup is no longer something the clerk has to start, so stop instructing them to.
            The action slot also reports the debounced lookup while it runs, so the brief moment
            before the Existing/New chip appears reads as progress rather than as nothing. */}
        <Panel
          icon={CircleUserRound}
          iconTile="bg-blue-100 text-blue-700"
          title="Customer Details"
          description="Enter the phone number — an existing customer is matched automatically"
          action={
            /* Two chips, not one: the lookup status is transient and the headcount is standing, so
               they cannot take turns in the same slot. Wrapped in a flex that wraps, because on a
               narrow viewport "Existing customer" and "6 travellers" together outrun the corner. */
            <div className="flex flex-wrap items-center justify-end gap-2">
              {searchingCustomer ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  <LoaderCircle className="h-3 w-3 animate-spin" /> Checking number...
                </span>
              ) : customerMode !== "idle" ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${customerMode === "existing" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                  <Check className="h-3 w-3" /> {customerMode === "existing" ? "Existing customer" : "New customer"}
                </span>
              ) : null}
              {/* The party size, in the corner. Guarded on > 0 so a form whose counters have been
                  cleared shows nothing rather than "0 travellers". */}
              {totalTravellers > 0 && (
                <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {totalTravellers} traveller{totalTravellers === 1 ? "" : "s"}
                </span>
              )}
            </div>
          }
        >
          {/* Name → Phone → WhatsApp. Name leads because it is what the agent is told first on a
              call; the phone keeps its lookup and its Search button beside it. Link Lead moved to
              the foot of this panel: it PREFILLS the form, so it is a shortcut rather than a field,
              and at the top it sat between the agent and the two things they actually type. */}
          {/* Equal thirds. The old 4 / 5 / 3 split gave Customer Phone the extra column because it
              was carrying the Search button inside its own row; with the button gone that width
              belonged to nobody, and WhatsApp was left the narrowest of the three despite holding
              the same kind of value as the field next to it. Three fields asking for a name and two
              numbers have no reason to differ in width. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0">
              <Field label="Customer Name" required={customerMode !== "existing"} error={errors.customerName}>
                <div className="relative">
                  <CircleUserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="customerName" value={form.customerName} onChange={(event) => setField("customerName", event.target.value)} onBlur={() => blurField("customerName")} disabled={customerFieldsLocked} placeholder="Full name" className={`${controlClass("customerName", true)} disabled:bg-slate-50`} />
                </div>
              </Field>
            </div>

            <div className="min-w-0">
              <Field label="Customer Phone" required={!editing} error={errors.customerPhone || errors.customer}>
                {/* Plain relative box now, not a flex row. The flex existed to sit the input beside
                    the Search button; with one child left it was a wrapper around a wrapper. */}
                <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    {/* OLD — replaced in create-form redesign
                        <input value={form.customerPhone} ... />
                        No `type` at all, so mobile got a full QWERTY keyboard instead of a dial pad,
                        and no autoComplete, so the browser could not offer a number it already
                        knows. stopPropagation is new too: without it this Enter handler ran and
                        then the form-level Enter-advance ran on the same keystroke. */}
                    <input
                      ref={phoneRef}
                      name="customerPhone"
                      type="tel"
                      autoComplete="tel"
                      value={form.customerPhone}
                      disabled={editing}
                      onChange={(event) => changePhone(event.target.value)}
                      onBlur={() => blurField("customerPhone")}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        event.stopPropagation();
                        searchCustomer(form.customerPhone);
                      }}
                      aria-invalid={Boolean(errors.customerPhone)}
                      placeholder="Enter phone number"
                      className={`${controlClass("customerPhone", true)} disabled:bg-slate-50 disabled:text-slate-500`}
                    />
                </div>
              </Field>
            </div>

            {/* WhatsApp completes the "how do we reach them" row. Mirrors the phone while ticked,
                including later edits to it. */}
            <div className="min-w-0">
              <Field label="WhatsApp Number" optional>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    inputMode="tel"
                    value={whatsappNumber}
                    onChange={(event) => setField("customerWhatsapp", event.target.value)}
                    disabled={customerFieldsLocked || form.whatsappSameAsPhone}
                    placeholder="Same as phone"
                    className={`${controlClass("customerWhatsapp", true)} disabled:bg-slate-50`}
                  />
                </div>
                <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
                  <input
                    type="checkbox"
                    checked={form.whatsappSameAsPhone}
                    onChange={(event) => setWhatsappSameAsPhone(event.target.checked)}
                    disabled={customerFieldsLocked}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                  />
                  Same as phone
                </label>
              </Field>
            </div>
          </div>

          {/* Matched customer — the reuse card. The search response already carries all of this
              (code, city, tier, lifetime bookings/spend); it used to be dropped on the floor, so
              the agent had no way to confirm they had matched the right person before booking. */}
          {customerMode === "existing" && selectedCustomer && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {String(selectedCustomer.name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{selectedCustomer.name || "—"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[selectedCustomer.customerId, selectedCustomer.phone, selectedCustomer.city]
                        .filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCustomer.tier && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {selectedCustomer.tier}
                    </span>
                  )}
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                    {Number(selectedCustomer.bookings) || 0} past booking{(Number(selectedCustomer.bookings) || 0) === 1 ? "" : "s"}
                  </span>
                  {selectedCustomer.spent != null && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                      ₹{Number(selectedCustomer.spent).toLocaleString("en-IN")} lifetime
                    </span>
                  )}
                </div>
              </div>
              {!editing && <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-emerald-200/70 pt-3 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={syncCustomer} onChange={(event) => setSyncCustomer(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Edit details — write these changes back to the customer profile
                <span className="font-normal text-slate-400">
                  (name overwrites; email/dates only fill blanks; phone is never changed)
                </span>
              </label>}
            </div>
          )}

          {/* Rest of the customer record — one clean four-across row.
              Birth Date and Anniversary were REMOVED from this form: they are customer-profile
              facts, not booking facts, and they cost two fields on the fastest-typed screen in the
              app. They stay editable on the customer record itself, and nothing is dropped from an
              existing customer — the booking simply stops asking. */}
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Email" optional error={errors.customerEmail}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input name="customerEmail" type="email" autoComplete="email" value={form.customerEmail} onChange={(event) => setField("customerEmail", event.target.value)} onBlur={() => blurField("customerEmail")} disabled={customerFieldsLocked} placeholder="name@email.com" className={`${controlClass("customerEmail", true)} disabled:bg-slate-50`} />
              </div>
            </Field>
            <Field label="City" optional>
              <input value={form.customerCity} onChange={(event) => setField("customerCity", event.target.value)} disabled={customerFieldsLocked} placeholder="Customer city" className={`${controlClass("customerCity")} disabled:bg-slate-50`} />
            </Field>
            {/* State IS a real customer field (CustomerRequestDTO carries it) that this form simply
                never sent. Typed, not derived: the City master has no state column, so nothing can
                resolve "Pune" to "Maharashtra" yet. */}
            <Field label="State / Province" optional>
              <input value={form.customerState} onChange={(event) => setField("customerState", event.target.value)} disabled={customerFieldsLocked} placeholder="Maharashtra" className={`${controlClass("customerState")} disabled:bg-slate-50`} />
            </Field>
            {/* Country has NO field on CustomerRequestDTO, so it rides in tripSnapshot rather than
                being invented on the customer payload — see the backend contract note. */}
            <Field label="Country" optional>
              <input value={form.customerCountry} onChange={(event) => setField("customerCountry", event.target.value)} disabled={customerFieldsLocked} placeholder="India" className={`${controlClass("customerCountry")} disabled:bg-slate-50`} />
            </Field>
          </div>

          {/* ── Travellers ──────────────────────────────────────────────────────────────────────
              Moved here from Travel Details, unchanged. Who is going is a fact about the PARTY, not
              about the route — it does not depend on a destination, dates, or a pickup point, and
              on a call it is answered in the same breath as the customer's name. In Travel Details
              it sat between Drop and Special assistance, which put a headcount in the middle of a
              set of questions about places.

              Rooms stay suppressed here for the same reason as before: the Room Requirement rows
              own that number, and two editors for one value is how they drift apart. */}
          {/* Travellers on the left, Link Lead on the right — one row, not two.
              Stacked, each occupied a full-width band to hold one narrow control, and the counters
              are capped at max-w-sm while Link Lead is capped at max-w-md, so both left roughly
              half the card empty. Side by side they fill it and the panel loses two rules and a
              band of dead space. Still stacks on small screens, where a single column is right. */}
          {/* 7/5, not 50/50. Link Lead is ONE select and was rendering nearly 600px wide with a
              short line of text in it, while the traveller counters next to it were squeezed until
              "Adult Female" truncated to "A…". The wider half goes to the side with five controls
              in it. */}
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Travellers</h3>
                <p className="text-[11px] text-slate-400">Click a number and type to replace it</p>
              </div>
              <TravellerCountFields
                values={form}
                onCountChange={setField}
                onToggleBreakdown={toggleAdultBreakdown}
                theme="teal"
                showRooms={false}
              />
            </div>

            {/* Link Lead keeps its place at the end of the reading order — it PREFILLS the whole
                form, so it is a shortcut rather than a customer field, and at the top it sat
                between the agent and the two things they actually type. */}
            {/* <div className="min-w-0">
              <Field label="Link Lead" optional>
                <SearchableSelect
                  options={leadOptions}
                  value={form.leadPublicId}
                  onChange={handleLeadChange}
                  placeholder="Search lead code, customer or phone"
                  searchPlaceholder="Lead code, name or phone..."
                  loading={loadingLead}
                  disabled={editing}
                  icon={ClipboardList}
                  accent="blue"
                  advanceOnSelect
                  className="hover:border-slate-300 disabled:bg-slate-50"
                />
              </Field>
            </div> */}
          </div>
 
          {/* Special assistance moved on to the action footer — it is the last thing asked, and it
              is off on nearly every booking, so a whole band here was a rule and a line of padding
              spent on an unticked box. Its passenger cap still reads totalTravellers, which is
              derived from `form` and so does not care which card the counters are in. */}
        </Panel>

        {/* OLD — description="Core booking, destination and commercial information"
            The money fields moved to the sticky rail, so "commercial" no longer lives here. */}
        {/* ── Vehicle & Room Requirement ────────────────────────────────────────────────────────
            Occupies the slot the Booking Details card used to hold. Its fields did not disappear:
            Destination and Package Type moved into Travel Details beside the dates they belong
            with, and Assigned To moved to the action footer as a record-keeping fact. Nothing was
            dropped from state or the payload.

            ONE card, two bands — not two cards side by side. Both answer the same question ("what
            does this party need booked"), they are usually filled in together, and as separate
            cards each one sized to its own row count, so an empty Vehicle box sat next to three
            room rows and the pair looked broken. These are also the ONLY place either is asked:
            the duplicate bands that used to repeat inside Travel Details are gone.

            STACKED, not two columns. Side by side, each band had roughly half the card to fit four
            controls plus a bin, and both collapsed into abbreviations — "D…" for Double, "Temp…"
            for Tempo Traveller, "Innova Crysta — …". A room type you cannot read is a room type
            nobody checks. Full width gives each select its own words back, and these are two
            questions asked in sequence anyway, so reading them top to bottom costs nothing. */}
        <Panel
          icon={Bus}
          // Yellow rather than amber, and with enough chroma to read as a colour at all:
          // amber-50 is 0.022 — a cream that looked like an unstyled tile — and amber's
          // hue sits far enough toward orange that darkening it alone never reads yellow.
          // The tile is the softer 200; the glyph stays at 900 so it holds its contrast.
          iconTile="bg-yellow-200 text-yellow-900"
          title="Vehicle"
          description="What the trip needs — not what is finally assigned"
        >
          <div className="space-y-5">
            <section className="min-w-0">
              {/* The count sits with the band it counts. ml-auto pushes it right on a wide row and
                  the existing flex-wrap drops it to its own line on a narrow one.
                  The glyph carries the Services picker's colour for the same service, and takes
                  self-center because the row aligns on the text baseline — an icon left on that
                  baseline hangs below the heading it belongs to. */}
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <CarFront className="h-4 w-4 shrink-0 self-center text-amber-700" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle</h3>
                <p className="text-[11px] text-slate-400">Not the vehicle finally assigned</p>
                {vehicleCount > 0 && (
                  <span className="ml-auto inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <VehicleRequirementRows
                rows={form.vehicleRequirements}
                vehicles={vehicleMaster}
                loading={loadingVehicleMaster}
                onAdd={addRow("vehicleRequirements", emptyVehicleRow)}
                onRemove={removeRow("vehicleRequirements", false)}
                onUpdate={updateRow("vehicleRequirements")}
              />
            </section>
            {/* A rule between the two bands, at every width now that they are stacked. */}
            <section className="min-w-0 border-t border-slate-100 pt-5">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <BedDouble className="h-4 w-4 shrink-0 self-center text-emerald-600" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Rooms</h3>
                <p className="text-[11px] text-slate-400">Room mix for the party</p>
                {roomCount > 0 && (
                  <span className="ml-auto inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {roomCount} room{roomCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <RoomRequirementRows
                rows={form.roomRequirements}
                onAdd={addRow("roomRequirements", emptyRoomRow)}
                onRemove={removeRow("roomRequirements", true)}
                onUpdate={updateRow("roomRequirements")}
              />
            </section>
          </div>
        </Panel>

        {/* onBlurField added in the create-form redesign so Travel Date validates on blur like the
            fields owned by this page, instead of waiting for submit. */}
        {/* Dates, Pickup, Drop and Travellers are all bands INSIDE this one panel. Vehicle and Room
            Requirement used to be bands here too and are no longer passed down — they are asked
            once, in the card above, instead of appearing under two headings on the same page. */}
        <FastTravelDetails
          form={form}
          setField={setField}
          errors={errors}
          onBlurField={blurField}
          primaryFields={<>
            {/* These two mirror the Travel Date box rather than sitting beside it as short
                single-line controls: a mini uppercase caption over the value, inside one bordered
                cell built the same way, so the row reads as three matching boxes. The height is
                not set anywhere — the cell is the same caption line over the same text line with
                the same padding, so it comes out the same height on its own.

                Their Field label is gone: it would print the same word twice, once above the box
                and once inside it. PrimaryBox puts an invisible line in its place so all three
                boxes still start level, since Travel Date carries its label above its box. The
                icons went with the label for the same reason — the caption already names the
                field, and Travel Date's cells carry no icons either.

                The controls themselves are stripped of their own border, radius and padding with
                important utilities. The box owns that chrome now, and SearchableSelect's own
                comment warns that two border utilities in one class string are settled by
                stylesheet order — so this does not leave it to chance. */}
            <PrimaryBox caption="Destination" required error={errors.destination} hint={destinationError}>
              <SearchableSelect
                name="destination"
                options={destinationOptions}
                value={destinationSelectValue}
                onChange={(next) => {
                  // "(saved)" is a read-only echo of a destination that is not in the master list —
                  // re-picking it must not blank the two fields it stands for.
                  if (next === "__saved_destination__") return;
                  const selected = destinations.find((item) => String(destinationIdOf(item)) === next);
                  setField("destinationId", selected ? String(destinationIdOf(selected)) : "");
                  setField("destination", selected?.name || "");
                }}
                onBlur={() => blurField("destination")}
                placeholder={loadingDestinations ? "Loading destinations..." : "Select destination"}
                searchPlaceholder="Type a destination..."
                loading={loadingDestinations}
                invalid={Boolean(errors.destination)}
                accent="blue"
                advanceOnSelect
                className="border-0! bg-transparent! rounded-none! p-0! pr-6! focus:ring-0!"
              />
            </PrimaryBox>
            <PrimaryBox caption="Package Type" optional>
              <select
                value={form.packageType}
                onChange={(event) => setField("packageType", event.target.value)}
                className="w-full appearance-none border-0 bg-transparent p-0 pr-6 text-sm text-slate-800 outline-none"
              >
                <option value="">Select package</option>
                {PACKAGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </PrimaryBox>
          </>}
        />

        {/* ── Services & Notes ─────────────────────────────────────────────────────────────────
            Full width, directly under Travel Details. It used to be a narrow right-hand column
            beside the itinerary, which forced the chips into a 2-wide stack and left the itinerary
            squeezed into 7/10ths of the row — the source of most of the empty space on this page.
            Laid out horizontally, the eight chips fit one or two rows and the notes sit beside
            them instead of underneath. */}
        <Panel icon={PackageCheck} iconTile="bg-violet-100 text-violet-700" title="Services & Notes" description="Confirmed inclusions and instructions">
          {/* items-start is the fix for the oversized chips: without it the grid stretches every
              cell to the tallest one — the notes textarea — so each service button grew to ~90px
              tall. Now the chip block keeps its natural height and the textarea is free to be
              taller than it. */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* auto-rows-min for the same reason one level down, so the two chip rows do not
                stretch to fill the column either. */}
            {/* ONE row of five on desktop, wrapping to two-up on phones. Eight chips needed two
                rows; five fit across, which is what makes this a single glance rather than a grid
                to read. */}
            <div className="grid auto-rows-min grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {SERVICES.map((service) => {
                // OLD — replaced in create-form redesign
                // const selected = form.services.includes(service);
                //
                // SERVICES holds Title Case ("Hotel"), but a lead's services come across as the
                // lowercase ids the lead form stores ("hotel"), so applyLead prefilled the array
                // and not one chip lit up — the agent then re-picked services that were already
                // there, or shipped them twice in different casings.
                const selected = form.services.some(
                  (item) => String(item).toLowerCase() === service.toLowerCase()
                );
                /* Same card as Create Lead's picker: a coloured glyph tile over the label, with the
                   tick in the corner instead of pushing the text sideways. The tile keeps its
                   colour when selected — the blue ring and the tick say "picked", the colour says
                   which service, and painting the whole card blue threw that second signal away. */
                const { icon: Icon, tile } = SERVICE_TILES[service] || {};
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    aria-pressed={selected}
                    title={service}
                    className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-1 py-3 text-center transition focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 ${selected ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span
                      className={`absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition ${selected ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-transparent group-hover:border-slate-300"}`}
                    >
                      <Check className="h-2 w-2" strokeWidth={3.5} />
                    </span>
                    {Icon && (
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tile}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                    <span className={`w-full truncate text-[10px] font-semibold leading-tight ${selected ? "text-slate-900" : "text-slate-600"}`}>
                      {service}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Notes sit BESIDE the chips on lg (they are the same decision — "what is included")
                and fall under them on smaller screens. No h-full: that was making the textarea
                stretch the row, which is what inflated the chips. */}
            <Field label="Booking / Trip Notes" optional>
              <textarea rows={4} value={form.tripNotes} onChange={(event) => setField("tripNotes", event.target.value)} placeholder="Confirmed preferences, inclusions or internal instructions" className={`${controlClass("tripNotes")} resize-y`} />
            </Field>
          </div>
        </Panel>

        {/* ── Travel Itinerary ─────────────────────────────────────────────────────────────────
            Now full width. The route table has four columns of its own; at 7/10ths of the row its
            city pickers were the narrowest controls on the page. */}
        <Panel
          icon={Route}
          iconTile="bg-sky-100 text-sky-700"
          title="Travel Itinerary"
          description="The route, leg by leg — nights are spent at the To city"
          action={
            duration && !duration.invalid ? (
              <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                routeNights === duration.nights
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {routeNights} / {duration.nights} nights
              </span>
            ) : null
          }
        >
          <RouteSegments
            rows={form.itinerary}
            fromCityOptions={fromCityOptions}
            toCityOptions={toCityOptions}
            loadingCities={loadingCities}
            summary={tripRouteSummary}
            warnings={tripRouteWarnings}
            onAdd={addItineraryRow}
            onRemove={removeItineraryRow}
            onUpdate={updateItineraryRow}
          />
        </Panel>
        </div>

        {/* Money rail — sticky on lg so the amounts and the server-computed figures stay in view
            while the clerk scrolls the trip detail; stacks below the panels on smaller screens.
            The three inputs are the SAME controls that sat in Booking Details (same name/onBlur/
            onWheel contract), so focus-first-invalid and Enter-advance keep working — DOM order
            simply lands them last, right before the footer actions. */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-[72px]">
          <Panel icon={BadgeIndianRupee} iconTile="bg-emerald-100 text-emerald-700" title="Payment Details" description="Commercials for this booking">
            <div className="space-y-4">
              <Field label="Total Budget (INR)" required error={errors.customerAmount}>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="customerAmount" type="number" min="0" step="0.01" value={form.customerAmount} onChange={(event) => setField("customerAmount", event.target.value)} onBlur={() => blurField("customerAmount")} onWheel={(event) => event.currentTarget.blur()} placeholder="0.00" className={controlClass("customerAmount", true)} />
                </div>
                {/* Shown only while the box still holds exactly what was seeded — once the clerk
                    types their own figure the note would be describing a number that is no longer
                    there. */}
                {amountOrigin && form.customerAmount === amountOrigin.amount && (
                  <p className="mt-1.5 text-[11px] font-normal leading-relaxed text-slate-400">
                    From the latest quotation
                    {amountOrigin.version ? ` (${amountOrigin.version})` : ""} — change it if the
                    agreed price differs.
                  </p>
                )}
              </Field>
              {/* Money the CUSTOMER owes, top to bottom: what the trip costs them, what they have
                  paid and how, what is still outstanding. Vendor and Vendor Budget follow after,
                  because they are what WE pay out — a different party and a different direction, so
                  they no longer sit between the customer's budget and their advance. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Advance (INR)" optional error={errors.paidAmount}>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="paidAmount" type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => setField("paidAmount", event.target.value)} onBlur={() => blurField("paidAmount")} onWheel={(event) => event.currentTarget.blur()} placeholder="0.00" className={controlClass("paidAmount", true)} />
                  </div>
                </Field>

                {/* How the advance came in — UPI, Cash, Bank Transfer and the rest. The list is
                    PAYMENT_METHODS, imported from the payments page rather than retyped here: the
                    ledger already owns this vocabulary and a second copy would drift from it.
                    Sits beside the amount rather than appearing only once one is typed — a field
                    that materialises mid-form is a field the agent has to notice. It is DISABLED
                    until there is an advance, so it never asks how nothing was paid. */}
                <Field label="Payment Mode" optional>
                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={form.paymentMethod}
                      onChange={(event) => setField("paymentMethod", event.target.value)}
                      disabled={!(Number(form.paidAmount) > 0)}
                      className={`${controlClass("paymentMethod", true)} appearance-none pr-9`}
                    >
                      <option value="">{Number(form.paidAmount) > 0 ? "Select mode" : "No advance"}</option>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
              </div>

              {/* Balance is DERIVED, never typed — two boxes for one number is how they end up
                  disagreeing. Shown against the server's computed total payable once the preview
                  has landed (that figure includes GST/TCS), and against the plain budget until
                  then, so the label always says which it is. */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Balance {preview?.totalPayable != null ? "(after tax)" : ""}
                  </span>
                  <span className={`text-sm font-extrabold tabular-nums ${balanceDue < 0 ? "text-red-600" : "text-slate-800"}`}>
                    {inr(balanceDue)}
                  </span>
                </div>
                {balanceDue < 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-red-500">
                    Advance is more than the amount due.
                  </p>
                )}
              </div>

              {/* Vendor gates Vendor Budget. The amount used to be asked for on its own and was
                  REQUIRED, so every booking carried a supplier figure with no payee — and the agent
                  had to commit to one at the moment of sale, before anything was actually booked.
                  Now: pick a supplier and the amount opens up; leave it blank and the cost stays 0,
                  with the real spend itemised later in the expense ledger (which reduces profit). */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <Field label="Vendor" optional error={errors.vendorPublicId}>
                  {/* appearance-none + pr-9 is load-bearing: without it the browser draws its own
                      dropdown arrow AND the ChevronDown below renders, giving two. Same recipe as
                      the Package Type select — left icon, suppressed native arrow, own chevron. */}
                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      name="vendorPublicId"
                      value={form.vendorPublicId}
                      onChange={(event) => setField("vendorPublicId", event.target.value)}
                      disabled={loadingVendors}
                      className={`${controlClass("vendorPublicId", true)} appearance-none pr-9`}
                    >
                      <option value="">
                        {loadingVendors ? "Loading vendors…" : "No vendor selected"}
                      </option>
                      {vendors.map((v) => (
                        <option key={v.publicId} value={v.publicId}>
                          {v.vendorName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
                <Field
                  label="Vendor Budget (INR)"
                  required={Boolean(form.vendorPublicId)}
                  optional={!form.vendorPublicId}
                  error={errors.vendorCost}
                >
                  <div className="relative">
                    <BadgeIndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="vendorCost" type="number" min="0" step="0.01" value={form.vendorCost} onChange={(event) => setField("vendorCost", event.target.value)} onBlur={() => blurField("vendorCost")} onWheel={(event) => event.currentTarget.blur()} placeholder={form.vendorPublicId ? "0.00" : "Select a vendor first"} disabled={!form.vendorPublicId} className={controlClass("vendorCost", true)} />
                  </div>
                </Field>
              </div>
              {/* The "Overseas tour package" checkbox stood here. It was the last TCS control on
                  this form — its only job was telling the server's 206C(1G) rule that this booking
                  qualifies — and TCS is no longer something this screen asks about or shows.

                  `overseasTourPackage` is NOT removed from the form or the payload, only from the
                  UI. It still defaults to false and is still sent, so a new booking simply declares
                  itself domestic; and edit mode still LOADS the saved value and sends it back
                  untouched, so an existing overseas booking keeps its flag rather than being
                  silently converted to a domestic one on the next save.

                  Side effect worth knowing: with the flag false, the server's auto-TCS rule does
                  not fire, so Total Payable becomes Budget + GST and the Computed panel adds up
                  again — the unexplained ₹5 gap goes away on its own. An OLD booking that was
                  saved as overseas still carries TCS inside its Total Payable with no line naming
                  it, because that flag is preserved rather than cleared. */}

              {/* ── Agent / agency commission ────────────────────────────────────────────────
                  Collapsed to a single control until someone says there IS an arrangement, because
                  most bookings have none and six always-visible fields for the exception would push
                  the tax controls below the fold on the one panel that has to stay scannable. */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">Agent commission</p>
                    <p className="mt-0.5 text-xs font-normal leading-relaxed text-slate-400">
                      For a booking brought by an agent, agency or referrer.
                    </p>
                  </div>
                  {form.commissionType && commissionPreview > 0 && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      {inr(commissionPreview)}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <TriToggle
                    label="Commission type"
                    value={form.commissionType}
                    onChange={(v) => setField("commissionType", v)}
                    options={[
                      { value: "",        label: "None" },
                      { value: "PERCENT", label: "Percent" },
                      { value: "FLAT",    label: "Flat" },
                    ]}
                  />
                </div>

                {form.commissionType && (
                  <div className="mt-3 space-y-3">
                    <Field label="Paid to" optional>
                      <input name="commissionPayeeName" value={form.commissionPayeeName}
                        onChange={(event) => setField("commissionPayeeName", event.target.value)}
                        placeholder="Agent / agency name"
                        className={controlClass("commissionPayeeName")} />
                    </Field>

                    <Field
                      label={form.commissionType === "PERCENT" ? "Rate (%)" : "Amount (INR)"}
                      optional
                    >
                      <div className="relative">
                        {form.commissionType === "FLAT" && (
                          <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        )}
                        <input name="commissionValue" type="number" min="0" step="0.01"
                          value={form.commissionValue}
                          onChange={(event) => setField("commissionValue", event.target.value)}
                          onWheel={(event) => event.currentTarget.blur()}
                          placeholder={form.commissionType === "PERCENT" ? "5.00" : "0.00"}
                          className={controlClass("commissionValue", form.commissionType === "FLAT")} />
                      </div>
                      {/* Said explicitly because it is the one thing people assume wrongly: the
                          percent is of the booking VALUE, not of the tax-inclusive total. */}
                      {form.commissionType === "PERCENT" && (
                        <p className="mt-1 text-[10px] font-normal leading-snug text-slate-400">
                          Percent of the booking value ({inr(previewAmount || 0)}), before tax.
                        </p>
                      )}
                    </Field>

                    <TriToggle
                      label="Status"
                      value={form.commissionStatus}
                      onChange={(v) => setField("commissionStatus", v)}
                      options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "PAID",    label: "Paid" },
                      ]}
                    />

                    {form.commissionStatus === "PAID" && (
                      <Field label="Paid on" optional>
                        <input name="commissionPaidOn" type="date" value={form.commissionPaidOn}
                          onChange={(event) => setField("commissionPaidOn", event.target.value)}
                          className={controlClass("commissionPaidOn")} />
                      </Field>
                    )}

                    <p className="text-[10px] font-normal leading-relaxed text-slate-400">
                      Comes out of this booking's profit as soon as it is agreed — marking it paid
                      moves cash, not margin. Don't also add it as a Commission expense, or it is
                      deducted twice.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Tax for THIS booking ─────────────────────────────────────────────────────
                  ONE question, and the only one an agent can actually answer at the point of sale:
                  is the figure they just typed the all-in price, or does GST go on top of it?

                  Whether GST applies at all, and whether TCS does, are POLICY — they come from the
                  tenant's Accounting Settings, and the per-booking overrides that used to sit here
                  ("Charge GST", "Collect TCS") are gone. Both flags still exist on the form and in
                  the payload as null, which is exactly what "follow Accounting Settings" means, so
                  the contract with the server is unchanged and a saved booking that carries an
                  explicit value keeps it. */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">Tax for this booking</p>
                    {/* No longer "Leave on Default" — there is no Default BUTTON any more. Unset is
                        still a real state (neither option lit), so the sentence describes it as
                        what it is: nothing picked, tenant settings decide. */}
                    <p className="mt-0.5 text-xs font-normal leading-relaxed text-slate-400">
                      Leave it unset to follow your Accounting Settings.
                    </p>
                  </div>
                  {taxOverridden && (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Custom
                    </span>
                  )}
                </div>

                {/* ONE question: does this booking carry GST or not.
                    "Price entered is — Excl. / Incl. GST" asked something narrower and harder: not
                    whether tax applies but how the figure already typed should be READ. That only
                    ever mattered on inclusive pricing, which is the rare case, and it left the
                    common one unanswerable — there was no way to say "no GST on this booking" at
                    all once Charge GST was removed.

                    Two options, no Default BUTTON, which does not drop the default STATE: applyGst
                    starts null, so on a fresh booking neither is lit and the tenant's Accounting
                    Settings still decide. TriToggle shows its Reset link once one is chosen, so
                    null stays reachable. */}
                <div className="mt-4">
                  <TriToggle
                    label="GST"
                    value={form.applyGst}
                    onChange={(v) => {
                      setField("applyGst", v);
                      /* gstInclusive has no control of its own now, so this drives it — carefully.
                         Without GST: inclusive-or-exclusive is a meaningless question, so it goes
                         back to null rather than asserting an answer about a tax that is not there.
                         With GST: the figure typed is pre-tax, which is what an agent means — but
                         ONLY when nothing has been said yet. A booking saved as tax-INCLUSIVE keeps
                         that, because flipping it here would silently restate what the customer
                         owes on a control the agent may only have clicked to confirm. */
                      if (v !== true) setField("gstInclusive", null);
                      else if (form.gstInclusive == null) setField("gstInclusive", false);
                    }}
                    options={[
                      { value: true,  label: "With GST" },
                      { value: false, label: "Without GST" },
                    ]}
                    hint={
                      form.applyGst === true && form.gstInclusive === true
                        ? "This booking was saved tax-inclusive — Total Budget is the all-in price and the taxable value is worked back out of it."
                        : null
                    }
                  />
                </div>

                {/* TCS has no presence on this screen — no control, and no line in the Computed
                    breakdown. Hiding it was not enough on its own: the form went on sending
                    applyTcs: null ("follow the tenant policy"), that policy collects TCS, and a
                    ₹100 booking with ₹5 GST came back with a Total Payable of ₹110 that nothing on
                    screen could explain. The form now sends applyTcs: false — see the defaults —
                    so the breakdown reconciles because there IS no other tax, not because one is
                    being hidden. Accounting Settings are untouched and still govern every other
                    surface. */}
              </div>
            </div>
          </Panel>

          <Panel
            icon={Calculator}
            iconTile="bg-indigo-100 text-indigo-700"
            title="Computed"
            description="What the server will stamp on save"
            action={previewActive && previewState === "loading" ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
            ) : null}
          >
            {!previewActive && (
              <p className="text-xs text-slate-400">
                Enter the customer amount to see GST, total payable and profit — computed by the
                server from your accounting settings.
              </p>
            )}
            {previewActive && previewState === "error" && (
              <p className="text-xs text-slate-400">
                Preview unavailable right now. Every figure is still computed authoritatively on save.
              </p>
            )}
            {previewActive && preview && (
              <div className={`space-y-2 transition-opacity ${previewState === "loading" ? "opacity-60" : ""}`}>
                {/* Under inclusive pricing the base is DERIVED from the gross, so it differs from
                    what was typed — and it is the figure the booking actually stores and profits
                    off. Shown only when the two disagree, so exclusive bookings keep the old panel. */}
                {preview.customerAmount != null
                  && Number(preview.customerAmount) !== previewAmount && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400">Taxable value</span>
                    <span className="font-bold text-slate-700">{inr(preview.customerAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">GST</span>
                  <span className="font-bold text-slate-700">
                    {form.gstInclusive === true ? "incl. " : "+ "}{inr(preview.gst)}
                  </span>
                </div>
                {/* No TCS row. It is not dropped from the MATH — Total Payable below is the
                    server's figure and still has any TCS inside it — only from the breakdown, in
                    line with TCS no longer being something this screen asks about. */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-xs font-bold text-slate-600">Total Payable</span>
                  <span className="text-sm font-extrabold text-slate-900">{inr(preview.totalPayable)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">Balance Due</span>
                  <span className="font-bold text-slate-700">{inr(preview.pendingAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                  <span className="font-semibold text-slate-400">Net Profit</span>
                  <span className={`font-bold ${Number(preview.netProfit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {inr(preview.netProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">Payment Status</span>
                  <span className={`font-bold ${PAY_STATUS_TONE[preview.paymentStatus] || "text-slate-600"}`}>
                    {PAY_STATUS_LABEL[preview.paymentStatus] || preview.paymentStatus || "—"}
                  </span>
                </div>
                <p className="pt-1 text-[10.5px] font-medium text-slate-400">
                  Computed by the server from your accounting settings — never in the browser.
                </p>
              </div>
            )}
          </Panel>
        </aside>
        </div>

        {/* ── Final action area ────────────────────────────────────────────────────────────────
            Assigned To lives here rather than in a card up the page: it is a fact about the RECORD,
            not the trip, and it is the last decision taken — who owns this. Stacks above the
            buttons on phones.

            Booking Date has no field. It is not something an agent decides, it is when the booking
            was taken — `form.bookingDate` still defaults to today() and still goes in the payload,
            so the record is stamped exactly as before; there is simply no box inviting someone to
            backdate it by hand. Edit mode still loads whatever the booking was created with, and
            sends it back unchanged.

            Special assistance sits beside it. Both are last-thing-before-saving questions, and the
            checkbox is unticked on the large majority of bookings — as a band of its own inside
            Customer Details it cost a rule and a line of padding on every record to say "no". Here
            it rides along in space the footer already had.

            The row is a wrapper now, not the flex itself: ticking the box opens a three-field panel
            that must NOT try to share a line with the buttons, so it renders full width underneath
            them instead. */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:max-w-lg">
            <Field label="Assigned To" optional>
              <SearchableSelect
                options={assigneeOptions}
                value={String(form.assignedUserId ?? "")}
                onChange={(next) => setField("assignedUserId", next)}
                placeholder="Current user"
                searchPlaceholder="Search team member..."
                icon={UserCheck}
                accent="blue"
                advanceOnSelect
                className="hover:border-slate-300"
              />
            </Field>
            {/* pb-2.5 lines the checkbox up with the middle of the select beside it rather than its
                baseline — items-end on a control that is one line tall next to one that carries a
                label above it would otherwise leave it floating. */}
            <label className="flex w-fit cursor-pointer items-center gap-2 pb-2.5 text-sm font-semibold text-slate-700">
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
              <Accessibility className="h-4 w-4 text-teal-600" /> Special assistance
            </label>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
            <p className="text-xs text-slate-500"><span className="font-bold text-red-500">*</span> Required fields must be completed before {editing ? "saving" : "creating"} the booking.</p>
            <div className="flex gap-2">
            <button type="button" onClick={() => navigate(-1)} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">Cancel</button>
            {/* Added in the create-form redesign — mirrors the header action so the clerk does not
                have to scroll back up at the end of a record. */}
            {!editing && <button type="button" onClick={(event) => handleSubmit(event, { addAnother: true })} disabled={submitting || searchingCustomer} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:flex-none">
              <Plus className="h-4 w-4" /> Save &amp; New
            </button>}
            <button type="submit" disabled={submitting || searchingCustomer} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? (editing ? "Saving Changes..." : "Creating Booking...") : editing ? "Save Changes" : "Create Booking"}
            </button>
            </div>
          </div>
          </div>

          {/* Full width, below the buttons. Three fields cannot share a line with Cancel / Save &
              New / Create Booking, and pushing the actions around every time the box is ticked
              would move the primary button out from under the cursor. */}
          {form.specialAssistanceRequired && (
            <div className="mt-4 grid gap-3 rounded-lg border border-teal-100 bg-teal-50/40 p-3 lg:grid-cols-[1fr_150px_1fr]">
              <div className="flex flex-wrap gap-2">
                {ASSISTANCE_TYPES.map((type) => {
                  const selected = form.specialAssistanceTypes.includes(type);
                  return <button key={type} type="button" onClick={() => toggleAssistanceType(type)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{type}</button>;
                })}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Passengers</label>
                {/*   totalTravellers is derived from `form`, so the cap
                    holds regardless of which card the counters themselves live in. */}
                <input type="number" min="1" max={Math.max(totalTravellers, 1)} value={form.assistancePassengerCount} onFocus={(event) => event.target.select()} onChange={(event) => setField("assistancePassengerCount", event.target.value)} className={controlClass("assistancePassengerCount")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Assistance Notes</label>
                <input value={form.specialAssistanceNotes} onChange={(event) => setField("specialAssistanceNotes", event.target.value)} placeholder="Specific support required" className={controlClass("specialAssistanceNotes")} />
              </div>
            </div>
          )}
        </div>
      </main>
    </form>
  );
}
