

// new update

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Plane, Hotel, Map, Anchor, Car, Package, List, BarChart2,
  Home, ChevronRight, Save, Users, Calendar,
  Phone, FileText, MapPin, User, TrendingUp, Sparkles,
  Wallet, ShieldCheck, Download, Share2, CheckCircle, Loader2, AlertCircle
} from "lucide-react";

import FlightTab from "../components/FlightTab";
import HotelTab from "../components/HotelTab";
import SightseeingTab from "../components/SightseeingTab";
import CruiseTab from "../components/CruiseTab";
import VehicleTab from "../components/VehicleTab";
import AddOnServicesTab from "../components/AddOnServicesTab";
import InclusionsExclusionsTab from "../components/InclusionsExclusionsTab";
import SummaryPricingTab from "../components/SummaryPricingTab";

import { Input, Label } from "../components/Ui";
import QuotationStyleModal from "../components/QuotationStyleModal";
import { quotationService } from "../api/quotationService";
import { leadService } from "@features/leads";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import PdfDownloadLoader from "@shared/ui/PdfDownloadLoader";
import { usePdfDownload } from "@shared/hooks/usePdfDownload";

/* ─── TAB CONFIG ─────────────────────────────────────── */
const TABS = [
  { id: "flight", label: "Flight", icon: Plane, color: "blue" },
  { id: "hotel", label: "Hotel", icon: Hotel, color: "violet" },
  { id: "sightseeing", label: "Sightseeing", icon: Map, color: "emerald" },
  { id: "cruise", label: "Cruise", icon: Anchor, color: "cyan" },
  { id: "vehicle", label: "Vehicle", icon: Car, color: "orange" },
  { id: "addons", label: "Add-on Services", icon: Package, color: "rose" },
  { id: "inclusions", label: "Inclusions & Exclusions", icon: List, color: "amber" },
  { id: "summary", label: "Summary & Pricing", icon: BarChart2, color: "indigo" },
];

// Lead-service name → service tab id. Used for tab reorder + Include default.
// addons/inclusions/summary are NOT services → they always stay at the end and remain ON.
const SERVICE_TAB_MAP = {
  flight: "Flight",
  hotel: "Hotel",
  sightseeing: "Sightseeing",
  cruise: "Cruise",
  vehicle: "Vehicle",
};

const TAB_ACTIVE = {
  blue: "text-blue-600    border-blue-600    bg-blue-50",
  violet: "text-violet-600  border-violet-600  bg-violet-50",
  emerald: "text-emerald-600 border-emerald-600 bg-emerald-50",
  cyan: "text-cyan-600    border-cyan-600    bg-cyan-50",
  orange: "text-orange-600  border-orange-600  bg-orange-50",
  rose: "text-rose-600    border-rose-600    bg-rose-50",
  amber: "text-amber-600   border-amber-600   bg-amber-50",
  indigo: "text-indigo-600  border-indigo-600  bg-indigo-50",
};

const ICON_BG = {
  blue: "bg-blue-100    text-blue-600",
  violet: "bg-violet-100  text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  cyan: "bg-cyan-100    text-cyan-600",
  orange: "bg-orange-100  text-orange-600",
  rose: "bg-rose-100    text-rose-600",
  amber: "bg-amber-100   text-amber-600",
  indigo: "bg-indigo-100  text-indigo-600",
};

const CHIP_STYLE = {
  blue: { grad: "from-blue-500 to-blue-600", ring: "hover:border-blue-300", glow: "shadow-blue-100" },
  emerald: { grad: "from-emerald-500 to-emerald-600", ring: "hover:border-emerald-300", glow: "shadow-emerald-100" },
  violet: { grad: "from-violet-500 to-violet-600", ring: "hover:border-violet-300", glow: "shadow-violet-100" },
  amber: { grad: "from-amber-400 to-amber-500", ring: "hover:border-amber-300", glow: "shadow-amber-100" },
  rose: { grad: "from-rose-500 to-rose-600", ring: "hover:border-rose-300", glow: "shadow-rose-100" },
  cyan: { grad: "from-cyan-500 to-cyan-600", ring: "hover:border-cyan-300", glow: "shadow-cyan-100" },
};

/* ─── SERVICE COLORS ─────────────────────────────────── */
const SERVICE_COLORS = {
  Hotel: { bg: '#E6F1FB', text: '#042C53' },
  Flight: { bg: '#EEEDFE', text: '#26215C' },
  Cruise: { bg: '#E1F5EE', text: '#04342C' },
  Vehicle: { bg: '#FAECE7', text: '#4A1B0C' },
  Visa: { bg: '#FBEAF0', text: '#4B1528' },
  Passport: { bg: '#F1EFE8', text: '#2C2C2A' },
  Sightseeing: { bg: '#FAEEDA', text: '#412402' },
  Insurance: { bg: '#E4F2F1', text: '#0B3B38' },
};
// Backend services lowercase bhejta hai ('hotel','flight') par ye keys Capitalized hain — bina
// normalize kiye HAR chip grey default pe gir jaata tha. Ab lookup aur label dono normalized
// value pe chalte hain, aur `insurance` (jiski key hi missing thi) ab match karta hai.
const serviceLabel = (svc) => {
  const s = String(svc ?? "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
};
const serviceColor = (svc) => SERVICE_COLORS[serviceLabel(svc)] || { bg: '#F1F5F9', text: '#334155' };

/* ─── TOAST ──────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-5 sm:top-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl sm:max-w-sm
        ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}>
      {type === "success"
        ? <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
        : <AlertCircle size={18} className="text-red-500  flex-shrink-0" />}
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 ml-1 text-lg leading-none">&times;</button>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────── */
export default function CreateQuotation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const leadId = searchParams.get("leadId") || null;
  const editId = searchParams.get("quotationId") || null;

  const [activeTab, setActiveTab] = useState("flight");
  const [qtTitle, setQtTitle] = useState("");
  const [version] = useState("v1.0");
  const [stage] = useState("New Lead");
  const [quotationId, setQuotationId] = useState(editId || null);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [stylePickOpen, setStylePickOpen] = useState(false);   // Export-PDF design dialog
  // Shared PDF pipeline — same hook + full-screen loader the leads list uses.
  const { downloadPdf: runPdfDownload, isDownloading: pdfBusy, progress: pdfProgress, progressSupported: pdfProgressSupported } = usePdfDownload();
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // ── Dirty tracking: Update button tabhi enable jab kuch actually change ho ──
  // isDirty false se shuru; real user change pe true. hydratingRef true rehta hai jab
  // edit-mode me purana quotation prefill ho raha hota hai, taaki wo change na gina jaaye.
  const [isDirty, setIsDirty] = useState(false);
  const hydratingRef = useRef(!!editId);

  // ── Public weblink template — CLASSIC (default) | MODERN ──
  // Seeded from the Classic/Modern chooser popup on AllLeads (?templateStyle=). WHITELISTED — the
  // URL is user-editable, so anything that is not exactly MODERN falls to CLASSIC. Edit mode still
  // overrides this with the stored value once the quotation loads.
  const [templateStyle, setTemplateStyle] = useState(() => {
    const fromUrl = searchParams.get("templateStyle");
    return fromUrl === "MODERN" || fromUrl === "PREMIUM" ? fromUrl : "CLASSIC";
  });

  const [leadData, setLeadData] = useState(null);
  const [leadLoading, setLeadLoading] = useState(false);
  const [destinationId, setDestinationId] = useState(null);

  // ── Edit mode ka fetched quotation — TABS ko prefill dene ke liye ──
  // Ye alag state isliye hai (flightData/hotelData ke bajaye): tabs ko wahi object wapas
  // bhejna jo wo khud emit karte hain, ek infinite loop banata. loadedData sirf ek baar
  // API se set hota hai aur uske baad kabhi nahi badalta, isliye har tab ise safely
  // "ek baar seed karo" signal ki tarah treat kar sakta hai.
  const [loadedData, setLoadedData] = useState(null);

  // Inclusions/policies quotation ke TOP level pe aati hain (nested object nahi), isliye
  // InclusionsExclusionsTab ke liye unhe ek object me baandh dete hain.
  const inclusionsInitial = useMemo(() => {
    if (!loadedData) return null;
    const { inclusions, exclusions, paymentPolicies, cancellationPolicies, bookingTerms } = loadedData;
    if (!inclusions && !exclusions && !paymentPolicies && !cancellationPolicies && !bookingTerms) return null;
    return { inclusions, exclusions, paymentPolicies, cancellationPolicies, bookingTerms };
  }, [loadedData]);


  const [flightData, setFlightData] = useState({});
  const [hotelData, setHotelData] = useState({});
  const [sightseeingData, setSightseeingData] = useState({});
  const [cruiseData, setCruiseData] = useState({});
  const [vehicleData, setVehicleData] = useState({});
  const [addonData, setAddonData] = useState({});
  const [inclusionsData, setInclusionsData] = useState({});
  const [summaryData, setSummaryData] = useState({});

  // Wrap each tab's setter: real user edit → form dirty (Update enable). Prefill (hydrating) → no.
  const onFlightChange = useCallback((v) => { setFlightData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onHotelChange = useCallback((v) => { setHotelData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onSightseeingChange = useCallback((v) => { setSightseeingData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onCruiseChange = useCallback((v) => { setCruiseData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onVehicleChange = useCallback((v) => { setVehicleData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onAddonChange = useCallback((v) => { setAddonData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onInclusionsChange = useCallback((v) => { setInclusionsData(v); if (!hydratingRef.current) setIsDirty(true); }, []);
  const onSummaryChange = useCallback((v) => { setSummaryData(v); if (!hydratingRef.current) setIsDirty(true); }, []);

  const costs = useMemo(() => ({
    flight: Number(flightData.amount) || 0,
    hotel: Number(hotelData.amount) || 0,
    sightseeing: Number(sightseeingData.amount) || 0,
    cruise: Number(cruiseData.amount) || 0,
    vehicle: Number(vehicleData.amount) || 0,
    addons: Number(addonData.amount) || 0,
  }), [flightData.amount, hotelData.amount, sightseeingData.amount,
  cruiseData.amount, vehicleData.amount, addonData.amount]);

  const grandTotal = (() => {
    const subtotal = Object.values(costs).reduce((a, b) => a + b, 0);
    const disc = summaryData.discType === "%"
      ? (subtotal * Number(summaryData.discount || 0)) / 100
      : Number(summaryData.discount || 0);
    const afterDisc = subtotal - disc + Number(summaryData.markup || 0);
    const taxAmt = (afterDisc * Number(summaryData.tax ?? 18)) / 100;
    return afterDisc + taxAmt;
  })();

  /* ── Fetch Lead ── */
  useEffect(() => {
    if (!leadId) return;
    (async () => {
      try {
        setLeadLoading(true);
        const res = await leadService.getLeadById(leadId);
        const data = res.data?.data || res.data || {};
        setLeadData(data);
        setDestinationId(
          data.itinerary?.[0]?.Id ||
          data.itinerary?.[0]?.id ||
          null
        );
        if (!qtTitle) {
          const dest = data.itinerary?.[0]?.destination || "";
          const nights = data.itinerary?.[0]?.nights || "";
          const autoTitle = [data.customerName, dest, nights ? `${nights}N` : ""].filter(Boolean).join(" – ");
          if (autoTitle) setQtTitle(autoTitle);
        }
      } catch (err) {
        console.error("Failed to fetch lead:", err);
        if (err.response?.status === 401) showToast("Session expired. Please login again.", "error");
        else if (err.response?.status === 404) showToast("Lead not found.", "error");
        else showToast("Failed to load lead data.", "error");
      } finally {
        setLeadLoading(false);
      }
    })();
  }, [leadId]);

  /* ── Load existing quotation (edit mode) ── */
  useEffect(() => {
    if (!editId) return;
    hydratingRef.current = true;   // prefill in progress → don't mark dirty
    (async () => {
      try {
        const res = await quotationService.getQuotationById(editId);
        const data = res.data?.data || res.data || {};
        setQtTitle(data.title || "");
        setTemplateStyle(data.templateStyle || "CLASSIC");
        // Tabs isi se apni internal state seed karte hain (initialData prop).
        setLoadedData(data);
        if (data.flight) setFlightData(data.flight);
        if (data.hotel) setHotelData(data.hotel);
        if (data.sightseeing) setSightseeingData(data.sightseeing);
        if (data.cruise) setCruiseData(data.cruise);
        if (data.vehicle) setVehicleData(data.vehicle);
        if (data.addons) setAddonData(data.addons);
        if (data.inclusions || data.exclusions) {
          setInclusionsData({
            inclusions: data.inclusions || [],
            exclusions: data.exclusions || [],
            paymentPolicies: data.paymentPolicies || [],
            cancellationPolicies: data.cancellationPolicies || [],
            bookingTerms: data.bookingTerms || [],
          });
        }
        if (data.pricing) setSummaryData(data.pricing);
      } catch (err) {
        console.error("Failed to load quotation:", err);
        showToast("Failed to load quotation data.", "error");
      } finally {
        // Freshly loaded quotation = clean. Re-enable dirty tracking on next tick,
        // after prefill (and any tab re-fires) settle.
        setIsDirty(false);
        setTimeout(() => { hydratingRef.current = false; }, 0);
      }
    })();
  }, [editId]);

  /* ── Prefill settle hone ke baad form ko wapas "clean" mark karo ──
     Tabs apni state `loadedData` se seed karte hain, aur seed hote hi apna data parent ko
     emit karte hain. Wo emit ek real user change nahi hai, par edit-effect ka
     `hydratingRef` tab tak false ho chuka hota hai — to Update button bina kisi change ke
     enable dikhta tha. Child effects parent effects se pehle chalte hain, isliye jab ye
     effect chalta hai tab tak saare tabs seed ho chuke hote hain. */
  useEffect(() => {
    if (!editId || !loadedData) return;
    const t = setTimeout(() => setIsDirty(false), 0);
    return () => clearTimeout(t);
  }, [editId, loadedData]);

  /* ── Collect all data ─ */
  const collectAllData = useCallback(() => ({
    leadId,
    destinationId,
    title: qtTitle || "Quotation",
    version,
    stage,
    templateStyle,
    // `?? true` fail-open tha: jis tab pe user gaya hi nahi uska `included` undefined rehta
    // hai, aur section lead ke against bhi ON chala jaata tha. Fallback ab lead-derived gate
    // hai. User ka explicit tick (included === true) hamesha jeetta hai — kahin clamp nahi.
    flightIncluded: flightData.included ?? svcOn("Flight"),
    flightTitle: flightData.title || "Flight Details",
    flightAmount: flightData.amount || 0,
    journey: flightData.journey || "Round Trip",
    segments: flightData.segments || [],
    hotelIncluded: hotelData.included ?? svcOn("Hotel"),
    hotelTitle: hotelData.title || "Hotel Details",
    hotelAmount: hotelData.amount || 0,
    hotelNotes: hotelData.notes || "",
    hotels: hotelData.hotels || [],
    sightseeingIncluded: sightseeingData.included ?? svcOn("Sightseeing"),
    sightseeingTitle: sightseeingData.title || "Sightseeing",
    sightseeingAmount: sightseeingData.amount || 0,
    sightseeingNotes: sightseeingData.notes || "",
    days: sightseeingData.days || [],
    cruiseIncluded: cruiseData.included ?? false,
    cruiseTitle: cruiseData.title || "Cruise Details",
    cruiseAmount: cruiseData.amount || 0,
    cruises: cruiseData.cruises || [],
    vehicleIncluded: vehicleData.included ?? svcOn("Vehicle"),
    vehicleTitle: vehicleData.title || "Vehicle Details",
    vehicleAmount: vehicleData.amount || 0,
    vehicles: vehicleData.vehicles || [],
    addonIncluded: addonData.included ?? false,
    addonTitle: addonData.title || "Add-on Services",
    addonAmount: Number(addonData.amount) || 0,
    addons: addonData.items || [],
    inclusions: inclusionsData.inclusions || [],
    exclusions: inclusionsData.exclusions || [],
    paymentPolicies: inclusionsData.paymentPolicies || [],
    cancellationPolicies: inclusionsData.cancellationPolicies || [],
    bookingTerms: inclusionsData.bookingTerms || [],
    discount: summaryData.discount || 0,
    discType: summaryData.discType || "Fixed",
    tax: summaryData.tax || 0,
    markup: summaryData.markup || 0,
    // leadData bhi dep hai — svcOn() isi se derive hota hai, warna lead aane ke baad bhi
    // ye callback purane (sab-ON) gate ke saath memoized reh jaata.
  }), [leadId, destinationId, leadData, qtTitle, version, stage, templateStyle,
    flightData, hotelData, sightseeingData, cruiseData,
    vehicleData, addonData, inclusionsData, summaryData]);

  /* ── Save ──
     asNew = false → normal Save button:
        • edit mode (quotationId set)  → UPDATE the existing quotation (PUT)
        • create mode                  → CREATE a new quotation (POST)
     asNew = true  → "Save as New" button (only shown in edit mode):
        • always CREATE a fresh quotation from the current form. No id is sent, so the
          backend makes a brand-new record with its own weblink; the original stays untouched. */
  const handleSave = async (asNew = false) => {
    if (!qtTitle.trim()) { showToast("Please enter a quotation title.", "error"); return; }
    try {
      setSaving(true);
      const allData = collectAllData();
      // DEBUG — vehicle data save hone se pehle dekho
      console.log("=== SAVE: vehicleData state ===", vehicleData);
      console.log("=== SAVE: vehicles being sent ===", allData.vehicles);
      if (allData.vehicles?.[0]) {
        console.log("First vehicle model:", allData.vehicles[0].model);
        console.log("First vehicle imagePath:", allData.vehicles[0].imagePath);
      }
      if (quotationId && !asNew) {
        await quotationService.updateQuotation(quotationId, allData);
        setIsDirty(false);
        showToast("Quotation updated successfully!");
      } else {
        const res = await quotationService.createQuotation(allData);
        const newId = res.data?.data?.id || res.data?.data?.publicId || res.data?.id || res.data?.publicId;
        setQuotationId(newId);
        setIsDirty(false);
        // Point the URL at the new quotation so any further save updates IT, not the original.
        if (newId) navigate(`/createquotation?leadId=${leadId || ""}&quotationId=${newId}`, { replace: true });
        showToast(asNew ? "Saved as a new quotation!" : "Quotation created successfully!");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save quotation.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── PDF ──
     The builder has its own Export PDF button, separate from the one in the leads list. It opens the
     same Classic/Modern/Premium dialog and passes the pick straight through as a one-off override —
     nothing is saved, so exporting a Premium copy does not change the quotation's own design. */
  const handlePdf = () => {
    if (!quotationId) { showToast("Please save the quotation first.", "error"); return; }
    setStylePickOpen(true);
  };

  const exportPdfAs = async (style) => {
    setStylePickOpen(false);
    try {
      setPdfLoading(true);
      // Readable business code in the file name — never the raw UUID when a code exists.
      const code = loadedData?.quoteNo || version || String(quotationId).slice(0, 8).toUpperCase();
      await runPdfDownload({
        endpoint: `/quotations/${quotationId}/pdf`,
        params: style ? { style } : undefined,
        fileName: `TravelCRM-Quotation-${code}.pdf`,
      });
      showToast("PDF downloaded successfully!");
    } catch (e) {
      // The hook rehydrates the Blob error envelope, so the server's real message shows.
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Failed to generate PDF."), "error");
    } finally {
      setPdfLoading(false);
    }
  };

  /* ── Share ── */
  const handleShare = async () => {
    if (!quotationId) { showToast("Please save the quotation first.", "error"); return; }
    try {
      const res = await quotationService.getShareLink(quotationId);
      const link = res.data?.data?.shareUrl || res.data?.shareUrl || "";
      if (link) { await navigator.clipboard.writeText(link); showToast("Share link copied!"); }
    } catch {
      showToast("Failed to generate share link.", "error");
    }
  };

  // ── Lead ke chosen services → tabs reorder + Include default ──
  // Backend services lowercase bhejta hai ('hotel','flight'), isliye yahin normalize kar lo.
  const leadServices = (Array.isArray(leadData?.services) ? leadData.services : [])
    .map(s => String(s).toLowerCase());

  // servicesKnown — kya hum SURE hain ki is lead ne services choose ki hain?
  // Pehle `leadServices.length === 0` hi gate tha, jo fail-OPEN karta tha: lead abhi fetch ho
  // raha hota tab bhi list khali hoti, to sab tabs ON dikh jaate the aur lead aane ke baad
  // silently badal jaate the. Ab tri-state:
  //   (a) leadId hi nahi (create mode)            → false → sab ON (purana behavior)
  //   (b) leadId hai par lead abhi in-flight      → false → sab ON, lead aate hi resolve
  //   (c) lead aa gaya par services blank         → false → sab ON (deliberate fail-open —
  //       ingested leads kabhi services set nahi karte, unhe khaali quotation nahi dena)
  //   (d) lead aa gaya services ke saath          → true  → sirf chosen ON
  // NOTE: `leadLoading` yahan bharosemand nahi — fetch effect `if (!leadId) return` pe bina
  // flag set kiye nikal jaata hai. In-flight ka reliable test `leadId && !leadData` hai.
  const servicesKnown = Boolean(leadId && leadData && leadServices.length > 0);

  // svcOn ko STABLE rehna chahiye — ye neeche tab remount keys feed karta hai, isliye lead
  // resolve hone ke baad ye zyada se zyada EK baar flip hota hai.
  const svcOn = (name) => !servicesKnown || leadServices.includes(name.toLowerCase());

  // Manual override — user ne khud "Include X in Quotation" tick kiya to wo tab dobara
  // navigable ho jaana chahiye (owner decision: lead ka choice default hai, lock nahi).
  // Koi naya channel nahi banaya: har service tab pehle se apna `included` onDataChange me
  // bhejta hai, wahi single source of truth hai. Untick karte hi tab wapas disabled.
  const manualOn = {
    flight: flightData.included === true,
    hotel: hotelData.included === true,
    sightseeing: sightseeingData.included === true,
    cruise: cruiseData.included === true,
    vehicle: vehicleData.included === true,
  };

  // Reorder: chosen service tabs pehle → non-chosen service tabs → addons/inclusions/summary (end).
  // Lead na ho (create mode, ya services blank) → order original hi rehta hai.
  // Saath hi har tab pe `enabled` stamp karo — strip, dots, counter aur prev/next sab EK hi
  // list se chalein, teen jagah alag-alag logic na rahe.
  const orderedTabs = (() => {
    const chosen = [], notChosen = [], other = [];
    for (const t of TABS) {
      const svc = SERVICE_TAB_MAP[t.id];
      // non-service tab (addons/inclusions/summary) hamesha ON — inka koi lead service nahi.
      const tab = { ...t, enabled: !svc || svcOn(svc) || manualOn[t.id] === true };
      if (!svc) other.push(tab);                                 // non-service → hamesha end
      else if (leadServices.includes(svc.toLowerCase())) chosen.push(tab);  // chosen → pehle
      else notChosen.push(tab);                                  // non-chosen → baad me
    }
    return [...chosen, ...notChosen, ...other];
  })();

  // Navigable list — footer counter, dots aur prev/next isi pe chalte hain.
  // Navigation chalti hai POORE reordered sequence pe (chosen pehle, phir baaki) — disabled tab
  // ko nav se hataya NAHI jaata. Wajah: "Include X in Quotation" toggle hi wo jagah hai jahan se
  // user ek non-chosen service ON karta hai, aur wo toggle us tab ke ANDAR hai. Tab ko nav/click
  // se block kar dein to enable karne ka koi raasta hi nahi bachta. Disabled sirf VISUAL hai
  // (greyed + panel ke fields Include tick hone tak locked).
  const navTabs = orderedTabs;

  // -1 tab milta hai jab active tab disabled ho (page `useState("flight")` se khulta hai, jo
  // lead ke hisaab se disabled ho sakta hai; ya user apne hi tab ka Include untick kar de).
  // Pehle Prev/Next seedha orderedTabs[activeIdx ± 1].id deref karte the → hard crash. Guard.
  const activeIdx = navTabs.findIndex(t => t.id === activeTab);
  const onNavigableTab = activeIdx !== -1;

  // Lead resolve hote hi active tab ko pehle navigable tab pe le jao (sirf ek baar).
  // Ye `useState("flight")` ko bhi cover karta hai jab flight is lead pe chosen nahi hai.
  const activeInitRef = useRef(false);
  useEffect(() => {
    if (activeInitRef.current || !servicesKnown || navTabs.length === 0) return;
    setActiveTab(navTabs[0].id);
    activeInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesKnown]);

  const travelers = leadData
    ? [
      leadData.adults ? `${leadData.adults} Adults` : "",
      leadData.children ? `${leadData.children} Child` : "",
      leadData.infants ? `${leadData.infants} Infant` : "",
    ].filter(Boolean).join(", ")
    : "—";

  // ── Rooms count — multiple possible field names handle karo ──
  const rooms = leadData?.rooms
    || leadData?.noOfRooms
    || leadData?.roomCount
    || leadData?.numberOfRooms
    || null;

  // ── Pax info — har tab ko bhejne ke liye (Flight=members, Hotel=rooms, Sightseeing=pax) ──
  const adults = Number(leadData?.adults) || 0;
  const children = Number(leadData?.children) || 0;
  const infants = Number(leadData?.infants) || 0;
  const totalPax = adults + children + infants;
  const paxInfo = {
    adults, children, infants, totalPax,
    rooms: rooms ? Number(rooms) : null,
  };

  // ── Lead ke itinerary se day→city map + per-city stay dates banao ──
  // itinerary: [{destination:"Dubai", city:"...", nights:2}, ...]
  // → dayCityMap: {1:"Dubai", 2:"Dubai", 3:"Manali", 4:"Manali"}
  // → destinations: [{city, nights, startDay, endDay, checkIn, checkOut}, ...]
  // const { dayCityMap, destinations: cityStays } = (() => {
  //   const itin = Array.isArray(leadData?.itinerary) ? leadData.itinerary.filter(d => d && d.destination) : [];
  //   const map = {};
  //   const stays = [];
  //   let day = 1;
  //   const travelDate = leadData?.travelDate ? new Date(leadData.travelDate) : null;
  //   const addDays = (base, n) => { if (!base) return ""; const d = new Date(base); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  //   itin.forEach((item) => {
  //     const nights = Number(item.nights) || 0;
  //     const startDay = day;
  //     for (let i = 0; i < Math.max(nights, 1); i++) { map[day] = item.city || item.destination; day++; }
  //     const endDay = day - 1;
  //     stays.push({
  //       // City = itinerary row ka actual city (e.g. "Raigad"). Sirf tab destination naam
  //       // pe fall back karo jab kisi row me city set na ho.
  //       city: item.city || item.destination,
  //       nights,
  //       startDay,
  //       endDay,
  //       checkIn:  travelDate ? addDays(travelDate, startDay - 1) : "",
  //       checkOut: travelDate ? addDays(travelDate, endDay)       : "",
  //     });
  //   });
  //   return { dayCityMap: map, destinations: stays };
  // })();

  // ── Lead itinerary se stay days + final departure day banao ──
  // Example:
  // Kathmandu 2N + Pokhara 1N + Janakpur 1N
  //
  // Day 1 → Kathmandu
  // Day 2 → Kathmandu
  // Day 3 → Pokhara
  // Day 4 → Janakpur
  // Day 5 → Janakpur departure

  const {
    dayCityMap,
    departureDay,
    destinations: cityStays,
  } = (() => {
    const itinerary = Array.isArray(leadData?.itinerary)
      ? leadData.itinerary.filter(
        (item) => item && (item.destination || item.city)
      )
      : [];

    const map = {};
    const stays = [];

    let currentDay = 1;
    let totalNights = 0;

    const travelDate = leadData?.travelDate
      ? new Date(leadData.travelDate)
      : null;

    const addDays = (baseDate, numberOfDays) => {
      if (!baseDate) return "";

      const date = new Date(baseDate);
      date.setDate(date.getDate() + numberOfDays);

      return date.toISOString().slice(0, 10);
    };

    itinerary.forEach((item) => {
      const city = item.city || item.destination;
      const nights = Math.max(Number(item.nights) || 0, 0);

      totalNights += nights;

      const startDay = currentDay;

      // Minimum one day rakha hai so 0-night/day-trip itinerary bhi visible rahe.
      const stayDays = Math.max(nights, 1);

      for (let index = 0; index < stayDays; index++) {
        map[currentDay] = city;
        currentDay += 1;
      }

      const endDay = currentDay - 1;

      stays.push({
        city,
        nights,
        startDay,
        endDay,

        checkIn: travelDate
          ? addDays(travelDate, startDay - 1)
          : "",

        // Example: 4 nights ka checkout Day 5 ko hoga.
        checkOut: travelDate
          ? addDays(travelDate, endDay)
          : "",
      });
    });

    let finalDepartureDay = null;

    // Nights available hain to final N+1 departure day add karo.
    if (itinerary.length > 0 && totalNights > 0) {
      const lastItineraryItem = itinerary[itinerary.length - 1];

      const lastCity =
        lastItineraryItem.city ||
        lastItineraryItem.destination ||
        "";

      finalDepartureDay = currentDay;

      // Departure same last city se hoga.
      map[finalDepartureDay] = lastCity;
    }

    return {
      dayCityMap: map,
      departureDay: finalDepartureDay,
      destinations: stays,
    };
  })();


  const destination = leadData?.itinerary?.length
    ? leadData.itinerary.map(i => `${i.destination}${i.nights ? ` (${i.nights}N)` : ""}`).join(", ")
    : "—";

  const assignedTo =
    leadData?.assignedUser?.fullName ||
    leadData?.assignedUser?.name ||
    leadData?.assignedUserName ||
    leadData?.assignTo || "—";

  const SUMMARY_INFO = [
    { icon: User, label: "Client Name", value: leadData?.customerName || "—", color: "blue" },
    { icon: Phone, label: "Contact", value: leadData?.phone || "—", color: "emerald" },
    { icon: Users, label: "Travelers", value: travelers, color: "violet" },
    { icon: Calendar, label: "Assigned To", value: assignedTo, color: "amber" },
    { icon: MapPin, label: "Destination", value: destination, color: "rose" },
    { icon: FileText, label: "Package", value: qtTitle || "—", color: "cyan" },
  ];

  const fmt = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div
      className="min-h-screen bg-slate-100 font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        .tab-scroll::-webkit-scrollbar { height: 0px; }
        .qt-tab-btn { transition: color 0.18s, background 0.18s, border-color 0.18s; }
        .lift-card  { transition: box-shadow 0.2s, transform 0.2s; }
        .lift-card:hover { box-shadow: 0 8px 32px 0 rgba(15,23,42,0.09); transform: translateY(-1px); }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        .fade-up { animation: fadeUp .4s ease both; }
        .stat-card-hover { transition: transform 0.2s, box-shadow 0.2s; }
        .stat-card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── RESPONSIVE CONTAINER ── */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-7 space-y-4 sm:space-y-5">

        {/* ── TOP BAR ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between fade-up">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-2">
              <Home size={12} />
              <ChevronRight size={10} className="text-slate-300" />
              <span className="hover:text-slate-600 cursor-pointer transition-colors" onClick={() => navigate("/allleads")}>
                Leads
              </span>
              <ChevronRight size={10} className="text-slate-300" />
              <span className="text-blue-600 font-bold">{quotationId ? "Edit Quotation" : "Create Quotation"}</span>
            </div>
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
                <FileText size={15} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {quotationId ? "Edit Quotation" : "Create Quotation"}
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {leadId ? `Lead ID: ${String(leadId).slice(0, 8)}...` : "New Quotation"}
                  {quotationId && <span className="ml-2 text-emerald-600 font-bold">· Saved</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Lead chips — scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap">
            {leadLoading && (
              <span className="text-xs text-slate-400 font-medium animate-pulse whitespace-nowrap">Loading lead...</span>
            )}
            {!leadLoading && leadData && (
              <>
                {/* Client name */}
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm whitespace-nowrap flex-shrink-0">
                  <User size={11} className="text-blue-500" /> {leadData.customerName || "—"}
                </span>
                {/* Travelers */}
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm whitespace-nowrap flex-shrink-0">
                  <Users size={11} className="text-violet-500" /> {travelers}
                </span>
                {/* Destination */}
                {leadData.itinerary?.[0]?.destination && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm whitespace-nowrap flex-shrink-0">
                    <MapPin size={11} className="text-rose-500" /> {leadData.itinerary[0].destination}
                    {leadData.itinerary[0].nights && ` · ${leadData.itinerary[0].nights}N`}
                  </span>
                )}
                {/* ── ROOMS CHIP — naya add kiya ── */}
                {rooms && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm whitespace-nowrap flex-shrink-0">
                    <Hotel size={11} className="text-sky-500" /> {rooms} Room(s)
                  </span>
                )}
              </>
            )}
            {/* Stage + version */}
            <span className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 whitespace-nowrap flex-shrink-0">
              {stage} · {version}
            </span>
          </div>
        </div>

        {/* ── LEAD INFO + QUOTATION DETAILS CARD ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden lift-card fade-up"
          style={{ animationDelay: "60ms" }}>

          {/* Card Header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User size={13} className="text-blue-600" />
            </div>
            <p className="text-[13px] font-bold text-slate-700">Lead & Quotation Details</p>
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {leadLoading && <span className="text-[11px] text-slate-400 animate-pulse hidden sm:inline">Fetching lead...</span>}
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-[11px] font-semibold text-slate-400">Draft</span>
              {quotationId && (
                <span className="text-[11px] font-semibold text-emerald-500 ml-1 hidden sm:inline">
                  · #{String(quotationId).slice(0, 8)}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">

            {/* ── Lead Info Grid — responsive ── */}
            {leadData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">

                {/* Client */}
                <div className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:gap-3 bg-blue-50 rounded-xl p-2.5 sm:p-3 border border-blue-100">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0 shadow-sm">
                    {(leadData.customerName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] text-blue-500 font-bold uppercase tracking-wide">Client</p>
                    <p className="text-[12px] sm:text-[13px] font-extrabold text-slate-800 truncate">{leadData.customerName || "—"}</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">{leadData.email || ""}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2 sm:gap-3 bg-emerald-50 rounded-xl p-2.5 sm:p-3 border border-emerald-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Phone size={13} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Phone</p>
                    <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 truncate">{leadData.phone || "—"}</p>
                  </div>
                </div>

                {/* Travelers */}
                <div className="flex items-center gap-2 sm:gap-3 bg-violet-50 rounded-xl p-2.5 sm:p-3 border border-violet-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Users size={13} className="text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] text-violet-600 font-bold uppercase tracking-wide">Travelers</p>
                    <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 truncate">{travelers}</p>
                  </div>
                </div>

                {/* Destination */}
                <div className="flex items-center gap-2 sm:gap-3 bg-rose-50 rounded-xl p-2.5 sm:p-3 border border-rose-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <MapPin size={13} className="text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] text-rose-600 font-bold uppercase tracking-wide">Destination</p>
                    <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 truncate">{destination}</p>
                  </div>
                </div>

                {/* Lead Type */}
                <div className="flex items-center gap-2 sm:gap-3 bg-amber-50 rounded-xl p-2.5 sm:p-3 border border-amber-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={13} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] text-amber-600 font-bold uppercase tracking-wide">Lead Type</p>
                    <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 truncate">{leadData.leadType || "—"}</p>
                  </div>
                </div>

                {/* Assigned To */}
                <div className="flex items-center gap-2 sm:gap-3 bg-indigo-50 rounded-xl p-2.5 sm:p-3 border border-indigo-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] text-indigo-600 font-bold uppercase tracking-wide">Assigned To</p>
                    <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 truncate">{assignedTo}</p>
                  </div>
                </div>

              </div>
            )}

            {/* Services tags */}
            {leadData?.services?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Services:</span>
                {leadData.services.map((s, i) => {
                  const c = serviceColor(s);
                  return (
                    <span key={i} style={{ background: c.bg, color: c.text }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold">{serviceLabel(s)}</span>
                  );
                })}
              </div>
            )}

            {leadData && <div className="border-t border-slate-100" />}

            {/* ── Quotation Title / Version / Stage / Template ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <Label required>Quotation Title</Label>
                <Input value={qtTitle} onChange={e => { setQtTitle(e.target.value); if (!hydratingRef.current) setIsDirty(true); }} placeholder="e.g. Nepal Adventure Premium" />
              </div>
              <div>
                <Label>Version</Label>
                <div className="relative">
                  <Input value={version} disabled />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">{version}</span>
                </div>
              </div>
              <div>
                <Label>Lead Stage</Label>
                <div className="relative">
                  <Input value={leadData?.leadStage || stage} disabled className="pr-24" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold">
                    {leadData?.leadStage || stage}
                  </span>
                </div>
              </div>
              {/* No template picker here by design — the design is chosen at DOWNLOAD time
                  (see the PDF dialog in AllLeads). templateStyle is still tracked in this form's
                  state and round-tripped on save so an existing quotation's saved design survives
                  an edit; it just isn't something the builder asks about. */}
            </div>

          </div>
        </div>

        {/* ── TABS CARD ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden fade-up"
          style={{ animationDelay: "120ms" }}>

          {/* Tab bar — scrollable on mobile */}
          <div className="tab-scroll overflow-x-auto border-b border-slate-100">
            <div className="flex min-w-max">
              {orderedTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const off = !tab.enabled;   // lead pe ye service chuni nahi gayi
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={off ? "Lead pe ye service select nahi hai — is tab me 'Include' tick karke ON karein" : undefined}
                    // HTML `disabled` yahan JAAN-BOOJHKAR nahi lagaya. Ye tab greyed zaroor hai,
                    // par khulna chahiye: iske andar hi wo "Include X in Quotation" toggle hai
                    // jisse user is service ko ON karta hai. Button disable karte hi enable karne
                    // ka raasta hi band ho jaata (dot, prev/next, click — sab isi ke peeche hain).
                    // Greying LAYOUT-NEUTRAL hai — sirf opacity badalti hai, box-model
                    // (px/py/border-b-2/whitespace-nowrap) waisa ka waisa, warna strip width shift.
                    className={`qt-tab-btn relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-4
                      text-[12px] sm:text-[13px] font-bold whitespace-nowrap border-b-2 focus:outline-none group
                      ${off ? "opacity-40" : ""}
                      ${active
                        ? TAB_ACTIVE[tab.color]
                        : off
                          ? "text-slate-400 border-transparent"
                          : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-lg transition-all flex-shrink-0
                        ${active ? ICON_BG[tab.color] : off ? "bg-slate-100" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                      <Icon size={11} strokeWidth={active ? 2.5 : 2} />
                    </span>
                    {/* Hide label on very small screens for some tabs */}
                    <span className="hidden xs:inline sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="relative overflow-hidden">
            <div style={{ minHeight: 260 }}>
              {/* `key` props JAAN-BOOJHKAR hata di gayi hain.
                  Pehle key me svcOn()/costs the, to lead resolve hote hi (ya kisi bhi amount
                  ke badalte hi) React tab ko unmount karke naya bana deta tha — aur naya tab
                  apni KHAALI state parent pe emit kar deta tha, jisse edit mode ka load kiya
                  hua data mit jaata tha. Ab `defaultIncluded` ko har tab andar hi ek effect
                  se sync karta hai, remount ke bina. */}
              <div style={{ display: activeTab === "flight" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6"><FlightTab onDataChange={onFlightChange} paxInfo={paxInfo} defaultIncluded={svcOn("Flight")} initialData={loadedData?.flight} /></div>
              <div style={{ display: activeTab === "hotel" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6"><HotelTab onDataChange={onHotelChange} paxInfo={paxInfo} destinations={cityStays} defaultIncluded={svcOn("Hotel")} initialData={loadedData?.hotel} /></div>
              <div style={{ display: activeTab === "sightseeing" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6">
                <SightseeingTab
                  onDataChange={onSightseeingChange}
                  paxInfo={paxInfo}
                  dayCityMap={dayCityMap}
                  departureDay={departureDay}
                  travelDate={leadData?.travelDate || ""}
                  defaultIncluded={svcOn("Sightseeing")}
                  initialData={loadedData?.sightseeing}
                />
              </div>
              <div style={{ display: activeTab === "cruise" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6"><CruiseTab onDataChange={onCruiseChange} defaultIncluded={svcOn("Cruise")} initialData={loadedData?.cruise} /></div>
              <div style={{ display: activeTab === "vehicle" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6"><VehicleTab onDataChange={onVehicleChange} defaultIncluded={svcOn("Vehicle")} initialData={loadedData?.vehicle} /></div>
              <div style={{ display: activeTab === "addons" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6"><AddOnServicesTab onDataChange={onAddonChange} initialData={loadedData?.addons} /></div>
              <div style={{ display: activeTab === "inclusions" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6"><InclusionsExclusionsTab onDataChange={onInclusionsChange} initialData={inclusionsInitial} /></div>
              <div style={{ display: activeTab === "summary" ? "block" : "none" }} className="p-3 sm:p-5 lg:p-6">
                <SummaryPricingTab
                  onDataChange={onSummaryChange}
                  costs={costs}
                  initialData={loadedData?.pricing}
                />
              </div>
            </div>
          </div>

          {/* Tab footer */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 bg-slate-50/80 border-t border-slate-100">
            {/* Counter/dots/prev-next — sab `navTabs` pe, taaki disabled tab ko na to
                ginta hai na uspe navigate karata hai. activeIdx -1 ho (active tab disabled)
                to step number chhupa do, galat "Step 0" na dikhe. */}
            <p className="text-[11px] text-slate-400 font-semibold">
              Step <span className="text-slate-700 font-extrabold">{onNavigableTab ? activeIdx + 1 : "–"}</span> of {navTabs.length}
            </p>
            {/* Progress dots — hidden on mobile, shown sm+ */}
            <div className="hidden sm:flex items-center gap-1.5">
              {navTabs.map((t, i) => {
                const done = onNavigableTab && i < activeIdx;
                const current = i === activeIdx;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} title={t.label}
                    className={`rounded-full transition-all duration-200 focus:outline-none
                      ${current ? "w-6 h-2 bg-blue-600" : done
                        ? "w-2 h-2 bg-emerald-400 hover:bg-emerald-500"
                        : "w-2 h-2 bg-slate-200 hover:bg-slate-300"}`} />
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <button disabled={!onNavigableTab || activeIdx === 0} onClick={() => setActiveTab(navTabs[activeIdx - 1].id)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-[12px] font-bold text-slate-500
                  hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-25 transition-all">
                <ChevronRight size={12} className="rotate-180" /> Prev
              </button>
              <button disabled={!onNavigableTab || activeIdx === navTabs.length - 1} onClick={() => setActiveTab(navTabs[activeIdx + 1].id)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-[12px] font-bold text-blue-600
                  hover:text-blue-800 hover:bg-blue-50 rounded-lg disabled:opacity-25 transition-all">
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── QUOTATION SUMMARY CARD ── */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-slate-200/60 fade-up"
          style={{ animationDelay: "180ms" }}>

          {/* Header strip */}
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-4 sm:px-7 py-4 sm:py-5">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={16} className="text-emerald-300" />
                </div>
                <div>
                  <p className="text-white text-sm font-extrabold tracking-tight">Quotation Summary</p>
                  <p className="text-slate-400 text-[11px] font-medium hidden sm:block">Verified pricing · Auto-calculated in real time</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-400/30 rounded-full text-emerald-300 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Pricing
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 sm:p-7">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">

              {/* Left — Client info chips */}
              <div className="lg:col-span-3">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <Sparkles size={13} className="text-blue-500" />
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Client & Package Details</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {SUMMARY_INFO.map(({ icon: Icon, label, value, color }) => {
                    const style = CHIP_STYLE[color];
                    return (
                      <div key={label}
                        className={`relative flex items-start gap-3 p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border-2 border-slate-100
                          ${style.ring} hover:shadow-lg ${style.glow} transition-all duration-200 cursor-default group overflow-hidden`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${style.grad} opacity-0 group-hover:opacity-[0.06] transition-opacity`} />
                        <div className={`relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${style.grad} text-white flex items-center justify-center
                            flex-shrink-0 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-200`}>
                          <Icon size={14} strokeWidth={2.3} />
                        </div>
                        <div className="relative z-10 min-w-0">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide leading-none">{label}</p>
                          <p className="text-xs sm:text-sm font-extrabold text-slate-800 truncate mt-1">{value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 flex-wrap">
                  <button onClick={handlePdf} disabled={pdfLoading}
                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-white hover:bg-blue-50 border-2 border-blue-100 hover:border-blue-300 text-blue-600 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-60">
                    {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    {pdfLoading ? "Generating..." : "Export PDF"}
                  </button>
                  <button onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-white hover:bg-violet-50 border-2 border-violet-100 hover:border-violet-300 text-violet-600 text-xs font-bold rounded-xl transition-all shadow-sm">
                    <Share2 size={13} /> Share with Client
                  </button>
                </div>
              </div>

              {/* Right — Pricing stat cards */}
              <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Wallet size={13} className="text-slate-400" />
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Pricing Overview</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* Grand Total */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-[18px] p-4 sm:p-5 flex flex-col justify-between min-h-[130px] sm:min-h-[155px] stat-card-hover cursor-default"
                    style={{ background: "linear-gradient(135deg,#00c6a7 0%,#00a389 40%,#007d6b 100%)" }}>
                    <div className="absolute -top-9 -right-8 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.13)" }} />
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center relative z-10" style={{ background: "rgba(255,255,255,0.22)" }}>
                      <TrendingUp size={18} className="text-white" />
                    </div>
                    <div className="relative z-10 mt-2 sm:mt-3">
                      <p className="text-[22px] sm:text-[28px] lg:text-[34px] font-extrabold text-white leading-none tracking-tight">{fmt(grandTotal)}</p>
                      <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[.13em] mt-1 sm:mt-2" style={{ color: "rgba(255,255,255,0.72)" }}>
                        Final Total
                      </p>
                    </div>
                  </div>

                  {/* Add-on total */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-[18px] p-4 sm:p-5 flex flex-col justify-between min-h-[130px] sm:min-h-[155px] stat-card-hover cursor-default"
                    style={{ background: "linear-gradient(135deg,#f7971e 0%,#f4821a 40%,#e06c0f 100%)" }}>
                    <div className="absolute -top-9 -right-8 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.13)" }} />
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center relative z-10" style={{ background: "rgba(255,255,255,0.22)" }}>
                      <Package size={18} className="text-white" />
                    </div>
                    <div className="relative z-10 mt-2 sm:mt-3">
                      <p className="text-[22px] sm:text-[28px] lg:text-[34px] font-extrabold text-white leading-none tracking-tight">{fmt(costs.addons)}</p>
                      <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[.13em] mt-1 sm:mt-2" style={{ color: "rgba(255,255,255,0.72)" }}>
                        Add-on Services
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trust badge */}
                <div className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={14} className="text-white" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold leading-snug">
                    Auto-saved and securely stored.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pb-4 sm:pb-6 fade-up"
          style={{ animationDelay: "240ms" }}>
          <p className="text-xs text-slate-400 font-medium">
            Fields marked <span className="text-rose-400 font-bold">*</span> are required
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button type="button" onClick={() => navigate(-1)}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 border-2 border-slate-200 hover:border-slate-300
                text-slate-600 font-bold text-sm rounded-xl transition-all bg-white hover:bg-slate-50 active:scale-95 shadow-sm">
              Cancel
            </button>

            {/* Save as New — only in edit mode. Clones the current form into a brand-new quotation
                (fresh record + fresh weblink); the quotation being edited stays untouched. */}
            {quotationId && (
              <button type="button" onClick={() => handleSave(true)} disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 font-bold text-sm rounded-xl
                  border-2 border-blue-200 hover:border-blue-300 text-blue-700 bg-white hover:bg-blue-50
                  transition-all active:scale-95 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                <Sparkles size={15} strokeWidth={2.5} /> Save as New
              </button>
            )}

            {/* Primary — Update (edit mode) or Create (create mode) */}
            {/* Primary — Update (edit mode) or Create (create mode).
                Edit mode me tab tak disabled jab tak kuch actually change na ho. */}
            <button type="button" onClick={() => handleSave(false)} disabled={saving || (quotationId && !isDirty)}
              title={quotationId && !isDirty ? "No changes to update yet" : undefined}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 sm:px-8 py-2.5 font-bold text-sm rounded-xl
                text-white shadow-md shadow-blue-200 transition-all active:scale-95
                hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed
                bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                : <><Save size={15} strokeWidth={2.5} />{quotationId ? "Update Quotation" : "Create Quotation"}</>
              }
            </button>
          </div>
        </div>

      </div>

      {/* Export PDF → pick a design. One-off: the quotation's own design is untouched. */}
      {stylePickOpen && (
        <QuotationStyleModal
          savedStyle={templateStyle}
          onSelect={exportPdfAs}
          onClose={() => setStylePickOpen(false)}
        />
      )}

      {/* Full-screen "preparing your PDF" overlay — shared with the leads list. */}
      <PdfDownloadLoader
        open={pdfBusy}
        documentType="Quotation"
        progress={pdfProgress}
        progressSupported={pdfProgressSupported}
      />
    </div>
  );
}