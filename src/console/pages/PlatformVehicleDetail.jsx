// src/console/pages/PlatformVehicleDetail.jsx
//
// Everything about one catalog vehicle, read-only, with the two decisions that matter attached to it.
//
// WHY THIS EXISTS. Clicking a vehicle used to drop straight into the edit form. That put the only way
// to LOOK at a listing behind the only way to CHANGE it: an operator checking what a coach seats had
// a live form under their cursor, one keystroke from a save nobody asked for. It also meant the three
// facts a catalog operator actually opens a row for — is it on sale, which version are tenants
// holding, how many agencies have taken a copy — had nowhere to render, even though every one of them
// already arrives on `PlatformVehicleAdminDto`.
//
// Sibling of PlatformHotelDetail, and deliberately the same shape: identity and the publish state up
// top, the record beneath it, Edit as its own destination rather than the page you land on.
//
// NOT A 360 SHELL. The hotel equivalent carries Photos, Calendar and Bookings tabs beside its
// overview. Transport has no gallery endpoint, no availability model and no per-vehicle order filter,
// so tabs here would be three empty rooms. When those exist this page is what they hang off.
//
// STYLING: console realm. Semantic utilities only — raw slate/blue resolve to the TENANT palette and
// would leak the wrong brand onto this screen.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Car, Loader2, Pencil } from "lucide-react";
import {
  PageShell, HotelStyles, GlassCard, Badge, Button, cn,
} from "../components/hotelUi";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";
import { transportAdminService as svc } from "../api/transportAdminService";

/** The catalog's own statuses. Same vocabulary the list chips and the row badges use. */
const STATUS_TONE = {
  ACTIVE: "bg-hue-emerald-soft text-hue-emerald",
  DRAFT: "bg-hue-amber-soft text-hue-amber",
  INACTIVE: "bg-surface-hover text-muted",
  SUSPENDED: "bg-hue-rose-soft text-hue-rose",
};

const STATUS_LABEL = {
  ACTIVE: "Published",
  DRAFT: "Draft",
  INACTIVE: "Unpublished",
  SUSPENDED: "Suspended",
};

export default function PlatformVehicleDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /* Publish and unpublish carry `@RequireSuperAdminStepUp` server-side — they change what every
     agency on the platform can buy — so the code is collected by the modal and threaded through.
     Same flow as the catalog list, deliberately: one verb, one confirmation, wherever it is invoked. */
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const full = await svc.getVehicle(publicId);
      if (!full) { setLoadError("That vehicle could not be found."); return; }
      setVehicle(full);
    } catch (e) {
      setLoadError(e?.normalized?.message ?? "Could not load that vehicle.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  async function runPublishToggle(mfaCode) {
    setBusy(true);
    setActionError("");
    try {
      if (vehicle.status === "ACTIVE") await svc.unpublishVehicle(publicId, mfaCode);
      else await svc.publishVehicle(publicId, mfaCode);
      setConfirming(false);
      await load();
    } catch (e) {
      setActionError(e?.normalized?.message ?? "Could not change that vehicle's status.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <HotelStyles />
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> Loading vehicle…
        </p>
      </PageShell>
    );
  }

  if (loadError || !vehicle) {
    return (
      <PageShell>
        <HotelStyles />
        <p className="py-24 text-center text-sm text-heading">{loadError || "Vehicle not found."}</p>
      </PageShell>
    );
  }

  const published = vehicle.status === "ACTIVE";
  const heldBy = vehicle.linkedTenantCount ?? 0;
  const place = [vehicle.cityName, vehicle.stateName, vehicle.countryCode].filter(Boolean).join(", ");

  return (
    <PageShell>
      <HotelStyles />

      <button
        type="button"
        onClick={() => navigate("/console/transport-catalog")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft size={15} /> Transport catalog
      </button>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-text shadow-lg shadow-accent/20">
            <Car className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-heading sm:text-2xl">{vehicle.name}</h1>
            <p className="text-sm text-muted">{place || "Reporting city not set"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The three facts an operator opens a row for, and the two decisions attached to them. */}
          <span className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
            STATUS_TONE[vehicle.status] ?? STATUS_TONE.INACTIVE,
          )}>
            {STATUS_LABEL[vehicle.status] ?? vehicle.status ?? "—"}
          </span>
          {vehicle.catalogVersion != null && <Badge variant="slate">v{vehicle.catalogVersion}</Badge>}
          {heldBy > 0 && (
            <Badge variant="blue">Held by {heldBy} agenc{heldBy === 1 ? "y" : "ies"}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/console/transport-catalog/${publicId}/edit`)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setActionError(""); setConfirming(true); }}>
            {published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </header>

      <GlassCard className="mb-5 px-4 py-3">
        <p className="text-sm text-body">
          {published
            ? "Live in the transport catalog — every entitled agency can search and request it."
            : "Not on sale. No agency can see or request this vehicle until it is published."}
        </p>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Vehicle details" hint="Copied into every agency's vehicle master on sync">
          <Row label="Type" value={human(vehicle.vehicleType)} />
          <Row label="Air conditioned" value={vehicle.airConditioned ? "Yes" : "No"} />
          <Row label="Passengers" value={vehicle.passengerCapacity} />
          <Row label="Luggage pieces" value={vehicle.luggageCapacity} />
          <Row label="Confirmation" value={human(vehicle.confirmationMode)} />
        </Section>

        <Section title="Reports from" hint="Where the driver starts — what an agency's import resolves against">
          <Row label="City" value={vehicle.cityName} />
          <Row label="State" value={vehicle.stateName} />
          <Row label="Country" value={vehicle.countryCode} />
          <Row label="City code" value={vehicle.cityCode} />
          <Row label="Coverage note" value={vehicle.coverageNote} wide />
        </Section>

        <Section title="How it is presented">
          <Row label="Amenities" value={(vehicle.amenities ?? []).join(", ")} wide />
          <Row label="Description" value={vehicle.description} wide />
          <Row label="Photos" value={`${(vehicle.images ?? []).length} on file`} />
        </Section>

        <Section title="Supplier">
          <Row label="Owner company" value={vehicle.ownerCompanyName} />
          <Row label="Owner name" value={vehicle.ownerName} />
          <Row label="Vendor publicId" value={vehicle.supplierVendorPublicId} mono />
        </Section>

        {/* Net rates are what the platform PAYS the operator and must never reach an agency. Safe on
            this page because it is console-only; nothing in `features/` may import it. */}
        <div className="lg:col-span-2">
          <Section title="Contracted rates" hint="What the platform pays the operator — never shown to an agency">
            {(vehicle.rates ?? []).length === 0 ? (
              <p className="col-span-full text-sm text-muted">
                No rates recorded. The vehicle still sells — every listing is on request — but whoever
                approves an order will be working without the contracted figures.
              </p>
            ) : (
              <ul className="col-span-full divide-y divide-border rounded-xl border border-border">
                {vehicle.rates.map((r) => (
                  <li key={r.publicId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-heading">
                        {human(r.serviceType)}
                        <span className="ml-2 font-normal text-muted">{human(r.rateModel)?.toLowerCase()}</span>
                        {!r.active && <span className="ml-2 text-[11px] font-semibold text-muted">(inactive)</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted">
                        {[
                          r.rateCode,
                          r.includedKm ? `${r.includedKm} km` : null,
                          r.includedHours ? `${r.includedHours} hr` : null,
                          r.extraKmRate ? `+${r.extraKmRate}/km` : null,
                          r.driverAllowance ? `DA ${r.driverAllowance}` : null,
                          r.nightHalt ? `NH ${r.nightHalt}` : null,
                        ].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-heading">
                      {r.netRate == null
                        ? "—"
                        : `${r.currency === "INR" ? "₹" : `${r.currency} `}${Number(r.netRate).toLocaleString("en-IN")}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {confirming && (
        <SuperAdminMfaActionModal
          title={published ? "Confirm unpublish" : "Confirm publish"}
          description={published
            ? `This withdraws ${vehicle.name} from sale. Orders already placed and copies already imported are untouched.`
            : `This puts ${vehicle.name} on sale to every agency on the platform.`}
          confirmLabel={published ? "Unpublish" : "Publish"}
          saving={busy}
          error={actionError}
          onClose={busy ? undefined : () => setConfirming(false)}
          onConfirm={runPublishToggle}
        />
      )}
    </PageShell>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function Section({ title, hint, children }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-extrabold text-heading">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{children}</dl>
    </GlassCard>
  );
}

/**
 * One recorded value.
 *
 * An em dash rather than a blank, because on a READ page the difference between "nobody filled this
 * in" and "the row stopped rendering" has to be visible. The editor is where a blank means something.
 */
function Row({ label, value, wide, mono }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn(
        "mt-0.5 break-words text-sm font-semibold",
        mono && !empty ? "font-mono text-xs" : "",
        empty ? "text-border-strong" : "text-heading",
      )}>
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

/** `TEMPO_TRAVELLER` → `Tempo traveller`. An enum is not a label. */
function human(value) {
  if (!value) return null;
  const words = String(value).replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
