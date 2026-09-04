// src/console/pages/PlatformPackageMix.jsx
//
// The platform's mix-and-match queue — buyers who composed their own version of a PLATFORM package
// and are waiting on a price.
//
// ── Why this screen had to exist ─────────────────────────────────────────────────────────────
//
// A mix request is answered by whoever owns the package. When an agency owns it they answer from
// their own queue; when the PLATFORM owns it there is no tenant to answer, and without this screen
// those enquiries would sit unanswerable forever while the buyer waited. Every tiered demo package
// is platform-owned, so this is not an edge case — it is the main path.
//
// Agency-to-agency enquiries are deliberately absent. Answering one would mean the platform quoting
// on somebody else's behalf, under their name, with their money; the server refuses to load them
// here at all.
//
// Palette: `.sa-console` semantic + hue tokens only.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wand2, Bed, Car, Check, X, Star, Clock } from "lucide-react";

import {
  PageShell, PageHeader, HotelStyles, SectionCard, Button, Badge, Input, Textarea, Label,
  EmptyState, SkeletonCards, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter, errMsg,
} from "../components/hotelUi";
import { useStepUp } from "../components/useStepUp";
import { platformPackageMixService, mixStatus } from "../api/platformPackageMixService";

const PAGE_SIZE = 20;

const TABS = [
  // Pending leads here, unlike the package catalog: this screen's entire reason to exist is the
  // answering, and an operator opening it is looking for what is waiting.
  { value: "PENDING", label: "Awaiting price" },
  { value: "", label: "All requests" },
];

const money = (v) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
        .format(Number(v));

export default function PlatformPackageMix() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "PENDING";

  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [pricing, setPricing] = useState(null);
  const stepUp = useStepUp();

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await platformPackageMixService.list({ status: status || undefined, page: 0, size: PAGE_SIZE });
      setRows(res.items);
    } catch (e) {
      setRows([]);
      setError(errMsg(e, "Could not load the queue."));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = (spec) => stepUp.request({ ...spec, run: async (code) => { await spec.run(code); await load(); } });

  const decline = (r) => {
    const reason = window.prompt("Why? The agency sees this, so make it something they can act on.");
    // A cancelled prompt is not a decline with no reason.
    if (reason === null) return;
    act({
      title: `Decline ${r.requestCode}?`,
      description: "The buyer keeps their selection and can ask again.",
      confirmLabel: "Decline request",
      run: (code) => platformPackageMixService.decline(r.publicId, reason.trim() || undefined, code),
    });
  };

  return (
    <PageShell>
      <HotelStyles />
      <PageHeader
        title="Mix requests"
        subtitle="Buyers who built their own version of a platform package and are waiting on a price."
        icon={Wand2}
      />

      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            onClick={() => setParams(t.value ? { status: t.value } : {}, { replace: true })}
            className={`border-b-2 px-3 py-2 text-sm font-bold transition ${
              status === t.value ? "border-accent text-accent" : "border-transparent text-muted hover:text-heading"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <SectionCard title="Requests" icon={Wand2}>
        {error ? <p className="text-sm text-hue-rose">{error}</p> : null}

        {rows === null ? (
          <SkeletonCards count={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wand2}
            title={status === "PENDING" ? "Nothing waiting on the platform" : "No mix requests yet"}
            hint="When an agency composes their own version of a platform package, it lands here for a price."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <RequestCard
                key={r.publicId}
                request={r}
                onPrice={() => setPricing(r)}
                onDecline={() => decline(r)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {pricing ? (
        <PriceDialog
          request={pricing}
          onClose={() => setPricing(null)}
          onSubmit={(payload) => {
            const r = pricing;
            setPricing(null);
            act({
              title: `Price ${r.requestCode}?`,
              description: `${money(payload.perPaxPrice)} per person — ${money(payload.perPaxPrice * r.pax)} for ${r.pax}.`,
              confirmLabel: "Send price",
              run: (code) => platformPackageMixService.respond(r.publicId, payload, code),
            });
          }}
        />
      ) : null}

      {stepUp.dialog}
    </PageShell>
  );
}

/**
 * One enquiry, with the whole selection visible.
 *
 * <p>Not a table row: the thing being priced IS the composition — which tier at which stop — and an
 * operator quoting on a row that only said "Andaman, 2 pax" would be guessing. It reads as a small
 * document because that is what it is.</p>
 */
function RequestCard({ request, onPrice, onDecline }) {
  const st = mixStatus(request.status);
  const hotels = (request.lines ?? []).filter((l) => l.kind === "HOTEL");
  const vehicle = (request.lines ?? []).find((l) => l.kind === "VEHICLE");
  const pending = request.status === "PENDING";

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-heading">{request.packageTitle}</span>
            <Badge className={st.cls}>{st.label}</Badge>
            <span className="font-mono text-[11px] text-muted">{request.requestCode}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {/* The console DOES see both parties — the anonymity rule is between the two agencies,
                not between an agency and the platform that has to price for them. */}
            {request.buyerName ? <span>from {request.buyerName}</span> : null}
            <span>{request.pax} pax</span>
            {request.travelDate ? <span>{request.travelDate}</span> : null}
            {request.packageCode ? <span className="font-mono">{request.packageCode}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-right">
            <div className="text-[11px] text-muted">
              {request.quotedPerPax !== null && request.quotedPerPax !== undefined ? "Quoted" : "Buyer saw"}
            </div>
            <div className="text-sm font-extrabold text-heading">
              {request.quotedPerPax !== null && request.quotedPerPax !== undefined
                ? money(request.quotedPerPax)
                : (request.estimatePerPax === null || request.estimatePerPax === undefined
                    ? "On request" : money(request.estimatePerPax))}
            </div>
          </div>
          {pending ? (
            <>
              <Button variant="outline" size="sm" onClick={onDecline}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Decline
              </Button>
              <Button size="sm" onClick={onPrice}>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Send price
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {hotels.map((l) => (
          <li key={l.publicId} className="flex items-start gap-2 rounded-lg border border-border p-2 text-xs">
            <Bed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-bold text-heading">{l.cityName}</span>
                <span className="text-muted">{l.nights}N</span>
                {l.variantName ? <Badge variant="outline">{l.variantName}</Badge> : null}
              </div>
              <div className="text-body">
                {l.hotelName || "hotel not named"}
                {l.hotelStars ? (
                  <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-hue-amber">
                    <Star className="h-3 w-3" fill="currentColor" aria-hidden />{l.hotelStars}
                  </span>
                ) : null}
              </div>
              <div className="text-muted">{[l.roomType, l.mealPlan].filter(Boolean).join(" · ") || "room not stated"}</div>
            </div>
            <span className="ml-auto shrink-0 text-[11px] font-bold text-heading">{money(l.amountPerPax)}</span>
          </li>
        ))}
        {vehicle ? (
          <li className="flex items-start gap-2 rounded-lg border border-border p-2 text-xs">
            <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-bold text-heading">Vehicle</span>
                {vehicle.variantName ? <Badge variant="outline">{vehicle.variantName}</Badge> : null}
              </div>
              <div className="text-body">{vehicle.vehicleName}</div>
            </div>
            <span className="ml-auto shrink-0 text-[11px] font-bold text-heading">{money(vehicle.amountPerPax)}</span>
          </li>
        ) : null}
      </ul>

      {request.buyerNote ? (
        <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs text-body">{request.buyerNote}</p>
      ) : null}
      {request.expiresAt ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-hue-amber">
          <Clock className="h-3 w-3" aria-hidden />
          Price good until {new Date(request.expiresAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The price, per person.
 *
 * <p>Pre-filled with the estimate the buyer was shown, because that is the number the conversation
 * started from and most answers are near it. The total is derived beside it so the operator never
 * does the multiplication that goes wrong.</p>
 */
function PriceDialog({ request, onClose, onSubmit }) {
  const [perPax, setPerPax] = useState(
    request.estimatePerPax !== null && request.estimatePerPax !== undefined ? String(request.estimatePerPax) : "",
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  const value = Number(perPax);
  const valid = perPax !== "" && Number.isFinite(value) && value >= 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a price</DialogTitle>
          <DialogDescription>{request.packageTitle} · {request.requestCode}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mix-price" required>Price per person</Label>
              <Input id="mix-price" type="number" min={0} value={perPax} onChange={(e) => setPerPax(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted">
                {valid
                  ? `${money(value * request.pax)} for ${request.pax} traveller${request.pax === 1 ? "" : "s"}`
                  : "Enter what the platform can actually do."}
              </p>
            </div>
            <div>
              <Label htmlFor="mix-expiry">Good until</Label>
              <Input id="mix-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted">Optional. After this the buyer must ask again.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="mix-note">Note to the agency</Label>
              <Textarea id="mix-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="What is included, why it differs from the estimate, anything conditional…" />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => onSubmit({
              perPaxPrice: value,
              expiresAt: expiresAt ? `${expiresAt}T23:59:59` : undefined,
              sellerNote: note.trim() || undefined,
            })}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
