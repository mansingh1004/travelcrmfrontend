// src/features/marketplace/pages/MarketplaceBookingRequest.jsx
//
// "Send hotel booking request" — the tenant's submit form.
//
// The verb is REQUEST, never confirm. Nothing on this page can confirm a hotel: the server creates a
// REQUESTED row and a SuperAdmin decides. Every string here says so, because a form that reads like a
// checkout is how an agent ends up telling a customer their room is booked when it is not.
//
// Design: the Notion/Linear north star — labelled rows on hairlines, no boxed panels, flat controls,
// and a keyboard path through the whole form (⌘↵ submits, Esc leaves).

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Check, Link2, Plus } from "lucide-react";
import { customerService } from "@features/customers";
import { bookingService } from "@features/bookings";
import { marketplaceService } from "../api/marketplaceService";
import {
  BackLink, Button, Card, Combobox, Empty, Hint, Input, Loading, Notice, NumberInput, Page,
  PageHeader, Row, RowGroup, SectionLabel, Select, Stepper, Textarea, Chip,
  errMsg, fmtDate, isAlreadyReported, nightsBetween, todayISO, useFieldId, useHotkeys,
  useIdempotencyKey, useToast,
} from "../components/marketplaceUi";

/** Mirrors the server's own rules so the common mistakes are caught before a round trip. */
function validate(form, mode) {
  const e = {};
  if (!form.checkIn) e.checkIn = "Required";
  else if (form.checkIn < todayISO()) e.checkIn = "Check-in cannot be in the past";
  if (!form.checkOut) e.checkOut = "Required";
  else if (form.checkIn && form.checkOut <= form.checkIn) e.checkOut = "Must be after check-in";
  if (!form.leadGuestName?.trim()) e.leadGuestName = "Required";
  if (form.leadGuestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.leadGuestEmail)) {
    e.leadGuestEmail = "Enter a valid email";
  }
  if (!(form.rooms >= 1)) e.rooms = "At least one room";
  if (!(form.adults >= 1)) e.adults = "At least one adult";

  if (mode === "link") {
    if (!form.crmBooking) e.crmBooking = "Pick the booking to attach this to";
  } else {
    if (!form.customer && !form.newCustomer) e.customer = "Pick or add the customer";
    if (form.newCustomer) {
      if (!form.newCustomerName?.trim()) e.newCustomerName = "Required";
      if (!form.newCustomerPhone?.trim()) e.newCustomerPhone = "Required";
    }
    if (!form.destination?.trim()) e.destination = "Required";
    if (!(Number(form.sellingAmount) > 0)) e.sellingAmount = "Must be greater than zero";
  }
  return e;
}

const BLANK = {
  checkIn: "", checkOut: "", roomPublicId: "", mealPlanPublicId: "",
  rooms: 1, adults: 2, children: 0,
  leadGuestName: "", leadGuestPhone: "", leadGuestEmail: "", specialRequests: "",
  crmBooking: null, customer: null,
  newCustomer: false, newCustomerName: "", newCustomerPhone: "", newCustomerEmail: "",
  destination: "", sellingAmount: "",
};

export function MarketplaceBookingRequest() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("create");        // "create" a trip, or "link" an existing one
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(null);      // a 4xx we must render ourselves
  const [done, setDone] = useState(null);            // the submitted MarketplaceBookingTenantDto

  // Stable across failed submits on purpose: retrying must reuse the key so the server returns the
  // original request instead of minting a second CRM booking.
  const { key: idempotencyKey, reset: resetKey } = useIdempotencyKey();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const ids = {
    checkIn: useFieldId("in"), checkOut: useFieldId("out"), room: useFieldId("room"),
    meal: useFieldId("meal"), guest: useFieldId("guest"), phone: useFieldId("ph"),
    email: useFieldId("em"), req: useFieldId("rq"), cust: useFieldId("cu"),
    bkg: useFieldId("bk"), dest: useFieldId("ds"), sell: useFieldId("sl"),
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await marketplaceService.getHotel(publicId);
        if (alive) setHotel(h);
      } catch (e) {
        if (alive) showToast(errMsg(e, "Could not load this hotel."), "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [publicId, showToast]);

  const nights = nightsBetween(form.checkIn, form.checkOut);

  const searchCustomers = useCallback(async (term, signal) => {
    const res = await customerService.list({ q: term, size: 8 }, { signal });
    const rows = res?.data?.data ?? [];
    return rows.map((c) => ({
      // CustomerResponse.id carries the publicId UUID — the internal Long is never exposed.
      value: c.id,
      label: c.name,
      hint: c.phone,
    }));
  }, []);

  const searchBookings = useCallback(async (term, signal) => {
    const res = await bookingService.search(term, { signal });
    const rows = res?.data?.data ?? [];
    return rows.map((b) => ({
      value: b.publicId ?? b.id,
      label: b.bookingCode ?? b.destination ?? "Booking",
      hint: [b.customerName, b.travelDate ? fmtDate(b.travelDate) : null].filter(Boolean).join(" · "),
    }));
  }, []);

  const submit = async () => {
    if (submitting || done) return;
    const e = validate(form, mode);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast("Check the highlighted fields.", "error");
      return;
    }

    const payload = {
      hotelPublicId: publicId,
      roomPublicId: form.roomPublicId || undefined,
      mealPlanPublicId: form.mealPlanPublicId || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      rooms: Number(form.rooms),
      adults: Number(form.adults),
      children: Number(form.children),
      leadGuestName: form.leadGuestName.trim(),
      leadGuestPhone: form.leadGuestPhone?.trim() || undefined,
      leadGuestEmail: form.leadGuestEmail?.trim() || undefined,
      specialRequests: form.specialRequests?.trim() || undefined,
      idempotencyKey,
    };

    if (mode === "link") {
      payload.crmBookingPublicId = form.crmBooking.value;
    } else {
      payload.customer = form.newCustomer
        ? {
            newCustomer: {
              name: form.newCustomerName.trim(),
              phone: form.newCustomerPhone.trim(),
              // Omitted when blank rather than sent as "": the server @Email-validates a present value.
              ...(form.newCustomerEmail?.trim() ? { email: form.newCustomerEmail.trim() } : {}),
            },
          }
        : { customerPublicId: form.customer.value };
      payload.destination = form.destination.trim();
      payload.tenantCustomerSellingAmount = Number(form.sellingAmount);
    }

    setSubmitting(true);
    setBlocked(null);
    try {
      const result = await marketplaceService.submitBooking(payload);
      setDone(result);
      resetKey();
      showToast("Booking request sent.", "success");
    } catch (err) {
      // 400/404/409 are silent by design in the shared interceptor, and the quota 403 — the one an
      // agent can actually act on — deserves to stay on screen rather than vanish with a toast.
      const status = err?.response?.status ?? err?.status;
      if (status === 403 || status === 409 || status === 400 || status === 404) {
        setBlocked(errMsg(err, "Could not submit this request."));
      } else if (!isAlreadyReported(err)) {
        showToast(errMsg(err, "Could not submit this request."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  useHotkeys(
    { "mod+enter": submit, esc: () => navigate(`/marketplace/${publicId}`) },
    { enabled: !loading && !done },
  );

  if (loading) {
    return <Page width="max-w-3xl"><Loading label="Loading hotel…" /></Page>;
  }

  if (!hotel) {
    return (
      <Page width="max-w-3xl">
        <Empty
          icon={Building2}
          title="Hotel not available"
          hint="It may have been withdrawn from Platform Hotel."
          action={<Button onClick={() => navigate("/marketplace")}>Back to Platform Hotel</Button>}
        />
      </Page>
    );
  }

  // ── Submitted ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Page width="max-w-3xl">
        <PageHeader
          title="Request sent"
          subtitle={`${hotel.name} · ${fmtDate(done.checkIn)} → ${fmtDate(done.checkOut)}`}
        />
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                Waiting for platform confirmation
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                Reference <span className="font-medium text-slate-700">{done.bookingCode}</span>.
                The hotel is <span className="font-medium">not confirmed yet</span> — you'll be
                notified when the platform confirms it with the supplier, and the voucher becomes
                available then. Don't promise the room to your customer until it is.
              </p>
              {done.crmBookingCode && (
                <p className="mt-2 text-[13px] text-slate-500">
                  Attached to booking <span className="font-medium text-slate-700">{done.crmBookingCode}</span>.
                </p>
              )}
            </div>
          </div>
        </Card>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" onClick={() => navigate("/marketplace/bookings")}>
            View my requests
          </Button>
          <Button onClick={() => { setDone(null); setForm(BLANK); setErrors({}); }}>
            Request another
          </Button>
          <Button variant="ghost" onClick={() => navigate("/marketplace")}>Back to Platform Hotel</Button>
        </div>
      </Page>
    );
  }

  // ── The form ──────────────────────────────────────────────────────────────
  return (
    <Page width="max-w-3xl">
      <PageHeader
        back={<BackLink onClick={() => navigate(`/marketplace/${publicId}`)}>{hotel.name}</BackLink>}
        title="Request booking"
        subtitle={[hotel.name, hotel.cityName].filter(Boolean).join(" · ")}
      />

      {blocked && <Notice tone="error" className="mb-5">{blocked}</Notice>}

      <SectionLabel>Stay</SectionLabel>
      <RowGroup>
        <Row label="Check-in" required htmlFor={ids.checkIn} error={errors.checkIn}>
          <Input
            id={ids.checkIn}
            type="date"
            min={todayISO()}
            value={form.checkIn}
            invalid={!!errors.checkIn}
            onChange={(e) => set({ checkIn: e.target.value })}
          />
        </Row>
        <Row
          label="Check-out"
          required
          htmlFor={ids.checkOut}
          error={errors.checkOut}
          hint={nights > 0 ? `${nights} night${nights === 1 ? "" : "s"} — check-out day is not charged` : undefined}
        >
          <Input
            id={ids.checkOut}
            type="date"
            min={form.checkIn || todayISO()}
            value={form.checkOut}
            invalid={!!errors.checkOut}
            onChange={(e) => set({ checkOut: e.target.value })}
          />
        </Row>
        <Row label="Room type" htmlFor={ids.room}>
          <Select id={ids.room} value={form.roomPublicId} onChange={(e) => set({ roomPublicId: e.target.value })}>
            <option value="">Any / platform to advise</option>
            {(hotel.rooms ?? []).map((r) => (
              <option key={r.publicId} value={r.publicId}>
                {r.name}{r.maxOccupancy ? ` — sleeps ${r.maxOccupancy}` : ""}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Meal plan" htmlFor={ids.meal}>
          <Select id={ids.meal} value={form.mealPlanPublicId} onChange={(e) => set({ mealPlanPublicId: e.target.value })}>
            <option value="">Any / platform to advise</option>
            {(hotel.mealPlans ?? []).map((m) => (
              <option key={m.publicId} value={m.publicId}>{m.code} — {m.name}</option>
            ))}
          </Select>
        </Row>
        <Row label="Occupancy" error={errors.rooms || errors.adults}>
          <div className="flex flex-wrap items-center gap-6">
            <Field label="Rooms"><Stepper label="rooms" min={1} value={form.rooms} onChange={(v) => set({ rooms: v })} /></Field>
            <Field label="Adults"><Stepper label="adults" min={1} value={form.adults} onChange={(v) => set({ adults: v })} /></Field>
            <Field label="Children"><Stepper label="children" min={0} value={form.children} onChange={(v) => set({ children: v })} /></Field>
          </div>
        </Row>
      </RowGroup>

      <SectionLabel className="mt-8">Lead guest</SectionLabel>
      <RowGroup>
        <Row label="Name" required htmlFor={ids.guest} error={errors.leadGuestName}>
          <Input
            id={ids.guest}
            maxLength={150}
            placeholder="Name as it should appear on the voucher"
            value={form.leadGuestName}
            invalid={!!errors.leadGuestName}
            onChange={(e) => set({ leadGuestName: e.target.value })}
          />
        </Row>
        <Row label="Phone" htmlFor={ids.phone}>
          <Input id={ids.phone} maxLength={30} placeholder="+91…" value={form.leadGuestPhone}
                 onChange={(e) => set({ leadGuestPhone: e.target.value })} />
        </Row>
        <Row label="Email" htmlFor={ids.email} error={errors.leadGuestEmail}>
          <Input id={ids.email} type="email" maxLength={150} placeholder="guest@example.com"
                 value={form.leadGuestEmail} invalid={!!errors.leadGuestEmail}
                 onChange={(e) => set({ leadGuestEmail: e.target.value })} />
        </Row>
        <Row label="Special requests" htmlFor={ids.req} align="top">
          <Textarea id={ids.req} rows={2} placeholder="Late check-in, adjoining rooms, dietary needs…"
                    value={form.specialRequests} onChange={(e) => set({ specialRequests: e.target.value })} />
        </Row>
      </RowGroup>

      <SectionLabel className="mt-8">Trip</SectionLabel>
      <div className="mb-3 inline-flex rounded-md border border-slate-200 p-0.5">
        <ModeTab active={mode === "create"} onClick={() => setMode("create")} icon={Plus}>New trip</ModeTab>
        <ModeTab active={mode === "link"} onClick={() => setMode("link")} icon={Link2}>Existing booking</ModeTab>
      </div>
      <p className="mb-2 text-[13px] leading-relaxed text-slate-500">
        {mode === "create"
          ? "A booking will be created in your CRM in the same step, and the amount you'll owe the platform is recorded against it as a cost."
          : "The hotel is added as a service line on a booking you already have. This does not use a new booking from your plan."}
      </p>

      <RowGroup>
        {mode === "link" ? (
          <Row label="Booking" required htmlFor={ids.bkg} error={errors.crmBooking}
               hint="Search by booking code, customer or destination">
            <Combobox
              id={ids.bkg}
              value={form.crmBooking}
              onChange={(v) => set({ crmBooking: v })}
              search={searchBookings}
              placeholder="Search your bookings…"
              emptyText="No matching booking"
              invalid={!!errors.crmBooking}
            />
          </Row>
        ) : (
          <>
            <Row label="Customer" required htmlFor={ids.cust} error={errors.customer}
                 hint={form.newCustomer ? undefined : "Search by name or phone"}>
              {form.newCustomer ? (
                <div className="flex items-center gap-2">
                  <Chip>New customer</Chip>
                  <button type="button"
                          onClick={() => set({ newCustomer: false, newCustomerName: "", newCustomerPhone: "", newCustomerEmail: "" })}
                          className="text-[13px] text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
                    search existing instead
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Combobox
                      id={ids.cust}
                      value={form.customer}
                      onChange={(v) => set({ customer: v })}
                      search={searchCustomers}
                      placeholder="Search customers…"
                      emptyText="No match — add them as new"
                      invalid={!!errors.customer}
                    />
                  </div>
                  {!form.customer && (
                    <Button size="sm" onClick={() => set({ newCustomer: true, customer: null })}>
                      <Plus /> New
                    </Button>
                  )}
                </div>
              )}
            </Row>

            {form.newCustomer && (
              <>
                <Row label="Customer name" required error={errors.newCustomerName}>
                  <Input value={form.newCustomerName} invalid={!!errors.newCustomerName}
                         onChange={(e) => set({ newCustomerName: e.target.value })} />
                </Row>
                <Row label="Customer phone" required error={errors.newCustomerPhone}>
                  <Input value={form.newCustomerPhone} invalid={!!errors.newCustomerPhone}
                         placeholder="+91…" onChange={(e) => set({ newCustomerPhone: e.target.value })} />
                </Row>
                <Row label="Customer email">
                  <Input type="email" value={form.newCustomerEmail}
                         onChange={(e) => set({ newCustomerEmail: e.target.value })} />
                </Row>
              </>
            )}

            <Row label="Destination" required htmlFor={ids.dest} error={errors.destination}>
              <Input id={ids.dest} maxLength={200} placeholder="Goa, Bali…" value={form.destination}
                     invalid={!!errors.destination} onChange={(e) => set({ destination: e.target.value })} />
            </Row>
            <Row label="Your price to customer" required htmlFor={ids.sell} error={errors.sellingAmount}
                 hint="Your selling price for this trip. The platform records it and never sets it.">
              <NumberInput id={ids.sell} min={0} step="0.01" placeholder="0.00" value={form.sellingAmount}
                           invalid={!!errors.sellingAmount} onValueChange={(v) => set({ sellingAmount: v })} />
            </Row>
          </>
        )}
      </RowGroup>

      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur-sm">
        <Hint keys={["mod", "enter"]} label="Send with" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate(`/marketplace/${publicId}`)}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            {submitting ? "Sending…" : "Send booking request"}
          </Button>
        </div>
      </div>
    </Page>
  );
}

function ModeTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10",
        active ? "bg-slate-900 font-medium text-white" : "text-slate-500 hover:text-slate-900",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

/** Small stacked label used inside the occupancy row, where three steppers share one Row. */
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      {children}
    </div>
  );
}

export default MarketplaceBookingRequest;
