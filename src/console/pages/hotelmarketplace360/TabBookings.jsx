// src/console/pages/hotelmarketplace360/TabBookings.jsx
//
// Every tenant's bookings on THIS property, in one list.
//
// The endpoint has always accepted `hotelPublicId`; no client ever sent it, so answering "who has
// booked this hotel" meant opening the global booking queue and filtering by eye. The only change
// needed on the server was none.
//
// CROSS-TENANT BY DESIGN, AND ONLY HERE. This lists which agency booked what, which is exactly the
// thing a hotel-partner-facing screen must never show: a property must not learn which agencies sell
// it or on what terms. This surface is `hasRole('SUPER_ADMIN')` and must stay that way — if any of
// this is ever reused for a partner view, the tenant column is the first thing to remove.
//
// NO MONEY, deliberately. A per-hotel booking count beside any revenue figure divides into an average
// rate, which is the back-calculation the four-layer pricing separation exists to prevent. Counts and
// dates only; the money lives on the booking's own admin page, which is reachable from each row.
//
// STYLING: console realm. Semantic utilities only.

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { marketplaceBookingService } from "../../api/marketplaceBookingService";
import { Button, GlassCard, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/hotelUi";
import StatusPill from "../../components/StatusPill";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

const PAGE_SIZE = 25;

/** Mirrors MarketplaceBookingStatus. "" is every status, which is the default an operator wants. */
const STATUSES = [
  "", "REQUESTED", "UNDER_REVIEW", "TENANT_APPROVAL_REQUIRED", "TENANT_ACCEPTED",
  "CONFIRMED", "REJECTED", "CANCEL_REQUESTED", "CANCELLATION_QUOTED", "CANCELLED", "EXPIRED",
];

const human = (v) => {
  const s = String(v ?? "").replace(/_/g, " ").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Any status";
};

export default function TabBookings({ hotel, publicId }) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceBookingService.list({
        page, size: PAGE_SIZE, hotelPublicId: publicId, status: status || undefined,
      });
      setRows(res.items);
      setPagination(res.pagination);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load bookings."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  const total = pagination?.totalElements ?? rows?.length ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-extrabold text-heading">Bookings on this property</h2>
            <p className="mt-0.5 text-xs text-muted">
              Across every tenant. {total} booking{total === 1 ? "" : "s"}
              {status ? ` · ${human(status)}` : ""}.
            </p>
          </div>
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className="w-52"
          >
            {STATUSES.map((s) => <option key={s || "any"} value={s}>{human(s)}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-5 py-12 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-heading">No bookings</p>
            <p className="mt-1 text-xs text-muted">
              {status
                ? "No booking on this property is in that status."
                : `Nobody has booked ${hotel?.name ?? "this property"} through the platform yet.`}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-right">Rooms</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.publicId}>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-heading">{b.bookingCode}</span>
                  </TableCell>
                  {/* Cross-tenant, and the reason this screen is SuperAdmin-only. */}
                  <TableCell className="text-body">{b.tenantName ?? b.tenantCode ?? "—"}</TableCell>
                  <TableCell className="text-body">{b.roomName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-body">{b.rooms ?? 1}</TableCell>
                  <TableCell className="whitespace-nowrap text-body">
                    {b.checkIn} <span className="text-muted">→</span> {b.checkOut}
                    {b.nights != null && <span className="ml-1 text-xs text-muted">({b.nights}n)</span>}
                  </TableCell>
                  <TableCell><StatusPill value={b.status} /></TableCell>
                  <TableCell className="text-right">
                    {/* Out to the booking's own page, which owns the money and the decisions. This
                        tab deliberately shows neither. */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/console/hotel-bookings/${b.publicId}`)}
                      aria-label={`Open booking ${b.bookingCode}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && rows.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-xs tabular-nums text-muted">Page {page + 1} of {totalPages} · {total} total</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
