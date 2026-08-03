// src/features/marketplace/pages/MarketplaceBookings.jsx
//
// The tenant's own hotel booking requests, newest first.
//
// NOTE — there is deliberately NO status filter. `GET /api/hotel-marketplace/bookings` takes only
// `page` and `size` (MarketplaceBookingController.java:45-54), so any filter here could narrow only
// the rows already loaded. That is the trap CLAUDE.md records against AllLeads: a control that looks
// like it filters the dataset but silently filters one page of it. When the endpoint grows a
// `status` param, add tabs backed by it — not before.
//
// What IS surfaced is the one state that needs the tenant to act: TENANT_APPROVAL_REQUIRED. A
// revised price sits there doing nothing until somebody answers it.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import { marketplaceService } from "../api/marketplaceService";
import {
  Button, Card, Empty, Notice, Page, PageHeader, Pager, SkeletonRows, StatusDot,
  errMsg, fmtDate, fmtMoney, useToast,
} from "../components/marketplaceUi";

const PAGE_SIZE = 20;

export function MarketplaceBookings() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, pagination: meta } = await marketplaceService.listMyBookings({ page, size: PAGE_SIZE });
      setRows(items);
      setPagination(meta);
    } catch (e) {
      showToast(errMsg(e, "Could not load your booking requests."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => { load(); }, [load]);

  const awaiting = rows.filter((r) => r.status === "TENANT_APPROVAL_REQUIRED");

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

      {awaiting.length > 0 && (
        <Notice tone="warn" className="mb-5">
          {awaiting.length === 1
            ? "One request has a revised price waiting for your answer."
            : `${awaiting.length} requests have a revised price waiting for your answer.`}{" "}
          Nothing moves until you accept or decline.
        </Notice>
      )}

      <Card flush>
        {loading ? (
          <div className="px-4 py-2"><SkeletonRows count={6} /></div>
        ) : rows.length === 0 ? (
          <Empty
            icon={Building2}
            title="No booking requests yet"
            hint="Find a hotel in the platform catalog and send a request. The platform confirms it with the supplier."
            action={<Button variant="primary" onClick={() => navigate("/marketplace")}>Browse catalog</Button>}
          />
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
