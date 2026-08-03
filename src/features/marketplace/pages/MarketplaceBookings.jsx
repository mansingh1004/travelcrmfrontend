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
import { Building2, Search } from "lucide-react";
import { marketplaceService } from "../api/marketplaceService";
import {
  BOOKING_STATUS, Button, Card, Empty, Notice, Page, PageHeader, Pager, SkeletonRows, StatusDot,
  Tabs, errMsg, fmtDate, fmtMoney, useToast,
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

  return (
    <Page>
      <PageHeader
        title="Hotel booking requests"
        subtitle="Requests you've sent to the platform. Only the platform can confirm a hotel."
        actions={
          <Button onClick={() => navigate("/marketplace")}>
            <Search /> Browse catalog
          </Button>
        }
      />

      {/* Already looking at them? Then the list is the message — a banner above it is noise. */}
      {awaitingCount > 0 && status !== AWAITING && (
        <Notice tone="warn" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {awaitingCount === 1
                ? "One request has a revised price waiting for your answer."
                : `${awaitingCount} requests have a revised price waiting for your answer.`}{" "}
              Nothing moves until you accept or decline.
            </span>
            <Button size="sm" onClick={() => changeStatus(AWAITING)}>Show them</Button>
          </div>
        </Notice>
      )}

      <Tabs options={tabs} value={status} onChange={changeStatus} className="mb-4" />

      <Card flush>
        {loading ? (
          <div className="px-4 py-2"><SkeletonRows count={6} /></div>
        ) : rows.length === 0 ? (
          status ? (
            <Empty
              icon={Building2}
              title={`No ${(BOOKING_STATUS[status]?.label ?? status).toLowerCase()} requests`}
              hint="Nothing of yours is in this state right now."
              action={<Button onClick={() => changeStatus("")}>Show all requests</Button>}
            />
          ) : (
            <Empty
              icon={Building2}
              title="No booking requests yet"
              hint="Find a hotel in the platform catalog and send a request. The platform confirms it with the supplier."
              action={<Button variant="primary" onClick={() => navigate("/marketplace")}>Browse catalog</Button>}
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.publicId}>
                <button
                  type="button"
                  onClick={() => navigate(`/marketplace/bookings/${r.publicId}`)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{r.hotelName}</p>
                    <p className="mt-0.5 truncate text-[13px] text-slate-500">
                      {[r.cityName, r.bookingCode].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  <div className="hidden w-44 shrink-0 sm:block">
                    <p className="text-[13px] text-slate-700">
                      {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {r.nights} night{r.nights === 1 ? "" : "s"} · {r.rooms} room{r.rooms === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="hidden w-32 shrink-0 text-right md:block">
                    {/* Only ever the tenant's payable — supplierTotal and platformEarning are absent
                        from MarketplaceBookingTenantDto by design, not hidden by the UI. */}
                    <p className="text-[13px] tabular-nums text-slate-700">
                      {fmtMoney(r.tenantPayable, r.currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">you owe</p>
                  </div>

                  <div className="w-36 shrink-0 text-right">
                    <StatusDot status={r.status} className="justify-end" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pager
        page={pagination?.page ?? page}
        totalPages={pagination?.totalPages ?? 1}
        total={pagination?.totalElements ?? rows.length}
        onPage={setPage}
      />
    </Page>
  );
}

export default MarketplaceBookings;
