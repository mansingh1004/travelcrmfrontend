import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeIndianRupee,
  CalendarCheck2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  IndianRupee,
  LoaderCircle,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Store,
  Plus,
  RotateCcw,
  Search,
  UserCheck,
} from "lucide-react";

import bookingService from "../api/bookingService";
import FastItinerary from "../components/FastItinerary";
import FastTravelDetails from "../components/FastTravelDetails";
import { customerService } from "@features/customers";
import { leadService, SearchableSelect } from "@features/leads";
import { vendorService } from "@features/vendors";
import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";
import { buildAdultPayload, deriveAdultBreakdown, getAdultBreakdownError } from "@shared/lib/adultBreakdown";
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

const SERVICES = ["Hotel", "Flight", "Sightseeing", "Cruise", "Vehicle", "Visa", "Passport", "Add-on"];
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
  customerName: "",
  customerEmail: "",
  customerCity: "",
  birthday: "",
  anniversary: "",
  destinationId: "",
  destination: "",
  travelDate: "",
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
  itinerary: [{ id: 1, destinationId: "", destination: "", cityId: "", city: "", nights: "2" }],
  services: [],
  tripNotes: "",
  customerAmount: "",
  // Supplier the vendorCost is owed to. Empty = none chosen, which also keeps vendorCost disabled.
  vendorPublicId: "",
  vendorCost: "",
  paidAmount: "0",
  // Drives TCS when the tenant's policy is overseas-only. The DTO always had this field; the form
  // never sent it, so an overseas booking silently under-collected TCS. Explicit checkbox — the
  // package-type list (Family/Honeymoon/...) carries no domestic-vs-overseas signal to derive from.
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
  applyTcs: null,
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
  return (
    <div>
      <span className="block text-[11px] font-semibold text-slate-600">{label}</span>
      <div className="mt-1.5 inline-flex w-full rounded-lg border border-slate-200 bg-white p-0.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-all ${
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
      {hint && <p className="mt-1 text-[10px] font-normal leading-snug text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({ icon: Icon, title, description, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
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

export default function BookingFormPage() {
  const navigate = useNavigate();
  const { leadId: routeLeadId, id: routeBookingId } = useParams();
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
    const itinerary = Array.isArray(lead.itinerary) && lead.itinerary.length
      ? lead.itinerary.map((item) => ({
          id: itinerarySequence++,
          destinationId: item.destinationId || item.destination?.id || item.destination?.publicId || "",
          destination: typeof item.destination === "string" ? item.destination : item.destination?.name || "",
          cityId: item.cityId || item.city?.id || item.city?.publicId || "",
          city: typeof item.city === "string" ? item.city : item.city?.name || "",
          nights: String(item.nights ?? 0),
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
      customerAmount: lead.budget != null ? String(lead.budget) : current.customerAmount,
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
        const adultPrefill = deriveAdultBreakdown({
          totalAdults: travellers.totalAdults,
          male: travellers.male,
          female: travellers.female,
        });
        const itinerary = Array.isArray(snapshot.itinerary) && snapshot.itinerary.length > 0
          ? snapshot.itinerary.map((item) => ({
              id: itinerarySequence++,
              destinationId: "",
              destination: item.destination || "",
              cityId: "",
              city: item.city || "",
              nights: String(item.nights ?? 0),
            }))
          : [{
              id: itinerarySequence++, destinationId: booking.destinationId || "",
              destination: booking.destinationSnapshot || "", cityId: "", city: "", nights: "1",
            }];

        loadedRef.current = {
          travelDate: dateInput(booking.travelDate),
          customerAmount: booking.customerAmount == null ? "" : String(booking.customerAmount),
          vendorPublicId: booking.vendorPublicId || "",
          vendorCost: booking.vendorCost == null ? "" : String(booking.vendorCost),
          paidAmount: booking.paidAmount == null ? "0" : String(booking.paidAmount),
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
          birthday: dateInput(customer?.birthday || customer?.birthDate),
          anniversary: dateInput(customer?.anniversary || customer?.anniversaryDate),
          destinationId: booking.destinationId || "",
          destination: booking.destinationSnapshot || "",
          travelDate: dateInput(booking.travelDate),
          bookingDate: dateInput(booking.bookingDate),
          packageType: snapshot.packageType || "",
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
          applyTcs: booking.applyTcs ?? null,
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

  const addItineraryRow = () => setForm((current) => ({
    ...current,
    itinerary: [...current.itinerary, {
      id: itinerarySequence++, destinationId: "", destination: "", cityId: "", city: "", nights: "1",
    }],
  }));

  const updateItineraryRow = (id, field, value) => {
    setForm((current) => {
      const index = current.itinerary.findIndex((item) => item.id === id);
      const itinerary = current.itinerary.map((item) => item.id === id ? { ...item, [field]: value } : item);
      const firstRow = index === 0;
      return {
        ...current,
        itinerary,
        ...(firstRow && field === "destination" ? { destination: value || current.destination } : {}),
        ...(firstRow && field === "destinationId" ? { destinationId: value || current.destinationId } : {}),
      };
    });
  };

  const removeItineraryRow = (id) => setForm((current) => ({
    ...current,
    itinerary: current.itinerary.length > 1
      ? current.itinerary.filter((item) => item.id !== id)
      : current.itinerary,
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
        departure: {
          country: form.departCountry.trim() || null,
          city: form.departCity.trim() || null,
          mode: form.departureMode || null,
          ...(form.departureMode === "Flight / Airport" ? {
            airport: form.departureAirport.trim() || null,
            airportCode: form.airportCode.trim().toUpperCase() || null,
            preferredTime: form.preferredFlightTime || null,
          } : {}),
          ...(form.departureMode === "Train / Rail" ? {
            railwayStation: form.railwayStation.trim() || null,
            trainClass: form.trainClass.trim() || null,
            preferredTime: form.preferredTrainTime || null,
          } : {}),
          ...(form.departureMode === "Car / Road" ? {
            pickupAddress: form.pickupAddress.trim() || null,
            pickupDateTime: form.pickupDateTime || null,
            vehiclePreference: form.vehiclePreference.trim() || null,
          } : {}),
        },
        travellers: {
          rooms: Number(form.rooms) || 0,
          male: adultPayload.male,
          female: adultPayload.female,
          totalAdults: adultPayload.totalAdults,
          children: Number(form.children) || 0,
          infants: Number(form.infants) || 0,
          extraBeds: Number(form.extraBeds) || 0,
        },
        specialAssistance: {
          required: form.specialAssistanceRequired,
          types: form.specialAssistanceRequired ? form.specialAssistanceTypes : [],
          passengerCount: form.specialAssistanceRequired ? Number(form.assistancePassengerCount) || 0 : 0,
          notes: form.specialAssistanceRequired ? form.specialAssistanceNotes.trim() || null : null,
        },
        itinerary: form.itinerary
          .filter((item) => String(item.destination || "").trim() || String(item.city || "").trim())
          .map((item, index) => ({
            destination: String(item.destination || "").trim() || null,
            city: String(item.city || "").trim() || null,
            nights: Number(item.nights) || 0,
            dayNumber: index + 1,
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
      overseasTourPackage: form.overseasTourPackage,
      applyGst: form.applyGst,
      gstInclusive: form.gstInclusive,
      applyTcs: form.applyTcs,
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
          services: payload.services,
          assignedUserId: payload.assignedUserId,
          tripSnapshot: payload.tripSnapshot,
          status: form.status || null,
        });
        showToast(`Booking ${bookingCode || ""} updated successfully.`, "success");
        navigate(`/BookingDetails/${routeBookingId}`);
        return;
      }

      const booking = unwrap(await bookingService.create(payload));
      writeSticky(form);
      const id = booking?.publicId || booking?.id;

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
  const FOCUSABLE =
    'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
    'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
  const phoneReady = phonePattern.test(String(form.customerPhone || "").trim());
  const customerFieldsLocked = editing ||
    (customerMode === "idle" && !phoneReady) || (customerMode === "existing" && !syncCustomer);

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
          title="Customer Details"
          description="Enter the phone number — an existing customer is matched automatically"
          action={searchingCustomer ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              <LoaderCircle className="h-3 w-3 animate-spin" /> Checking number...
            </span>
          ) : customerMode !== "idle" && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${customerMode === "existing" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
              <Check className="h-3 w-3" /> {customerMode === "existing" ? "Existing customer" : "New customer"}
            </span>
          )}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
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
                  /* OLD — className="rounded-lg …": this was the page's only searchable select, so
                     it was squared off to match the plain inputs. Now there are four of them and
                     they all render like Create Lead's. */
                  className="hover:border-slate-300 disabled:bg-slate-50"
                />
              </Field>
            </div>
            <div className="lg:col-span-5">
              <Field label="Customer Phone" required={!editing} error={errors.customerPhone || errors.customer}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
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
                  {!editing && <button type="button" onClick={() => searchCustomer(form.customerPhone)} disabled={searchingCustomer} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                    {searchingCustomer ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                  </button>}
                </div>
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

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* OLD — required={customerMode === "new"}
                The block can now be open while the lookup is still in flight, and during that
                window this rendered as optional before flipping to required — telling the clerk the
                opposite of what submit will enforce. Only a matched existing customer makes the
                name genuinely optional, so key it off that instead. */}
            <Field label="Customer Name" required={customerMode !== "existing"} error={errors.customerName}>
              <div className="relative">
                <CircleUserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input name="customerName" autoComplete="name" value={form.customerName} onChange={(event) => setField("customerName", event.target.value)} onBlur={() => blurField("customerName")} disabled={customerFieldsLocked} placeholder="Full name" className={`${controlClass("customerName", true)} disabled:bg-slate-50 disabled:text-slate-500`} />
              </div>
            </Field>
            <Field label="Email" optional error={errors.customerEmail}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input name="customerEmail" type="email" autoComplete="email" value={form.customerEmail} onChange={(event) => setField("customerEmail", event.target.value)} onBlur={() => blurField("customerEmail")} disabled={customerFieldsLocked} placeholder="name@email.com" className={`${controlClass("customerEmail", true)} disabled:bg-slate-50`} />
              </div>
            </Field>
            <Field label="City" optional>
              <input value={form.customerCity} onChange={(event) => setField("customerCity", event.target.value)} disabled={customerFieldsLocked} placeholder="Customer city" className={`${controlClass("customerCity")} disabled:bg-slate-50`} />
            </Field>
            <Field label="Birth Date" optional>
              <input type="date" value={form.birthday} onChange={(event) => setField("birthday", event.target.value)} disabled={customerFieldsLocked} className={`${controlClass("birthday")} disabled:bg-slate-50`} />
            </Field>
            <Field label="Anniversary" optional>
              <input type="date" value={form.anniversary} onChange={(event) => setField("anniversary", event.target.value)} disabled={customerFieldsLocked} className={`${controlClass("anniversary")} disabled:bg-slate-50`} />
            </Field>
          </div>
        </Panel>

        {/* OLD — description="Core booking, destination and commercial information"
            The money fields moved to the sticky rail, so "commercial" no longer lives here. */}
        <Panel icon={CalendarCheck2} title="Booking Details" description="Core booking and destination information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* OLD — a native <select name="destination"> with the same options. Replaced with the
                combobox for the search; `name` stays on the trigger so validate()'s
                querySelector('[name="destination"]').focus() still lands on this control. */}
            <Field label="Destination" required error={errors.destination}>
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
                icon={MapPin}
                accent="blue"
                advanceOnSelect
                className="hover:border-slate-300"
              />
              {destinationError && <p className="text-xs text-amber-600">{destinationError}</p>}
            </Field>
            <Field label="Package Type" optional>
              <div className="relative">
                <PackageCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={form.packageType} onChange={(event) => setField("packageType", event.target.value)} className={`${controlClass("packageType", true)} appearance-none pr-9`}>
                  <option value="">Select package</option>
                  {PACKAGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
            <Field label="Booking Date" optional>
              <input type="date" value={form.bookingDate} onChange={(event) => setField("bookingDate", event.target.value)} className={controlClass("bookingDate")} />
            </Field>
            {/* OLD — native <select> over the assignee list. Same swap as Destination: a tenant with
                a full sales floor could not type a colleague's name to find them. */}
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
            {editing && <Field label="Booking Status" optional>
              <div className="relative">
                <CalendarCheck2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={form.status} onChange={(event) => setField("status", event.target.value)} className={`${controlClass("status", true)} appearance-none pr-9`}>
                  {[...new Set([form.status, "PENDING", "CONFIRMED", "COMPLETED"])].filter(Boolean).map((status) => (
                    <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>}
          </div>

          {/* OLD — the three money fields (Customer Amount / Vendor Cost / Advance) and the
              client-side "Indicative preview" block sat here, inside Booking Details. Moved to the
              sticky Money rail (right column below) when the server preview landed: the preview
              could only say "GST / TCS calculated on save" because the browser must never guess a
              tax rate — POST /bookings/preview now answers with the tenant's real figures, and the
              rail keeps them in view while the clerk scrolls the trip detail. The inputs themselves
              are unchanged (same name/onBlur/onWheel contract). */}
        </Panel>

        {/* onBlurField added in the create-form redesign so Travel Date validates on blur like the
            fields owned by this page, instead of waiting for submit. */}
        <FastTravelDetails form={form} setField={setField} errors={errors} onBlurField={blurField} />

        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <FastItinerary
            hydrationKey={editing ? routeBookingId : form.leadPublicId || "direct-booking-clean"}
            itinerary={form.itinerary}
            onAdd={addItineraryRow}
            onRemove={removeItineraryRow}
            onUpdate={updateItineraryRow}
          />

          <Panel icon={PackageCheck} title="Services & Notes" description="Confirmed inclusions and instructions">
            <div className="grid grid-cols-2 gap-2">
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
                return (
                  <button key={service} type="button" onClick={() => toggleService(service)} className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"}`}>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{service}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <Field label="Booking / Trip Notes" optional>
                <textarea rows={6} value={form.tripNotes} onChange={(event) => setField("tripNotes", event.target.value)} placeholder="Confirmed preferences, inclusions or internal instructions" className={`${controlClass("tripNotes")} resize-y`} />
              </Field>
            </div>
          </Panel>
        </div>
        </div>

        {/* Money rail — sticky on lg so the amounts and the server-computed figures stay in view
            while the clerk scrolls the trip detail; stacks below the panels on smaller screens.
            The three inputs are the SAME controls that sat in Booking Details (same name/onBlur/
            onWheel contract), so focus-first-invalid and Enter-advance keep working — DOM order
            simply lands them last, right before the footer actions. */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-[72px]">
          <Panel icon={BadgeIndianRupee} title="Money" description="Commercials for this booking">
            <div className="space-y-4">
              <Field label="Customer Amount (INR)" required error={errors.customerAmount}>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="customerAmount" type="number" min="0" step="0.01" value={form.customerAmount} onChange={(event) => setField("customerAmount", event.target.value)} onBlur={() => blurField("customerAmount")} onWheel={(event) => event.currentTarget.blur()} placeholder="0.00" className={controlClass("customerAmount", true)} />
                </div>
              </Field>
              {/* Vendor gates Vendor Cost. The amount used to be asked for on its own and was
                  REQUIRED, so every booking carried a supplier figure with no payee — and the agent
                  had to commit to one at the moment of sale, before anything was actually booked.
                  Now: pick a supplier and the amount opens up; leave it blank and the cost stays 0,
                  with the real spend itemised later in the expense ledger (which reduces profit). */}
              <Field label="Vendor" optional error={errors.vendorPublicId}>
                {/* appearance-none + pr-9 is load-bearing: without it the browser draws its own
                    dropdown arrow AND the ChevronDown below renders, giving two. Same recipe as the
                    Package Type select above — left icon, suppressed native arrow, own chevron. */}
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
                label="Vendor Cost (INR)"
                required={Boolean(form.vendorPublicId)}
                optional={!form.vendorPublicId}
                error={errors.vendorCost}
              >
                <div className="relative">
                  <BadgeIndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="vendorCost" type="number" min="0" step="0.01" value={form.vendorCost} onChange={(event) => setField("vendorCost", event.target.value)} onBlur={() => blurField("vendorCost")} onWheel={(event) => event.currentTarget.blur()} placeholder={form.vendorPublicId ? "0.00" : "Select a vendor first"} disabled={!form.vendorPublicId} className={controlClass("vendorCost", true)} />
                </div>
              </Field>
              <Field label="Advance Collected (INR)" optional error={errors.paidAmount}>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="paidAmount" type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => setField("paidAmount", event.target.value)} onBlur={() => blurField("paidAmount")} onWheel={(event) => event.currentTarget.blur()} placeholder="0.00" className={controlClass("paidAmount", true)} />
                </div>
              </Field>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.overseasTourPackage}
                  onChange={(event) => setField("overseasTourPackage", event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs">
                  <span className="font-semibold text-slate-700">Overseas tour package</span>
                  <span className="block font-normal text-slate-400">TCS is collected on overseas packages when your accounting policy says so</span>
                </span>
              </label>

              {/* ── Tax for THIS booking ─────────────────────────────────────────────────────
                  Each control is tri-state and starts on "Default", which means the tenant's
                  Accounting Settings decide. Only touch one when this particular deal differs —
                  if TCS is wrong on every booking, the fix is the tenant setting, not this. */}
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3">
                <p className="text-xs font-semibold text-slate-700">Tax for this booking</p>
                <p className="mt-0.5 text-[11px] font-normal text-slate-400">
                  Leave on Default to follow your Accounting Settings.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <TriToggle
                    label="Price entered is"
                    value={form.gstInclusive}
                    onChange={(v) => setField("gstInclusive", v)}
                    options={[
                      { value: null,  label: "Default" },
                      { value: false, label: "Excl. GST" },
                      { value: true,  label: "Incl. GST" },
                    ]}
                    hint={
                      form.gstInclusive === true
                        ? "The amount above is the all-in price; the taxable value is derived from it."
                        : null
                    }
                  />
                  <TriToggle
                    label="Charge GST"
                    value={form.applyGst}
                    onChange={(v) => setField("applyGst", v)}
                    options={[
                      { value: null,  label: "Default" },
                      { value: true,  label: "Yes" },
                      { value: false, label: "No" },
                    ]}
                  />
                  <TriToggle
                    label="Collect TCS"
                    value={form.applyTcs}
                    onChange={(v) => setField("applyTcs", v)}
                    options={[
                      { value: null,  label: "Default" },
                      { value: true,  label: "Yes" },
                      { value: false, label: "No" },
                    ]}
                    hint={
                      form.applyTcs === null
                        ? "Domestic packages don't attract TCS — set your policy to Overseas only in Accounting Settings."
                        : null
                    }
                  />
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            icon={Calculator}
            title="Computed"
            description="What the server will stamp on save"
            action={previewActive && previewState === "loading" ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
            ) : null}
          >
            {!previewActive && (
              <p className="text-xs text-slate-400">
                Enter the customer amount to see GST, TCS, total payable and profit — computed by the
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
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">TCS</span>
                  <span className="font-bold text-slate-700">+ {inr(preview.tcs)}</span>
                </div>
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

        <div className="mt-5 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
      </main>
    </form>
  );
}
