import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  companyService,
  taxRateService,
} from "@features/settings";
import { hasPermission, P } from "@shared/lib/access";
import { SOCIAL_NETWORKS, EMPTY_SOCIAL, connectedSocials } from "../lib/socialNetworks";
import GoogleReviewsTab from "../components/GoogleReviewsTab";
import BusinessListingRows from "../components/BusinessListingRows";
import { toListingRows, toListingsPayload, savedListings } from "../lib/businessListings";
import SignatureSection from "../components/SignatureSection";
import { googleReviewsService } from "../api/googleReviewsService";

/* Copy for the two OAuth failures the server can name. Anything else falls back to the generic
   line, so the backend can add reasons without a frontend release.

   `app_not_approved` deserves its own message because it is not a fault the user can fix by
   retrying — their Google account has to be added to the app's test-user list first. Note that
   while the OAuth app sits in Google's Testing status this message will rarely be SEEN: a
   non-whitelisted account is stopped on Google's own error page and never returns here. The
   pre-flight warning on the connect panel is what actually covers that case; this is the safety
   net for the paths where Google does redirect back. */
const GOOGLE_OAUTH_ERRORS = {
  access_denied:
    "Google sign-in was not completed, so nothing has been connected. If you did not cancel, your "
    + "Google account may not be approved for this app yet — check with your administrator.",
  app_not_approved:
    "Your Google account is not on this app's approved list yet. Send your Google email address to "
    + "your administrator, then try connecting again once they confirm.",
};
import { Pen as FiEdit2, Save as FiSave, MapPin as FiMapPin, Calendar as FiCalendar, Key as FiKey, ChevronDown as FiChevronDown, Upload as FiUpload, Plus as FiPlus, Trash2 as FiTrash2, TriangleAlert as FiAlertTriangle, Info as FiInfo, CircleCheck as FiCheckCircle, RefreshCw as FiRefreshCw, ExternalLink as FiExternalLink, Share2 as FiShare2, CircleAlert as FiAlertCircle, Building2 as FaBuilding, ReceiptText as FaFileInvoiceDollar, Crown as FaCrown, BriefcaseBusiness as MdBusinessCenter, Building as MdLocationCity } from "lucide-react";


/* ─── EMPTY COMPANY STATE ───────────────────────────────────── */
const EMPTY_COMPANY = {
  ...EMPTY_SOCIAL,
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
// /subscription and /api/tax-rates to any authenticated user. Writes need
// SETTINGS_MANAGE, so the "edit" tab is filtered out for everyone else rather than
// offering them a Save button that would 403.
const TABS = [
  { id: "overview", label: "Company Details", manageOnly: false },
  { id: "edit", label: "Edit Profile", manageOnly: true },
  { id: "business", label: "Business Info", manageOnly: false },
  { id: "address", label: "Address", manageOnly: false },
  { id: "tax", label: "Tax Configuration", manageOnly: false },
  /* manageOnly: false, like the other read tabs. Every tenant user may SEE whose signature goes
     on the quotations they send; only SETTINGS_MANAGE may change it, and that is gated inside the
     section on canManage rather than by hiding the tab.
     Its own tab rather than a card inside Edit Profile: that tab is one big <form>, so a section
     living inside it would be one missing type="button" away from submitting the company profile —
     the payload that feeds the quotation PDF header. Edit Profile is also manageOnly, which would
     put the signature out of reach of the read-only users who are supposed to see it. */
  { id: "signature", label: "Signature", manageOnly: false },
  /* manageOnly: false — READING reviews is something any tenant user should be able to do, the
     same as the other read tabs. Connecting an account and replying are gated inside the tab on
     `canManage`, because those write to the company's public Google presence. */
  { id: "reviews", label: "Google Reviews", manageOnly: false },
];

/* ─── HELPERS ────────────────────────────────────────────────── */
// (name || "") — NOT a `= ""` default: a default only fires on `undefined`, and this page is exactly
// where a company name is still null, because it is the page you open to set it.
const initials = (name) =>
  (name || "").trim().split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "CO";

/* Plan module keys arrive as backend enum names ("HOTEL_MARKETPLACE"). Title-cased here rather than
   kept in a hand-written map: a map goes stale the moment a module is added server-side, and
   "Hotel Marketplace" is worth more than the two keys a map would render slightly prettier. */
const moduleLabel = (key) =>
  String(key || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/* Subscription status to badge tone. This was a hardcoded emerald pill, so PAST_DUE and SUSPENDED —
   the two states an owner most needs to notice — rendered as healthy green. */
const SUB_STATUS_TONE = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIAL: "bg-blue-100 text-blue-700",
  PAST_DUE: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-red-100 text-red-700",
  EXPIRED: "bg-red-100 text-red-700",
};

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
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${SUB_STATUS_TONE[subscription?.status] || "bg-slate-100 text-slate-600"}`}>
                {subscription?.status || "—"}
              </span>
            </div>
            <div className="py-2">
              <span className="text-xs text-slate-500 font-medium">Features</span>
              {/* The tenant's real module list. This read "All Core Features" for every tenant on
                  every plan — the one line on the card that could never be wrong and never told
                  anyone anything, while /company/subscription had been returning the actual keys
                  all along. */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {subscription?.features?.length
                  ? subscription.features.map((key) => (
                    <span key={key} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FiCheckCircle className="w-3 h-3" /> {moduleLabel(key)}
                    </span>
                  ))
                  : <span className="text-xs text-slate-400">No modules enabled on this plan</span>}
              </div>
            </div>
          </div>
          {/* daysLeft is null when the plan carries no end date, and this rendered a bare
              " days remaining" with nothing in front of it. Nothing to count means nothing to say. */}
          {subscription?.daysLeft != null && (
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold
              ${subscription.daysLeft <= 7
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-slate-50 border-slate-200 text-slate-600"}`}>
              <FiCalendar className="w-3 h-3 flex-shrink-0" />
              {subscription.daysLeft} day{subscription.daysLeft !== 1 ? "s" : ""} remaining
            </div>
          )}
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
}) {
  return (
    <div className="space-y-5">
      {/* Stat cards — same system as Customers.jsx */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { icon: "⭐", label: "Total Reviews", value: company.totalReviews, gradient: "from-amber-500 to-orange-500", delay: 0 },
          { icon: "✈️", label: "Trips Sold", value: company.tripsSold || 0, gradient: "from-blue-600 to-blue-700", delay: 60 },
          { icon: "📅", label: "Operating Since", value: company.operatingSince, gradient: "from-teal-500 to-teal-600", delay: 120 },
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

      {/* ── Social Media ─────────────────────────────────────────────────────────────────────
          Only the networks actually filled in, as tiles that open. A row per network with "—"
          against the four nobody set up says less than two tiles that work, and it makes the card
          look like a form rather than a summary. The whole card is hidden while none are set, with
          one line pointing at where to add them — an empty card is a dead end. */}
      <SectionCard
        title="Social Media & Listings"
        icon={<FiShare2 className="w-4 h-4" />}
        subtitle="Where customers can find and message you"
        delay={90}
      >
        {connectedSocials(company).length === 0 ? (
          <p className="text-sm text-slate-400">
            No social accounts added yet — add them under{" "}
            <span className="font-semibold text-slate-500">Edit Profile → Social Media &amp; Listings</span>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {connectedSocials(company).map(({ key, label, Icon, tone, url, display }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-all hover:border-blue-300 hover:shadow-sm"
              >
                <span className={`flex-shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
                  <span className="block truncate text-sm font-semibold text-slate-800">{display}</span>
                </span>
                <FiExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-blue-500" />
              </a>
            ))}
          </div>
        )}

        {/* Directory listings, below the social tiles and visually separated — same reason as in
            the editor: found-on rather than followed-on. Rendered only when there are any; a
            heading over nothing is worse than no heading. The LABEL leads, because on a page of
            near-identical directory URLs "Lucknow branch" is the only part anyone can read. */}
        {savedListings(company).length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Business Listings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedListings(company).map(({ url, display, label, platformLabel, Icon, tone }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-all hover:border-blue-300 hover:shadow-sm"
                >
                  <span className={`flex-shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      {/* The user's own label leads; the directory name is the fallback when they
                          did not give one. */}
                      {label || platformLabel}
                    </span>
                    <span className="block truncate text-sm font-semibold text-slate-800">{display}</span>
                  </span>
                  <FiExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-blue-500" />
                </a>
              ))}
            </div>
          </div>
        )}
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
  // Whether a Google Business Profile owns the review count — see the Total Reviews field below.
  googleConnected = false,
  onOpenReviews,
}) {
  const [form, setForm] = useState({
    name: company.name, prefix: company.prefix, email: company.email,
    website: company.website || "", phone: company.phone,
    operatingSince: company.operatingSince, totalReviews: company.totalReviews,
    tripsSold: company.tripsSold || 0, gstin: company.gstin || "",
    tan: company.tan || "", address: company.address || "", state: company.state || "",
    // Every social key is seeded from EMPTY_SOCIAL first, so a company saved before these existed
    // still gets "" rather than undefined — an undefined value would flip the input to uncontrolled
    // on first render and React would warn the moment anyone typed into it.
    ...EMPTY_SOCIAL,
    ...Object.fromEntries(
      SOCIAL_NETWORKS.map((n) => [n.field, company[n.field] || ""])
    ),
    /* Directory listings are a LIST, not a field per platform — a branch in another city gets
       its own Justdial page, and one column could never hold three. toListingRows tolerates the
       field being absent entirely, which it is on every company saved before this existed. */
    businessListings: toListingRows(company.businessListings),
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
    // Social links are all optional, so only a value that was actually typed is checked. Only
    // WhatsApp carries a rule — the rest accept a handle or a URL and normalise on blur, and there
    // is no shape of text that is wrong enough to block a save over.
    SOCIAL_NETWORKS.forEach((n) => {
      const value = String(form[n.field] || "").trim();
      if (!value || !n.validate) return;
      const message = n.validate(value);
      if (message) e[n.field] = message;
    });
    return e;
  };

  /* Normalise on BLUR, not on save.
     "@nepaltours" becomes https://instagram.com/nepaltours in the box the moment focus leaves it,
     so what gets stored is visible and still editable. Doing it silently at submit would show one
     thing on screen and put another in the database. */
  const normaliseSocial = (network) => {
    const current = String(form[network.field] || "").trim();
    if (!current) return;
    const next = network.normalise(current);
    if (next && next !== current) set(network.field, next);
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

      /* businessListings is transformed on the way out: rows carry a client-side `rowId` for
         React keys which is not data, and a row someone added and abandoned has no URL and is
         not a listing. Everything else in `form` is sent exactly as before. */
      const res = await companyService.update({
        ...form,
        businessListings: toListingsPayload(form.businessListings),
      });
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
          {/* ── Total Reviews ────────────────────────────────────────────────────────────────
              Read-only once Google is connected. This field and the Google Reviews tab both claim
              to be "the number of reviews", on the same page, and once Google is the live source
              the typed number is guaranteed to be stale — it was someone's estimate on some past
              afternoon. Two different figures under the same label is worse than one.

              DISABLED, not hidden: the saved value stays visible, so nobody wonders where their
              number went, and it comes straight back if Google is disconnected. The value is also
              still submitted, because it is a real column and blanking it on save would destroy
              data for anyone who later disconnects. */}
          <div>
            <Label hint={googleConnected
              ? "Managed by your connected Google Business Profile"
              : "Number of customer reviews"}>
              Total Reviews
            </Label>
            <input
              type="number"
              value={form.totalReviews}
              onChange={e => set("totalReviews", e.target.value)}
              disabled={googleConnected}
              className={inp(false) + (googleConnected ? " bg-slate-50 text-slate-500 cursor-not-allowed" : "")}
              placeholder="0"
            />
            {googleConnected && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Google is connected, so the live count is shown on the{" "}
                <button type="button" onClick={onOpenReviews}
                  className="font-semibold text-blue-600 hover:underline">
                  Google Reviews
                </button>{" "}
                tab. Disconnect there to edit this by hand again.
              </p>
            )}
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

      {/* ── Social Media ─────────────────────────────────────────────────────────────────────
          Sits after Branding because that is what it is: the company's public face, alongside the
          logo and favicon rather than among the tax identifiers.

          Every field is OPTIONAL and every one accepts a handle or a full URL — an agent should not
          have to remember which. The value is normalised into a real link when the field loses
          focus, so what is stored is what is shown. */}
      <SectionCard
        title="Social Media & Listings"
        icon={<FiShare2 className="w-4 h-4" />}
        subtitle="Where customers can find and message you — shown on quotations and web links"
        delay={100}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SOCIAL_NETWORKS.map(({ key, field, label, Icon, tone, placeholder, hint, normalise }) => {
            const url = normalise(form[field]);
            return (
              <div key={key}>
                <Label hint={hint}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${tone}`} />
                    {label}
                  </span>
                </Label>
                <input
                  value={form[field] || ""}
                  onChange={(e) => set(field, e.target.value)}
                  onBlur={() => normaliseSocial(SOCIAL_NETWORKS.find((n) => n.field === field))}
                  className={inp(errs[field])}
                  placeholder={placeholder}
                  inputMode={key === "whatsapp" ? "tel" : "url"}
                  autoComplete="off"
                />
                <ErrMsg f={field} />
                {/* The finished link, live. It is the only way to tell a typo from a working
                    address before saving — and for WhatsApp it is the wa.me number that will
                    actually be dialled, which is not obvious from "+91 98765 43210". */}
                {!errs[field] && url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 break-all"
                  >
                    {url.replace(/^https?:\/\//i, "")}
                    <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Business listings ──────────────────────────────────────────────────────────────
            Separated by a rule because it answers a different question from the fields above.
            Those are accounts customers FOLLOW you on, one per company. These are directories they
            FIND you on — and an agency with branches has one listing per city, which is why this is
            a repeatable list rather than a field per platform. */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <Label hint="Directories where customers find you — add one row per listing">
            <span className="inline-flex items-center gap-2">
              <FiShare2 className="w-4 h-4 text-slate-400" />
              Business Listings
            </span>
          </Label>
          <div className="mt-3">
            <BusinessListingRows
              rows={form.businessListings || []}
              onChange={(rows) => set("businessListings", rows)}
            />
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
            onClick={() => { setForm({ name: company.name, prefix: company.prefix, email: company.email, website: company.website || "", phone: company.phone, operatingSince: company.operatingSince, totalReviews: company.totalReviews, tripsSold: company.tripsSold || 0, gstin: company.gstin || "", tan: company.tan || "", address: company.address || "", state: company.state || "", ...EMPTY_SOCIAL, ...Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.field, company[n.field] || ""])), businessListings: toListingRows(company.businessListings) }); setErrs({}); showToast("Form reset to saved values."); }}
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
function BusinessInfoTab({ company, onOpenTax }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Business Details" icon={<MdBusinessCenter className="w-4 h-4" />} delay={0}>
        <InfoRow label="Operating Since" value={company.operatingSince} />
        <InfoRow label="Total Reviews" value={company.totalReviews} />
        <InfoRow label="Trips Sold" value={company.tripsSold || 0} />
        <InfoRow label="GSTIN" value={company.gstin || "—"} />
        <InfoRow label="TAN" value={company.tan || "Not provided"} />
        {/* Was a static "View Tax Configuration" string that did nothing. The row exists to get
            someone to the rates, so it is now the button it was pretending to be. */}
        <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex-shrink-0 w-32 pt-0.5">Tax Rates</span>
          <button type="button" onClick={onOpenTax}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Open Tax Configuration
          </button>
        </div>
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
  const [searchParams, setSearchParams] = useSearchParams();

  /* The active tab is seeded from ?tab= — LAZILY, in the useState initialiser, so the right tab is
     chosen on the very first render. Doing it in an effect would paint Company Details first and
     then jump, and would be a synchronous setState in an effect, which this repo lints against.

     Validated against visibleTabs, not TABS: ?tab=edit must not hand a manage-only tab to a user
     without SETTINGS_MANAGE. Deep-linking a tab is a convenience; it is not a way around a
     permission check.

     This exists because of the OAuth round trip. Google sends the user to
     /CompanyProfile?tab=reviews&googleConnected=1, and without this they landed on Company Details
     with nothing acknowledging what had just happened — at the single most important moment in the
     feature. Every tab gets shareable URLs as a side effect. */
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get("tab");
    return visibleTabs.some(t => t.id === requested) ? requested : "overview";
  });

  /* Whether a Google Business Profile is connected — one boolean, not the reviews state.
     It lives up here for one reason: the tab that knows the answer is CONDITIONALLY MOUNTED, so a
     callback from it alone can never inform the Edit Profile tab of a user who never opened
     Reviews. See the getConnection call in loadCompanyProfile. */
  const [googleConnected, setGoogleConnected] = useState(false);

  /* Tab changes mirror into the URL so the address bar always describes what is on screen and a
     link can be shared. `replace`, not push: a tab is not a destination the user thinks of as
     history, and pushing would turn Back into "walk backwards through tabs" instead of "leave this
     page", which is what people expect from a settings screen. */
  const selectTab = useCallback((id) => {
    setActiveTab(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      // Stale one-shot params must not survive a tab change and re-fire on refresh.
      next.delete("googleConnected");
      next.delete("googleError");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState(null);


  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  const loadCompanyProfile =
    useCallback(async () => {
      setLoading(true);
      setLoadError("");

      /* googleConnection joins the existing batch rather than being fetched separately.
         The Edit Profile tab needs to know whether Google owns the review count, and it can be
         opened without ever visiting the Reviews tab — which is conditionally mounted, so no
         callback from it would have fired. One boolean, resolved before either tab renders.

         It costs one request to OUR OWN server reading OUR OWN database. It does not touch Google
         and consumes none of the Business Profile quota — that is only spent on an explicit sync.
         allSettled already tolerates a rejection, so a 404 while the endpoints are undeployed is
         handled by the existing shape. */
      const [
        companyResult,
        subscriptionResult,
        googleConnectionResult,
      ] = await Promise.allSettled([
        companyService.get(),
        companyService.getSubscription(),
        googleReviewsService.getConnection(),
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

        /* Silent on failure, by design. A rejection here means the endpoints are not deployed yet
           — the expected state until the backend ships — and it must not be logged as an error or
           surfaced, because the Reviews tab already explains that situation properly. False simply
           leaves the manual Total Reviews field editable, which is the pre-Google behaviour.
           CONNECTED only: a revoked token (NEEDS_RECONNECT) is not a live source of truth for the
           review count, so the manual field stays editable in that state. */
        if (googleConnectionResult.status === "fulfilled") {
          const conn = unwrap(googleConnectionResult.value) || {};
          const connStatus = conn.status || (conn.connected ? "CONNECTED" : "NOT_CONNECTED");
          setGoogleConnected(connStatus === "CONNECTED");
        } else {
          setGoogleConnected(false);
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

  /* ── OAuth return ────────────────────────────────────────────────────────────────────────────
     The server bounces the browser back here after the Google round trip, carrying either
     googleConnected=1 or googleError=<reason>. Before this, both were ignored entirely: the user
     completed a consent flow and arrived at a page that said nothing at all about it.

     The params are ONE-SHOT — stripped immediately after they are read, so a refresh (or the
     browser restoring the tab tomorrow) does not replay "Connected!" over a connection that may
     since have been removed. The tab itself is left in the URL.

     Started from a microtask rather than run in the effect body: showToast and setSearchParams are
     both state writes, and this repo lints react-hooks/set-state-in-effect. */
  useEffect(() => {
    const connected = searchParams.get("googleConnected");
    const error = searchParams.get("googleError");
    if (!connected && !error) return undefined;

    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      if (connected) {
        showToast("Google Business Profile connected. Loading your reviews…");
        // The connection changed, so the Edit Profile field must lock without a page reload.
        setGoogleConnected(true);
      } else {
        showToast(
          GOOGLE_OAUTH_ERRORS[error]
          || "Google sign-in didn't complete, so nothing has been connected. Please try again.",
          "error"
        );
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("googleConnected");
        next.delete("googleError");
        return next;
      }, { replace: true });
    });

    return () => { alive = false; };
  }, [searchParams, setSearchParams, showToast]);



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
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/CompanySettings")}>Settings</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Company Profile</span>
                  </span>
                </p>
              </div>
            </div>
            {canManage && company && !loadError && (
              <button onClick={() => selectTab("edit")}
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
            />

            {/* RIGHT CONTENT */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* TAB BAR — scrollable pill style */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm fade-up p-1.5">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-1">
                    {visibleTabs.map(tab => (
                      <button key={tab.id} onClick={() => selectTab(tab.id)}
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
              {activeTab === "overview" && <OverviewTab company={company} />}
              {activeTab === "edit" &&
                canManage && (
                  <EditProfileTab
                    company={company}
                    onSave={setCompany}
                    showToast={showToast}
                    onOpenTax={() =>
                      selectTab("tax")
                    }
                    googleConnected={googleConnected}
                    onOpenReviews={() => selectTab("reviews")}
                  />
                )}
              {activeTab === "business" && <BusinessInfoTab company={company} onOpenTax={() => selectTab("tax")} />}
              {activeTab === "address" && <AddressTab company={company} />}
              {activeTab === "tax" && <TaxConfigTab showToast={showToast} canManage={canManage} />}
              {/* SectionCard is passed down rather than re-declared in the tab: it carries this
                  page's card chrome (the gradient icon tile, the fade-up animation, the exact
                  border and blur), and a second copy would drift from it the first time either is
                  touched. */}
              {/* The SectionCard note above applies here too. companyName is read-only: the
                  section holds its own state, calls only signatureService, and never touches the
                  company form object or companyService.update() — the payload the quotation PDF
                  header is rendered from. */}
              {activeTab === "signature" && (
                <SignatureSection
                  showToast={showToast}
                  canManage={canManage}
                  SectionCard={SectionCard}
                  companyName={company?.name}
                />
              )}
              {/* onConnectionChange keeps the Edit Profile field in step when the user connects or
                  disconnects while this page is open — the page-load fetch alone would go stale the
                  moment they act. It carries a boolean, not the reviews state: the summary, the
                  list, the filters and the composer all stay inside the tab. */}
              {activeTab === "reviews" && (
                <GoogleReviewsTab
                  showToast={showToast}
                  canManage={canManage}
                  SectionCard={SectionCard}
                  onConnectionChange={setGoogleConnected}
                />
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}