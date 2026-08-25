import {
  BedDouble,
  Building2,
  CalendarDays,
  ChevronRight,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { Empty, SkeletonRows, StatusDot } from "./hotelOperationUi";
import { confirmationState, fmtDate, fmtMoney, toOperationBooking, voucherState } from "../lib/hotelOperationModel";

const TONE = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-50 text-slate-600 ring-slate-200",
};

function SoftBadge({ value }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${TONE[value.tone] || TONE.slate}`}>
      {value.label}
    </span>
  );
}

function Stay({ booking }) {
  return (
    <div className="min-w-0">
      <p className="whitespace-nowrap text-xs font-semibold text-slate-700">
        {fmtDate(booking.checkIn)} <span className="text-slate-300">→</span> {fmtDate(booking.checkOut)}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {booking.nights == null ? "Nights not recorded" : `${booking.nights} night${booking.nights === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

export default function HotelBookingOperationsTable({ rows, loading, activeLabel, onOpen, onClear }) {
  const bookings = rows.map(toOperationBooking);

  return (
    <section aria-label={`${activeLabel} platform hotel bookings`} aria-busy={loading} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      {loading ? (
        <div className="px-5 py-2"><SkeletonRows count={7} /></div>
      ) : bookings.length === 0 ? (
        <Empty
          icon={Building2}
          title={`No ${activeLabel.toLowerCase()} platform hotel bookings`}
          hint="No booking in this tenant currently matches the selected server-side status."
          action={onClear ? (
            <button type="button" onClick={onClear} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
              Show all bookings
            </button>
          ) : null}
        />
      ) : (
        <>
          <div className="divide-y divide-slate-100 md:hidden">
            {bookings.map((booking) => (
              <MobileBookingCard key={booking.publicId} booking={booking} onOpen={() => onOpen(booking.publicId)} />
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1700px] w-full border-collapse text-left">
              <thead className="bg-slate-50/90 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="sticky left-0 z-20 w-36 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Location</th>
                  <th className="sticky left-36 z-20 w-60 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Hotel / Property</th>
                  <th className="border-b border-slate-200 px-4 py-3">Booking</th>
                  <th className="border-b border-slate-200 px-4 py-3">Primary guest</th>
                  <th className="border-b border-slate-200 px-4 py-3">Stay</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center">Pax</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center">Rooms</th>
                  <th className="border-b border-slate-200 px-4 py-3">Room / Meal</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">Payable</th>
                  <th className="border-b border-slate-200 px-4 py-3">Confirmation</th>
                  <th className="border-b border-slate-200 px-4 py-3">Voucher</th>
                  <th className="border-b border-slate-200 px-4 py-3">Booking status</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((booking) => (
                  <DesktopBookingRow key={booking.publicId} booking={booking} onOpen={() => onOpen(booking.publicId)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function DesktopBookingRow({ booking, onOpen }) {
  return (
    <tr className="group transition-colors hover:bg-blue-50/30">
      <td className="sticky left-0 z-10 w-36 border-r border-slate-100 bg-white px-4 py-3.5 group-hover:bg-[#f8fbff]">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{booking.location}</span>
        </span>
      </td>
      <td className="sticky left-36 z-10 w-60 border-r border-slate-100 bg-white px-4 py-3.5 group-hover:bg-[#f8fbff]">
        <button type="button" onClick={onOpen} className="block max-w-[210px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span className="block truncate text-sm font-extrabold text-slate-900 group-hover:text-blue-700">{booking.hotelPropertyName}</span>
          <span className="mt-0.5 block truncate text-[11px] text-slate-500">Platform property</span>
        </button>
      </td>
      <td className="px-4 py-3.5">
        <p className="whitespace-nowrap font-mono text-xs font-bold text-blue-700">{booking.bookingCode}</p>
        {booking.crmBookingCode && <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-400">CRM {booking.crmBookingCode}</p>}
      </td>
      <td className="max-w-48 px-4 py-3.5">
        <p className="truncate text-xs font-semibold text-slate-800">{booking.leadGuestName}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{booking.leadGuestPhone || "Phone not recorded"}</p>
      </td>
      <td className="px-4 py-3.5"><Stay booking={booking} /></td>
      <td className="px-4 py-3.5 text-center text-sm font-extrabold tabular-nums text-slate-800">{booking.totalPax ?? "—"}</td>
      <td className="px-4 py-3.5 text-center text-sm font-extrabold tabular-nums text-slate-800">{booking.rooms ?? "—"}</td>
      <td className="max-w-44 px-4 py-3.5">
        <p className="truncate text-xs font-semibold text-slate-700">{booking.roomName || "Not recorded"}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{booking.mealPlan || "Meal plan not recorded"}</p>
      </td>
      {/*
        Payable, with outstanding under it. `amountOutstanding` is server-derived — never
        `tenantPayable − amountPaid`, which is wrong the moment a cancellation is settled.
        A REQUESTED row has no agreed price yet, so it shows an em dash rather than a zero.
      */}
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        <p className="text-xs font-bold tabular-nums text-slate-800">
          {fmtMoney(booking.tenantPayable, booking.currency)}
        </p>
        {booking.amountOutstanding > 0 && (
          <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-amber-700">
            {fmtMoney(booking.amountOutstanding, booking.currency)} due
          </p>
        )}
      </td>
      <td className="px-4 py-3.5"><SoftBadge value={confirmationState(booking.bookingStatus)} /></td>
      <td className="px-4 py-3.5"><SoftBadge value={voucherState(booking.voucherStatus)} /></td>
      <td className="px-4 py-3.5"><StatusDot status={booking.bookingStatus} /></td>
      <td className="px-4 py-3.5 text-right">
        <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          View <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function MobileBookingCard({ booking, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="block w-full p-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-900">{booking.hotelPropertyName}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{booking.location}</span>
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusDot status={booking.bookingStatus} />
        <span className="font-mono text-[11px] font-bold text-blue-700">{booking.bookingCode}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><CalendarDays className="h-3 w-3" /> Stay</p>
          <p className="mt-1 whitespace-nowrap text-xs font-semibold text-slate-700">{fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}</p>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Users className="h-3 w-3" /> Guests / Rooms</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">{booking.totalPax ?? "—"} pax · {booking.rooms ?? "—"} rooms</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Primary guest</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-700">{booking.leadGuestName}</p>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><BedDouble className="h-3 w-3" /> Room</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-700">{booking.roomName || "Not recorded"}</p>
        </div>
        {/* Mirrors the desktop Payable column — this markup is duplicated, so both move together. */}
        <div className="col-span-2 min-w-0 border-t border-slate-200 pt-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Wallet className="h-3 w-3" /> Payable</p>
          <p className="mt-1 text-xs font-semibold tabular-nums text-slate-700">
            {fmtMoney(booking.tenantPayable, booking.currency)}
            {booking.amountOutstanding > 0 && (
              <span className="ml-1.5 font-bold text-amber-700">
                · {fmtMoney(booking.amountOutstanding, booking.currency)} due
              </span>
            )}
          </p>
        </div>
      </div>
    </button>
  );
}
