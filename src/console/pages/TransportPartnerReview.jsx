import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Briefcase, Building2, Car, Check, ChevronLeft, ChevronRight, ExternalLink,
  Loader2, MapPin, RefreshCw, Snowflake, Users, X,
} from "lucide-react";
import { transportPartnerService, REG_STATUS } from "../api/transportPartnerService";
import { useStepUp } from "../components/useStepUp";

/**
 * One transport partner submission, reviewed on a full page.
 *
 * <p>Sibling of {@code HotelPartnerReview}, and the same decision — publish this supplier into the
 * platform catalog, or send it back — but the thing being reviewed is shaped differently, and the
 * differences are what this page is built around:
 * <ul>
 *   <li><b>The unit of approval is a FLEET, not a product.</b> One decision publishes every vehicle
 *       in the submission at once. A hotel reviewer weighs one property; here a single click can put
 *       a dozen vehicles in front of every tenant, so the page has to make the whole fleet readable
 *       without expanding anything.</li>
 *   <li><b>A vehicle's price is a rate CARD, not a number.</b> The same vehicle carries a different
 *       rate per {@code serviceType} × {@code rateModel}, each with its own km/hour allowance, extra
 *       rates, driver allowance and night halt. A single "net rate" column would be meaningless
 *       without the allowances beside it — a ₹3,000 per-day rate including 250 km is a different
 *       offer from a ₹3,000 per-day rate including 80 km.</li>
 *   <li><b>An inactive rate is not cosmetic.</b> A vehicle whose rates are all inactive publishes
 *       into the catalog with nothing sellable on it — it renders to tenants as "on request" forever.
 *       That has no hotel equivalent (a room with no rate is visibly a room with no rate) so it gets
 *       its own line in the readiness banner.</li>
 *   <li><b>{@code primaryImageUrl}</b> is the catalog hero promotion will copy. Marked on the strip,
 *       so which photo tenants see is a decision rather than a surprise.</li>
 * </ul>
 *
 * <p>⚠ {@code netRate} on this page is what the PLATFORM PAYS THE OPERATOR. It is legitimate here and
 * on the operator's own wizard, and nowhere else — nothing on this screen may be mirrored onto a
 * tenant surface, which sees one indicative payable and no breakdown at all.
 *
 * <p>A page rather than a drawer: the URL is shareable and openable in a second tab, which is what
 * "let me check this against the other submission" actually needs, and browser Back works.
 *
 * <p>STYLING: console realm. Semantic utilities and hue tokens only.
 */
export default function TransportPartnerReview() {
  const { publicId } = useParams();
  const navigate = useNavigate();

  const [reg, setReg] = useState(null);
  const [dups, setDups] = useState([]);
  /* Distinguished from an empty result on purpose. A `.catch(() => [])` would make a FAILED check
     indistinguishable from a clean one — the reviewer would be shown "no duplicates" when nothing
     had actually been checked. */
  const [dupCheckFailed, setDupCheckFailed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("");        // "" | "changes" | "reject"
  const [note, setNote] = useState("");
  const [lightbox, setLightbox] = useState(null);   // { images, index }

  /* The three decisions are `@RequireSuperAdminStepUp` server-side. The hook owns the code field,
     the busy state and — importantly — the failure: a code that expired while the operator typed has
     to be retryable in place, and a toast behind a dialog is dismissed before it is read. */
  const stepUp = useStepUp();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const data = await transportPartnerService.getRegistration(publicId);
      setReg(data);
    } catch (e) {
      // The banner has to live OUTSIDE the `reg &&` branch, or a load failure leaves the spinner
      // turning forever with no message and no retry.
      setLoadError(e?.response?.data?.message || "Could not load this submission.");
      setReg(null);
    }
    try {
      setDups(await transportPartnerService.duplicates(publicId) || []);
      setDupCheckFailed(false);
    } catch {
      setDups([]);
      setDupCheckFailed(true);
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  // Lightbox keyboard: Escape closes, arrows page. A photo you cannot enlarge is a photo you cannot
  // review, and a vehicle is approved largely on its photos.
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((l) => l && { ...l, index: (l.index + 1) % l.images.length });
      if (e.key === "ArrowLeft") setLightbox((l) => l && { ...l, index: (l.index - 1 + l.images.length) % l.images.length });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  /** One entry point for all three decisions — they differ only in wording and in which call runs. */
  const decide = (kind, decisionNote) =>
    stepUp.request({
      title: kind === "approve" ? "Approve this transport partner"
        : kind === "reject" ? "Reject this submission" : "Request partner changes",
      description: kind === "approve"
        // Said plainly, because this is the click that makes a whole fleet sellable.
        ? "Approving publishes this operator's vehicles into the platform transport catalog. This is audited."
        : "This decision changes the transport partner onboarding state and is audited.",
      confirmLabel: kind === "approve" ? "Approve" : kind === "reject" ? "Reject" : "Request changes",
      run: async (mfaCode) => {
        if (kind === "approve") await transportPartnerService.approve(publicId, mfaCode);
        else if (kind === "reject") await transportPartnerService.reject(publicId, decisionNote, mfaCode);
        else await transportPartnerService.requestChanges(publicId, decisionNote, mfaCode);
        navigate("/console/transport-partners");
      },
    });

  if (loadError) {
    return (
      <Shell onBack={() => navigate("/console/transport-partners")}>
        <div className="mx-auto mt-16 max-w-md text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-hue-amber" />
          <p className="mt-2 text-sm font-semibold text-heading">{loadError}</p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!reg) {
    return (
      <Shell onBack={() => navigate("/console/transport-partners")}>
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div>
      </Shell>
    );
  }

  const decidable = reg.status === "SUBMITTED";
  const vehicles = reg.vehicles || [];

  /* Named, not counted. "3 fields blank" tells the reviewer to go hunting; naming them is the
     difference between a warning and a work item. Only fields a reviewer would actually chase. */
  const blanks = [
    ["Cancellation policy", reg.cancellationPolicy],
    ["Coverage", reg.coverageNote],
    ["About", reg.about],
    ["Phone", reg.phone],
    ["Email", reg.email],
    ["Address", reg.address],
    ["Notice hours", reg.noticeHours],
  ].filter(([, v]) => v === null || v === undefined || v === "").map(([k]) => k);

  /* FLEET READINESS — four separate conditions, so a list rather than the hotel page's one-sentence
     banner. Each of these survives submit validation and each changes what the catalog ends up
     holding, so they are named individually and marked again on the card they belong to. */
  const isActive = (x) => x.active !== false;
  const readiness = [];
  const inactiveVehicles = vehicles.filter((v) => !isActive(v)).length;
  const inactiveRates = vehicles.reduce((n, v) => n + (v.rates || []).filter((r) => !isActive(r)).length, 0);
  const unsellable = vehicles.filter((v) => isActive(v) && !(v.rates || []).some(isActive)).length;
  const photoless = vehicles.filter((v) => !v.primaryImageUrl && (v.images || []).length === 0).length;
  if (inactiveVehicles) readiness.push(`${inactiveVehicles} vehicle${plural(inactiveVehicles)} marked inactive — ${inactiveVehicles === 1 ? "it" : "they"} will not be published.`);
  if (inactiveRates) readiness.push(`${inactiveRates} rate${plural(inactiveRates)} marked inactive.`);
  if (unsellable) readiness.push(`${unsellable} active vehicle${plural(unsellable)} with no active rate — ${unsellable === 1 ? "it" : "they"} would publish with nothing to sell.`);
  if (photoless) readiness.push(`${photoless} vehicle${plural(photoless)} with no photo.`);

  const promotedCount = vehicles.filter((v) => v.promotedPlatformVehiclePublicId).length;

  return (
    <Shell onBack={() => navigate("/console/transport-partners")}>
      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-heading">{reg.companyName || "Untitled submission"}</h1>
            <Chip value={reg.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} />
              {[reg.cityName, reg.stateName, reg.countryCode].filter(Boolean).join(", ") || "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Car size={13} />
              {vehicles.length} vehicle{plural(vehicles.length)}
            </span>
            {reg.submittedAt && <span className="text-muted">Submitted {fmt(reg.submittedAt)}</span>}
          </p>
        </div>
        {promotedCount > 0 && (
          /* There is no per-vehicle console route — the catalog is a single list screen — so this
             opens the list rather than pretending a deep link exists. */
          <button
            onClick={() => navigate("/console/transport-catalog")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-hover"
          >
            <ExternalLink size={13} /> {promotedCount} in catalog
          </button>
        )}
      </header>

      {/* ── Things to look at before deciding ───────────────────────────── */}
      <div className="mt-4 space-y-2">
        {dupCheckFailed && (
          <Banner tone="amber">
            The duplicate check failed to run — this operator has <b>not</b> been compared against
            existing ones.
          </Banner>
        )}
        {dups.length > 0 && (
          <Banner tone="amber">
            <span className="font-bold">
              {dups.length} possible duplicate{plural(dups.length)}:
            </span>{" "}
            {dups.map((d, i) => (
              <span key={d.publicId}>
                {i > 0 && ", "}
                <button
                  onClick={() => navigate(`/console/transport-partners/${d.publicId}`)}
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {d.companyName || "Untitled"}{d.cityName ? ` · ${d.cityName}` : ""}
                </button>
                <span className="text-[11px] opacity-70"> ({d.status})</span>
              </span>
            ))}
          </Banner>
        )}
        {readiness.length > 0 && (
          <Banner tone="amber">
            <span className="font-bold">Before publishing this fleet:</span>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {readiness.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </Banner>
        )}
        {blanks.length > 0 && (
          <Banner tone="slate">
            Not filled in: {blanks.join(" · ")}
          </Banner>
        )}
      </div>

      {/* ── Review trail — shown for EVERY status ───────────────────────── */}
      {(reg.reviewerNote || reg.reviewedAt) && (
        <section className="mt-4 rounded-xl border border-border bg-page p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Previous review</h2>
          {reg.reviewedAt && <p className="mt-1 text-xs text-muted">{fmt(reg.reviewedAt)}</p>}
          {/* Without this, a CHANGES_REQUESTED submission is impossible to re-review: the note the
              partner was sent is in the payload and would never be painted. */}
          {reg.reviewerNote && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-body">{reg.reviewerNote}</p>
          )}
        </section>
      )}

      {/* ── The operator ────────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Company">
          <KV k="Name" v={reg.companyName} />
          <KV k="Contact" v={reg.contactPerson} />
          <KV k="Website" v={reg.website} href={reg.website} />
          <KV k="Promoted" v={reg.promotedAt ? fmt(reg.promotedAt) : null} />
        </Card>
        <Card title="Operating base">
          <KV k="Address" v={reg.address} />
          <KV k="City" v={[reg.cityName, reg.cityCode && `(${reg.cityCode})`].filter(Boolean).join(" ")} />
          <KV k="State / country" v={[reg.stateName, reg.countryCode].filter(Boolean).join(", ")} />
        </Card>
        <Card title="Contact & terms">
          <KV k="Phone" v={reg.phone} />
          <KV k="Email" v={reg.email} href={reg.email ? `mailto:${reg.email}` : null} />
          {/* The lead time the operator needs to confirm a job. It decides whether this fleet can
              serve a same-day request at all, which is most of what transport demand looks like. */}
          <KV k="Notice" v={reg.noticeHours != null ? `${reg.noticeHours} h before pickup` : null} />
        </Card>
      </div>

      {(reg.about || reg.coverageNote || reg.cancellationPolicy) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {reg.about && <Card title="About"><Prose text={reg.about} /></Card>}
          {/* Where they actually run. A fleet based in one city routinely covers a whole region, and
              the city field alone would understate — or overstate — what can be sold against it. */}
          {reg.coverageNote && <Card title="Coverage"><Prose text={reg.coverageNote} /></Card>}
          {reg.cancellationPolicy && (
            <Card title="Cancellation policy"><Prose text={reg.cancellationPolicy} /></Card>
          )}
        </div>
      )}

      {/* ── The fleet ───────────────────────────────────────────────────── */}
      <section className="mt-5">
        <SectionHead title="Fleet & net rates" count={vehicles.length} />
        {vehicles.length === 0 ? (
          <Empty>No vehicles submitted — this cannot be published.</Empty>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.publicId}
                vehicle={v}
                onOpenPhoto={(images, index) => setLightbox({ images, index })}
              />
            ))}
          </div>
        )}
        {vehicles.length > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Net rate is what the platform pays the operator. Tenants never see it — they are quoted a
            single payable built from these rates and the commercial rule that applies.
          </p>
        )}
      </section>

      {/* ── Decide ──────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 mt-6 border-t border-border bg-surface/95 py-3 backdrop-blur">
        {!decidable ? (
          <p className="text-sm text-muted">
            This submission is <b>{REG_STATUS[reg.status]?.label || reg.status}</b> — no decision to take.
          </p>
        ) : mode === "" ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => decide("approve")}
              disabled={stepUp.busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50"
            >
              <Check size={15} /> Approve &amp; publish fleet
            </button>
            <button
              onClick={() => { setMode("changes"); setNote(""); }}
              disabled={stepUp.busy}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-50"
            >
              Request changes
            </button>
            <button
              onClick={() => { setMode("reject"); setNote(""); }}
              disabled={stepUp.busy}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-body">
              {mode === "changes"
                ? "What should the operator fix? They are shown this message."
                : "Why is this rejected? The operator is shown this message."}
            </p>
            <textarea
              autoFocus
              rows={3}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => decide(mode === "reject" ? "reject" : "changes", note)}
                disabled={stepUp.busy || !note.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-40"
              >
                {stepUp.busy ? "Sending…" : mode === "reject" ? "Reject submission" : "Send back"}
              </button>
              <button
                onClick={() => setMode("")}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-heading"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          {...lightbox}
          onClose={() => setLightbox(null)}
          onStep={(d) => setLightbox((l) => l && {
            ...l, index: (l.index + d + l.images.length) % l.images.length,
          })}
        />
      )}
      {stepUp.dialog}
    </Shell>
  );
}

/* ── the fleet ────────────────────────────────────────────────────────── */

/**
 * One vehicle: what it is, what it looks like, and what it costs.
 *
 * A card with a table under it, rather than a row in one big fleet table. The rate card is a matrix
 * — the same vehicle priced per service type and rate model — so flattening every vehicle's rates
 * into a single table would put the vehicle name on every line and lose which allowances belong to
 * which offer.
 */
function VehicleCard({ vehicle: v, onOpenPhoto }) {
  const inactive = v.active === false;
  const images = v.images || [];
  /* Promotion copies `primaryImageUrl` as the catalog hero and falls back to the first photo. Which
     one that is has to be visible here, or the tenant-facing image is decided by accident. */
  const primary = v.primaryImageUrl || images[0] || null;
  /* The primary may not be inside `images` — it is a separate field on the DTO — so the strip is the
     union, primary first, de-duplicated. */
  const strip = [...new Set([primary, ...images].filter(Boolean))];
  const rates = v.rates || [];

  return (
    <div className={`rounded-xl border p-4 ${inactive ? "border-hue-amber/40 bg-hue-amber-soft/40" : "border-border bg-surface"}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <Car size={14} className="shrink-0 text-muted" />
        <span className="font-bold text-heading">{v.name || "Unnamed vehicle"}</span>
        {inactive && <InactiveTag />}
        {v.promotedPlatformVehiclePublicId && (
          <span className="rounded bg-hue-emerald-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-hue-emerald">
            In catalog
          </span>
        )}
        {/* Seats, bags and air-conditioning are the three facts a tenant filters on, so they are the
            three facts a reviewer has to be able to check without opening anything. */}
        <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          <span className="font-semibold">{human(v.vehicleType)}</span>
          <span className="inline-flex items-center gap-1">
            <Users size={11} />
            {v.passengerCapacity != null ? `${v.passengerCapacity} seat${plural(v.passengerCapacity)}` : "seats —"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Briefcase size={11} />
            {v.luggageCapacity != null ? `${v.luggageCapacity} bag${plural(v.luggageCapacity)}` : "bags —"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Snowflake size={11} /> {v.airConditioned === false ? "Non-AC" : "AC"}
          </span>
        </span>
      </div>

      {/* Whose coach this actually is, when it is attached rather than the operator's own.
          Rendered ONLY when they said so — blank means "mine", and stamping an owner line on every
          self-owned vehicle would bury the four rows in a fifty-vehicle fleet that are the whole
          reason the field exists. Platform-internal: it is not on the catalog product and no tenant
          sees it. */}
      {(v.ownerCompanyName || v.ownerName) && (
        <p className="mt-2 inline-flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <Building2 size={11} className="shrink-0" />
          Owned by
          <span className="font-semibold text-body">
            {[v.ownerCompanyName, v.ownerName].filter(Boolean).join(" · ")}
          </span>
        </p>
      )}

      {v.description && <Prose className="mt-2" text={v.description} />}

      {(v.amenities || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {v.amenities.map((a) => (
            <span key={a} className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-body">{a}</span>
          ))}
        </div>
      )}

      {strip.length === 0 ? (
        <p className="mt-3 text-xs font-semibold text-hue-amber">No photos on this vehicle.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {strip.map((url, i) => (
            <Thumb
              key={url + i}
              url={url}
              badge={url === primary ? "Cover" : null}
              small
              onClick={() => onOpenPhoto(strip, i)}
            />
          ))}
        </div>
      )}

      {rates.length === 0 ? (
        <p className="mt-3 text-xs font-semibold text-hue-amber">No rates on this vehicle.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-3 font-semibold">Service</th>
                <th className="py-1.5 pr-3 font-semibold">Rate model</th>
                <th className="py-1.5 pr-3 font-semibold">Code</th>
                {/* Included and extra sit next to the net rate on purpose: the rate is only
                    comparable against another operator's once the allowance is read with it. */}
                <th className="py-1.5 pr-3 font-semibold">Included</th>
                <th className="py-1.5 pr-3 font-semibold">Beyond that</th>
                <th className="py-1.5 pr-3 font-semibold">Driver</th>
                <th className="py-1.5 pr-3 font-semibold">Night halt</th>
                <th className="py-1.5 text-right font-semibold">Net rate</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const dim = r.active === false ? "opacity-60" : "";
                return [
                  <tr key={r.publicId} className={`border-b border-border/60 ${dim}`}>
                    <td className="py-1.5 pr-3 font-semibold text-heading">
                      {human(r.serviceType)}
                      {r.active === false && <span className="ml-1.5"><InactiveTag /></span>}
                    </td>
                    <td className="py-1.5 pr-3 text-body">{human(r.rateModel)}</td>
                    <td className="py-1.5 pr-3 text-muted">{r.rateCode || "—"}</td>
                    <td className="py-1.5 pr-3 text-body">{allowance(r) || "—"}</td>
                    <td className="py-1.5 pr-3 text-body">{extras(r) || "—"}</td>
                    <td className="py-1.5 pr-3 text-body">{money(r.driverAllowance, r.currency)}</td>
                    <td className="py-1.5 pr-3 text-body">{money(r.nightHalt, r.currency)}</td>
                    <td className="py-1.5 text-right font-bold text-heading">
                      {money(r.netRate, r.currency)}
                      <span className="ml-0.5 font-medium text-muted">{unitOf(r.rateModel)}</span>
                    </td>
                  </tr>,
                  /* Inclusions are prose and would truncate to nothing in a column — they get the
                     full width under their own rate instead. */
                  r.inclusionsText ? (
                    <tr key={`${r.publicId}-inc`} className={`border-b border-border/60 ${dim}`}>
                      <td colSpan={8} className="pb-2 text-[11px] leading-relaxed text-muted">
                        {r.inclusionsText}
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function Shell({ onBack, children }) {
  return (
    <div className="pb-8">
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-heading"
      >
        <ArrowLeft size={15} /> Transport partners
      </button>
      {children}
    </div>
  );
}

function Chip({ value }) {
  const c = REG_STATUS[value] ?? { label: value ?? "—", cls: "bg-surface-hover text-muted" };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

function Banner({ tone, children }) {
  const cls = tone === "amber"
    ? "bg-hue-amber-soft text-hue-amber"
    : "bg-surface-hover text-body";
  return <div className={`rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${cls}`}>{children}</div>;
}

function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-2 space-y-1.5">{children}</div>
    </section>
  );
}

function SectionHead({ title, count }) {
  return (
    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
      {title} {count != null && <span className="text-muted/70">({count})</span>}
    </h2>
  );
}

/** A dash for absent, and a real link when the value is one. */
function KV({ k, v, href }) {
  const empty = v === null || v === undefined || v === "";
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-28 shrink-0 text-xs text-muted">{k}</span>
      {empty ? (
        <span className="text-muted">—</span>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate font-semibold text-accent-soft-text underline underline-offset-2"
        >
          {String(v)}
        </a>
      ) : (
        <span className="min-w-0 flex-1 font-semibold text-body">{String(v)}</span>
      )}
    </div>
  );
}

const Prose = ({ text, className = "" }) => (
  <p className={`whitespace-pre-wrap text-sm leading-relaxed text-body ${className}`}>{text}</p>
);

const Empty = ({ children }) => <p className="text-sm text-muted">{children}</p>;

const InactiveTag = () => (
  <span className="rounded bg-hue-amber-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-hue-amber">
    Inactive
  </span>
);

function Thumb({ url, badge, small, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group relative overflow-hidden rounded-lg border border-border">
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`w-full object-cover transition group-hover:opacity-90 ${small ? "h-16" : "h-28"}`}
        /* A dead Cloudinary URL renders as a broken-image glyph; this says so in words, because "the
           photo is missing" is itself a review finding. */
        onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.dataset.broken = "1"; }}
      />
      {badge && (
        <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-text">
          {badge}
        </span>
      )}
      <span className="hidden text-[10px] font-semibold text-hue-rose [button[data-broken]_&]:block">
        Image failed to load
      </span>
    </button>
  );
}

function Lightbox({ images, index, onClose, onStep }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-white/70 hover:text-white">
        <X size={20} />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onStep(-1); }}
            className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStep(1); }}
            className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
      <span className="absolute bottom-4 text-xs font-semibold text-white/60">
        {index + 1} / {images.length}
      </span>
    </div>
  );
}

/* ── formatting ───────────────────────────────────────────────────────── */

const money = (a, c = "INR") =>
  a === null || a === undefined ? "—"
    : `${c === "INR" ? "₹" : `${c} `}${Number(a).toLocaleString("en-IN")}`;

const fmt = (s) => (s ? new Date(s).toLocaleString() : "—");

/** AIRPORT_TRANSFER → "Airport transfer". Derived, not a hardcoded vocabulary, so a new enum
    constant reads correctly the day the backend adds it instead of rendering as a raw shout. */
const human = (v) =>
  !v ? "—" : String(v).toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const plural = (n) => (Number(n) === 1 ? "" : "s");

/**
 * The unit the net rate is expressed in.
 *
 * This one IS a map, unlike `human`: "per kilometre" is what the constant says, but "/km" is what a
 * money column can carry, and a reviewer comparing two operators reads the unit before the number.
 * An unknown constant falls back to no suffix rather than to a guessed one — a wrong unit next to an
 * amount is worse than none.
 */
const RATE_MODEL_UNIT = {
  FLAT_PER_TRANSFER: "/transfer",
  FLAT_PER_VEHICLE: "/vehicle",
  PER_KILOMETRE: "/km",
  PER_DAY: "/day",
  PER_HOUR: "/hour",
  PACKAGE: "/package",
  ROUTE_FIXED: "/route",
  CUSTOM_QUOTE: "",
};
const unitOf = (model) => RATE_MODEL_UNIT[model] ?? "";

/** "250 km · 8 h" — what the net rate already covers. */
function allowance(r) {
  const parts = [];
  if (r.includedKm != null) parts.push(`${Number(r.includedKm).toLocaleString("en-IN")} km`);
  if (r.includedHours != null) parts.push(`${r.includedHours} h`);
  return parts.join(" · ");
}

/** "₹12/km · ₹150/h" — what running past the allowance costs. */
function extras(r) {
  const parts = [];
  if (r.extraKmRate != null) parts.push(`${money(r.extraKmRate, r.currency)}/km`);
  if (r.extraHourRate != null) parts.push(`${money(r.extraHourRate, r.currency)}/h`);
  return parts.join(" · ");
}
