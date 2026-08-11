import { useEffect, useRef, useState } from "react";
import { IndianRupee, LoaderCircle, X } from "lucide-react";

import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";

import customerService from "../../api/customerService";
import { FOCUS_RING, MONEY_TONE, fmtDate, money } from "./profileUi";

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Bookings that can still take money. Cancelled and refunded ones cannot. */
const CLOSED = new Set(["CANCELLED", "REFUNDED"]);
const isLive = (booking) => !CLOSED.has(String(booking?.status || "").trim().toUpperCase());

/**
 * "Record payment", from the customer rather than from the booking.
 *
 * ── Why this is a picker and not a link ──────────────────────────────────────────────────────
 * There is no customer-level payment endpoint, and there should not be: money is always received
 * against a booking, and the ledger, the invoice and the refund trail all key off booking_id.
 * Inventing a customer-level payment would create a row with nothing to reconcile against.
 *
 * So this stays honest about the data model while still saving the operator the trip through the
 * Bookings tab:
 *   • one live booking  → straight to /BookingPayments/{publicId}, no dialog at all
 *   • several           → a small picker showing code, destination, travel date and amount
 *   • none              → the button is not rendered (the caller checks activeBookingCount)
 *
 * ── Why the fetch is lazy ────────────────────────────────────────────────────────────────────
 * The whole point of the page's load strategy is that the landing costs one summary and nothing
 * else. Fetching the booking list up front just to decide what this button does would put the old
 * eager call straight back. Nothing is requested until the button is actually pressed.
 */
export default function RecordPaymentAction({ customerId, onNavigate, onToast }) {
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!choices) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      setChoices(null);
      triggerRef.current?.focus();
    };
    const onOutside = (event) => {
      if (!dialogRef.current?.contains(event.target)) setChoices(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [choices]);

  const start = async () => {
    setBusy(true);
    try {
      const rows = unwrap(await customerService.getBookingHistory(customerId));
      const live = (Array.isArray(rows) ? rows : []).filter(isLive);

      if (live.length === 0) {
        // Reachable when every booking was cancelled after the summary was computed.
        onToast("This customer has no live booking to record a payment against.", "info");
        return;
      }
      if (live.length === 1) {
        onNavigate(live[0].id);
        return;
      }
      setChoices(live);
    } catch (error) {
      if (!isAlreadyReported(error)) {
        onToast(getErrorMessage(error, "Could not load this customer's bookings."), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={start}
        disabled={busy}
        className={`hidden h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 lg:inline-flex ${FOCUS_RING}`}
      >
        {busy
          ? <LoaderCircle className="h-4 w-4 animate-spin" />
          : <IndianRupee className="h-4 w-4" />}
        Record payment
      </button>

      {choices && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Choose a booking"
          className="absolute right-0 z-20 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">Which booking?</p>
              <p className="text-[11px] text-slate-500">Payments are always recorded against a booking.</p>
            </div>
            <button type="button" onClick={() => { setChoices(null); triggerRef.current?.focus(); }}
              aria-label="Close" className={`rounded-lg p-1 text-slate-500 hover:bg-slate-100 ${FOCUS_RING}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {choices.map((booking, index) => (
              <li key={booking.id || index}>
                <button
                  type="button"
                  autoFocus={index === 0}
                  onClick={() => onNavigate(booking.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50/60 ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-blue-700">{booking.code}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {booking.dest || "No destination"} · {fmtDate(booking.date)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-extrabold tabular-nums ${MONEY_TONE.fact}`}>
                    {money(booking.amt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
