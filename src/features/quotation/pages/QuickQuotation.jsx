import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileCheck2,
  Hotel,
  IndianRupee,
  ListChecks,
  LoaderCircle,
  // Aliased, not imported bare: a lucide icon called `Map` shadows the global Map constructor for
  // the whole module, and `new Map()` then throws "Map is not a constructor" at runtime — with a
  // clean build, because nothing about it is a type error.
  Map as MapIcon,
  MapPin,
  PackagePlus,
  Plane,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Ship,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Users,
  X,
  Zap,
} from "lucide-react";

import { leadService } from "@features/leads";
import { hotelService, sightseeingService, vehicleService } from "@features/masters";
// Same-feature relative import, not the barrel: eslint's no-restricted-imports only blocks
// deep CROSS-feature paths, and this component is not part of the quotation feature's public API.
// It is shared internally so both quotation builders create attractions through one form.
// See the note on its declaration in SightseeingTab.
import { SightseeingFormModal } from "../components/SightseeingTab";
import { HotelFormModal } from "../components/HotelTab";
// Relative, not through the feature's own barrel — this file IS part of the quotation feature.
import { templateService } from "../api/templateService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import { usePdfDownload } from "@shared/hooks/usePdfDownload";
import PdfDownloadLoader from "@shared/ui/PdfDownloadLoader";
import { quotationService } from "../api/quotationService";
import QuotationStyleModal from "../components/QuotationStyleModal";
import {
  AIRLINES,
  CABIN_CATS,
  CLASSES,
  CRUISE_TYPES,
  JOURNEY_TYPES,
  TRANSFER,
} from "../Constants";

/* Order matters and is load-bearing: enabledCore, quickQuoteSteps and the Alt+1…8 jumps are all
   rebuilt from THIS list, which is what stops the sections reshuffling by click order. Vehicle leads
   because the rapid lead form's picker leads with it and pre-ticks it — the two lists have to agree
   or the first card would open the second section. */
const CORE_SERVICES = [
  { id: "vehicle", label: "Vehicle", icon: Car, tone: "orange" },
  { id: "hotel", label: "Hotel", icon: Hotel, tone: "violet" },
  { id: "flight", label: "Flight", icon: Plane, tone: "blue" },
  { id: "sightseeing", label: "Sightseeing", icon: MapIcon, tone: "emerald" },
  { id: "cruise", label: "Cruise", icon: Ship, tone: "cyan" },
];

const FIXED_STEPS = [
  { id: "addons", label: "Add-ons", icon: PackagePlus, tone: "rose" },
  { id: "terms", label: "Terms", icon: ListChecks, tone: "amber" },
  { id: "pricing", label: "Pricing", icon: CircleDollarSign, tone: "indigo" },
];
const SHORTCUT_STEPS = ["hotel", "flight", "sightseeing", "vehicle", "cruise", "addons", "terms", "pricing"];

// The accordion's first section. It is NOT a member of `steps` on purpose: `steps` drives the
// save-time validation jumps and the Alt+1…8 shortcuts, both of which are indexed against real
// quotation sections. Services is prepended only where the ORDER matters (Prev/Next, Alt+←/→).
const SERVICES_STEP = "services";
const SERVICES_META = { id: SERVICES_STEP, label: "Services", icon: Sparkles, tone: "violet" };

const TONES = {
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

// Accordion icon tiles: soft pastel square, no border — the card's own 1px border already encloses
// it. TONES is deliberately NOT reused: its other consumer is the Services chip, a button whose
// selected state needs that border, so flattening TONES in place would silently break the chips.
const TILE_TONES = {
  violet: "bg-violet-50 text-violet-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-700",
  cyan: "bg-cyan-50 text-cyan-700",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-700",
  indigo: "bg-indigo-50 text-indigo-600",
};

const controlClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition " +
  "placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";
const QUICK_QUOTE_FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

let nextId = 1;
const rowId = () => `qq-${nextId++}`;
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const addDays = (value, days) => {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};
const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(`${String(checkIn).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(checkOut).slice(0, 10)}T00:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Number.isFinite(days) && days > 0 ? days : 1;
};
const extractList = (response) => {
  const body = response?.data ?? response ?? {};
  const candidates = [body, body?.data, body?.data?.data, body?.content, body?.data?.content, body?.vehicles];
  return candidates.find(Array.isArray) ?? [];
};
const normalizedServices = (lead) =>
  (Array.isArray(lead?.services) ? lead.services : [])
    .map((service) => String(service).trim().toLowerCase());

// Master-data loaders for the panels' comboboxes. Module scope, not useCallback inside the page:
// they close over nothing, and both hosts of the builder (this page and the rapid lead form) need
// the exact same lookups. A platform-synced hotel that its owner deactivated must not be sellable.
// `stars` is an EXACT match on the server (`h.stars = :stars`, HotelRepository), not a floor — so 4
// returns four-star properties only, never "four and up". That is exactly what the comparison
// auto-builder wants (one tier per column) and why the picker leaves it undefined.
const loadHotels = async (query, city, stars) => {
  const response = await hotelService.listHotels({
    q: query || undefined, city: city || undefined, stars: stars || undefined, size: 20,
  });
  return extractList(response)
    .filter((hotel) => {
      const platformOwned = hotel?.platformOwned === true || hotel?.origin === "PLATFORM_SYNC";
      if (!platformOwned) return true;
      return hotel?.syncStatus !== "SOURCE_INACTIVE" && hotel?.marketplaceBookable !== false;
    })
    .slice(0, 20);
};

const loadSightseeing = async (query, destination, city) => {
  const response = destination && city
    ? await sightseeingService.getSightseeingsByCity(destination, city)
    : await sightseeingService.searchSightseeings(query || "");
  const normalized = String(query || "").trim().toLowerCase();
  return extractList(response)
    .filter((item) => !normalized || [item.title, item.city, item.cityName]
      .some((value) => String(value || "").toLowerCase().includes(normalized)))
    .slice(0, 30);
};

const loadVehicles = async (query) => {
  const response = query
    ? await vehicleService.searchVehicles(query)
    : await vehicleService.getAllVehicles();
  return extractList(response).slice(0, 30);
};

/* ── Sticky quote defaults ────────────────────────────────────────────────────────────────────
   The lead form already learned this lesson (CreateLead.jsx's leadEntry:sticky): on a screen worked
   50-100 times a day, the fields an agent sets IDENTICALLY every time are pure retyping. For a
   quotation those are the commercial habits — markup, tax rate, discount type — and the boilerplate
   inclusions/exclusions paragraph, which is agency policy, not deal terms.

   Deliberately NOT sticky: the discount AMOUNT (that is negotiated per deal, and carrying the last
   customer's discount into the next quote is a money bug, not a convenience) and anything derived
   from the lead.

   sessionStorage, not local: it dies with the tab and never leaks between staff on a shared machine
   — same reasoning as the lead form's. Written only after a quotation actually saves, so a
   half-built model the agent abandoned never becomes the next quote's defaults. */
const QUOTE_STICKY_KEY = "quickQuote:sticky";

const readQuoteSticky = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(QUOTE_STICKY_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch { return {}; }
};

/**
 * Remember this quotation's commercial defaults for the next one. Called by BOTH hosts after a
 * successful create — the rapid lead form and the standalone builder — because an agent batching
 * enquiries moves between them and a default that only half the app remembers is worse than none.
 */
export const rememberQuickQuoteDefaults = (model) => {
  if (!model) return;
  try {
    sessionStorage.setItem(QUOTE_STICKY_KEY, JSON.stringify({
      discType: model.pricing?.discType,
      tax: model.pricing?.tax,
      markup: model.pricing?.markup,
      inclusions: model.terms?.inclusions,
      exclusions: model.terms?.exclusions,
      paymentPolicies: model.terms?.paymentPolicies,
      cancellationPolicies: model.terms?.cancellationPolicies,
      bookingTerms: model.terms?.bookingTerms,
    }));
  } catch { /* private mode — sticky is a convenience, never a requirement */ }
};

/**
 * Lead → a fully seeded quote model. Exported as buildQuickQuoteModel because the rapid lead form
 * builds it from the record it is ABOUT to save, not one it has fetched — same shape, no lead id yet.
 */
/* Party + room count → the grouped room lines a stay is priced from.
   Lifted out of initialModel so syncQuickQuotePax can rebuild a stay with the SAME arithmetic the
   seed used. Two copies of "how do travellers split across rooms" is how the room lines start
   disagreeing with the counters they were derived from.

   `template` carries the commercial fields forward — room type, meal plan, price, images. Changing
   the party size must not wipe the ₹6,500 Deluxe the agent already picked; only who is in the room
   and how many of them there are is recomputed. */
const buildRoomLines = ({ adults, children, infants, extraBeds, rooms }, savedAllocations = [], template = null) => {
  const roomCount = Math.max(1, asNumber(rooms, 1));
  const distribute = (total) => Array.from(
    { length: roomCount },
    (_, index) => Math.floor(asNumber(total) / roomCount) + (index < asNumber(total) % roomCount ? 1 : 0),
  );
  const adultSplit = distribute(adults);
  const childSplit = distribute(children);
  const infantSplit = distribute(infants);
  const extraBedSplit = distribute(extraBeds);

  const allocations = savedAllocations.length > 0
    ? savedAllocations
    : Array.from({ length: roomCount }, (_, index) => ({
      roomNumber: index + 1,
      roomCategoryPreference: "Any",
      bedPreference: "Any",
      adults: adultSplit[index],
      children: childSplit[index],
      infants: infantSplit[index],
      extraBeds: extraBedSplit[index],
      childAges: [],
    }));

  /* Nine rooms used to arrive as nine identical room lines, each demanding its own room type, meal
     plan and price — the agent typed the same Deluxe row nine times. Rooms of the SAME SHAPE now
     collapse into ONE line carrying a `rooms` count, which the totals already multiply by
     (sectionTotal.hotel) and the payload already carries (`rooms: room.rooms`), so only the seeding
     was ever the problem.
     Grouped rather than flattened to a single line on purpose: a room-wise plan the agent actually
     filled in — say 7 doubles and 2 triples — still prices as two lines. Collapsing those would drop
     the extra pax silently and under-quote the trip, which is worse than the retyping this fixes.
     The key is every field that can change what one room costs: category, bed, who is in it, extra
     beds, and the child ages a hotel's child policy reads. Ages are sorted because [8,5] and [5,8]
     are the same room to price, and an unsorted key would split them into two lines. */
  const roomShapeKey = (allocation) => JSON.stringify([
    allocation.roomCategoryPreference || "Any",
    allocation.bedPreference || "Any",
    Math.max(1, asNumber(allocation.adults, 1)),
    Math.max(0, asNumber(allocation.children)),
    asNumber(allocation.infants),
    asNumber(allocation.extraBeds),
    [...(Array.isArray(allocation.childAges) ? allocation.childAges : [])].map(String).sort(),
  ]);
  const roomGroups = [];
  const roomGroupIndex = new Map();
  allocations.forEach((allocation) => {
    const key = roomShapeKey(allocation);
    const at = roomGroupIndex.get(key);
    if (at != null) {
      roomGroups[at].rooms += 1;
      return;
    }
    roomGroupIndex.set(key, roomGroups.length);
    roomGroups.push({ allocation, rooms: 1 });
  });

  return roomGroups.map(({ allocation, rooms: roomQty }, groupIndex) => ({
    id: rowId(),
    // roomNumber is the LINE's index, not a physical room — nine rooms on one line still number 1.
    roomNumber: groupIndex + 1,
    roomCategoryPreference: allocation.roomCategoryPreference || "Any",
    bedPreference: allocation.bedPreference || "Any",
    adults: Math.max(1, asNumber(allocation.adults, 1)),
    children: Math.max(0, asNumber(allocation.children)),
    infants: asNumber(allocation.infants),
    extraBeds: asNumber(allocation.extraBeds),
    childAges: Array.isArray(allocation.childAges) ? allocation.childAges : [],
    roomType: template?.roomType ?? "",
    roomTypeMasterPublicId: template?.roomTypeMasterPublicId ?? null,
    platformRoomPublicId: template?.platformRoomPublicId ?? null,
    bedType: template?.bedType ?? "",
    occupancy: template?.occupancy ?? null,
    mealPlan: template?.mealPlan ?? "",
    mealPlanMasterPublicId: template?.mealPlanMasterPublicId ?? null,
    platformMealPlanPublicId: template?.platformMealPlanPublicId ?? null,
    pricePerRoom: template?.pricePerRoom ?? "",
    masterBaseRate: template?.masterBaseRate ?? null,
    rateSource: template?.rateSource ?? "MISSING",
    imagePath: template?.imagePath ?? "",
    rooms: roomQty,
  }));
};

/**
 * Re-split the party across a stay's room lines after the counters ABOVE the builder change.
 *
 * The seed already distributes correctly — 6 adults over 3 rooms has always been [2,2,2]. The gap is
 * what happens AFTER: CreateLead stops re-seeding the moment the quote is touched (so that typing an
 * itinerary stop cannot wipe entered prices), and picking a hotel counts as touching it. From then on
 * the counters and the room lines drifted apart silently, which is how a party of 6 got quoted as 2.
 *
 * Same contract as syncQuickQuoteServices: returns the SAME object when nothing changed, so calling
 * it from an effect cannot loop.
 *
 * A stay where the agent has hand-edited ANY room line's pax is left completely alone. Per stay, not
 * per line, on purpose — the lines of one stay are a single distribution, so rebuilding half of it
 * around an edited line produces a split that matches neither what the agent typed nor the counters.
 * `paxTouched` is what says "the agent has shaped this stay themselves".
 */
export const syncQuickQuotePax = (model, counts) => {
  if (!model?.hotel?.rows?.length) return model;
  let changed = false;
  const rows = model.hotel.rows.map((stay) => {
    const lines = stay.roomLines || [];
    if (lines.some((line) => line.paxTouched)) return stay;
    const rebuilt = buildRoomLines(counts, [], lines[0] || null);
    // Compare on what this function actually owns. Ids are regenerated every call, so an identity
    // check would report a change on every keystroke anywhere on the lead form.
    const shapeOf = (list) => JSON.stringify(list.map((line) => [
      line.adults, line.children, line.infants, line.extraBeds, line.rooms,
      line.roomCategoryPreference, line.bedPreference,
    ]));
    if (shapeOf(lines) === shapeOf(rebuilt)) return stay;
    changed = true;
    return { ...stay, roomLines: rebuilt };
  });
  return changed ? { ...model, hotel: { ...model.hotel, rows } } : model;
};

export function initialModel(lead) {
  if (!lead) return null;
  const sticky = readQuoteSticky();
  const itinerary = (Array.isArray(lead.itinerary) ? lead.itinerary : [])
    .filter((stop) => stop && (stop.city || stop.destination));
  const services = normalizedServices(lead);
  /* No forced fallback. This used to push "hotel" whenever the lead named no CORE service, which
     turned a visa- or insurance-only enquiry into a quote that demanded hotel rooms before it would
     save. Those services already arrive as add-on rows below, and a quote made of add-ons alone is
     valid — see validateQuickQuote. */
  const enabledCore = CORE_SERVICES.map(({ id }) => id).filter((id) => services.includes(id));

  const adults = asNumber(lead.adults ?? lead.totalAdults, 1);
  const children = asNumber(lead.children);
  const infants = asNumber(lead.infants);
  const totalPax = Math.max(1, adults + children + infants);
  const rooms = Math.max(1, asNumber(lead.rooms, 1));
  const travelDate = String(lead.travelDate || "").slice(0, 10);

  let offset = 0;
  const stays = itinerary.map((stop) => {
    const nights = Math.max(1, asNumber(stop.nights, 1));
    const stay = {
      destination: stop.destination || "",
      city: stop.city || stop.destination || "",
      nights,
      checkIn: addDays(travelDate, offset),
      checkOut: addDays(travelDate, offset + nights),
    };
    offset += nights;
    return stay;
  });
  const firstStay = stays[0] || { destination: "", city: "", nights: 1, checkIn: travelDate, checkOut: addDays(travelDate, 1) };
  const lastStay = stays[stays.length - 1] || firstStay;

  const sightseeingDays = [];
  let day = 1;
  stays.forEach((stay) => {
    for (let index = 0; index < stay.nights; index += 1) {
      sightseeingDays.push({
        id: rowId(),
        day: day++,
        city: stay.city,
        destination: stay.destination,
        date: addDays(travelDate, sightseeingDays.length),
        attraction: "",
        startTime: "",
        description: "",
        transfer: "Private",
        imagePath: "",
        pricePerPax: 0,
        pax: totalPax,
      });
    }
  });
  /* ── The departure day — what made this "4 Nights / 5 Days" produce 4 days ───────────────────
     The loop above emits one row per NIGHT, so Σ nights rows: a 4N trip got Day 1-4 and the day the
     customer actually flies home was missing from the itinerary entirely.

     The full quotation flow has always been right, and this mirrors it rather than inventing a
     second rule: Createquotation.jsx builds `max(nights,1)` day-map entries per stop and then, when
     `totalNights > 0`, appends ONE final departure day pinned to the LAST city (Createquotation.jsx
     "Nights available hain to final N+1 departure day add karo"), which SightseeingTab's
     buildItineraryDay() renders pre-filled as "Departure from <city>" at ₹0. Same shape here, so
     both flows now yield N+1 for every night/day combination — not just 4N/5D.

     Pre-filled, not blank, and that is deliberate: ROW_HAS_CONTENT.sightseeing keys off `attraction`,
     so a blank departure row would be silently dropped from both the running total and the saved
     quotation — i.e. the bug again, one layer down. pricePerPax stays 0, so it adds nothing to the
     subtotal. The PDF templates need no change: all three iterate `q.sightseeing.days` and this is
     simply one more day. */
  const totalNights = stays.reduce((sum, stay) => sum + stay.nights, 0);
  if (stays.length > 0 && totalNights > 0) {
    sightseeingDays.push({
      id: rowId(),
      day: day++,
      city: lastStay.city,
      destination: lastStay.destination,
      date: addDays(travelDate, sightseeingDays.length),
      isDepartureDay: true,
      attraction: lastStay.city ? `Departure from ${lastStay.city}` : "Departure",
      description: lastStay.city ? `Check-out and departure from ${lastStay.city}.` : "Check-out and departure.",
      startTime: "", transfer: "Private", imagePath: "", pricePerPax: 0, pax: totalPax,
    });
  }

  if (sightseeingDays.length === 0) {
    sightseeingDays.push({
      id: rowId(), day: 1, city: firstStay.city, destination: firstStay.destination,
      date: travelDate, attraction: "", startTime: "", description: "", transfer: "Private",
      imagePath: "", pricePerPax: 0, pax: totalPax,
    });
  }

  const supportServices = services.filter((service) => !CORE_SERVICES.some(({ id }) => id === service));
  const destination = itinerary[0]?.destination || "";
  const nights = itinerary.reduce((sum, stop) => sum + asNumber(stop.nights), 0);
  const savedAllocations = Array.isArray(lead.roomAllocations) ? lead.roomAllocations : [];
  // One implementation, shared with syncQuickQuotePax — see buildRoomLines.
  const seededRoomLines = buildRoomLines(
    { adults, children, infants, extraBeds: asNumber(lead.extraBeds), rooms },
    savedAllocations,
  );

  return {
    title: [lead.customerName, destination, nights ? `${nights}N` : ""].filter(Boolean).join(" – ") || "Quotation",
    templateStyle: "CLASSIC",
    enabledCore,
    /* Comparison alternatives. EMPTY is the normal case and means "not a comparison" — every quote
       that exists today has none, quickQuotePayload then emits no `options` key at all, and the
       server reads that as "leave the comparison alone". Nothing below this line changes for a
       quote the agent never turns into a comparison.

       When it is non-empty each entry carries its OWN `hotel` and `vehicle` in exactly the shape
       model.hotel / model.vehicle have, which is what lets HotelPanel and VehiclePanel be pointed
       at an option with no changes to either. The model's own hotel/vehicle stay put: they seeded
       the first option and remain the SHARED fallback the server inherits from. */
    options: [],
    /* Which option the Hotel/Vehicle panels are editing. UI state — never sent. */
    activeOptionId: null,
    hotel: {
      title: "Hotel Details",
      notes: "",
      rows: (stays.length ? stays : [firstStay]).map((stay) => ({
        id: rowId(), name: "", city: stay.city, checkIn: stay.checkIn, checkOut: stay.checkOut,
        refundable: true, stars: 0, imagePath: "", hotelMasterPublicId: null,
        platformHotelPublicId: null, hotelOrigin: null, platformOwned: false, syncStatus: null,
        roomTypeOptions: [], mealPlanOptions: [],
        // Fresh ids per stay — two stays must never share a room line's id, or updating one edits both.
        roomLines: seededRoomLines.map((line) => ({ ...line, id: rowId() })),
      })),
    },
    flight: {
      title: "Flight Details",
      journey: "Round Trip",
      rows: [{
        id: rowId(), airline: "", flightNo: "", class: "Economy", from: lead.departCity || "",
        to: firstStay.city || destination, depDate: travelDate, depTime: "", arrDate: travelDate,
        arrTime: "", pricePerPax: 0, pax: totalPax, cabin: 7, checkin: 15, connections: [],
      }],
    },
    sightseeing: { title: "Sightseeing", notes: "", rows: sightseeingDays },
    vehicle: {
      title: "Vehicle Details",
      rows: [{
        id: rowId(), type: "", model: "", pickup: lead.departCity || firstStay.city,
        drop: lastStay.city, startDate: travelDate, endDate: lastStay.checkOut,
        pricePerVehicle: 0, qty: 1, notes: "", imagePath: "", capacity: null,
      }],
    },
    cruise: {
      title: "Cruise Details",
      rows: [{
        id: rowId(), name: "", type: "", depPort: firstStay.city, arrPort: lastStay.city,
        depDate: travelDate, nights: Math.max(1, nights), cabin: "", pricePerPax: 0, pax: totalPax,
      }],
    },
    addons: {
      rows: supportServices.map((service) => ({
        id: rowId(), serviceType: service.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        description: "", quantity: 1, pricePerUnit: 0, included: true,
      })),
    },
    /* Sticky wins over the constant, but only where the agent actually saved something — `??` and
       `||` rather than a blind spread, so a cleared field falls back to the sensible default instead
       of to blank. Inclusions keep their service-aware derivation when nothing is remembered: those
       lines are built from THIS quote's ticked services and a remembered list cannot know them. */
    terms: {
      inclusions: sticky.inclusions || [
        enabledCore.includes("hotel") ? "Accommodation as specified" : "",
        enabledCore.includes("sightseeing") ? "Sightseeing as per itinerary" : "",
        enabledCore.includes("vehicle") ? "Transfers as specified" : "",
        enabledCore.includes("flight") ? "Flights as specified" : "",
      ].filter(Boolean).join("\n"),
      exclusions: sticky.exclusions || "Personal expenses\nAnything not mentioned in inclusions",
      paymentPolicies: sticky.paymentPolicies || "",
      cancellationPolicies: sticky.cancellationPolicies || "",
      bookingTerms: sticky.bookingTerms || "Rates and availability are subject to confirmation.",
    },
    // discount stays 0 — see the note on QUOTE_STICKY_KEY: carrying a negotiated discount into the
    // next customer's quote is a money bug wearing a convenience costume.
    pricing: {
      discount: 0,
      discType: sticky.discType || "Fixed",
      tax: sticky.tax ?? 0,
      markup: sticky.markup ?? 0,
    },
  };
}

function Field({ label, required, hint, children }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-xs font-bold text-slate-600">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Input(props) {
  return <input data-quick-field className={controlClass} {...props} />;
}

function Select({ options, placeholder = "Select", ...props }) {
  return (
    <div className="relative">
      <select data-quick-field className={`${controlClass} appearance-none pr-9`} {...props}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/* `addScope` marks this card as the target Shift+Enter should add INTO. Only the hotel panel needs
   it: its "Add room type" button repeats per stay, so an unscoped lookup would always find the first
   hotel's button and quietly add a room to the wrong stay. Every other panel has one trailing add
   button and falls back to the panel-level lookup. */
function SectionCard({ title, icon: Icon, badge, action, addScope = false, children }) {
  return (
    // Flat on purpose: this card is always nested INSIDE an accordion section's white card, so a
    // second shadow, a tinted header and a white-on-white ringed tile stacked three surfaces on top
    // of each other. One inner border, one pastel tile, nothing else.
    /* NOT overflow-hidden.
       Every picker on this screen renders its dropdown as an absolutely-positioned list inside this
       card. With overflow-hidden, any part of that list extending past the card's bottom edge was
       CLIPPED — so a picker on the last row of a short card showed two options and nothing else,
       and the option being reached for simply was not on screen.
       Nothing here needs the clip: the header carries a border, not a background, and every child
       that paints to an edge (the platform banner, images) has its own rounding and sits inside the
       p-4. */
    <section data-quick-addscope={addScope ? "true" : undefined} className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {badge && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{badge}</span>}
        <div className="ml-auto">{action}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function IconButton({ label, danger = false, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${danger
        ? "border-red-200 text-red-500 hover:bg-red-50"
        : "border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"}`}
      {...props}
    />
  );
}

/* Master-lookup cache, module scope so it outlives every row, panel and section switch.
   Keyed by the caller's own cacheKey (which encodes WHICH loader and its scope — the hotel one is
   per-city, the sightseeing one per destination+city) plus the typed query, so two rows in different
   cities can never read each other's results.

   30s TTL: long enough that walking back to a field, or adding a second room in the same city, is
   instant; short enough that a hotel added in Masters during the same call still shows up. Bounded
   at 60 entries — an agent working one enquiry touches a handful of scopes, and an unbounded Map on
   a screen that lives for a whole shift is a leak.

   The point is not the request count. It is that focusing a field that ALREADY has a value used to
   put a spinner over it 250ms later and re-render the list under the agent's cursor. */
const LOOKUP_TTL_MS = 30_000;
const LOOKUP_CACHE_MAX = 60;
const lookupCache = new Map();

const readLookupCache = (key) => {
  const hit = lookupCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LOOKUP_TTL_MS) { lookupCache.delete(key); return null; }
  return hit.rows;
};

const writeLookupCache = (key, rows) => {
  lookupCache.set(key, { at: Date.now(), rows });
  while (lookupCache.size > LOOKUP_CACHE_MAX) lookupCache.delete(lookupCache.keys().next().value);
};

function AsyncCombobox({ value, onValueChange, onSelect, loadOptions, cacheKey, getLabel, getSublabel, getBadge, getImage, placeholder }) {
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const loaderRef = useRef(loadOptions);

  useEffect(() => {
    loaderRef.current = loadOptions;
  }, [loadOptions]);

  useEffect(() => {
    if (!focused) return undefined;
    const query = String(value || "").trim();
    const key = `${cacheKey || "default"}::${query}`;

    // Cache hit paints synchronously — no debounce, no spinner, no list rebuilding under the cursor.
    const cached = readLookupCache(key);
    if (cached) {
      setOptions(cached);
      setHighlight(0);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await loaderRef.current(query);
        const list = Array.isArray(rows) ? rows : [];
        writeLookupCache(key, list);
        if (active) {
          setOptions(list);
          setHighlight(0);
        }
      } catch {
        // Deliberately NOT cached: a failed lookup must be retried on the next focus, not remembered
        // as "this city has no hotels" for the next 30 seconds.
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [focused, value, cacheKey]);

  const pick = (option) => {
    onSelect(option);
    setFocused(false);
    setOptions([]);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        data-quick-field
        role="combobox"
        aria-expanded={focused}
        aria-autocomplete="list"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((index) => options.length ? (index + 1) % options.length : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((index) => options.length ? (index - 1 + options.length) % options.length : 0);
          } else if (event.key === "Enter" && options[highlight]) {
            event.preventDefault();
            event.stopPropagation();
            pick(options[highlight]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setFocused(false);
          }
        }}
        placeholder={placeholder}
        className={`${controlClass} pl-9 pr-9`}
      />
      {loading ? (
        <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
      ) : value ? (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onValueChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {focused && !loading && options.length > 0 && (
        /* onMouseDown preventDefault on the LIST, not just on each option.
           The input closes the panel 120ms after it blurs. Each <li> already prevented that, but the
           <ul> itself did not — so pressing on the SCROLLBAR, or on the padding between options,
           blurred the input and the list disappeared mid-scroll. With more than ~5 results (any
           vehicle or sightseeing search) scrolling is the normal way to reach an option, which is
           why this reads as "the dropdown does not respond when I try to select". */
        <ul
          role="listbox"
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {options.map((option, index) => (
            <li
              key={option.publicId || option.id || `${getLabel(option)}-${index}`}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(option)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${index === highlight ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {getImage?.(option) && (
                  <img
                    src={getImage(option)}
                    alt=""
                    loading="lazy"
                    className="h-10 w-12 shrink-0 rounded-md border border-slate-200 object-cover"
                  />
                )}
                <span className="block min-w-0 flex-1 truncate font-semibold">{getLabel(option)}</span>
                {getBadge?.(option) && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-700">
                    <ShieldCheck className="h-3 w-3" /> {getBadge(option)}
                  </span>
                )}
              </span>
              {getSublabel?.(option) && <span className="block truncate text-xs text-slate-400">{getSublabel(option)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Every focusable field of the OPEN panel, in document order. Three keyboard behaviours read this
   list — Enter walks it, Shift+Enter uses its length to find the row it just created, and the reveal
   effect focuses its head — so it is one function rather than three copies of the selector. Hidden
   panels are excluded by [hidden]; offsetParent filters what is merely collapsed inside a visible
   one (a departure-mode block, a folded room plan). */
const visibleQuickFields = () =>
  [...document.querySelectorAll('[data-quick-panel]:not([hidden]) [data-quick-field]:not([disabled])')]
    .filter((field) => field.offsetParent !== null);

const masterOptionKey = (option, fallback = "") => String(
  option?.publicId || option?.roomTypeId || option?.mealPlanId || option?.id || fallback,
);

const masterRoomRate = (roomType) => {
  if (roomType?.baseRate === "" || roomType?.baseRate == null) return null;
  const rate = Number(roomType.baseRate);
  return Number.isFinite(rate) ? rate : null;
};

/**
 * The three price fields a room line carries, seeded from the master.
 *
 * <p>`RoomType.baseRate` is documented on the entity as the tenant's own SELLING rate per room per
 * night — not a vendor cost — so putting it in the price box is the number the agent was about to
 * type, not a margin leak, and the quote-level markup still applies on top of it. Until now the rate
 * was read off the master, printed in the room-type dropdown label, and then thrown away: every room
 * line of every option was typed by hand, which is most of what made a 3-column comparison feel like
 * three quotations. Typing over it flips rateSource to MANUAL (the price input's own onChange), so
 * "where did this number come from" stays answerable. MASTER/MANUAL/MISSING is the vocabulary
 * QuotationHotel.rateSource already documents — MASTER simply had no producer on this screen.
 */
const seedRoomRate = (baseRate) => ({
  pricePerRoom: baseRate == null ? "" : String(baseRate),
  masterBaseRate: baseRate,
  rateSource: baseRate == null ? "MISSING" : "MASTER",
});

/**
 * The stay patch that choosing `hotel` produces: its room-type and meal-plan menus, and this stay's
 * room lines re-derived against them with rates seeded from the master.
 *
 * <p>Module scope, and pure — it returns the patch instead of applying it — because two callers need
 * byte-identical behaviour: the Hotel panel's picker, and the comparison auto-builder, which fills
 * whole columns without the panel ever being mounted. Duplicating this was how a column could end up
 * with a hotel name and no room rates.
 */
const hotelStayPatch = (stay, hotel) => {
  const roomTypeOptions = Array.isArray(hotel.roomTypes)
    ? hotel.roomTypes.filter((room) => room?.active !== false)
    : [];
  const mealPlanOptions = Array.isArray(hotel.mealPlans)
    ? hotel.mealPlans.filter((meal) => meal?.active !== false)
    : [];
  const defaultMeal = mealPlanOptions[0] || null;
  const hotelImage = hotel.imagePath || hotel.imageUrl || "";
  const roomLines = (stay.roomLines || []).map((line) => {
    const roomType = findPreferredRoomType(roomTypeOptions, line);
    const baseRate = masterRoomRate(roomType);
    return {
      ...line,
      roomType: roomType?.name || (line.roomCategoryPreference !== "Any" ? line.roomCategoryPreference : ""),
      roomTypeMasterPublicId: roomType?.publicId || null,
      platformRoomPublicId: roomType?.platformSourcePublicId || null,
      bedType: roomType?.bedType || (line.bedPreference !== "Any" ? line.bedPreference : ""),
      occupancy: roomType?.occupancy == null ? null : asNumber(roomType.occupancy),
      mealPlan: defaultMeal?.name || "",
      mealPlanMasterPublicId: defaultMeal?.publicId || null,
      platformMealPlanPublicId: defaultMeal?.platformSourcePublicId || null,
      ...seedRoomRate(baseRate),
      imagePath: roomType?.images?.[0] || hotelImage,
    };
  });
  return {
    name: hotel.name || "",
    city: hotel.city || hotel.cityName || stay.city,
    stars: asNumber(hotel.stars),
    imagePath: hotelImage || roomLines.find((line) => line.imagePath)?.imagePath || "",
    hotelMasterPublicId: hotel.publicId || null,
    platformHotelPublicId: hotel.platformHotelPublicId || null,
    hotelOrigin: hotel.origin || (hotel.platformOwned ? "PLATFORM_SYNC" : "TENANT"),
    platformOwned: hotel.platformOwned === true || hotel.origin === "PLATFORM_SYNC",
    syncStatus: hotel.syncStatus || null,
    roomTypeOptions,
    mealPlanOptions,
    roomLines,
  };
};

const findPreferredRoomType = (options, allocation) => {
  const clean = (value) => String(value || "").trim().toLowerCase();
  const category = clean(allocation.roomCategoryPreference);
  const bed = clean(allocation.bedPreference);
  const wantsCategory = category && category !== "any";
  const wantsBed = bed && bed !== "any";
  return options.find((option) =>
    (!wantsCategory || clean(option.name).includes(category))
    && (!wantsBed || clean(option.bedType).includes(bed)))
    || options.find((option) => wantsCategory && clean(option.name).includes(category))
    || options.find((option) => wantsBed && clean(option.bedType).includes(bed))
    || options[0]
    || null;
};

/** Compact keyboard-friendly counter for room occupancy. */
function RoomOccupancyStepper({ label, value, min = 0, max = 20, onChange }) {
  const count = Math.min(max, Math.max(min, asNumber(value, min)));
  const setCount = (next) => onChange(Math.min(max, Math.max(min, next)));
  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white " +
    "text-base font-bold text-slate-500 transition hover:border-blue-300 hover:text-blue-600 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => setCount(count - 1)}
        disabled={count <= min}
        aria-label={`Decrease ${label}`}
      >
        -
      </button>
      <span className="w-8 text-center text-sm font-extrabold tabular-nums text-slate-800">{count}</span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => setCount(count + 1)}
        disabled={count >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

function QuickHotelRoomLine({
  stay, line, onUpdate, onRoomType, onMealPlan, onRemove, canRemove,
}) {
  const selectedRoom = stay.roomTypeOptions.find((option) =>
    String(option.publicId || "") === String(line.roomTypeMasterPublicId || ""))
    || stay.roomTypeOptions.find((option) => option.name === line.roomType);
  const selectedMeal = stay.mealPlanOptions.find((option) =>
    String(option.publicId || "") === String(line.mealPlanMasterPublicId || ""))
    || stay.mealPlanOptions.find((option) => option.name === line.mealPlan);
  const selectedRoomKey = selectedRoom ? masterOptionKey(selectedRoom) : "";
  const selectedMealKey = selectedMeal ? masterOptionKey(selectedMeal) : "";
  const pax = asNumber(line.adults) + asNumber(line.children) + asNumber(line.infants);
  /* A line is now a room TYPE with a count, not one physical room, so every number on it has to say
     which of the two it means. Occupancy is per room; PAX and the price are shown both ways. */
  const roomQty = Math.max(1, asNumber(line.rooms, 1));
  /* Deliberately NOT Math.max(1, …) — sectionTotal.hotel multiplies by the raw night count, so a
     same-day check-in/out really does total zero. A hint that quietly rounded 0 nights up to 1 would
     be the only place on the page disagreeing with the grand total. */
  const lineNights = nightsBetween(stay.checkIn, stay.checkOut);
  const lineTotal = asNumber(line.pricePerRoom) * roomQty * lineNights;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-slate-700">
            Room type {line.roomNumber}
            {roomQty > 1 && <span className="ml-1.5 font-bold text-blue-600">× {roomQty} rooms</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Per room: {asNumber(line.adults)} adults · {asNumber(line.children)} children · {asNumber(line.infants)} infants
            {line.extraBeds ? ` · ${line.extraBeds} extra bed` : ""}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-slate-200">
          {pax} PAX/room{roomQty > 1 ? ` · ${pax * roomQty} total` : ""} · {line.roomCategoryPreference || "Any room"}
        </span>
      </div>

      <div className="mb-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3 lg:max-w-2xl">
        <Field label="Adult" hint="12+ yrs, per room">
          <div data-room-adults>
            <RoomOccupancyStepper
              label={`adults in room type ${line.roomNumber}`}
              min={1}
              value={line.adults}
              onChange={(adults) => onUpdate({ adults, paxTouched: true })}
            />
          </div>
        </Field>
        <Field label="Children" hint="0-12 yrs, per room">
          <RoomOccupancyStepper
            label={`children in room type ${line.roomNumber}`}
            min={0}
            value={line.children}
            onChange={(children) => onUpdate({
              children,
              paxTouched: true,
              childAges: (line.childAges || []).slice(0, children),
            })}
          />
        </Field>
        {/* Typed, not stepped: this arrives pre-filled from the lead (9 rooms is the case that
            prompted the whole change), and correcting it to 12 should not cost twelve clicks. */}
        <Field label="Rooms" hint="Same type & occupancy">
          <Input
            data-room-qty
            type="number"
            min="1"
            value={line.rooms}
            placeholder="1"
            onFocus={(event) => event.target.select()}
            onChange={(event) => onUpdate({ rooms: event.target.value, paxTouched: true })}
          />
        </Field>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-left text-xs font-bold text-rose-600 hover:underline sm:col-span-3"
          >
            Remove room type {line.roomNumber}
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Optional, like the full flow. A stay whose room category is still undecided is a normal
            thing to quote; forcing a value here only taught agents to pick "Standard" and mean it. */}
        <Field
          label="Room type"
          hint={stay.hotelMasterPublicId && stay.roomTypeOptions.length === 0
            ? "No room types added in Hotel Master"
            : undefined}
        >
          {stay.roomTypeOptions.length > 0 ? (
            <div className="relative">
              <select
                data-quick-field
                className={`${controlClass} appearance-none pr-9`}
                value={selectedRoomKey}
                onChange={(event) => onRoomType(event.target.value)}
              >
                <option value="">Select room type</option>
                {stay.roomTypeOptions.map((option, index) => (
                  <option key={masterOptionKey(option, index)} value={masterOptionKey(option, index)}>
                    {option.name}{masterRoomRate(option) == null
                      ? " — Rate not added"
                      : ` — ₹${masterRoomRate(option).toLocaleString("en-IN")}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          ) : (
            <Input
              value={line.roomType}
              placeholder="Enter room type"
              onChange={(event) => onUpdate({ roomType: event.target.value, roomTypeMasterPublicId: null })}
            />
          )}
        </Field>

        <Field label="Meal plan">
          <div className="relative">
            <select
              data-quick-field
              className={`${controlClass} appearance-none pr-9`}
              value={selectedMealKey}
              onChange={(event) => onMealPlan(event.target.value)}
            >
              <option value="">No meal plan</option>
              {stay.mealPlanOptions.map((option, index) => (
                <option key={masterOptionKey(option, index)} value={masterOptionKey(option, index)}>
                  {option.name}{option.price != null ? ` — ₹${Number(option.price).toLocaleString("en-IN")}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </Field>

        {/* The hint does the multiplication out loud. One line now stands for up to N rooms, and the
            failure this invites is an agent typing the whole party's budget into a per-room-per-night
            box and never noticing it got multiplied by 9 × the nights. */}
        {/* Optional too — but a blank price is the one omission with a visible money consequence, so
            it warns in amber instead of being silently accepted. Warn, don't block: the save gate
            that used to live here is documented in validateQuickQuote. */}
        <Field
          label="Your selling price / room / night (₹)"
          hint={lineTotal > 0
            ? `₹${asNumber(line.pricePerRoom).toLocaleString("en-IN")} × ${roomQty} room${roomQty === 1 ? "" : "s"} × ${lineNights} night${lineNights === 1 ? "" : "s"} = ₹${lineTotal.toLocaleString("en-IN")}`
            : <span className="font-semibold text-amber-600">Optional — left blank, this room adds ₹0 to the quote.</span>}
        >
          <Input
            data-hotel-selling-price
            type="number"
            min="0"
            value={line.pricePerRoom}
            placeholder="Enter your price"
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const pricePerRoom = event.target.value;
              onUpdate({
                pricePerRoom,
                rateSource: pricePerRoom === "" ? "MISSING" : "MANUAL",
              });
            }}
          />
        </Field>

        <Field label="Bed / occupancy">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
            {[
              line.bedType || line.bedPreference,
              line.occupancy ? `${line.occupancy} max` : "",
            ].filter((value) => value && value !== "Any").join(" · ") || "Not specified"}
          </div>
        </Field>
      </div>

      {line.childAges?.length > 0 && (
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          Child ages: {line.childAges.join(", ")}
        </p>
      )}
      {line.imagePath && line.imagePath !== stay.imagePath && (
        <img
          src={line.imagePath}
          alt={`${line.roomType || "Room"} at ${stay.name}`}
          className="mt-3 h-28 w-full max-w-xs rounded-lg border border-slate-200 object-cover"
        />
      )}
    </div>
  );
}

function QuickHotelStays({ data, setData, loadHotels }) {
  const updateStay = (stayId, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((stay) => stay.id === stayId ? { ...stay, ...patch } : stay),
  }));

  const updateRoom = (stayId, roomId, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((stay) => stay.id === stayId
      ? {
        ...stay,
        roomLines: stay.roomLines.map((room) => room.id === roomId ? { ...room, ...patch } : room),
      }
      : stay),
  }));

  const clearHotel = (stayId, name) => setData((current) => ({
    ...current,
    rows: current.rows.map((stay) => stay.id === stayId ? {
      ...stay,
      name,
      hotelMasterPublicId: null,
      platformHotelPublicId: null,
      hotelOrigin: null,
      platformOwned: false,
      syncStatus: null,
      stars: 0,
      imagePath: "",
      roomTypeOptions: [],
      mealPlanOptions: [],
      roomLines: stay.roomLines.map((line) => ({
        ...line,
        roomType: "",
        roomTypeMasterPublicId: null,
        platformRoomPublicId: null,
        mealPlan: "",
        mealPlanMasterPublicId: null,
        platformMealPlanPublicId: null,
        bedType: line.bedPreference === "Any" ? "" : line.bedPreference,
        occupancy: null,
        pricePerRoom: "",
        masterBaseRate: null,
        rateSource: "MISSING",
        imagePath: "",
      })),
    } : stay),
  }));

  /* ── Add Hotel — create a master record without leaving the quote ───────────────────────────
     Same reasoning as Add Attraction in Sightseeing: the picker can only offer what the Hotel
     Master already holds, and quoting a property that has never been entered meant leaving the
     quotation, creating it in Masters, coming back and finding your place again. This opens the
     SAME modal HotelTab uses, so the record is identical either way.

     `hotelModalStayId` remembers which stay asked, because one modal serves every stay row. */
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [hotelModalStayId, setHotelModalStayId] = useState(null);

  const openHotelModal = (stayId) => {
    setHotelModalStayId(stayId);
    setHotelModalOpen(true);
  };

  const handleHotelSaved = async (saved) => {
    setHotelModalOpen(false);
    const stayId = hotelModalStayId;
    setHotelModalStayId(null);
    if (!saved || stayId == null) return;

    const stay = data.rows.find((row) => row.id === stayId);
    if (!stay) return;

    /* Re-read the saved hotel through the same search the picker uses before selecting it.
       The modal returns what it POSTed, which need not carry the server-side shape the rest of this
       panel depends on — roomTypes with their rates, mealPlans. chooseHotel derives room lines and
       prices from exactly those, so selecting the POST response directly can produce a stay with a
       hotel name and no room rates. Falls back to `saved` if the lookup finds nothing, which is
       still better than not selecting it at all. */
    const idOfHotel = (h) => h?.publicId || h?.hotelId || h?.id;
    let fresh = saved;
    try {
      const results = await loadHotels(saved.name || "", stay.city);
      const match = (Array.isArray(results) ? results : []).find(
        (h) => idOfHotel(h) === idOfHotel(saved),
      );
      if (match) fresh = match;
    } catch {
      // Search failed — keep `saved`. The agent can re-pick from the dropdown if rates are missing.
    }
    chooseHotel(stay, fresh);
  };

  const chooseHotel = (stay, hotel) => updateStay(stay.id, hotelStayPatch(stay, hotel));

  const chooseRoomType = (stay, line, selectedKey) => {
    const roomType = stay.roomTypeOptions.find((option, index) =>
      masterOptionKey(option, index) === selectedKey) || null;
    const baseRate = masterRoomRate(roomType);
    updateRoom(stay.id, line.id, roomType ? {
      roomType: roomType.name || "",
      roomTypeMasterPublicId: roomType.publicId || null,
      platformRoomPublicId: roomType.platformSourcePublicId || null,
      bedType: roomType.bedType || "",
      occupancy: roomType.occupancy == null ? null : asNumber(roomType.occupancy),
      ...seedRoomRate(baseRate),
      imagePath: roomType.images?.[0] || stay.imagePath || "",
    } : {
      roomType: "", roomTypeMasterPublicId: null, platformRoomPublicId: null, bedType: "", occupancy: null,
      pricePerRoom: "", masterBaseRate: null, rateSource: "MISSING", imagePath: stay.imagePath || "",
    });
  };

  const chooseMealPlan = (stay, line, selectedKey) => {
    const meal = stay.mealPlanOptions.find((option, index) =>
      masterOptionKey(option, index) === selectedKey) || null;
    updateRoom(stay.id, line.id, {
      mealPlan: meal?.name || "",
      mealPlanMasterPublicId: meal?.publicId || null,
      platformMealPlanPublicId: meal?.platformSourcePublicId || null,
    });
  };

  const addRoom = (stayId) => setData((current) => ({
    ...current,
    rows: current.rows.map((stay) => {
      if (stay.id !== stayId) return stay;
      const source = stay.roomLines[stay.roomLines.length - 1];
      if (!source) return stay;
      return {
        ...stay,
        // Match the tenant booking form: mirror the previous room so only differences need edits.
        roomLines: [
          ...stay.roomLines,
          {
            ...source,
            id: rowId(),
            roomNumber: stay.roomLines.length + 1,
            childAges: [...(source.childAges || [])],
            /* NOT inherited from the source line. Splitting 9 Deluxe into 6 Deluxe + 3 Suite starts
               by adding a type, and copying the 9 across would silently quote 18 rooms. */
            rooms: 1,
          },
        ],
      };
    }),
  }));

  const removeRoom = (stayId, roomId) => setData((current) => ({
    ...current,
    rows: current.rows.map((stay) => {
      if (stay.id !== stayId || stay.roomLines.length <= 1) return stay;
      return {
        ...stay,
        roomLines: stay.roomLines
          .filter((room) => room.id !== roomId)
          .map((room, index) => ({ ...room, roomNumber: index + 1 })),
      };
    }),
  }));

  const addHotel = () => setData((current) => {
    const source = current.rows[current.rows.length - 1];
    return {
      ...current,
      rows: [...current.rows, {
        ...source,
        id: rowId(),
        name: "",
        hotelMasterPublicId: null,
        platformHotelPublicId: null,
        hotelOrigin: null,
        platformOwned: false,
        syncStatus: null,
        stars: 0,
        imagePath: "",
        roomTypeOptions: [],
        mealPlanOptions: [],
        roomLines: source.roomLines.map((line) => ({
          ...line,
          id: rowId(),
          roomType: "",
          roomTypeMasterPublicId: null,
          platformRoomPublicId: null,
          mealPlan: "",
          mealPlanMasterPublicId: null,
          platformMealPlanPublicId: null,
          bedType: line.bedPreference === "Any" ? "" : line.bedPreference,
          occupancy: null,
          pricePerRoom: "",
          masterBaseRate: null,
          rateSource: "MISSING",
          imagePath: "",
        })),
      }],
    };
  });

  return (
    <div className="space-y-4">
      {data.rows.map((stay, index) => (
        <SectionCard
          key={stay.id}
          addScope
          title={`Stay ${index + 1}`}
          icon={BedDouble}
          badge={[
            stay.platformOwned ? "Platform" : "",
            stay.city,
            stay.checkIn && stay.checkOut ? `${stay.checkIn} → ${stay.checkOut}` : "",
          ].filter(Boolean).join(" · ")}
          action={data.rows.length > 1 ? (
            <IconButton
              label="Remove stay"
              danger
              onClick={() => setData((current) => ({
                ...current,
                rows: current.rows.filter((item) => item.id !== stay.id),
              }))}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          ) : null}
        >
          <div>
            <Field label="Hotel" required hint={stay.city ? `Searching ${stay.city} first` : "Searches the Hotel Master"}>
              {/* Picker and its ⊕ on one row: the button is only wanted at the moment the search
                  comes back empty, so it belongs beside the box rather than in a toolbar. */}
              <div className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1">
              <AsyncCombobox
                value={stay.name}
                onValueChange={(name) => clearHotel(stay.id, name)}
                onSelect={(hotel) => chooseHotel(stay, hotel)}
                loadOptions={(query) => loadHotels(query, stay.city)}
                cacheKey={`hotel:${stay.city || ""}`}
                getLabel={(hotel) => hotel.name || "Hotel"}
                getImage={(hotel) => hotel.imagePath || hotel.imageUrl
                  || (hotel.roomTypes || []).flatMap((room) => room?.images || []).find(Boolean)
                  || ""}
                getBadge={(hotel) => hotel.platformOwned || hotel.origin === "PLATFORM_SYNC" ? "Platform" : ""}
                getSublabel={(hotel) => [
                  hotel.city || hotel.cityName,
                  hotel.stars ? `${hotel.stars} star` : "",
                  `${(hotel.roomTypes || []).filter((room) => room?.active !== false).length} room types`,
                  (hotel.roomTypes || []).some((room) => room?.active !== false && masterRoomRate(room) != null)
                    ? "Rate available"
                    : "Rate needed",
                ].filter(Boolean).join(" · ")}
                placeholder="Type hotel name"
              />
                </div>
                <button
                  type="button"
                  onClick={() => openHotelModal(stay.id)}
                  title="Add a new hotel to the Hotel Master"
                  aria-label="Add hotel"
                  className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>
          </div>

          {(stay.hotelMasterPublicId || stay.platformHotelPublicId) && (
            <div className="mt-3 overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white shadow-sm">
              <div className="grid sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                <div className="flex min-h-32 items-center justify-center bg-violet-100">
                  {stay.imagePath ? (
                    <img
                      src={stay.imagePath}
                      alt={stay.name || "Hotel"}
                      loading="lazy"
                      className="h-36 w-full object-cover sm:h-full"
                    />
                  ) : (
                    <Hotel className="h-10 w-10 text-violet-300" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black text-slate-900">{stay.name}</h3>
                    {stay.platformOwned && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-700">
                        <ShieldCheck className="h-3 w-3" /> Platform
                      </span>
                    )}
                  </div>
                  {stay.stars > 0 && (
                    <div className="mt-1.5 flex items-center gap-1" aria-label={`${stay.stars} star hotel`}>
                      {Array.from({ length: Math.min(7, stay.stars) }, (_, star) => (
                        <Star key={star} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                      <span className="ml-1 text-xs font-bold text-slate-500">{stay.stars} Star</span>
                    </div>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-rose-400" /> {stay.city || "City not specified"}
                  </p>
                  <p className="mt-2 text-[11px] font-bold text-violet-600">Selected from Hotel Master</p>
                </div>
                <div className="min-w-64 border-t border-violet-100 bg-white/80 p-4 sm:border-l sm:border-t-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Room-wise Master rates</span>
                  {stay.roomTypeOptions.filter((room) => room?.active !== false).length === 0 ? (
                    <p className="mt-2 text-sm font-bold text-amber-600">No room types added</p>
                  ) : (
                    <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                      {stay.roomTypeOptions
                        .filter((room) => room?.active !== false)
                        .map((room, roomIndex) => {
                          const rate = masterRoomRate(room);
                          return (
                            <div key={masterOptionKey(room, roomIndex)} className="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-2.5 py-2 text-xs">
                              <span className="min-w-0 truncate font-bold text-slate-700">{room.name || `Room ${roomIndex + 1}`}</span>
                              <span className={`shrink-0 font-extrabold ${rate == null ? "text-amber-600" : "text-emerald-700"}`}>
                                {rate == null ? "Rate not added" : `₹${rate.toLocaleString("en-IN")}`}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  <span className="mt-2 block text-[10px] font-semibold text-slate-400">Per room / night</span>
                </div>
              </div>
            </div>
          )}

          {stay.platformOwned && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Platform hotel: after customer approval, send the booking through Platform Marketplace.
              </span>
            </div>
          )}

          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-2">
            <Field label="Check-in">
              <Input type="date" value={stay.checkIn} onChange={(event) => updateStay(stay.id, { checkIn: event.target.value })} />
            </Field>
            <Field label="Check-out">
              <Input type="date" value={stay.checkOut} min={stay.checkIn || undefined} onChange={(event) => updateStay(stay.id, { checkOut: event.target.value })} />
            </Field>
          </div>

          <div className="mt-4 space-y-3">
            {stay.roomLines.map((line) => (
              <QuickHotelRoomLine
                key={line.id}
                stay={stay}
                line={line}
                onUpdate={(patch) => updateRoom(stay.id, line.id, patch)}
                onRoomType={(selectedKey) => chooseRoomType(stay, line, selectedKey)}
                onMealPlan={(selectedKey) => chooseMealPlan(stay, line, selectedKey)}
                onRemove={() => removeRoom(stay.id, line.id)}
                canRemove={stay.roomLines.length > 1}
              />
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => addRoom(stay.id)}
                data-quick-add
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                <Plus className="h-4 w-4" /> Add room type
              </button>
              {/* Counts the ROOMS, not the lines, and weights the pax by each line's quantity — the
                  numbers here are what the agent reads back to the customer, so they have to be the
                  party, not the shape of the form. */}
              <span className="text-xs font-semibold text-slate-500">
                {stay.roomLines.reduce((sum, room) => sum + Math.max(1, asNumber(room.rooms, 1)), 0)} rooms
                {" / "}{stay.roomLines.reduce((sum, room) => sum + asNumber(room.adults) * Math.max(1, asNumber(room.rooms, 1)), 0)} adults
                {" / "}{stay.roomLines.reduce((sum, room) => sum + asNumber(room.children) * Math.max(1, asNumber(room.rooms, 1)), 0)} children
              </span>
            </div>
          </div>
        </SectionCard>
      ))}
      {/* This adds a STAY — another hotel block in the itinerary — not a hotel to the master. It
          said "Add hotel", which is what the new ⊕ beside each picker actually does; two buttons
          with one label, doing different things, is most of why the master one looked missing. */}
      <button type="button" onClick={addHotel} data-quick-add className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add stay
      </button>

      {/* One modal for every stay row — `hotelModalStayId` remembers which one opened it.
          editHotel is always null: this entry point only CREATES. Editing a master record stays in
          the Hotel tab, which holds the full master list and can resolve a selection back to it. */}
      <HotelFormModal
        open={hotelModalOpen}
        onClose={() => { setHotelModalOpen(false); setHotelModalStayId(null); }}
        editHotel={null}
        onSaved={handleHotelSaved}
      />
    </div>
  );
}

function HotelPanel({ data, setData, loadHotels }) {
  return <QuickHotelStays data={data} setData={setData} loadHotels={loadHotels} />;
}

function FlightPanel({ data, setData }) {
  const update = (id, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => row.id === id ? { ...row, ...patch } : row),
  }));
  const blank = () => ({
    id: rowId(), airline: "", flightNo: "", class: "Economy", from: "", to: "",
    depDate: "", depTime: "", arrDate: "", arrTime: "", pricePerPax: 0, pax: 1,
    cabin: 7, checkin: 15, connections: [],
  });
  return (
    <div className="space-y-4">
      <div className="grid max-w-sm gap-3">
        <Field label="Journey"><Select options={JOURNEY_TYPES} value={data.journey} onChange={(event) => setData((current) => ({ ...current, journey: event.target.value }))} /></Field>
      </div>
      {data.rows.map((row, index) => (
        <SectionCard key={row.id} title={`Flight ${index + 1}`} icon={Plane} badge={`${row.pax || 1} traveller${Number(row.pax) === 1 ? "" : "s"}`} action={data.rows.length > 1 ? <IconButton label="Remove flight" danger onClick={() => setData((current) => ({ ...current, rows: current.rows.filter((item) => item.id !== row.id) }))}><Trash2 className="h-4 w-4" /></IconButton> : null}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Airline" required><Select options={AIRLINES} placeholder="Select airline" value={row.airline} onChange={(event) => update(row.id, { airline: event.target.value })} /></Field>
            <Field label="Flight no."><Input value={row.flightNo} placeholder="6E 204" onChange={(event) => update(row.id, { flightNo: event.target.value.toUpperCase() })} /></Field>
            <Field label="Class"><Select options={CLASSES} value={row.class} onChange={(event) => update(row.id, { class: event.target.value })} /></Field>
            <Field label="Departure date"><Input type="date" value={row.depDate} onChange={(event) => update(row.id, { depDate: event.target.value })} /></Field>
            <Field label="From" required><Input value={row.from} placeholder="Delhi (DEL)" onChange={(event) => update(row.id, { from: event.target.value })} /></Field>
            <Field label="To" required><Input value={row.to} placeholder="Dubai (DXB)" onChange={(event) => update(row.id, { to: event.target.value })} /></Field>
            <Field label="Departure time"><Input type="time" value={row.depTime} onChange={(event) => update(row.id, { depTime: event.target.value })} /></Field>
            <Field label="Arrival time"><Input type="time" value={row.arrTime} onChange={(event) => update(row.id, { arrTime: event.target.value })} /></Field>
            <Field label="Price / pax (₹)"><Input type="number" min="0" value={row.pricePerPax} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pricePerPax: event.target.value })} /></Field>
            <Field label="PAX"><Input type="number" min="1" value={row.pax} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pax: event.target.value })} /></Field>
            <Field label="Cabin baggage (kg)"><Input type="number" min="0" value={row.cabin} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { cabin: event.target.value })} /></Field>
            <Field label="Check-in baggage (kg)"><Input type="number" min="0" value={row.checkin} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { checkin: event.target.value })} /></Field>
          </div>
        </SectionCard>
      ))}
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, blank()] }))} data-quick-add className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add flight
      </button>
    </div>
  );
}

function SightseeingPanel({ data, setData, loadSightseeing }) {
  const update = (id, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => row.id === id ? { ...row, ...patch } : row),
  }));

  /* ── More than one activity per day ────────────────────────────────────────────────────────
     A quick-quote row was one DAY carrying exactly one activity, flat: attraction, startTime,
     transfer, pricePerPax, pax. A real day is often two or three — Phewa Lake in the morning,
     Sarangkot at sunset — and the only way to record that here was to add another DAY, which put
     "Day 5" and "Day 6" on a five-day trip and threw the dates out.

     ADDITIVE, not a migration. The flat fields stay exactly as they are and remain the day's FIRST
     activity; `activities[]` holds the second onward. That matters because of what reads this shape
     downstream: the Modern, Luxury and Premium templates already do `(d.activities || [])` — they
     render an activities array today and fall back to the flat fields — so nothing about the PDFs,
     the web views or the saved payload has to change, and a quotation saved before this still opens
     correctly. A full migration to activities-only would have rewritten initialModel, the content
     test, the subtotal and every stored quotation for no gain the agent can see.

     Each extra activity carries its own price and pax, mirroring the full quotation, and the
     subtotal picks them up — see SECTION_TOTAL.sightseeing. */
  const newActivity = (day) => ({
    id: rowId(),
    attraction: "",
    startTime: "",
    description: "",
    transfer: "Private",
    imagePath: "",
    pricePerPax: 0,
    // Inherited so the common case — same party, same city — needs no retyping.
    pax: day.pax ?? 1,
    city: day.city || "",
    destination: day.destination || "",
  });

  const addActivity = (dayId) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => (
      row.id === dayId ? { ...row, activities: [...(row.activities || []), newActivity(row)] } : row
    )),
  }));

  const patchActivity = (dayId, activityId, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => (
      row.id === dayId
        ? { ...row, activities: (row.activities || []).map((act) => (act.id === activityId ? { ...act, ...patch } : act)) }
        : row
    )),
  }));

  const removeActivity = (dayId, activityId) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => (
      row.id === dayId
        ? { ...row, activities: (row.activities || []).filter((act) => act.id !== activityId) }
        : row
    )),
  }));

  /* ── Add Attraction — create a master record without leaving the quote ──────────────────────
     The picker can only offer what the Sightseeing Master already holds. When an agent is quoting
     something that has never been entered — a new trek, a newly opened museum — the flow was: leave
     the quotation, open Masters, create it, come back, find your place again. The full quotation
     solved this long ago with a ⊕ beside every attraction box; this is the SAME modal, imported
     rather than reimplemented, so a record created here is indistinguishable from one created there.

     `target` remembers which box asked for it — a day's own attraction, or one of its extra
     activities — because the modal is one component serving every box on the screen and it has to
     write the result back to the one that opened it. */
  const [attractionModalOpen, setAttractionModalOpen] = useState(false);
  const [attractionTarget, setAttractionTarget] = useState(null);

  const openAttractionModal = (dayId, activityId = null) => {
    setAttractionTarget({ dayId, activityId });
    setAttractionModalOpen(true);
  };

  const handleAttractionSaved = (saved) => {
    setAttractionModalOpen(false);
    if (!saved || !attractionTarget) { setAttractionTarget(null); return; }

    /* Fill the box that opened the modal, exactly as picking the record from the dropdown would —
       same fields, same HTML-stripped description — so a created attraction and a selected one are
       identical from here on. */
    const patch = {
      attraction: saved.title || "",
      description: String(saved.description || "").replace(/<[^>]*>/g, "").trim(),
      imagePath: saved.imagePath || saved.imageUrl || "",
      city: saved.city || saved.cityName || "",
    };
    const { dayId, activityId } = attractionTarget;
    if (activityId) patchActivity(dayId, activityId, patch);
    else update(dayId, patch);
    setAttractionTarget(null);
  };

  /* Sightseeing is the longest section on this screen: it is one card PER DAY, so a 5-day trip means
     five price boxes, and in practice an agency quotes one per-person day rate across the whole
     itinerary. Typing it five times is the single most repetitive act in the builder.

     Departure days are skipped — they are not sold, and stamping a rate on one would quietly add a
     day's revenue the customer was never quoted for. `pax` is left alone: it is seeded from the
     lead's party size and is already right. */
  const [bulkPrice, setBulkPrice] = useState("");
  const sellableDays = data.rows.filter((row) => !row.isDepartureDay).length;
  const applyBulkPrice = () => {
    const price = asNumber(bulkPrice);
    setData((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.isDepartureDay ? row : { ...row, pricePerPax: price })),
    }));
  };

  return (
    <div className="space-y-4">
      {sellableDays > 1 && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="min-w-0">
            <Field label="Same price / pax for every day (₹)" hint={`Applies to all ${sellableDays} sellable days — the departure day stays at ₹0.`}>
              <Input
                type="number"
                min="0"
                value={bulkPrice}
                placeholder="e.g. 1500"
                onFocus={(event) => event.target.select()}
                onChange={(event) => setBulkPrice(event.target.value)}
                // Enter would otherwise walk to the next field and leave the value unapplied — the
                // one place on this screen where Enter means "do it" rather than "move on".
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  applyBulkPrice();
                }}
              />
            </Field>
          </div>
          <button
            type="button"
            data-skip-enter="true"
            onClick={applyBulkPrice}
            disabled={String(bulkPrice).trim() === ""}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Apply to all days
          </button>
        </div>
      )}
      {data.rows.map((row, index) => (
        // The departure day says so in its title. It is pre-filled and priced at 0, and without the
        // label it reads as an activity the agent forgot to price.
        <SectionCard key={row.id} title={row.isDepartureDay ? `Day ${row.day || index + 1} · Departure` : `Day ${row.day || index + 1}`} icon={MapPin} badge={[row.city, row.date].filter(Boolean).join(" · ")} action={data.rows.length > 1 ? <IconButton label="Remove activity" danger onClick={() => setData((current) => ({ ...current, rows: current.rows.filter((item) => item.id !== row.id) }))}><Trash2 className="h-4 w-4" /></IconButton> : null}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Attraction / activity" required>
                {/* The picker and its ⊕ share a row: the button is only ever wanted at the moment
                    the search comes back empty, so it belongs beside the box, not in a toolbar. */}
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                <AsyncCombobox
                  value={row.attraction}
                  onValueChange={(attraction) => update(row.id, { attraction, imagePath: "" })}
                  onSelect={(item) => update(row.id, {
                    attraction: item.title || "",
                    startTime: String(item.suggestedStartTime || row.startTime || "").slice(0, 5),
                    description: String(item.description || "").replace(/<[^>]*>/g, "").trim(),
                    imagePath: item.imagePath || item.imageUrl || "",
                    city: item.city || item.cityName || row.city,
                  })}
                  loadOptions={(query) => loadSightseeing(query, row.destination, row.city)}
                  cacheKey={`sightseeing:${row.destination || ""}:${row.city || ""}`}
                  getLabel={(item) => item.title || "Activity"}
                  getImage={(item) => item.imagePath || item.imageUrl || ""}
                  getSublabel={(item) => [item.city || item.cityName, item.estimatedHours ? `${item.estimatedHours}h` : ""].filter(Boolean).join(" · ")}
                  placeholder="Type attraction name"
                />
                  </div>
                  <button
                    type="button"
                    onClick={() => openAttractionModal(row.id)}
                    title="Add a new attraction to the Sightseeing Master"
                    aria-label="Add attraction"
                    className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </Field>
            </div>
            <Field label="Date"><Input type="date" value={row.date} onChange={(event) => update(row.id, { date: event.target.value })} /></Field>
            <Field label="Start time"><Input type="time" value={row.startTime} onChange={(event) => update(row.id, { startTime: event.target.value })} /></Field>
            <Field label="Transfer"><Select options={TRANSFER} value={row.transfer} onChange={(event) => update(row.id, { transfer: event.target.value })} /></Field>
            <Field label="Price / pax (₹)"><Input type="number" min="0" value={row.pricePerPax} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pricePerPax: event.target.value })} /></Field>
            <Field label="PAX"><Input type="number" min="1" value={row.pax} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pax: event.target.value })} /></Field>
            <div className="xl:col-span-4"><Field label="Description"><Input value={row.description} placeholder="Optional short description" onChange={(event) => update(row.id, { description: event.target.value })} /></Field></div>
          </div>
          {row.imagePath && (
            <figure className="mt-3 w-full max-w-sm">
              <img
                src={row.imagePath}
                alt={row.attraction || `Sightseeing activity ${index + 1}`}
                loading="lazy"
                className="h-36 w-full rounded-lg border border-slate-200 object-cover"
              />
              <figcaption className="mt-1 text-[11px] font-semibold text-slate-400">Photo from Sightseeing Master</figcaption>
            </figure>
          )}

          {/* The day's SECOND activity onward. Inset and tinted so it reads as belonging to the day
              above it rather than as another day — the mistake this whole block exists to fix. */}
          {(row.activities || []).map((act, actIndex) => (
            <div key={act.id} className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                {/* +2, not +1: the flat fields above are activity 1 of this day. */}
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Activity {actIndex + 2}
                </p>
                <IconButton label="Remove activity" danger onClick={() => removeActivity(row.id, act.id)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2">
                  <Field label="Attraction / activity">
                    {/* Same master-backed picker as the day's first activity, scoped to the same
                        destination and city, so a second activity is found the same way as the first —
                        including the ⊕ for when it is not in the master yet. */}
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0 flex-1">
                    <AsyncCombobox
                      value={act.attraction}
                      onValueChange={(attraction) => patchActivity(row.id, act.id, { attraction, imagePath: "" })}
                      onSelect={(item) => patchActivity(row.id, act.id, {
                        attraction: item.title || "",
                        startTime: String(item.suggestedStartTime || act.startTime || "").slice(0, 5),
                        description: String(item.description || "").replace(/<[^>]*>/g, "").trim(),
                        imagePath: item.imagePath || item.imageUrl || "",
                        city: item.city || item.cityName || act.city,
                      })}
                      loadOptions={(query) => loadSightseeing(query, row.destination, row.city)}
                      cacheKey={`sightseeing:${row.destination || ""}:${row.city || ""}`}
                      getLabel={(item) => item.title || "Activity"}
                      getImage={(item) => item.imagePath || item.imageUrl || ""}
                      getSublabel={(item) => [item.city || item.cityName, item.estimatedHours ? `${item.estimatedHours}h` : ""].filter(Boolean).join(" · ")}
                      placeholder="Type attraction name"
                    />
                      </div>
                      <button
                        type="button"
                        onClick={() => openAttractionModal(row.id, act.id)}
                        title="Add a new attraction to the Sightseeing Master"
                        aria-label="Add attraction"
                        className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </Field>
                </div>
                <Field label="Start time"><Input type="time" value={act.startTime} onChange={(event) => patchActivity(row.id, act.id, { startTime: event.target.value })} /></Field>
                <Field label="Transfer"><Select options={TRANSFER} value={act.transfer} onChange={(event) => patchActivity(row.id, act.id, { transfer: event.target.value })} /></Field>
                <Field label="Price / pax (₹)"><Input type="number" min="0" value={act.pricePerPax} onFocus={(event) => event.target.select()} onChange={(event) => patchActivity(row.id, act.id, { pricePerPax: event.target.value })} /></Field>
                <Field label="PAX"><Input type="number" min="1" value={act.pax} onFocus={(event) => event.target.select()} onChange={(event) => patchActivity(row.id, act.id, { pax: event.target.value })} /></Field>
                <div className="xl:col-span-4"><Field label="Description"><Input value={act.description} placeholder="Optional short description" onChange={(event) => patchActivity(row.id, act.id, { description: event.target.value })} /></Field></div>
              </div>

              {act.imagePath && (
                <figure className="mt-3 w-full max-w-sm">
                  <img src={act.imagePath} alt={act.attraction || "Activity"} loading="lazy" className="h-36 w-full rounded-lg border border-slate-200 object-cover" />
                  <figcaption className="mt-1 text-[11px] font-semibold text-slate-400">Photo from Sightseeing Master</figcaption>
                </figure>
              )}
            </div>
          ))}

          {/* Inside the day card, exactly where the full quotation puts it. The departure day is
              excluded: it is a check-out, not a day anyone books activities on. */}
          {!row.isDepartureDay && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => addActivity(row.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
              >
                <Plus className="h-3.5 w-3.5" /> Add Activity
              </button>
            </div>
          )}
        </SectionCard>
      ))}
      {/* The new row is cloned off the last one for its city/destination/pax, and the last one is now
          usually the DEPARTURE day — so `isDepartureDay` is stripped explicitly. Left in, every added
          day would inherit the flag, drop out of the completion and summary counts above, and the
          agent's real activities would stop registering. */}
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, { ...current.rows[current.rows.length - 1], id: rowId(), day: current.rows.length + 1, isDepartureDay: false, attraction: "", description: "", imagePath: "", pricePerPax: 0 }] }))} data-quick-add className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add day
      </button>

      {/* One modal for the whole panel, not one per box — `attractionTarget` remembers which box
          opened it. editingItem is always null here: this entry point only CREATES. Editing an
          existing master record stays in the full quotation, which can resolve the selected
          attraction back to its master row; the quick quote holds only a title and has nothing
          reliable to look up. */}
      <SightseeingFormModal
        isOpen={attractionModalOpen}
        onClose={() => { setAttractionModalOpen(false); setAttractionTarget(null); }}
        editingItem={null}
        onSaved={handleAttractionSaved}
      />
    </div>
  );
}

function VehiclePanel({ data, setData, loadVehicles }) {
  const update = (id, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => row.id === id ? { ...row, ...patch } : row),
  }));
  return (
    <div className="space-y-4">
      {data.rows.map((row, index) => (
        <SectionCard key={row.id} title={`Vehicle ${index + 1}`} icon={Car} badge={row.capacity ? `${row.capacity} seats` : ""} action={data.rows.length > 1 ? <IconButton label="Remove vehicle" danger onClick={() => setData((current) => ({ ...current, rows: current.rows.filter((item) => item.id !== row.id) }))}><Trash2 className="h-4 w-4" /></IconButton> : null}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Vehicle model" required>
                <AsyncCombobox
                  value={row.model}
                  onValueChange={(model) => update(row.id, { model, imagePath: "" })}
                  onSelect={(vehicle) => update(row.id, {
                    model: vehicle.name || "",
                    type: vehicle.type || row.type,
                    capacity: vehicle.capacity ?? row.capacity,
                    imagePath: vehicle.imagePath || vehicle.image || "",
                  })}
                  loadOptions={loadVehicles}
                  cacheKey="vehicle"
                  getLabel={(vehicle) => vehicle.name || "Vehicle"}
                  getImage={(vehicle) => vehicle.imagePath || vehicle.image || vehicle.imageUrl || ""}
                  getSublabel={(vehicle) => [vehicle.type, vehicle.capacity ? `${vehicle.capacity} seats` : ""].filter(Boolean).join(" · ")}
                  placeholder="Type vehicle model"
                />
              </Field>
            </div>
            <Field label="Type"><Input value={row.type} placeholder="SUV / Sedan" onChange={(event) => update(row.id, { type: event.target.value })} /></Field>
            <Field label="Quantity"><Input type="number" min="1" value={row.qty} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { qty: event.target.value })} /></Field>
            <Field label="Pickup"><Input value={row.pickup} onChange={(event) => update(row.id, { pickup: event.target.value })} /></Field>
            <Field label="Drop"><Input value={row.drop} onChange={(event) => update(row.id, { drop: event.target.value })} /></Field>
            <Field label="Start date"><Input type="date" value={row.startDate} onChange={(event) => update(row.id, { startDate: event.target.value })} /></Field>
            <Field label="End date"><Input type="date" value={row.endDate} min={row.startDate || undefined} onChange={(event) => update(row.id, { endDate: event.target.value })} /></Field>
            <Field label="Price / vehicle (₹)"><Input type="number" min="0" value={row.pricePerVehicle} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pricePerVehicle: event.target.value })} /></Field>
            <div className="md:col-span-2 xl:col-span-3"><Field label="Notes"><Input value={row.notes} placeholder="Driver, AC, toll or route note" onChange={(event) => update(row.id, { notes: event.target.value })} /></Field></div>
          </div>
          {row.imagePath && (
            <figure className="mt-3 w-full max-w-sm">
              <img
                src={row.imagePath}
                alt={row.model || `Vehicle ${index + 1}`}
                loading="lazy"
                className="h-36 w-full rounded-lg border border-slate-200 object-cover"
              />
              <figcaption className="mt-1 text-[11px] font-semibold text-slate-400">Photo from Vehicle Master</figcaption>
            </figure>
          )}
        </SectionCard>
      ))}
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, { ...current.rows[current.rows.length - 1], id: rowId(), type: "", model: "", imagePath: "", capacity: null, pricePerVehicle: 0 }] }))} data-quick-add className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add vehicle
      </button>
    </div>
  );
}

function CruisePanel({ data, setData }) {
  const update = (id, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => row.id === id ? { ...row, ...patch } : row),
  }));
  return (
    <div className="space-y-4">
      {data.rows.map((row, index) => (
        <SectionCard key={row.id} title={`Cruise ${index + 1}`} icon={Ship} action={data.rows.length > 1 ? <IconButton label="Remove cruise" danger onClick={() => setData((current) => ({ ...current, rows: current.rows.filter((item) => item.id !== row.id) }))}><Trash2 className="h-4 w-4" /></IconButton> : null}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2"><Field label="Cruise name" required><Input value={row.name} placeholder="Cruise name" onChange={(event) => update(row.id, { name: event.target.value })} /></Field></div>
            <Field label="Type"><Select options={CRUISE_TYPES} value={row.type} onChange={(event) => update(row.id, { type: event.target.value })} /></Field>
            <Field label="Cabin"><Select options={CABIN_CATS} value={row.cabin} onChange={(event) => update(row.id, { cabin: event.target.value })} /></Field>
            <Field label="Departure port"><Input value={row.depPort} onChange={(event) => update(row.id, { depPort: event.target.value })} /></Field>
            <Field label="Arrival port"><Input value={row.arrPort} onChange={(event) => update(row.id, { arrPort: event.target.value })} /></Field>
            <Field label="Departure date"><Input type="date" value={row.depDate} onChange={(event) => update(row.id, { depDate: event.target.value })} /></Field>
            <Field label="Nights"><Input type="number" min="1" value={row.nights} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { nights: event.target.value })} /></Field>
            <Field label="Price / pax (₹)"><Input type="number" min="0" value={row.pricePerPax} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pricePerPax: event.target.value })} /></Field>
            <Field label="PAX"><Input type="number" min="1" value={row.pax} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pax: event.target.value })} /></Field>
          </div>
        </SectionCard>
      ))}
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, { ...current.rows[current.rows.length - 1], id: rowId(), name: "", pricePerPax: 0 }] }))} data-quick-add className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add cruise
      </button>
    </div>
  );
}

function AddonsPanel({ data, setData }) {
  const update = (id, patch) => setData((current) => ({
    ...current,
    rows: current.rows.map((row) => row.id === id ? { ...row, ...patch } : row),
  }));
  const add = () => setData((current) => ({
    ...current,
    rows: [...current.rows, { id: rowId(), serviceType: "", description: "", quantity: 1, pricePerUnit: 0, included: true }],
  }));
  return (
    // Dashed pastel, like every other panel's add-row control. A solid blue-600 fill made this the
    // only "primary" inside a section body, and it sat inches from the section's real primary.
    <SectionCard title="Add-on services" icon={PackagePlus} action={<button type="button" onClick={add} data-quick-add className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><Plus className="h-3.5 w-3.5" /> Add</button>}>
      {data.rows.length === 0 ? (
        <button type="button" onClick={add} className="w-full rounded-xl border-2 border-dashed border-slate-200 py-8 text-sm font-bold text-slate-400 hover:border-blue-300 hover:text-blue-600">Add visa, insurance or another service</button>
      ) : (
        <div className="space-y-3">
          {data.rows.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[1fr_1.5fr_100px_140px_40px] md:items-end">
              <Field label="Service"><Input value={row.serviceType} onChange={(event) => update(row.id, { serviceType: event.target.value })} /></Field>
              <Field label="Description"><Input value={row.description} onChange={(event) => update(row.id, { description: event.target.value })} /></Field>
              <Field label="Qty"><Input type="number" min="1" value={row.quantity} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { quantity: event.target.value })} /></Field>
              <Field label="Price / unit (₹)"><Input type="number" min="0" value={row.pricePerUnit} onFocus={(event) => event.target.select()} onChange={(event) => update(row.id, { pricePerUnit: event.target.value })} /></Field>
              <IconButton label="Remove add-on" danger onClick={() => setData((current) => ({ ...current, rows: current.rows.filter((item) => item.id !== row.id) }))}><Trash2 className="h-4 w-4" /></IconButton>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function TermsPanel({ data, setData }) {
  const fields = [
    ["inclusions", "Inclusions"],
    ["exclusions", "Exclusions"],
    ["paymentPolicies", "Payment policy"],
    ["cancellationPolicies", "Cancellation policy"],
    ["bookingTerms", "Booking terms"],
  ];

  /* Pull the inclusions/exclusions off a saved package template. The agency has already written
     these once per package; retyping them per quote is the second-biggest block of repeat typing on
     this screen after the day rates.

     Deliberately NOT templateService.apply(): that endpoint clones the template into a whole NEW
     draft quotation server-side, which would throw away the model the agent is standing in. This
     reads the template and copies two text fields into the model in place.

     Only inclusions and exclusions — those are the only two a QuotationTemplateResponse carries. The
     other three boxes below keep whatever is in them (and are already remembered session-to-session
     by rememberQuickQuoteDefaults), so picking a template can never blank a policy the agent typed.

     Loaded lazily on first open of the picker, not on mount: Terms is a section many quotes never
     touch, and a list request per quotation for a feature used occasionally is the exact round trip
     this pass is trying to remove. */
  const [templates, setTemplates] = useState(null);
  const [templatesBusy, setTemplatesBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openPicker = async () => {
    setPickerOpen((open) => !open);
    if (templates || templatesBusy) return;
    setTemplatesBusy(true);
    try {
      const { items } = await templateService.list({ active: true, size: 50 });
      setTemplates(Array.isArray(items) ? items : []);
    } catch {
      // Silent, and empty rather than null so it is not retried on every toggle: the panel is fully
      // usable by typing. A toast here would interrupt an agent who opened the picker out of
      // curiosity mid-call.
      setTemplates([]);
    } finally {
      setTemplatesBusy(false);
    }
  };

  const applyTemplateTerms = (template) => {
    const asText = (value) => (Array.isArray(value) ? value.filter(Boolean).join("\n") : String(value || ""));
    setData((current) => ({
      ...current,
      inclusions: asText(template.inclusions) || current.inclusions,
      exclusions: asText(template.exclusions) || current.exclusions,
    }));
    setPickerOpen(false);
  };

  return (
    <SectionCard
      title="Inclusions, exclusions & terms"
      icon={FileCheck2}
      action={(
        <button
          type="button"
          data-skip-enter="true"
          onClick={openPicker}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          {templatesBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
          Use a package template
        </button>
      )}
    >
      {pickerOpen && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          {templatesBusy ? (
            <p className="text-xs font-semibold text-slate-500">Loading templates…</p>
          ) : (templates || []).length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">
              No active package templates yet. Save a finished quotation as a template and it will appear here.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Copies inclusions &amp; exclusions only — your policies below are left as they are
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    data-skip-enter="true"
                    onClick={() => applyTemplateTerms(template)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="truncate">{template.name || "Untitled template"}</span>
                    {template.durationNights != null && (
                      <span className="shrink-0 text-[10px] font-bold text-slate-400">{template.durationNights}N</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {fields.map(([key, label], index) => (
          <Field key={key} label={label} hint="One item per line">
            <textarea
              data-quick-field
              rows={index < 2 ? 5 : 3}
              value={data[key]}
              onChange={(event) => setData((current) => ({ ...current, [key]: event.target.value }))}
              className={`${controlClass} resize-y`}
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

/* Discount → markup → tax, in one place. This used to live inside PricingPanel alone; the zero-total
   guard in validateQuickQuote needs the very same number, and a rule that rejects a quote using a
   second copy of the arithmetic is a rule that will eventually disagree with the figure the agent is
   looking at. Takes the pricing slice and the already-computed subtotal so it stays a pure function
   of what the panel renders. */
const priceBreakdown = (pricing, subtotal) => {
  const base = asNumber(subtotal);
  const discount = pricing?.discType === "%"
    ? base * asNumber(pricing?.discount) / 100
    : asNumber(pricing?.discount);
  const beforeTax = Math.max(0, base - discount + asNumber(pricing?.markup));
  return { discount, beforeTax, grandTotal: beforeTax + beforeTax * asNumber(pricing?.tax) / 100 };
};

function PricingPanel({ data, setData, subtotal }) {
  const { discount, grandTotal } = priceBreakdown(data, subtotal);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <SectionCard title="Pricing adjustments" icon={IndianRupee}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discount type"><Select options={["Fixed", "%"]} value={data.discType} onChange={(event) => setData((current) => ({ ...current, discType: event.target.value }))} /></Field>
          <Field label="Discount"><Input type="number" min="0" value={data.discount} onFocus={(event) => event.target.select()} onChange={(event) => setData((current) => ({ ...current, discount: event.target.value }))} /></Field>
          <Field label="Markup (₹)"><Input type="number" min="0" value={data.markup} onFocus={(event) => event.target.select()} onChange={(event) => setData((current) => ({ ...current, markup: event.target.value }))} /></Field>
          <Field label="Tax (%)" hint="Defaults to 0; use the rate applicable to this quote."><Input type="number" min="0" value={data.tax} onFocus={(event) => event.target.select()} onChange={(event) => setData((current) => ({ ...current, tax: event.target.value }))} /></Field>
        </div>
      </SectionCard>
      <section className="rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Live total</p>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd className="font-bold">₹{subtotal.toLocaleString("en-IN")}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Discount</dt><dd className="font-bold text-rose-300">− ₹{discount.toLocaleString("en-IN")}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Markup</dt><dd className="font-bold">₹{asNumber(data.markup).toLocaleString("en-IN")}</dd></div>
        </dl>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Final quotation</p>
          <p className="mt-1 text-3xl font-black">₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
        </div>
      </section>
    </div>
  );
}

const lines = (value) => String(value || "")
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);

// A row counts — in the running total AND in the saved quotation — only once it names the thing it
// sells. initialModel() pre-builds a row for every enabled service and one sightseeing day per night,
// while the completion checks below only require that ONE row of a section be filled. Untouched rows
// were therefore submitted too and printed as blank cards on the customer's document. Filtering here
// rather than only in buildData keeps the live subtotal equal to the amount that gets saved.
// Hotels are absent on purpose: save() already blocks unless EVERY stay is complete.
const ROW_HAS_CONTENT = {
  flight: (row) => Boolean(row.airline || String(row.from || "").trim() || String(row.to || "").trim()),
  /* A day counts if ANY of its activities is filled, not just the flat first one. Without the
     second half, a day where the agent left activity 1 blank and filled activity 2 would be
     silently dropped from the saved quotation AND from the running total — the exact class of
     bug the departure-day comment in initialModel warns about, one layer down. */
  sightseeing: (row) => Boolean(String(row.attraction || "").trim())
    || (row.activities || []).some((act) => String(act?.attraction || "").trim()),
  vehicle: (row) => Boolean(String(row.model || "").trim() || String(row.type || "").trim()),
  cruise: (row) => Boolean(String(row.name || "").trim()),
  addons: (row) => Boolean(String(row.serviceType || "").trim()),
};

const filledRows = (section, rows) => {
  const hasContent = ROW_HAS_CONTENT[section];
  return hasContent ? (rows || []).filter(hasContent) : (rows || []);
};

const sectionTotal = {
  hotel: (rows) => rows.reduce((sum, stay) => {
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const roomTotal = (stay.roomLines || []).reduce(
      (roomSum, room) => roomSum + asNumber(room.pricePerRoom) * Math.max(1, asNumber(room.rooms, 1)),
      0,
    );
    return sum + roomTotal * nights;
  }, 0),
  flight: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerPax) * Math.max(1, asNumber(row.pax, 1)), 0),
  /* The day's own price, plus every extra activity's. Each activity carries its own price and
     pax exactly as the full quotation does, so a second activity on a day is charged rather
     than quietly free. */
  sightseeing: (rows) => rows.reduce((sum, row) => (
    sum
    + asNumber(row.pricePerPax) * Math.max(1, asNumber(row.pax, 1))
    + (row.activities || []).reduce(
        (actSum, act) => actSum + asNumber(act.pricePerPax) * Math.max(1, asNumber(act.pax, 1)),
        0,
      )
  ), 0),
  vehicle: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerVehicle) * Math.max(1, asNumber(row.qty, 1)), 0),
  cruise: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerPax) * Math.max(1, asNumber(row.pax, 1)), 0),
  addons: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerUnit) * Math.max(1, asNumber(row.quantity, 1)), 0),
};

/* ─── Derivations ─────────────────────────────────────────────────────────────────────────────
   Pure functions, not hooks, because the builder now has two hosts — this page and the rapid lead
   form — and both must compute the running total, the done-ticks and the section list identically.
   One implementation is the only way that stays true. */

/* ─── Comparison options ──────────────────────────────────────────────────────────────────────
   One quote carrying 2–3 priced alternatives, so the customer compares on one page instead of
   opening three quotations.

   ONLY hotel and vehicle vary. That is not a limitation of the server — an option there may
   override any of the six sections — it is the shape of the job: the itinerary, the sightseeing,
   the inclusions and the terms are the SAME trip in every column, and repeating them per option
   would be three copies of one paragraph for the customer and three times the typing for the agent.
   Everything outside this list stays on the model and is sent once, and the server inherits it into
   every option. Adding a third varying section later is one more entry here plus one more panel
   route — the payload and the server already handle it. */
const COMPARED_SECTIONS = ["hotel", "vehicle"];

/** Owner's cap, 27 Aug. Enforced on the server too (`@Size(max = 3)`), which is the real gate. */
const MAX_QUOTE_OPTIONS = 3;

/* The strip's scroll anchor. The header's Compare button lives in this page's top bar while the
   strip itself renders inside QuickQuoteSections — a different component — so the button reaches it
   by DOM id rather than by ref. Threading a ref down through the accordion for one scroll would be a
   wider change than the button is worth, and the id is stable because there is exactly one strip. */
const COMPARE_STRIP_ID = "quote-compare-strip";

const optionsOf = (model) => (Array.isArray(model?.options) ? model.options : []);

/* Nothing outside this module needs any of the helpers below, so none of them is exported: the
   hosts drive the builder through QuickQuoteSections and quickQuotePayload, which already know
   about options. Exporting them would widen the feature's public surface for no consumer and add a
   react-refresh warning apiece. */

/** The option the Hotel/Vehicle panels are editing; null when this is not a comparison at all. */
const quickQuoteActiveOption = (model) => {
  const options = optionsOf(model);
  if (options.length === 0) return null;
  return options.find((option) => option.id === model.activeOptionId) || options[0];
};

/**
 * The option whose figures stand for the whole quote — the running total, the completion ticks and
 * the "Final quotation" line. The recommended one, else the first.
 *
 * <p>It must match what the server puts at the TOP LEVEL of the response (QuotationMapper's
 * defaultOptionView: recommended, else first), or the figure the agent reads while building would
 * not be the figure the customer's document leads with.
 */
const headlineOption = (model) => {
  const options = optionsOf(model);
  if (options.length === 0) return null;
  return options.find((option) => option.recommended) || options[0];
};

/** The hotel/vehicle data a given option sells — its own. Falls back to the model's for safety. */
const sectionFor = (model, option, key) => (option && option[key] ? option[key] : model[key]);

/* Fresh ids on every row and room line. Two options must never share a row id, or editing a hotel
   in one column silently edits the same hotel in another — the exact bug initialModel already
   guards against between two stays. */
const cloneSection = (section) => ({
  ...section,
  rows: (section?.rows || []).map((row) => ({
    ...row,
    id: rowId(),
    ...(row.roomLines ? { roomLines: row.roomLines.map((line) => ({ ...line, id: rowId() })) } : {}),
    ...(row.activities ? { activities: row.activities.map((act) => ({ ...act, id: rowId() })) } : {}),
  })),
});

/** A new column, copied from `source` so the agent edits differences instead of retyping the trip. */
const makeQuoteOption = (source, label) => ({
  id: rowId(),
  // Null until the server has saved it. Echoed back on edit so a rename or a reorder keeps the
  // option — and keeps a share link the customer already opened pointing at the same column.
  publicId: null,
  label,
  subtitle: "",
  recommended: false,
  hotel: cloneSection(source.hotel),
  vehicle: cloneSection(source.vehicle),
});

/** Turn an ordinary quote into a comparison: column 1 is what is already built, column 2 a copy. */
const startComparison = (model) => {
  if (!model || optionsOf(model).length > 0) return model;
  const first = makeQuoteOption(model, "Option 1");
  first.recommended = true;
  const second = makeQuoteOption(model, "Option 2");
  return { ...model, options: [first, second], activeOptionId: first.id, templateStyle: "COMPARISON" };
};

/* ── Auto-build ───────────────────────────────────────────────────────────────────────────────
   `startComparison` gives two columns that are COPIES of each other, so every column after the
   first is the same trip re-picked and re-priced by hand: hotel search, room type, price, per stay,
   per column. That is the whole reason a comparison felt like three quotations.

   The tiers below turn the job around. The itinerary already says which city each stay is in, and
   the Hotel Master already knows that city's 3/4/5-star properties AND their selling rates — so the
   three columns can be DERIVED and the agent is left adjusting rather than typing. Nothing here is
   final: every field lands in the ordinary panels and is editable exactly as if it had been picked
   by hand. */
const AUTO_OPTION_TIERS = [
  { label: "Budget", stars: 3 },
  // The middle tier carries the star, because the recommended column is what the cover and every
  // roll-up figure lead with (headlineOption) — and an agent who auto-builds and sends without
  // touching it should be recommending the middle package, not the cheapest.
  { label: "Deluxe", stars: 4, recommended: true },
  { label: "Premium", stars: 5 },
];

/** Can auto-build do anything at all here? Only stays that name a city can be looked up. */
const autoBuildableStays = (model) =>
  (model?.hotel?.rows || []).filter((stay) => String(stay?.city || "").trim());

/**
 * Build one column per tier by pulling that tier's hotel for each stay's city out of the master.
 *
 * <p>Requests are deduplicated per (city, stars) and issued together, so a 3-stay trip across 2
 * cities costs 6 lookups, not 9, and they overlap. A tier with no property in that city leaves the
 * stay exactly as the copy had it — a half-built column the agent can finish beats a silently empty
 * one — and every such gap is reported back so the toast can name it.
 *
 * <p>Returns the options; it does not touch the model. The caller applies them, which keeps this
 * function testable and keeps the async gap out of the state update.
 */
const autoBuildOptions = async (model) => {
  const stays = autoBuildableStays(model);
  const cities = [...new Set(stays.map((stay) => String(stay.city).trim()))];

  const wanted = cities.flatMap((city) => AUTO_OPTION_TIERS.map((tier) => ({ city, stars: tier.stars })));
  const found = new Map();
  await Promise.all(wanted.map(async ({ city, stars }) => {
    try {
      // Empty query, so this is "every N-star hotel in this city" — the master's own order decides
      // which one, the same list the picker would have shown.
      const results = await loadHotels("", city, stars);
      if (results.length > 0) found.set(`${city}|${stars}`, results[0]);
    } catch {
      // One tier failing must not sink the other eight. It shows up as a gap in the toast, and the
      // agent picks that stay by hand — which is exactly where they were before this button existed.
    }
  }));

  const gaps = [];
  const options = AUTO_OPTION_TIERS.map((tier) => {
    const option = makeQuoteOption(model, tier.label);
    option.recommended = Boolean(tier.recommended);
    let matched = 0;
    option.hotel = {
      ...option.hotel,
      rows: option.hotel.rows.map((stay) => {
        const city = String(stay?.city || "").trim();
        if (!city) return stay;
        const hotel = found.get(`${city}|${tier.stars}`);
        if (!hotel) {
          gaps.push(`${city} (${tier.stars}★)`);
          return stay;
        }
        matched += 1;
        return { ...stay, ...hotelStayPatch(stay, hotel) };
      }),
    };
    // Only claim the tier on the customer's document when the column actually holds that tier.
    if (matched > 0) option.subtitle = `${tier.stars}-star stays`;
    return { option, matched };
  });

  return {
    options: options.map((entry) => entry.option),
    matched: options.reduce((sum, entry) => sum + entry.matched, 0),
    gaps: [...new Set(gaps)],
  };
};

/**
 * Drop back to a single package. The surviving column's hotel/vehicle are folded onto the model, so
 * the agent keeps the rows they built instead of reverting to whatever the base happened to hold.
 */
const endComparison = (model) => {
  if (!model || optionsOf(model).length === 0) return model;
  const keep = headlineOption(model);
  return {
    ...model,
    hotel: keep ? cloneSection(keep.hotel) : model.hotel,
    vehicle: keep ? cloneSection(keep.vehicle) : model.vehicle,
    options: [],
    activeOptionId: null,
    templateStyle: model.templateStyle === "COMPARISON" ? "CLASSIC" : model.templateStyle,
  };
};

/** Section totals for ONE option — the per-column price in the strip and in the payload. */
const quickQuoteOptionTotals = (model, option) => {
  const hotel = sectionTotal.hotel(sectionFor(model, option, "hotel").rows);
  const vehicle = sectionTotal.vehicle(filledRows("vehicle", sectionFor(model, option, "vehicle").rows));
  const flight = sectionTotal.flight(filledRows("flight", model.flight.rows));
  const sightseeing = sectionTotal.sightseeing(filledRows("sightseeing", model.sightseeing.rows));
  const cruise = sectionTotal.cruise(filledRows("cruise", model.cruise.rows));
  const addons = sectionTotal.addons(filledRows("addons", model.addons.rows));
  const result = { hotel, flight, sightseeing, vehicle, cruise, addons };
  result.subtotal = model.enabledCore.reduce((sum, id) => sum + result[id], 0) + addons;
  return result;
};

/** What the customer pays for ONE option, through the same breakdown the Pricing panel prints. */
const quickQuoteOptionGrandTotal = (model, option) =>
  priceBreakdown(model.pricing, quickQuoteOptionTotals(model, option).subtotal).grandTotal;

export const quickQuoteTotals = (model) => {
  if (!model) return { hotel: 0, flight: 0, sightseeing: 0, vehicle: 0, cruise: 0, addons: 0, subtotal: 0 };
  // On a comparison the running total is the HEADLINE option's, matching the figure the server puts
  // at the top level of the document. On an ordinary quote `headlineOption` is null and this is the
  // model's own hotel/vehicle — i.e. exactly what it has always been.
  return quickQuoteOptionTotals(model, headlineOption(model));
};

/* What the customer is actually asked to pay — the same number PricingPanel prints as "Final
   quotation". Exported because the zero-total guard and the panel must never disagree. */
export const quickQuoteGrandTotal = (model) =>
  model ? priceBreakdown(model.pricing, quickQuoteTotals(model).subtotal).grandTotal : 0;

export const quickQuoteCompletion = (model) => {
  if (!model) return {};
  /* On a comparison the tick has to mean "EVERY column is filled in", not "the one I am looking at
     is". A half-built third option is exactly the thing an agent forgets, and a green tick on the
     Hotel section while one column has no hotel is the form telling them it is safe to send. */
  const options = optionsOf(model);
  const everyOption = (key, test) =>
    (options.length ? options : [null]).every((option) => test(sectionFor(model, option, key)));
  return {
    /* Only the hotel NAME and the fact that a stay has room lines. Room type and selling price used
       to be part of this test — `room.roomType.trim() && asNumber(room.pricePerRoom) > 0` — which is
       what made them mandatory: a false here trips validateQuickQuote's firstIncompleteCore gate with
       "Complete the main hotel details". The full quotation flow never required either
       (Createquotation.jsx's only save rule is a non-empty title; HotelTab defaults them to "" and 0),
       so Quick Quote was stricter than the flow it replicates. The name stays required because a
       nameless stay prints as a blank hotel card on the customer's PDF. */
    hotel: everyOption("hotel", (hotel) => hotel.rows.length > 0 && hotel.rows.every((stay) =>
      stay.name.trim() && stay.roomLines.length > 0)),
    flight: model.flight.rows.some((row) => row.airline && row.from.trim() && row.to.trim()),
    /* Departure days do not count. initialModel() pre-fills the final day with "Departure from
       <city>", so a bare `.some(row => row.attraction.trim())` would report the section complete on
       an itinerary with no actual sightseeing in it — and validateQuickQuote's firstIncompleteCore
       gate would wave through a ticked Sightseeing service the agent never filled in. */
    sightseeing: model.sightseeing.rows.some((row) => !row.isDepartureDay && row.attraction.trim()),
    vehicle: everyOption("vehicle", (vehicle) => vehicle.rows.some((row) => row.model.trim())),
    cruise: model.cruise.rows.some((row) => row.name.trim()),
    addons: model.addons.rows.length === 0 || model.addons.rows.every((row) => row.serviceType.trim()),
    terms: Boolean(model.terms.inclusions.trim() || model.terms.exclusions.trim()),
    pricing: true,
  };
};

/**
 * Reconcile the quote's ticked services against a host-owned service list, leaving everything the
 * agent has already filled in alone. The rapid lead form owns the ONLY services picker on its
 * screen, so ticking one there has to grow a section here even after the quote has been edited and
 * auto-seeding has stopped. Returns the same object when nothing changed, so calling it from an
 * effect cannot loop.
 */
export const syncQuickQuoteServices = (model, serviceIds) => {
  if (!model) return model;
  const wanted = CORE_SERVICES
    .map(({ id }) => id)
    .filter((id) => (serviceIds || []).some((service) => String(service).trim().toLowerCase() === id));
  const current = model.enabledCore;
  if (current.length === wanted.length && current.every((id, index) => id === wanted[index])) return model;
  return { ...model, enabledCore: wanted };
};

// Ticked services first, in CORE_SERVICES order, then the three that are always part of a quote.
export const quickQuoteSteps = (model) => {
  if (!model) return [];
  if (model.enabledCore.length === 0) return FIXED_STEPS;
  return [
    ...CORE_SERVICES.filter(({ id }) => model.enabledCore.includes(id)),
    ...FIXED_STEPS,
  ];
};

const plural = (count, singular, pluralForm) =>
  `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;

// One line of state per COLLAPSED section, so the agent can verify a section without reopening it —
// that is the whole point of collapsing them. Counts run through filledRows(), the same filter the
// running total and the saved payload use, so a header never advertises a row that will not be sent.
const sectionSummary = (id, model) => {
  if (!model) return "";
  /* Hotel and Vehicle describe the ACTIVE comparison column, matching what their panels are
     editing. A collapsed header that summarised a different column than the one the agent just
     typed into would be worse than no summary at all. */
  const activeOption = quickQuoteActiveOption(model);
  switch (id) {
    case SERVICES_STEP: {
      const chosen = CORE_SERVICES.filter(({ id: coreId }) => model.enabledCore.includes(coreId));
      return chosen.length
        ? chosen.map(({ label }) => label).join(" · ")
        : "Nothing selected — pick at least one";
    }
    case "hotel": {
      const named = sectionFor(model, activeOption, "hotel").rows
        .filter((stay) => String(stay.name || "").trim());
      if (!named.length) return "No hotel chosen yet";
      const rooms = named.reduce(
        (sum, stay) => sum + (stay.roomLines || []).reduce((count, room) => count + Math.max(1, asNumber(room.rooms, 1)), 0),
        0,
      );
      return `${plural(named.length, "hotel")} · ${plural(rooms, "room")}`;
    }
    case "flight": {
      const rows = filledRows("flight", model.flight.rows);
      return rows.length ? `${plural(rows.length, "flight")} · ${model.flight.journey}` : "No flight added yet";
    }
    case "sightseeing": {
      // Activities exclude the pre-filled departure day; the day COUNT still includes it, because
      // "5 days" is what the customer was sold. Counting it as an activity would make a blank
      // section read "1 activity over 5 days".
      const rows = filledRows("sightseeing", model.sightseeing.rows).filter((row) => !row.isDepartureDay);
      return rows.length
        ? `${plural(rows.length, "activity", "activities")} over ${plural(model.sightseeing.rows.length, "day")}`
        : `${plural(model.sightseeing.rows.length, "day")} planned · no activity yet`;
    }
    case "vehicle": {
      const rows = filledRows("vehicle", sectionFor(model, activeOption, "vehicle").rows);
      return rows.length ? plural(rows.length, "vehicle") : "No vehicle added yet";
    }
    case "cruise": {
      const rows = filledRows("cruise", model.cruise.rows);
      return rows.length ? plural(rows.length, "cruise") : "No cruise added yet";
    }
    case "addons": {
      const rows = filledRows("addons", model.addons.rows);
      return rows.length ? plural(rows.length, "add-on") : "Optional — nothing added";
    }
    case "terms": {
      const included = lines(model.terms.inclusions).length;
      const excluded = lines(model.terms.exclusions).length;
      return included || excluded
        ? `${plural(included, "inclusion")} · ${plural(excluded, "exclusion")}`
        : "Inclusions and exclusions are empty";
    }
    case "pricing": {
      const parts = [];
      if (asNumber(model.pricing.discount) > 0) {
        parts.push(`Discount ${model.pricing.discType === "%" ? `${model.pricing.discount}%` : `₹${asNumber(model.pricing.discount).toLocaleString("en-IN")}`}`);
      }
      if (asNumber(model.pricing.markup) > 0) parts.push(`Markup ₹${asNumber(model.pricing.markup).toLocaleString("en-IN")}`);
      if (asNumber(model.pricing.tax) > 0) parts.push(`Tax ${model.pricing.tax}%`);
      return parts.length ? parts.join(" · ") : "No discount, markup or tax";
    }
    default:
      return "";
  }
};

/* "Also need…" — the add-a-service control, rendered where the agent already is.
   The pick-driven host's only service picker sits ABOVE the accordion, so an agent who had just
   finished a long Hotel panel had to scroll back up past the whole panel to tick Vehicle and then
   find its section again. This puts the still-unticked services at the foot of the panel being
   worked on, so "hotel done, now the car" is one click from where the cursor already is.

   Add-only on purpose. Unticking a service throws away everything typed into its section, and that
   is a deliberate decision belonging to the picker above — not to a one-click chip sitting directly
   under the field the agent just left. The chips also stay visually OFF (dashed slate, pastel tile
   only on the icon) rather than borrowing the Services step's selected TONES look: these are things
   not yet in the quote, and colouring them like the picked ones would say the opposite. */
function NextServiceStrip({ enabledCore, onAdd, tail = false }) {
  const remaining = CORE_SERVICES.filter(({ id }) => !enabledCore.includes(id));
  if (remaining.length === 0) return null;
  return (
    <div
      className={tail
        ? "flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3"
        : "mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"}
    >
      <span className="text-xs font-semibold text-slate-500">
        {!tail ? "Also need" : enabledCore.length > 0 ? "Add another service" : "Add a service to price"}
      </span>
      {remaining.map(({ id, label, icon: Icon, tone }) => (
        <button
          key={id}
          type="button"
          onClick={() => onAdd(id)}
          title={`Add ${label} to this quotation`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white py-1.5 pl-1.5 pr-2.5 text-xs font-bold text-slate-600 transition hover:border-solid hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
        >
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${TILE_TONES[tone] || "bg-slate-100 text-slate-600"}`}>
            <Icon className="h-3 w-3" />
          </span>
          <Plus className="h-3 w-3 text-slate-400" />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * One collapsible section of the quick-quote accordion.
 *
 * The body stays MOUNTED when collapsed and is hidden with the `hidden` attribute instead of being
 * unmounted. Two things depend on that: the Enter-to-next-field handler already scopes itself with
 * `[data-quick-panel]:not([hidden])`, and the async comboboxes inside the panels keep their loaded
 * options rather than refetching every time a section is reopened.
 */
function AccordionSection({
  id, index, label, icon: Icon, tone, open, done, problemCount = 0, amount, summary, onToggle, children, footer,
}) {
  return (
    <section
      data-quick-section={id}
      className={`scroll-mt-32 overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        open ? "border-slate-300" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <h2 className="m-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`qq-body-${id}`}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
        >
          {/* The tile encodes WHICH section, never whether it is open — a filled slate-900 square on
              open was the darkest thing on the page and fought the flat language. Open/closed is
              carried by the chevron, the darker border and the visible body. */}
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TILE_TONES[tone] || "bg-slate-100 text-slate-600"}`}>
            <Icon className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-900">
                <span className="mr-0.5 text-[11px] font-bold tabular-nums text-slate-400">{index}.</span> {label}
              </span>
              {/* A section can be BOTH done and blocking — "at least 1 room" fails on a stay whose
                  hotel is named and priced — so the problem badge is not an else-branch of Done. It
                  comes first because it is the actionable one. */}
              {problemCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  <TriangleAlert className="h-3 w-3" />
                  {problemCount === 1 ? "Needs attention" : `${problemCount} to fix`}
                </span>
              )}
              {done && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <Check className="h-3 w-3" /> Done
                </span>
              )}
            </span>
            {summary && <span className="mt-0.5 block truncate text-xs text-slate-500">{summary}</span>}
          </span>

          {amount != null && (
            <span className="hidden shrink-0 text-sm font-bold tabular-nums text-slate-900 sm:block">
              ₹{asNumber(amount).toLocaleString("en-IN")}
            </span>
          )}
          <ChevronDown className={`ml-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>

      <div
        id={`qq-body-${id}`}
        data-quick-panel={id}
        hidden={!open}
        className={`border-t border-slate-100 p-4 sm:p-5 ${open ? "" : "hidden"}`}
      >
        {children}
        {footer && (
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">{footer}</div>
        )}
      </div>
    </section>
  );
}

/**
 * The quotation builder itself — the accordion and nothing else.
 *
 * Extracted from the page so the rapid lead form can host the exact same sections inline: an agent
 * taking a phone enquiry never leaves the intake screen to price it. The component is CONTROLLED on
 * `model`/`setModel` (the host owns the data it is about to save) but owns which section is open,
 * because that is pure UI. Hosts drive it imperatively through the ref:
 *
 *     sectionsRef.current?.reveal("hotel", "[data-hotel-selling-price]");
 *
 * `showServices` is the difference between the two hosts. Standalone, the accordion opens on its own
 * Services step. Inside the lead form, the form already has a Services picker feeding the same lead
 * record, so a second one would be two controls for one decision.
 *
 * `onAddService` is how that host stays usable anyway. The lead's `services` array is the source of
 * truth there — `enabledCore` is only a projection of it — so the accordion must not tick a service
 * into the model itself: the lead would be saved without the service the quotation prices. The strip
 * therefore hands the id back to the host, which toggles the lead field and lets the existing sync
 * grow the section.
 */
/**
 * The comparison strip — one quote carrying 2–3 priced alternatives.
 *
 * <p>It sits ABOVE the accordion rather than inside the Hotel panel because it governs the whole
 * document: which column the customer is being steered towards, what each column costs, and whether
 * this is a comparison at all. The sections it does not govern stay visibly shared below it, which
 * is the point — the agent types the itinerary and the terms ONCE.
 *
 * <p>Off by default and entirely absent until the agent asks for it, so an ordinary quote is the
 * screen it has always been plus one small button.
 */
function OptionStrip({ model, setModel }) {
  const options = optionsOf(model);
  const active = quickQuoteActiveOption(model);
  const { showToast } = useToast();
  const [autoBusy, setAutoBusy] = useState(false);
  // Offered only when the itinerary actually gives it something to look up. A button that can only
  // ever answer "nothing found" is worse than no button.
  const canAutoBuild = autoBuildableStays(model).length > 0;
  /* Read AFTER the await to decide whether the result still applies — the toast must not claim
     "three options built" when the updater below declined to build them. A flag assigned inside the
     setModel updater cannot do this job: React runs an updater during the state update, not at the
     call, so it is still false on the next line, and StrictMode runs it twice. Synced in an effect
     rather than during render, which is the rule react-hooks/refs enforces. */
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; });

  const patchOption = (id, patch) => setModel((current) => ({
    ...current,
    options: current.options.map((option) => (option.id === id ? { ...option, ...patch } : option)),
  }));

  const runAutoBuild = async () => {
    if (autoBusy) return;
    setAutoBusy(true);
    try {
      /* Built from the model as it is RIGHT NOW and applied when the lookups return. The guard in
         the updater is what makes that safe: if the agent started a comparison by hand while the
         requests were in flight, their columns win and this result is dropped rather than
         overwriting work they can see on screen. */
      const { options: built, matched, gaps } = await autoBuildOptions(model);
      if (matched === 0) {
        showToast("No matching hotels in the Hotel Master for these cities. Add rates there, or build the options by hand.", "error");
        return;
      }
      if (optionsOf(modelRef.current).length > 0) return;
      setModel((current) => (optionsOf(current).length > 0
        ? current
        : { ...current, options: built, activeOptionId: built[0].id, templateStyle: "COMPARISON" }));
      showToast(gaps.length
        ? `Three options built. No hotel found for ${gaps.join(", ")} — those stays kept the current hotel.`
        : "Three options built from the Hotel Master. Check the prices before you send.");
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not build the options."), "error");
    } finally {
      setAutoBusy(false);
    }
  };

  if (options.length === 0) {
    return (
      <div id={COMPARE_STRIP_ID} className="flex scroll-mt-28 flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2">
        <p className="text-xs text-slate-500">
          Quoting more than one package? Offer them side by side in a single quotation.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canAutoBuild && (
            <button
              type="button"
              onClick={runAutoBuild}
              disabled={autoBusy}
              title="Budget / Deluxe / Premium, filled from the 3, 4 and 5-star hotels in the Hotel Master for these cities"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy
                ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                : <Zap className="h-3.5 w-3.5" />}
              {autoBusy ? "Building…" : "Auto-build 3 options"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setModel((current) => startComparison(current))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Compare options
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* PINNED, and this is the whole reason the strip is split in two.
        The columns are switched and added while the agent is deep inside the Hotel panel, which is
        hundreds of pixels below — so an option bar that scrolls away means scrolling back up to the
        top for every single column. Sticky works here only because this element is a direct child of
        the accordion's tall container: a sticky child stops sticking at its own parent's bottom
        edge, so wrapping this in any short div silently kills it.

        `top` comes from the CSS variable the header publishes rather than a fixed number, because
        the header WRAPS on a narrow window and a hardcoded offset is only correct at one width.
        The background is fully opaque for the same reason it is pinned — content scrolls underneath.
        z-20 sits below the header's z-30 and below the pickers' z-40, so it covers neither. */}
    <div
      id={COMPARE_STRIP_ID}
      style={{ top: "var(--qq-header-h, 4.5rem)" }}
      className="sticky z-20 scroll-mt-28 rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
          Comparison — the customer picks one
        </p>
        <button
          type="button"
          onClick={() => setModel((current) => endComparison(current))}
          className="text-[11px] font-semibold text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline"
        >
          Stop comparing
        </button>
      </div>

      {/* One pill per column. Only Hotel and Vehicle follow the selection; everything else below is
          shared, which is why the pills carry the whole-quote price rather than a section price. */}
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => {
          const selected = Boolean(active && active.id === option.id);
          const total = quickQuoteOptionGrandTotal(model, option);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setModel((current) => ({ ...current, activeOptionId: option.id }))}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                selected
                  ? "border-violet-400 bg-white text-violet-800 shadow-sm"
                  : "border-transparent bg-white/60 text-slate-500 hover:bg-white"
              }`}
            >
              {option.recommended && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
              <span>{String(option.label || "").trim() || "Untitled"}</span>
              <span className="tabular-nums font-semibold text-slate-400">
                ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </button>
          );
        })}

        {options.length < MAX_QUOTE_OPTIONS && (
          <button
            type="button"
            onClick={() => setModel((current) => {
              const source = quickQuoteActiveOption(current) || current;
              const next = makeQuoteOption(source, `Option ${current.options.length + 1}`);
              return { ...current, options: [...current.options, next], activeOptionId: next.id };
            })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
        )}
      </div>

    </div>

    {/* NOT pinned, deliberately. The name, the note and the recommend flag are typed once per column
        and then left alone, so pinning them would spend permanent screen height on fields nobody is
        looking at — while the pills above, which are used constantly, are what has to stay reachable. */}
      {/* The selected column's own details. One editor rather than inline-editable pills: the label
          is what the customer reads as a heading, and it deserves a real field. */}
      {active && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500">Option name</span>
            <input
              value={active.label || ""}
              onChange={(event) => patchOption(active.id, { label: event.target.value })}
              placeholder="Budget"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-violet-400"
            />
          </label>
          <label className="flex min-w-[12rem] flex-[2] flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500">One-line note (optional)</span>
            <input
              value={active.subtitle || ""}
              onChange={(event) => patchOption(active.id, { subtitle: event.target.value })}
              placeholder="3-star properties, breakfast included"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-violet-400"
            />
          </label>
          <button
            type="button"
            /* At most one recommended column — the same rule the server enforces. Ticking a new
               favourite unticks the old one here rather than letting the server silently drop it. */
            onClick={() => setModel((current) => ({
              ...current,
              options: current.options.map((option) => ({
                ...option,
                recommended: option.id === active.id ? !active.recommended : false,
              })),
            }))}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              active.recommended
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${active.recommended ? "fill-amber-400 text-amber-500" : ""}`} />
            {active.recommended ? "Recommended" : "Recommend"}
          </button>
          {options.length > 1 && (
            <button
              type="button"
              onClick={() => setModel((current) => {
                const left = current.options.filter((option) => option.id !== active.id);
                // Dropping to one column is no longer a comparison; fold it back rather than leaving
                // a one-column table nobody asked for.
                if (left.length < 2) return endComparison({ ...current, options: left, activeOptionId: left[0]?.id || null });
                return {
                  ...current,
                  options: left,
                  activeOptionId: left.some((option) => option.id === current.activeOptionId)
                    ? current.activeOptionId : left[0].id,
                };
              })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      )}

      <p className="px-1 text-[11px] text-slate-500">
        Hotel and Vehicle below belong to <b>{String(active?.label || "").trim() || "this option"}</b>.
        Everything else — itinerary, add-ons, terms and pricing — is shared by all options.
      </p>
    </>
  );
}

export const QuickQuoteSections = forwardRef(function QuickQuoteSections({
  model,
  setModel,
  showServices = true,
  submitSlot = null,
  onSectionDone = null,
  onAddService = null,
  onRequestSave,
  className = "",
}, ref) {
  const steps = useMemo(() => quickQuoteSteps(model), [model]);
  const totals = useMemo(() => quickQuoteTotals(model), [model]);
  /* The ACTIVE column's figures, for the two section headers that follow the selection. `totals`
     above stays the HEADLINE column's, because that is what the Pricing panel and the running
     "Final quotation" mean — the number the customer's document leads with. The distinction is only
     visible on a comparison; off one, both are the same object's worth of numbers. */
  const activeTotals = useMemo(
    () => (model ? quickQuoteOptionTotals(model, quickQuoteActiveOption(model)) : totals),
    [model, totals],
  );
  const completion = useMemo(() => quickQuoteCompletion(model), [model]);

  /* Problems are collected always, DISPLAYED only after a save has been attempted — a form that
     marks itself red before the agent has typed anything is noise, and noise is what makes real
     errors get scrolled past. Hosts flip this via ref.showProblems() in their failure branch.

     It never has to be turned off: `problems` is recomputed from the model on every render, so a
     fixed section drops out of the list and its banner disappears as the agent types. That is the
     behaviour the old single-toast flow could not have — the message was gone before the fix. */
  const [problemsShown, setProblemsShown] = useState(false);
  const problems = useMemo(
    () => (problemsShown ? quickQuoteProblems(model) : []),
    [problemsShown, model],
  );
  const problemsBySection = useMemo(() => {
    const map = {};
    problems.forEach((problem) => {
      if (!problem.section) return;   // title lives in the host's header, not in a panel
      (map[problem.section] ||= []).push(problem.message);
    });
    return map;
  }, [problems]);

  const [openSection, setOpenSection] = useState(() => (showServices ? SERVICES_STEP : ""));

  /* In the pick-driven host the service being worked on is hoisted to the TOP of the list, so the
     open panel is always the first thing under the picker instead of drifting further down as more
     services are ticked. Add-ons / Terms / Pricing keep their tail position — Pricing stays last,
     because it reads the totals everything above it produces — and they are never hoisted. The
     wizard host keeps a stable order: there Next walks the list, and a list that reorders under a
     Next button is disorienting. */
  const sections = useMemo(() => {
    const head = showServices ? [SERVICES_META] : [];
    const body = [...steps];
    if (onSectionDone && openSection && !FIXED_STEPS.some(({ id }) => id === openSection)) {
      const at = body.findIndex(({ id }) => id === openSection);
      if (at > 0) body.unshift(...body.splice(at, 1));
    }
    return [...head, ...body];
  }, [onSectionDone, openSection, showServices, steps]);
  const sectionIds = useMemo(() => sections.map(({ id }) => id), [sections]);

  // Every open goes through revealSection(), so scrolling and focusing live in ONE place instead of
  // being re-implemented at each call site. `selector` lets a caller aim at a specific field (save()
  // points at the offending price input); the tick makes a re-reveal of the ALREADY-open section fire
  // the effect again, which is exactly what a validation failure on the current section needs.
  const pendingFocusRef = useRef(null);
  const [revealTick, setRevealTick] = useState(0);
  const revealSection = useCallback((id, selector = null) => {
    pendingFocusRef.current = selector;
    setOpenSection(id);
    setRevealTick((tick) => tick + 1);
  }, []);

  useImperativeHandle(ref, () => ({
    reveal: revealSection,
    /**
     * Open a section WITHOUT travelling to it — no scroll, no focus.
     *
     * <p>Distinct from reveal() on purpose. reveal() is "the agent just asked for this section, put
     * them in it", and it moves the caret. This is "this section should already be open when the
     * accordion appears" — which happens when services were pre-ticked from the previous enquiry
     * rather than clicked, so nothing ever queued a reveal and the whole block mounted collapsed.
     *
     * <p>It works because the focus/scroll effect bails while {@code revealTick === 0}: setting
     * openSection alone changes what is rendered and nothing else. Calling this AFTER a real reveal
     * would focus, so it is only safe as an initial state — which is the only thing it is for.
     * Stealing the caret on mount is exactly what was removed from the booking form's fast panels.
     */
    open: (id) => setOpenSection(id),
    close: () => setOpenSection(""),
    /* Explicit, rather than piggy-backing on reveal(): reveal is also how a newly ticked service
       gets opened, and turning the whole accordion red because the agent picked "Cruise" would
       punish them for making progress. Only a failed save calls this. */
    showProblems: () => setProblemsShown(true),
  }), [revealSection]);

  // A service switched back off takes its section with it. If that was the open one, fall back to
  // Services (or to nothing, when the host owns the service picker) rather than leaving a dead id.
  useEffect(() => {
    if (!model || !openSection || sectionIds.includes(openSection)) return;
    setOpenSection(showServices ? SERVICES_STEP : "");
  }, [model, openSection, sectionIds, showServices]);

  // scrollIntoView (not window.scrollTo) because the app shell scrolls <main>, not the window — the
  // `scroll-mt-24` on each section is what clears the sticky header. Focus runs with preventScroll so
  // it cannot fight the smooth scroll that just started.
  /* Opening a section does NOT move the page. Sections expand and collapse where they are; the
     picker and the surrounding form stay exactly where the agent left them. The one exception is a
     validation jump, which arrives with an explicit field selector — there the whole point is to put
     the offending input on screen, so that case still scrolls.

     `model` must NOT be a dependency here. It gets a new identity on every keystroke (setPart
     spreads), so with it in the list this effect re-armed its 40 ms timer between characters and
     kept yanking focus back to the section's first field mid-typing. revealTick already encodes
     "a reveal was requested", which is the only thing this effect cares about. */
  useEffect(() => {
    if (revealTick === 0 || !openSection) return undefined;
    const requestedField = pendingFocusRef.current;
    pendingFocusRef.current = null;
    const timer = window.setTimeout(() => {
      if (requestedField) {
        document.querySelector(`[data-quick-section="${openSection}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      document.querySelector(`[data-quick-panel="${openSection}"] ${requestedField || "[data-quick-field]"}`)
        ?.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [openSection, revealTick]);

  const setPart = useCallback((part, updater) => {
    setModel((current) => {
      if (!current) return current;
      const nextPart = typeof updater === "function" ? updater(current[part]) : updater;
      return { ...current, [part]: nextPart };
    });
  }, [setModel]);

  /**
   * Writes for a section that a comparison OPTION owns — hotel and vehicle.
   *
   * <p>This is the whole of Option A's mechanism: `HotelPanel` and `VehiclePanel` are handed the
   * ACTIVE option's section instead of the model's, in the same shape, so neither panel knows a
   * comparison exists and neither needed a single line changed. Off a comparison there is no active
   * option and this is `setPart` verbatim.
   */
  const setComparedPart = useCallback((part, updater) => {
    setModel((current) => {
      if (!current) return current;
      const active = quickQuoteActiveOption(current);
      if (!active) {
        const nextPart = typeof updater === "function" ? updater(current[part]) : updater;
        return { ...current, [part]: nextPart };
      }
      return {
        ...current,
        options: current.options.map((option) => {
          if (option.id !== active.id) return option;
          const nextPart = typeof updater === "function" ? updater(option[part]) : updater;
          return { ...option, [part]: nextPart };
        }),
      };
    });
  }, [setModel]);

  /** The section the panels should READ — the active option's, or the model's when not comparing. */
  const comparedPart = useCallback(
    (part) => sectionFor(model, quickQuoteActiveOption(model), part),
    [model],
  );

  /* Ticking a service IS the request to fill it in, so the section it just created opens straight
     away — the agent picks Hotel and is already typing hotel rows, instead of picking, scrolling and
     hunting. Unticking opens nothing; the fallback effect above handles the section going away.
     enabledCore is rebuilt in CORE_SERVICES order so the sections never reshuffle by click order. */
  const toggleService = (id) => {
    const enabling = !model.enabledCore.includes(id);
    setModel((current) => {
      if (!current) return current;
      const next = current.enabledCore.includes(id)
        ? current.enabledCore.filter((item) => item !== id)
        : [...current.enabledCore, id];
      return { ...current, enabledCore: CORE_SERVICES.map((service) => service.id).filter((coreId) => next.includes(coreId)) };
    });
    if (enabling) revealSection(id);
  };

  const moveStep = useCallback((delta) => {
    if (!sectionIds.length) return;
    const index = Math.max(0, sectionIds.indexOf(openSection));
    const nextIndex = Math.min(sectionIds.length - 1, Math.max(0, index + delta));
    revealSection(sectionIds[nextIndex]);
  }, [openSection, revealSection, sectionIds]);

  const handleKeys = (event) => {
    // Only claim Ctrl+Enter when this host actually has somewhere to send it. The accordion is
    // mounted INSIDE the lead form, whose own handler saves on Ctrl+Enter — swallowing the key with
    // no onRequestSave would make the shortcut silently dead everywhere inside the quote.
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      if (!onRequestSave) return;
      event.preventDefault();
      onRequestSave();
      return;
    }
    if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      moveStep(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    // Alt+0 is Services; Alt+1…8 stay pinned to the quotation sections, so the number a section
    // answers to never shifts when Services is or is not part of this host's accordion.
    // preventDefault runs for EVERY Alt+digit the accordion owns, hit or miss: the lead form reads
    // Alt+1/Alt+2 as "switch entry mode", so letting an unmatched Alt+2 bubble would throw the agent
    // out of rapid mode and unmount the quote they were building.
    if (event.altKey && /^[0-8]$/.test(event.key)) {
      event.preventDefault();
      if (event.key === "0") {
        if (showServices) revealSection(SERVICES_STEP);
        return;
      }
      const shortcutId = SHORTCUT_STEPS[Number(event.key) - 1];
      const target = steps.find(({ id }) => id === shortcutId);
      if (target) revealSection(target.id);
      return;
    }
    /* Esc collapses the open section. The only thing Esc did before was close a combobox dropdown
       (AsyncCombobox stops that one with stopPropagation-by-preventDefault), so pressing it anywhere
       else did nothing — and the agent had to reach for the mouse to fold a finished section away.
       Guarded on defaultPrevented so a dropdown Esc still means "close the dropdown", not "close the
       whole section underneath it". */
    if (event.key === "Escape" && !event.defaultPrevented) {
      if (!openSection) return;
      event.preventDefault();
      setOpenSection("");
      return;
    }

    /* Shift+Enter appends a row to the section being worked on, then lands the caret in it — the
       same idiom the rapid lead form uses for "add the next itinerary stop". Adding a hotel, a day
       or a vehicle was the last thing on this screen that REQUIRED the mouse.

       Scoped, not global: "Add room type" repeats once per stay, so an unscoped lookup would always
       find the first hotel's button and add a room to the wrong stay. The nearest [data-quick-addscope]
       ancestor wins; every other panel has one trailing button and falls through to the panel.

       The new row's first field is found by COUNT, not by guessing at DOM shape: rows render before
       the trailing add button, so the first field that did not exist a moment ago sits exactly at the
       old field count. Deferred a tick because React has not committed the new row yet. */
    if (event.key === "Enter" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.defaultPrevented) {
      const scope = event.target.closest?.("[data-quick-addscope]")
        || document.querySelector("[data-quick-panel]:not([hidden])");
      const addButton = scope?.querySelector("[data-quick-add]");
      if (!addButton) return;
      event.preventDefault();
      const before = visibleQuickFields().length;
      addButton.click();
      window.setTimeout(() => {
        const after = visibleQuickFields();
        const target = after[before] || after[after.length - 1];
        target?.focus();
        target?.select?.();
      }, 0);
      return;
    }

    if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "TEXTAREA" || event.defaultPrevented) return;
    const fields = visibleQuickFields();
    const index = fields.indexOf(event.target);
    if (index >= 0 && fields[index + 1]) {
      event.preventDefault();
      fields[index + 1].focus();
      fields[index + 1].select?.();
    }
  };

  if (!model) return null;

  // Every panel is MOUNTED for as long as its service is ticked — collapsing only hides it. The
  // panels hold no state of their own (everything lives in `model`), so what this buys is that the
  // async comboboxes keep their loaded options instead of refetching on every reopen.
  const panelFor = (id) => {
    switch (id) {
      case SERVICES_STEP:
        return (
          <>
            <p className="mb-3 text-xs font-semibold text-slate-500">
              Pick what this quotation covers. Each ticked service becomes its own section below.
              Add-ons, Terms and Pricing are always included.
            </p>
            <div className="flex flex-wrap gap-2">
              {CORE_SERVICES.map(({ id: serviceId, label, icon: Icon, tone }) => {
                const selected = model.enabledCore.includes(serviceId);
                return (
                  <button
                    key={serviceId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleService(serviceId)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-bold transition ${
                      selected ? TONES[tone] : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
            {model.enabledCore.length === 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs text-slate-500">Nothing selected yet — a quotation needs at least one service.</p>
              </div>
            )}
          </>
        );
      // Hotel and Vehicle are the two sections a comparison option owns — they read and write the
      // ACTIVE column. Every other case below stays on the model and is shared by all options.
      case "hotel": return <HotelPanel data={comparedPart("hotel")} setData={(updater) => setComparedPart("hotel", updater)} loadHotels={loadHotels} />;
      case "flight": return <FlightPanel data={model.flight} setData={(updater) => setPart("flight", updater)} />;
      case "sightseeing": return <SightseeingPanel data={model.sightseeing} setData={(updater) => setPart("sightseeing", updater)} loadSightseeing={loadSightseeing} />;
      case "vehicle": return <VehiclePanel data={comparedPart("vehicle")} setData={(updater) => setComparedPart("vehicle", updater)} loadVehicles={loadVehicles} />;
      case "cruise": return <CruisePanel data={model.cruise} setData={(updater) => setPart("cruise", updater)} />;
      case "addons": return <AddonsPanel data={model.addons} setData={(updater) => setPart("addons", updater)} />;
      case "terms": return <TermsPanel data={model.terms} setData={(updater) => setPart("terms", updater)} />;
      case "pricing": return <PricingPanel data={model.pricing} setData={(updater) => setPart("pricing", updater)} subtotal={totals.subtotal} />;
      default: return null;
    }
  };

  const lastIndex = sections.length - 1;

  return (
    <div className={`space-y-3 ${className}`} onKeyDown={handleKeys}>
      {/* Above the accordion on purpose: it governs the whole document, and the sections it does
          NOT govern staying visibly below it is what tells the agent the itinerary and the terms
          are typed once. Renders as a single dismissable prompt until they ask for it.

          Mounted BARE, with no wrapper div, and that is load-bearing: once comparing it renders a
          STICKY pill bar, and a sticky element only sticks inside its own parent's box. A wrapper
          here would be a few pixels tall, so the bar would unstick after the first section — the
          exact problem it exists to solve. Its two halves are siblings of the sections instead,
          which is also what gives them this container's `space-y-3`. */}
      <OptionStrip model={model} setModel={setModel} />
      {sections.map((meta, index) => (
        <AccordionSection
          key={meta.id}
          id={meta.id}
          index={index + 1}
          label={meta.label}
          icon={meta.icon}
          tone={meta.tone}
          open={openSection === meta.id}
          // A collapsed section must still say it is the reason the save failed — otherwise the
          // agent opens six panels looking for the red one.
          problemCount={(problemsBySection[meta.id] || []).length}
          done={meta.id === SERVICES_STEP ? model.enabledCore.length > 0 : Boolean(completion[meta.id])}
          amount={meta.id === SERVICES_STEP
            ? null
            : asNumber((COMPARED_SECTIONS.includes(meta.id) ? activeTotals : totals)[meta.id])}
          summary={sectionSummary(meta.id, model)}
          onToggle={() => revealSection(openSection === meta.id ? "" : meta.id)}
          footer={(
            <>
              {/* Previous only belongs to the wizard flow. In the pick-driven host the way back is
                  the picker above, and a Prev that jumped to an unrelated section would fight it. */}
              {onSectionDone ? (
                <span className="text-xs text-slate-400">
                  {onAddService ? "Done collapses this section." : "Finish this section, then pick the next service."}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveStep(-1)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
              )}
              <span className="text-[11px] font-bold tabular-nums text-slate-400">{index + 1} / {sections.length}</span>
              {/* Two flows, one component. With onSectionDone the host is PICK-driven: finish a
                  service, it collapses, you go tick the next one — the lead form works that way
                  because its Services picker sits above the accordion and stays on screen. Without
                  it the accordion is a wizard and Next walks to the following section, which is what
                  the standalone page needs since its Services picker IS the first section. */}
              {onSectionDone ? (
                <button
                  type="button"
                  onClick={() => onSectionDone(meta.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" /> Done
                </button>
              ) : index === lastIndex && submitSlot ? submitSlot : (
                <button
                  type="button"
                  disabled={index === lastIndex}
                  onClick={() => moveStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        >
          {/* Every problem this section has, at the TOP of its body — the first thing under the
              header the agent just opened, and beside the fields it is about rather than in a toast
              that has already faded by the time they look. Self-clearing: `problems` recomputes from
              the model, so the banner goes as the fix is typed. role="alert" so a screen reader
              hears it when a failed save reveals the section. */}
          {(problemsBySection[meta.id] || []).length > 0 && (
            <ul
              role="alert"
              className="mb-3 space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5"
            >
              {problemsBySection[meta.id].map((message) => (
                <li key={message} className="flex items-start gap-1.5 text-[11px] font-bold text-rose-700">
                  <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                  {message}
                </li>
              ))}
            </ul>
          )}
          {panelFor(meta.id)}
          {/* Inside every real section, so it is on screen wherever the agent is working. Panels stay
              mounted when collapsed, so this is in the DOM many times but visible only for the open
              one — which is why the tail copy below is gated on nothing being open rather than being
              rendered unconditionally. */}
          {onAddService && meta.id !== SERVICES_STEP && (
            <NextServiceStrip enabledCore={model.enabledCore} onAdd={onAddService} />
          )}
        </AccordionSection>
      ))}

      {/* Everything collapsed — after Done there is no panel footer to carry the strip, and the
          picker above is a full screen away again. */}
      {onAddService && !openSection && (
        <NextServiceStrip enabledCore={model.enabledCore} onAdd={onAddService} tail />
      )}
    </div>
  );
});

/**
 * Form model → the CreateQuotationRequest the backend expects.
 *
 * Pure and exported for the same reason as the derivations above: two hosts, one payload. `includeLead`
 * is false on update — sending leadId asks the backend to take a fresh lead snapshot, which would
 * overwrite the customer/PAX context captured when the quote was created.
 */
/** One stay's room lines flattened to the wire shape. One persisted hotel row per ROOM. */
const hotelRowsPayload = (hotel) => (hotel?.rows || []).flatMap((stay) => stay.roomLines.map((room) => ({
  hotelMasterPublicId: stay.hotelMasterPublicId,
  roomTypeMasterPublicId: room.roomTypeMasterPublicId,
  mealPlanMasterPublicId: room.mealPlanMasterPublicId,
  platformHotelPublicId: stay.platformHotelPublicId,
  platformRoomPublicId: room.platformRoomPublicId,
  platformMealPlanPublicId: room.platformMealPlanPublicId,
  name: stay.name,
  city: stay.city,
  checkIn: stay.checkIn,
  checkOut: stay.checkOut,
  refundable: stay.refundable,
  stars: stay.stars,
  imagePath: room.imagePath || stay.imagePath,
  /* Blank → null, not "". Both are now reachable because room type is optional, and null is the
     value the PDF templates are written against: quotation-premium renders
     `fmt.orElse(h.roomType, 'To be confirmed')` and quotation-modern hides its chip on
     `h.roomType != null`. An empty string would satisfy neither and print a blank cell. No
     template changes — the templates already handle null correctly. */
  roomType: String(room.roomType || "").trim() || null,
  mealPlan: room.mealPlan,
  bedType: room.bedType,
  occupancy: room.occupancy,
  adults: room.adults,
  children: room.children,
  infants: room.infants,
  extraBeds: room.extraBeds,
  childAges: room.childAges,
  rateSource: room.rateSource,
  /* Was passed through raw. That was safe only while validation guaranteed a positive number;
     with the price optional the blank case is now reachable and `""` would hit a BigDecimal
     deserializer. Sent as null instead — the column is nullable, computeTotals reads section
     amounts (not this), and quotation-premium's rate line is guarded by `h.pricePerRoom != null`,
     so a blank price simply omits the line rather than printing "₹ 0". */
  pricePerRoom: String(room.pricePerRoom ?? "").trim() === "" ? null : asNumber(room.pricePerRoom),
  // Normalised, not passed through: the qty box holds a string, and "" would reach the server as
  // a room count of nothing on a line the page has already priced as one room.
  rooms: Math.max(1, asNumber(room.rooms, 1)),
})));

/**
 * The comparison columns, or `undefined` when this is not a comparison.
 *
 * <p><b>Undefined, never null and never `[]`, when there is nothing to say.</b> Those three mean
 * three different things by the time they reach the server: an ABSENT key leaves an existing
 * comparison untouched, an EMPTY array deletes it, and a populated one replaces it. Quick Quote
 * emits the key only when it actually has columns, so saving an ordinary quote can never delete a
 * comparison — and `buildQuotationPayload` drops an undefined value before it reaches the wire.
 *
 * <p>Each option sends ONLY the sections it varies. Everything else is left off, which the server
 * reads as INHERIT — that is what keeps a three-column quote from being three copies of one trip.
 */
const quickQuoteOptionsPayload = (model) => {
  const options = optionsOf(model);
  // One option is not a comparison; it would render as an ordinary single-package quotation anyway.
  // Sending it would still be correct, but it would flip the document to the COMPARISON design for a
  // table with one column. The lone option is kept in the MODEL — the agent is one click from a
  // second — it just is not sent yet.
  if (options.length < 2) return undefined;
  return options.slice(0, MAX_QUOTE_OPTIONS).map((option, index) => {
    const totals = quickQuoteOptionTotals(model, option);
    return {
      publicId: option.publicId || null,
      label: String(option.label || `Option ${index + 1}`).trim(),
      subtitle: String(option.subtitle || "").trim() || null,
      sortOrder: index,
      recommended: Boolean(option.recommended),
      hotel: {
        included: model.enabledCore.includes("hotel"),
        title: option.hotel.title,
        amount: totals.hotel,
        notes: option.hotel.notes,
        hotels: hotelRowsPayload(option.hotel),
      },
      vehicle: {
        included: model.enabledCore.includes("vehicle"),
        title: option.vehicle.title,
        amount: totals.vehicle,
        vehicles: filledRows("vehicle", option.vehicle.rows),
      },
    };
  });
};

export const quickQuotePayload = ({ model, lead, leadId, includeLead = true }) => {
  if (!model) return null;
  const totals = quickQuoteTotals(model);
  const options = quickQuoteOptionsPayload(model);
  const itineraryId = lead?.itinerary?.[0]?.publicId || lead?.itinerary?.[0]?.id || null;
  // The COMPARISON design is chosen by the SHAPE of the quote, not by taste: a document built around
  // N columns has nowhere to put them in the other four designs. An ordinary quote keeps whatever
  // the agent picked.
  const templateStyle = options ? "COMPARISON" : model.templateStyle;

  /* THE QUOTATION LEVEL MIRRORS THE HEADLINE OPTION on a comparison — not the pre-comparison base.
     `headlineOption` is null on an ordinary quote, so this is the model's own hotel/vehicle and
     nothing changes there.

     It matters because several things read the quotation's OWN columns and know nothing about
     options: the lead list's Amount and Margin, the booking form's "as per quotation" amount
     prefill, and the pipeline's quoted-value card all come from a single-table projection
     (`QuotationRepository.findLatestRefsForLeads`) that never joins quotation_options. Sending the
     stale base here would show the agent a figure for a package the customer was never offered.
     Sending the recommended option's makes every one of those read correctly, with no server
     change. The rows are carried too so the figure and the lines behind it agree. */
  const headline = headlineOption(model);
  const baseHotel = sectionFor(model, headline, "hotel");
  const baseVehicle = sectionFor(model, headline, "vehicle");
  return {
    leadId: includeLead ? leadId : null,
    destinationId: itineraryId,
    title: model.title.trim(),
    version: "v1.0",
    quotationStage: "Draft",
    templateStyle,
    options,
    flightIncluded: model.enabledCore.includes("flight"),
    flightTitle: model.flight.title,
    flightAmount: totals.flight,
    journey: model.flight.journey,
    segments: filledRows("flight", model.flight.rows),
    hotelIncluded: model.enabledCore.includes("hotel"),
    hotelTitle: baseHotel.title,
    hotelAmount: totals.hotel,
    hotelNotes: baseHotel.notes,
    quickQuoteHotelMetadata: true,
    hotels: hotelRowsPayload(baseHotel),
    sightseeingIncluded: model.enabledCore.includes("sightseeing"),
    sightseeingTitle: model.sightseeing.title,
    sightseeingAmount: totals.sightseeing,
    sightseeingNotes: model.sightseeing.notes,
    days: filledRows("sightseeing", model.sightseeing.rows).map((row) => ({
      day: row.day,
      date: row.date,
      pricePerPax: row.pricePerPax,
      pax: row.pax,
      activities: [{
        attraction: row.attraction,
        startTime: row.startTime,
        description: row.description,
        meals: [],
        transfer: row.transfer,
        imagePath: row.imagePath,
      }],
    })),
    vehicleIncluded: model.enabledCore.includes("vehicle"),
    vehicleTitle: baseVehicle.title,
    vehicleAmount: totals.vehicle,
    vehicles: filledRows("vehicle", baseVehicle.rows),
    cruiseIncluded: model.enabledCore.includes("cruise"),
    cruiseTitle: model.cruise.title,
    cruiseAmount: totals.cruise,
    cruises: filledRows("cruise", model.cruise.rows),
    addonIncluded: filledRows("addons", model.addons.rows).length > 0,
    addonTitle: "Add-on Services",
    addonAmount: totals.addons,
    addons: filledRows("addons", model.addons.rows),
    inclusions: lines(model.terms.inclusions),
    exclusions: lines(model.terms.exclusions),
    paymentPolicies: lines(model.terms.paymentPolicies),
    cancellationPolicies: lines(model.terms.cancellationPolicies),
    bookingTerms: lines(model.terms.bookingTerms),
    discount: model.pricing.discount,
    discType: model.pricing.discType,
    tax: model.pricing.tax,
    markup: model.pricing.markup,
  };
};

/**
 * Take the option ids the server just assigned back into the model.
 *
 * <p><b>Both hosts must call this after every successful create AND update, or saving twice creates
 * the columns twice.</b> `publicId` is how the server recognises an option it already has: null
 * means "this one is new". A model that never learns the ids it was given keeps claiming every
 * column is new, so the second save builds a fresh set beside the first — and even where the old
 * ones are retired correctly, the columns the customer's share link points at have silently changed
 * identity, which is exactly what carrying the id was meant to prevent.
 *
 * <p>Matched by position, not by label: `quickQuotePayload` numbers `sortOrder` from the array index
 * and the server preserves it, so index N here is sortOrder N there. Labels are free text and two
 * columns may briefly share one while the agent is typing.
 *
 * <p>Returns the same object when there is nothing to adopt, so calling it from an effect or after
 * an unrelated save cannot loop or churn state.
 */
export const adoptQuoteOptionIds = (model, savedQuotation) => {
  const saved = savedQuotation?.options;
  if (!model || !optionsOf(model).length || !Array.isArray(saved) || saved.length === 0) return model;
  const byOrder = new Map(saved.map((option, index) => [
    option?.sortOrder == null ? index : option.sortOrder,
    option?.publicId || null,
  ]));
  let changed = false;
  const options = model.options.map((option, index) => {
    const assigned = byOrder.get(index);
    if (option.publicId || !assigned) return option;
    changed = true;
    return { ...option, publicId: assigned };
  });
  return changed ? { ...model, options } : model;
};

/**
 * Blocking checks shared by both hosts. Returns null when the quote is safe to save, otherwise the
 * message plus the section (and optional field) the agent has to be taken to. Kept out of the
 * components so neither host can drift into accepting a quote the other would reject.
 */
/**
 * EVERY problem with this model, in the order the accordion presents them.
 *
 * This used to be a chain of early returns that surfaced exactly ONE problem per save attempt, as a
 * toast. A quote with an unpriced hotel, a blank add-on and no title therefore took three save
 * attempts to diagnose, each one announcing a single sentence that then faded — and the agent was
 * typing while it faded. Collecting them means the accordion can mark every offending section at
 * once and print each message beside the field it is about (see `problems` in QuickQuoteSections).
 *
 * `validateQuickQuote` below still returns just the first, so both hosts' save paths are unchanged:
 * they keep blocking on the first problem and scrolling to it. The list is the display channel, the
 * first item is still the gate.
 */
export const quickQuoteProblems = (model) => {
  if (!model) return [{ message: "Nothing to save yet.", section: null }];
  const problems = [];
  const push = (message, section, field) => problems.push({ message, section, field });

  if (!model.title.trim()) push("Enter a quotation title.", null, "[data-quick-title]");
  if (model.enabledCore.length === 0 && model.addons.rows.length === 0) {
    push("Select at least one service for this quotation.", SERVICES_STEP);
  }
  /* ── Comparison columns ──────────────────────────────────────────────────────────────────────
     Checked before the section rules below, because those now run across EVERY column and a column
     with no label is the thing that makes their messages unreadable. */
  const options = optionsOf(model);
  if (options.length > MAX_QUOTE_OPTIONS) {
    push(`A comparison can carry at most ${MAX_QUOTE_OPTIONS} options.`, "hotel");
  }
  if (options.some((option) => !String(option.label || "").trim())) {
    push("Give every comparison option a name — the customer reads it as the column heading.", "hotel");
  }
  {
    const labels = options.map((option) => String(option.label || "").trim().toLowerCase()).filter(Boolean);
    if (new Set(labels).size !== labels.length) {
      push("Two comparison options have the same name — the customer cannot tell them apart.", "hotel");
    }
  }

  /* The two multiplication guards below run over every column, not just the one on screen. A zeroed
     room count in a collapsed option prices as one room and silently disagrees with the quote. */
  const hotelsToCheck = options.length ? options.map((option) => option.hotel) : [model.hotel];
  if (model.enabledCore.includes("hotel")
    && hotelsToCheck.some((hotel) => hotel.rows.some((stay) =>
      stay.roomLines.some((room) => asNumber(room.adults) < 1)))) {
    push("Every hotel room needs at least one adult.", "hotel", "[data-room-adults]");
  }
  /* A line stands for N rooms now, and the qty box is typeable — so it can be cleared or zeroed.
     The totals clamp with Math.max(1, …) and would happily price a "0" line as one room, quietly
     disagreeing with what the agent is looking at. Rejected here instead, next to the two rules it
     belongs with, rather than clamped silently on the way out. */
  if (model.enabledCore.includes("hotel")
    && hotelsToCheck.some((hotel) => hotel.rows.some((stay) =>
      stay.roomLines.some((room) => asNumber(room.rooms, 0) < 1)))) {
    push("Every room type needs at least 1 room.", "hotel", "[data-room-qty]");
  }
  /* The selling-price gate is gone on purpose. It read:

       if (… rows.some((stay) => stay.roomLines.some((room) => asNumber(room.pricePerRoom) <= 0)))
         return { message: "Enter your selling price for every selected hotel room.", … };

     An agent quoting a room whose rate is still being negotiated had to invent a number to get past
     it. A blank price is now simply ₹0: asNumber() coerces "" to 0, sectionTotal.hotel multiplies
     that out to zero, and the backend stores the client-computed hotelAmount — there is no profit
     engine at quotation stage (netProfit lives on Booking), so nothing downstream divides by it or
     reads it as a cost. The room line still shows an amber "adds ₹0" hint next to the field.

     The two rules ABOVE this stay, and the distinction matters: adults ≥ 1 and rooms ≥ 1 guard the
     MULTIPLICATION — a 0-room line prices as one room and silently disagrees with what the agent is
     looking at. A 0 price disagrees with nothing. */
  const completion = quickQuoteCompletion(model);
  // EVERY incomplete section, not just the first — that was the single biggest reason a save took
  // three attempts: fix the hotel, save, learn about the vehicle, save, learn about the cruise.
  model.enabledCore.filter((service) => !completion[service]).forEach((service) => {
    const label = CORE_SERVICES.find(({ id }) => id === service)?.label || "Service";
    push(`Complete the main ${label.toLowerCase()} details before creating the quote.`, service);
  });
  if (model.addons.rows.length > 0 && !completion.addons) {
    push("Choose a service type for every add-on row.", "addons");
  }
  /* ── The one money rule, and it is deliberately the LAST one ─────────────────────────────────
     Individual prices are optional now — a room, an activity or a vehicle may legitimately be
     quoted at 0 while a rate is still being negotiated. What must never leave the building is a
     quotation that asks the customer for nothing at all: it reads as a free holiday, and it is
     indistinguishable from a save that silently lost its prices.

     Checked last on purpose. The total is a consequence of every section above it, so raising it
     before the section that is actually empty would point the agent at Pricing when the real
     problem is an unpriced hotel. It is also checked against the SAME priceBreakdown() the panel
     renders, so the rule and the figure on screen can never disagree — a markup-only quote
     (subtotal 0, markup ₹5,000) is valid and passes.

     Mirrored on the server in QuotationServiceImpl — this one is the fast, in-context half. */
  if (options.length) {
    // Every COLUMN, not just the headline one. A ₹0 alternative sitting beside two priced ones is
    // the same "free holiday" document, and the running total — which shows only the headline —
    // cannot reveal it.
    const zeroed = options.filter((option) => quickQuoteOptionGrandTotal(model, option) <= 0);
    zeroed.forEach((option) => {
      const name = String(option.label || "").trim() || "An option";
      push(`${name} totals ₹0 — add at least one price before creating it.`, "pricing");
    });
  } else if (quickQuoteGrandTotal(model) <= 0) {
    push("This quotation totals ₹0 — add at least one price before creating it.", "pricing");
  }
  return problems;
};

/**
 * The FIRST problem, or null. Unchanged contract — both hosts still gate their save on this and
 * scroll to the section it names.
 */
export const validateQuickQuote = (model) => quickQuoteProblems(model)[0] || null;

export default function QuickQuotation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const leadId = searchParams.get("leadId") || "";
  const [quotationAtMount] = useState(() => searchParams.get("quotationId"));
  const routedLead = location.state?.lead;
  const routedLeadId = routedLead?.publicId || routedLead?.id;
  const usableRoutedLead = routedLead && String(routedLeadId) === String(leadId) ? routedLead : null;

  const [lead, setLead] = useState(usableRoutedLead);
  const [model, setModel] = useState(() => initialModel(usableRoutedLead));
  const [quotationId, setQuotationId] = useState("");
  const [quoteNo, setQuoteNo] = useState("");
  const [stylePickOpen, setStylePickOpen] = useState(false);
  const [loading, setLoading] = useState(!usableRoutedLead && Boolean(leadId));
  const [saving, setSaving] = useState(false);
  // The accordion owns which section is open; the page only needs to point it at a problem field.
  const sectionsRef = useRef(null);
  const canUpdateQuotation = useMemo(() => hasPermission(P.QUOTATION_UPDATE), []);
  const {
    downloadPdf: runPdfDownload,
    isDownloading: pdfBusy,
    progress: pdfProgress,
    progressSupported: pdfProgressSupported,
  } = usePdfDownload();

  useEffect(() => {
    if (!quotationAtMount || !leadId) return;
    navigate(
      `/createquotation?leadId=${encodeURIComponent(leadId)}&quotationId=${encodeURIComponent(quotationAtMount)}`,
      { replace: true },
    );
  }, [leadId, navigate, quotationAtMount]);

  useEffect(() => {
    if (!leadId || usableRoutedLead || quotationAtMount) return undefined;
    let active = true;
    leadService.getLeadById(leadId)
      .then((response) => {
        if (!active) return;
        const data = response?.data?.data || response?.data || {};
        setLead(data);
        // Services stays open — the lead only SEEDS the ticked services, it does not confirm them.
        setModel(initialModel(data));
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Could not load the lead for this quotation."), "error");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId, quotationAtMount, showToast, usableRoutedLead]);

  const totals = useMemo(() => quickQuoteTotals(model), [model]);
  const steps = useMemo(() => quickQuoteSteps(model), [model]);
  const completion = useMemo(() => quickQuoteCompletion(model), [model]);

  const save = useCallback(async () => {
    if (!leadId) {
      showToast("Quick Quote must be linked to a lead.", "error");
      return;
    }
    if (quotationId && !canUpdateQuotation) {
      showToast("You can create quotations, but you do not have permission to update this one.", "error");
      return;
    }
    // One shared rule set with the rapid lead form — see validateQuickQuote. The accordion is told
    // which section to open and which field to land on, so the agent never has to hunt for the cause.
    const problem = validateQuickQuote(model);
    if (problem) {
      // Mark every offending section, then scroll to the first. The toast stays for the ONE case the
      // accordion cannot show inline — a missing title, which lives in this page's header.
      sectionsRef.current?.showProblems();
      if (problem.section) sectionsRef.current?.reveal(problem.section, problem.field || null);
      else if (problem.field) document.querySelector(problem.field)?.focus();
      showToast(problem.message, "error");
      return;
    }
    setSaving(true);
    try {
      const payload = quickQuotePayload({ model, lead, leadId, includeLead: !quotationId });
      if (quotationId) {
        await quotationService.updateQuotation(quotationId, payload);
        showToast("Quotation updated successfully.");
      } else {
        const response = await quotationService.createQuotation(payload);
        const body = response?.data?.data || response?.data || {};
        const newId = body.publicId || body.id;
        if (!newId) throw new Error("Quotation was saved but its ID was not returned.");
        setQuotationId(String(newId));
        setQuoteNo(body.quoteNo == null ? "" : String(body.quoteNo));
        // Only after the server accepted it — an abandoned draft must not become the next quote's
        // defaults. Same call in the rapid lead form's inline-quote path.
        rememberQuickQuoteDefaults(model);
        navigate(
          `/quick-quote?leadId=${encodeURIComponent(leadId)}&quotationId=${encodeURIComponent(String(newId))}`,
          { replace: true, state: { lead, quickQuote: true } },
        );
        showToast("Quotation created successfully.");
      }
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not save the quotation."), "error");
    } finally {
      setSaving(false);
    }
  }, [canUpdateQuotation, lead, leadId, model, navigate, quotationId, showToast]);

  // Deliver. A quick quote is not finished when it is saved, it is finished when the customer has
  // it — so the PDF and the share link live here rather than only in the full editor. Both reuse the
  // builder's plumbing: the same design picker, the same streaming download hook, the same endpoint.
  const exportPdfAs = useCallback(async (style) => {
    setStylePickOpen(false);
    try {
      // Readable business code in the file name — never the raw UUID when a quote number exists.
      const code = quoteNo || String(quotationId).slice(0, 8).toUpperCase();
      await runPdfDownload({
        endpoint: `/quotations/${quotationId}/pdf`,
        params: style ? { style } : undefined,
        fileName: `TravelCRM-Quotation-${code}.pdf`,
      });
      showToast("PDF downloaded successfully!");
    } catch (error) {
      // The hook rehydrates the Blob error envelope, so the server's real message shows.
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Failed to generate PDF."), "error");
    }
  }, [quotationId, quoteNo, runPdfDownload, showToast]);

  const copyShareLink = useCallback(async () => {
    try {
      const response = await quotationService.getShareLink(quotationId);
      const link = response?.data?.data?.shareUrl || response?.data?.shareUrl || "";
      if (!link) throw new Error("The share link was not returned.");
      try {
        await navigator.clipboard.writeText(link);
        showToast("Share link copied!");
      } catch {
        // The clipboard API needs a secure context (https or localhost). Showing the URL still
        // lets the agent copy it by hand instead of dead-ending on a browser restriction.
        showToast(link);
      }
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Failed to generate the share link."), "error");
      }
    }
  }, [quotationId, showToast]);

  /**
   * Publish this header's measured height as `--qq-header-h` on the page root, for the comparison
   * bar to pin against.
   *
   * The header is `flex-wrap`, so its height is NOT a constant — it grows a row on a narrow window
   * and shrinks when the save button loses its label. A hardcoded `top-[70px]` is therefore correct
   * at exactly one width and leaves either a strip of content showing through above the bar or a
   * gap below the header at every other one.
   *
   * Written straight to the DOM rather than into state on purpose: nothing RENDERS from this value,
   * only CSS reads it, so putting it in state would re-render the whole page on every resize tick to
   * produce identical markup.
   */
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const publish = () => el.parentElement?.style.setProperty("--qq-header-h", `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return undefined;   // older browser: the fallback in the bar's `top` covers it
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * The header's Compare control — ONE handler for both states, because `startComparison` already
   * returns the model unchanged once options exist. That identity return is what makes this safe to
   * call while comparing: React bails out of the re-render, and the click is a plain scroll.
   *
   * Deliberately never the reverse. Turning comparison OFF drops the columns the agent built (that
   * is `endComparison`'s whole job), and a destructive action does not belong on a one-word button
   * in a toolbar — "Stop comparing" stays on the strip, next to the work it discards.
   *
   * The scroll is deferred a frame: on the first click the strip has only just grown from a one-line
   * prompt into the full editor, and scrolling to its pre-render height lands short of it.
   */
  const openComparison = useCallback(() => {
    setModel((current) => startComparison(current));
    requestAnimationFrame(() => {
      // `start`, not `center`: the bar is sticky and lands directly under the header, so centring it
      // would scroll the page to a position it immediately springs back from. `scroll-mt-28` on the
      // bar itself is what keeps the header from covering it.
      document.getElementById(COMPARE_STRIP_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  if (!leadId) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-6" style={{ fontFamily: QUICK_QUOTE_FONT }}>
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center">
          <Zap className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-xl font-black text-slate-900">Start from a lead</h1>
          <p className="mt-2 text-sm text-slate-600">Quick Quote reuses customer, itinerary and PAX data, so it cannot create an unlinked quotation.</p>
          <button type="button" onClick={() => navigate("/CreateLead")} className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Create lead</button>
        </div>
      </main>
    );
  }

  if (loading || !model) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center gap-3 text-sm font-bold text-slate-500" style={{ fontFamily: QUICK_QUOTE_FONT }}>
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> Preparing your quote from the lead…
      </main>
    );
  }

  const destination = lead?.itinerary?.map((item) => item.city || item.destination).filter(Boolean).join(" → ");
  const adults = Math.max(1, asNumber(lead?.adults ?? lead?.totalAdults, 1));
  const children = Math.max(0, asNumber(lead?.children));
  const infants = Math.max(0, asNumber(lead?.infants));
  const doneCount = steps.filter(({ id }) => completion[id]).length;

  // Drives the header's Compare button. A count rather than a boolean because the button reports the
  // state back — "Comparing · 2" is what tells the agent the quote they are about to send carries
  // columns, on a screen where the strip itself can be scrolled off the top.
  const optionCount = optionsOf(model).length;

  // The submit control appears in the header AND as the last section's primary action; both must
  // read identically, so the label and the disabled rule are derived once.
  const submitDisabled = saving || (Boolean(quotationId) && !canUpdateQuotation);
  const submitLabel = saving
    ? (quotationId ? "Updating…" : "Creating…")
    : quotationId
      ? (canUpdateQuotation ? "Update Quote" : "Created")
      : "Create Quote";
  const SubmitIcon = saving ? LoaderCircle : quotationId ? Check : Zap;

  return (
    <main className="min-h-screen bg-slate-50" style={{ fontFamily: QUICK_QUOTE_FONT }}>
      <header ref={headerRef} className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Zap className="h-4 w-4" /></span>
                <h1 className="text-lg font-bold text-slate-900">Quick Quote</h1>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Draft</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{lead?.customerName || "Customer"} · {lead?.leadCode || "Lead"}</p>
            </div>
            <div className="hidden flex-1 items-center justify-center gap-2 xl:flex">
              {lead?.travelDate && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><CalendarDays className="h-3.5 w-3.5" />{String(lead.travelDate).slice(0, 10)}</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><Users className="h-3.5 w-3.5" />{adults} Adults · {children} Children · {infants} Infants · {Math.max(1, asNumber(lead?.rooms, 1))} Rooms</span>
              {destination && <span className="inline-flex max-w-sm items-center gap-1.5 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{destination}</span></span>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* The running subtotal and the done-count used to live in a 220px left rail. The
                  accordion replaced that rail, so they move here — otherwise the only always-visible
                  number on a long single-column form would be gone. */}
              <div className="mr-1 hidden text-right sm:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Subtotal · {doneCount}/{steps.length} done
                </p>
                <p className="text-base font-black leading-tight text-slate-900">
                  ₹{totals.subtotal.toLocaleString("en-IN")}
                </p>
              </div>
              {quotationId && (
                <button type="button" onClick={() => navigate("/createlead")} className="hidden items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 sm:inline-flex">
                  <Plus className="h-3.5 w-3.5" /> Next quote
                </button>
              )}
              {quotationId && canUpdateQuotation && (
                <button type="button" onClick={() => navigate(`/createquotation?leadId=${encodeURIComponent(leadId)}&quotationId=${encodeURIComponent(quotationId)}`)} className="hidden rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:inline-flex">
                  Open full editor
                </button>
              )}
              {/* NOT gated on quotationId, unlike Share and PDF below: comparison is something the
                  agent decides while building, usually before the first save, and a control that
                  only appears after saving would be found last instead of first. The strip above the
                  accordion stays the workspace — this is the entry point beside the other actions. */}
              <button
                type="button"
                onClick={openComparison}
                title={optionCount
                  ? `${optionCount} options on this quote — jump to the comparison strip`
                  : "Offer 2–3 packages side by side in one quotation"}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold transition ${
                  optionCount
                    ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {optionCount ? `Comparing · ${optionCount}` : "Compare"}
                </span>
              </button>
              {quotationId && (
                <>
                  <button
                    type="button"
                    onClick={copyShareLink}
                    title="Copy the customer share link"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <Share2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStylePickOpen(true)}
                    title="Download the quotation PDF"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span>
                  </button>
                </>
              )}
              <button type="button" disabled={submitDisabled} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                <SubmitIcon className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
                {submitLabel}
                <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold lg:inline">Ctrl ↵</kbd>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* One column, one open section. The old 220px rail is gone: with a single-open accordion the
          section list IS the navigation, so a second copy of it beside the form was dead weight. */}
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="min-w-0">
          {/* Title belongs to the whole quotation, not to any one section, so it sits above the
              accordion where it stays reachable no matter which section is open. */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <Field label="Quotation title" required>
                <input
                  data-quick-title
                  value={model.title}
                  onChange={(event) => setModel((currentModel) => ({ ...currentModel, title: event.target.value }))}
                  onKeyDown={(event) => {
                    // Enter must not submit a 40-field quote from the title box. Move on instead.
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    document.querySelector('[data-quick-panel]:not([hidden]) [data-quick-field]')?.focus();
                  }}
                  className={`${controlClass} font-bold`}
                  maxLength={200}
                />
              </Field>
              <p className="hidden pb-2.5 text-[11px] font-semibold text-slate-400 lg:block">
                Enter next field · Alt + arrows sections · Alt + 0…8 jump
              </p>
            </div>
          </section>

          <QuickQuoteSections
            ref={sectionsRef}
            className="mt-3"
            model={model}
            setModel={setModel}
            onRequestSave={save}
            submitSlot={(
              <button
                type="submit"
                disabled={submitDisabled}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SubmitIcon className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} /> {submitLabel}
              </button>
            )}
          />
        </form>
      </div>

      {/* Export PDF → pick a design. One-off: the quotation's own saved design is untouched. */}
      {stylePickOpen && (
        <QuotationStyleModal
          savedStyle={model.templateStyle}
          onSelect={exportPdfAs}
          onClose={() => setStylePickOpen(false)}
        />
      )}

      {/* Full-screen "preparing your PDF" overlay — shared with the leads list and the full builder. */}
      <PdfDownloadLoader
        open={pdfBusy}
        documentType="Quotation"
        progress={pdfProgress}
        progressSupported={pdfProgressSupported}
      />
    </main>
  );
}
