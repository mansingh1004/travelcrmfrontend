import { useState, useEffect, useMemo } from 'react';
import {
  X, ArrowRightLeft, FileText, CheckCircle, AlertTriangle, UserCheck,
} from 'lucide-react';
import { bookingService } from "@features/bookings";
import { quotationService } from "@features/quotation";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useIdempotencyKey } from "@shared/lib/idempotency";

/* res.data?.data ?? res.data — the project-wide envelope unwrap */
const unwrap = (res) => res?.data?.data ?? res?.data;

const QUOTE_STAGE_PILL = {
  Draft:    'bg-slate-100 text-slate-700 border-slate-200',
  Sent:     'bg-blue-100 text-blue-700 border-blue-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};

const COMMON_SERVICES = ['Hotel', 'Flight', 'Sightseeing', 'Cruise', 'Vehicle', 'Visa', 'Passport', 'Add-on'];

const todayStr = () => new Date().toISOString().slice(0, 10);

const toDateInput = (d) => {
  if (!d) return '';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};

const fmtINR = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Services implied by a quotation's included sections. */
function deriveServices(q) {
  const out = [];
  if (q?.flight?.included)      out.push('Flight');
  if (q?.hotel?.included)       out.push('Hotel');
  if (q?.sightseeing?.included) out.push('Sightseeing');
  if (q?.cruise?.included)      out.push('Cruise');
  if (q?.vehicle?.included)     out.push('Vehicle');
  if (q?.addons?.included)      out.push('Add-on');
  return out;
}

/**
 * Convert a qualified lead (optionally carrying an accepted quotation) into a booking.
 * Prefilled from the lead + selected quotation, fully editable, with a live financial
 * preview that mirrors the server (GST 5% + TCS 5%). Submits to
 * POST /api/leads/{publicId}/convert-to-booking (gated by BOOKING_CREATE).
 */
export default function ConvertToBookingModal({ lead, onClose, onConverted }) {
  const leadId = lead.publicId || lead.id;
  const leadDest = (lead.itinerary && lead.itinerary.length > 0 ? lead.itinerary[0].destination : '') || '';

  const [quotes, setQuotes]             = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [selectedQid, setSelectedQid]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState({});

  // "Assigned To" pool. The default (the lead's own assignee) does not depend on this list
  // loading — see `assigneeOptions`, which folds the lead's assignee in even if it isn't a
  // member (a lead assigned to a sub-agent is the normal case there).
  const [assignees, setAssignees] = useState([]);

  // Toasts go straight to the shared store — no `onToast` prop, so this modal no longer
  // depends on whichever page happened to render it.
  const { showToast } = useToast();

  /* POST /leads/{id}/convert-to-booking rejects a request with no Idempotency-Key (400). One key
     per open modal, deliberately NOT reset on failure: retrying after a timeout must replay the
     original conversion rather than convert the same lead twice. The modal closes on success, so
     the next conversion mounts a fresh instance and gets a fresh key. */
  const { key: idempotencyKey } = useIdempotencyKey("cv");

  const [form, setForm] = useState({
    customerName:   lead.customerName || '',
    customerPhone : lead.phone,
    customerEmail : lead.email,
    destination:    leadDest,
    travelDate:     toDateInput(lead.travelDate),
    bookingDate:    todayStr(),
    customerAmount: '',
    vendorCost:     '',
    paidAmount:     '0',
    services:       Array.isArray(lead.services) ? lead.services : [],
    // Default: whoever owns the LEAD keeps the customer — not whoever is clicking Convert.
    // Mirrors the server's own default, so an untouched form and an absent field agree.
    assignedUserId: lead.assignedUser?.publicId || '',
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Load this lead's quotations; default to the newest Approved, else the newest overall.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingQuotes(true);
        const res  = await quotationService.getQuotationsByLead(leadId);
        const body = res.data;
        const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (!active) return;
        setQuotes(list);
        const def = list.find((q) => q.quotationStage === 'Approved') || list[0];
        if (def) {
          setSelectedQid(def.publicId);
          applyQuotation(def.publicId, list);
        }
      } catch (e) {
        if (!active || isAlreadyReported(e)) return;
        showToast(getErrorMessage(e, "Couldn't load this lead's quotations."), 'error');
      } finally {
        if (active) setLoadingQuotes(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Load the assignable pool. Best-effort: the default assignee is already in the form, so a
  // failure here costs the ability to CHANGE the assignee, not the ability to convert.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await bookingService.getEligibleAssignees();
        const list = unwrap(res);
        if (active && Array.isArray(list)) setAssignees(list);
      } catch (e) {
        if (!active || isAlreadyReported(e)) return;
        showToast(getErrorMessage(e, "Couldn't load the staff list. The booking will stay with the lead's owner."), 'error');
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Options = the eligible pool, plus the lead's own assignee if they're not in it. That fold-in
  // is the normal path, not an edge case: the pool excludes sub-agents, and a sub-agent's lead
  // must still be convertible without silently reassigning the customer to someone else.
  const assigneeOptions = useMemo(() => {
    const owner = lead.assignedUser;
    if (!owner?.publicId) return assignees;
    if (assignees.some((u) => u.id === owner.publicId)) return assignees;
    // Same defensive name chain the leads list uses (AllLeads.jsx) — the assignedUser shape
    // varies by which endpoint the lead came from.
    const name = owner.fullName || owner.name || owner.username || owner.email || 'Lead owner';
    return [{ id: owner.publicId, name, email: owner.email, role: owner.role }, ...assignees];
  }, [assignees, lead.assignedUser]);

  // Prefill amount / dates / destination / services from a chosen quotation.
  const applyQuotation = async (qid, list = quotes) => {
    if (!qid) return;
    const summary = list.find((q) => q.publicId === qid);
    if (summary) {
      setForm((p) => ({
        ...p,
        destination:    summary.destination || p.destination,
        customerAmount: summary.grandTotal != null ? String(summary.grandTotal) : p.customerAmount,
      }));
    }
    try {
      const q = unwrap(await quotationService.getQuotationById(qid));
      if (!q) return;
      const grand = q?.totals?.grandTotal;
      const cust  = q?.customer || {};
      const svc   = deriveServices(q);
      setForm((p) => ({
        ...p,
        customerName:   cust.name || p.customerName,
        destination:    cust.destination || p.destination,
        travelDate:     toDateInput(cust.travelDate) || p.travelDate,
        customerAmount: grand != null ? String(grand) : p.customerAmount,
        services:       svc.length ? svc : p.services,
      }));
    } catch (e) {
      // Prefill is best-effort — the summary row already seeded amount + destination, and the
      // agent can still fill the rest by hand. Say so rather than looking silently broken.
      if (isAlreadyReported(e)) return;
      showToast(getErrorMessage(e, "Couldn't prefill from that quotation. Please check the fields."), 'error');
    }
  };

  const onSelectQuote = (qid) => {
    setSelectedQid(qid);
    if (qid) applyQuotation(qid);
  };

  const toggleService = (svc) =>
    setForm((p) => ({
      ...p,
      services: p.services.includes(svc)
        ? p.services.filter((s) => s !== svc)
        : [...p.services, svc],
    }));

  // ── Live financial preview (mirrors BookingServiceImpl: GST 5% + TCS 5%) ──
  const totals = useMemo(() => {
    const amount = Number(form.customerAmount) || 0;
    const vendor = Number(form.vendorCost) || 0;
    const paid   = Number(form.paidAmount) || 0;
    const gst   = +(amount * 0.05).toFixed(2);
    const tcs   = +(amount * 0.05).toFixed(2);
    const total = +(amount + gst + tcs).toFixed(2);
    const profit = +(amount - vendor).toFixed(2);
    const payStatus = paid <= 0 ? 'Unpaid' : paid >= total ? 'Paid' : 'Partial';
    return { amount, vendor, paid, gst, tcs, total, profit, payStatus };
  }, [form.customerAmount, form.vendorCost, form.paidAmount]);

  const validate = () => {
    const e = {};
    if (!form.customerName.trim()) e.customerName = 'Required';
    if (!form.destination.trim())  e.destination = 'Required';
    if (!form.travelDate)          e.travelDate = 'Required';
    else if (form.travelDate < todayStr()) e.travelDate = 'Cannot be in the past';
    if (!(Number(form.customerAmount) > 0)) e.customerAmount = 'Must be greater than 0';
    if (!(Number(form.vendorCost) > 0))     e.vendorCost = 'Must be greater than 0';
    if (Number(form.paidAmount) < 0)        e.paidAmount = 'Cannot be negative';
    else if (Number(form.paidAmount) > totals.total) e.paidAmount = 'Exceeds total payable';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting) return;            // guard against double-submit
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        quotationPublicId: selectedQid || null,
        customerName:   form.customerName.trim(),
        customerPhone : form.customerPhone.trim(),
        customerEmail : form.customerEmail.trim(),
        destination:    form.destination.trim(),
        travelDate:     form.travelDate,
        bookingDate:    form.bookingDate || null,
        customerAmount: Number(form.customerAmount),
        vendorCost:     Number(form.vendorCost),
        paidAmount:     Number(form.paidAmount) || 0,
        services:       form.services,
        // Omitted (null) → the server applies the same default this form shows.
        assignedUserId: form.assignedUserId || null,
      };
      
      const booking = unwrap(await bookingService.convertFromLead(leadId, payload, idempotencyKey));
      showToast(`Booking ${booking?.bookingCode || ''} created from lead`, 'success');
      onConverted?.(lead, booking);
      onClose();
    } catch (err) {
      // The hand-rolled 403 branch is gone: the interceptor owns PERMISSION_DENIED and has
      // already toasted it, in copy kept byte-identical to the server's.
      if (isAlreadyReported(err)) return;
      showToast(getErrorMessage(err, 'Failed to convert lead to booking. Please try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (key) =>
    `w-full px-3 py-2.5 rounded-xl border text-sm text-slate-700 placeholder-slate-400 bg-white
     focus:ring-2 focus:ring-blue-50 outline-none transition-all ${
       errors[key] ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-blue-400'
     }`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60
        w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 rounded-t-2xl flex items-start justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-white text-lg font-extrabold leading-tight">Convert to Booking</h2>
              <p className="text-blue-100 text-xs mt-0.5">{lead.customerName || 'Lead'} · {lead.phone || '—'}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Source quotation ── */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Source quotation
            </label>
            {loadingQuotes ? (
              <p className="text-sm text-slate-400">Loading quotations…</p>
            ) : quotes.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} />
                No quotation found — converting from lead basics. Fill in the amounts below.
              </div>
            ) : (
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedQid}
                  onChange={(e) => onSelectQuote(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                    focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer">
                  <option value="">— No quotation (manual) —</option>
                  {quotes.map((q) => (
                    <option key={q.publicId} value={q.publicId}>
                      {(q.version || 'v1.0')} · {q.quotationStage || 'Draft'} · {fmtINR(q.grandTotal)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedQid && (
              <div className="mt-2 flex items-center gap-2">
                {(() => {
                  const q = quotes.find((x) => x.publicId === selectedQid);
                  if (!q) return null;
                  return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${QUOTE_STAGE_PILL[q.quotationStage] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {q.quotationStage || '—'} carried over
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── Booking details ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Customer Name</label>
              <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)}
                placeholder="Customer name" className={inputCls('customerName')} />
              {errors.customerName && <p className="text-[11px] text-red-500 mt-1">{errors.customerName}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Destination</label>
              <input value={form.destination} onChange={(e) => set('destination', e.target.value)}
                placeholder="e.g. Dubai" className={inputCls('destination')} />
              {errors.destination && <p className="text-[11px] text-red-500 mt-1">{errors.destination}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Travel Date</label>
              <input type="date" value={form.travelDate} min={todayStr()}
                onChange={(e) => set('travelDate', e.target.value)} className={inputCls('travelDate')} />
              {errors.travelDate && <p className="text-[11px] text-red-500 mt-1">{errors.travelDate}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Booking Date</label>
              <input type="date" value={form.bookingDate}
                onChange={(e) => set('bookingDate', e.target.value)} className={inputCls('bookingDate')} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Customer Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={form.customerAmount}
                onChange={(e) => set('customerAmount', e.target.value)}
                placeholder="Carried from quotation" className={inputCls('customerAmount')} />
              {errors.customerAmount && <p className="text-[11px] text-red-500 mt-1">{errors.customerAmount}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Vendor Cost (₹)</label>
              <input type="number" min="0" step="0.01" value={form.vendorCost}
                onChange={(e) => set('vendorCost', e.target.value)}
                placeholder="Your cost" className={inputCls('vendorCost')} />
              {errors.vendorCost && <p className="text-[11px] text-red-500 mt-1">{errors.vendorCost}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Advance Collected Now (₹)</label>
              <input type="number" min="0" step="0.01" value={form.paidAmount}
                onChange={(e) => set('paidAmount', e.target.value)}
                placeholder="0" className={inputCls('paidAmount')} />
              {errors.paidAmount && <p className="text-[11px] text-red-500 mt-1">{errors.paidAmount}</p>}
            </div>

            {/* ── Assigned To — defaults to the lead's owner, editable ── */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Assigned To</label>
              <div className="relative">
                <UserCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={form.assignedUserId}
                  onChange={(e) => set('assignedUserId', e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                    focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer">
                  <option value="">— Unassigned —</option>
                  {assigneeOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.email ? ` · ${u.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {lead.assignedUser?.publicId && form.assignedUserId === lead.assignedUser.publicId
                  ? "Carried over from the lead — the person who nurtured this deal keeps the customer."
                  : "Overriding the lead's owner for this booking."}
              </p>
            </div>
          </div>

          {/* ── Services ── */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Services</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SERVICES.map((svc) => {
                const on = form.services.includes(svc);
                return (
                  <button key={svc} type="button" onClick={() => toggleService(svc)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      on ? 'bg-blue-600 text-white border-blue-600'
                         : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                    }`}>
                    {svc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Live financial preview ── */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Booking Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ['Customer Amt', fmtINR(totals.amount)],
                ['GST (5%)',     fmtINR(totals.gst)],
                ['TCS (5%)',     fmtINR(totals.tcs)],
                ['Total Payable', fmtINR(totals.total)],
                ['Advance',      fmtINR(totals.paid)],
                ['Net Profit',   fmtINR(totals.profit)],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                  <p className={`font-extrabold ${label === 'Net Profit' && totals.profit < 0 ? 'text-red-600' : 'text-slate-700'}`}>{val}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Payment status:</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                totals.payStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700'
                : totals.payStatus === 'Partial' ? 'bg-orange-100 text-orange-700'
                : 'bg-rose-100 text-rose-700'
              }`}>{totals.payStatus}</span>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {submitting ? 'Converting…' : <><CheckCircle size={15} /> Convert to Booking</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}