import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FlaskConical,
  RefreshCw,
  TicketCheck,
} from "lucide-react";
import { getErrorMessage, isAlreadyReported, isCanceled } from "@shared/api/apiError";
import Pager from "@shared/ui/Pager";
import { toast } from "@shared/ui/toast";
import hotelOperationService from "../api/hotelOperationService";
import HotelBookingOperationsTable from "../components/HotelBookingOperationsTable";
import HotelOperationDrawer from "../components/HotelOperationDrawer";
import HotelOperationFilters from "../components/HotelOperationFilters";
import HotelOperationMetrics from "../components/HotelOperationMetrics";
import MockHotelPropertyOverview from "../components/MockHotelPropertyOverview";
import { Notice, Page, PageHeader } from "../components/hotelOperationUi";
import { BOOKING_STATUS, STATUS_TABS } from "../lib/hotelOperationModel";

const DEFAULT_SIZE = 25;
const VALID_STATUSES = new Set(STATUS_TABS.map((tab) => tab.key));

export default function HotelOperations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryStatus = searchParams.get("status") || "ALL";
  const status = VALID_STATUSES.has(queryStatus) ? queryStatus : "ALL";
  const openBookingId = searchParams.get("booking");
  const mockParam = searchParams.get("mock");
  // Opening the sidebar destination in local development should immediately provide a populated
  // screen for UI review. Production remains live-by-default; `?mock=1` is still an explicit demo.
  const mockMode = mockParam === "1" || (import.meta.env.DEV && mockParam === null);
  const selectedBrandId = mockMode ? searchParams.get("brand") : null;
  const selectedHotelId = mockMode ? searchParams.get("hotel") : null;

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hotelRollups, setHotelRollups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rollupsLoading, setRollupsLoading] = useState(mockMode);
  const [listError, setListError] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_SIZE);
  const [refreshKey, setRefreshKey] = useState(0);

  const setQuery = useCallback((changes, options = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === "" || value === "ALL") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, options);
  }, [setSearchParams]);

  const changeStatus = useCallback((nextStatus) => {
    setPage(0);
    setQuery({ status: nextStatus, booking: null });
  }, [setQuery]);

  const openBooking = useCallback((publicId) => {
    setQuery({ booking: publicId });
  }, [setQuery]);

  const closeBooking = useCallback(() => {
    setQuery({ booking: null });
  }, [setQuery]);

  const selectBrand = useCallback((brandId) => {
    setPage(0);
    setQuery({ brand: brandId, hotel: null, booking: null });
  }, [setQuery]);

  const selectHotel = useCallback((brandId, hotelPublicId) => {
    setPage(0);
    setQuery({ brand: brandId, hotel: hotelPublicId, booking: null });
  }, [setQuery]);

  const clearHotelScope = useCallback(() => {
    setPage(0);
    setQuery({ brand: null, hotel: null, booking: null });
  }, [setQuery]);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const toggleMockMode = useCallback(() => {
    setPage(0);
    // `mock=0` is intentional: removing the key in development would select its default mock mode.
    setQuery({ mock: mockMode ? "0" : "1", brand: null, hotel: null, booking: null });
  }, [mockMode, setQuery]);

  const changePageSize = useCallback((nextSize) => {
    setPage(0);
    setPageSize(nextSize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const frame = window.requestAnimationFrame(() => {
      if (!alive) return;
      setLoading(true);
      setListError(null);

      hotelOperationService
        .getBookings(
          {
            page,
            size: pageSize,
            status: status === "ALL" ? undefined : status,
            mock: mockMode,
            brandId: selectedBrandId || undefined,
            hotelPublicId: selectedHotelId || undefined,
          },
          { signal: controller.signal },
        )
        .then((result) => {
          if (!alive) return;
          setRows(result.items);
          setPagination(result.pagination);
        })
        .catch((error) => {
          if (!alive || isCanceled(error)) return;
          setRows([]);
          setPagination(null);
          setListError(error);
          if (!isAlreadyReported(error)) {
            toast.error(getErrorMessage(error, "Could not load platform hotel bookings."));
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    });

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [page, pageSize, status, mockMode, selectedBrandId, selectedHotelId, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const frame = window.requestAnimationFrame(() => {
      if (!alive) return;
      setSummaryLoading(true);

      hotelOperationService
        .getSummary({
          signal: controller.signal,
          mock: mockMode,
          brandId: selectedBrandId || undefined,
          hotelPublicId: selectedHotelId || undefined,
        })
        .then((data) => {
          if (alive) setSummary(data);
        })
        .catch((error) => {
          if (!alive || isCanceled(error)) return;
          setSummary(null);
          if (!isAlreadyReported(error)) {
            toast.error(getErrorMessage(error, "Could not load hotel operations summary."));
          }
        })
        .finally(() => {
          if (alive) setSummaryLoading(false);
        });
    });

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [mockMode, selectedBrandId, selectedHotelId, refreshKey]);

  useEffect(() => {
    let alive = true;
    const frame = window.requestAnimationFrame(() => {
      if (!alive) return;

      if (!mockMode) {
        setHotelRollups([]);
        setRollupsLoading(false);
        return;
      }

      setRollupsLoading(true);
      hotelOperationService
        .getHotelRollups({ mock: true })
        .then((data) => {
          if (alive) setHotelRollups(data);
        })
        .catch((error) => {
          if (!alive || isCanceled(error)) return;
          setHotelRollups([]);
          if (!isAlreadyReported(error)) {
            toast.error(getErrorMessage(error, "Could not load the demo hotel hierarchy."));
          }
        })
        .finally(() => {
          if (alive) setRollupsLoading(false);
        });
    });

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
    };
  }, [mockMode, refreshKey]);

  const activeLabel = useMemo(() => {
    if (status === "ALL") return "All";
    return BOOKING_STATUS[status]?.label || STATUS_TABS.find((tab) => tab.key === status)?.label || status;
  }, [status]);

  const selectedScope = useMemo(() => {
    const brand = hotelRollups.find((item) => item.brandId === selectedBrandId);
    const property = brand?.properties.find((item) => item.hotelPublicId === selectedHotelId);
    if (property) {
      return {
        title: `${property.hotelName}, ${property.locationName}`,
        description: `${property.totalBookings} mock bookings for this physical property`,
      };
    }
    if (brand) {
      return {
        title: `${brand.brandName} - all locations`,
        description: `${brand.totalBookings} mock bookings across ${brand.properties.length} properties`,
      };
    }
    return null;
  }, [hotelRollups, selectedBrandId, selectedHotelId]);

  const bookingListLabel = selectedScope ? `${selectedScope.title} - ${activeLabel}` : activeLabel;

  const total = pagination?.totalElements ?? rows.length;
  const totalPages = pagination?.totalPages ?? (total ? 1 : 0);
  const currentPage = pagination?.page ?? page;
  const currentSize = pagination?.size ?? pageSize;

  return (
    <Page width="max-w-[1800px]" className="hotel-operations-page">
      <PageHeader
        title="Hotel Operations"
        subtitle={`${mockMode ? "Demo workspace" : "Current tenant"} · Platform hotels only · Location and property stay visible throughout the workflow`}
        className="mb-5"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={toggleMockMode}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold shadow-sm transition ${
                  mockMode
                    ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700"
                }`}
              >
                <FlaskConical className="h-4 w-4" />
                {mockMode ? "Use live data" : "Preview demo data"}
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={loading || summaryLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading || summaryLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        <HotelOperationMetrics summary={summary} loading={summaryLoading} onFilter={changeStatus} />

        <ActionRequired summary={summary} loading={summaryLoading} status={status} onFilter={changeStatus} />

        {mockMode ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-xs leading-relaxed text-violet-900">
            <div className="flex items-start gap-2.5">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <div>
                <p className="font-bold">Demo data is active.</p>
                <p className="mt-0.5 text-violet-700">No booking API calls are made in this mode. Remove <span className="font-mono">mock=1</span> or use the header button to return to live tenant data.</p>
              </div>
            </div>
          </div>
        ) : (
          <Notice>
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-slate-800">Operational aggregation is partially available.</p>
                <p className="mt-0.5 text-slate-600">
                  Booking and status counts are live and server-paginated. Date, location, property, guest/room,
                  check-in/out, voucher and in-house totals need a backend Hotel Operations read API; this screen
                  deliberately does not calculate misleading totals from the visible page.
                </p>
              </div>
            </div>
          </Notice>
        )}

        {mockMode && (
          <MockHotelPropertyOverview
            groups={hotelRollups}
            loading={rollupsLoading}
            selectedBrandId={selectedBrandId}
            selectedHotelId={selectedHotelId}
            onSelectBrand={selectBrand}
            onSelectHotel={selectHotel}
            onClear={clearHotelScope}
          />
        )}

        {selectedScope && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div>
              <p className="text-xs font-extrabold text-blue-900">Showing: {selectedScope.title}</p>
              <p className="mt-0.5 text-[11px] font-medium text-blue-700">{selectedScope.description}</p>
            </div>
            <button
              type="button"
              onClick={clearHotelScope}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
            >
              Clear hotel filter
            </button>
          </div>
        )}

        <HotelOperationFilters
          status={status}
          onStatus={changeStatus}
          approvalCount={summary?.actionRequired?.tenantApprovalRequired}
          loading={loading}
        />

        {listError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p className="font-semibold">{getErrorMessage(listError, "Could not load platform hotel bookings.")}</p>
            <button type="button" onClick={refresh} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Try again</button>
          </div>
        )}

        <HotelBookingOperationsTable
          rows={rows}
          loading={loading}
          activeLabel={bookingListLabel}
          onOpen={openBooking}
          onClear={status === "ALL" ? null : () => changeStatus("ALL")}
        />

        <Pager
          page={currentPage}
          totalPages={totalPages}
          total={total}
          pageSize={currentSize}
          onPage={setPage}
          onPageSize={changePageSize}
          loading={loading}
          sizeOptions={[10, 25, 50]}
          label="platform hotel bookings"
        />
      </div>

      <HotelOperationDrawer publicId={openBookingId} mock={mockMode} onClose={closeBooking} />
    </Page>
  );
}

function ActionRequired({ summary, loading, status, onFilter }) {
  const action = summary?.actionRequired || {};
  const items = [
    {
      key: "tenantApprovalRequired",
      label: "Price approval required",
      hint: "Your response is required",
      status: "TENANT_APPROVAL_REQUIRED",
      Icon: CheckCircle2,
      tone: "text-orange-700 bg-orange-50 ring-orange-100",
    },
    {
      key: "requested",
      label: "New requests",
      hint: "Sent to the platform",
      status: "REQUESTED",
      Icon: Building2,
      tone: "text-amber-700 bg-amber-50 ring-amber-100",
    },
    {
      key: "underReview",
      label: "Under review",
      hint: "Hotel confirmation in progress",
      status: "UNDER_REVIEW",
      Icon: Clock3,
      tone: "text-blue-700 bg-blue-50 ring-blue-100",
    },
    {
      key: "cancelRequested",
      label: "Cancellation pending",
      hint: "Awaiting platform outcome",
      status: "CANCEL_REQUESTED",
      Icon: AlertTriangle,
      tone: "text-rose-700 bg-rose-50 ring-rose-100",
    },
    {
      key: "paymentPending",
      source: summary,
      label: "Unsettled payments",
      hint: "From marketplace credit",
      Icon: CreditCard,
      tone: "text-violet-700 bg-violet-50 ring-violet-100",
    },
    {
      key: "voucherPending",
      source: summary,
      label: "Voucher pending",
      hint: "Aggregate API pending",
      Icon: TicketCheck,
      tone: "text-slate-600 bg-slate-50 ring-slate-100",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Action required</h2>
          <p className="mt-0.5 text-xs text-slate-500">Select a live item to filter the complete booking dataset.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 2xl:grid-cols-6">
        {items.map((item) => {
          const source = item.source || action;
          const value = source?.[item.key];
          const available = value !== null && value !== undefined;
          const interactive = available && Boolean(item.status);
          const active = item.status === status;
          return (
            <button
              key={item.key}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onFilter(item.status)}
              aria-pressed={active || undefined}
              className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${
                active ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"
              } ${interactive ? "hover:border-blue-300 hover:bg-slate-50" : "cursor-default"}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${item.tone}`}>
                <item.Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-extrabold text-slate-700">{item.label}</span>
                  {loading ? <span className="h-4 w-6 animate-pulse rounded bg-slate-100" /> : (
                    <strong className={`text-base tabular-nums ${available ? "text-slate-900" : "text-slate-300"}`}>{available ? value : "—"}</strong>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
