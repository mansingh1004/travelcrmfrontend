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
  SectionLabel, Select, Textarea, errMsg, useIdempotencyKey, useToast,
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

export function TransportRequest() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const idempotencyKey = useIdempotencyKey();

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
          </RowGroup>

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

export default TransportRequest;
