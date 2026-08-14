// src/features/marketplace/pages/MarketplaceBookings.jsx
//
// The tenant's own hotel booking requests, newest first.
//
// FILTERING — `GET /api/hotel-marketplace/bookings` takes ONE `status`, and treats an unknown or
// blank one as "all". So every tab here is exactly one status (or none), and every tab is a real
// server query over the whole dataset. There is deliberately no "In progress"/"Closed" grouping: a
// tab covering several statuses cannot be one call, and filtering the loaded page client-side to fake
// it is the AllLeads trap CLAUDE.md records — a control that looks like it filters the dataset while
// it filters one page of it. Ten honest tabs beat five lying ones.
//
// What matters most is TENANT_APPROVAL_REQUIRED: a revised price sits there doing nothing until
// somebody answers it. It leads the tabs and carries a count — and that count is its own server call,
// not `rows.filter(...)`, because a request waiting on page 3 is exactly the one that gets forgotten.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, BedDouble, Building2, CalendarDays, ChevronRight, Search, WalletCards,
} from "lucide-react";
import { marketplaceService } from "../api/marketplaceService";
import {
  BOOKING_STATUS, Button, Empty, Notice, Page, PageHeader, Pager, SkeletonRows, StatusDot,
  Tabs, cn, errMsg, fmtDate, fmtMoney, useToast,
} from "../components/marketplaceUi";

const PAGE_SIZE = 20;

const AWAITING = "TENANT_APPROVAL_REQUIRED";

// Lifecycle order, with the one that needs an answer first. Labels come from the kit's status map so
// a tab and the row it selects can never read as two different things.
const TAB_STATUSES = [
  AWAITING, "REQUESTED", "UNDER_REVIEW", "TENANT_ACCEPTED", "CONFIRMED",
  "CANCEL_REQUESTED", "REJECTED", "CANCELLED", "EXPIRED",
];

export function MarketplaceBookings() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [awaitingCount, setAwaitingCount] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * What this tenant currently owes the platform, across every booking.
   *
   * Loaded once and swallows its own error, exactly like the awaiting badge: a credit endpoint that
   * fails must not cost the user their list of bookings.
   *
   * Read from `/api/me/marketplace-credit`, which sits OUTSIDE the module gate on purpose — hiding
   * what a tenant owes behind the add-on that just lapsed would be the worst possible moment to
   * hide it.
   */
  const [credit, setCredit] = useState(null);
  useEffect(() => {
    let alive = true;
    marketplaceService.myCredit()
      .then((c) => { if (alive) setCredit(c); })
      .catch(() => { /* silent — the strip simply does not render */ });
    return () => { alive = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, awaiting] = await Promise.all([
        marketplaceService.listMyBookings({ page, size: PAGE_SIZE, status }),
        // size=1 — only `totalElements` is read. Failing this must not cost the user their list, so
        // it swallows its own error and the badge simply disappears.
        marketplaceService
          .listMyBookings({ page: 0, size: 1, status: AWAITING })
          .then((r) => r.pagination?.totalElements ?? null)
          .catch(() => null),
      ]);
      setRows(list.items);
      setPagination(list.pagination);
      setAwaitingCount(awaiting);
    } catch (e) {
      showToast(errMsg(e, "Could not load your booking requests."), "error");
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, status, showToast]);

  useEffect(() => { load(); }, [load]);

  // Page numbers belong to a filter — carrying page 3 across a tab change lands on an empty page.
  const changeStatus = (next) => {
    setStatus(next);
    setPage(0);
  };

  const tabs = [
    { value: "", label: "All" },
    ...TAB_STATUSES.map((s) => ({
      value: s,
      label: BOOKING_STATUS[s]?.label ?? s,
      count: s === AWAITING && awaitingCount ? awaitingCount : undefined,
    })),
  ];

  const activeLabel = status ? (BOOKING_STATUS[status]?.label ?? status) : "All requests";
  const resultCount = pagination?.totalElements ?? rows.length;

  return (
    <Page width="max-w-6xl">
      <PageHeader
        title="Hotel booking requests"
        subtitle="Requests you've sent to the platform. Only the platform can confirm a hotel."
        className="mb-6"
        actions={
          <Button variant="primary" onClick={() => navigate("/marketplace")}>
            <Search /> Browse catalog
          </Button>
        }
      />

      {/* Already looking at them? Then the list is the message — a banner above it is noise. */}
      {awaitingCount > 0 && status !== AWAITING && (
        <Notice tone="warn" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {awaitingCount === 1
                    ? "One request needs your approval"
                    : `${awaitingCount} requests need your approval`}
                </p>
                <p className="mt-0.5 text-amber-800">
                  The platform has proposed a revised price. Nothing moves until you accept or decline.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => changeStatus(AWAITING)}>Review now</Button>
          </div>
        </Notice>
      )}

      <CreditSummary credit={credit} />

      <Tabs
        options={tabs}
        value={status}
        onChange={changeStatus}
        className="mb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />

      <RequestList
        activeLabel={activeLabel}
        loading={loading}
        rows={rows}
        status={status}
        total={resultCount}
        onBrowse={() => navigate("/marketplace")}
        onClear={() => changeStatus("")}
        onOpen={(publicId) => navigate(`/marketplace/bookings/${publicId}`)}
      />

      <Pager
        page={pagination?.page ?? page}
        totalPages={pagination?.totalPages ?? 1}
        total={pagination?.totalElements ?? rows.length}
        onPage={setPage}
      />
    </Page>
  );
}

function RequestList({ activeLabel, loading, rows, status, total, onBrowse, onClear, onOpen }) {
  return (
    <section
      aria-label={activeLabel}
      aria-busy={loading}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{activeLabel}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">Open a request to see its full timeline and actions.</p>
        </div>
        {!loading && (
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {total} request{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-2"><SkeletonRows count={6} /></div>
      ) : rows.length === 0 ? (
        status ? (
          <Empty
            icon={Building2}
            title={`No ${(BOOKING_STATUS[status]?.label ?? status).toLowerCase()} requests`}
            hint="Nothing of yours is in this state right now."
            action={<Button onClick={onClear}>Show all requests</Button>}
          />
        ) : (
          <Empty
            icon={Building2}
            title="No booking requests yet"
            hint="Find a hotel in the platform catalog and send a request. The platform confirms it with the supplier."
            action={<Button variant="primary" onClick={onBrowse}>Browse catalog</Button>}
          />
        )
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((booking) => (
            <li key={booking.publicId}>
              <BookingRow booking={booking} onOpen={() => onOpen(booking.publicId)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingRow({ booking: b, onOpen }) {
  const needsApproval = b.status === AWAITING;
  const payable = needsApproval && b.revisedTenantPayable != null
    ? b.revisedTenantPayable
    : b.tenantPayable;
  const roomSummary = [
    `${b.nights} night${b.nights === 1 ? "" : "s"}`,
    `${b.rooms} room${b.rooms === 1 ? "" : "s"}`,
  ].join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${b.hotelName || "hotel"} request${b.bookingCode ? ` ${b.bookingCode}` : ""}`}
      className={cn(
        "group w-full px-4 py-4 text-left transition-colors focus:outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/10 sm:px-5",
        needsApproval ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-slate-50/80",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 md:grid-cols-[auto_minmax(0,1.25fr)_minmax(170px,1fr)_minmax(105px,.6fr)_minmax(125px,.7fr)_18px] lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(175px,.95fr)_minmax(135px,.75fr)_minmax(105px,.55fr)_minmax(125px,.65fr)_18px]">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border",
            needsApproval
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-500",
          )}
          aria-hidden="true"
        >
          <Building2 className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-950">{b.hotelName}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-slate-500">
            {b.cityName && <span className="truncate">{b.cityName}</span>}
            {b.cityName && b.bookingCode && <span className="text-slate-300">·</span>}
            {b.bookingCode && <span className="shrink-0 font-mono text-[11px] text-slate-400">{b.bookingCode}</span>}
          </p>
        </div>

        <div className="col-start-2 col-end-4 grid items-end gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:gap-3 md:hidden">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              {fmtDate(b.checkIn)} <span className="text-slate-300">→</span> {fmtDate(b.checkOut)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{roomSummary}{b.roomName ? ` · ${b.roomName}` : ""}</span>
            </p>
          </div>
          <div className="text-left min-[420px]:text-right">
            <p className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">
              {fmtMoney(payable, b.currency)}
            </p>
            <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-400">
              {needsApproval ? "proposed payable" : "platform payable"}
            </p>
          </div>
        </div>

        <div className="hidden md:col-start-3 md:block">
          <p className="whitespace-nowrap text-[12px] font-medium text-slate-700">
            {fmtDate(b.checkIn)} <span className="text-slate-300">→</span> {fmtDate(b.checkOut)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">{roomSummary}</p>
        </div>

        <div className="hidden min-w-0 lg:col-start-4 lg:block">
          <p className="truncate text-[12px] text-slate-700">{b.roomName || "Room to advise"}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{b.leadGuestName || "Guest not added"}</p>
        </div>

        <div className="hidden text-right md:col-start-4 md:block lg:col-start-5">
          {/* Only ever the tenant's payable — supplierTotal and platformEarning are absent from the
              tenant DTO by design, not merely hidden by the UI. */}
          <p className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">
            {fmtMoney(payable, b.currency)}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[11px] text-slate-400">
            {needsApproval ? "proposed payable" : "platform payable"}
          </p>
        </div>

        <div className="col-start-3 row-start-1 flex items-center justify-end gap-1 md:col-start-5 md:row-auto lg:col-start-6">
          <StatusDot status={b.status} className="justify-end" />
          <ChevronRight className="h-4 w-4 text-slate-300 md:hidden" aria-hidden="true" />
        </div>

        <ChevronRight
          className="hidden h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 md:col-start-6 md:block lg:col-start-7"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

/**
 * The tenant's running balance with the platform.
 *
 * <h3>Why this is here at all</h3>
 * The platform can now refuse to confirm a request that would take a tenant past their credit
 * ceiling. A limit a tenant cannot see is a limit they will hit without warning, mid-booking, with
 * a customer on the phone — so the number that governs the refusal has to be on the screen where
 * they place the orders.
 *
 * <h3>Two shapes, because "no limit" is not "zero limit"</h3>
 * `enforced:false` means the platform is not applying a ceiling to this tenant — the common case
 * today, since a tenant with no configured row is deliberately not gated. Rendering a limit there
 * would present a number as binding when nothing is enforcing it, so the strip shows the balance
 * alone. Only when a ceiling is actually in force does it show headroom.
 *
 * Nothing renders at all when there is no balance and no ceiling: a debt-free tenant does not need
 * a panel telling them so.
 */
function CreditSummary({ credit }) {
  if (!credit) return null;

  const outstanding = Number(credit.outstanding ?? 0);
  const enforced = !!credit.enforced;
  if (outstanding <= 0 && !enforced) return null;

  const limit = Number(credit.creditLimit ?? 0);
  const available = Number(credit.available ?? 0);
  const tight = enforced && (available <= 0 || available < limit * 0.15);
  const availablePercent = limit > 0
    ? Math.min(100, Math.max(0, (available / limit) * 100))
    : 0;

  return (
    <section
      aria-label="Platform balance"
      className={cn(
        "mb-5 overflow-hidden rounded-xl border bg-slate-50/70",
        tight ? "border-amber-200" : "border-slate-200",
      )}
    >
      <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,.7fr)] sm:items-center sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500">
            <WalletCards className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">Outstanding with the platform</p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-lg font-semibold tabular-nums tracking-[-0.02em] text-slate-900">
                {fmtMoney(outstanding, credit.currency)}
              </p>
              {credit.unsettledBookings > 0 && (
                <p className="text-[11px] text-slate-400">
                  across {credit.unsettledBookings} booking{credit.unsettledBookings === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>
        </div>

        {enforced && (
          <div className="border-t border-slate-200 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium text-slate-500">Available credit</p>
              <p className={cn("text-sm font-semibold tabular-nums", tight ? "text-amber-800" : "text-slate-800")}>
                {fmtMoney(available, credit.currency)}
              </p>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label="Available marketplace credit"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={Math.max(0, available)}
            >
              <div
                className={cn("h-full rounded-full", tight ? "bg-amber-500" : "bg-slate-500")}
                style={{ width: `${availablePercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-slate-400">
              Limit {fmtMoney(limit, credit.currency)}
            </p>
          </div>
        )}
      </div>

      {enforced && available <= 0 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900 sm:px-5">
          New requests may be declined until part of this balance is settled. Contact the platform if you need more credit.
        </div>
      )}
    </section>
  );
}

export default MarketplaceBookings;
