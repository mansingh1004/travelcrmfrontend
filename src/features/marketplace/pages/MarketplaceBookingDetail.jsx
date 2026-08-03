// src/features/marketplace/pages/MarketplaceBookingDetail.jsx
//
// One booking request, as the tenant sees it — and the only screen where they answer the platform.
//
// Everything rendered here comes from MarketplaceBookingTenantDto, which omits `supplierTotal` and
// `platformEarning` at the class level rather than hiding them with annotations — so there is no way
// for this page to leak the platform's economics even by accident. The tenant sees what they owe,
// what they quoted, and what they're charging their own customer.
//
// A foreign publicId returns 404, never data (MarketplaceBookingRequestService.getMine), so a 404
// here is rendered as "not found" and never as an authorization message that would confirm the row
// exists for somebody else.
//
// Three actions live here, and each one 409s on a real, expected condition (offer expired, already
// decided, wrong state). The shared interceptor is silent on 409, so every catch below renders the
// server's message itself — see the error policy in shared/api/authRealm.js.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Download, ExternalLink } from "lucide-react";
import { hasPermission, P } from "@shared/lib/access";
import { downloadBlob } from "@shared/lib/download";
import { marketplaceService } from "../api/marketplaceService";
import {
  BackLink, Button, Card, Empty, Loading, Modal, Notice, Page, PageHeader, Row, RowGroup,
  SectionLabel, StatusDot, Textarea, cn, errMsg, fmtDate, fmtDateTime, fmtMoney, isAlreadyReported,
  useToast,
} from "../components/marketplaceUi";

/**
 * States the server will let the tenant end — MarketplaceBookingStatus.TENANT_WITHDRAWABLE plus
 * CONFIRMED, which becomes a cancellation *request* instead.
 *
 * REJECTED/CANCELLED/EXPIRED are terminal and CANCEL_REQUESTED is already in flight; all four answer
 * 409, so offering the button there would only produce a dead end.
 */
const ENDABLE = new Set([
  "REQUESTED", "UNDER_REVIEW", "TENANT_APPROVAL_REQUIRED", "TENANT_ACCEPTED", "CONFIRMED",
]);

export function MarketplaceBookingDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);        // "accept" | "decline" | "cancel"
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [downloading, setDownloading] = useState(false);

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

  /**
   * Run one of the three writes, then RE-READ the row.
   *
   * Never patch local state from the response: the server may have moved the request further than the
   * transition we asked for (an approval can land between the click and the reload), and on a 409 the
   * state we were rendering is exactly the thing that turned out to be stale — so the reload runs on
   * failure too.
   */
  const runAction = useCallback(async (fn, successMessage, fallback) => {
    setBusy(true);
    try {
      await fn();
      showToast(successMessage);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, fallback), "error");
    } finally {
      setBusy(false);
      setModal(null);
      load();
    }
  }, [load, showToast]);

  const saveVoucher = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await marketplaceService.downloadVoucher(publicId);
      downloadBlob(blob, `hotel-voucher-${booking?.voucherNumber || publicId}.pdf`);
    } catch (e) {
      // 404 until the platform issues it, and 404 is silent in the interceptor.
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not download the voucher."), "error");
    } finally {
      setDownloading(false);
    }
  }, [publicId, booking?.voucherNumber, showToast]);

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

  // An open offer. `tenantPayable` is still the OLD number until acceptance — the proposal lives in
  // `revisedTenantPayable`, and `revisionPreviousPayable` is what it would replace.
  const awaitingAnswer = b.status === "TENANT_APPROVAL_REQUIRED";
  const revised = b.revisedTenantPayable;
  const previous = b.revisionPreviousPayable ?? b.tenantPayable;
  const delta =
    revised != null && previous != null && Number.isFinite(Number(revised)) && Number.isFinite(Number(previous))
      ? Number(revised) - Number(previous)
      : null;
  // The server 409s an expired acceptance, so an offer past its deadline must not be offered as live.
  const revisionExpired =
    !!b.revisionExpiresAt && new Date(b.revisionExpiresAt).getTime() < Date.now();

  const canAnswer = hasPermission(P.HOTEL_MARKETPLACE_BOOK);
  const canEnd = hasPermission(P.HOTEL_MARKETPLACE_CANCEL);
  // CONFIRMED is a *request* to cancel that the platform settles with the hotel; anything earlier is
  // a free, immediate withdrawal. Same endpoint — the difference is only what we promise the user.
  const isCancelRequest = b.status === "CONFIRMED";
  const showEndButton = canEnd && ENDABLE.has(b.status);
  const endLabel = isCancelRequest ? "Request cancellation" : "Withdraw request";

  return (
    <Page width="max-w-3xl">
      <PageHeader
        back={<BackLink onClick={() => navigate("/marketplace/bookings")}>Requests</BackLink>}
        title={b.hotelName}
        subtitle={[b.cityName, b.bookingCode].filter(Boolean).join(" · ")}
        actions={
          <>
            <StatusDot status={b.status} />
            {showEndButton && (
              <Button variant="dangerQuiet" onClick={() => { setCancelReason(""); setModal("cancel"); }}>
                {endLabel}
              </Button>
            )}
          </>
        }
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

      {b.status === "TENANT_ACCEPTED" && (
        <Notice className="mb-5">
          You accepted the revised price. Back with the platform for final confirmation — the hotel is
          <span className="font-medium"> not confirmed</span> yet.
        </Notice>
      )}

      {b.status === "CANCEL_REQUESTED" && (
        <Notice tone="warn" className="mb-5">
          <p className="font-medium">Cancellation requested — the platform is confirming the charge with the hotel.</p>
          <p className="mt-1">
            Until it comes back, the room is still held and what you owe still stands. You'll see the
            charge and any refund here once it's settled.
          </p>
          {b.cancelRequestedAt && (
            <p className="mt-1 text-[12px] text-amber-800">
              Asked on {fmtDateTime(b.cancelRequestedAt)}
              {b.cancelRequestReason ? ` — ${b.cancelRequestReason}` : ""}
            </p>
          )}
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

      {/* ── The decision: a revised price waiting for an answer ──────────── */}
      {/*
        The delta is the loudest thing on screen on purpose. The tenant is not reading a status here,
        they are deciding whether to absorb a number or re-quote their customer — and they should not
        have to do the subtraction themselves to find out how much.
      */}

      {awaitingAnswer && (
        <Card className="mb-6 border-amber-200 bg-amber-50/40">
          <p className="text-sm font-semibold text-slate-900">The price changed — this needs your answer.</p>
          <p className="mt-1 text-[13px] text-slate-600">
            Nothing is confirmed and no room is held until you accept or decline.
          </p>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base tabular-nums text-slate-400 line-through">
              {fmtMoney(previous, b.currency)}
            </span>
            <span className="text-slate-400">→</span>
            <span className="text-2xl font-semibold tabular-nums text-slate-900">
              {fmtMoney(revised, b.currency)}
            </span>
            {delta !== null && delta !== 0 && (
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  delta > 0 ? "text-red-600" : "text-emerald-700",
                )}
              >
                {delta > 0 ? "+" : "−"}{fmtMoney(Math.abs(delta), b.currency)}{" "}
                {delta > 0 ? "more than before" : "less than before"}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">What you would owe the platform.</p>

          {b.priceRevisionReason && (
            <p className="mt-3 text-[13px] leading-relaxed text-slate-700">{b.priceRevisionReason}</p>
          )}

          {b.revisedCancellationTerms && (
            <div className="mt-3">
              <p className="text-[11px] font-medium text-slate-500">New cancellation terms if you accept</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{b.revisedCancellationTerms}</p>
            </div>
          )}

          {b.revisionExpiresAt && !revisionExpired && (
            <p className="mt-3 text-[12px] text-amber-900">
              Answer by <span className="font-medium">{fmtDateTime(b.revisionExpiresAt)}</span>.
            </p>
          )}

          {revisionExpired && (
            <Notice tone="error" className="mt-4">
              This offer expired on {fmtDateTime(b.revisionExpiresAt)} and can no longer be accepted.
              Ask the platform to re-check availability — it will come back with a fresh price.
            </Notice>
          )}

          {canAnswer ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                disabled={revisionExpired}
                onClick={() => setModal("accept")}
              >
                Accept {fmtMoney(revised, b.currency)}
              </Button>
              <Button variant="dangerQuiet" onClick={() => { setDeclineReason(""); setModal("decline"); }}>
                Decline
              </Button>
            </div>
          ) : (
            <Notice className="mt-4">
              Answering a revised price needs the marketplace booking permission. Ask an admin or a
              manager in your organization to accept or decline this.
            </Notice>
          )}
        </Card>
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
          hint={
            awaitingAnswer
              ? `A revised ${fmtMoney(revised, b.currency)} is waiting for your answer above.`
              : repriced
                ? `Quoted ${fmtMoney(b.quotedTenantPayable, b.currency)} when you submitted`
                : undefined
          }
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

      {/* ── Voucher ─────────────────────────────────────────────────────── */}
      {/*
        Fetched from /api/me/hotel-bookings, NOT the marketplace prefix: the voucher for next week's
        stay has to survive a lapsed HOTEL_MARKETPLACE add-on, which is the entire reason that route
        exists. Nothing is rendered while NOT_ISSUED — an absent document is not a state to explain.
      */}

      {b.voucherStatus === "ISSUED" && (
        <>
          <SectionLabel className="mt-8">Voucher</SectionLabel>
          <RowGroup>
            {b.voucherNumber && (
              <Row label="Number">
                <span className="text-sm font-medium tabular-nums text-slate-900">{b.voucherNumber}</span>
              </Row>
            )}
            <Row label="Issued"><span className="text-sm text-slate-700">{fmtDateTime(b.voucherIssuedAt)}</span></Row>
            <Row label="Document" hint="Send this to your guest — it's what the hotel expects at check-in.">
              <Button onClick={saveVoucher} loading={downloading}>
                {!downloading && <Download />}
                {downloading ? "Preparing…" : "Download voucher"}
              </Button>
            </Row>
          </RowGroup>
        </>
      )}

      {b.voucherStatus === "REVOKED" && (
        <Notice tone="warn" className="mt-8">
          <p className="font-medium">
            The voucher{b.voucherNumber ? ` ${b.voucherNumber}` : ""} was withdrawn by the platform.
          </p>
          <p className="mt-1">
            It is no longer valid at the hotel — don't send it to your guest. The platform will issue a
            replacement if the stay is going ahead.
          </p>
        </Notice>
      )}

      {/* ── Cancellation outcome ────────────────────────────────────────── */}

      {b.cancelledAt && (
        <>
          <SectionLabel className="mt-8">Cancellation</SectionLabel>
          <RowGroup>
            <Row label="Cancelled"><span className="text-sm text-slate-700">{fmtDateTime(b.cancelledAt)}</span></Row>
            <Row label="Cancellation charge" hint="What the supplier retained. Still owed.">
              <span className="text-sm tabular-nums text-slate-900">
                {fmtMoney(b.cancellationCharge, b.currency)}
              </span>
            </Row>
            <Row label="Refund to you" hint="Settled by the platform against what you owed.">
              <span className="text-sm tabular-nums text-slate-900">
                {fmtMoney(b.tenantRefundAmount, b.currency)}
              </span>
            </Row>
            {b.cancellationReason && (
              <Row label="Reason" align="top">
                <span className="text-sm leading-relaxed text-slate-700">{b.cancellationReason}</span>
              </Row>
            )}
          </RowGroup>
        </>
      )}

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

      {/* ── Confirmations ───────────────────────────────────────────────── */}

      <Modal
        open={modal === "accept"}
        onClose={() => setModal(null)}
        title="Accept the revised price?"
        description="This commits you to the new amount."
        footer={
          <>
            <Button onClick={() => setModal(null)} disabled={busy}>Keep deciding</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => runAction(
                () => marketplaceService.acceptRevision(publicId),
                "Revised price accepted. Waiting for platform confirmation.",
                "Could not accept the revised price.",
              )}
            >
              Accept {fmtMoney(revised, b.currency)}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-slate-600">
          You'll owe the platform{" "}
          <span className="font-medium text-slate-900">{fmtMoney(revised, b.currency)}</span> instead
          of {fmtMoney(previous, b.currency)}. The platform still has to confirm the room with the
          hotel — accepting does not confirm the booking.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          Your price to the customer stays at {fmtMoney(b.tenantCustomerSellingAmount, b.currency)}.
          Whether you absorb the difference or re-quote is your call.
        </p>
      </Modal>

      <Modal
        open={modal === "decline"}
        onClose={() => setModal(null)}
        title="Decline the revised price?"
        description="This ends the request."
        footer={
          <>
            <Button onClick={() => setModal(null)} disabled={busy}>Keep deciding</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => runAction(
                () => marketplaceService.declineRevision(publicId, declineReason.trim() || undefined),
                "Revised price declined. The request has been closed.",
                "Could not decline the revised price.",
              )}
            >
              Decline and close
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-slate-600">
          The request closes and the hotel line is withdrawn from your booking. It cannot be reopened —
          if you want this hotel at a different number, send a new request.
        </p>
        <label className="mt-4 block text-[13px] text-slate-500" htmlFor="decline-reason">
          Reason <span className="text-slate-400">(optional — the platform sees this)</span>
        </label>
        <Textarea
          id="decline-reason"
          className="mt-1 border-slate-200"
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Too far above what the customer agreed…"
        />
      </Modal>

      <Modal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title={isCancelRequest ? "Request cancellation?" : "Withdraw this request?"}
        description={
          isCancelRequest
            ? "The room is confirmed, so the platform has to settle this with the hotel."
            : "Nothing has been committed to the hotel yet."
        }
        footer={
          <>
            <Button onClick={() => setModal(null)} disabled={busy}>Keep it</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => runAction(
                () => marketplaceService.cancelBooking(publicId, cancelReason.trim() || undefined),
                isCancelRequest
                  ? "Cancellation requested. The platform will confirm the charge with the hotel."
                  : "Request withdrawn.",
                isCancelRequest ? "Could not request cancellation." : "Could not withdraw the request.",
              )}
            >
              {endLabel}
            </Button>
          </>
        }
      >
        {isCancelRequest ? (
          <>
            <p className="text-[13px] leading-relaxed text-slate-600">
              The platform will check what the hotel actually allows. A cancellation charge may apply,
              and until they come back the room stays held and you still owe{" "}
              {fmtMoney(b.tenantPayable, b.currency)}. The charge and any refund appear on this page
              once it's settled.
            </p>
            {b.cancellationTerms && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500">Cancellation terms on this booking</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{b.cancellationTerms}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-slate-600">
            No room is being held, so this is free and immediate — the request closes straight away and
            the hotel line is withdrawn from your booking. It cannot be reopened; you'd send a new
            request instead.
          </p>
        )}
        <label className="mt-4 block text-[13px] text-slate-500" htmlFor="cancel-reason">
          Reason <span className="text-slate-400">(optional — the platform sees this)</span>
        </label>
        <Textarea
          id="cancel-reason"
          className="mt-1 border-slate-200"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Customer changed their dates…"
        />
      </Modal>
    </Page>
  );
}

export default MarketplaceBookingDetail;
