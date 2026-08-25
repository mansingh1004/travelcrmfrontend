// src/features/marketplace/pages/TransportOrders.jsx
//
// The tenant's transport requests, and everything it is allowed to do to one.
//
// Reads come from `/api/me/transport-orders`, which `ModuleAccessFilter` never gates — a confirmed
// journey may be next week and the passenger is travelling whether or not the agency renewed this
// month. Every WRITE on this screen goes to the gated prefix instead. That split is deliberate: a
// suspended tenant can read its orders and reprint duty slips, and can sell nothing.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Car, ChevronDown, ChevronRight, FileText, Loader2, MapPin, Plus, Users,
} from "lucide-react";
import { hasPermission, P } from "@shared/lib/access";
import { transportMarketplaceService } from "../api/transportMarketplaceService";
import { humanise } from "./TransportSearch";
import {
  BackLink, Button, Card, Chip, Divider, Empty, Modal, Notice, Page, PageHeader, Pager,
  SectionLabel, SkeletonRows, StatusDot, Textarea, errMsg, fmtDateTime, fmtMoney, useToast,
} from "../components/marketplaceUi";

const PAGE_SIZE = 20;

/** A journey that has not started cannot be re-priced or cancelled; the server decides, this hides. */
const REVISION_STATES = new Set(["TENANT_APPROVAL_REQUIRED"]);
const WITHDRAWABLE = new Set(["REQUESTED", "UNDER_REVIEW"]);
const CANCELLABLE = new Set(["CONFIRMED", "TENANT_ACCEPTED"]);
const QUOTED = new Set(["CANCELLATION_QUOTED"]);

export function TransportOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);

  // One reason box, reused by withdraw and cancel — they ask the same question and the server takes
  // the same optional string.
  const [prompt, setPrompt] = useState(null); // { order, kind }
  const [reason, setReason] = useState("");

  const canCancel = hasPermission(P.TRANSPORT_MARKETPLACE_CANCEL);
  const canBook = hasPermission(P.TRANSPORT_MARKETPLACE_BOOK);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: data, pagination: meta } = await transportMarketplaceService.listOrders({
        page,
        size: PAGE_SIZE,
      });
      setRows(data ?? []);
      setPagination(meta ?? null);
    } catch (e) {
      showToast(errMsg(e, "Could not load your transport requests."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs one write, then reloads — the server owns the state machine and the row must reflect it. */
  async function run(order, label, fn) {
    setBusy(order.publicId);
    try {
      await fn();
      showToast(label, "success");
      await load();
    } catch (e) {
      showToast(errMsg(e, "That did not go through."), "error");
    } finally {
      setBusy(null);
      setPrompt(null);
      setReason("");
    }
  }

  /**
   * Open the duty slip in a new tab.
   *
   * Deliberately reads `blob.type` instead of forcing `application/pdf`: when the operator uploaded
   * their own slip it may be a photograph, and mislabelling it gives the agent a broken viewer on
   * exactly the document the driver is carrying.
   */
  async function openVoucher(order) {
    setBusy(order.publicId);
    try {
      const blob = await transportMarketplaceService.downloadVoucher(order.publicId);
      if (!blob) throw new Error("empty");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Revoked on a delay rather than immediately: the new tab has to finish reading it first.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      showToast(errMsg(e, "No duty slip has been issued for this request yet."), "error");
    } finally {
      setBusy(null);
    }
  }

  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.totalElements ?? rows.length;

  const promptCopy = useMemo(() => {
    if (!prompt) return null;
    return prompt.kind === "withdraw"
      ? {
          title: "Withdraw this request",
          body: "The platform team has not committed to it yet, so nothing is charged.",
          cta: "Withdraw",
        }
      : {
          title: "Ask to cancel",
          body: "This does not cancel it. The platform quotes a cancellation charge and you decide whether to accept it.",
          cta: "Send request",
        };
  }, [prompt]);

  return (
    <Page width="max-w-5xl">
      <PageHeader
        title="Transport requests"
        subtitle="What you have asked the platform team for, and where each one stands."
        back={
          <BackLink onClick={() => navigate("/marketplace/transport")}>
            <ArrowLeft className="size-3.5" /> Back to transport
          </BackLink>
        }
        actions={
          canBook && (
            <Button variant="primary" onClick={() => navigate("/marketplace/transport")}>
              <Plus className="size-3.5" /> New request
            </Button>
          )
        }
      />

      {loading ? (
        <SkeletonRows count={6} />
      ) : rows.length === 0 ? (
        <Empty
          icon={Car}
          title="No transport requests yet"
          hint="Browse the platform's contracted vehicles and send your first enquiry."
          action={<Button variant="primary" onClick={() => navigate("/marketplace/transport")}>Browse transport</Button>}
        />
      ) : (
        <>
          <Card flush className="divide-y divide-slate-100">
            {rows.map((o) => {
              const open = expanded === o.publicId;
              const working = busy === o.publicId;
              return (
                <div key={o.publicId}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : o.publicId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="size-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-slate-400" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[14px] font-medium text-slate-900">
                        {o.orderCode}
                        <span className="font-normal text-slate-400">·</span>
                        <span className="truncate font-normal text-slate-600">{o.productName}</span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
                        <span>{fmtDateTime(o.pickupAt)}</span>
                        {o.pickupLocation && (
                          <>
                            <span aria-hidden>·</span>
                            <MapPin className="size-3" />
                            <span className="truncate">{o.pickupLocation}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <StatusDot status={o.status} />
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                      {/* A revision is a DECISION the agency owes, so it leads. */}
                      {REVISION_STATES.has(o.status) && (
                        <Notice tone="warn" className="mb-4">
                          <p className="font-medium">
                            The platform has come back at {fmtMoney(o.revisedTenantPayable, o.currency)}
                            {o.revisionPreviousPayable != null && (
                              <span className="font-normal">
                                {" "}(was {fmtMoney(o.revisionPreviousPayable, o.currency)})
                              </span>
                            )}
                          </p>
                          {o.priceRevisionReason && <p className="mt-1">{o.priceRevisionReason}</p>}
                          <p className="mt-1 text-[12px]">
                            Accepting is consent to the amount, not a confirmation — it goes back for a
                            final approval, which cannot then confirm at any other figure.
                            {o.revisionExpiresAt && ` Expires ${fmtDateTime(o.revisionExpiresAt)}.`}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              loading={working}
                              onClick={() => run(o, "Revised price accepted.", () =>
                                transportMarketplaceService.acceptRevision(o.publicId))}
                            >
                              Accept {fmtMoney(o.revisedTenantPayable, o.currency)}
                            </Button>
                            <Button
                              size="sm"
                              variant="dangerQuiet"
                              loading={working}
                              onClick={() => run(o, "Revised price declined.", () =>
                                transportMarketplaceService.declineRevision(o.publicId))}
                            >
                              Decline
                            </Button>
                          </div>
                        </Notice>
                      )}

                      {QUOTED.has(o.status) && (
                        <Notice tone="warn" className="mb-4">
                          <p className="font-medium">
                            Cancelling this costs {fmtMoney(o.quotedCancellationCharge, o.currency)}
                          </p>
                          {o.cancellationQuoteNote && <p className="mt-1">{o.cancellationQuoteNote}</p>}
                          {o.cancellationQuoteExpiresAt && (
                            <p className="mt-1 text-[12px]">Quote expires {fmtDateTime(o.cancellationQuoteExpiresAt)}.</p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="danger"
                              loading={working}
                              disabled={!canCancel}
                              onClick={() => run(o, "Cancellation accepted.", () =>
                                transportMarketplaceService.acceptCancellationQuote(o.publicId))}
                            >
                              Accept and cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={working}
                              onClick={() => run(o, "Cancellation declined — the journey stands.", () =>
                                transportMarketplaceService.declineCancellationQuote(o.publicId))}
                            >
                              Keep the journey
                            </Button>
                          </div>
                        </Notice>
                      )}

                      {o.status === "REJECTED" && o.rejectionReason && (
                        <Notice tone="error" className="mb-4">{o.rejectionReason}</Notice>
                      )}

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <SectionLabel>Journey</SectionLabel>
                          <dl className="mt-1 space-y-1 text-[13px]">
                            <Field label="Service" value={humanise(o.serviceType)} />
                            <Field label="Pickup" value={fmtDateTime(o.pickupAt)} />
                            {o.expectedReleaseAt && (
                              <Field label="Release" value={fmtDateTime(o.expectedReleaseAt)} />
                            )}
                            <Field label="From" value={o.pickupLocation} />
                            <Field label="To" value={o.dropLocation} />
                            <Field
                              label="Party"
                              value={[
                                o.passengers != null && `${o.passengers} pax`,
                                o.luggagePieces != null && `${o.luggagePieces} bags`,
                                o.vehicleCount != null && `${o.vehicleCount} vehicle(s)`,
                              ].filter(Boolean).join(" · ")}
                            />
                          </dl>
                        </div>

                        <div>
                          <SectionLabel>Commercials</SectionLabel>
                          <dl className="mt-1 space-y-1 text-[13px]">
                            {/* What the AGENCY owes the platform. There is no supplier cost and no
                                platform margin on this screen, by construction — the tenant DTO has
                                no field for either. */}
                            <Field label="You pay" value={fmtMoney(o.tenantPayable, o.currency)} />
                            {o.tenantCustomerSellingAmount != null && (
                              <Field
                                label="You charge"
                                value={fmtMoney(o.tenantCustomerSellingAmount, o.currency)}
                              />
                            )}
                            {o.tenantMargin != null && (
                              <Field label="Your margin" value={fmtMoney(o.tenantMargin, o.currency)} />
                            )}
                            <Field label="Booking" value={o.crmBookingCode} />
                            {o.supplierConfirmationNumber && (
                              <Field label="Operator ref" value={o.supplierConfirmationNumber} />
                            )}
                          </dl>
                        </div>
                      </div>

                      {o.assignments?.length > 0 && (
                        <>
                          <Divider className="my-4" />
                          <SectionLabel>Vehicle and driver</SectionLabel>
                          <ul className="mt-1 space-y-1 text-[13px] text-slate-700">
                            {o.assignments.map((a, i) => (
                              <li key={a.publicId ?? i} className="flex flex-wrap items-center gap-2">
                                <Chip><Car className="size-3" /> {a.vehicleDescription ?? a.registrationNumber}</Chip>
                                {a.driverName && <Chip><Users className="size-3" /> {a.driverName}</Chip>}
                                {a.driverPhone && <span className="text-slate-500">{a.driverPhone}</span>}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <Divider className="my-4" />

                      <div className="flex flex-wrap items-center gap-2">
                        {o.voucherStatus === "ISSUED" && (
                          <Button size="sm" variant="secondary" loading={working} onClick={() => openVoucher(o)}>
                            {working ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                            Duty slip {o.voucherNumber ? `· ${o.voucherNumber}` : ""}
                          </Button>
                        )}

                        {WITHDRAWABLE.has(o.status) && canCancel && (
                          <Button
                            size="sm"
                            variant="dangerQuiet"
                            onClick={() => { setPrompt({ order: o, kind: "withdraw" }); setReason(""); }}
                          >
                            Withdraw
                          </Button>
                        )}

                        {CANCELLABLE.has(o.status) && canCancel && (
                          <Button
                            size="sm"
                            variant="dangerQuiet"
                            onClick={() => { setPrompt({ order: o, kind: "cancel" }); setReason(""); }}
                          >
                            Ask to cancel
                          </Button>
                        )}

                        <span className="ml-auto text-[12px] text-slate-400">
                          Raised {fmtDateTime(o.createdAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} className="mt-6" />
        </>
      )}

      <Modal
        open={!!prompt}
        onClose={() => setPrompt(null)}
        title={promptCopy?.title}
        description={promptCopy?.body}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrompt(null)}>Keep it</Button>
            <Button
              variant="danger"
              loading={busy === prompt?.order?.publicId}
              onClick={() => {
                const o = prompt.order;
                const isWithdraw = prompt.kind === "withdraw";
                run(
                  o,
                  isWithdraw ? "Request withdrawn." : "Cancellation requested — the platform will quote a charge.",
                  () =>
                    isWithdraw
                      ? transportMarketplaceService.withdrawOrder(o.publicId, reason || undefined)
                      : transportMarketplaceService.requestCancellation(o.publicId, reason || undefined),
                );
              }}
            >
              {promptCopy?.cta}
            </Button>
          </>
        }
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional) — it reaches the platform team, not the driver."
          rows={3}
        />
      </Modal>
    </Page>
  );
}

/** A definition row that hides itself when there is nothing to say, so gaps do not read as "—, —, —". */
function Field({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{value}</dd>
    </div>
  );
}

export default TransportOrders;
