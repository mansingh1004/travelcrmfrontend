// src/features/marketplace/pages/TransportRequest.jsx
//
// Send a transport enquiry to the platform team. A REQUEST, never a booking: the tenant cannot
// self-confirm, and nothing here holds a vehicle.
//
// Every order must hang off a CRM booking — that is where the money and the customer live — so the
// form makes the agent choose: attach to a booking they already have, or give a customer and let
// the server create one. The backend refuses a submission with neither, in those words.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Car, Loader2, MapPin, Search, Send } from "lucide-react";
import { bookingService } from "@features/bookings";
import { hasPermission, P } from "@shared/lib/access";
import { transportMarketplaceService } from "../api/transportMarketplaceService";
import { humanise } from "./TransportSearch";
import {
  BackLink, Button, Card, Divider, Input, Notice, NumberInput, Page, PageHeader, Row, RowGroup,
  SectionLabel, Select, Textarea, errMsg, fmtMoney, useIdempotencyKey, useToast,
} from "../components/marketplaceUi";

/**
 * The service shapes the platform contracts for. Mirrors `TransportServiceType` exactly; a value
 * this list lacks would post fine and then read back as a blank on the queue, so keep them in step.
 */
const SERVICE_TYPES = [
  ["AIRPORT_TRANSFER", "Airport transfer"],
  ["RAILWAY_TRANSFER", "Railway transfer"],
  ["POINT_TO_POINT", "Point to point"],
  ["LOCAL_PACKAGE", "Local package"],
  ["OUTSTATION_ONE_WAY", "Outstation — one way"],
  ["OUTSTATION_ROUND_TRIP", "Outstation — round trip"],
  ["MULTI_DAY_TOUR", "Multi-day tour"],
  ["HOURLY_RENTAL", "Hourly rental"],
  ["CUSTOM", "Something else"],
];

/**
 * The zone the times were agreed in.
 *
 * The server stores the pickup as an instant and snapshots this beside it, because "06:00" at an
 * airport is meaningless without one and the agent, the approver and the driver may not share a
 * zone. The browser's own zone is the right default: it is the zone the agent is typing in.
 */
const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * `<input type="datetime-local">` gives "2026-08-20T06:00" with no zone. `new Date(...)` reads it in
 * the browser's zone — which IS the zone we are declaring — and `toISOString()` makes it the instant
 * the server wants. Returns null for an empty box so an optional time stays absent rather than epoch.
 */
function toInstant(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * The journey expressed as the three quantities the pricing engine understands: days, hours, km.
 *
 * The rate model decides which of them matters — a per-day coach ignores the kilometres, a per-km
 * sedan ignores the days — and the form does not know the model, so it sends all three honestly
 * derived and lets the server read the ones it needs. Guessing which to send would mean guessing
 * the model, which is exactly the thing the engine exists to resolve.
 *
 * Days round UP, and the floor is 1: half a day of a vehicle is a day of it, and a journey with no
 * stated release is still one day's hire. Hours are 0 rather than 1 when there is no release time —
 * an absent value, not an hour of work — so an hourly rate cannot silently price a blank form.
 */
function journeyShape(pickupAt, expectedReleaseAt) {
  const start = pickupAt ? new Date(pickupAt) : null;
  const end = expectedReleaseAt ? new Date(expectedReleaseAt) : null;
  const usable =
    start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  if (!usable) return { days: 1, hours: 0 };
  const spanHours = (end - start) / 3_600_000;
  return { days: Math.max(1, Math.ceil(spanHours / 24)), hours: Math.max(1, Math.ceil(spanHours)) };
}

/** `AIRPORT_TRANSFER` → `Airport transfer`, using the labels already on this screen. */
const serviceLabel = (value) =>
  SERVICE_TYPES.find(([v]) => v === value)?.[1] ?? humanise(value);

export function TransportRequest() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  // `useIdempotencyKey` returns `{ key, reset }` — the KEY is what goes on the wire. Destructuring
  // it matters: the whole hook result posted as `idempotencyKey` is an object, which is not the
  // string the server dedupes on, so the double-submit guard was silently not guarding anything.
  const { key: idempotencyKey } = useIdempotencyKey();

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // "new" = give a customer and let the server create the booking. "existing" = attach to one the
  // agency already has. The backend accepts exactly these two, and nothing else.
  const [linkMode, setLinkMode] = useState("new");

  const [form, setForm] = useState({
    serviceType: "POINT_TO_POINT",
    pickupAt: "",
    expectedReleaseAt: "",
    pickupLocation: "",
    dropLocation: "",
    passengers: 1,
    luggagePieces: "",
    vehicleCount: 1,
    // Quote input only — it is NOT part of the order payload. A per-kilometre vehicle cannot be
    // priced without it, and the operator confirms the real running on the duty slip.
    km: "",
    leadPassengerName: "",
    leadPassengerPhone: "",
    leadPassengerEmail: "",
    specialRequests: "",
    destination: "",
    customerName: "",
    customerPhone: "",
    tenantCustomerSellingAmount: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Booking picker, only used in "existing" mode.
  const [bookingTerm, setBookingTerm] = useState("");
  const [bookingHits, setBookingHits] = useState([]);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [linkedBooking, setLinkedBooking] = useState(null);
  const searchTimer = useRef(null);

  const canBook = hasPermission(P.TRANSPORT_MARKETPLACE_BOOK);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await transportMarketplaceService.getVehicle(publicId);
        if (alive) setVehicle(v);
      } catch (e) {
        if (alive) setError(errMsg(e, "That vehicle is no longer available."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicId]);

  /**
   * Live indicative price, re-asked as the journey changes.
   *
   * <p>This is the number the agent repeats to their own customer while still on the call. Without
   * it the payable first appears when a SuperAdmin approves — hours later — so the agent either
   * quotes from a guess or asks the customer to wait, and both lose the booking.</p>
   *
   * <p><b>The endpoint always answers 200.</b> A response with no `tenantPayable` is not a failure:
   * it means the engine has no rate card or rule that describes this journey, which in an
   * ON_REQUEST marketplace is an ordinary vehicle the platform will price by hand. So nothing here
   * toasts and nothing here blocks the submit — the request is sendable at every quote state.</p>
   *
   * <p>A THROW, by contrast, means the PROBE failed — offline, or the add-on lapsed mid-session —
   * and that is the one case where the panel shows nothing at all. Rendering "quoted on request"
   * off a failed request would be asserting an answer the server never gave. This is where it
   * departs from the hotel form, whose quote endpoint reports unpriceability as `available:false`
   * inside a successful body rather than by status.</p>
   *
   * <p>400ms debounce plus the `alive` latch: the steppers move faster than a round trip and
   * responses are not guaranteed to arrive in order, so a stale answer must not overwrite a fresher
   * one. The vehicle gate stops a probe firing at a `publicId` whose detail call 404'd.</p>
   */
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const shape = journeyShape(form.pickupAt, form.expectedReleaseAt);
  const quoteVehicleCount = Number(form.vehicleCount) || 1;
  const quoteKm = form.km === "" ? 0 : Number(form.km) || 0;

  useEffect(() => {
    if (!vehicle) return undefined;
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await transportMarketplaceService.quoteVehicle({
          platformVehiclePublicId: publicId,
          serviceType: form.serviceType,
          // The LOCAL date the journey runs on, straight off the datetime-local string so no
          // timezone conversion can move it a day. Rules carry validFrom/validTo, so the same
          // journey next quarter can price differently.
          serviceDate: form.pickupAt ? form.pickupAt.slice(0, 10) : undefined,
          vehicleCount: quoteVehicleCount,
          days: shape.days,
          hours: shape.hours,
          km: quoteKm,
        });
        if (alive) setQuote(q ?? null);
      } catch {
        // Silent by design — see the note above.
        if (alive) setQuote(null);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [vehicle, publicId, form.serviceType, form.pickupAt, quoteVehicleCount, quoteKm,
      shape.days, shape.hours]);

  /* Debounced, because it is a server query on every keystroke otherwise. 300ms is long enough to
     finish typing a booking code and short enough that the list feels live. */
  const searchBookings = useCallback((term) => {
    clearTimeout(searchTimer.current);
    if (!term || term.trim().length < 2) {
      setBookingHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setBookingBusy(true);
      try {
        const res = await bookingService.search(term.trim());
        const rows = res?.data?.data ?? res?.data ?? res ?? [];
        setBookingHits(Array.isArray(rows) ? rows.slice(0, 8) : []);
      } catch {
        // A failed lookup must not block the form — the agent can switch to the "new booking" mode.
        setBookingHits([]);
      } finally {
        setBookingBusy(false);
      }
    }, 300);
  }, []);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const problems = useMemo(() => {
    const out = [];
    if (!form.pickupAt) out.push("A pickup time is required.");
    if (!form.pickupLocation.trim()) out.push("A pickup location is required.");
    if (!form.leadPassengerName.trim()) out.push("A lead passenger name is required.");
    if (linkMode === "existing" && !linkedBooking) out.push("Pick the booking this is for.");
    if (linkMode === "new" && !form.customerName.trim()) out.push("A customer name is required.");
    if (linkMode === "new" && !form.customerPhone.trim()) out.push("A customer phone number is required.");
    return out;
  }, [form, linkMode, linkedBooking]);

  async function submit(e) {
    e.preventDefault();
    if (problems.length) return;

    setSubmitting(true);
    try {
      const payload = {
        platformProductPublicId: publicId,
        serviceType: form.serviceType,
        pickupAt: toInstant(form.pickupAt),
        expectedReleaseAt: toInstant(form.expectedReleaseAt),
        serviceTimezone: BROWSER_ZONE,
        pickupLocation: form.pickupLocation.trim(),
        dropLocation: form.dropLocation.trim() || null,
        passengers: Number(form.passengers) || 1,
        luggagePieces: form.luggagePieces === "" ? null : Number(form.luggagePieces),
        vehicleCount: Number(form.vehicleCount) || 1,
        leadPassengerName: form.leadPassengerName.trim(),
        leadPassengerPhone: form.leadPassengerPhone.trim() || null,
        leadPassengerEmail: form.leadPassengerEmail.trim() || null,
        specialRequests: form.specialRequests.trim() || null,
        tenantCustomerSellingAmount:
          form.tenantCustomerSellingAmount === "" ? null : Number(form.tenantCustomerSellingAmount),
        // One key per FORM MOUNT, not per click: the server dedupes on it, so a double-click or a
        // retry after a dropped response replays the same order instead of booking a second car.
        idempotencyKey,
      };

      if (linkMode === "existing") {
        payload.crmBookingPublicId = linkedBooking.publicId;
      } else {
        payload.customer = {
          newCustomer: { name: form.customerName.trim(), phone: form.customerPhone.trim() },
        };
        payload.destination = form.destination.trim() || null;
      }

      const order = await transportMarketplaceService.submitOrder(payload);
      showToast(`Request ${order?.orderCode ?? ""} sent to the platform team.`, "success");
      navigate("/marketplace/transport/orders");
    } catch (err) {
      showToast(errMsg(err, "Could not send that request."), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading the vehicle…
        </div>
      </Page>
    );
  }

  if (error || !vehicle) {
    return (
      <Page>
        <PageHeader title="Request transport" back={<BackLink onClick={() => navigate(-1)} />} />
        <Notice tone="error">{error ?? "That vehicle is no longer available."}</Notice>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Request transport"
        subtitle="The platform team confirms availability and price. Nothing is held until they do."
        back={
          <BackLink onClick={() => navigate("/marketplace/transport")}>
            <ArrowLeft className="size-3.5" /> Back to transport
          </BackLink>
        }
      />

      <Card className="mb-5 flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded bg-slate-100 text-slate-500">
          <Car className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-slate-900">{vehicle.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-slate-500">
            <span>{humanise(vehicle.vehicleType)}</span>
            {vehicle.cityName && (
              <>
                <span aria-hidden>·</span>
                <MapPin className="size-3.5" />
                {vehicle.cityName}
              </>
            )}
          </p>
        </div>
      </Card>

      <form onSubmit={submit} noValidate>
        <Card className="p-5">
          <SectionLabel>The journey</SectionLabel>
          <RowGroup>
            <Row label="Service" required>
              <Select value={form.serviceType} onChange={(e) => set("serviceType", e.target.value)}>
                {SERVICE_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Row>

            <Row label="Pickup" required hint={`Times are read in ${BROWSER_ZONE} and sent as an exact instant.`}>
              <Input
                type="datetime-local"
                value={form.pickupAt}
                onChange={(e) => set("pickupAt", e.target.value)}
              />
            </Row>

            <Row label="Expected release" hint="Leave blank for a one-way transfer.">
              <Input
                type="datetime-local"
                value={form.expectedReleaseAt}
                onChange={(e) => set("expectedReleaseAt", e.target.value)}
              />
            </Row>

            <Row label="From" required>
              <Input
                value={form.pickupLocation}
                onChange={(e) => set("pickupLocation", e.target.value)}
                placeholder="Airport terminal, hotel name, address…"
                maxLength={300}
              />
            </Row>

            <Row label="To">
              <Input
                value={form.dropLocation}
                onChange={(e) => set("dropLocation", e.target.value)}
                placeholder="Where the guests are dropped"
                maxLength={300}
              />
            </Row>

            <Row label="Passengers" required>
              <div className="flex gap-2">
                <NumberInput
                  min={1}
                  value={form.passengers}
                  onValueChange={(v) => set("passengers", v)}
                  className="w-24"
                  aria-label="Passengers"
                />
                <NumberInput
                  min={0}
                  value={form.luggagePieces}
                  onValueChange={(v) => set("luggagePieces", v)}
                  className="w-24"
                  placeholder="Bags"
                  aria-label="Luggage pieces"
                />
                <NumberInput
                  min={1}
                  value={form.vehicleCount}
                  onValueChange={(v) => set("vehicleCount", v)}
                  className="w-24"
                  aria-label="Vehicles"
                />
              </div>
            </Row>

            {/* Not sent with the request — the operator confirms the real running — but a
                per-kilometre vehicle cannot be priced without it, so the estimate below stays
                blank until it is filled. Said plainly in the hint rather than left to be
                discovered by a figure that never appears. */}
            <Row
              label="Approximate distance"
              hint="Total kilometres. Used only to estimate the price below — it is not sent with the request."
            >
              <NumberInput
                min={0}
                value={form.km}
                onValueChange={(v) => set("km", v)}
                className="w-28"
                placeholder="km"
                aria-label="Approximate distance in kilometres"
              />
            </Row>
          </RowGroup>

          {/*
            Directly under the inputs that determine it, NOT in a sticky rail.

            The hotel form moved its quote into an aside because its determinants — dates, rooms,
            occupancy — are spread down a long form and the figure kept scrolling away from them.
            Every input this figure depends on is in the block immediately above, so here the two
            are already adjacent and a rail would only push the number further from its causes.
          */}
          <QuotePanel quote={quote} quoting={quoting} />

          <Divider className="my-5" />

          <SectionLabel>Who is travelling</SectionLabel>
          <RowGroup>
            <Row label="Lead passenger" required hint="Printed on the duty slip — the driver calls this person on arrival.">
              <Input
                value={form.leadPassengerName}
                onChange={(e) => set("leadPassengerName", e.target.value)}
                maxLength={150}
              />
            </Row>
            <Row label="Phone">
              <Input
                value={form.leadPassengerPhone}
                onChange={(e) => set("leadPassengerPhone", e.target.value)}
                maxLength={30}
              />
            </Row>
            <Row label="Email">
              <Input
                type="email"
                value={form.leadPassengerEmail}
                onChange={(e) => set("leadPassengerEmail", e.target.value)}
                maxLength={150}
              />
            </Row>
            <Row label="Special requests" align="start">
              <Textarea
                value={form.specialRequests}
                onChange={(e) => set("specialRequests", e.target.value)}
                placeholder="Child seat, extra stop, wheelchair access…"
                rows={2}
              />
            </Row>
          </RowGroup>

          <Divider className="my-5" />

          <SectionLabel>The booking this belongs to</SectionLabel>
          {/* Not optional plumbing — it is where the customer and the money live. The server refuses
              a submission that names neither a booking nor a customer. */}
          <div className="mb-3 flex gap-2">
            <Button
              variant={linkMode === "new" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setLinkMode("new")}
            >
              Create a booking
            </Button>
            <Button
              variant={linkMode === "existing" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setLinkMode("existing")}
            >
              Use an existing one
            </Button>
          </div>

          {linkMode === "new" ? (
            <RowGroup>
              <Row label="Customer" required>
                <Input
                  value={form.customerName}
                  onChange={(e) => set("customerName", e.target.value)}
                  placeholder="Full name"
                />
              </Row>
              <Row label="Customer phone" required>
                <Input
                  value={form.customerPhone}
                  onChange={(e) => set("customerPhone", e.target.value)}
                  placeholder="Used to match an existing customer, or create one"
                />
              </Row>
              <Row label="Destination" hint='Defaults to "Transport" if left blank.'>
                <Input value={form.destination} onChange={(e) => set("destination", e.target.value)} />
              </Row>
              <Row label="Selling price" hint="What you are charging your customer. Optional, and never shown to the platform team.">
                <NumberInput
                  min={0}
                  value={form.tenantCustomerSellingAmount}
                  onValueChange={(v) => set("tenantCustomerSellingAmount", v)}
                  className="w-40"
                />
              </Row>
            </RowGroup>
          ) : (
            <div>
              {linkedBooking ? (
                <div className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-700">
                    <span className="font-medium">{linkedBooking.bookingCode ?? linkedBooking.code}</span>
                    {linkedBooking.customerName ? ` · ${linkedBooking.customerName}` : ""}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setLinkedBooking(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={bookingTerm}
                      onChange={(e) => {
                        setBookingTerm(e.target.value);
                        searchBookings(e.target.value);
                      }}
                      placeholder="Search by booking code or customer"
                      className="pl-9"
                    />
                  </div>
                  {bookingBusy && <p className="mt-2 text-[12px] text-slate-500">Searching…</p>}
                  {bookingHits.length > 0 && (
                    <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
                      {bookingHits.map((b) => (
                        <li key={b.publicId}>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkedBooking(b);
                              setBookingHits([]);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-800">{b.bookingCode ?? b.code}</span>
                            <span className="text-slate-500">{b.customerName ?? ""}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {problems.length > 0 && (
            <Notice tone="warn" className="mt-5">
              <ul className="list-disc pl-4">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </Notice>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate("/marketplace/transport")}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!canBook || problems.length > 0}
              title={canBook ? undefined : "You do not have permission to request transport"}
            >
              <Send className="size-3.5" /> Send request
            </Button>
          </div>
        </Card>
      </form>
    </Page>
  );
}

/**
 * What this journey would cost the tenant, live, while the journey is still being described.
 *
 * <h3>One money figure, and that is not a simplification</h3>
 * `tenantPayable` is the ONLY amount on the response, deliberately: the operator's net and the
 * platform's earning are absent by design and cannot be recovered from it. So there is no breakdown
 * to expand, no "you save ₹X", and no per-day derivation — dividing the payable by the days would
 * publish a unit rate the platform never quoted. The line beside the amount restates the journey
 * that was priced, using the server's own echoed values so it can never describe a different one
 * from the figure it sits next to.
 *
 * <h3>Three states, none of which blocks the request</h3>
 * Checking, priced, and quoted-on-request. The last is an ordinary vehicle in an ON_REQUEST
 * marketplace — the engine has no rule or rate card that describes this journey and the platform
 * will price it by hand — so it renders as information, not as a fault, and the submit button is
 * untouched in all three.
 *
 * <h3>Why the caveat cannot be dropped</h3>
 * Nothing is held and no price is binding until a SuperAdmin approves; if they come back with a
 * different amount, the tenant has to accept it before the journey is confirmed. `note` arrives
 * from the server with that already written so this screen, the card and the approval cannot drift
 * into three different promises — its own wording is only the fallback.
 */
function QuotePanel({ quote, quoting }) {
  if (quoting && !quote) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking price…
      </div>
    );
  }
  // Nothing to say: either the probe has not run yet, or it failed outright and the server never
  // gave an answer to report.
  if (!quote) return null;

  // Absent, not zero. `tenantPayable` is omitted entirely when the journey cannot be priced, and a
  // ₹0 here is a number an agent could quote and then be held to.
  if (quote.tenantPayable === null || quote.tenantPayable === undefined) {
    return (
      <Notice tone="info" className="mt-4">
        {quote.note
          || "This journey is quoted on request. Send the request and the platform team will come "
             + "back with a price."}
      </Notice>
    );
  }

  const shapeParts = [
    `${quote.vehicleCount ?? 1} vehicle${(quote.vehicleCount ?? 1) === 1 ? "" : "s"}`,
    quote.days ? `${quote.days} day${quote.days === 1 ? "" : "s"}` : null,
    quote.hours ? `${quote.hours} hour${quote.hours === 1 ? "" : "s"}` : null,
    quote.km ? `${Number(quote.km).toLocaleString("en-IN")} km` : null,
  ].filter(Boolean);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-wide text-slate-500">Estimated payable</p>
          <p className="text-sm text-slate-500">
            {serviceLabel(quote.serviceType)}
            {shapeParts.length > 0 && ` · ${shapeParts.join(" · ")}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-lg font-semibold text-slate-900">
            {fmtMoney(quote.tenantPayable, quote.currency || "INR")}
          </span>
          {quoting && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> updating
            </span>
          )}
        </div>
      </div>
      <p className="border-t border-slate-100 px-4 py-2.5 text-[12px] leading-relaxed text-slate-500">
        {quote.note
          || "Indicative only. The platform team confirms availability and the final price; nothing "
             + "is held until they do."}
      </p>
    </div>
  );
}

export default TransportRequest;
