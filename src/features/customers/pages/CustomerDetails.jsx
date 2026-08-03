import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CakeSlice,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Crown,
  FileText,
  History,
  IdCard,
  IndianRupee,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plane,
  Plus,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";

import { WhatsAppIcon } from "@shared/ui/WhatsAppIcon";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import customerService from "../api/customerService";

const unwrap = (response) => response?.data?.data ?? response?.data;

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value, fallback = "Not available") => {
  if (!value) return fallback;
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const titleCase = (value) =>
  value
    ? String(value)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not set";

const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CU";

const maskIdentifier = (value, visible = 4) => {
  const clean = String(value || "").trim();
  if (!clean) return "Not provided";
  if (clean.length <= visible) return "••••";
  return `${"•".repeat(Math.min(8, clean.length - visible))}${clean.slice(-visible)}`;
};

const STATUS_STYLE = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
};

const STATUS_DOT = {
  ACTIVE: "bg-emerald-500",
  INACTIVE: "bg-slate-400",
  BLOCKED: "bg-rose-500",
};

const TYPE_STYLE = {
  INDIVIDUAL: "border-blue-200 bg-blue-50 text-blue-700",
  REGULAR: "border-teal-200 bg-teal-50 text-teal-700",
  CORPORATE: "border-indigo-200 bg-indigo-50 text-indigo-700",
  VIP: "border-violet-200 bg-violet-50 text-violet-700",
  GROUP: "border-cyan-200 bg-cyan-50 text-cyan-700",
  AGENT: "border-amber-200 bg-amber-50 text-amber-700",
};

const TIER_STYLE = {
  BRONZE: "border-orange-200 bg-orange-50 text-orange-700",
  SILVER: "border-slate-300 bg-slate-100 text-slate-700",
  GOLD: "border-amber-200 bg-amber-50 text-amber-700",
  PLATINUM: "border-slate-700 bg-slate-800 text-white",
};

const BOOKING_STATUS_STYLE = {
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REFUNDED: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

const keyOf = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "_");

function Badge({ children, className, dotClass }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      {dotClass && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {children}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, helper, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-xl font-extrabold text-slate-900 sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DetailItem({ icon: Icon, label, value, href, wide = false }) {
  const content = value || "Not provided";
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-xl bg-slate-50/80 px-3.5 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        {href && value ? (
          <a href={href} className="mt-1 block break-words text-sm font-semibold text-blue-700 hover:underline">
            {content}
          </a>
        ) : (
          <p className={`mt-1 break-words text-sm font-semibold ${value ? "text-slate-700" : "text-slate-400"}`}>
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

function BookingStatus({ status }) {
  const statusKey = keyOf(status) || "PENDING";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${BOOKING_STATUS_STYLE[statusKey] || "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>
      {titleCase(statusKey)}
    </span>
  );
}

function LoadingPage() {
  return (
    <div className="mx-auto max-w-[1440px] animate-pulse px-4 py-6 sm:px-6">
      <div className="h-7 w-48 rounded bg-slate-200" />
      <div className="mt-5 h-48 rounded-3xl bg-white" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl bg-white" />)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="h-80 rounded-2xl bg-white lg:col-span-2" />
        <div className="h-80 rounded-2xl bg-white" />
      </div>
    </div>
  );
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const actionMenuRef = useRef(null);

  const [customer, setCustomer] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadingBookings, setLoadingBookings] = useState(Boolean(id));
  const [profileError, setProfileError] = useState(id ? "" : "Customer link is invalid.");
  const [bookingError, setBookingError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [updating, setUpdating] = useState("");

  const canEdit = hasPermission(P.CUSTOMER_UPDATE);
  const canDelete = hasPermission(P.CUSTOMER_DELETE);
  const canCreateLead = hasPermission(P.LEAD_CREATE);
  const canCreateBooking = hasPermission(P.BOOKING_CREATE);
  const canReadBooking = hasPermission(P.BOOKING_READ);

  const loadBookings = useCallback(async () => {
    if (!id) return;
    setLoadingBookings(true);
    setBookingError("");
    try {
      const data = unwrap(await customerService.getBookingHistory(id));
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      setBookings([]);
      setBookingError(getErrorMessage(error, "Booking history could not be loaded."));
    } finally {
      setLoadingBookings(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    if (!id) return () => { active = false; };

    customerService.getById(id)
      .then((response) => {
        if (!active) return;
        const data = unwrap(response);
        if (!data) throw new Error("Customer response was empty");
        setCustomer(data);
      })
      .catch((error) => {
        if (!active) return;
        setProfileError(getErrorMessage(error, "Customer details could not be loaded."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    queueMicrotask(() => {
      if (active) loadBookings();
    });
    return () => { active = false; };
  }, [id, loadBookings]);

  useEffect(() => {
    if (!actionMenuOpen) return undefined;
    const close = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) setActionMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionMenuOpen]);

  const normalizedBookings = useMemo(() => bookings.map((booking) => ({
    id: booking.id || booking.publicId || null,
    code: booking.code || booking.bookingCode || "Booking",
    destination: booking.dest || booking.destination || booking.destinationSnapshot || "Not set",
    date: booking.date || booking.bookingDate || null,
    amount: Number(booking.amt ?? booking.customerAmount ?? booking.amount ?? 0),
    status: booking.status || "PENDING",
  })), [bookings]);

  const publicId = customer?.id || id;
  const customerCode = customer?.customerId || "Customer";
  const statusKey = keyOf(customer?.status) || "INACTIVE";
  const typeKey = keyOf(customer?.type) || "INDIVIDUAL";
  const tierKey = keyOf(customer?.tier) || "BRONZE";
  const phoneDigits = String(customer?.phone || "").replace(/\D/g, "");
  const location = [customer?.city, customer?.state].filter(Boolean).join(", ");

  const updateStatus = async (nextStatus) => {
    if (!canEdit || nextStatus === customer?.status || keyOf(nextStatus) === statusKey) return;
    setUpdating("status");
    try {
      const updated = unwrap(await customerService.updateStatus(publicId, nextStatus));
      setCustomer((current) => ({ ...current, ...(updated || {}), status: updated?.status || nextStatus }));
      showToast("Customer status updated.", "success");
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not update customer status."), "error");
    } finally {
      setUpdating("");
    }
  };

  const updateTier = async (nextTier) => {
    if (!canEdit || nextTier === customer?.tier || keyOf(nextTier) === tierKey) return;
    setUpdating("tier");
    try {
      const updated = unwrap(await customerService.updateTier(publicId, nextTier));
      setCustomer((current) => ({ ...current, ...(updated || {}), tier: updated?.tier || nextTier }));
      showToast("Loyalty tier updated.", "success");
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not update loyalty tier."), "error");
    } finally {
      setUpdating("");
    }
  };

  const moveToTrash = async () => {
    setActionMenuOpen(false);
    if (!window.confirm(`Move ${customer?.name || "this customer"} to Trash?`)) return;
    setUpdating("delete");
    try {
      await customerService.delete(publicId);
      showToast("Customer moved to Trash.", "success");
      navigate("/AllCustomers", { replace: true });
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Could not move customer to Trash."), "error");
      setUpdating("");
    }
  };

  if (loading) return <LoadingPage />;

  if (profileError || !customer) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-4">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">Customer unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{profileError || "The customer could not be found."}</p>
          <button
            type="button"
            onClick={() => navigate("/AllCustomers")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/AllCustomers")}
              aria-label="Back to customers"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-400">Customers / {customerCode}</p>
              <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">Customer details</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canCreateLead && (
              <button
                type="button"
                onClick={() => navigate("/createlead")}
                className="hidden items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 md:inline-flex"
              >
                <Plus className="h-4 w-4" /> New enquiry
              </button>
            )}
            {canCreateBooking && (
              <button
                type="button"
                onClick={() => navigate("/CreateBooking")}
                className="hidden items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 sm:inline-flex"
              >
                <Plane className="h-4 w-4" /> New booking
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => navigate(`/EditCustomer/${publicId}`)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {canDelete && (
              <div className="relative" ref={actionMenuRef}>
                <button
                  type="button"
                  onClick={() => setActionMenuOpen((open) => !open)}
                  aria-expanded={actionMenuOpen}
                  aria-label="More customer actions"
                  className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50"
                >
                  <span className="hidden text-sm font-bold sm:inline">More</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {actionMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={moveToTrash}
                      disabled={updating === "delete"}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {updating === "delete" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Move to Trash
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-5 py-6 sm:px-7">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white ring-1 ring-white/20 sm:h-20 sm:w-20 sm:text-2xl">
                  {initials(customer.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-black text-white sm:text-2xl">{customer.name}</h2>
                    {typeKey === "VIP" && <Crown className="h-5 w-5 fill-amber-300 text-amber-300" />}
                  </div>
                  <p className="mt-1 text-sm font-bold text-blue-200">{customerCode}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={TYPE_STYLE[typeKey] || TYPE_STYLE.INDIVIDUAL}>{titleCase(typeKey)}</Badge>
                    <Badge className={TIER_STYLE[tierKey] || TIER_STYLE.BRONZE}>{titleCase(tierKey)}</Badge>
                    <Badge className={STATUS_STYLE[statusKey] || STATUS_STYLE.INACTIVE} dotClass={STATUS_DOT[statusKey]}>
                      {titleCase(statusKey)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                )}
                {phoneDigits && (
                  <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">
                    <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20">
                    <Mail className="h-4 w-4" /> Email
                  </a>
                )}
              </div>
            </div>

            <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-blue-300" /> {customer.phone || "Phone not added"}</span>
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-300" /> {location || "Location not added"}</span>
              <span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4 text-blue-300" /> {customer.commPref || "Communication preference not set"}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Plane} label="Total bookings" value={Number(customer.bookings || 0).toLocaleString("en-IN")} helper="Active lifetime bookings" tone="blue" />
          <KpiCard icon={IndianRupee} label="Lifetime spend" value={formatCurrency(customer.spent)} helper="Across active bookings" tone="emerald" />
          <KpiCard icon={History} label="Last booking" value={formatDate(customer.lastBooking, "Never")} helper="Most recent booking date" tone="violet" />
          <KpiCard icon={Clock3} label="Customer since" value={formatDate(customer.createdAt)} helper="Profile creation date" tone="amber" />
        </section>

        <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {[
            { id: "overview", label: "Overview", icon: CircleUserRound },
            { id: "bookings", label: `Bookings (${Number(customer.bookings || normalizedBookings.length)})`, icon: Plane },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <SectionCard icon={UserRound} title="Contact details" description="Primary contact and preferred communication channel">
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <DetailItem icon={Phone} label="Phone" value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : null} />
                  <DetailItem icon={Phone} label="Alternate phone" value={customer.alternatePhone} href={customer.alternatePhone ? `tel:${customer.alternatePhone}` : null} />
                  <DetailItem icon={Mail} label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : null} />
                  <DetailItem icon={MessageCircle} label="Preferred communication" value={customer.commPref} />
                </div>
              </SectionCard>

              <SectionCard icon={MapPin} title="Address" description="Customer's durable address information">
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <DetailItem icon={MapPin} label="Full address" value={customer.address} wide />
                  <DetailItem icon={BriefcaseBusiness} label="City" value={customer.city} />
                  <DetailItem icon={MapPin} label="State" value={customer.state} />
                  <DetailItem icon={IdCard} label="Pincode" value={customer.pincode} />
                </div>
              </SectionCard>

              <div className="grid gap-5 xl:grid-cols-2">
                <SectionCard icon={CalendarDays} title="Important dates" description="Useful for relationship and marketing reminders">
                  <div className="space-y-3 p-5">
                    <DetailItem icon={CakeSlice} label="Birthday" value={customer.birthday ? formatDate(customer.birthday) : null} />
                    <DetailItem icon={CalendarDays} label="Anniversary" value={customer.anniversary ? formatDate(customer.anniversary) : null} />
                  </div>
                </SectionCard>

                <SectionCard icon={ShieldCheck} title="Identity details" description="Masked by default on the customer profile">
                  <div className="space-y-3 p-5">
                    <DetailItem icon={IdCard} label="Passport" value={customer.passportNo ? maskIdentifier(customer.passportNo) : null} />
                    <DetailItem icon={IdCard} label="PAN" value={customer.panNo ? maskIdentifier(customer.panNo, 3) : null} />
                    <DetailItem icon={IdCard} label="Aadhar" value={customer.aadharNo ? maskIdentifier(customer.aadharNo) : null} />
                  </div>
                </SectionCard>
              </div>

              <SectionCard icon={StickyNote} title="Notes & document references" description="Permanent preferences and document notes, not trip-specific details">
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700"><StickyNote className="h-4 w-4" /> Customer notes</p>
                    <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${customer.notes ? "text-amber-950" : "text-amber-700/60"}`}>
                      {customer.notes || "No customer preferences or notes added."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><FileText className="h-4 w-4" /> Document notes</p>
                    <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${customer.documents ? "text-slate-700" : "text-slate-400"}`}>
                      {customer.documents || "No document references added."}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-20">
              <SectionCard icon={Crown} title="Customer profile" description="Classification and relationship status">
                <div className="space-y-4 p-5">
                  <div>
                    <label htmlFor="customer-status" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                    <div className="relative mt-1.5">
                      <select
                        id="customer-status"
                        value={customer.status || "Active"}
                        onChange={(event) => updateStatus(event.target.value)}
                        disabled={!canEdit || Boolean(updating)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                      {updating === "status" ? <LoaderCircle className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-blue-600" /> : <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="customer-tier" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Loyalty tier</label>
                    <div className="relative mt-1.5">
                      <select
                        id="customer-tier"
                        value={customer.tier || "Bronze"}
                        onChange={(event) => updateTier(event.target.value)}
                        disabled={!canEdit || Boolean(updating)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="Bronze">Bronze</option>
                        <option value="Silver">Silver</option>
                        <option value="Gold">Gold</option>
                        <option value="Platinum">Platinum</option>
                      </select>
                      {updating === "tier" ? <LoaderCircle className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-blue-600" /> : <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {[
                    ["Customer type", titleCase(typeKey)],
                    ["Communication", customer.commPref || "Not set"],
                    ["Customer code", customerCode],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="text-xs font-semibold text-slate-500">{label}</span>
                      <span className="text-right text-sm font-bold text-slate-800">{value}</span>
                    </div>
                  ))}
                  {!canEdit && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">You have read-only access to this customer.</p>}
                </div>
              </SectionCard>

              <SectionCard icon={Clock3} title="Record information" description="Profile audit timestamps">
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Created</span><span className="text-sm font-bold text-slate-700">{formatDate(customer.createdAt)}</span></div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">Last updated</span><span className="text-sm font-bold text-slate-700">{formatDate(customer.updatedAt)}</span></div>
                </div>
              </SectionCard>

              {(canCreateLead || canCreateBooking) && (
                <SectionCard icon={Plus} title="Quick actions" description="Start the customer's next travel workflow">
                  <div className="space-y-2.5 p-5">
                    {canCreateLead && <button type="button" onClick={() => navigate("/createlead")} className="flex w-full items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"><span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New enquiry</span><ChevronRight className="h-4 w-4" /></button>}
                    {canCreateBooking && <button type="button" onClick={() => navigate("/CreateBooking")} className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"><span className="flex items-center gap-2"><Plane className="h-4 w-4" /> New booking</span><ChevronRight className="h-4 w-4" /></button>}
                  </div>
                </SectionCard>
              )}
            </aside>
          </div>
        ) : (
          <SectionCard icon={Plane} title="Booking history" description="All active bookings linked to this customer">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">{normalizedBookings.length} booking{normalizedBookings.length === 1 ? "" : "s"} returned</p>
              {canCreateBooking && <button type="button" onClick={() => navigate("/CreateBooking")} className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> New booking</button>}
            </div>

            {loadingBookings ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : bookingError ? (
              <div className="px-5 py-16 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
                <p className="mt-3 text-sm font-bold text-slate-700">Booking history unavailable</p>
                <p className="mt-1 text-sm text-slate-500">{bookingError}</p>
                <button type="button" onClick={loadBookings} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Try again</button>
              </div>
            ) : normalizedBookings.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Plane className="h-6 w-6" /></span>
                <h3 className="mt-4 text-base font-extrabold text-slate-900">No bookings yet</h3>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Start a new enquiry for this customer's next trip, or create a direct booking.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {canCreateLead && <button type="button" onClick={() => navigate("/createlead")} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100">New enquiry</button>}
                  {canCreateBooking && <button type="button" onClick={() => navigate("/CreateBooking")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">New booking</button>}
                </div>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px]">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3.5">Booking</th>
                        <th className="px-5 py-3.5">Destination</th>
                        <th className="px-5 py-3.5">Booking date</th>
                        <th className="px-5 py-3.5">Amount</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {normalizedBookings.map((booking, index) => (
                        <tr key={booking.id || `${booking.code}-${index}`} className="hover:bg-blue-50/40">
                          <td className="px-5 py-4"><span className="font-extrabold text-blue-700">{booking.code}</span></td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">{booking.destination}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{formatDate(booking.date)}</td>
                          <td className="px-5 py-4 text-sm font-extrabold tabular-nums text-slate-900">{formatCurrency(booking.amount)}</td>
                          <td className="px-5 py-4"><BookingStatus status={booking.status} /></td>
                          <td className="px-5 py-4 text-right">
                            {canReadBooking && booking.id ? (
                              <button type="button" onClick={() => navigate(`/BookingDetails/${booking.id}`)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">View <ChevronRight className="h-4 w-4" /></button>
                            ) : <span className="text-xs text-slate-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {normalizedBookings.map((booking, index) => (
                    <article key={booking.id || `${booking.code}-mobile-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="text-xs font-extrabold text-blue-700">{booking.code}</p><h3 className="mt-1 truncate text-sm font-bold text-slate-900">{booking.destination}</h3></div>
                        <BookingStatus status={booking.status} />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking date</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatDate(booking.date)}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</p><p className="mt-1 text-xs font-extrabold text-slate-900">{formatCurrency(booking.amount)}</p></div>
                      </div>
                      {canReadBooking && booking.id && <button type="button" onClick={() => navigate(`/BookingDetails/${booking.id}`)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100">View booking <ChevronRight className="h-4 w-4" /></button>}
                    </article>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        )}
      </main>
    </div>
  );
}
