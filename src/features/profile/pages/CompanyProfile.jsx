import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  companyService,
  taxRateService,
} from "@features/settings";
import { hasPermission, P } from "@shared/lib/access";
import { Pen as FiEdit2, Save as FiSave, MapPin as FiMapPin, Calendar as FiCalendar, Key as FiKey, ChevronDown as FiChevronDown, Upload as FiUpload, Plus as FiPlus, Trash2 as FiTrash2, TriangleAlert as FiAlertTriangle, Info as FiInfo, CircleCheck as FiCheckCircle, RefreshCw as FiRefreshCw, ExternalLink as FiExternalLink, CircleAlert as FiAlertCircle, Building2 as FaBuilding, ReceiptText as FaFileInvoiceDollar, Crown as FaCrown, BriefcaseBusiness as MdBusinessCenter, Building as MdLocationCity, Sparkles as HiSparkles } from "lucide-react";


/* ─── EMPTY COMPANY STATE ───────────────────────────────────── */
const EMPTY_COMPANY = {
  name: "",
  prefix: "",
  email: "",
  phone: "",
  website: "",
  operatingSince: null,
  totalReviews: null,
  tripsSold: null,
  gstin: "",
  tan: "",
  status: "",
  createdDate: "",
  address: "",
  state: "",
  logoUrl: null,
  faviconUrl: null,
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
  "Andaman and Nicobar Islands", "Lakshadweep",
];

const TAX_TYPES = ["GST", "TCS", "TDS", "Service Tax", "VAT", "Other"];
const CALCULATIONS = ["Additive", "Inclusive", "Exclusive"];

// Every tenant user can view this page — the backend serves GET /api/company,
// /subscription, /ai-credits and /api/tax-rates to any authenticated user. Writes need
// SETTINGS_MANAGE, so the "edit" tab is filtered out for everyone else rather than
// offering them a Save button that would 403.
const TABS = [
  { id: "overview", label: "Company Details", manageOnly: false },
  { id: "edit", label: "Edit Profile", manageOnly: true },
  { id: "business", label: "Business Info", manageOnly: false },
  { id: "address", label: "Address", manageOnly: false },
  { id: "tax", label: "Tax Configuration", manageOnly: false },
];

/* ─── HELPERS ────────────────────────────────────────────────── */
// (name || "") — NOT a `= ""` default: a default only fires on `undefined`, and this page is exactly
// where a company name is still null, because it is the page you open to set it.
const initials = (name) =>
  (name || "").trim().split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "CO";

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3800); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
      ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}>
      <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
    </div>
  );
}

/* ─── STAT CARD (same as Customers / Reminders) ─────────────── */
function StatCard({ icon, label, value, gradient, sub, delay = 0 }) {
  const [displayed, setDisplayed] = useState(0);
  const isNum = Number.isFinite(value);
  useEffect(() => {
    if (!isNum) { return; }
    if (value === 0) { setDisplayed(0); return; }
    let s = 0; const step = Math.max(1, Math.ceil(value / 60));
    const iv = setInterval(() => { s = Math.min(s + step, value); setDisplayed(s); if (s >= value) clearInterval(iv); }, 16);
    return () => clearInterval(iv);
  }, [value, isNum]);
  const display = isNum
    ? displayed.toLocaleString("en-IN")
    : value ?? "—";
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden group
      hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer ring-1 ring-white/10`}
      style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300" />
      <div className="absolute -right-3 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 group-hover:bg-white/30 group-hover:scale-105 flex items-center justify-center transition-all text-xl shadow-inner">
            {icon}
          </div>
          {sub && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{sub}</span>}
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold leading-none mb-1">{display}</p>
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
      </div>
    </div>
  );
}

/* ─── SECTION CARD wrapper ───────────────────────────────────── */
function SectionCard({ title, icon, subtitle, children, delay = 0 }) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
      style={{ animation: `fadeUp .4s ease both`, animationDelay: `${delay}ms` }}>
      {title && (
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-blue-200/60">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/* ─── READ-ONLY ROW ──────────────────────────────────────────── */
function InfoRow({ label, value, href, badge, badgeColor = "bg-emerald-100 text-emerald-700" }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex-shrink-0 w-32 pt-0.5">{label}</span>
      {badge
        ? <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-1 rounded-full ${badgeColor}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          {value}
        </span>
        : href
          ? <a href={href} target="_blank" rel="noreferrer"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
            {value}<FiExternalLink className="w-3 h-3" />
          </a>
          : <span className="text-sm font-semibold text-slate-800 text-right">{value || "—"}</span>}
    </div>
  );
}

/* ─── FORM LABEL ─────────────────────────────────────────────── */
function Label({ children, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wide">
        {children}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const inp = (err) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-700 placeholder-slate-400
   focus:outline-none focus:ring-2 transition-all bg-white
   ${err
    ? "border-red-300 focus:border-red-400 focus:ring-red-50"
    : "border-slate-200 focus:border-blue-400 focus:ring-blue-50 hover:border-slate-300"}`;

/* ─── SKELETON ROW ───────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white/80 rounded-2xl border border-slate-100 p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-slate-200 rounded-lg w-1/3" />
      <div className="h-3 bg-slate-200 rounded-lg w-full" />
      <div className="h-3 bg-slate-200 rounded-lg w-2/3" />
      <div className="h-3 bg-slate-200 rounded-lg w-3/4" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LEFT SIDEBAR — profile card + subscription + AI credits
══════════════════════════════════════════════════════════════ */
function Sidebar({
  company,
  subscription,
  aiCredits,
}) {
  const inits = initials(company.name);

  return (
    <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4 lg:sticky lg:top-6 lg:self-start">

      {/* ── Profile card ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
        style={{ animation: "fadeUp .4s ease both" }}>
        {/* Avatar + name banner */}
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-6 flex flex-col items-center gap-3 overflow-hidden">
          <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/20 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-white/25 to-white/10 border-2 border-white/30
            flex items-center justify-center text-white text-2xl font-extrabold shadow-lg overflow-hidden">
            {company.logoUrl
              ? <img src={company.logoUrl} alt="logo" className="w-full h-full object-contain p-1 bg-white" />
              : inits}
          </div>
          <div className="relative text-center">
            <h2 className="text-white font-extrabold text-base leading-snug">{company.name}</h2>
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-extrabold bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {company.status}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="px-4 py-2 divide-y divide-slate-100">
          {[
            ["Email", company.email, true],
            ["Phone", company.phone, true],
            ["Operating Since", company.operatingSince, true],
            ["Reviews", company.totalReviews, true],
            ["Created", company.createdDate, true],
          ].map(([l, v, bl]) => (
            <div key={l} className="flex items-center justify-between py-2.5 gap-3">
              <span className="text-xs text-slate-500 font-medium flex-shrink-0">{l}</span>
              <span className={`text-xs font-bold truncate text-right ${bl ? "text-blue-600" : ""}`}>{v || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Subscription ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
        style={{ animation: "fadeUp .5s ease both" }}>
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3 flex items-center gap-2">
          <FaCrown className="w-4 h-4 text-yellow-300" />
          <span className="text-sm font-extrabold text-white">Subscription Information</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs font-extrabold text-blue-600 text-center mb-3 leading-snug">{subscription?.plan}</p>
          <div className="divide-y divide-slate-100">
            {[
              ["Start Date", subscription?.startDate],
              ["End Date", subscription?.endDate],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2">
                <span className="text-xs text-slate-500 font-medium">{l}</span>
                <span className="text-xs font-bold text-slate-700">{v}</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-slate-500 font-medium">Status</span>
              <span className="text-xs font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                {subscription?.status}
              </span>
            </div>
            <div className="py-2">
              <span className="text-xs text-slate-500 font-medium">Features</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3" /> All Core Features
                </span>
              </div>
            </div>
          </div>
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold
            ${subscription?.daysLeft <= 7
              ? "bg-red-50 border-red-200 text-red-600"
              : "bg-slate-50 border-slate-200 text-slate-600"}`}>
            <FiCalendar className="w-3 h-3 flex-shrink-0" />
            {subscription?.daysLeft} day{subscription?.daysLeft !== 1 ? "s" : ""} remaining
          </div>
        </div>
      </div>

      {/* ── AI Credits ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5"
        style={{ animation: "fadeUp .6s ease both" }}>
        <div className="flex items-center gap-2 mb-3">
          <HiSparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-extrabold text-slate-700">AI Features Credits</span>
        </div>
        <div className="text-center mb-2">
          <span className="text-2xl font-extrabold text-slate-800">{aiCredits?.used}</span>
          <span className="text-slate-400 font-bold"> / {aiCredits?.total}</span>
          <p className="text-xs text-slate-400 mt-0.5">remaining lifetime</p>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
          <div className="bg-red-500 h-2 rounded-full transition-all duration-700"
            style={{
              width: `${aiCredits?.total
                ? Math.round(
                  (aiCredits.used /
                    aiCredits.total) *
                  100
                )
                : 0
                }%`,
            }} />
        </div>
        <div className="space-y-1.5">
          {[
            ["bg-green-400", `Limit: ${aiCredits?.total}`],
            ["bg-blue-400", `Users used: $${aiCredits?.usedCost}`],
            ["bg-orange-400", "One-time limit — contact admin to upgrade"],
          ].map(([dot, txt]) => (
            <div key={txt} className="flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 mt-1`} />
              <span className="text-xs text-slate-500 leading-snug">{txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN SETTINGS PANEL (reused across multiple tabs)
══════════════════════════════════════════════════════════════ */
function AdminSettings() {
  const navigate = useNavigate();
  // Only a user who can actually reach /Users should be told they administer the company.
  const canManageUsers = hasPermission(P.USER_READ);

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
      style={{ animation: "fadeUp .5s ease both" }}>
      <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-5 py-3 flex items-center gap-2">
        <FiKey className="w-4 h-4 text-white" />
        <span className="text-sm font-extrabold text-white">
          {canManageUsers ? "Admin Settings" : "Account"}
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm font-bold text-slate-700 mb-0.5">Account Information</p>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {canManageUsers
            ? "You are logged in as a company administrator. You can manage your company profile, users, and access all features available in your subscription plan."
            : "You are signed in to your company workspace. Company details are shown here for reference — contact your administrator to change them."}
        </p>
        <div className={`grid grid-cols-1 gap-3 ${canManageUsers ? "sm:grid-cols-2" : ""}`}>
          {canManageUsers && (
            <button onClick={() => navigate("/Users")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
              text-white font-bold text-sm transition-all shadow-md shadow-blue-200 hover:shadow-lg">
              <FiKey className="w-4 h-4" /> Manage Users
            </button>
          )}
          <button
            onClick={() => navigate("/ChangePassword")}
            className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600
              text-white font-bold text-sm transition-all shadow-md shadow-teal-200 hover:shadow-lg">
            <FiKey className="w-4 h-4" /> Change Password
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 1 — OVERVIEW / COMPANY DETAILS
══════════════════════════════════════════════════════════════ */
function OverviewTab({
  company,
  aiCredits,
}) {
  const totalAiCredits =
    Number(aiCredits?.total);

  const usedAiCredits =
    Number(aiCredits?.used);

  const aiCreditsLeft =
    Number.isFinite(totalAiCredits) &&
      Number.isFinite(usedAiCredits)
      ? Math.max(
        totalAiCredits -
        usedAiCredits,
        0
      )
      : "—";
  return (
    <div className="space-y-5">
      {/* Stat cards — same system as Customers.jsx */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: "⭐", label: "Total Reviews", value: company.totalReviews, gradient: "from-amber-500 to-orange-500", delay: 0 },
          { icon: "✈️", label: "Trips Sold", value: company.tripsSold || 0, gradient: "from-blue-600 to-blue-700", delay: 60 },
          { icon: "📅", label: "Operating Since", value: company.operatingSince, gradient: "from-teal-500 to-teal-600", delay: 120 },
          {
            icon: "🤖",
            label: "AI Credits Left",
            value: aiCreditsLeft,
            gradient:
              "from-violet-500 to-purple-600",
            delay: 180,
          }
        ].map(c => (
          <div key={c.label} className="fade-up" style={{ animationDelay: `${c.delay}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      {/* Company details card */}
      <SectionCard
        title="Company Details"
        icon={<FaBuilding className="w-4 h-4" />}
        subtitle="Core company information"
        delay={60}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <InfoRow label="Company Name" value={company.name} />
          <InfoRow label="Company Prefix" value={company.prefix} />
          <InfoRow label="Email" value={company.email} />
          <InfoRow label="Phone" value={company.phone} />
          <InfoRow label="Status" value={company.status} badge />
          <InfoRow label="Created Date" value={company.createdDate} />
        </div>
      </SectionCard>

      <AdminSettings />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 2 — EDIT PROFILE
══════════════════════════════════════════════════════════════ */
function EditProfileTab({
  company,
  onSave,
  showToast,
  onOpenTax,
}) {
  const [form, setForm] = useState({
    name: company.name, prefix: company.prefix, email: company.email,
    website: company.website || "", phone: company.phone,
    operatingSince: company.operatingSince, totalReviews: company.totalReviews,
    tripsSold: company.tripsSold || 0, gstin: company.gstin || "",
    tan: company.tan || "", address: company.address || "", state: company.state || "",
  });
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(company.logoUrl || null);
  const [faviconPreview, setFaviconPreview] = useState(company.faviconUrl || null);
  const logoRef = useRef(); const favRef = useRef();
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrs(p => ({ ...p, [k]: "" })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Company name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.prefix.trim()) e.prefix = "Prefix is required";
    if (!form.state) e.state = "State is required";
    return e;
  };

  const handleFile = (e, type) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Max file size is 2MB", "error");
      return;
    }

    const preview = URL.createObjectURL(file);

    if (type === "logo") {
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      setFaviconFile(file);
      setFaviconPreview(preview);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs2 = validate();

    if (Object.keys(errs2).length) {
      setErrs(errs2);
      return;
    }

    setSaving(true);

    try {
      const unwrap = (r) =>
        (r?.data && typeof r.data === "object" && "data" in r.data) ? r.data.data : r.data;

      const res = await companyService.update(form);
      const updated = unwrap(res) || {};

      if (logoFile) {
        const logoRes = await companyService.uploadLogo(logoFile);
        updated.logoUrl = (unwrap(logoRes) || {}).logoUrl;
      }

      if (faviconFile) {
        const favRes = await companyService.uploadFavicon(faviconFile);
        updated.faviconUrl = (unwrap(favRes) || {}).faviconUrl;
      }

      onSave((previousCompany) => ({
        ...EMPTY_COMPANY,
        ...previousCompany,
        ...form,
        ...updated,
      }));

      showToast(
        "Company Profile Updated Successfully"
      );
    } catch (err) {
      showToast(
        err?.response?.data?.message ||
        "Failed to update profile",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const ErrMsg = ({ f }) => errs[f]
    ? <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><FiAlertCircle className="w-3 h-3" />{errs[f]}</p>
    : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">

      {/* Basic info */}
      <SectionCard title="Basic Information" icon={<FaBuilding className="w-4 h-4" />} delay={0}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label required hint="Full legal company name">Company Name</Label>
            <input value={form.name} onChange={e => set("name", e.target.value)} className={inp(errs.name)} placeholder="Enter Company Name" />
            <ErrMsg f="name" />
          </div>
          <div>
            <Label required hint="Max 5 chars — used in booking codes">Company Prefix</Label>
            <input value={form.prefix} onChange={e => set("prefix", e.target.value.toUpperCase().slice(0, 5))}
              className={inp(errs.prefix) + " font-mono"} placeholder="ABC" maxLength={5} />
            <ErrMsg f="prefix" />
          </div>
          <div>
            <Label required>Email Address</Label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inp(errs.email)} placeholder="company@email.com" />
            <ErrMsg f="email" />
          </div>
          <div>
            <Label>Phone Number</Label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} className={inp(false)} placeholder="" />
          </div>
          <div>
            <Label hint="Company website URL">Website</Label>
            <input value={form.website} onChange={e => set("website", e.target.value)} className={inp(false)} placeholder="https://yourcompany.com" />
          </div>
          <div>
            <Label hint="Year operations began">Operating Since</Label>
            <input type="number" value={form.operatingSince} onChange={e => set("operatingSince", e.target.value)} className={inp(false)} placeholder="e.g. 2015" />
          </div>
          <div>
            <Label hint="Number of customer reviews">Total Reviews</Label>
            <input type="number" value={form.totalReviews} onChange={e => set("totalReviews", e.target.value)} className={inp(false)} placeholder="0" />
          </div>
          <div>
            <Label hint="Total number of trips sold">Trips Sold</Label>
            <input type="number" value={form.tripsSold} onChange={e => set("tripsSold", e.target.value)} className={inp(false)} placeholder="0" />
          </div>
        </div>
      </SectionCard>

      {/* Tax IDs */}
      <SectionCard title="Tax Identifiers" icon={<FaFileInvoiceDollar className="w-4 h-4" />} delay={40}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label hint="15-character GST Identification Number">GSTIN</Label>
            <input value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())}
              className={inp(false) + " font-mono"} placeholder="Enter 15-character GSTIN" maxLength={15} />
          </div>
          <div>
            <Label hint="10-character Tax Deduction Account Number">TAN</Label>
            <input value={form.tan} onChange={e => set("tan", e.target.value.toUpperCase())}
              className={inp(false) + " font-mono"} placeholder="Enter 10-character TAN" maxLength={10} />
          </div>
          <div className="sm:col-span-2">
            <Label>GST / TCS Rates</Label>

            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 font-medium">
              <span>
                Tax rates are managed separately.
              </span>

              <button
                type="button"
                onClick={onOpenTax}
                className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline"
              >
                Manage in Tax Configuration →
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Branding */}
      <SectionCard title="Branding" icon={<FiUpload className="w-4 h-4" />} subtitle="Company logo and browser favicon" delay={80}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <Label hint="Max 2MB — JPG, PNG, SVG, GIF">Company Logo</Label>
            <input type="file" ref={logoRef} accept=".jpg,.jpeg,.png,.svg,.gif" className="hidden" onChange={e => handleFile(e, "logo")} />
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain p-1" />
                  : <span className="text-base font-extrabold text-slate-400">{initials(form.name)}</span>}
              </div>
              <button type="button" onClick={() => logoRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-300
                  hover:border-blue-400 text-slate-500 hover:text-blue-600 text-sm font-bold transition-all bg-white">
                <FiUpload className="w-4 h-4" /> Browse
              </button>
            </div>
          </div>
          {/* Favicon */}
          <div>
            <Label hint="ICO or PNG — 16×16 or 32×32 px recommended">Company Favicon</Label>
            <input type="file" ref={favRef} accept=".ico,.png" className="hidden" onChange={e => handleFile(e, "favicon")} />
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {faviconPreview
                  ? <img src={faviconPreview} alt="fav" className="w-8 h-8 object-contain" />
                  : <span className="text-xs font-bold text-slate-400">ICO</span>}
              </div>
              <button type="button" onClick={() => favRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-300
                  hover:border-blue-400 text-slate-500 hover:text-blue-600 text-sm font-bold transition-all bg-white">
                <FiUpload className="w-4 h-4" /> Browse
              </button>
            </div>
            {faviconPreview && <p className="text-xs text-slate-500 mt-2 font-medium">→ Current favicon</p>}
          </div>
        </div>
      </SectionCard>

      {/* Address */}
      <SectionCard title="Address & Location" icon={<FiMapPin className="w-4 h-4" />} delay={120}>
        <div className="space-y-4">
          <div>
            <Label>Full Address</Label>
            <textarea rows={3} value={form.address} onChange={e => set("address", e.target.value)}
              className={inp(false) + " resize-none"} placeholder="Street, City, PIN Code" />
          </div>
          <div>
            <Label required hint="Required for GST invoice CGST/SGST/IGST determination">State</Label>
            <div className="relative">
              <select value={form.state} onChange={e => set("state", e.target.value)}
                className={inp(errs.state) + " pr-9 appearance-none cursor-pointer"}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <ErrMsg f="state" />
          </div>
        </div>
      </SectionCard>

      {/* Submit row */}
      <div className="bg-white/80 rounded-2xl border border-slate-200/60 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl
              bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm
              shadow-md shadow-blue-200 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Updating Profile…</>
              : <><FiSave className="w-4 h-4" />Update Profile</>}
          </button>
          <button type="button" disabled={saving}
            onClick={() => { setForm({ name: company.name, prefix: company.prefix, email: company.email, website: company.website || "", phone: company.phone, operatingSince: company.operatingSince, totalReviews: company.totalReviews, tripsSold: company.tripsSold || 0, gstin: company.gstin || "", tan: company.tan || "", address: company.address || "", state: company.state || "" }); setErrs({}); showToast("Form reset to saved values."); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-red-100
              hover:border-red-200 text-red-400 hover:text-red-600 font-bold text-sm transition-all bg-white hover:bg-red-50 disabled:opacity-40">
            <FiRefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">
          Fields marked <span className="text-red-500 font-bold">*</span> are required. Company Name, Prefix, Email, and State are mandatory.
        </p>
      </div>

      <AdminSettings />
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 3 — BUSINESS INFO
══════════════════════════════════════════════════════════════ */
function BusinessInfoTab({ company }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Business Details" icon={<MdBusinessCenter className="w-4 h-4" />} delay={0}>
        <InfoRow label="Operating Since" value={company.operatingSince} />
        <InfoRow label="Total Reviews" value={company.totalReviews} />
        <InfoRow label="Trips Sold" value={company.tripsSold || 0} />
        <InfoRow label="GSTIN" value={company.gstin || "—"} />
        <InfoRow label="TAN" value={company.tan || "Not provided"} />
        <InfoRow
          label="Tax Rates"
          value="View Tax Configuration"
        />
        <InfoRow label="Website" value={company.website} href={company.website} />
      </SectionCard>
      <AdminSettings />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 4 — ADDRESS
══════════════════════════════════════════════════════════════ */
function AddressTab({ company }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Company Address" icon={<FiMapPin className="w-4 h-4" />} delay={0}>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
          <p className="text-sm text-slate-700 font-medium whitespace-pre-line leading-relaxed">{company.address || "No address configured."}</p>
          {company.state && (
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-200">
              <MdLocationCity className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">State: {company.state}</span>
            </div>
          )}
        </div>
        {/* Info banner — matches your CRM style */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl px-4 py-3 flex items-center gap-3">
          <FiInfo className="w-4 h-4 text-white flex-shrink-0" />
          <p className="text-sm text-white font-medium">Map integration will be available in future updates.</p>
        </div>
      </SectionCard>
      <AdminSettings />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 5 — TAX CONFIGURATION
══════════════════════════════════════════════════════════════ */
function TaxConfigTab({ showToast, canManage }) {
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState({ type: "", rate: "", calculation: "Additive", effectiveFrom: "", description: "" });
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState(null);
  const setF = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrs(p => ({ ...p, [k]: "" })); };

  useEffect(() => {
    loadTaxRates();
  }, []);

  const loadTaxRates = async () => {
    try {
      const res =
        await taxRateService.getAll();

      // Unwrap ApiResponse envelope ({ data: [...] }).
      setRates(res.data?.data ?? res.data ?? []);
    } catch {
      showToast(
        "Failed to load tax rates",
        "error"
      );
    }
  };

  const validate = () => {
    const e = {};
    if (!form.type) e.type = "Required";
    if (!form.rate && form.rate !== "0") e.rate = "Required";
    if (isNaN(form.rate) || Number(form.rate) < 0) e.rate = "Must be ≥ 0";
    if (!form.effectiveFrom) e.effectiveFrom = "Required";
    return e;
  };

  const handleAdd = async () => {
    const e = validate();

    if (Object.keys(e).length) {
      setErrs(e);
      return;
    }

    setSaving(true);

    try {
      const res =
        await taxRateService.create(form);

      setRates((prev) => [
        ...prev,
        res.data?.data ?? res.data,
      ]);

      setForm({
        type: "",
        rate: "",
        calculation: "Additive",
        effectiveFrom: "",
        description: "",
      });

      showToast(
        "Tax rate added successfully"
      );
    } catch (err) {
      showToast(
        err?.response?.data?.message ||
        "Failed to add tax rate",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (id) => {
    try {
      await taxRateService.delete(id);

      setRates((prev) =>
        prev.filter((r) => r.id !== id)
      );

      setDelId(null);

      showToast("Tax rate removed");
    } catch {
      showToast(
        "Failed to delete tax rate",
        "error"
      );
    }
  };

  const ErrMsg = ({ f }) => errs[f] ? <p className="mt-1 text-xs text-red-500">{errs[f]}</p> : null;

  return (
    <div className="space-y-5">
      {/* Active rates */}
      <SectionCard title="Active Tax Rates" icon={<FaFileInvoiceDollar className="w-4 h-4" />} delay={0}>
        {rates.length === 0 ? (
          <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl px-4 py-3 flex items-center gap-3">
            <FiInfo className="w-4 h-4 text-white flex-shrink-0" />
            <p className="text-sm text-white font-medium">
              {canManage
                ? "No active tax rates configured. Add a new rate below."
                : "No active tax rates configured."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rates.map((r, i) => (
              <div key={r.id ?? `rate-${i}`} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 group">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full flex-shrink-0
                    ${r.type === "GST" ? "bg-blue-100 text-blue-700" : r.type === "TCS" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>
                    {r.type}
                  </span>
                  <span className="text-sm font-extrabold text-slate-800">{r.rate}%</span>
                  <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{r.calculation}</span>
                  {r.effectiveFrom && <span className="text-xs text-slate-400">From {r.effectiveFrom}</span>}
                  {r.description && <span className="text-xs text-slate-400 italic truncate">{r.description}</span>}
                </div>
                {canManage && (delId === r.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs font-bold text-red-600 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-all"
                    >
                      Delete
                    </button>
                    <button onClick={() => setDelId(null)}
                      className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDelId(r.id)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50
                      flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Add new — SETTINGS_MANAGE only; POST /api/tax-rates rejects everyone else. */}
      {canManage && (
        <SectionCard title="Add New Tax Rate" icon={<FiPlus className="w-4 h-4" />} delay={40}>
          {/* Warning */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <FiAlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Adding a new rate will automatically close the previous active rate of the same type
              (effective 1 day before the new rate starts). Existing bookings are not affected.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <Label required>Tax Type</Label>
              <div className="relative">
                <select value={form.type} onChange={e => setF("type", e.target.value)}
                  className={inp(errs.type) + " pr-9 appearance-none cursor-pointer"}>
                  <option value="">Select…</option>
                  {TAX_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <ErrMsg f="type" />
            </div>
            <div>
              <Label required>Rate (%)</Label>
              <input type="number" step="0.01" min="0" value={form.rate} onChange={e => setF("rate", e.target.value)}
                className={inp(errs.rate) + " font-mono"} placeholder="e.g. 5.00" />
              <ErrMsg f="rate" />
            </div>
            <div>
              <Label required>Calculation</Label>
              <div className="relative">
                <select value={form.calculation} onChange={e => setF("calculation", e.target.value)}
                  className={inp(false) + " pr-9 appearance-none cursor-pointer"}>
                  {CALCULATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Charged on top of amount</p>
            </div>
            <div>
              <Label required>Effective From</Label>
              <input type="date" value={form.effectiveFrom} onChange={e => setF("effectiveFrom", e.target.value)}
                className={inp(errs.effectiveFrom)} />
              <ErrMsg f="effectiveFrom" />
            </div>
            <div>
              <Label>Description</Label>
              <input value={form.description} onChange={e => setF("description", e.target.value)}
                className={inp(false)} placeholder="e.g. Budget 2026" />
            </div>
          </div>

          <button type="button" onClick={handleAdd} disabled={saving}
            className="mt-5 flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
            text-white font-bold text-sm shadow-md shadow-blue-200 transition-all disabled:opacity-60">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <FiPlus className="w-4 h-4" />}
            Add Tax Rate
          </button>
        </SectionCard>
      )}

      <AdminSettings />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function CompanyProfile() {
  const navigate = useNavigate();
  // Viewable by every tenant user; only SETTINGS_MANAGE holders see the write affordances.
  const canManage = hasPermission(P.SETTINGS_MANAGE);
  const visibleTabs = TABS.filter(t => canManage || !t.manageOnly);
  const [activeTab, setActiveTab] = useState("overview");
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [aiCredits, setAiCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState(null);


  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  const loadCompanyProfile =
    useCallback(async () => {
      setLoading(true);
      setLoadError("");

      const [
        companyResult,
        subscriptionResult,
        aiCreditsResult,
      ] = await Promise.allSettled([
        companyService.get(),
        companyService.getSubscription(),
        companyService.getAiCredits(),
      ]);

      try {
        const unwrap = (response) => {
          if (
            response?.data &&
            typeof response.data ===
            "object" &&
            "data" in response.data
          ) {
            return response.data.data;
          }

          return response?.data;
        };

        if (
          companyResult.status ===
          "rejected"
        ) {
          throw companyResult.reason;
        }

        const companyData = unwrap(
          companyResult.value
        );

        if (
          !companyData ||
          typeof companyData !== "object"
        ) {
          throw new Error(
            "Company profile data was not returned by the server."
          );
        }

        setCompany({
          ...EMPTY_COMPANY,
          ...companyData,
        });

        if (
          subscriptionResult.status ===
          "fulfilled"
        ) {
          setSubscription(
            unwrap(
              subscriptionResult.value
            ) ?? null
          );
        } else {
          setSubscription(null);

          console.error(
            "Failed to load subscription:",
            subscriptionResult.reason
          );
        }

        if (
          aiCreditsResult.status ===
          "fulfilled"
        ) {
          setAiCredits(
            unwrap(
              aiCreditsResult.value
            ) ?? null
          );
        } else {
          setAiCredits(null);

          console.error(
            "Failed to load AI credits:",
            aiCreditsResult.reason
          );
        }
      } catch (error) {
        console.error(
          "Failed to load company profile:",
          error
        );

        setCompany(null);
        setSubscription(null);
        setAiCredits(null);

        setLoadError(
          error?.response?.data?.message ||
          error?.message ||
          "Failed to load company profile."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadCompanyProfile();
  }, [loadCompanyProfile]);



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── PAGE HEADER — same structure as Customers / Reminders ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200 flex-shrink-0 overflow-hidden">
                <div className="absolute inset-x-0 -top-1/2 h-full bg-gradient-to-b from-white/25 to-transparent opacity-60" />
                <FaBuilding className="relative w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Company Profile
                  {company?.prefix && (
                    <span className="hidden sm:inline text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                      {company.prefix}
                    </span>
                  )}
                  {!canManage && (
                    <span className="hidden sm:inline text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                      View only
                    </span>
                  )}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {canManage
                    ? "Manage company details, branding, address & tax configuration"
                    : "Company details, branding, address & tax configuration"}
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/Settings")}>Settings</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Company Profile</span>
                  </span>
                </p>
              </div>
            </div>
            {canManage && company && !loadError && (
              <button onClick={() => setActiveTab("edit")}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold
                  shadow-md shadow-blue-200 hover:shadow-lg transition-all w-full sm:w-auto">
                <FiEdit2 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Skeleton */}
        {loading && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-72 space-y-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>

            <div className="flex-1 space-y-4">
              <SkeletonCard />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(4)].map((_, index) => (
                  <div
                    key={index}
                    className="h-28 bg-slate-200/60 rounded-2xl animate-pulse"
                  />
                ))}
              </div>

              <SkeletonCard />
            </div>
          </div>
        )}

        {/* Company loading error */}
        {!loading && loadError && (
          <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <FiAlertCircle className="w-5 h-5" />
              </div>

              <div className="flex-1">
                <h2 className="text-base font-extrabold text-slate-800">
                  Unable to load company profile
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {loadError}
                </p>

                <button
                  type="button"
                  onClick={loadCompanyProfile}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real company content */}
        {!loading && company && !loadError && (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* LEFT SIDEBAR */}
            <Sidebar
              company={company}
              subscription={subscription}
              aiCredits={aiCredits}
            />

            {/* RIGHT CONTENT */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* TAB BAR — scrollable pill style */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm fade-up p-1.5">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-1">
                    {visibleTabs.map(tab => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all
                          ${activeTab === tab.id
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* TAB CONTENT */}
              {activeTab === "overview" && <OverviewTab company={company} aiCredits={aiCredits} />}
              {activeTab === "edit" &&
                canManage && (
                  <EditProfileTab
                    company={company}
                    onSave={setCompany}
                    showToast={showToast}
                    onOpenTax={() =>
                      setActiveTab("tax")
                    }
                  />
                )}
              {activeTab === "business" && <BusinessInfoTab company={company} />}
              {activeTab === "address" && <AddressTab company={company} />}
              {activeTab === "tax" && <TaxConfigTab showToast={showToast} canManage={canManage} />}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}