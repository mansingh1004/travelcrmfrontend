// src/features/marketplace/pages/MarketplaceBookingDetail.jsx
//
// One booking request, as the tenant sees it.
//
// Everything rendered here comes from MarketplaceBookingTenantDto, which omits `supplierTotal` and
// `platformEarning` at the class level rather than hiding them with annotations — so there is no way
// for this page to leak the platform's economics even by accident. The tenant sees what they owe,
// what they quoted, and what they're charging their own customer.
//
// A foreign publicId returns 404, never data (MarketplaceBookingRequestService.getMine), so a 404
// here is rendered as "not found" and never as an authorization message that would confirm the row
// exists for somebody else.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, ExternalLink } from "lucide-react";
import { marketplaceService } from "../api/marketplaceService";
import {
  BackLink, Button, Empty, Loading, Notice, Page, PageHeader, Row, RowGroup, SectionLabel,
  StatusDot, errMsg, fmtDate, fmtDateTime, fmtMoney, useToast,
} from "../components/marketplaceUi";

export function MarketplaceBookingDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBooking(await marketplaceService.getMyBooking(publicId));
    } catch (e) {
      // 404 is silent in the shared interceptor; the empty state below is the message.
      const status = e?.response?.status ?? e?.status;
      if (status !== 404) showToast(errMsg(e, "Could not load this request."), "error");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Page width="max-w-3xl"><Loading label="Loading request…" /></Page>;

  if (!booking) {
    return (
      <Page width="max-w-3xl">
        <Empty
          icon={Building2}
          title="Request not found"
          hint="It may have been removed, or it belongs to another account."
          action={<Button onClick={() => navigate("/marketplace/bookings")}>Back to requests</Button>}
        />
      </Page>
    );
  }

  const b = booking;
  const payable = Number(b.tenantPayable);
  const selling = Number(b.tenantCustomerSellingAmount);
  const margin = Number.isFinite(payable) && Number.isFinite(selling) ? selling - payable : null;
  const repriced =
    b.quotedTenantPayable != null &&
    b.tenantPayable != null &&
    Number(b.quotedTenantPayable) !== Number(b.tenantPayable);

  return (
    <Page width="max-w-3xl">
      <PageHeader
        back={<BackLink onClick={() => navigate("/marketplace/bookings")}>Requests</BackLink>}
        title={b.hotelName}
        subtitle={[b.cityName, b.bookingCode].filter(Boolean).join(" · ")}
        actions={<StatusDot status={b.status} />}
      />

      {/* ── State-specific messages ─────────────────────────────────────── */}

      {b.status === "REQUESTED" && (
        <Notice className="mb-5">
          Waiting for the platform to check availability with the supplier. The hotel is
          <span className="font-medium"> not confirmed</span> yet.
        </Notice>
      )}

      {b.status === "UNDER_REVIEW" && (
        <Notice className="mb-5">
          The platform is checking this with the supplier now.
        </Notice>
      )}

      {b.status === "TENANT_APPROVAL_REQUIRED" && (
        <Notice tone="warn" className="mb-5">
          <p className="font-medium">The price changed — this needs your answer.</p>
          {b.priceRevisionReason && <p className="mt-1">{b.priceRevisionReason}</p>}
          <p className="mt-1">
            Quoted {fmtMoney(b.quotedTenantPayable, b.currency)} → now{" "}
            <span className="font-medium">{fmtMoney(b.tenantPayable, b.currency)}</span>. Nothing is
            confirmed and no room is held until this is resolved. Contact the platform to accept or
            decline — whether you absorb the difference or re-quote your customer is your call.
          </p>
        </Notice>
      )}

      {b.status === "CONFIRMED" && (
        <Notice tone="success" className="mb-5">
          <p className="font-medium">Confirmed with the supplier.</p>
          {b.supplierConfirmationNumber && (
            <p className="mt-1">
              Hotel confirmation number{" "}
              <span className="font-medium">{b.supplierConfirmationNumber}</span>.
            </p>
          )}
        </Notice>
      )}

      {b.status === "REJECTED" && (
        <Notice tone="error" className="mb-5">
          <p className="font-medium">This request was not accepted.</p>
          {b.rejectionReason && <p className="mt-1">{b.rejectionReason}</p>}
          <p className="mt-1">
            Your booking was left in place so you can send a request for a different hotel against it.
          </p>
        </Notice>
      )}

      {/* ── Stay ────────────────────────────────────────────────────────── */}

      <SectionLabel>Stay</SectionLabel>
      <RowGroup>
        <Row label="Dates">
          <span className="text-sm text-slate-900">
            {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
          </span>
          <span className="ml-2 text-[13px] text-slate-400">
            {b.nights} night{b.nights === 1 ? "" : "s"}
          </span>
        </Row>
        <Row label="Room"><span className="text-sm text-slate-900">{b.roomName || "Platform to advise"}</span></Row>
        <Row label="Meal plan"><span className="text-sm text-slate-900">{b.mealPlan || "Platform to advise"}</span></Row>
        <Row label="Occupancy">
          <span className="text-sm text-slate-900">
            {b.rooms} room{b.rooms === 1 ? "" : "s"} · {b.adults} adult{b.adults === 1 ? "" : "s"}
            {b.children > 0 ? ` · ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}
          </span>
        </Row>
        {b.address && <Row label="Address"><span className="text-sm text-slate-700">{b.address}</span></Row>}
      </RowGroup>

      {/* ── Guest ───────────────────────────────────────────────────────── */}

      <SectionLabel className="mt-8">Lead guest</SectionLabel>
      <RowGroup>
        <Row label="Name"><span className="text-sm text-slate-900">{b.leadGuestName}</span></Row>
        {b.leadGuestPhone && <Row label="Phone"><span className="text-sm text-slate-700">{b.leadGuestPhone}</span></Row>}
        {b.leadGuestEmail && <Row label="Email"><span className="text-sm text-slate-700">{b.leadGuestEmail}</span></Row>}
        {b.specialRequests && (
          <Row label="Special requests" align="top">
            <span className="text-sm leading-relaxed text-slate-700">{b.specialRequests}</span>
          </Row>
        )}
      </RowGroup>

      {/* ── Money ───────────────────────────────────────────────────────── */}

      <SectionLabel className="mt-8">Money</SectionLabel>
      <RowGroup>
        <Row
          label="You owe the platform"
          hint={repriced ? `Quoted ${fmtMoney(b.quotedTenantPayable, b.currency)} when you submitted` : undefined}
        >
          <span className="text-sm font-medium tabular-nums text-slate-900">
            {fmtMoney(b.tenantPayable, b.currency)}
          </span>
        </Row>
        <Row label="Your price to customer">
          <span className="text-sm tabular-nums text-slate-900">
            {fmtMoney(b.tenantCustomerSellingAmount, b.currency)}
          </span>
        </Row>
        {margin !== null && (
          <Row label="Your margin" hint="Your selling price less what you owe the platform.">
            <span className={`text-sm tabular-nums ${margin < 0 ? "text-red-600" : "text-slate-900"}`}>
              {fmtMoney(margin, b.currency)}
            </span>
          </Row>
        )}
      </RowGroup>

      {/* ── Links & terms ───────────────────────────────────────────────── */}

      <SectionLabel className="mt-8">Booking</SectionLabel>
      <RowGroup>
        <Row label="CRM booking">
          {b.crmBookingPublicId ? (
            <button
              type="button"
              onClick={() => navigate(`/BookingDetails/${b.crmBookingPublicId}`)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-900 underline-offset-2 hover:underline"
            >
              {b.crmBookingCode || "Open booking"} <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </button>
          ) : (
            <span className="text-sm text-slate-400">Not linked yet</span>
          )}
        </Row>
        <Row label="Requested"><span className="text-sm text-slate-700">{fmtDateTime(b.createdAt)}</span></Row>
        {b.approvedAt && (
          <Row label="Confirmed"><span className="text-sm text-slate-700">{fmtDateTime(b.approvedAt)}</span></Row>
        )}
        {b.cancellationTerms && (
          <Row label="Cancellation terms" align="top">
            <span className="text-sm leading-relaxed text-slate-700">{b.cancellationTerms}</span>
          </Row>
        )}
      </RowGroup>
    </Page>
  );
}

export default MarketplaceBookingDetail;
