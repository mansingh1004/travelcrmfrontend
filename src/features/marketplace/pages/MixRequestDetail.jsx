// src/features/marketplace/pages/MixRequestDetail.jsx
//
// One mix enquiry, and the two or three things the person looking at it can do about it.
//
// ── The page does not decide who you are ─────────────────────────────────────────────────────
//
// `canRespond`, `canAccept` and `canWithdraw` arrive on the DTO, computed server-side from who is
// asking AND what state the row is in. The page renders buttons for the flags it is given and
// never works them out from `mine` plus a status — that is the same rule expressed twice, and the
// copy that drifts is always the one on screen offering an action the API then refuses.
//
// ── Both numbers are shown, and labelled ─────────────────────────────────────────────────────
//
// The estimate is what the buyer was shown when they composed; the quote is what the agency
// answered. Showing only the quote would leave "why is this more than it said?" unanswerable, which
// is the question this feature guarantees somebody will ask.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bed, Car, Wand2, Check, X as XIcon, Undo2, Sparkles, Clock, Star, MessageSquare,
} from "lucide-react";

import {
  Page, PageHeader, BackLink, Card, Divider, SectionLabel, Button, Input, Textarea,
  Modal, Notice, Loading, Chip, fmtMoney, useToast, errMsg, isAlreadyReported, cn, FONT,
} from "../components/marketplaceUi";
import { PKG_PRIMARY, PKG_ACCENT_TEXT } from "../components/packageTheme";
import { packageMixService, mixStatus } from "../api/packageMixService";

export function MixRequestDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [request, setRequest] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pricing, setPricing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequest(await packageMixService.get(publicId));
      setLoadError(null);
    } catch (e) {
      // Somebody else's enquiry is a 404 by design — the server never confirms it exists.
      setLoadError(errMsg(e, "This request is not available."));
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      setRequest(await fn());
      if (message) showToast(message, "success");
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "That did not work"), "error");
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    const reason = window.prompt("Why? The other side sees this, so make it something they can act on.");
    // A cancelled prompt is not a decline with no reason.
    if (reason === null) return;
    act(() => packageMixService.decline(publicId, reason.trim() || undefined), "Request declined");
  };

  if (loadError) {
    return (
      <Page width="max-w-none">
        <div style={FONT}>
          <BackLink onClick={() => navigate("/marketplace/packages/requests")}>Back to requests</BackLink>
          <Card className="mt-4"><Notice tone="warn">{loadError}</Notice></Card>
        </div>
      </Page>
    );
  }
  if (!request) {
    return <Page width="max-w-none"><div style={FONT}><Loading label="Loading request…" /></div></Page>;
  }

  const st = mixStatus(request.status);
  const hotels = (request.lines ?? []).filter((l) => l.kind === "HOTEL");
  const vehicle = (request.lines ?? []).find((l) => l.kind === "VEHICLE");

  return (
    <Page width="max-w-none">
      <div style={FONT}>
        <BackLink onClick={() => navigate("/marketplace/packages/requests")}>Back to requests</BackLink>

        <PageHeader
          title={request.packageTitle}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{request.requestCode}</span>
              <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
              {request.mine ? <Chip>You asked</Chip> : <Chip>Asked of you</Chip>}
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {request.canWithdraw ? (
                <Button disabled={busy} onClick={() => act(() => packageMixService.withdraw(publicId), "Request withdrawn")}>
                  <Undo2 className="h-4 w-4" aria-hidden />
                  Withdraw
                </Button>
              ) : null}

              {request.canRespond ? (
                <>
                  <Button disabled={busy} onClick={decline}>
                    <XIcon className="h-4 w-4" aria-hidden />
                    Decline
                  </Button>
                  <Button variant="primary" className={PKG_PRIMARY} onClick={() => setPricing(true)}>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Send a price
                  </Button>
                </>
              ) : null}

              {request.canAccept ? (
                <>
                  <Button disabled={busy} onClick={decline}>
                    <XIcon className="h-4 w-4" aria-hidden />
                    No thanks
                  </Button>
                  <Button
                    variant="primary"
                    className={PKG_PRIMARY}
                    loading={busy}
                    onClick={() => act(async () => {
                      const updated = await packageMixService.accept(publicId);
                      // The agent's next act is always to price and send it, so land them in the
                      // builder rather than back on a request they have finished with.
                      if (updated?.quotationPublicId) navigate(`/quotation/${updated.quotationPublicId}`);
                      return updated;
                    }, "Quotation created")}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Accept and quote
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        {request.status === "ACCEPTED" && request.quotationPublicId ? (
          <Notice tone="info" className="mt-4">
            A quotation was created from this selection.{" "}
            <button
              type="button"
              className={cn("font-medium underline", PKG_ACCENT_TEXT)}
              onClick={() => navigate(`/quotation/${request.quotationPublicId}`)}
            >
              Open it
            </button>
          </Notice>
        ) : null}

        {request.declineReason ? (
          <Notice tone="warn" className="mt-4"><strong>Declined:</strong> {request.declineReason}</Notice>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <Card>
              <SectionLabel>
                <Wand2 className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
                The selection
              </SectionLabel>
              <p className="mt-0.5 text-xs text-slate-500">
                Recorded exactly as it was chosen. Later edits to the package do not change it.
              </p>

              <ul className="mt-3 space-y-2">
                {hotels.map((l) => (
                  <li key={l.publicId} className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5">
                    <Bed className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-900">{l.cityName}</span>
                        <span className="text-xs text-slate-500">
                          {l.nights} night{l.nights === 1 ? "" : "s"}
                        </span>
                        {l.variantName ? <Chip>{l.variantName}</Chip> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        {l.hotelName || "Hotel to be confirmed"}
                        {l.hotelStars ? (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-amber-600">
                            <Star className="h-3 w-3 fill-current" aria-hidden />{l.hotelStars}
                          </span>
                        ) : null}
                        {[l.roomType, l.mealPlan].filter(Boolean).length ? (
                          <span className="text-slate-500">
                            {" · "}{[l.roomType, l.mealPlan].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ComponentAmount line={l} />
                  </li>
                ))}

                {vehicle ? (
                  <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5">
                    <Car className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-900">Vehicle</span>
                        {vehicle.variantName ? <Chip>{vehicle.variantName}</Chip> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600">{vehicle.vehicleName}</div>
                    </div>
                    <ComponentAmount line={vehicle} />
                  </li>
                ) : null}
              </ul>
            </Card>

            {request.buyerNote || request.sellerNote ? (
              <Card>
                <SectionLabel>
                  <MessageSquare className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" aria-hidden />
                  Notes
                </SectionLabel>
                {request.buyerNote ? (
                  <div className="mt-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">From the buyer</div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{request.buyerNote}</p>
                  </div>
                ) : null}
                {request.sellerNote ? (
                  <div className="mt-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">From the agency</div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{request.sellerNote}</p>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <Card>
              <SectionLabel>Price</SectionLabel>

              {request.quotedPerPax !== null && request.quotedPerPax !== undefined ? (
                <>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Agreed price</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {fmtMoney(request.quotedPerPax)}
                    <span className="text-sm font-normal text-slate-500"> / pax</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {fmtMoney(request.quotedTotal)} for {request.pax} traveller{request.pax === 1 ? "" : "s"}
                  </div>
                  {request.expiresAt ? (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700">
                      <Clock className="h-3 w-3" aria-hidden />
                      Good until {new Date(request.expiresAt).toLocaleString()}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold text-slate-900">Awaiting a price</div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    The agency has not answered yet.
                  </p>
                </>
              )}

              <Divider className="my-4" />

              <div className="text-[11px] uppercase tracking-wide text-slate-400">Estimate when sent</div>
              <div className="text-sm font-medium text-slate-700">
                {request.estimatePerPax === null || request.estimatePerPax === undefined
                  ? "Was on request"
                  : <>{fmtMoney(request.estimatePerPax)} <span className="font-normal text-slate-500">/ pax</span></>}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                From the published component rates at the time. Never a quote.
              </p>

              <Divider className="my-4" />

              <dl className="space-y-1.5 text-xs">
                <Row label="Travellers" value={request.pax} />
                <Row label="Travel date" value={request.travelDate || "Not set"} />
                <Row label="Package" value={request.packageCode} />
                {request.stateName ? <Row label="Region" value={request.stateName} /> : null}
              </dl>
            </Card>
          </aside>
        </div>

        {pricing ? (
          <PriceModal
            request={request}
            onClose={() => setPricing(false)}
            onSent={(updated) => { setPricing(false); setRequest(updated); showToast("Price sent", "success"); }}
          />
        ) : null}
      </div>
    </Page>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}

/** A component's contribution to the estimate — or an honest blank when none was published. */
function ComponentAmount({ line }) {
  if (line.amountPerPax === null || line.amountPerPax === undefined) {
    return <span className="shrink-0 text-[11px] text-slate-400">no rate</span>;
  }
  return (
    <div className="shrink-0 text-right">
      <div className="text-xs font-medium text-slate-700">{fmtMoney(line.amountPerPax)}</div>
      <div className="text-[10px] text-slate-400">/ pax</div>
    </div>
  );
}

/**
 * The seller's answer.
 *
 * <p>Per person, matching every other price in this module, with the total derived beside it so the
 * agency sees what the customer will — and never has to do the multiplication that goes wrong.</p>
 */
function PriceModal({ request, onClose, onSent }) {
  const { showToast } = useToast();
  const [perPax, setPerPax] = useState(
    request.estimatePerPax !== null && request.estimatePerPax !== undefined
      ? String(request.estimatePerPax) : "",
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const total = Number(perPax) > 0 ? Number(perPax) * (request.pax || 1) : null;

  const submit = async () => {
    setSaving(true);
    try {
      onSent(await packageMixService.respond(request.publicId, {
        perPaxPrice: Number(perPax),
        expiresAt: expiresAt ? `${expiresAt}T23:59:59` : undefined,
        sellerNote: note.trim() || undefined,
      }));
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not send the price"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Send a price"
      description={`${request.packageTitle} · ${request.requestCode}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {total === null ? "Enter a per-person price" : <>Total <strong className="font-semibold text-slate-900">{fmtMoney(total)}</strong> for {request.pax} pax</>}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              className={PKG_PRIMARY}
              loading={saving}
              disabled={!(Number(perPax) >= 0) || perPax === ""}
              onClick={submit}
            >
              Send price
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mix-price">Price per person</label>
          <Input id="mix-price" type="number" min={0} value={perPax} onChange={(e) => setPerPax(e.target.value)} />
          {request.estimatePerPax !== null && request.estimatePerPax !== undefined ? (
            <p className="mt-1 text-[11px] text-slate-400">
              Pre-filled with the estimate the buyer saw ({fmtMoney(request.estimatePerPax)}). Change it to what
              you can actually do.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">
              No estimate was shown for this selection — some components have no published rate.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mix-expiry">Good until</label>
          <Input id="mix-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-400">Optional. After this the buyer must ask again.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mix-note">Note</label>
          <Textarea id="mix-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What is included, why it differs from the estimate, anything conditional…" />
        </div>
      </div>
    </Modal>
  );
}

export default MixRequestDetail;
