// src/features/marketplace/components/MixBuilder.jsx
//
// "Build your own" — the same route the detail page already shows, with every stop made choosable.
//
// ── Why it is the route list and not a new screen ────────────────────────────────────────────
//
// The buyer is already looking at a list of stops with hotels against them. Making those rows
// choosable is a smaller thing to learn than a builder they have to navigate to, and it keeps the
// three tier prices on screen while they mix — which is what tells them whether their selection is
// worth sending at all. A separate page would hide exactly the comparison the decision needs.
//
// ── The estimate is priced by the server, on every change ────────────────────────────────────
//
// Nothing here computes money. The component posts the selection and renders what comes back, so
// the number shown is produced by the same code that will store it — the alternative is a client
// sum that drifts from the server's the first time a rule changes, and a buyer who is right not to
// trust either. It also means an unpriced component (the author never published a rate) surfaces
// honestly as "on request" instead of silently dropping out of a total.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bed, Car, Wand2, Send, Info, Loader2, Check, Star } from "lucide-react";

import {
  Card, Button, Input, Textarea, Notice, fmtMoney,
  useToast, errMsg, isAlreadyReported, cn,
} from "./marketplaceUi";
import { PKG_PRIMARY, PKG_ACCENT_TEXT } from "./packageTheme";
import { packageMixService } from "../api/packageMixService";
import { PACKAGE_CATEGORY } from "../api/packageMarketplaceService";

/** Debounce for the estimate call. Long enough to skip a burst of clicks, short enough to feel live. */
const ESTIMATE_DELAY_MS = 350;

export function MixBuilder({ pkg, tiers, onCancel, onSent }) {
  const { showToast } = useToast();

  const legs = useMemo(() => pkg.stayLegs ?? [], [pkg.stayLegs]);

  /** Which tier supplies each stop, keyed by city. Seeded to the cheapest tier, like the picker. */
  const [byCity, setByCity] = useState(() => {
    const cheapest = pickCheapest(tiers);
    const out = {};
    for (const leg of legs) out[leg.cityName] = tierWithHotelIn(tiers, leg.cityName, cheapest);
    return out;
  });

  const [vehicleTierId, setVehicleTierId] = useState(() => {
    const withVehicle = tiers.filter((t) => t.vehicleName);
    return withVehicle.length ? pickCheapest(withVehicle) : "";
  });

  const [pax, setPax] = useState(String(pkg.minPax ?? 2));
  const [travelDate, setTravelDate] = useState("");
  const [note, setNote] = useState("");

  const [estimate, setEstimate] = useState(null);
  const [pricing, setPricing] = useState(false);
  const [problem, setProblem] = useState(null);
  const [sending, setSending] = useState(false);

  /** The wire shape, built once and used by both the estimate call and the send. */
  const selection = useMemo(() => ({
    stays: legs
      .filter((leg) => byCity[leg.cityName])
      .map((leg) => ({ cityName: leg.cityName, variantPublicId: byCity[leg.cityName] })),
    vehicleVariantPublicId: vehicleTierId || undefined,
    pax: Number(pax) || 1,
    travelDate: travelDate || undefined,
  }), [legs, byCity, vehicleTierId, pax, travelDate]);

  const complete = selection.stays.length === legs.length && legs.length > 0;

  // A run counter, not a cancel token: an out-of-order reply from an earlier keystroke would
  // otherwise overwrite the newer estimate and show a price for a selection nobody is looking at.
  const runRef = useRef(0);

  const price = useCallback(async () => {
    if (!complete) { setEstimate(null); return; }
    const run = ++runRef.current;
    setPricing(true);
    try {
      const result = await packageMixService.estimate(pkg.publicId, selection);
      if (run !== runRef.current) return;
      setEstimate(result);
      setProblem(null);
    } catch (e) {
      if (run !== runRef.current) return;
      setEstimate(null);
      // Rendered here, not toasted: a 400 from an impossible combination is about the choice the
      // buyer just made, and belongs beside it. The interceptor leaves 400s to the call site.
      setProblem(errMsg(e, "That combination cannot be priced."));
    } finally {
      if (run === runRef.current) setPricing(false);
    }
  }, [pkg.publicId, selection, complete]);

  useEffect(() => {
    const t = setTimeout(price, ESTIMATE_DELAY_MS);
    return () => clearTimeout(t);
  }, [price]);

  const send = async () => {
    setSending(true);
    try {
      const created = await packageMixService.create(pkg.publicId, {
        ...selection,
        buyerNote: note.trim() || undefined,
      });
      onSent(created);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not send the request"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mt-3 border-blue-200 bg-blue-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Wand2 className="h-4 w-4" aria-hidden />
            </span>
            Build your own
          </h3>
          {/* The choices used to sit inside a dropdown per stop, which is where a buyer could not
              see them. Now every option is a card on the table: hotel, stars, room, meals, and the
              per-night rate when the author published one — the things the decision is made on. */}
          <p className="mt-1.5 text-xs text-slate-600">
            Tap a hotel at each stop, pick a vehicle, and you get an estimate right away — the agency
            then sends the confirmed price.
          </p>
        </div>
        <Button onClick={onCancel}>Cancel</Button>
      </div>

      <div className="mt-4 space-y-3">
        {legs.map((leg, li) => {
          const options = tiersWithHotelIn(tiers, leg.cityName);
          const chosen = byCity[leg.cityName];

          return (
            <div key={leg.publicId ?? leg.cityName} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                  {li + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{leg.cityName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Bed className="h-3 w-3" aria-hidden />
                    {leg.nights} night{leg.nights === 1 ? "" : "s"} · choose where you stay
                  </div>
                </div>
              </div>

              {/* Only tiers that actually have a hotel here. A tier missing this stop is not a
                  cheaper option, it is a night with no bed, and the server refuses it anyway. */}
              {options.length === 0 ? (
                <p className="text-xs text-slate-500">No option for this stop.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={`Level for ${leg.cityName}`}>
                  {options.map((t) => (
                    <OptionCard
                      key={t.publicId}
                      on={chosen === t.publicId}
                      onPick={() => setByCity((p) => ({ ...p, [leg.cityName]: t.publicId }))}
                      tier={t}
                      hotel={hotelIn(tiers, t.publicId, leg.cityName)}
                      nights={leg.nights}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {tiers.some((t) => t.vehicleName) ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
                <Car className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Vehicle</div>
                <div className="text-[11px] text-slate-500">For the whole trip — or arrange your own</div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Vehicle level">
              {/* Blank is a real choice: a buyer arranging their own transport still wants the stay. */}
              <button
                type="button"
                role="radio"
                aria-checked={vehicleTierId === ""}
                onClick={() => setVehicleTierId("")}
                className={cn(
                  "rounded-lg border p-2.5 text-left transition",
                  vehicleTierId === "" ? "border-blue-600 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-300"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("text-[11px] font-bold uppercase tracking-wide", vehicleTierId === "" ? "text-blue-700" : "text-slate-500")}>None</span>
                  {vehicleTierId === "" ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden /> : null}
                </span>
                <span className="mt-0.5 block text-sm font-medium text-slate-900">No vehicle</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">I will arrange transport</span>
              </button>
              {tiers.filter((t) => t.vehicleName).map((t) => {
                const on = vehicleTierId === t.publicId;
                return (
                  <button
                    key={t.publicId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setVehicleTierId(t.publicId)}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      on ? "border-blue-600 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-300"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("text-[11px] font-bold uppercase tracking-wide", on ? "text-blue-700" : "text-slate-500")}>{t.name}</span>
                      {on ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden /> : null}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium text-slate-900">{t.vehicleName}</span>
                    {t.vehicleNote ? <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{t.vehicleNote}</span> : null}
                    {t.vehiclePerPaxPrice != null ? (
                      <span className="mt-1 block text-xs font-semibold text-slate-800">
                        {fmtMoney(t.vehiclePerPaxPrice)} <span className="font-normal text-slate-500">/ person</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mix-pax">Travellers</label>
          <Input id="mix-pax" type="number" min={1} value={pax} onChange={(e) => setPax(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mix-date">Travel date</label>
          <Input id="mix-date" type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mix-note">Anything else?</label>
          <Textarea id="mix-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Early check-in, connecting rooms…" />
        </div>
      </div>

      {problem ? <Notice tone="warn" className="mt-3">{problem}</Notice> : null}

      <EstimatePanel estimate={estimate} pricing={pricing} complete={complete} pax={Number(pax) || 1} />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          className={PKG_PRIMARY}
          loading={sending}
          disabled={!complete || pricing}
          onClick={send}
        >
          <Send className="h-4 w-4" aria-hidden />
          Request a price
        </Button>
      </div>
    </Card>
  );
}

/**
 * What the selection comes to — or an honest statement that it cannot be totalled.
 *
 * <p>The comparison against the cheapest ready-made tier is the point of the panel: a mix that costs
 * more than a published package is a mix the buyer should not send, and they can only know that if
 * both numbers are in front of them.</p>
 */
function EstimatePanel({ estimate, pricing, complete, pax }) {
  if (!complete) {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Choose a level for every stop to see an estimate.
      </div>
    );
  }

  if (pricing && !estimate) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Pricing your selection…
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className={cn("mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4", pricing && "opacity-60")}>
      {estimate.priced ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your estimate</div>
            <div className={cn("text-3xl font-bold leading-tight tracking-tight", PKG_ACCENT_TEXT)}>
              {fmtMoney(estimate.perPax)}
              <span className="text-sm font-normal text-slate-500"> / person</span>
            </div>
            <div className="mt-0.5 text-sm text-slate-700">
              <span className="font-semibold">{fmtMoney(estimate.total)}</span> total for {pax} traveller{pax === 1 ? "" : "s"}
            </div>
            {(estimate.lines ?? []).length ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                {estimate.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span className="truncate">
                      {l.cityName || l.vehicleName || l.hotelName || l.kind}
                      {l.nights ? ` · ${l.nights} night${l.nights === 1 ? "" : "s"}` : ""}
                    </span>
                    <span className="shrink-0 font-medium text-slate-700">{fmtMoney(l.amountPerPax)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {estimate.cheapestTierPerPax ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-500">
              Ready-made packages start at
              <div className="text-sm font-semibold text-slate-800">{fmtMoney(estimate.cheapestTierPerPax)} / person</div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="text-sm font-medium text-slate-800">Price on request</div>
          <p className="mt-0.5 text-xs text-slate-500">
            The agency has not published a rate for
            {" "}{(estimate.unpricedComponents ?? []).join(", ") || "part of this selection"}.
            Send the request and they will price it.
          </p>
        </>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        {/* Said plainly, every time. The whole flow exists because this number is not a quote. */}
        An estimate from the agency&rsquo;s published component rates — not a confirmed price. They
        will send you the real one.
      </p>
    </div>
  );
}

/**
 * One choosable hotel at one stop. Everything the decision is made on is ON the card — the tier,
 * the hotel, its stars, room and meals, the per-night rate when published, and a thumbnail so a
 * buyer who has seen the property recognises it — and the selected one is unmistakable.
 */
function OptionCard({ on, onPick, tier, hotel, nights }) {
  const h = hotel ?? {};
  const thumb = h.images?.[0]?.imageUrl || h.roomImages?.[0]?.imageUrl || null;
  const stars = Math.min(5, Number(h.hotelStars) || 0);
  // Display arithmetic only — rate × nights, from numbers the author published. The TOTAL still
  // comes from the server (see the file header); this just lets a buyer see where it comes from.
  const n = Math.max(1, Number(nights) || 1);
  const stayAmount = h.perPaxPerNight != null ? Number(h.perPaxPerNight) * n : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition",
        on ? "border-blue-600 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-300"
      )}
    >
      {thumb ? (
        <img src={thumb} alt="" loading="lazy" className="h-12 w-14 shrink-0 rounded-md bg-slate-100 object-cover" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={cn("text-[11px] font-bold uppercase tracking-wide", on ? "text-blue-700" : "text-slate-500")}>
            {tier.name}{tier.category ? ` · ${PACKAGE_CATEGORY[tier.category] ?? tier.category}` : ""}
          </span>
          {on ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden /> : null}
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">
          {h.hotelName || "Hotel to be confirmed"}
        </span>
        {stars ? (
          <span className="mt-0.5 flex items-center gap-px" role="img" aria-label={`${stars} star`}>
            {Array.from({ length: stars }, (_, i) => (
              <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
            ))}
          </span>
        ) : null}
        {(h.roomType || h.mealPlan) ? (
          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
            {[h.roomType, h.mealPlan].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {h.perPaxPerNight != null ? (
          <span className="mt-1 block text-xs text-slate-600">
            {fmtMoney(h.perPaxPerNight)} × {n} night{n === 1 ? "" : "s"}
            {" = "}
            <span className="font-semibold text-slate-900">{fmtMoney(stayAmount)}</span>
            <span className="text-slate-500"> / person</span>
          </span>
        ) : (
          <span className="mt-1 block text-[11px] italic text-slate-400">Rate not published — priced on request</span>
        )}
      </span>
    </button>
  );
}

/* ── Small helpers ───────────────────────────────────────────────────────── */

/** Cheapest tier's id, by its own "from" price. Falls back to the first when nothing is priced. */
function pickCheapest(tiers) {
  if (!tiers?.length) return "";
  const priced = tiers.filter((t) => t.fromPricePerPax !== null && t.fromPricePerPax !== undefined);
  if (!priced.length) return tiers[0].publicId;
  return priced.reduce((a, b) => (Number(a.fromPricePerPax) <= Number(b.fromPricePerPax) ? a : b)).publicId;
}

const cityKey = (v) => (v ?? "").trim().toLowerCase();

/** The tiers that actually have a hotel in this city — the only ones worth offering. */
function tiersWithHotelIn(tiers, cityName) {
  const want = cityKey(cityName);
  return (tiers ?? []).filter((t) => (t.hotels ?? []).some((h) => cityKey(h.cityName) === want));
}

/** The preferred tier if it covers this stop, else the first that does. */
function tierWithHotelIn(tiers, cityName, preferredId) {
  const options = tiersWithHotelIn(tiers, cityName);
  if (options.some((t) => t.publicId === preferredId)) return preferredId;
  return options[0]?.publicId ?? "";
}

function hotelIn(tiers, tierId, cityName) {
  const want = cityKey(cityName);
  return (tiers ?? []).find((t) => t.publicId === tierId)?.hotels
    ?.find((h) => cityKey(h.cityName) === want) ?? null;
}

export default MixBuilder;
