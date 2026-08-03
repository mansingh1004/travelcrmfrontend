import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Accessibility,
  BedDouble,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  IndianRupee,
  LoaderCircle,
  Mail,
  MapPin,
  Package as PackageIcon,
  Pencil,
  Phone,
  Plane,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import bookingService from "../api/bookingService";
import { customerService } from "@features/customers";
import { ItinerarySection, TravelDetails, leadService } from "@features/leads";
import { geographyService } from "@shared/api/geographyService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";

const COMMON_SERVICES = [
  "Hotel",
  "Flight",
  "Sightseeing",
  "Cruise",
  "Vehicle",
  "Visa",
  "Passport",
  "Add-on",
];

const PACKAGE_TYPES = ["Family", "Honeymoon", "Group", "Corporate", "Pilgrimage", "Adventure"];
const DEPARTURE_MODES = ["Flight / Airport", "Train / Rail", "Car / Road", "Bus", "Other"];
const ASSISTANCE_TYPES = [
  "Wheelchair Assistance",
  "Senior Citizen Assistance",
  "Special Meal Requirement",
  "Airport Assistance",
];

let nextItineraryId = 2;

const today = () => new Date().toISOString().slice(0, 10);

const unwrap = (response) => response?.data?.data ?? response?.data;

const unwrapList = (response) => {
  const body = response?.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.content)) return body.data.content;
  if (Array.isArray(body?.content)) return body.content;
  if (Array.isArray(body)) return body;
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

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const phonePattern = /^[+\d\s\-()]{7,20}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialForm = () => ({
  customerPhone: "",
  customerName: "",
  customerEmail: "",
  customerCity: "",
  birthday: "",
  anniversary: "",
  destination: "",
  destinationId: "",
  travelDate: "",
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
  male: "1",
  female: "1",
  children: "0",
  infants: "0",
  extraBeds: "0",
  specialAssistanceRequired: false,
  specialAssistanceTypes: [],
  assistancePassengerCount: "0",
  specialAssistanceNotes: "",
  itinerary: [{ id: 1, destinationId: "", destination: "", cityId: "", city: "", nights: "2" }],
  tripNotes: "",
  bookingDate: today(),
  customerAmount: "",
  vendorCost: "",
  paidAmount: "0",
  assignedUserId: "",
  leadPublicId: "",
  services: [],
});

function SectionHeader({ icon: Icon, title, subtitle, tone = "blue" }) {
  const tones = {
    blue: "from-blue-600 to-blue-500 text-blue-100",
    violet: "from-violet-600 to-indigo-500 text-violet-100",
    emerald: "from-emerald-600 to-teal-500 text-emerald-100",
  };

  return (
    <div className={`bg-gradient-to-r ${tones[tone]} px-5 py-4 sm:px-6 flex items-center gap-3`}>
      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="min-w-0">
        <h2 className="text-white font-extrabold text-base">{title}</h2>
        <p className="text-xs mt-0.5 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default function CreateBooking() {
  const navigate = useNavigate();
  const { leadId: routeLeadId } = useParams();
  const { showToast } = useToast();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [customerMode, setCustomerMode] = useState("idle");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editCustomer, setEditCustomer] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [leads, setLeads] = useState([]);
  const [loadingLead, setLoadingLead] = useState(Boolean(routeLeadId));
  const [assignees, setAssignees] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [destinationError, setDestinationError] = useState("");
  const formRef = useRef(form);
  formRef.current = form;

  const setField = useCallback((name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const bookingRegister = useCallback((name) => ({
    name,
    value: formRef.current[name] ?? "",
    onChange: (event) => {
      const target = event?.target;
      setField(name, target?.type === "checkbox" ? target.checked : target?.value ?? event);
    },
    onBlur: () => {},
    ref: () => {},
  }), [setField]);

  const bookingWatch = useCallback((name) => form[name], [form]);
  const bookingGetValues = useCallback((name) => name ? formRef.current[name] : formRef.current, []);
  const bookingSetValue = useCallback((name, value) => setField(name, value), [setField]);
  const bookingClearErrors = useCallback(() => {}, []);
  const bookingTrigger = useCallback(async () => true, []);

  const inputClass = (name, withIcon = false) =>
    `w-full ${withIcon ? "pl-9" : "px-3"} pr-3 py-2.5 rounded-xl border bg-white text-sm text-slate-700
     placeholder-slate-400 outline-none transition-all focus:ring-2 ${
       errors[name]
         ? "border-red-300 focus:border-red-400 focus:ring-red-50"
         : "border-slate-200 focus:border-blue-400 focus:ring-blue-50"
     }`;

  const searchCustomer = useCallback(async (phone, seed = {}) => {
    const cleanPhone = String(phone || "").trim();
    if (!cleanPhone || !phonePattern.test(cleanPhone)) {
      setErrors((current) => ({ ...current, customerPhone: "Enter a valid phone number" }));
      return;
    }

    setSearchingCustomer(true);
    setErrors((current) => {
      const next = { ...current };
      delete next.customerPhone;
      delete next.customer;
      return next;
    });

    try {
      const customer = unwrap(await customerService.searchByPhone(cleanPhone));
      setSelectedCustomer(customer);
      setCustomerMode("existing");
      setEditCustomer(false);
      setForm((current) => ({
        ...current,
        customerPhone: customer?.phone || cleanPhone,
        customerName: customer?.name || seed.customerName || current.customerName,
        customerEmail: customer?.email || seed.customerEmail || current.customerEmail,
        customerCity: customer?.city || seed.customerCity || current.customerCity,
        birthday: dateInput(customer?.birthday || seed.birthday || current.birthday),
        anniversary: dateInput(customer?.anniversary || seed.anniversary || current.anniversary),
      }));
    } catch (error) {
      if (error?.response?.status === 404) {
        setSelectedCustomer(null);
        setCustomerMode("new");
        setEditCustomer(false);
        setForm((current) => ({
          ...current,
          customerPhone: cleanPhone,
          customerName: seed.customerName || current.customerName,
          customerEmail: seed.customerEmail || current.customerEmail,
          customerCity: seed.customerCity || current.customerCity,
          birthday: dateInput(seed.birthday || current.birthday),
          anniversary: dateInput(seed.anniversary || current.anniversary),
        }));
        return;
      }
      if (isAlreadyReported(error)) return;
      setCustomerMode("idle");
      showToast(getErrorMessage(error, "Could not search for this customer."), "error");
    } finally {
      setSearchingCustomer(false);
    }
  }, [showToast]);

  const applyLead = useCallback((lead) => {
    if (!lead) return;
    const publicId = lead.publicId || lead.id;
    const firstLeg = Array.isArray(lead.itinerary) ? lead.itinerary[0] : null;
    const firstDestination = typeof firstLeg?.destination === "string"
      ? firstLeg.destination
      : firstLeg?.destination?.name || "";
    const firstCity = typeof firstLeg?.city === "string" ? firstLeg.city : firstLeg?.city?.name || "";
    const seed = {
      customerName: lead.customerName || lead.customer?.name || "",
      customerEmail: lead.email || lead.customer?.email || "",
      customerCity: lead.departCity || lead.customer?.city || "",
      birthday: lead.birthDate || lead.birthday || "",
      anniversary: lead.anniversaryDate || lead.anniversary || "",
    };
    const leadAdults = Number(lead.totalAdults ?? lead.adults ?? 2);
    const leadMale = Number(lead.male ?? lead.maleCount ?? (lead.female == null ? leadAdults : 0));
    const leadFemale = Number(lead.female ?? lead.femaleCount ?? 0);
    const leadItinerary = Array.isArray(lead.itinerary) && lead.itinerary.length > 0
      ? lead.itinerary.map((item) => ({
          id: nextItineraryId++,
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
      leadPublicId: publicId || "",
      destinationId: firstLeg?.destinationId || firstLeg?.destination?.id || lead.destinationId || current.destinationId,
      destination: firstDestination || firstCity || lead.destination || current.destination,
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
      male: String(leadMale),
      female: String(leadFemale),
      children: String(lead.children ?? current.children),
      infants: String(lead.infants ?? current.infants),
      extraBeds: String(lead.extraBeds ?? current.extraBeds),
      specialAssistanceRequired: Boolean(lead.specialAssistanceRequired ?? lead.needsSpecialAssistance),
      specialAssistanceTypes: Array.isArray(lead.specialAssistanceTypes) ? lead.specialAssistanceTypes : current.specialAssistanceTypes,
      assistancePassengerCount: String(lead.assistancePassengerCount ?? current.assistancePassengerCount),
      specialAssistanceNotes: lead.specialAssistanceNotes || lead.assistanceNotes || current.specialAssistanceNotes,
      itinerary: leadItinerary || current.itinerary,
      tripNotes: lead.notes || current.tripNotes,
      customerAmount: lead.budget != null ? String(lead.budget) : current.customerAmount,
      services: Array.isArray(lead.services) ? lead.services : current.services,
      assignedUserId:
        lead.assignedUserId ||
        lead.assignedUser?.publicId ||
        lead.assignedUser?.id ||
        current.assignedUserId,
    }));

    const phone = lead.phone || lead.customer?.phone;
    if (phone) searchCustomer(phone, seed);
  }, [searchCustomer]);

  useEffect(() => {
    let active = true;

    const loadSupportingData = async () => {
      const [leadResult, assigneeResult] = await Promise.allSettled([
        leadService.getAllLeads(0, 100),
        bookingService.getEligibleAssignees(),
      ]);

      if (!active) return;
      if (leadResult.status === "fulfilled") {
        setLeads(unwrapList(leadResult.value));
      }
      if (assigneeResult.status === "fulfilled") {
        const list = unwrap(assigneeResult.value);
        setAssignees(Array.isArray(list) ? list : []);
      }
    };

    loadSupportingData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingDestinations(true);
    setDestinationError("");

    geographyService.getAllDestinations()
      .then((list) => {
        if (active) setDestinations(Array.isArray(list) ? list : []);
      })
      .catch((error) => {
        if (!active) return;
        setDestinations([]);
        setDestinationError(getErrorMessage(error, "Could not load destinations."));
      })
      .finally(() => {
        if (active) setLoadingDestinations(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!routeLeadId) return undefined;

    let active = true;
    leadService.getLeadById(routeLeadId)
      .then((response) => {
        if (!active) return;
        applyLead(unwrap(response));
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Could not load the selected lead."), "error");
      })
      .finally(() => {
        if (active) setLoadingLead(false);
      });

    return () => { active = false; };
  }, [applyLead, routeLeadId, showToast]);

  const handlePhoneChange = (value) => {
    setField("customerPhone", value);
    if (customerMode !== "idle") {
      setCustomerMode("idle");
      setSelectedCustomer(null);
      setEditCustomer(false);
    }
  };

  const handleLeadChange = async (leadPublicId) => {
    setField("leadPublicId", leadPublicId);
    if (!leadPublicId) return;

    setLoadingLead(true);
    try {
      applyLead(unwrap(await leadService.getLeadById(leadPublicId)));
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Could not load the selected lead."), "error");
      }
    } finally {
      setLoadingLead(false);
    }
  };

  const toggleService = (service) => {
    setForm((current) => ({
      ...current,
      services: current.services.includes(service)
        ? current.services.filter((item) => item !== service)
        : [...current.services, service],
    }));
  };

  const toggleAssistanceType = (type) => {
    setForm((current) => ({
      ...current,
      specialAssistanceTypes: current.specialAssistanceTypes.includes(type)
        ? current.specialAssistanceTypes.filter((item) => item !== type)
        : [...current.specialAssistanceTypes, type],
    }));
  };

  const addItineraryRow = () => {
    setForm((current) => ({
      ...current,
      itinerary: [...current.itinerary, { id: nextItineraryId++, destinationId: "", destination: "", cityId: "", city: "", nights: "1" }],
    }));
  };

  const updateItineraryRow = (id, field, value) => {
    setForm((current) => {
      const rowIndex = current.itinerary.findIndex((item) => item.id === id);
      const itinerary = current.itinerary.map((item) => item.id === id ? { ...item, [field]: value } : item);
      const syncPrimaryDestination = rowIndex === 0 && (field === "destination" || field === "destinationId");

      return {
        ...current,
        itinerary,
        ...(syncPrimaryDestination && field === "destination" ? { destination: value || current.destination } : {}),
        ...(syncPrimaryDestination && field === "destinationId" ? { destinationId: value || current.destinationId } : {}),
      };
    });
  };

  const removeItineraryRow = (id) => {
    setForm((current) => ({
      ...current,
      itinerary: current.itinerary.length > 1
        ? current.itinerary.filter((item) => item.id !== id)
        : current.itinerary,
    }));
  };

  const totals = useMemo(() => {
    const amount = Number(form.customerAmount) || 0;
    const vendor = Number(form.vendorCost) || 0;
    const paid = Number(form.paidAmount) || 0;
    const gst = Number((amount * 0.05).toFixed(2));
    const tcs = Number((amount * 0.05).toFixed(2));
    const payable = Number((amount + gst + tcs).toFixed(2));
    const profit = Number((amount - vendor).toFixed(2));
    const paymentStatus = paid <= 0 ? "Unpaid" : paid >= payable ? "Paid" : "Partial";
    return { amount, vendor, paid, gst, tcs, payable, profit, paymentStatus };
  }, [form.customerAmount, form.paidAmount, form.vendorCost]);

  const validate = () => {
    const next = {};
    const phone = form.customerPhone.trim();
    if (!phonePattern.test(phone)) next.customerPhone = "Enter a valid phone number";
    if (customerMode === "idle") next.customer = "Search the phone number before creating the booking";
    if (customerMode === "new" && !form.customerName.trim()) next.customerName = "Customer name is required";
    if (form.customerEmail && !emailPattern.test(form.customerEmail)) next.customerEmail = "Enter a valid email";
    if (!form.destination.trim()) next.destination = "Destination is required";
    if (!form.travelDate) next.travelDate = "Travel date is required";
    else if (form.travelDate < today()) next.travelDate = "Travel date cannot be in the past";
    if (!(Number(form.customerAmount) > 0)) next.customerAmount = "Amount must be greater than 0";
    if (form.vendorCost !== "" && Number(form.vendorCost) < 0) next.vendorCost = "Vendor cost cannot be negative";
    if (Number(form.paidAmount) < 0) next.paidAmount = "Advance cannot be negative";
    else if (Number(form.paidAmount) > totals.payable) next.paidAmount = "Advance exceeds total payable";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;

    const customer = customerMode === "existing"
      ? {
          customerPublicId: selectedCustomer?.id || selectedCustomer?.publicId,
          ...(editCustomer
            ? {
                sync: {
                  name: form.customerName.trim() || null,
                  email: form.customerEmail.trim() || null,
                  birthday: form.birthday || null,
                  anniversary: form.anniversary || null,
                },
              }
            : {}),
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
          male: Number(form.male) || 0,
          female: Number(form.female) || 0,
          totalAdults: (Number(form.male) || 0) + (Number(form.female) || 0),
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
          .filter((item) => item.destination.trim() || item.city.trim())
          .map((item, index) => ({
            destination: item.destination.trim() || null,
            city: item.city.trim() || null,
            nights: Number(item.nights) || 0,
            dayNumber: index + 1,
          })),
        notes: form.tripNotes.trim() || null,
      },
      bookingDate: form.bookingDate || null,
      customerAmount: Number(form.customerAmount),
      vendorCost: form.vendorCost === "" ? null : Number(form.vendorCost),
      paidAmount: Number(form.paidAmount) || 0,
      services: form.services,
      assignedUserId: form.assignedUserId || null,
      leadPublicId: form.leadPublicId || null,
    };

    setSubmitting(true);
    try {
      const booking = unwrap(await bookingService.create(payload));
      showToast(`Booking ${booking?.bookingCode || ""} created successfully.`, "success");
      const bookingId = booking?.publicId || booking?.id;
      navigate(bookingId ? `/BookingDetails/${bookingId}` : "/Allbookings");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Could not create the booking."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLead && routeLeadId && !form.leadPublicId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
        <LoaderCircle className="w-6 h-6 animate-spin text-blue-600 mr-2" /> Loading lead details…
      </div>
    );
  }

  const availableLeads = leads.filter((lead) =>
    !(lead.leadStage === "Converted" || lead.convertedBookingPublicId) ||
    (lead.publicId || lead.id) === form.leadPublicId
  );
  const linkedLead = leads.find((lead) => String(lead.publicId || lead.id) === String(form.leadPublicId));
  const matchedDestination = destinations.find((destination) =>
    (form.destinationId && String(destinationIdOf(destination)) === String(form.destinationId)) ||
    (!form.destinationId && String(destination.name || "").trim().toLowerCase() === form.destination.trim().toLowerCase())
  );
  const destinationSelectValue = matchedDestination
    ? String(destinationIdOf(matchedDestination))
    : form.destination
      ? "__saved_destination__"
      : "";

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
                <BriefcaseBusiness className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create New Booking</h1>
                <p className="text-sm text-slate-500 mt-0.5">Customer resolution and confirmed trip details</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-sm font-semibold text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 space-y-6">
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <SectionHeader
                  icon={CircleUserRound}
                  title="Customer"
                  subtitle="Search by phone, reuse an existing profile, or create one inline"
                />

                <div className="p-5 sm:p-6 space-y-5">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <label className="block text-xs font-extrabold text-blue-700 uppercase tracking-wider mb-2">
                      Search Customer by Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={form.customerPhone}
                          onChange={(event) => handlePhoneChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              searchCustomer(form.customerPhone);
                            }
                          }}
                          placeholder="e.g. +91 98765 43210"
                          className={inputClass("customerPhone", true)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => searchCustomer(form.customerPhone)}
                        disabled={searchingCustomer}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {searchingCustomer ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {searchingCustomer ? "Searching…" : "Search"}
                      </button>
                    </div>
                    {errors.customerPhone && <p className="text-xs text-red-500 mt-1.5">{errors.customerPhone}</p>}
                    {errors.customer && <p className="text-xs text-red-500 mt-1.5">{errors.customer}</p>}
                  </div>

                  {customerMode === "existing" && selectedCustomer && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-slate-800">{selectedCustomer.name}</h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200">Existing customer</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {selectedCustomer.customerId || "No customer code"} · {selectedCustomer.city || "City not set"} · {selectedCustomer.tier || "No tier"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {selectedCustomer.bookings ?? 0} past booking(s)
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Birthday: {dateInput(selectedCustomer.birthday) || "Not set"} · Anniversary: {dateInput(selectedCustomer.anniversary) || "Not set"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditCustomer((value) => !value)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> {editCustomer ? "Keep existing" : "Edit details"}
                        </button>
                      </div>

                      {editCustomer && (
                        <div className="border-t border-emerald-200 bg-white/70 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label="Name">
                            <input value={form.customerName} onChange={(event) => setField("customerName", event.target.value)} className={inputClass("customerName")} />
                          </Field>
                          <Field label="Email" error={errors.customerEmail}>
                            <input type="email" value={form.customerEmail} onChange={(event) => setField("customerEmail", event.target.value)} className={inputClass("customerEmail")} />
                          </Field>
                          <Field label="Birthday">
                            <input type="date" value={form.birthday} onChange={(event) => setField("birthday", event.target.value)} className={inputClass("birthday")} />
                          </Field>
                          <Field label="Anniversary">
                            <input type="date" value={form.anniversary} onChange={(event) => setField("anniversary", event.target.value)} className={inputClass("anniversary")} />
                          </Field>
                          <p className="sm:col-span-2 text-[11px] text-slate-500 flex items-start gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            Phone is never overwritten. Name is confirmed from this form; email and important dates are sent for fill-if-empty sync.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {customerMode === "new" && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm">New customer</h3>
                          <p className="text-xs text-slate-500">No customer was found. Create the profile with this booking.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Name" required error={errors.customerName}>
                          <input value={form.customerName} onChange={(event) => setField("customerName", event.target.value)} placeholder="Customer full name" className={inputClass("customerName")} />
                        </Field>
                        <Field label="Phone" required>
                          <input value={form.customerPhone} readOnly className={`${inputClass("customerPhone")} bg-slate-100 cursor-not-allowed`} />
                        </Field>
                        <Field label="Email" error={errors.customerEmail}>
                          <input type="email" value={form.customerEmail} onChange={(event) => setField("customerEmail", event.target.value)} placeholder="customer@email.com" className={inputClass("customerEmail")} />
                        </Field>
                        <Field label="City">
                          <input value={form.customerCity} onChange={(event) => setField("customerCity", event.target.value)} placeholder="Customer city" className={inputClass("customerCity")} />
                        </Field>
                        <Field label="Birthday">
                          <input type="date" value={form.birthday} onChange={(event) => setField("birthday", event.target.value)} className={inputClass("birthday")} />
                        </Field>
                        <Field label="Anniversary">
                          <input type="date" value={form.anniversary} onChange={(event) => setField("anniversary", event.target.value)} className={inputClass("anniversary")} />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <TravelDetails
                register={bookingRegister}
                watch={bookingWatch}
                setValue={bookingSetValue}
                getValues={bookingGetValues}
                errors={{}}
                clearErrors={bookingClearErrors}
                trigger={bookingTrigger}
              />

              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <SectionHeader
                  icon={Plane}
                  title="Booking Details"
                  subtitle="Confirmed trip and commercial information"
                  tone="violet"
                />

                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Field label="Link to Lead" hint="Optional — pre-fills customer and trip information">
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <select
                            value={form.leadPublicId}
                            onChange={(event) => handleLeadChange(event.target.value)}
                            disabled={loadingLead}
                            className={`${inputClass("leadPublicId", true)} appearance-none cursor-pointer disabled:opacity-60`}
                          >
                            <option value="">No linked lead</option>
                            {availableLeads.map((lead) => (
                              <option key={lead.publicId || lead.id} value={lead.publicId || lead.id}>
                                {lead.leadCode ? `${lead.leadCode} · ` : ""}{lead.customerName} · {lead.phone}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </Field>
                    </div>

                    <div className="sm:col-span-2">
                      <Field label="Destination" required error={errors.destination}>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <select
                            value={destinationSelectValue}
                            disabled={loadingDestinations}
                            onChange={(event) => {
                              const selected = destinations.find((destination) => String(destinationIdOf(destination)) === event.target.value);
                              if (!selected) {
                                setField("destinationId", "");
                                setField("destination", "");
                                return;
                              }
                              setField("destinationId", String(destinationIdOf(selected)));
                              setField("destination", selected.name || "");
                            }}
                            className={`${inputClass("destination", true)} appearance-none cursor-pointer disabled:opacity-60`}
                          >
                            <option value="">{loadingDestinations ? "Loading destinations…" : "Select destination"}</option>
                            {destinationSelectValue === "__saved_destination__" && (
                              <option value="__saved_destination__">{form.destination} (saved)</option>
                            )}
                            {destinations.map((destination) => (
                              <option key={destinationIdOf(destination) || destination.name} value={String(destinationIdOf(destination))}>
                                {destination.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        {destinationError && <p className="text-[11px] text-amber-600 mt-1">{destinationError}</p>}
                      </Field>
                    </div>

                    <Field label="Booking Date" hint="Optional — defaults to today">
                      <input type="date" value={form.bookingDate} onChange={(event) => setField("bookingDate", event.target.value)} className={inputClass("bookingDate")} />
                    </Field>

                    <Field label="Package Type" hint="Optional">
                      <div className="relative">
                        <PackageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select value={form.packageType} onChange={(event) => setField("packageType", event.target.value)} className={`${inputClass("packageType", true)} appearance-none cursor-pointer`}>
                          <option value="">Select package type</option>
                          {PACKAGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </Field>

                    <div className="hidden sm:col-span-2 border-t border-slate-100 pt-5 mt-1">
                      <div className="flex items-center gap-2 mb-4">
                        <Route className="w-4 h-4 text-violet-600" />
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-700">Confirmed Travel Requirements</h3>
                          <p className="text-[11px] text-slate-400">Lead values are prefilled; confirm or complete them with the customer.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Package Type" hint="Optional">
                          <div className="relative">
                            <PackageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <select value={form.packageType} onChange={(event) => setField("packageType", event.target.value)} className={`${inputClass("packageType", true)} appearance-none cursor-pointer`}>
                              <option value="">Select package type</option>
                              {PACKAGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </Field>

                        <Field label="Departure Mode" hint="Optional">
                          <div className="relative">
                            <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <select value={form.departureMode} onChange={(event) => setField("departureMode", event.target.value)} className={`${inputClass("departureMode", true)} appearance-none cursor-pointer`}>
                              <option value="">Select departure mode</option>
                              {DEPARTURE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </Field>

                        <Field label="Departure Country" hint="Optional">
                          <input value={form.departCountry} onChange={(event) => setField("departCountry", event.target.value)} placeholder="Country" className={inputClass("departCountry")} />
                        </Field>

                        <Field label="Departure City" hint="Optional">
                          <input value={form.departCity} onChange={(event) => setField("departCity", event.target.value)} placeholder="City" className={inputClass("departCity")} />
                        </Field>
                      </div>

                      {form.departureMode === "Flight / Airport" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                          <Field label="Departure Airport">
                            <input value={form.departureAirport} onChange={(event) => setField("departureAirport", event.target.value)} placeholder="Airport name" className={inputClass("departureAirport")} />
                          </Field>
                          <Field label="Airport Code" hint="Optional">
                            <input value={form.airportCode} onChange={(event) => setField("airportCode", event.target.value.toUpperCase())} maxLength={8} placeholder="DEL" className={inputClass("airportCode")} />
                          </Field>
                          <Field label="Preferred Flight Time">
                            <input type="time" value={form.preferredFlightTime} onChange={(event) => setField("preferredFlightTime", event.target.value)} className={inputClass("preferredFlightTime")} />
                          </Field>
                        </div>
                      )}

                      {form.departureMode === "Train / Rail" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                          <Field label="Railway Station">
                            <input value={form.railwayStation} onChange={(event) => setField("railwayStation", event.target.value)} placeholder="Station name" className={inputClass("railwayStation")} />
                          </Field>
                          <Field label="Train Class" hint="Optional">
                            <input value={form.trainClass} onChange={(event) => setField("trainClass", event.target.value)} placeholder="2A, 3A, Sleeper" className={inputClass("trainClass")} />
                          </Field>
                          <Field label="Preferred Train Time">
                            <input type="time" value={form.preferredTrainTime} onChange={(event) => setField("preferredTrainTime", event.target.value)} className={inputClass("preferredTrainTime")} />
                          </Field>
                        </div>
                      )}

                      {form.departureMode === "Car / Road" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                          <Field label="Pickup Address">
                            <input value={form.pickupAddress} onChange={(event) => setField("pickupAddress", event.target.value)} placeholder="Pickup address" className={inputClass("pickupAddress")} />
                          </Field>
                          <Field label="Pickup Date & Time">
                            <input type="datetime-local" value={form.pickupDateTime} onChange={(event) => setField("pickupDateTime", event.target.value)} className={inputClass("pickupDateTime")} />
                          </Field>
                          <Field label="Vehicle Preference">
                            <input value={form.vehiclePreference} onChange={(event) => setField("vehiclePreference", event.target.value)} placeholder="Sedan, SUV…" className={inputClass("vehiclePreference")} />
                          </Field>
                        </div>
                      )}
                    </div>

                    <div className="hidden sm:col-span-2 border-t border-slate-100 pt-5">
                      <div className="flex items-center gap-2 mb-4">
                        <BedDouble className="w-4 h-4 text-violet-600" />
                        <h3 className="text-sm font-extrabold text-slate-700">Travellers &amp; Rooms</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          ["rooms", "Rooms", 0],
                          ["male", "Male", 0],
                          ["female", "Female", 0],
                          ["children", "Children", 0],
                          ["infants", "Infants", 0],
                          ["extraBeds", "Extra Beds", 0],
                        ].map(([name, label, min]) => (
                          <Field key={name} label={label}>
                            <input type="number" min={min} step="1" value={form[name]} onChange={(event) => setField(name, event.target.value)} className={inputClass(name)} />
                          </Field>
                        ))}
                        <Field label="Total Adults">
                          <input readOnly value={(Number(form.male) || 0) + (Number(form.female) || 0)} className={`${inputClass("totalAdults")} bg-slate-100 cursor-not-allowed font-bold`} />
                        </Field>
                      </div>
                    </div>

                    <div className="hidden sm:col-span-2 rounded-xl border border-slate-200 p-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.specialAssistanceRequired}
                          onChange={(event) => setField("specialAssistanceRequired", event.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <Accessibility className="w-4 h-4 text-violet-600" />
                        <span className="text-sm font-bold text-slate-700">Special assistance required</span>
                      </label>

                      {form.specialAssistanceRequired && (
                        <div className="mt-4 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {ASSISTANCE_TYPES.map((type) => {
                              const selected = form.specialAssistanceTypes.includes(type);
                              return (
                                <button key={type} type="button" onClick={() => toggleAssistanceType(type)} className={`px-3 py-1.5 rounded-full border text-xs font-bold ${selected ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-500 border-slate-200"}`}>
                                  {selected && <Check className="inline w-3 h-3 mr-1" />}{type}
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Passengers Requiring Assistance">
                              <input type="number" min="0" step="1" value={form.assistancePassengerCount} onChange={(event) => setField("assistancePassengerCount", event.target.value)} className={inputClass("assistancePassengerCount")} />
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label="Assistance Notes">
                                <input value={form.specialAssistanceNotes} onChange={(event) => setField("specialAssistanceNotes", event.target.value)} placeholder="Any specific support required" className={inputClass("specialAssistanceNotes")} />
                              </Field>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Field label="Customer Amount (₹)" required error={errors.customerAmount}>
                      <input type="number" min="0" step="0.01" value={form.customerAmount} onChange={(event) => setField("customerAmount", event.target.value)} placeholder="0.00" className={inputClass("customerAmount")} />
                    </Field>

                    <Field label="Vendor Cost (₹)" error={errors.vendorCost} hint="Optional">
                      <input type="number" min="0" step="0.01" value={form.vendorCost} onChange={(event) => setField("vendorCost", event.target.value)} placeholder="0.00" className={inputClass("vendorCost")} />
                    </Field>

                    <Field label="Advance Collected (₹)" error={errors.paidAmount} hint="Optional — defaults to zero">
                      <input type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => setField("paidAmount", event.target.value)} placeholder="0.00" className={inputClass("paidAmount")} />
                    </Field>

                    <Field label="Assigned To" hint="Optional — backend defaults to the current user">
                      <div className="relative">
                        <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select value={form.assignedUserId} onChange={(event) => setField("assignedUserId", event.target.value)} className={`${inputClass("assignedUserId", true)} appearance-none cursor-pointer`}>
                          <option value="">Current user (default)</option>
                          {assignees.map((user) => (
                            <option key={user.id || user.publicId} value={user.id || user.publicId}>
                              {user.name || user.fullName || user.email}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </Field>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Services</label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_SERVICES.map((service) => {
                        const selected = form.services.includes(service);
                        return (
                          <button
                            key={service}
                            type="button"
                            onClick={() => toggleService(service)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                              selected
                                ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                : "bg-white text-slate-500 border-slate-200 hover:border-violet-300"
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}{service}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Booking / Trip Notes" hint="Optional">
                    <textarea
                      rows={3}
                      value={form.tripNotes}
                      onChange={(event) => setField("tripNotes", event.target.value)}
                      placeholder="Confirmed preferences, inclusions or instructions"
                      className={`${inputClass("tripNotes")} resize-y`}
                    />
                  </Field>
                </div>
              </section>

              <ItinerarySection
                hydrationKey={form.leadPublicId || "direct-booking"}
                itinerary={form.itinerary}
                onAdd={addItineraryRow}
                onRemove={removeItineraryRow}
                onUpdate={updateItineraryRow}
              />

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    disabled={submitting}
                    className="sm:w-auto px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || searchingCustomer}
                    className="flex-1 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md shadow-blue-200 flex items-center justify-center gap-2.5 disabled:opacity-60"
                  >
                    {submitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {submitting ? "Creating Booking…" : "Create Booking"}
                  </button>
                </div>
                <p className="text-center text-xs text-slate-400 mt-3">
                  Fields marked with <span className="text-red-500 font-bold">*</span> are required.
                </p>
              </div>
            </div>

            <aside className="w-full lg:w-72 xl:w-80 shrink-0">
              <div className="lg:sticky lg:top-20 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <SectionHeader icon={IndianRupee} title="Booking Summary" subtitle="Live read-only preview" tone="emerald" />
                  <div className="p-5 space-y-3">
                    {[
                      ["Customer Amount", totals.amount],
                      ["GST (estimated 5%)", totals.gst],
                      ["TCS (estimated 5%)", totals.tcs],
                      ["Total Payable", totals.payable],
                      ["Advance", totals.paid],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-extrabold text-slate-700">{formatCurrency(value)}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-600">Net Profit</span>
                      <span className={`font-black ${totals.profit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatCurrency(totals.profit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Payment Status</span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        totals.paymentStatus === "Paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : totals.paymentStatus === "Partial"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}>
                        {totals.paymentStatus}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-slate-400 pt-1">
                      GST, TCS, total payable, profit and final payment status remain server-calculated. This preview is indicative.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BriefcaseBusiness className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Booking Reference</p>
                  </div>
                  <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 px-3 py-3">
                    <p className="font-mono text-sm font-extrabold text-blue-700">AUTO-GENERATED</p>
                    <p className="text-[10px] text-slate-500 mt-1">Booking code is generated after successful creation.</p>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-slate-400">Lead</span><span className="font-semibold text-slate-600">{linkedLead?.leadCode || (form.leadPublicId ? "Linked" : "Direct booking")}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-400">Customer</span><span className="font-semibold text-slate-600">{selectedCustomer?.customerId || (customerMode === "new" ? "New customer" : "Pending")}</span></div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 text-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-blue-300" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Trip Snapshot</p>
                  </div>
                  <p className="font-extrabold truncate">{form.destination || "Destination not selected"}</p>
                  <p className="text-xs text-slate-300 mt-1">{form.travelDate || "Travel date not selected"}</p>
                  <p className="text-xs text-slate-300 mt-3 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {form.customerEmail || "No customer email"}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
