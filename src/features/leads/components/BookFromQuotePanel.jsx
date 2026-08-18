import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Loader2, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { bookingService } from "@features/bookings";
import { vendorService } from "@features/vendors";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { quotationService } from "@features/quotation";

/**
 * Turn the quotation just written into a booking, without leaving the page.
 *
 * <p>The counter case this exists for: a walk-in asks for 5N/6D, the agent quotes them on this
 * screen, and the customer says yes while still standing there. That "yes" used to mean leaving for
 * /allleads, finding the lead in a list capped at one server page, and opening the booking form —
 * three screens and a hunt, at the one moment the deal is warm.
 *
 * <h3>Vendor cost is optional, and gated on choosing a vendor</h3>
 *
 * Same rule the full booking form uses: the amount field stays disabled until a supplier is picked,
 * so money owed with no payee cannot be entered. And it is genuinely optional — conversion is the
 * moment a customer says yes, before a single hotel has been called, so a mandatory supplier figure
 * here is a number the agent invents to get past a validator, and it lands straight in net profit.
 * Supplier spend is itemised through the expense ledger as the trip is arranged; the formula
 * (customerAmount − vendorCost − ledger) is correct either way.
 *
 * <p>Nothing is prefilled from the quote because there is nothing to prefill FROM: the quick quote
 * holds selling prices only — its hotel field is literally "Your selling price / room / night" — and
 * carries no supplier cost anywhere.
 *
 * <h3>The money on screen comes from the server</h3>
 *
 * GST, TCS, total payable and profit are read from POST /bookings/preview, never computed here. The
 * tax mode is tri-state (null = follow the tenant's accounting settings), so a local calculation
 * would be a second opinion that disagrees with the booking the moment any of it is not the default.
 */
export default function BookFromQuotePanel({ lead, quotationId, quotedAmount, onBooked }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [more, setMore] = useState(false);          // commission + tax, folded away
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  const [form, setForm] = useState({
    vendorPublicId: "",
    vendorCost: "",
    paidAmount: "",
    // Tri-state. null is NOT false — it means "follow the tenant's accounting settings", which is
    // the default and the common case.
    applyGst: null,
    gstInclusive: null,
    applyTcs: null,
    commissionPayeeName: "",
    commissionType: "",
    commissionValue: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* One key per panel mount, not per click. The server dedupes on it, so a double-click or a retry
     after a dropped response replays the SAME booking instead of creating a second one for a lead
     that is allowed exactly one. Regenerating it per attempt would defeat the mechanism. */
  const idempotencyKey = useRef(
    globalThis.crypto?.randomUUID?.() ?? `book-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  useEffect(() => {
    let alive = true;
    vendorService
      .getAll()
      .then((res) => {
        if (!alive) return;
        const body = res?.data?.data ?? res?.data ?? [];
        setVendors(Array.isArray(body) ? body : []);
      })
      // Silent. An empty list leaves the cost field disabled, which is the correct degraded state:
      // no vendor could be chosen, so no vendor cost should be typed against one.
      .catch(() => { if (alive) setVendors([]); })
      .finally(() => { if (alive) setLoadingVendors(false); });
    return () => { alive = false; };
  }, []);

  /* ── "As per quotation" ───────────────────────────────────────────────────────────────────
     Ticked, the booking is for exactly the quoted figure and the amount is not typeable — which is
     what this panel always did implicitly, by never offering the field at all. Unticked, the agent
     enters what the customer actually agreed to (a negotiated price, a changed party size). The
     quotation is NOT rewritten: it is the offer the customer received and stays that way, and the
     difference is a fact about this booking rather than an error in the older document. */
  const [asPerQuotation, setAsPerQuotation] = useState(true);
  const [agreedAmount, setAgreedAmount] = useState("");

  /* Which quotation. A lead is often quoted more than once — a revised itinerary, a second version
     after the customer pushed back — and only the agent knows which one was accepted. Defaults to
     the quotation this panel was opened from (the one on screen), so the common single-quote case
     needs no interaction. */
  const [quotations, setQuotations] = useState([]);
  const [chosenQuotationId, setChosenQuotationId] = useState(quotationId || "");
  useEffect(() => { setChosenQuotationId(quotationId || ""); }, [quotationId]);

  useEffect(() => {
    const leadKey = lead?.publicId || lead?.id;
    if (!leadKey) return undefined;
    let alive = true;
    quotationService
      .getQuotationsByLead(leadKey)
      .then((res) => {
        if (!alive) return;
        const body = res?.data?.data ?? res?.data ?? [];
        setQuotations(Array.isArray(body) ? body : []);
      })
      // Silent. An empty list collapses the picker to the single quotation this panel already
      // holds, which is the correct degraded state — never a reason to block a booking.
      .catch(() => { if (alive) setQuotations([]); });
    return () => { alive = false; };
  }, [lead?.publicId, lead?.id]);

  const chosenQuotation = useMemo(
    () => quotations.find((q) => (q.publicId || q.id) === chosenQuotationId) || null,
    [quotations, chosenQuotationId],
  );

  /* The quoted figure to compare against: the chosen quotation's total when the agent picked a
     different one, else the amount this panel was opened with. */
  const quotedFigure = Number(chosenQuotation?.grandTotal ?? quotedAmount) || 0;

  const amount = asPerQuotation ? quotedFigure : (Number(agreedAmount) || 0);
  /* Reported, not reconciled. The quotation is never rewritten, so this only decides whether the
     screen tells the agent the two figures differ. Tolerance is a rupee, not a paisa: the quotation
     total is derived through three HALF_UP roundings, so a paisa-level test flags bookings nobody
     actually repriced. */
  const priceDivergence = !asPerQuotation && chosenQuotationId && amount > 0
    && Math.abs(amount - quotedFigure) >= 1;
  const cost = Number(form.vendorCost) || 0;
  const paid = Number(form.paidAmount) || 0;

  // The server requires a travel date and rejects the whole booking without one. Caught here so the
  // agent is told which field to fix, not after they have filled the panel in and pressed send.
  const travelDate = useMemo(() => toDateOnly(lead?.travelDate), [lead?.travelDate]);

  /* Debounced: this fires per keystroke in the money fields. 350ms turns typing "45000" into one
     request rather than five, and the figure has settled by the time the agent looks up. */
  useEffect(() => {
    if (booking || !(amount > 0)) { setPreview(null); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      bookingService
        .previewFinancials({
          customerAmount: amount,
          vendorCost: cost,
          paidAmount: paid,
          applyGst: form.applyGst,
          gstInclusive: form.gstInclusive,
          applyTcs: form.applyTcs,
        })
        .then((res) => { if (alive) setPreview(res?.data?.data ?? res?.data ?? null); })
        // Silent by design — a toast per keystroke while someone types a cost is unusable, and the
        // real numbers are stamped by the server on save regardless.
        .catch(() => { if (alive) setPreview(null); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [amount, cost, paid, booking, form.applyGst, form.gstInclusive, form.applyTcs]);

  /* customerName, customerPhone and destination are all @NotBlank on the server. A lead with no
     phone, or an itinerary whose first leg has no destination, would otherwise submit "" and come
     back a 400 — naming a field this panel does not show, from a form the agent cannot fix it in. */
  const customerName = (lead?.customerName || "").trim();
  const customerPhone = (lead?.phone || "").trim();
  const destination = (lead?.itinerary?.[0]?.destination || lead?.destination || "").trim();

  const problem =
    /* A ₹0 booking is allowed — the price often follows the confirmation, and the server accepts a
       null/zero amount as "not priced yet". Only a NEGATIVE figure is refused. The panel still
       shows the total, so nobody books at zero without seeing it. */
    amount < 0 ? "Amount cannot be negative."
      : !customerName ? "This enquiry has no customer name — add one before booking it."
      : !customerPhone ? "This enquiry has no phone number — add one before booking it."
      : !destination ? "This enquiry has no destination — add one before booking it."
      : !travelDate ? "Add a travel date to this enquiry before booking it."
        : form.vendorPublicId && !(cost > 0) ? "Enter what this vendor is owed, or clear the vendor."
          : cost > 0 && !form.vendorPublicId ? "Choose the vendor this cost is owed to."
            : form.commissionType && !(Number(form.commissionValue) > 0)
              ? "Enter the commission amount, or clear the commission type."
              : paid < 0 ? "Advance cannot be negative."
                : paid > (preview?.totalPayable ?? Infinity) ? "Advance is more than the total payable."
                  : null;

  const submit = useCallback(async () => {
    if (problem || submitting) return;
    setSubmitting(true);
    try {
      const res = await bookingService.convertFromLead(
        lead.publicId || lead.id,
        {
          quotationPublicId: chosenQuotationId || null,
          customerName,
          customerPhone,
          customerEmail: lead.email || "",
          destination,
          travelDate,
          customerAmount: amount,
          // Only alongside a vendor — the server accepts a bare figure, but a cost with no payee is
          // a number nobody can chase later.
          vendorPublicId: form.vendorPublicId || null,
          vendorCost: form.vendorPublicId ? cost : 0,
          paidAmount: paid,
          applyGst: form.applyGst,
          gstInclusive: form.gstInclusive,
          applyTcs: form.applyTcs,
          // Sent as a block or not at all: a payee or a value without a type is an arrangement the
          // server cannot price, so an empty type clears the whole thing.
          commissionPayeeName: form.commissionType ? form.commissionPayeeName.trim() || null : null,
          commissionType: form.commissionType || null,
          commissionValue: form.commissionType ? Number(form.commissionValue) || 0 : null,
          services: Array.isArray(lead.services) ? lead.services : [],
        },
        idempotencyKey.current,
      );
      const created = res?.data?.data ?? res?.data ?? null;
      setBooking(created);
      showToast(`Booking ${created?.bookingCode || ""} created.`, "success");
      onBooked?.(created);

      /* REMOVED: the PATCH /bookings/{id}/sync-quotation call that fired here when the agreed price
         differed from the quote — the same removal already made on the Create Booking form, kept in
         step so the two doors cannot disagree about what a quotation is.

         It rewrote the customer's own quotation IN PLACE, solving for `markup` until the derived
         total hit the booking figure. Nothing survived it: Quotation carries no Envers audit, no
         version was bumped, and the PDF renders live from the current row — so the document the
         customer was holding quietly stopped matching the one on file. Under GST-inclusive pricing
         it also targeted the back-derived PRE-TAX base, cutting the quoted price by the GST just
         collected.

         The quotation is the OFFER and the booking is the SALE. They are allowed to differ, and the
         difference belongs on the booking rather than being erased from the older document. */
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Could not create the booking."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  }, [problem, submitting, lead, chosenQuotationId, customerName,
      customerPhone, destination, travelDate, amount, cost, paid, form, showToast, onBooked]);

  /* Booked. The panel does NOT collapse back to the form — the agent's next words are the booking
     number, and the customer is still standing there. */
  if (booking) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-900">
              Booked — {booking.bookingCode || "created"}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              {money(booking.totalPayable ?? amount)} payable
              {paid > 0 ? ` · ${money(paid)} received` : " · nothing received yet"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/BookingDetails/${booking.publicId}`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-bold text-slate-800">Book this now</h4>
        <span className="ml-auto text-xs font-semibold text-slate-500">
          Customer pays {money(amount)}
        </span>
      </div>

      {/* ── As per quotation ────────────────────────────────────────────────────────────────
          The one question that decides what this booking is FOR. Ticked (the default, and what
          this panel always did) the price is the quote and cannot be typed over. Unticked, the
          agent types what was actually agreed and the quotation is rewritten to match once the
          booking is saved — so the customer's copy never drifts from the sale. */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={asPerQuotation}
            onChange={(e) => {
              const next = e.target.checked;
              setAsPerQuotation(next);
              // Seed the box with the quoted figure rather than an empty field: the agreed price is
              // almost always the quote plus or minus a little, and an empty box invites a typo on
              // the digits that were already correct.
              if (!next && !agreedAmount) setAgreedAmount(quotedFigure ? String(quotedFigure) : "");
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-100"
          />
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-800">As per quotation</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              {asPerQuotation
                ? `Booking for the quoted ${money(quotedFigure)}.`
                : "Enter the price actually agreed — the quotation will be updated to match."}
            </span>
          </span>
        </label>

        {/* Only when there is a choice to make. One quotation needs no picker. */}
        {quotations.length > 1 && (
          <div className="mt-3">
            <Labelled label="Which quotation" hint="The version the customer accepted.">
              <Select value={chosenQuotationId} onChange={setChosenQuotationId}>
                {quotations.map((q) => {
                  const id = q.publicId || q.id;
                  return (
                    <option key={id} value={id}>
                      {q.version ? `${q.version} · ` : ""}{q.title || "Quotation"}
                      {q.grandTotal != null ? ` — ${money(Number(q.grandTotal))}` : ""}
                    </option>
                  );
                })}
              </Select>
            </Labelled>
          </div>
        )}

        {!asPerQuotation && (
          <div className="mt-3">
            <Labelled
              label="Agreed price"
              hint={priceDivergence
                ? `Quoted ${money(quotedFigure)} — recorded on the booking. The quotation stays as the customer received it.`
                : "Same as the quote."}
            >
              <Money value={agreedAmount} onChange={setAgreedAmount} placeholder="0.00" />
            </Labelled>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Labelled label="Vendor" hint="Optional — arrange it later if nothing is booked yet.">
          <Select
            value={form.vendorPublicId}
            onChange={(v) => {
              set("vendorPublicId", v);
              // Clearing the vendor clears its cost. Leaving the figure behind would submit money
              // owed to nobody, which is the exact shape this pairing exists to prevent.
              if (!v) set("vendorCost", "");
            }}
            disabled={loadingVendors}
          >
            <option value="">{loadingVendors ? "Loading vendors…" : "No vendor selected"}</option>
            {vendors.map((v) => (
              <option key={v.publicId} value={v.publicId}>{v.vendorName}</option>
            ))}
          </Select>
        </Labelled>

        <Labelled
          label="Vendor cost"
          hint={form.vendorPublicId
            ? "The quote holds selling prices only, so this cannot be filled in for you."
            : "Enabled once a vendor is chosen."}
        >
          <Money
            value={form.vendorCost}
            onChange={(v) => set("vendorCost", v)}
            disabled={!form.vendorPublicId}
            placeholder={form.vendorPublicId ? "0.00" : "Select a vendor first"}
          />
        </Labelled>

        <Labelled label="Advance received" hint="Leave blank if nothing has been paid yet.">
          <Money value={form.paidAmount} onChange={(v) => set("paidAmount", v)} placeholder="0" />
        </Labelled>
      </div>

      {/* Folded away: most bookings owe no commission and take the tenant's tax settings. Two rows of
          controls answering "no" on every booking is how a fast panel stops being fast. */}
      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${more ? "rotate-180" : ""}`} />
        Commission &amp; tax
      </button>

      {more && (
        <div className="mt-2 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3">
          <Labelled label="Commission to" hint="Who brought this booking.">
            <input
              value={form.commissionPayeeName}
              onChange={(e) => set("commissionPayeeName", e.target.value)}
              disabled={!form.commissionType}
              placeholder={form.commissionType ? "Agent or agency name" : "Pick a type first"}
              className={inputCls}
            />
          </Labelled>
          <Labelled label="Commission type" hint="Leave blank if none was agreed.">
            <Select
              value={form.commissionType}
              onChange={(v) => {
                set("commissionType", v);
                if (!v) { set("commissionValue", ""); set("commissionPayeeName", ""); }
              }}
            >
              <option value="">No commission</option>
              <option value="PERCENT">Percent of sale</option>
              <option value="FLAT">Flat amount</option>
            </Select>
          </Labelled>
          <Labelled
            label={form.commissionType === "PERCENT" ? "Commission %" : "Commission amount"}
            hint="Reduces profit the moment it is agreed, paid or not."
          >
            <Money
              value={form.commissionValue}
              onChange={(v) => set("commissionValue", v)}
              disabled={!form.commissionType}
              placeholder={form.commissionType ? "0" : "—"}
            />
          </Labelled>

          <Labelled label="GST" hint="Follow settings unless this booking differs.">
            <TriState
              value={form.applyGst}
              onChange={(v) => {
                set("applyGst", v);
                // "No GST" makes inclusive-vs-plus meaningless. Leaving a stale true behind would
                // submit an instruction the agent had visibly disabled on screen.
                if (v === false) set("gstInclusive", null);
              }}
              yes="Charge GST"
              no="No GST"
            />
          </Labelled>
          <Labelled label="Quoted price is" hint="Inclusive means GST is inside the amount quoted.">
            <TriState
              value={form.gstInclusive}
              onChange={(v) => set("gstInclusive", v)}
              yes="GST-inclusive"
              no="Plus GST"
              disabled={form.applyGst === false}
            />
          </Labelled>
          <Labelled label="TCS" hint="Overseas packages may attract it by policy.">
            <TriState value={form.applyTcs} onChange={(v) => set("applyTcs", v)} yes="Charge TCS" no="No TCS" />
          </Labelled>
        </div>
      )}

      {preview && (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          <Row k="Total payable" v={money(preview.totalPayable)} strong />
          {Number(preview.gst) > 0 && <Row k="GST" v={money(preview.gst)} />}
          {Number(preview.tcs) > 0 && <Row k="TCS" v={money(preview.tcs)} />}
          <Row
            k="Your profit"
            v={money(preview.netProfit)}
            strong
            tone={Number(preview.netProfit) < 0 ? "text-rose-600" : "text-emerald-600"}
          />
          <Row k="Pending" v={money(preview.pendingAmount)} />
        </dl>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!!problem || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {submitting ? "Creating…" : "Confirm booking"}
        </button>
        {/* Says WHY the button is dead rather than leaving a greyed control to guess at. */}
        {problem && <span className="text-xs font-semibold text-slate-500">{problem}</span>}
      </div>
    </div>
  );
}

/* ── small controls ───────────────────────────────────────────────────────── */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 " +
  "placeholder:font-medium placeholder:text-slate-400 focus:border-blue-400 focus:outline-none " +
  "focus:ring-2 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function Labelled({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Money({ value, onChange, disabled, placeholder }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      // A stray scroll over a focused number input silently changes the figure. On a money field
      // that is a wrong booking, so the wheel blurs instead.
      onWheel={(e) => e.currentTarget.blur()}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

/* appearance-none + pr-9 is load-bearing: without it the browser draws its own arrow AND the
   chevron below renders, giving two. Same recipe as the full booking form. */
function Select({ value, onChange, disabled, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} appearance-none pr-9`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/**
 * A three-way control for the tax flags, because they are genuinely three-valued.
 *
 * Null means "follow the tenant's accounting settings" and is NOT the same instruction as false —
 * a checkbox here would collapse the two and pin every booking made from this panel to an explicit
 * answer the agent never gave.
 */
function TriState({ value, onChange, yes, no, disabled }) {
  return (
    <Select
      value={value === null || value === undefined ? "" : String(value)}
      disabled={disabled}
      onChange={(v) => onChange(v === "" ? null : v === "true")}
    >
      <option value="">Follow settings</option>
      <option value="true">{yes}</option>
      <option value="false">{no}</option>
    </Select>
  );
}

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Row({ k, v, strong, tone }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-slate-400">{k}</dt>
      <dd className={`${strong ? "font-bold" : "font-semibold"} ${tone || "text-slate-700"}`}>{v}</dd>
    </div>
  );
}

/**
 * A lead's travel date as the plain yyyy-MM-dd the server's LocalDate wants.
 *
 * The lead API does not promise which of the two it returns, and an ISO datetime posted straight
 * through is a 400 the agent cannot act on — "travel date is required" while a date is plainly on
 * screen.
 */
const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
