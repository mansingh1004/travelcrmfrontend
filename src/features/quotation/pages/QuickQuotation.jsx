import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FileCheck2,
  Hotel,
  IndianRupee,
  ListChecks,
  LoaderCircle,
  Map,
  MapPin,
  PackagePlus,
  Plane,
  Plus,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";

import { leadService } from "@features/leads";
import { hotelService, sightseeingService, vehicleService } from "@features/masters";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import { quotationService } from "../api/quotationService";
import {
  AIRLINES,
  CABIN_CATS,
  CLASSES,
  CRUISE_TYPES,
  JOURNEY_TYPES,
  TRANSFER,
} from "../Constants";

const CORE_SERVICES = [
  { id: "hotel", label: "Hotel", icon: Hotel, tone: "violet" },
  { id: "flight", label: "Flight", icon: Plane, tone: "blue" },
  { id: "sightseeing", label: "Sightseeing", icon: Map, tone: "emerald" },
  { id: "vehicle", label: "Vehicle", icon: Car, tone: "orange" },
  { id: "cruise", label: "Cruise", icon: Ship, tone: "cyan" },
];

const FIXED_STEPS = [
  { id: "addons", label: "Add-ons", icon: PackagePlus, tone: "rose" },
  { id: "terms", label: "Terms", icon: ListChecks, tone: "amber" },
  { id: "pricing", label: "Pricing", icon: CircleDollarSign, tone: "indigo" },
];
const SHORTCUT_STEPS = ["hotel", "flight", "sightseeing", "vehicle", "cruise", "addons", "terms", "pricing"];

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

function initialModel(lead) {
  if (!lead) return null;
  const itinerary = (Array.isArray(lead.itinerary) ? lead.itinerary : [])
    .filter((stop) => stop && (stop.city || stop.destination));
  const services = normalizedServices(lead);
  const enabledCore = CORE_SERVICES.map(({ id }) => id).filter((id) => services.includes(id));
  if (enabledCore.length === 0) enabledCore.push("hotel");

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
  const distribute = (total) => Array.from(
    { length: rooms },
    (_, index) => Math.floor(total / rooms) + (index < total % rooms ? 1 : 0),
  );
  const adultSplit = distribute(adults);
  const childSplit = distribute(children);
  const infantSplit = distribute(infants);
  const extraBedSplit = distribute(asNumber(lead.extraBeds));
  const roomAllocations = savedAllocations.length > 0
    ? savedAllocations
    : Array.from({ length: rooms }, (_, index) => ({
      roomNumber: index + 1,
      roomCategoryPreference: "Any",
      bedPreference: "Any",
      adults: adultSplit[index],
      children: childSplit[index],
      infants: infantSplit[index],
      extraBeds: extraBedSplit[index],
      childAges: [],
    }));

  return {
    title: [lead.customerName, destination, nights ? `${nights}N` : ""].filter(Boolean).join(" – ") || "Quotation",
    templateStyle: "CLASSIC",
    enabledCore,
    hotel: {
      title: "Hotel Details",
      notes: "",
      rows: (stays.length ? stays : [firstStay]).map((stay) => ({
        id: rowId(), name: "", city: stay.city, checkIn: stay.checkIn, checkOut: stay.checkOut,
        refundable: true, stars: 0, imagePath: "", hotelMasterPublicId: null,
        platformHotelPublicId: null, hotelOrigin: null, platformOwned: false, syncStatus: null,
        roomTypeOptions: [], mealPlanOptions: [],
        roomLines: roomAllocations.map((allocation, allocationIndex) => ({
          id: rowId(), roomNumber: allocation.roomNumber || allocationIndex + 1,
          roomCategoryPreference: allocation.roomCategoryPreference || "Any",
          bedPreference: allocation.bedPreference || "Any",
          adults: asNumber(allocation.adults), children: asNumber(allocation.children),
          infants: asNumber(allocation.infants), extraBeds: asNumber(allocation.extraBeds),
          childAges: Array.isArray(allocation.childAges) ? allocation.childAges : [],
          roomType: "", roomTypeMasterPublicId: null, platformRoomPublicId: null, bedType: "", occupancy: null,
          mealPlan: "", mealPlanMasterPublicId: null, platformMealPlanPublicId: null, pricePerRoom: "",
          masterBaseRate: null, rateSource: "MISSING", imagePath: "", rooms: 1,
        })),
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
    terms: {
      inclusions: [
        enabledCore.includes("hotel") ? "Accommodation as specified" : "",
        enabledCore.includes("sightseeing") ? "Sightseeing as per itinerary" : "",
        enabledCore.includes("vehicle") ? "Transfers as specified" : "",
        enabledCore.includes("flight") ? "Flights as specified" : "",
      ].filter(Boolean).join("\n"),
      exclusions: "Personal expenses\nAnything not mentioned in inclusions",
      paymentPolicies: "",
      cancellationPolicies: "",
      bookingTerms: "Rates and availability are subject to confirmation.",
    },
    pricing: { discount: 0, discType: "Fixed", tax: 0, markup: 0 },
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

function SectionCard({ title, icon: Icon, badge, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-extrabold text-slate-800">{title}</h2>
        {badge && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{badge}</span>}
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

function AsyncCombobox({ value, onValueChange, onSelect, loadOptions, getLabel, getSublabel, getBadge, getImage, placeholder }) {
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
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await loaderRef.current(String(value || "").trim());
        if (active) {
          setOptions(Array.isArray(rows) ? rows : []);
          setHighlight(0);
        }
      } catch {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [focused, value]);

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
        <ul role="listbox" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
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

const masterOptionKey = (option, fallback = "") => String(
  option?.publicId || option?.roomTypeId || option?.mealPlanId || option?.id || fallback,
);

const masterRoomRate = (roomType) => {
  if (roomType?.baseRate === "" || roomType?.baseRate == null) return null;
  const rate = Number(roomType.baseRate);
  return Number.isFinite(rate) ? rate : null;
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

function QuickHotelRoomLine({ stay, line, onUpdate, onRoomType, onMealPlan }) {
  const selectedRoom = stay.roomTypeOptions.find((option) =>
    String(option.publicId || "") === String(line.roomTypeMasterPublicId || ""))
    || stay.roomTypeOptions.find((option) => option.name === line.roomType);
  const selectedMeal = stay.mealPlanOptions.find((option) =>
    String(option.publicId || "") === String(line.mealPlanMasterPublicId || ""))
    || stay.mealPlanOptions.find((option) => option.name === line.mealPlan);
  const selectedRoomKey = selectedRoom ? masterOptionKey(selectedRoom) : "";
  const selectedMealKey = selectedMeal ? masterOptionKey(selectedMeal) : "";
  const pax = asNumber(line.adults) + asNumber(line.children) + asNumber(line.infants);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-slate-700">Room {line.roomNumber}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {asNumber(line.adults)} adults · {asNumber(line.children)} children · {asNumber(line.infants)} infants
            {line.extraBeds ? ` · ${line.extraBeds} extra bed` : ""}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-slate-200">
          {pax} PAX · {line.roomCategoryPreference || "Any room"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field
          label="Room type"
          required
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

        <Field label="Your selling price / room / night (₹)" required hint="This is the price shown to the customer">
          <Input
            data-hotel-selling-price
            type="number"
            min="1"
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

  const chooseHotel = (stay, hotel) => {
    const roomTypeOptions = Array.isArray(hotel.roomTypes)
      ? hotel.roomTypes.filter((room) => room?.active !== false)
      : [];
    const mealPlanOptions = Array.isArray(hotel.mealPlans)
      ? hotel.mealPlans.filter((meal) => meal?.active !== false)
      : [];
    const defaultMeal = mealPlanOptions[0] || null;
    const hotelImage = hotel.imagePath || hotel.imageUrl || "";
    const roomLines = stay.roomLines.map((line) => {
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
        pricePerRoom: "",
        masterBaseRate: baseRate,
        rateSource: "MISSING",
        imagePath: roomType?.images?.[0] || hotelImage,
      };
    });
    updateStay(stay.id, {
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
    });
  };

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
      pricePerRoom: "",
      masterBaseRate: baseRate,
      rateSource: "MISSING",
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
              <AsyncCombobox
                value={stay.name}
                onValueChange={(name) => clearHotel(stay.id, name)}
                onSelect={(hotel) => chooseHotel(stay, hotel)}
                loadOptions={(query) => loadHotels(query, stay.city)}
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
              />
            ))}
          </div>
        </SectionCard>
      ))}
      <button type="button" onClick={addHotel} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add hotel
      </button>
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
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, blank()] }))} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
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
  return (
    <div className="space-y-4">
      {data.rows.map((row, index) => (
        <SectionCard key={row.id} title={`Day ${row.day || index + 1}`} icon={MapPin} badge={[row.city, row.date].filter(Boolean).join(" · ")} action={data.rows.length > 1 ? <IconButton label="Remove activity" danger onClick={() => setData((current) => ({ ...current, rows: current.rows.filter((item) => item.id !== row.id) }))}><Trash2 className="h-4 w-4" /></IconButton> : null}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Attraction / activity" required>
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
                  getLabel={(item) => item.title || "Activity"}
                  getImage={(item) => item.imagePath || item.imageUrl || ""}
                  getSublabel={(item) => [item.city || item.cityName, item.estimatedHours ? `${item.estimatedHours}h` : ""].filter(Boolean).join(" · ")}
                  placeholder="Type attraction name"
                />
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
        </SectionCard>
      ))}
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, { ...current.rows[current.rows.length - 1], id: rowId(), day: current.rows.length + 1, attraction: "", description: "", imagePath: "", pricePerPax: 0 }] }))} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
        <Plus className="h-4 w-4" /> Add activity
      </button>
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
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, { ...current.rows[current.rows.length - 1], id: rowId(), type: "", model: "", imagePath: "", capacity: null, pricePerVehicle: 0 }] }))} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
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
      <button type="button" onClick={() => setData((current) => ({ ...current, rows: [...current.rows, { ...current.rows[current.rows.length - 1], id: rowId(), name: "", pricePerPax: 0 }] }))} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
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
    <SectionCard title="Add-on services" icon={PackagePlus} action={<button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><Plus className="h-3.5 w-3.5" /> Add</button>}>
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
  return (
    <SectionCard title="Inclusions, exclusions & terms" icon={FileCheck2}>
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

function PricingPanel({ data, setData, subtotal }) {
  const discount = data.discType === "%"
    ? subtotal * asNumber(data.discount) / 100
    : asNumber(data.discount);
  const beforeTax = Math.max(0, subtotal - discount + asNumber(data.markup));
  const grandTotal = beforeTax + beforeTax * asNumber(data.tax) / 100;
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
  sightseeing: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerPax) * Math.max(1, asNumber(row.pax, 1)), 0),
  vehicle: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerVehicle) * Math.max(1, asNumber(row.qty, 1)), 0),
  cruise: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerPax) * Math.max(1, asNumber(row.pax, 1)), 0),
  addons: (rows) => rows.reduce((sum, row) => sum + asNumber(row.pricePerUnit) * Math.max(1, asNumber(row.quantity, 1)), 0),
};

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
  const [activeStep, setActiveStep] = useState(
    () => normalizedServices(usableRoutedLead).find((service) => CORE_SERVICES.some(({ id }) => id === service)) || "hotel",
  );
  const [quotationId, setQuotationId] = useState("");
  const [loading, setLoading] = useState(!usableRoutedLead && Boolean(leadId));
  const [saving, setSaving] = useState(false);
  const canUpdateQuotation = useMemo(() => hasPermission(P.QUOTATION_UPDATE), []);

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
        const next = initialModel(data);
        setModel(next);
        setActiveStep(next?.enabledCore?.[0] || "hotel");
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Could not load the lead for this quotation."), "error");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId, quotationAtMount, showToast, usableRoutedLead]);

  const loadHotels = useCallback(async (query, city) => {
    const response = await hotelService.listHotels({ q: query || undefined, city: city || undefined, size: 20 });
    return extractList(response)
      .filter((hotel) => {
        const platformOwned = hotel?.platformOwned === true || hotel?.origin === "PLATFORM_SYNC";
        if (!platformOwned) return true;
        return hotel?.syncStatus !== "SOURCE_INACTIVE" && hotel?.marketplaceBookable !== false;
      })
      .slice(0, 20);
  }, []);

  const loadSightseeing = useCallback(async (query, destination, city) => {
    const response = destination && city
      ? await sightseeingService.getSightseeingsByCity(destination, city)
      : await sightseeingService.searchSightseeings(query || "");
    const normalized = String(query || "").trim().toLowerCase();
    return extractList(response)
      .filter((item) => !normalized || [item.title, item.city, item.cityName]
        .some((value) => String(value || "").toLowerCase().includes(normalized)))
      .slice(0, 30);
  }, []);

  const loadVehicles = useCallback(async (query) => {
    const response = query
      ? await vehicleService.searchVehicles(query)
      : await vehicleService.getAllVehicles();
    return extractList(response).slice(0, 30);
  }, []);

  const setPart = useCallback((part, updater) => {
    setModel((current) => {
      if (!current) return current;
      const nextPart = typeof updater === "function" ? updater(current[part]) : updater;
      return { ...current, [part]: nextPart };
    });
  }, []);

  const totals = useMemo(() => {
    if (!model) return { hotel: 0, flight: 0, sightseeing: 0, vehicle: 0, cruise: 0, addons: 0, subtotal: 0 };
    const result = {
      hotel: sectionTotal.hotel(model.hotel.rows),
      flight: sectionTotal.flight(model.flight.rows),
      sightseeing: sectionTotal.sightseeing(model.sightseeing.rows),
      vehicle: sectionTotal.vehicle(model.vehicle.rows),
      cruise: sectionTotal.cruise(model.cruise.rows),
      addons: sectionTotal.addons(model.addons.rows),
    };
    result.subtotal = model.enabledCore.reduce((sum, id) => sum + result[id], 0) + result.addons;
    return result;
  }, [model]);

  const hasModel = Boolean(model);
  const enabledCoreKey = model?.enabledCore.join("|") || "";
  const steps = useMemo(() => {
    if (!hasModel) return [];
    if (!enabledCoreKey) return FIXED_STEPS;
    const enabledCore = enabledCoreKey.split("|");
    return [
      ...CORE_SERVICES.filter(({ id }) => enabledCore.includes(id)),
      ...FIXED_STEPS,
    ];
  }, [enabledCoreKey, hasModel]);

  const completion = useMemo(() => {
    if (!model) return {};
    return {
      hotel: model.hotel.rows.length > 0 && model.hotel.rows.every((stay) =>
        stay.name.trim() && stay.roomLines.length > 0
        && stay.roomLines.every((room) => room.roomType.trim() && asNumber(room.pricePerRoom) > 0)),
      flight: model.flight.rows.some((row) => row.airline && row.from.trim() && row.to.trim()),
      sightseeing: model.sightseeing.rows.some((row) => row.attraction.trim()),
      vehicle: model.vehicle.rows.some((row) => row.model.trim()),
      cruise: model.cruise.rows.some((row) => row.name.trim()),
      addons: model.addons.rows.length === 0 || model.addons.rows.every((row) => row.serviceType.trim()),
      terms: Boolean(model.terms.inclusions.trim() || model.terms.exclusions.trim()),
      pricing: true,
    };
  }, [model]);

  useEffect(() => {
    if (!steps.some(({ id }) => id === activeStep)) return undefined;
    const timer = window.setTimeout(() => {
      document.querySelector(`[data-quick-panel="${activeStep}"] [data-quick-field]`)?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [activeStep, steps]);

  const toggleService = (id) => {
    const enabled = model?.enabledCore.includes(id);
    if (enabled && activeStep === id) {
      const remainingCore = model.enabledCore.filter((item) => item !== id);
      setActiveStep(remainingCore[0] || "addons");
    } else if (!enabled) {
      setActiveStep(id);
    }
    setModel((current) => {
      if (!current) return current;
      const currentlyEnabled = current.enabledCore.includes(id);
      const enabledCore = currentlyEnabled
        ? current.enabledCore.filter((item) => item !== id)
        : [...current.enabledCore, id];
      return { ...current, enabledCore };
    });
  };

  const buildData = useCallback(({ includeLead = true } = {}) => {
    if (!model) return null;
    const itineraryId = lead?.itinerary?.[0]?.publicId || lead?.itinerary?.[0]?.id || null;
    return {
      // Linking is create-only. Sending leadId on update asks the backend to take a fresh lead
      // snapshot and can overwrite the customer/PAX context captured when this quote was created.
      leadId: includeLead ? leadId : null,
      destinationId: itineraryId,
      title: model.title.trim(),
      version: "v1.0",
      quotationStage: "Draft",
      templateStyle: model.templateStyle,
      flightIncluded: model.enabledCore.includes("flight"),
      flightTitle: model.flight.title,
      flightAmount: totals.flight,
      journey: model.flight.journey,
      segments: model.flight.rows,
      hotelIncluded: model.enabledCore.includes("hotel"),
      hotelTitle: model.hotel.title,
      hotelAmount: totals.hotel,
      hotelNotes: model.hotel.notes,
      quickQuoteHotelMetadata: true,
      hotels: model.hotel.rows.flatMap((stay) => stay.roomLines.map((room) => ({
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
        roomType: room.roomType,
        mealPlan: room.mealPlan,
        bedType: room.bedType,
        occupancy: room.occupancy,
        adults: room.adults,
        children: room.children,
        infants: room.infants,
        extraBeds: room.extraBeds,
        childAges: room.childAges,
        rateSource: room.rateSource,
        pricePerRoom: room.pricePerRoom,
        rooms: room.rooms,
      }))),
      sightseeingIncluded: model.enabledCore.includes("sightseeing"),
      sightseeingTitle: model.sightseeing.title,
      sightseeingAmount: totals.sightseeing,
      sightseeingNotes: model.sightseeing.notes,
      days: model.sightseeing.rows.map((row) => ({
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
      vehicleTitle: model.vehicle.title,
      vehicleAmount: totals.vehicle,
      vehicles: model.vehicle.rows,
      cruiseIncluded: model.enabledCore.includes("cruise"),
      cruiseTitle: model.cruise.title,
      cruiseAmount: totals.cruise,
      cruises: model.cruise.rows,
      addonIncluded: model.addons.rows.length > 0,
      addonTitle: "Add-on Services",
      addonAmount: totals.addons,
      addons: model.addons.rows,
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
  }, [lead, leadId, model, totals]);

  const save = useCallback(async () => {
    if (!model?.title.trim()) {
      showToast("Enter a quotation title.", "error");
      document.querySelector('[data-quick-title]')?.focus();
      return;
    }
    if (!leadId) {
      showToast("Quick Quote must be linked to a lead.", "error");
      return;
    }
    if (quotationId && !canUpdateQuotation) {
      showToast("You can create quotations, but you do not have permission to update this one.", "error");
      return;
    }
    if (model.enabledCore.length === 0 && model.addons.rows.length === 0) {
      showToast("Select at least one service for this quotation.", "error");
      return;
    }
    const hotelMissingSellingPrice = model.enabledCore.includes("hotel")
      && model.hotel.rows.some((stay) => stay.roomLines.some((room) => asNumber(room.pricePerRoom) <= 0));
    if (hotelMissingSellingPrice) {
      setActiveStep("hotel");
      showToast("Enter your selling price for every selected hotel room.", "error");
      window.setTimeout(() => document.querySelector('[data-quick-panel="hotel"] [data-hotel-selling-price]')?.focus(), 30);
      return;
    }
    const firstIncompleteCore = model.enabledCore.find((service) => !completion[service]);
    if (firstIncompleteCore) {
      const label = CORE_SERVICES.find(({ id }) => id === firstIncompleteCore)?.label || "Service";
      setActiveStep(firstIncompleteCore);
      showToast(`Complete the main ${label.toLowerCase()} details before creating the quote.`, "error");
      return;
    }
    if (model.addons.rows.length > 0 && !completion.addons) {
      setActiveStep("addons");
      showToast("Choose a service type for every add-on row.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = buildData({ includeLead: !quotationId });
      if (quotationId) {
        await quotationService.updateQuotation(quotationId, payload);
        showToast("Quotation updated successfully.");
      } else {
        const response = await quotationService.createQuotation(payload);
        const body = response?.data?.data || response?.data || {};
        const newId = body.publicId || body.id;
        if (!newId) throw new Error("Quotation was saved but its ID was not returned.");
        setQuotationId(String(newId));
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
  }, [buildData, canUpdateQuotation, completion, lead, leadId, model, navigate, quotationId, showToast]);

  const moveStep = useCallback((delta) => {
    if (!steps.length) return;
    const index = Math.max(0, steps.findIndex(({ id }) => id === activeStep));
    const nextIndex = Math.min(steps.length - 1, Math.max(0, index + delta));
    setActiveStep(steps[nextIndex].id);
  }, [activeStep, steps]);

  const handleKeys = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      save();
      return;
    }
    if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      moveStep(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.altKey && /^[1-8]$/.test(event.key)) {
      const shortcutId = SHORTCUT_STEPS[Number(event.key) - 1];
      const target = steps.find(({ id }) => id === shortcutId);
      if (target) {
        event.preventDefault();
        setActiveStep(target.id);
      }
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "TEXTAREA" || event.defaultPrevented) return;
    if (event.target.hasAttribute("data-quick-title")) {
      event.preventDefault();
      document.querySelector(`[data-quick-panel="${activeStep}"] [data-quick-field]`)?.focus();
      return;
    }
    const fields = [...document.querySelectorAll('[data-quick-panel]:not([hidden]) [data-quick-field]:not([disabled])')]
      .filter((field) => field.offsetParent !== null);
    const index = fields.indexOf(event.target);
    if (index >= 0 && fields[index + 1]) {
      event.preventDefault();
      fields[index + 1].focus();
      fields[index + 1].select?.();
    }
  };

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

  const currentIndex = Math.max(0, steps.findIndex(({ id }) => id === activeStep));
  const destination = lead?.itinerary?.map((item) => item.city || item.destination).filter(Boolean).join(" → ");
  const adults = Math.max(1, asNumber(lead?.adults ?? lead?.totalAdults, 1));
  const children = Math.max(0, asNumber(lead?.children));
  const infants = Math.max(0, asNumber(lead?.infants));
  const current = steps[currentIndex] || steps[0];

  return (
    <main className="min-h-screen bg-slate-50" onKeyDown={handleKeys} style={{ fontFamily: QUICK_QUOTE_FONT }}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white"><Zap className="h-4 w-4" /></span>
                <h1 className="text-lg font-black text-slate-900">Quick Quote</h1>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black tracking-wider text-amber-700">DRAFT</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{lead?.customerName || "Customer"} · {lead?.leadCode || "Lead"}</p>
            </div>
            <div className="hidden flex-1 items-center justify-center gap-2 xl:flex">
              {lead?.travelDate && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><CalendarDays className="h-3.5 w-3.5" />{String(lead.travelDate).slice(0, 10)}</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><Users className="h-3.5 w-3.5" />{adults} Adults · {children} Children · {infants} Infants · {Math.max(1, asNumber(lead?.rooms, 1))} Rooms</span>
              {destination && <span className="inline-flex max-w-sm items-center gap-1.5 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{destination}</span></span>}
            </div>
            <div className="ml-auto flex items-center gap-2">
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
              <button type="button" disabled={saving || (Boolean(quotationId) && !canUpdateQuotation)} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : quotationId ? <Check className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {saving ? (quotationId ? "Updating…" : "Creating…") : quotationId ? (canUpdateQuotation ? "Update Quote" : "Created") : "Create Quote"}
                <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold lg:inline">Ctrl ↵</kbd>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-400"><Sparkles className="h-3.5 w-3.5" /> Quote services</span>
            {CORE_SERVICES.map(({ id, label, icon: Icon, tone }) => {
              const selected = model.enabledCore.includes(id);
              return (
                <button key={id} type="button" aria-pressed={selected} onClick={() => toggleService(id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${selected ? TONES[tone] : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label} {selected && <Check className="h-3 w-3" />}
                </button>
              );
            })}
            <p className="ml-auto hidden text-[11px] font-semibold text-slate-400 lg:block">Enter next · Alt + ←/→ sections · Alt + 1…8 jump</p>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-24 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Quotation sections">
              {steps.map(({ id, label, icon: Icon, tone }, index) => {
                const selected = id === activeStep;
                return (
                  <button key={id} type="button" onClick={() => setActiveStep(id)} className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition lg:w-full ${selected ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${selected ? "border-white/10 bg-white/10 text-white" : TONES[tone]}`}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="whitespace-nowrap">{index + 1}. {label}</span>
                    {completion[id] && <Check className={`ml-auto h-3.5 w-3.5 ${selected ? "text-emerald-300" : "text-emerald-500"}`} />}
                  </button>
                );
              })}
              <div className="hidden border-t border-slate-100 px-3 pt-3 lg:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Running subtotal</p>
                <p className="mt-1 text-lg font-black text-slate-900">₹{totals.subtotal.toLocaleString("en-IN")}</p>
              </div>
            </nav>
          </aside>

          <form onSubmit={(event) => { event.preventDefault(); save(); }} className="min-w-0">
            <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                <Field label="Quotation title" required>
                  <input data-quick-field data-quick-title value={model.title} onChange={(event) => setModel((currentModel) => ({ ...currentModel, title: event.target.value }))} className={`${controlClass} font-bold`} maxLength={200} />
                </Field>
                <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">{current?.label || "Section"} amount</p>
                  <p className="text-base font-black text-blue-800">₹{asNumber(totals[activeStep]).toLocaleString("en-IN")}</p>
                </div>
              </div>
            </section>

            <div data-quick-panel={activeStep}>
              {activeStep === "hotel" && <HotelPanel data={model.hotel} setData={(updater) => setPart("hotel", updater)} loadHotels={loadHotels} />}
              {activeStep === "flight" && <FlightPanel data={model.flight} setData={(updater) => setPart("flight", updater)} />}
              {activeStep === "sightseeing" && <SightseeingPanel data={model.sightseeing} setData={(updater) => setPart("sightseeing", updater)} loadSightseeing={loadSightseeing} />}
              {activeStep === "vehicle" && <VehiclePanel data={model.vehicle} setData={(updater) => setPart("vehicle", updater)} loadVehicles={loadVehicles} />}
              {activeStep === "cruise" && <CruisePanel data={model.cruise} setData={(updater) => setPart("cruise", updater)} />}
              {activeStep === "addons" && <AddonsPanel data={model.addons} setData={(updater) => setPart("addons", updater)} />}
              {activeStep === "terms" && <TermsPanel data={model.terms} setData={(updater) => setPart("terms", updater)} />}
              {activeStep === "pricing" && <PricingPanel data={model.pricing} setData={(updater) => setPart("pricing", updater)} subtotal={totals.subtotal} />}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <button type="button" disabled={currentIndex === 0} onClick={() => moveStep(-1)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Previous</button>
              <span className="text-xs font-bold text-slate-400">{currentIndex + 1} / {steps.length}</span>
              {currentIndex < steps.length - 1 ? (
                <button type="button" onClick={() => moveStep(1)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Next <ChevronRight className="h-4 w-4" /></button>
              ) : (
                <button type="submit" disabled={saving || (Boolean(quotationId) && !canUpdateQuotation)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : quotationId ? <Check className="h-4 w-4" /> : <Zap className="h-4 w-4" />} {saving ? (quotationId ? "Updating…" : "Creating…") : quotationId ? (canUpdateQuotation ? "Update Quote" : "Created") : "Create Quote"}</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
