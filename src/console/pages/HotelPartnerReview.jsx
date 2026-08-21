import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BedDouble, Check, ChevronLeft, ChevronRight, ExternalLink,
  Loader2, MapPin, RefreshCw, Star, X,
} from "lucide-react";
import { hotelPartnerService, REG_STATUS } from "../api/hotelPartnerService";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

/**
 * One hotel partner submission, reviewed on a full page.
 *
 * <p>This replaces a {@code max-w-xl} slide-over — 576px, minus padding 536px of usable width — that
 * carried 28 of the payload's 55 leaf fields. The rest were fetched and thrown away, so the decision
 * to publish a hotel into the platform catalog was being taken on roughly half the submission.
 *
 * <p>The omissions that actually mattered, and are fixed here:
 * <ul>
 *   <li><b>{@code active} on rooms and rates.</b> An inactive room rendered byte-identical to an
 *       active one and was approved straight into the catalog.</li>
 *   <li><b>Room photos.</b> The partner form explicitly invites them; the reviewer never saw one.</li>
 *   <li><b>Cancellation and child policy, and the whole meal-plan list.</b> Absent entirely.</li>
 *   <li><b>{@code primaryImageUrl}.</b> Promotion silently takes {@code images[0]} as the catalog
 *       hero, and the reviewer had no way to know which photo that would be.</li>
 *   <li><b>The review trail.</b> {@code reviewerNote} was never rendered, so re-opening a
 *       CHANGES_REQUESTED submission could not tell you what had been asked for.</li>
 *   <li><b>Duplicates.</b> Only a count was shown. The server returns full DTOs — name, city,
 *       status, date — and they were discarded.</li>
 * </ul>
 *
 * <p>A page rather than a wider drawer: the URL is shareable and openable in a second tab, which is
 * what "let me check this against the other submission" actually needs, and browser Back works.
 */
export default function HotelPartnerReview() {
  const { publicId } = useParams();
  const navigate = useNavigate();

  const [reg, setReg] = useState(null);
  const [dups, setDups] = useState([]);
  /* Distinguished from an empty result on purpose. `duplicates().catch(() => [])` in the old panel
     made a FAILED check indistinguishable from a clean one — the reviewer was shown "no duplicates"
     when nothing had actually been checked. */
  const [dupCheckFailed, setDupCheckFailed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("");        // "" | "changes" | "reject"
  const [note, setNote] = useState("");
  /* No page-level error state: every decision now fails inside the step-up dialog, which renders the
     message next to the code field the operator is still looking at. A second banner behind the
     dialog was never set and could not render. */
  const [mfaAction, setMfaAction] = useState(null);
  const [mfaError, setMfaError] = useState("");
  const [lightbox, setLightbox] = useState(null);   // { images, index }

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const data = await hotelPartnerService.getRegistration(publicId);
      setReg(data);
    } catch (e) {
      // The old drawer put this banner INSIDE its `reg &&` branch, so a load failure left `reg`
      // null and the spinner turning forever with no message and no retry.
      setLoadError(e?.response?.data?.message || "Could not load this submission.");
      setReg(null);
    }
    try {
      setDups(await hotelPartnerService.duplicates(publicId) || []);
      setDupCheckFailed(false);
    } catch {
      setDups([]);
      setDupCheckFailed(true);
    }
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  // Lightbox keyboard: Escape closes, arrows page. A photo you cannot enlarge is a photo you cannot
  // review, which is the state this screen was in.
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

  const confirmDecision = async (mfaCode) => {
    const action = mfaAction;
    if (!action) return;
    setBusy(true);
    setMfaError("");
    try {
      if (action.kind === "approve") await hotelPartnerService.approve(publicId, mfaCode);
      else if (action.kind === "reject") await hotelPartnerService.reject(publicId, action.note, mfaCode);
      else await hotelPartnerService.requestChanges(publicId, action.note, mfaCode);
      setMfaAction(null);
      navigate("/console/hotel-partners");
    } catch (e) {
      setMfaError(e?.response?.data?.message || "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <Shell onBack={() => navigate("/console/hotel-partners")}>
        <div className="mx-auto mt-16 max-w-md text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-hue-amber" />
          <p className="mt-2 text-sm font-semibold text-heading">{loadError}</p>
          <button
            onClick={load}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!reg) {
    return (
      <Shell onBack={() => navigate("/console/hotel-partners")}>
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div>
      </Shell>
    );
  }

  const decidable = reg.status === "SUBMITTED";
  const images = reg.images || [];
  const rooms = reg.rooms || [];
  const mealPlans = reg.mealPlans || [];
  const primary = reg.primaryImageUrl || images[0] || null;

  /* Named, not counted. "3 fields blank" tells the reviewer to go hunting; naming them is the
     difference between a warning and a work item. Only fields a reviewer would actually chase. */
  const blanks = [
    ["Cancellation policy", reg.cancellationPolicy],
    ["Child policy", reg.childPolicy],
    ["Overview", reg.overview],
    ["Phone", reg.phone],
    ["Email", reg.email],
    ["Map link", reg.mapUrl],
    ["Check-in / out", reg.checkInTime || reg.checkOutTime],
  ].filter(([, v]) => !v).map(([k]) => k);

  const inactiveRooms = rooms.filter((r) => r.active === false).length;
  const inactiveRates = rooms.reduce(
    (n, r) => n + (r.rates || []).filter((rt) => rt.active === false).length, 0);

  return (
    <Shell onBack={() => navigate("/console/hotel-partners")}>
      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-heading">{reg.name || "Untitled submission"}</h1>
            <Chip value={reg.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} />
              {[reg.cityName, reg.stateName, reg.countryCode].filter(Boolean).join(", ") || "—"}
            </span>
            {reg.stars ? <span className="inline-flex items-center gap-1"><Star size={13} />{reg.stars}</span> : null}
            {reg.submittedAt && <span className="text-muted">Submitted {fmt(reg.submittedAt)}</span>}
          </p>
        </div>
        {reg.promotedPlatformHotelPublicId && (
          <button
            onClick={() => navigate(`/console/hotel-catalog/${reg.promotedPlatformHotelPublicId}`)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-hover"
          >
            <ExternalLink size={13} /> Open catalog hotel
          </button>
        )}
      </header>

      {/* ── Things to look at before deciding ───────────────────────────── */}
      <div className="mt-4 space-y-2">
        {dupCheckFailed && (
          <Banner tone="amber">
            The duplicate check failed to run — this submission has <b>not</b> been compared against
            existing ones.
          </Banner>
        )}
        {dups.length > 0 && (
          <Banner tone="amber">
            <span className="font-bold">
              {dups.length} possible duplicate{dups.length === 1 ? "" : "s"}:
            </span>{" "}
            {dups.map((d, i) => (
              <span key={d.publicId}>
                {i > 0 && ", "}
                <button
                  onClick={() => navigate(`/console/hotel-partners/${d.publicId}`)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {d.name || "Untitled"}{d.cityName ? ` · ${d.cityName}` : ""}
                </button>
                <span className="text-[11px] opacity-70"> ({d.status})</span>
              </span>
            ))}
          </Banner>
        )}
        {(inactiveRooms > 0 || inactiveRates > 0) && (
          <Banner tone="amber">
            {/* The old panel rendered these identically to active ones, and approving published
                them. Naming them is the whole point of the banner. */}
            This submission contains{" "}
            {inactiveRooms > 0 && <b>{inactiveRooms} inactive room{inactiveRooms === 1 ? "" : "s"}</b>}
            {inactiveRooms > 0 && inactiveRates > 0 && " and "}
            {inactiveRates > 0 && <b>{inactiveRates} inactive rate{inactiveRates === 1 ? "" : "s"}</b>}
            {" "}— marked below.
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
          {/* This is why a CHANGES_REQUESTED submission was impossible to re-review: the note the
              partner was sent existed in the payload and was never painted. */}
          {reg.reviewerNote && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-body">{reg.reviewerNote}</p>
          )}
        </section>
      )}

      {/* ── The property ────────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Identity">
          <KV k="Name" v={reg.name} />
          {/* Arrives as the PropertyType constant (RESORT, GUEST_HOUSE). `human` is already the
              screen's enum formatter and lands on exactly the sentence case the marketplace filter
              renders — "Guest house", not "Guest House". Guarded rather than passed straight through
              because human(null) returns a "—" STRING, which KV would then print as a bold value
              instead of the muted dash it shows for a genuinely empty field. */}
          <KV k="Property type" v={reg.propertyType ? human(reg.propertyType) : null} />
          <KV k="Total rooms" v={reg.totalRooms} />
          <KV k="Stars" v={reg.stars} />
          <KV k="Guest rating" v={reg.rating} />
          <KV k="Website" v={reg.website} href={reg.website} />
        </Card>
        <Card title="Location">
          {/* Street first, then the printable block — the order an address is written, and the same
              order the partner form asks in. Two separate fields on purpose: Street/Area is the half
              an agent filters on, Address is what gets printed on a voucher. */}
          <KV k="Street / Area" v={reg.street} />
          <KV k="Address" v={reg.address} />
          <KV k="City" v={[reg.cityName, reg.cityCode && `(${reg.cityCode})`].filter(Boolean).join(" ")} />
          <KV k="State / country" v={[reg.stateName, reg.countryCode].filter(Boolean).join(", ")} />
          <KV k="PIN Code" v={reg.pincode} />
          <KV k="Coordinates" v={reg.latitude && reg.longitude ? `${reg.latitude}, ${reg.longitude}` : null} />
          <KV k="Map" v={reg.mapUrl && "Open map"} href={reg.mapUrl} />
          {/* WORTH ONE CLICK BEFORE APPROVING. This is the only field on the form whose wrong value
              is invisible: it does not fail, it puts another property's rating and reviews on this
              hotel's catalog page, looking entirely genuine. The link opens the exact listing the
              owner picked. If it is wrong, approve anyway and fix it on the hotel — promotion copies
              this onto a DRAFT hotel, and the 360 screen's Google panel can rebind or clear it
              before publishing makes it visible to tenants. */}
          <KV
            k="Google listing"
            v={reg.googlePlaceId && "Verify on Google"}
            href={reg.googlePlaceId
              ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(reg.googlePlaceId)}`
              : null}
          />
        </Card>
        <Card title="Contact & timings">
          <KV k="Phone" v={reg.phone} />
          <KV k="Email" v={reg.email} href={reg.email ? `mailto:${reg.email}` : null} />
          <KV k="Check-in" v={reg.checkInTime} />
          <KV k="Check-out" v={reg.checkOutTime} />
        </Card>
      </div>

      {(reg.overview || reg.cancellationPolicy || reg.childPolicy) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {reg.overview && <Card title="Overview"><Prose text={reg.overview} /></Card>}
          {/* Both policies were absent from the old panel entirely, and they are the two things a
              reviewer is most likely to want to read word for word. */}
          {reg.cancellationPolicy && <Card title="Cancellation policy"><Prose text={reg.cancellationPolicy} /></Card>}
          {reg.childPolicy && <Card title="Child policy"><Prose text={reg.childPolicy} /></Card>}
        </div>
      )}

      {/* ── Photos ──────────────────────────────────────────────────────── */}
      <section className="mt-4">
        <SectionHead title="Hotel photos" count={images.length} />
        {images.length === 0 ? (
          <Empty>No photos submitted.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((url, i) => (
              <Thumb
                key={url + i}
                url={url}
                /* The catalog hero is whichever photo promotion picks, and the reviewer could not
                   previously tell which that would be. Marked, so it is a decision not a surprise. */
                badge={url === primary ? "Cover" : null}
                onClick={() => setLightbox({ images, index: i })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Amenities & meal plans ──────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Amenities (${(reg.amenities || []).length})`}>
          {(reg.amenities || []).length === 0 ? <Empty>None listed.</Empty> : (
            <div className="flex flex-wrap gap-1.5">
              {reg.amenities.map((a) => (
                <span key={a} className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-body">{a}</span>
              ))}
            </div>
          )}
        </Card>
        {/* Loaded by the server, shipped in the payload, and rendered nowhere before this. */}
        <Card title={`Meal plans (${mealPlans.length})`}>
          {mealPlans.length === 0 ? <Empty>None listed.</Empty> : (
            <ul className="space-y-1.5">
              {mealPlans.map((mp) => (
                <li key={mp.publicId} className="flex items-baseline gap-2 text-sm">
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent-soft-text">{mp.code}</span>
                  <span className="min-w-0 flex-1 text-body">
                    {mp.name || "—"}
                    {mp.description && <span className="text-muted"> · {mp.description}</span>}
                  </span>
                  {mp.active === false && <InactiveTag />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Rooms & rates ───────────────────────────────────────────────── */}
      <section className="mt-4">
        <SectionHead title="Rooms & net rates" count={rooms.length} />
        {rooms.length === 0 ? (
          <Empty>No rooms submitted — this cannot be published.</Empty>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.publicId}
                className={`rounded-xl border p-4 ${room.active === false ? "border-hue-amber/40 bg-hue-amber-soft" : "border-border bg-surface"}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <BedDouble size={14} className="shrink-0 text-muted" />
                  <span className="font-bold text-heading">{room.name || "Unnamed room"}</span>
                  {room.active === false && <InactiveTag />}
                  <span className="text-xs text-muted">
                    {[
                      // The tier ("Deluxe Room") leads, because room.name beside it is the
                      // property's own wording ("Deluxe Sea View") and the two answer different
                      // questions. filter(Boolean) already drops it on the rooms that predate the
                      // field, so no row grows an empty separator.
                      room.roomCategory,
                      room.bedType,
                      room.size,
                      occupancy(room),
                    ].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                {room.description && <Prose className="mt-2" text={room.description} />}

                {/* Room photos: collected by the partner form, never shown to the reviewer before. */}
                {(room.images || []).length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                    {room.images.map((url, i) => (
                      <Thumb key={url + i} url={url} small onClick={() => setLightbox({ images: room.images, index: i })} />
                    ))}
                  </div>
                )}

                {(room.rates || []).length === 0 ? (
                  <p className="mt-3 text-xs font-semibold text-hue-amber">No rates on this room.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    {/* The old table had no thead at all — four unlabeled columns of enum values
                        and a number. */}
                    <table className="w-full min-w-[32rem] text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                          <th className="py-1.5 pr-3 font-semibold">Meal plan</th>
                          <th className="py-1.5 pr-3 font-semibold">Occupancy</th>
                          <th className="py-1.5 pr-3 font-semibold">Rate code</th>
                          <th className="py-1.5 pr-3 font-semibold">Refundable</th>
                          <th className="py-1.5 text-right font-semibold">Net rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {room.rates.map((rt) => (
                          <tr key={rt.publicId} className={`border-b border-border/60 last:border-0 ${rt.active === false ? "opacity-60" : ""}`}>
                            <td className="py-1.5 pr-3 font-semibold text-heading">
                              {rt.mealPlanCode}
                              <span className="ml-1 font-medium text-muted">{mealLabel(rt.mealPlanCode)}</span>
                              {rt.active === false && <span className="ml-1.5"><InactiveTag /></span>}
                            </td>
                            <td className="py-1.5 pr-3 text-body">{human(rt.occupancyBasis)}</td>
                            <td className="py-1.5 pr-3 text-muted">{rt.rateCode || "—"}</td>
                            <td className="py-1.5 pr-3 text-body">
                              {rt.refundable == null ? "—" : rt.refundable ? "Refundable" : "Non-refundable"}
                            </td>
                            <td className="py-1.5 text-right font-bold text-heading">
                              {money(rt.netRate, rt.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
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
              onClick={() => { setMfaError(""); setMfaAction({ kind: "approve" }); }}
              disabled={busy}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-50"
            >
              <Check size={15} /> Approve
            </button>
            <button
              onClick={() => { setMode("changes"); setNote(""); }}
              disabled={busy}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-50"
            >
              Request changes
            </button>
            <button
              onClick={() => { setMode("reject"); setNote(""); }}
              disabled={busy}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border px-4 py-2 text-sm font-semibold text-hue-rose hover:bg-hue-rose-soft disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-body">
              {mode === "changes"
                ? "What should the hotel fix? They are shown this message."
                : "Why is this rejected? The hotel is shown this message."}
            </p>
            <textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  setMfaError("");
                  setMfaAction({ kind: mode === "reject" ? "reject" : "changes", note });
                }}
                disabled={busy || !note.trim()}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-text hover:bg-accent-hover disabled:opacity-40"
              >
                {busy ? "Sending…" : mode === "reject" ? "Reject submission" : "Send back"}
              </button>
              <button
                onClick={() => setMode("")}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-heading"
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
      {mfaAction && (
        <SuperAdminMfaActionModal
          title={mfaAction.kind === "approve" ? "Approve this hotel partner"
            : mfaAction.kind === "reject" ? "Reject this submission" : "Request partner changes"}
          description="This decision changes the hotel partner onboarding state and is audited."
          confirmLabel={mfaAction.kind === "approve" ? "Approve"
            : mfaAction.kind === "reject" ? "Reject" : "Request changes"}
          saving={busy}
          error={mfaError}
          onClose={busy ? undefined : () => setMfaAction(null)}
          onConfirm={confirmDecision}
        />
      )}
    </Shell>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function Shell({ onBack, children }) {
  return (
    <div className="pb-8">
      <button
        onClick={onBack}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-heading"
      >
        <ArrowLeft size={15} /> Hotel partners
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
  return <p className={`rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${cls}`}>{children}</p>;
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

/** A dash for absent, and a real link when the value is one — the old KV printed URLs as dead text. */
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
        /* A dead Cloudinary URL rendered as a broken-image glyph before; this says so in words,
           because "the photo is missing" is itself a review finding. */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <button onClick={onClose} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus absolute right-4 top-4 rounded-lg p-2 text-white/70 hover:text-white">
        <X size={20} />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onStep(-1); }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStep(1); }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
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

/**
 * EP/CP/MAP/AP are hotel-trade shorthand (European, Continental, Modified American and American
 * Plan) and a reviewer should not have to remember which of them includes dinner. Wording mirrors
 * MealPlanCode.defaultLabel on the backend so every screen says the same thing about the same code.
 */
const MEAL_LABELS = {
  EP: "Room Only", CP: "Breakfast", MAP: "Breakfast + 1 Meal", AP: "All Meals", CUSTOM: "Custom",
};
const mealLabel = (code) => MEAL_LABELS[code] ?? "";

/** SINGLE_OCCUPANCY → "Single occupancy". The old panel printed the raw enum. */
const human = (v) =>
  !v ? "—" : String(v).toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function occupancy(room) {
  const parts = [];
  if (room.maxAdults != null) parts.push(`${room.maxAdults} adult${room.maxAdults === 1 ? "" : "s"}`);
  if (room.maxChildren) parts.push(`${room.maxChildren} child${room.maxChildren === 1 ? "" : "ren"}`);
  if (room.maxOccupancy != null) parts.push(`max ${room.maxOccupancy}`);
  return parts.join(", ");
}
