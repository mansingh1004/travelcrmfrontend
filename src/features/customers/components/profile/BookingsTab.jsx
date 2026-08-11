import { ChevronRight, Plane, Plus } from "lucide-react";

import Pager from "@shared/ui/Pager";

import {
  BOOKING_STATUS_STYLE, EmptyState, RowSkeleton, SectionCard, SectionError, TH_CLASS,
  fmtDate, keyOf, money, titleCase,
} from "./profileUi";
import { useClientPage } from "./profilePaging";

/**
 * The customer's bookings.
 *
 * Loaded on first open of this tab, not on page mount. The old page fetched it eagerly even though
 * Overview is always the landing tab, so every profile view paid for a list most of them never saw.
 *
 * Cancelled and refunded rows are shown, and they are the reason the money strip above reports
 * cancelled bookings separately: the strip's totals exclude them, so seeing them here without that
 * explanation used to make the two look inconsistent.
 */
export default function BookingsTab({ state, canCreate, canRead, onNewBooking, onOpenBooking }) {
  const { data, loading, error, reload } = state;
  const rows = Array.isArray(data) ? data : [];
  const paged = useClientPage(rows);

  return (
    <SectionCard
      icon={Plane}
      title="Booking history"
      description="Every booking linked to this customer"
      action={canCreate && (
        <button
          type="button"
          onClick={onNewBooking}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New booking
        </button>
      )}
    >
      {loading ? <RowSkeleton /> : error ? <SectionError error={error} onRetry={reload} />
        : rows.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="No bookings yet"
            hint="Start an enquiry for this customer's next trip, or create a direct booking."
            action={canCreate && (
              <button type="button" onClick={onNewBooking}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                New booking
              </button>
            )}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50">
                  <tr className={`text-left ${TH_CLASS}`}>
                    <th className="px-5 py-3.5">Booking</th>
                    <th className="px-5 py-3.5">Destination</th>
                    <th className="px-5 py-3.5">Booking date</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.slice.map((booking, index) => (
                    <tr key={booking.id || index} className="hover:bg-blue-50/40">
                      <td className="px-5 py-4"><span className="font-extrabold text-blue-700">{booking.code}</span></td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700">{booking.dest || "—"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{fmtDate(booking.date)}</td>
                      <td className="px-5 py-4 text-sm font-extrabold tabular-nums text-slate-900">{money(booking.amt)}</td>
                      <td className="px-5 py-4"><BookingStatus status={booking.status} /></td>
                      <td className="px-5 py-4 text-right">
                        {canRead && booking.id ? (
                          <button type="button" onClick={() => onOpenBooking(booking.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
                            View <ChevronRight className="h-4 w-4" />
                          </button>
                        ) : <span className="text-xs text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {paged.slice.map((booking, index) => (
                <article key={booking.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-blue-700">{booking.code}</p>
                      <h3 className="mt-1 truncate text-sm font-bold text-slate-900">{booking.dest || "—"}</h3>
                    </div>
                    <BookingStatus status={booking.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Booking date</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{fmtDate(booking.date)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount</p>
                      <p className="mt-1 text-xs font-extrabold text-slate-900">{money(booking.amt)}</p>
                    </div>
                  </div>
                  {canRead && booking.id && (
                    <button type="button" onClick={() => onOpenBooking(booking.id)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100">
                      View booking <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </article>
              ))}
            </div>

            {/* Meta is client-derived: the endpoint returns the whole list (see profilePaging). */}
            <div className="border-t border-slate-100 px-4">
              <Pager {...paged} label="bookings" />
            </div>
          </>
        )}
    </SectionCard>
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
