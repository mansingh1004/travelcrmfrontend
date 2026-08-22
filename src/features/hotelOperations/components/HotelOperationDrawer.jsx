import { useCallback, useEffect, useRef, useState } from "react";
import {
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Hotel,
  MapPin,
  Phone,
  Route,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getErrorMessage, isAlreadyReported, isCanceled } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";
import hotelOperationService from "../api/hotelOperationService";
import { StatusDot } from "./hotelOperationUi";
import {
  operationTimeline,
  fmtDate,
  fmtDateTime,
  paymentState,
  toOperationBooking,
  voucherState,
} from "../lib/hotelOperationModel";

const TONE = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-50 text-slate-600 ring-slate-200",
};

export default function HotelOperationDrawer({ publicId, mock = false, onClose }) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  const load = useCallback(async (signal) => {
    if (!publicId || signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const data = await hotelOperationService.getOperationById(publicId, { signal, mock });
      setRaw(data);
    } catch (err) {
      if (isCanceled(err)) return;
      setError(err);
      setRaw(null);
      if (!isAlreadyReported(err)) {
        toast.error(getErrorMessage(err, "Could not load this hotel booking."));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [publicId, mock]);

  useEffect(() => {
    if (!publicId) return undefined;
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => load(controller.signal));
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [publicId, load]);

  useEffect(() => {
    if (!publicId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [publicId, onClose]);

  if (!publicId) return null;

  const booking = raw ? toOperationBooking(raw) : null;

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button type="button" aria-label="Close booking details" onClick={onClose} className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotel-operation-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:max-w-2xl"
        style={{ animation: "hotelOpsDrawerIn .22s ease-out both" }}
      >
        <style>{`@keyframes hotelOpsDrawerIn{from{opacity:.7;transform:translateX(32px)}to{opacity:1;transform:none}}`}</style>

        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-600">Platform hotel operation</p>
              <h2 id="hotel-operation-drawer-title" className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">
                {booking?.hotelName || (loading ? "Loading booking…" : "Booking detail")}
              </h2>
              {booking && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{booking.location}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-slate-600">{booking.bookingCode}</span>
                </p>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close booking details"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5 sm:px-6">
          {loading ? <DrawerSkeleton /> : error ? (
            <ErrorState message={getErrorMessage(error, "Could not load this hotel booking.")} onRetry={() => load()} />
          ) : booking ? (
            <DrawerContent booking={booking} raw={raw} />
          ) : (
            <ErrorState message="This hotel booking could not be found." onRetry={() => load()} />
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
          Read-only operations view. Booking actions remain unavailable until backend operation APIs are added.
        </footer>
      </aside>
    </div>
  );
}

function DrawerContent({ booking, raw }) {
  const timeline = operationTimeline(raw);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <StatusDot status={booking.bookingStatus} />
        <span className="h-4 w-px bg-slate-200" />
        <Chip value={booking.confirmation} />
        <Chip value={voucherState(booking.voucherStatus)} />
        <Chip value={paymentState(booking.paymentStatus)} />
      </div>

      <DetailSection icon={ClipboardList} title="Booking information">
        <Field label="Booking ID" value={booking.bookingCode} mono />
        <Field label="Booking date" value={fmtDateTime(booking.bookingDate)} />
        <Field label="CRM booking" value={booking.crmBookingCode || "Not linked"} mono={Boolean(booking.crmBookingCode)} />
        <Field label="Travel agency / tenant" value="Current tenant" />
        <Field label="Agent" value="Not recorded" />
        <Field label="Booking status" value={<StatusDot status={booking.bookingStatus} />} />
      </DetailSection>

      <DetailSection icon={UserRound} title="Guest information">
        <Field label="Primary guest" value={booking.leadGuestName} />
        <Field label="Phone" value={booking.leadGuestPhone || "Not recorded"} icon={Phone} />
        <Field label="Email" value={booking.leadGuestEmail || "Not recorded"} />
        <Field label="Guest origin" value={booking.guestOrigin || "Not recorded"} />
        <Field label="Adults" value={booking.adults ?? "Not recorded"} />
        <Field label="Children" value={booking.children ?? "Not recorded"} />
        <Field label="Infants" value={booking.infants ?? "Not recorded"} />
        <Field label="Total pax" value={booking.totalPax ?? "Not recorded"} icon={Users} />
      </DetailSection>

      <DetailSection icon={Building2} title="Hotel information">
        <Field label="Hotel name" value={booking.hotelName} />
        <Field label="Hotel property / branch" value={booking.hotelPropertyName} />
        <Field label="Location / city" value={booking.location} icon={MapPin} />
        <Field label="State" value={booking.state || "Not recorded"} />
        <Field label="Country" value={booking.country || "Not recorded"} />
        <Field label="Address" value={booking.address || "Not recorded"} wide />
      </DetailSection>

      <DetailSection icon={CalendarDays} title="Stay details">
        <Field label="Check-in" value={fmtDate(booking.checkIn)} />
        <Field label="Check-out" value={fmtDate(booking.checkOut)} />
        <Field label="Nights" value={booking.nights ?? "Not recorded"} />
        <Field label="Rooms" value={booking.rooms ?? "Not recorded"} icon={BedDouble} />
        <Field label="Room category" value={booking.roomName || "Not recorded"} />
        <Field label="Bed type" value="Not recorded" />
        <Field label="Meal plan" value={booking.mealPlan || "Not recorded"} />
      </DetailSection>

      <DetailSection icon={Route} title="Travel context">
        <div className="col-span-full grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
          <JourneyPoint label="Arrival from" value={booking.arrivalFrom || "Not recorded"} />
          <span className="hidden text-slate-300 sm:block">→</span>
          <JourneyPoint label="Current stay" value={`${booking.location} · ${booking.hotelName}`} active />
          <span className="hidden text-slate-300 sm:block">→</span>
          <JourneyPoint label="Next destination" value={booking.nextDestination || "Not recorded"} />
        </div>
      </DetailSection>

      <DetailSection icon={Hotel} title="Operations data">
        <Field label="Confirmation status" value={<Chip value={booking.confirmation} />} />
        <Field label="Confirmation number" value={booking.confirmationNumber || "Not recorded"} mono={Boolean(booking.confirmationNumber)} />
        <Field label="Voucher status" value={<Chip value={booking.voucher} />} />
        <Field label="Voucher number" value={booking.voucherNumber || "Not recorded"} mono={Boolean(booking.voucherNumber)} />
        <Field label="Check-in status" value="Not tracked" />
        <Field label="Check-out status" value="Not tracked" />
        <Field label="Special request" value={booking.specialRequest || "Not recorded"} wide />
        <Field label="Operations notes" value={booking.opsNotes || "Not recorded"} wide />
      </DetailSection>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h3 className="text-sm font-extrabold text-slate-800">Operations timeline</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Only events present in the current tenant booking DTO are marked complete.</p>
        </div>
        <ol className="px-4 py-4">
          {timeline.map((event, index) => (
            <li key={event.label} className="relative flex gap-3 pb-5 last:pb-0">
              {index < timeline.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-slate-200" />}
              <span className={`relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-4 ring-white ${event.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                {event.done && <Check className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold ${event.done ? "text-slate-800" : "text-slate-500"}`}>{event.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{event.at ? fmtDateTime(event.at) : event.done ? "Recorded; timestamp unavailable" : "Not recorded"}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-3.5 w-3.5" /></span>
        <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
      </div>
      <div className="grid gap-x-5 gap-y-4 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value, mono, icon: Icon, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className={`mt-1 flex items-start gap-1.5 text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>
        {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <span className="min-w-0 break-words">{value}</span>
      </dd>
    </div>
  );
}

function JourneyPoint({ label, value, active }) {
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xs font-bold ${active ? "text-blue-800" : "text-slate-700"}`}>{value}</p>
    </div>
  );
}

function Chip({ value }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${TONE[value.tone] || TONE.slate}`}>{value.label}</span>;
}

function DrawerSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading booking detail">
      {[80, 220, 260, 220].map((height, index) => (
        <div key={height + index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
          <div style={{ height: Math.max(0, height - 100) }} />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-bold text-rose-700">{message}</p>
      <button type="button" onClick={() => onRetry()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">Try again</button>
    </div>
  );
}
