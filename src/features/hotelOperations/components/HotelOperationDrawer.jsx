import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Download,
  ExternalLink,
  Hotel,
  MapPin,
  Phone,
  Route,
  TicketCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { getErrorMessage, isAlreadyReported, isCanceled } from "@shared/api/apiError";
import { downloadBlob } from "@shared/lib/download";
import { toast } from "@shared/ui/toast";
import hotelOperationService from "../api/hotelOperationService";
import { StatusDot } from "./hotelOperationUi";
import {
  operationTimeline,
  fmtDate,
  fmtDateTime,
  fmtMoney,
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
  const navigate = useNavigate();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
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

  /**
   * Save the voucher PDF.
   *
   * The 404 the server answers until the platform issues the document is SILENT in the shared
   * interceptor, so the message has to be rendered here or the button appears to do nothing.
   */
  const saveVoucher = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await hotelOperationService.downloadVoucher(publicId);
      downloadBlob(blob, `hotel-voucher-${raw?.voucherNumber || publicId}.pdf`);
    } catch (err) {
      if (!isAlreadyReported(err)) {
        toast.error(getErrorMessage(err, "Could not download the voucher."));
      }
    } finally {
      setDownloading(false);
    }
    // Depends on the whole row, not `raw?.voucherNumber`: the React Compiler infers `raw` and
    // refuses to preserve a narrower manual dependency list. `raw` only changes on load anyway.
  }, [publicId, raw]);

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
            <DrawerContent
              key={booking.publicId}
              booking={booking}
              raw={raw}
              mock={mock}
              navigate={navigate}
              onDownloadVoucher={saveVoucher}
              downloading={downloading}
            />
          ) : (
            <ErrorState message="This hotel booking could not be found." onRetry={() => load()} />
          )}
        </div>

        {/*
          Read-only by design, not by omission. Accepting a revised price and requesting a
          cancellation both commit money and both 409 on a stale view, so they live on ONE screen
          that re-reads the row after every write — duplicating them here would mean two places to
          keep correct. This links there instead of repeating them.
        */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
          {mock ? (
            <span>Demo data — no booking API is called in this mode.</span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Read-only operations view.</span>
              <button
                type="button"
                onClick={() => navigate(`/marketplace/bookings/${publicId}`)}
                className="inline-flex items-center gap-1.5 font-bold text-blue-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Open full request to accept, decline or cancel
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}

function DrawerContent({ booking, raw, mock, navigate, onDownloadVoucher, downloading }) {
  const timeline = operationTimeline(raw);
  const cancelling = Boolean(booking.cancelRequestedAt || booking.cancellationQuotedAt || booking.cancelledAt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <StatusDot status={booking.bookingStatus} />
        <span className="h-4 w-px bg-slate-200" />
        <Chip value={booking.confirmation} />
        <Chip value={voucherState(booking.voucherStatus)} />
        <Chip value={paymentState(booking.paymentStatus)} />
      </div>

      <RevisionOffer booking={booking} />

      {booking.bookingStatus === "REJECTED" && booking.rejectionReason && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-extrabold text-rose-900">
            <Ban className="h-4 w-4 shrink-0" aria-hidden="true" /> This request was not accepted
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-rose-800">{booking.rejectionReason}</p>
        </section>
      )}

      <DetailSection icon={ClipboardList} title="Booking information">
        <Field label="Booking ID" value={booking.bookingCode} mono />
        <Field label="Booking date" value={fmtDateTime(booking.bookingDate)} />
        <Field
          label="CRM booking"
          value={
            booking.crmBookingPublicId && !mock ? (
              <button
                type="button"
                onClick={() => navigate(`/BookingDetails/${booking.crmBookingPublicId}`)}
                className="inline-flex items-center gap-1.5 font-mono text-blue-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {booking.crmBookingCode || "Open booking"}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
              </button>
            ) : (
              booking.crmBookingCode || "Not linked"
            )
          }
        />
        <Field label="Travel agency / tenant" value="Current tenant" />
        <Field label="Agent" value="Not recorded" />
        <Field label="Booking status" value={<StatusDot status={booking.bookingStatus} />} />
        <Field label="Cancellation terms" value={booking.cancellationTerms || "Not recorded"} wide />
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
        <Field label="Bed type" value={booking.bedType || "Not recorded"} />
        <Field label="Meal plan" value={booking.mealPlan || "Not recorded"} />
      </DetailSection>

      <MoneyPanel booking={booking} />

      <TravelContextPanel booking={booking} raw={raw} />

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

      <VoucherPanel
        booking={booking}
        mock={mock}
        onDownload={onDownloadVoucher}
        downloading={downloading}
      />

      {cancelling && <CancellationPanel booking={booking} />}

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

/**
 * A revised price waiting for an answer.
 *
 * The delta is the loudest thing in the drawer on purpose: the reader is not checking a status here,
 * they are deciding whether to absorb a number or re-quote their customer, and they should not have
 * to do the subtraction themselves.
 *
 * Rendered ONLY while the offer is open. A revision that has already been answered is history, and
 * the timeline says so — repeating it here as a live decision would ask for an answer twice.
 */
function RevisionOffer({ booking }) {
  const offer = booking.revision;
  if (!offer || !offer.open) return null;

  const { revised, previous, delta, expired } = offer;
  const currency = booking.currency;

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-4 shadow-sm">
      <p className="text-sm font-extrabold text-amber-950">The price changed — this needs your answer.</p>
      <p className="mt-0.5 text-xs text-amber-800">
        Nothing is confirmed and no room is held until it is accepted or declined.
      </p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {previous !== null && (
          <>
            <span className="text-sm tabular-nums text-slate-500 line-through">{fmtMoney(previous, currency)}</span>
            <span className="text-slate-400" aria-hidden="true">→</span>
          </>
        )}
        <span className="text-2xl font-extrabold tabular-nums text-slate-900">{fmtMoney(revised, currency)}</span>
        {delta !== null && delta !== 0 && (
          <span className={`text-xs font-bold tabular-nums ${delta > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {delta > 0 ? "+" : "−"}{fmtMoney(Math.abs(delta), currency)} {delta > 0 ? "more than before" : "less than before"}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] font-medium text-amber-800">What you would owe the platform.</p>

      {offer.reason && <p className="mt-3 text-xs leading-relaxed text-slate-700">{offer.reason}</p>}

      {offer.newTerms && (
        <div className="mt-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-amber-700">
            New cancellation terms if accepted
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{offer.newTerms}</p>
        </div>
      )}

      {/* The server 409s an expired acceptance, so an offer past its deadline must never read as live. */}
      {expired ? (
        <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900">
          This offer expired on {fmtDateTime(offer.expiresAt)} and can no longer be accepted. Ask the
          platform to re-check availability — it will come back with a fresh price.
        </p>
      ) : offer.expiresAt ? (
        <p className="mt-3 text-[11px] font-bold text-amber-900">Answer by {fmtDateTime(offer.expiresAt)}.</p>
      ) : null}
    </section>
  );
}

/**
 * What the tenant owes the platform, what they are charging their customer, and where settlement
 * stands. Three separate facts and never collapsed.
 *
 * Everything here has been on the response all along; the drawer simply was not reading it.
 */
function MoneyPanel({ booking }) {
  const currency = booking.currency;
  const priced = booking.tenantPayable !== null;
  const margin =
    booking.sellingAmount !== null && booking.tenantPayable !== null
      ? booking.sellingAmount - booking.tenantPayable
      : null;
  // Re-priced between submit and approval — worth saying, because the tenant quoted the old number.
  const repriced =
    booking.quotedTenantPayable !== null &&
    booking.tenantPayable !== null &&
    booking.quotedTenantPayable !== booking.tenantPayable;

  return (
    <DetailSection icon={Wallet} title="Money">
      {priced ? (
        <Field
          label="You owe the platform"
          value={
            <span className="flex flex-col gap-0.5">
              <span className="tabular-nums">{fmtMoney(booking.tenantPayable, currency)}</span>
              {booking.revision?.open && (
                <span className="text-[11px] font-medium text-amber-700">
                  A revised {fmtMoney(booking.revision.revised, currency)} is waiting for your answer.
                </span>
              )}
              {!booking.revision?.open && repriced && (
                <span className="text-[11px] font-medium text-slate-500">
                  Quoted {fmtMoney(booking.quotedTenantPayable, currency)} when submitted
                </span>
              )}
            </span>
          }
        />
      ) : (
        // A REQUESTED row has no agreed price. Rendering ₹0 would be a number the tenant could quote.
        <Field label="You owe the platform" value="Not priced yet — the platform quotes on approval" wide />
      )}

      <Field label="Your price to customer" value={<span className="tabular-nums">{fmtMoney(booking.sellingAmount, currency)}</span>} />

      {margin !== null && (
        <Field
          label="Your margin"
          value={
            <span className={`tabular-nums ${margin < 0 ? "text-rose-700" : "text-slate-800"}`}>
              {fmtMoney(margin, currency)}
            </span>
          }
        />
      )}

      {/*
        Settlement, only once there is something to settle. `amountOutstanding` is SERVER-DERIVED —
        after a settled cancellation the debt is the retained charge, not the original payable, so
        `tenantPayable − amountPaid` would chase the tenant for a room they never used.
      */}
      {booking.paymentStatus && priced && (
        <Field
          label="Settlement"
          value={
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Chip value={paymentState(booking.paymentStatus)} />
              {booking.amountPaid > 0 && (
                <span className="text-xs tabular-nums text-slate-500">{fmtMoney(booking.amountPaid, currency)} paid</span>
              )}
              {booking.amountOutstanding > 0 && (
                <span className="text-xs font-bold tabular-nums text-slate-900">
                  {fmtMoney(booking.amountOutstanding, currency)} outstanding
                </span>
              )}
            </span>
          }
        />
      )}
    </DetailSection>
  );
}

/**
 * The voucher, and the one way to get the PDF.
 *
 * Nothing is rendered while NOT_ISSUED — an absent document is not a state that needs explaining,
 * and the voucher chip at the top already says so. The bytes come from `/api/me/hotel-bookings`,
 * which survives a lapsed add-on; see the service for why that prefix matters.
 */
function VoucherPanel({ booking, mock, onDownload, downloading }) {
  if (booking.voucherStatus === "REVOKED") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 shadow-sm">
        <p className="text-sm font-extrabold text-amber-950">
          The voucher{booking.voucherNumber ? ` ${booking.voucherNumber}` : ""} was withdrawn by the platform.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          It is no longer valid at the hotel — do not send it to the guest. The platform will issue a
          replacement if the stay is going ahead.
        </p>
      </section>
    );
  }

  if (booking.voucherStatus !== "ISSUED") return null;

  return (
    <DetailSection icon={TicketCheck} title="Voucher">
      <Field label="Voucher number" value={booking.voucherNumber || "Not recorded"} mono={Boolean(booking.voucherNumber)} />
      <Field label="Issued" value={fmtDateTime(booking.voucherIssuedAt)} />
      <Field
        label="Document"
        wide
        value={
          mock ? (
            <span className="text-xs font-medium text-slate-500">Not available on demo data.</span>
          ) : (
            <span className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {downloading ? "Preparing…" : "Download voucher"}
              </button>
              <span className="text-[11px] font-medium text-slate-500">
                Send this to the guest — it is what the hotel desk expects at check-in.
              </span>
            </span>
          )
        }
      />
    </DetailSection>
  );
}

/**
 * Cancellation, across its three stages: asked for, priced by the platform, settled.
 *
 * The charge and the refund are shown as the server states them. Nothing is derived here — what the
 * hotel retained is the outcome of a negotiation between the platform and the supplier, and a
 * locally-computed figure would be a guess presented as a debt.
 */
function CancellationPanel({ booking }) {
  const quoteExpired = booking.cancellationQuoteExpired;

  return (
    <DetailSection icon={Ban} title="Cancellation">
      {booking.cancelRequestedAt && (
        <Field label="Requested" value={fmtDateTime(booking.cancelRequestedAt)} />
      )}
      {booking.cancelRequestReason && (
        <Field label="Your reason" value={booking.cancelRequestReason} wide />
      )}

      {booking.quotedCancellationCharge !== null && (
        <Field
          label="Charge quoted"
          value={
            <span className="flex flex-col gap-0.5">
              <span className="tabular-nums">{fmtMoney(booking.quotedCancellationCharge, booking.currency)}</span>
              {booking.cancellationQuotedAt && (
                <span className="text-[11px] font-medium text-slate-500">
                  Quoted {fmtDateTime(booking.cancellationQuotedAt)}
                </span>
              )}
              {booking.cancellationQuoteExpiresAt && (
                <span className={`text-[11px] font-bold ${quoteExpired ? "text-rose-700" : "text-amber-700"}`}>
                  {quoteExpired ? "Quote expired " : "Answer by "}
                  {fmtDateTime(booking.cancellationQuoteExpiresAt)}
                </span>
              )}
            </span>
          }
        />
      )}
      {booking.cancellationQuoteNote && (
        <Field label="Platform note" value={booking.cancellationQuoteNote} wide />
      )}

      {booking.cancelledAt && <Field label="Cancelled" value={fmtDateTime(booking.cancelledAt)} />}
      {booking.cancellationCharge !== null && (
        <Field
          label="Charge retained"
          value={<span className="tabular-nums">{fmtMoney(booking.cancellationCharge, booking.currency)}</span>}
        />
      )}
      {booking.refundAmount !== null && (
        <Field
          label="Refund to you"
          value={<span className="tabular-nums text-emerald-700">{fmtMoney(booking.refundAmount, booking.currency)}</span>}
        />
      )}
      {booking.cancellationReason && (
        <Field label="Outcome" value={booking.cancellationReason} wide />
      )}

      {booking.cancelRequestedAt && !booking.cancelledAt && (
        <p className="col-span-full rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          Until the platform settles this with the hotel the room is still held and what you owe still
          stands. The final charge and any refund appear here once it is settled.
        </p>
      )}
    </DetailSection>
  );
}

function TravelContextPanel({ booking, raw }) {
  const stops = Array.isArray(raw?.travelStops) ? raw.travelStops : [];
  const initialStop = stops.find((stop) => stop.type === "CURRENT") || stops[0] || null;
  const [selectedId, setSelectedId] = useState(initialStop?.locationId || null);
  const selectedStop = stops.find((stop) => stop.locationId === selectedId) || initialStop;

  // Live MarketplaceBookingTenantDto currently carries only three text values, not linked stays.
  // Preserve the previous read-only presentation until a real travelStops API field exists.
  if (stops.length === 0) {
    return (
      <DetailSection icon={Route} title="Travel context">
        <div className="col-span-full grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
          <JourneyPoint label="Arrival from" value={booking.arrivalFrom || "Not recorded"} />
          <span className="hidden text-slate-300 sm:block">→</span>
          <JourneyPoint label="Current stay" value={`${booking.location} · ${booking.hotelName}`} active />
          <span className="hidden text-slate-300 sm:block">→</span>
          <JourneyPoint label="Next destination" value={booking.nextDestination || "Not recorded"} />
        </div>
      </DetailSection>
    );
  }

  return (
    <DetailSection icon={Route} title="Travel context">
      <div className="col-span-full">
        <p className="mb-2 text-[11px] font-medium text-slate-500">Select a location to inspect its booked hotel and room allocation.</p>
        <div className="flex gap-2 overflow-x-auto rounded-xl bg-slate-50 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stops.map((stop, index) => {
            const active = stop.locationId === selectedStop?.locationId;
            const stayCount = Array.isArray(stop.stays) ? stop.stays.length : 0;
            return (
              <div key={stop.locationId} className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(stop.locationId)}
                  aria-pressed={active}
                  className={`min-w-40 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? "border-blue-300 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <span className="block text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                    {stop.type === "ARRIVAL" ? "Arrival from" : stop.type === "NEXT" ? "Next destination" : "Current stay"}
                  </span>
                  <span className={`mt-1 block truncate text-xs font-extrabold ${active ? "text-blue-800" : "text-slate-800"}`}>
                    {stop.locationName}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {stayCount > 0
                      ? `${stayCount} hotel${stayCount === 1 ? "" : "s"} booked`
                      : "Transit only · no hotel"}
                  </span>
                </button>
                {index < stops.length - 1 && <span className="text-sm font-bold text-slate-300">→</span>}
              </div>
            );
          })}
        </div>

        <LocationStayDetails stop={selectedStop} />
      </div>
    </DetailSection>
  );
}

function LocationStayDetails({ stop }) {
  const stays = Array.isArray(stop?.stays) ? stop.stays : [];

  if (!stop || stays.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
        <MapPin className="mx-auto h-5 w-5 text-slate-300" />
        <p className="mt-2 text-sm font-extrabold text-slate-700">No hotel booked in {stop?.locationName || "this location"}</p>
        <p className="mt-1 text-xs text-slate-500">This stop is recorded as transit/travel context only.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {stays.map((stay) => <StayCard key={stay.hotelPublicId || stay.hotelName} stay={stay} />)}
    </div>
  );
}

function StayCard({ stay }) {
  const rooms = Array.isArray(stay.rooms) ? stay.rooms : [];
  const extraBeds = Number(stay.extraAdultBeds || 0) + Number(stay.extraChildBeds || 0);
  const confirmation = stay.confirmationStatus === "CONFIRMED"
    ? { label: "Confirmed", tone: "green" }
    : { label: "Pending", tone: "amber" };
  const voucher = stay.voucherStatus === "ISSUED"
    ? { label: "Voucher issued", tone: "green" }
    : { label: "Voucher pending", tone: "amber" };

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-900">{stay.hotelName}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{stay.propertyName || stay.hotelName}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip value={confirmation} />
            <Chip value={voucher} />
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{stay.address || "Address not recorded"}{stay.contactPhone ? ` · ${stay.contactPhone}` : ""}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        <StayMetric label="Stay" value={`${fmtDate(stay.checkIn)} → ${fmtDate(stay.checkOut)}`} />
        <StayMetric label="Rooms / Nights" value={`${stay.totalRooms ?? "—"} rooms · ${stay.nights ?? "—"} nights`} />
        <StayMetric label="Pax / Extra beds" value={`${stay.totalPax ?? "—"} pax · ${extraBeds} extra beds`} />
        <StayMetric label="Meal / Bed" value={`${stay.mealPlan || "Not recorded"} · ${stay.bedType || "Not recorded"}`} />
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Room allocation</p>
          {stay.confirmationNumber && <span className="font-mono text-[10px] font-bold text-slate-500">Ref {stay.confirmationNumber}</span>}
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1.4fr_.6fr_1fr_1fr] gap-2 px-3 text-[9px] font-extrabold uppercase tracking-wide text-slate-400 sm:grid">
            <span>Room category</span>
            <span>Quantity</span>
            <span>Guests</span>
            <span>Extra beds</span>
          </div>
          {rooms.map((room, index) => (
            <div key={`${room.roomType}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-[1.4fr_.6fr_1fr_1fr] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-slate-800">{room.roomType || "Room category not recorded"}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{room.bedType || "Bed type not recorded"}</p>
              </div>
              <RoomFact label="Quantity" value={room.quantity ?? "—"} />
              <RoomFact label="Guests" value={`${room.adults ?? 0}A · ${room.children ?? 0}C`} />
              <RoomFact
                label="Extra beds"
                value={`${room.extraAdultBeds ?? 0} adult · ${room.extraChildBeds ?? 0} child`}
              />
            </div>
          ))}
        </div>

        {stay.childrenWithoutBed > 0 && (
          <p className="mt-2 text-[11px] font-semibold text-amber-700">Children without bed: {stay.childrenWithoutBed}</p>
        )}
        {stay.specialRequests && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            <span className="font-extrabold">Special request:</span> {stay.specialRequests}
          </p>
        )}
      </div>
    </article>
  );
}

function StayMetric({ label, value }) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-slate-700" title={value}>{value}</p>
    </div>
  );
}

function RoomFact({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400 sm:hidden">{label}</p>
      <p className="font-bold text-slate-700">{value}</p>
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
