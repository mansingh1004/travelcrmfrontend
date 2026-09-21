// src/features/marketplace/components/PackageQuoteModal.jsx
//
// "Send this package to a customer" — the whole thing, in five fields.
//
// The brief was explicit: the tenant must be able to generate the quotation by filling in the
// MINIMUM. So nothing here is required. Travellers defaults to the package's own minimum, the date
// may be blank, the markup may be zero, and the customer's name is optional. Every blank is a
// section the page simply does not render — never a validation error standing between an agent on a
// phone call and a link they can paste.
//
// Two phases, one modal: compose, then the link. The link phase is the point of the feature, so it
// gets the whole dialog rather than a toast that scrolls away.

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Layers, Link2, Loader2 } from "lucide-react";

import {
  Button, Input, Modal, Notice, Row, RowGroup, Select,
  errMsg, fmtMoney, isAlreadyReported, useToast,
} from "./marketplaceUi";
import { PKG_PRIMARY } from "./packageTheme";
import { packageQuoteLink, packageQuoteService } from "../api/packageQuoteService";

/**
 * What the customer will be shown, computed from the same slabs the server prices on.
 *
 * A local estimate rather than a server round-trip on every keystroke: the figure in the footer has
 * to move as the agent types or the markup box is guesswork. It is the CHEAPEST applicable rate,
 * which is the rule the server's own slab pick follows — see PackageQuoteSnapshotBuilder.
 */
function estimateCost(slabs, pax) {
  const n = Number(pax) || 0;
  if (!n) return null;
  const applicable = (slabs ?? [])
    .filter((s) => (s.paxFrom == null || n >= s.paxFrom) && (s.paxTo == null || n <= s.paxTo))
    .map((s) => Number(s.perPaxPrice))
    .filter(Number.isFinite);
  return applicable.length ? Math.min(...applicable) : null;
}

export default function PackageQuoteModal({ pkg, tier, leadPublicId, onClose, onCreated }) {
  const { showToast } = useToast();

  const tiers = useMemo(
    () => (pkg?.variants ?? []).filter((v) => v.active !== false),
    [pkg?.variants]
  );
  const canCompare = tiers.length > 1;

  const [pax, setPax] = useState(String(pkg?.minPax ?? 2));
  const [travelDate, setTravelDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [markup, setMarkup] = useState("");
  const [markupKind, setMarkupKind] = useState("AMOUNT"); // AMOUNT | PERCENT
  // Default to the comparison when the package HAS tiers: three prices on one page is why an agency
  // publishes tiers at all, and an agent who wants one can switch back in a click.
  const [compare, setCompare] = useState(canCompare && !tier);

  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  // The tier the price is quoted on: the one opened from the page, else the first published.
  const pricedTier = tier ?? (tiers.length ? tiers[0] : null);
  const slabs = pricedTier?.priceSlabs ?? pkg?.priceSlabs ?? [];

  const cost = estimateCost(slabs, pax);
  const margin = useMemo(() => {
    const m = Number(markup);
    if (!Number.isFinite(m) || m <= 0 || cost == null) return 0;
    return markupKind === "PERCENT" ? (cost * m) / 100 : m;
  }, [markup, markupKind, cost]);

  const sellPerPax = cost == null ? null : cost + margin;
  const sellTotal = sellPerPax == null ? null : sellPerPax * (Number(pax) || 0);

  const submit = async () => {
    setSaving(true);
    try {
      const amount = Number(markup);
      const quote = await packageQuoteService.create(pkg.publicId, {
        mode: compare ? "COMPARISON" : "SINGLE",
        variantPublicId: pricedTier?.publicId || undefined,
        pax: Number(pax) || 1,
        travelDate: travelDate || undefined,
        leadPublicId: leadPublicId || undefined,
        customerName: customerName.trim() || undefined,
        markupPerPax: markupKind === "AMOUNT" && amount > 0 ? amount : undefined,
        markupPercent: markupKind === "PERCENT" && amount > 0 ? amount : undefined,
      });
      setCreated(quote);
      onCreated?.(quote);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not create the quotation"), "error");
    } finally {
      setSaving(false);
    }
  };

  const link = created ? packageQuoteLink(created) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins and in some embedded webviews. The input below is
      // selectable, so the agent can still copy by hand — which is why this is a toast and not an
      // error state.
      showToast("Copy the link from the box below", "info");
    }
  };

  // ── Phase two: the link ─────────────────────────────────────────────────
  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Quotation ready"
        description={created.title}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {created.tierCount > 1
                ? `${created.tierCount} options on one page`
                : "Single package page"}
            </span>
            <div className="flex gap-2">
              <Button onClick={onClose}>Done</Button>
              <Button
                variant="primary"
                className={PKG_PRIMARY}
                onClick={() => window.open(link, "_blank", "noopener")}
              >
                <ExternalLink className="h-4 w-4" /> Preview
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Notice tone="success">
            Send this link to the customer. It opens without a login, and shows the itinerary,
            hotels, photos and price — but never your cost or margin.
          </Notice>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="pq-link">
              Shareable link
            </label>
            <div className="flex gap-2">
              <Input
                id="pq-link"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button onClick={copy} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 p-3 text-sm">
            <dt className="text-slate-500">Customer pays</dt>
            <dd className="text-right font-semibold text-slate-900">
              {fmtMoney(created.sellPerPax)} <span className="font-normal text-slate-500">/ pax</span>
            </dd>
            <dt className="text-slate-500">Total ({created.pax} pax)</dt>
            <dd className="text-right font-semibold text-slate-900">{fmtMoney(created.sellTotal)}</dd>
            <dt className="text-slate-500">Your margin</dt>
            <dd className="text-right font-medium text-emerald-700">{fmtMoney(created.marginTotal)}</dd>
          </dl>
        </div>
      </Modal>
    );
  }

  // ── Phase one: five fields ──────────────────────────────────────────────
  return (
    <Modal
      open
      onClose={onClose}
      title="Create a quotation link"
      description={pricedTier ? `${pkg.title} — ${pricedTier.name}` : pkg.title}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {sellPerPax == null ? (
              "Priced on request"
            ) : (
              <>
                Customer sees{" "}
                <strong className="font-semibold text-slate-900">{fmtMoney(sellPerPax)}</strong> / pax
                {sellTotal ? <> · {fmtMoney(sellTotal)} total</> : null}
              </>
            )}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" className={PKG_PRIMARY} loading={saving} onClick={submit}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Generate link
            </Button>
          </div>
        </div>
      }
    >
      <RowGroup>
        <Row label="Travellers" htmlFor="pq-pax">
          <Input
            id="pq-pax"
            type="number"
            min={1}
            value={pax}
            onChange={(e) => setPax(e.target.value)}
          />
        </Row>

        <Row label="Travel date" hint="Blank leaves the dates open" htmlFor="pq-date">
          <Input
            id="pq-date"
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
          />
        </Row>

        <Row label="Customer" hint="Optional — printed on the page" htmlFor="pq-name">
          <Input
            id="pq-name"
            placeholder="Name to address it to"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </Row>

        <Row label="Your markup" hint="Added to every tier. Leave blank to sell at catalog rate." htmlFor="pq-markup">
          <div className="flex gap-2">
            <Input
              id="pq-markup"
              type="number"
              min={0}
              placeholder="0"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
            <Select
              aria-label="Markup type"
              className="w-28 shrink-0"
              value={markupKind}
              onChange={(e) => setMarkupKind(e.target.value)}
            >
              <option value="AMOUNT">₹ / pax</option>
              <option value="PERCENT">%</option>
            </Select>
          </div>
        </Row>
      </RowGroup>

      {canCompare ? (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium text-slate-900">
              <Layers className="h-3.5 w-3.5" /> Show all {tiers.length} options side by side
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {tiers.map((t) => t.name).filter(Boolean).join(" · ")} — one page, one itinerary,
              a column of hotels and a price for each.
            </span>
          </span>
        </label>
      ) : null}
    </Modal>
  );
}
