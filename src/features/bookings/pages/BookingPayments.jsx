// src/features/bookings/pages/BookingPayments.jsx
// ─────────────────────────────────────────────────────────────
// Booking Payments page
// Route: /BookingPayments/:id
// Layout: Summary bar → Left (Add Payment form) + Right (History + Summary cards)
// ─────────────────────────────────────────────────────────────

import { Fragment, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import bookingService from "../api/bookingService";
import BookingPaymentModal from "../components/BookingPaymentModal";
import BookingPaymentEditModal from "../components/BookingPaymentEditModal";
import PaymentReceipts from "../components/PaymentReceipts";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import {
  FiAlertCircle, FiPlus, FiTrash2, FiEdit2, FiLayers,
  FiArrowLeft, FiRefreshCw, FiCreditCard, FiChevronDown, FiChevronRight,
} from "react-icons/fi";

/* ─── CONSTANTS ──────────────────────────────────────────────── */
// "Refund" is deliberately NOT here. A refund is money OUT with its own voucher and its own
// @Version-guarded total on the booking; recording one as a receipt would increase paidAmount.
// Refunds go through the cancel/refund flow, and the backend refuses to edit or delete their rows.
const PAYMENT_TYPES   = ["Advance","Instalment","Final Payment","Adjustment","Other"];
const PAYMENT_METHODS = ["Cash","Bank Transfer","UPI","Credit Card","Debit Card","Cheque","Online","Wallet","Other"];

const STATUS_CFG = {
  CONFIRMED:  { bg:"bg-green-500",  text:"text-white" },
  PENDING:    { bg:"bg-amber-400",  text:"text-white" },
  CANCELLED:  { bg:"bg-red-500",    text:"text-white" },
  COMPLETED:  { bg:"bg-green-500",  text:"text-white" },
  REFUNDED:   { bg:"bg-purple-500", text:"text-white" },
};

/* ─── HELPERS ────────────────────────────────────────────────── */
const fmtINR = n => n != null
  ? "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })
  : "₹0.00";
const fmtDate = d => d
  ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
  : "—";
const titleCase = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";
// Stored as "HH:mm:ss"; nothing is invented when it is absent — a receipt whose time nobody
// recorded shows a dash, not a fabricated midnight.
const fmtTime = t => (t ? String(t).slice(0, 5) : "");

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function BookingPayments() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { showToast } = useToast();

  // RECORDING a receipt needs nothing beyond being able to see the booking — the backend dropped
  // BOOKING_UPDATE from that endpoint, because a receipt nobody is allowed to enter is a receipt
  // that goes unrecorded. AMENDING or DELETING one is admin territory (PAYMENT_MANAGE).
  const canRecord = true;
  const canManage = hasPermission(P.PAYMENT_MANAGE);

  /* ── State ── */
  const [booking,   setBooking]   = useState(null);
  const [payments,  setPayments]  = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [expanded,  setExpanded]  = useState({});   // publicId → row detail/receipts open

  /* Payment form */
  const emptyForm = {
    paymentType:    "",
    amount:         "",
    paymentMethod:  "",
    paymentAccount: "",
    paidByName:     "",
    receivedByUserPublicId: "",
    paymentDate:    new Date().toISOString().slice(0,10),
    paymentTime:    "",
    reference:      "",
    notes:          "",
  };
  const [form,   setForm]   = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:""})); };

  const toggleRow = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  /* ── FETCH ── */
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        bookingService.getById(id),
        bookingService.getPayments(id),
      ]);

      const b = bRes.data?.data ?? bRes.data;
      setBooking({
        id:             b.publicId || b.id,
        code:           b.bookingCode || b.code || "—",
        customer:       b.customerNameSnapshot || b.customerName || "—",
        customerAmount: Number(b.customerAmount) || 0,
        totalPayable:   Number(b.totalPayable)   || 0,
        paidAmount:     Number(b.paidAmount)     || 0,
        pendingAmount:  Number(b.pendingAmount)  || 0,
        vendorCost:     Number(b.vendorCost)     || 0,
        gst:            Number(b.gst)            || 0,
        tcs:            Number(b.tcs)            || 0,
        status:         (b.status || "PENDING").toUpperCase(),
        paymentStatus:  (b.paymentStatus || "UNPAID").toUpperCase(),
      });

      const payList = pRes.data?.data ?? pRes.data ?? [];
      setPayments(Array.isArray(payList) ? payList : []);
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Failed to load booking."), "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Staff list for the "Received By" pickers. Loaded once and shared by the quick form, the batch
  // modal and the edit modal.
  //
  // Degrades silently to an empty list rather than toasting: this endpoint requires BOOKING_CREATE,
  // which a counter clerk who only records receipts may not hold. Without it the picker simply
  // disappears and the server stamps the signed-in user — which is the right answer for exactly
  // that person anyway. A user did not ask for this list, so its absence is not an error to report.
  useEffect(() => {
    let alive = true;
    bookingService.getEligibleAssignees()
      .then((res) => {
        if (!alive) return;
        const list = res.data?.data ?? res.data ?? [];
        setUsers(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (alive) setUsers([]); });
    return () => { alive = false; };
  }, []);

  /* ── Computed ── */
  // Refunds / net are derived from the ledger; paid / due / total come from the booking.
  //
  // Read the SERVER's entryType rather than guessing from the free-text paymentType. The old test
  // ("is the label 'refund'?") both missed real refunds recorded under any other label and counted
  // an ordinary receipt somebody happened to type "Refund" into.
  const isRefundRow = (p) => p.entryType === "REFUND";

  const totalRefunded = payments
    .filter(isRefundRow)
    .reduce((s,p) => s + (Number(p.amount)||0), 0);

  const paidAmount = booking?.paidAmount || 0;
  const totalPayable = booking?.totalPayable || 0;
  const dueAmount = booking?.pendingAmount != null
    ? booking.pendingAmount
    : Math.max(0, totalPayable - paidAmount);
  const netReceived = paidAmount - totalRefunded;

  /* ── VALIDATE ── */
  // Only what the SERVER actually requires. Type and mode used to be mandatory here while being
  // optional on the API, which turned a legitimate "cash came in, details unknown" into a blocked
  // form — and blocking a receipt is the one failure mode this screen must not have.
  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      e.amount = "Enter a valid amount";
    if (!form.paymentDate)   e.paymentDate   = "Select payment date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Blank strings must not travel: receivedByUserPublicId="" is a malformed UUID and would 400,
  // whereas null means "stamp the signed-in user", which is what an untouched picker means.
  const toPayload = (f) => ({
    amount:         Number(f.amount),
    paymentType:    f.paymentType   || null,
    paymentMethod:  f.paymentMethod || null,
    paymentAccount: f.paymentAccount?.trim() || null,
    paidByName:     f.paidByName?.trim()     || null,
    receivedByUserPublicId: f.receivedByUserPublicId || null,
    paymentDate:    f.paymentDate,
    paymentTime:    f.paymentTime || null,
    reference:      f.reference?.trim() || null,
    notes:          f.notes?.trim()     || null,
  });

  /* ── ADD PAYMENT (quick, single) ── */
  const handleAddPayment = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await bookingService.addPayment(booking.id, toPayload(form));
      showToast("Payment added successfully.", "success");
      setForm(emptyForm);
      fetchData(); // refresh payments + booking totals
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Failed to add payment."), "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── ADD PAYMENTS (batch) ── */
  // Returns a boolean so the modal knows whether it may clear its auto-saved draft. On failure the
  // draft survives and the user fixes one field instead of retyping the whole batch.
  const handleAddBatch = async (rows) => {
    setSaving(true);
    try {
      const res = await bookingService.addPayments(booking.id, rows);
      const created = res.data?.data ?? [];
      showToast(`${created.length || rows.length} payment(s) recorded.`, "success");
      setBatchOpen(false);
      fetchData();
      return true;
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Failed to record payments."), "error");
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ── EDIT PAYMENT ── */
  const handleEditSave = async (body) => {
    if (!canManage || !editing) return;
    setSaving(true);
    try {
      await bookingService.updatePaymentEntry(booking.id, editing.publicId, body);
      showToast("Payment entry updated.", "success");
      setEditing(null);
      fetchData();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Failed to update the payment."), "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── DELETE PAYMENT ── */
  const handleDelete = async (payment) => {
    if (!canManage) return;
    try {
      await bookingService.deletePayment(booking.id, payment.publicId);
      showToast("Payment removed.", "success");
      fetchData();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Failed to remove payment."), "error");
    }
    setDeleting(null);
  };

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center"
        style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-500 font-semibold">Loading payment details…</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center"
        style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-lg font-extrabold text-slate-600 mb-2">Booking Not Found</p>
          <button onClick={()=>navigate("/Allbookings")}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm mx-auto">
            <FiArrowLeft className="w-4 h-4"/> Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  const sc = STATUS_CFG[booking.status] || STATUS_CFG.PENDING;

  const inputCls = (err) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all
     ${err
       ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-50"
       : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-300"}`;

  const selectCls = (err) => inputCls(err) + " appearance-none cursor-pointer pr-9";

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        select { -webkit-appearance:none; appearance:none; }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button onClick={()=>navigate(-1)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
                <FiArrowLeft className="w-4 h-4 text-slate-600"/>
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800">Booking Payments</h1>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                  <span className="cursor-pointer hover:text-blue-600" onClick={()=>navigate("/")}>Home</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="cursor-pointer hover:text-blue-600" onClick={()=>navigate("/Allbookings")}>Bookings</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="cursor-pointer hover:text-blue-600" onClick={()=>navigate(`/BookingDetails/${id}`)}>View Booking</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-blue-600 font-bold">Payments</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setBatchOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-200 transition-all">
                <FiLayers className="w-3.5 h-3.5"/> Record Payments
              </button>
              <button onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 text-xs font-bold transition-all">
                <FiRefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ══════════════════════════════════════════════════════
            BOOKING PAYMENT SUMMARY BAR
        ══════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 rounded-2xl px-5 py-4 shadow-lg shadow-blue-200"
          style={{animation:"fadeUp .4s ease both"}}>
          <div className="flex items-center gap-2 mb-3">
            <FiAlertCircle className="w-4 h-4 text-white/80"/>
            <h2 className="text-sm font-extrabold text-white">Booking Payment Summary</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-6">
            {/* Col 1 */}
            <div>
              <p className="text-white/80 text-xs font-medium">Booking Code: <span className="font-extrabold text-white">{booking.code}</span></p>
              <p className="text-white/80 text-xs font-medium">Customer: <span className="font-bold text-white">{booking.customer}</span></p>
            </div>
            {/* Col 2 */}
            <div>
              <p className="text-white/80 text-xs font-medium">Customer Amount: <span className="font-extrabold text-white">{fmtINR(booking.customerAmount)}</span></p>
              <p className="text-white/80 text-xs font-medium">Total Payable: <span className="font-extrabold text-white">{fmtINR(totalPayable)}</span></p>
            </div>
            {/* Col 3 */}
            <div>
              <p className="text-white/80 text-xs font-medium flex items-center gap-1.5">
                Status:
                <span className={`${sc.bg} ${sc.text} text-xs font-bold px-2 py-0.5 rounded-full`}>
                  {titleCase(booking.status)}
                </span>
              </p>
              <p className="text-white/80 text-xs font-medium">Paid Amount: <span className="font-bold text-white">{fmtINR(paidAmount)}</span></p>
            </div>
            {/* Col 4 */}
            <div>
              <p className="text-white/80 text-xs font-medium">Due Amount: <span className="font-extrabold text-blue-800">{fmtINR(Math.max(0,dueAmount))}</span></p>
              <p className="text-white/80 text-xs font-medium">Total Refunds: <span className="font-bold text-white">{fmtINR(totalRefunded)}</span></p>
              <p className="text-white/80 text-xs font-medium">Net Received: <span className="font-bold text-white">{fmtINR(netReceived)}</span></p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            MAIN CONTENT — LEFT FORM + RIGHT HISTORY
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

          {/* ── LEFT: ADD PAYMENT FORM ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            style={{animation:"fadeUp .4s ease both .1s"}}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-3.5">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <FiPlus className="w-4 h-4"/> Add Payment
              </h3>
            </div>
            <div className="p-5 space-y-4">

              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Amount <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">₹</span>
                  <input type="number" step="0.01" min="0" inputMode="decimal"
                    value={form.amount}
                    onChange={e=>set("amount",e.target.value)}
                    placeholder="0.00"
                    className={inputCls(errors.amount) + " pl-8"}/>
                </div>
                <p className="text-xs text-slate-400 mt-1">Due Amount: {fmtINR(Math.max(0,dueAmount))}</p>
                {errors.amount && <p className="text-xs text-red-500 font-semibold mt-0.5">{errors.amount}</p>}
              </div>

              {/* Payment Type */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Payment Type
                </label>
                <div className="relative">
                  <select value={form.paymentType} onChange={e=>set("paymentType",e.target.value)}
                    className={selectCls(false)}>
                    <option value="">Select Payment Type</option>
                    {PAYMENT_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
                </div>
              </div>

              {/* Mode — HOW it was tendered */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Payment Mode
                </label>
                <div className="relative">
                  <select value={form.paymentMethod} onChange={e=>set("paymentMethod",e.target.value)}
                    className={selectCls(false)}>
                    <option value="">Select Payment Mode</option>
                    {PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
                </div>
              </div>

              {/* Account — WHERE the money landed. Distinct from the mode: "UPI" is how it was
                  tendered, "PhonePe — Ops" is the account a bank statement reconciles against. */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Paid Into (Account)
                </label>
                <input value={form.paymentAccount}
                  onChange={e=>set("paymentAccount",e.target.value)}
                  placeholder="HDFC ••4521 / Cash Counter"
                  className={inputCls(false)}/>
              </div>

              {/* Paid by — frequently NOT the booking's customer. */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Paid By
                </label>
                <input value={form.paidByName}
                  onChange={e=>set("paidByName",e.target.value)}
                  placeholder={booking.customer || "Payer name"}
                  className={inputCls(false)}/>
              </div>

              {/* Received by — who on OUR side is holding the money. Hidden entirely when the staff
                  list could not be loaded; the server then stamps the signed-in user, which is the
                  right answer for exactly the person who cannot load it. */}
              {users.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                    Received By
                  </label>
                  <div className="relative">
                    <select value={form.receivedByUserPublicId}
                      onChange={e=>set("receivedByUserPublicId",e.target.value)}
                      className={selectCls(false)}>
                      <option value="">Me (default)</option>
                      {users.map(u=>(
                        <option key={u.publicId} value={u.publicId}>{u.name || u.username || u.email}</option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">▼</span>
                  </div>
                </div>
              )}

              {/* Date + time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={form.paymentDate}
                    onChange={e=>set("paymentDate",e.target.value)}
                    className={inputCls(errors.paymentDate)}/>
                  {errors.paymentDate && <p className="text-xs text-red-500 font-semibold mt-1">{errors.paymentDate}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                    Time
                  </label>
                  <input type="time" value={form.paymentTime}
                    onChange={e=>set("paymentTime",e.target.value)}
                    className={inputCls(false)}/>
                </div>
              </div>

              {/* Reference Number */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Reference Number</label>
                <input value={form.reference}
                  onChange={e=>set("reference",e.target.value)}
                  placeholder="UTR / cheque no. / txn id"
                  className={inputCls(false)}/>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Notes</label>
                <textarea value={form.notes}
                  onChange={e=>set("notes",e.target.value)}
                  placeholder="Additional payment notes..."
                  rows={3}
                  className={inputCls(false) + " resize-none"}/>
              </div>

              {/* Submit */}
              <button onClick={handleAddPayment} disabled={saving}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl
                  bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm
                  shadow-md shadow-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> Adding…</>
                  : <><FiPlus className="w-4 h-4"/> Add Payment</>
                }
              </button>

              <button onClick={()=>setBatchOpen(true)} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                  border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200
                  font-bold text-xs transition-all disabled:opacity-60">
                <FiLayers className="w-3.5 h-3.5"/> Record several at once
              </button>

              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Attach the receipt after saving — open the entry in the history and use Attach.
              </p>
            </div>
          </div>

          {/* ── RIGHT: PAYMENT HISTORY + SUMMARY ── */}
          <div className="space-y-5">

            {/* Payment History */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              style={{animation:"fadeUp .4s ease both .15s"}}>
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2">
                  <FiCreditCard className="w-4 h-4 text-blue-600"/> Payment History
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                    Paid: {fmtINR(paidAmount)}
                  </span>
                  <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full">
                    Net: {fmtINR(netReceived)}
                  </span>
                </div>
              </div>
              <div className="p-5">
                {payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {["","Date / Time","Type","Amount","Mode / Account","Paid By","Received By","Reference",""].map((h,hi)=>(
                            <th key={h||`col-${hi}`} className="px-3 py-2.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments.map((pay, i) => {
                          const isRefund = isRefundRow(pay);
                          const rowId    = pay.publicId || i;
                          const isOpen   = !!expanded[rowId];
                          return (
                            // The Fragment is the array element, so the key belongs HERE — a key on
                            // the inner <tr> alone still warns and breaks reconciliation on delete.
                            <Fragment key={rowId}>
                              <tr className="hover:bg-blue-50/40 group transition-colors"
                                style={{animation:`fadeUp .3s ease both ${i*30}ms`}}>
                                <td className="px-3 py-3">
                                  <button onClick={()=>toggleRow(rowId)}
                                    title={isOpen ? "Hide details" : "Show details & receipts"}
                                    className="w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all">
                                    {isOpen ? <FiChevronDown className="w-3.5 h-3.5"/> : <FiChevronRight className="w-3.5 h-3.5"/>}
                                  </button>
                                </td>

                                <td className="px-3 py-3 whitespace-nowrap">
                                  <div className="text-xs font-semibold text-slate-700">{fmtDate(pay.paymentDate||pay.createdAt)}</div>
                                  {fmtTime(pay.paymentTime) && (
                                    <div className="text-[10px] text-slate-400 font-mono">{fmtTime(pay.paymentTime)}</div>
                                  )}
                                </td>

                                <td className="px-3 py-3">
                                  <span className="text-xs font-bold text-slate-600">{pay.paymentType||"—"}</span>
                                  {isRefund && (
                                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                      Refund
                                    </span>
                                  )}
                                  {pay.amended && (
                                    <span
                                      title={`Edited by ${pay.amendedBy||"—"}${pay.amendmentReason?` — ${pay.amendmentReason}`:""}`}
                                      className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                      Edited
                                    </span>
                                  )}
                                </td>

                                <td className="px-3 py-3">
                                  <span className={`text-sm font-extrabold ${isRefund?"text-red-600":"text-green-600"}`}>
                                    {isRefund?"-":""}{fmtINR(pay.amount)}
                                  </span>
                                </td>

                                <td className="px-3 py-3">
                                  <div className="text-xs text-slate-600 font-semibold">{pay.paymentMethod||"—"}</div>
                                  {pay.paymentAccount && (
                                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={pay.paymentAccount}>
                                      {pay.paymentAccount}
                                    </div>
                                  )}
                                </td>

                                <td className="px-3 py-3 text-xs text-slate-500 truncate max-w-[120px]" title={pay.paidByName||""}>
                                  {pay.paidByName || booking.customer || "—"}
                                </td>

                                <td className="px-3 py-3 text-xs text-slate-500 truncate max-w-[120px]" title={pay.receivedByName||""}>
                                  {pay.receivedByName || "—"}
                                </td>

                                <td className="px-3 py-3 text-xs text-slate-400 font-mono truncate max-w-[110px]" title={pay.reference||""}>
                                  {pay.reference||"—"}
                                </td>

                                <td className="px-3 py-3">
                                  {/* Amend + delete are PAYMENT_MANAGE only, and never offered on a
                                      refund row — those belong to the refund flow and the server
                                      refuses both. */}
                                  {canManage && !isRefund && (
                                    deleting === rowId ? (
                                      <div className="flex items-center gap-1">
                                        <button onClick={()=>handleDelete(pay)}
                                          className="text-xs font-bold text-red-600 px-2 py-1 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100">Yes</button>
                                        <button onClick={()=>setDeleting(null)}
                                          className="text-xs font-bold text-slate-500 px-2 py-1 rounded-lg bg-white border border-slate-200">No</button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={()=>setEditing(pay)} title="Edit entry"
                                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200 flex items-center justify-center">
                                          <FiEdit2 className="w-3 h-3"/>
                                        </button>
                                        <button onClick={()=>setDeleting(rowId)} title="Remove entry"
                                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center">
                                          <FiTrash2 className="w-3 h-3"/>
                                        </button>
                                      </div>
                                    )
                                  )}
                                </td>
                              </tr>

                              {isOpen && (
                                <tr className="bg-slate-50/40">
                                  <td colSpan={9} className="px-3 pb-4 pt-1">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                                        <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">Details</p>
                                        <p className="text-xs text-slate-600">
                                          <span className="text-slate-400">Notes:</span> {pay.notes || "—"}
                                        </p>
                                        <p className="text-xs text-slate-600">
                                          <span className="text-slate-400">Recorded by:</span> {pay.createdBy || "—"}
                                          {pay.createdAt ? ` · ${pay.createdAt}` : ""}
                                        </p>
                                        {pay.amended && (
                                          <p className="text-xs text-amber-700">
                                            <span className="text-amber-500">Edited by:</span> {pay.amendedBy || "—"}
                                            {pay.amendedAt ? ` · ${pay.amendedAt}` : ""}
                                            {pay.amendmentReason ? ` — "${pay.amendmentReason}"` : ""}
                                          </p>
                                        )}
                                      </div>

                                      {/* Attachments load only when a row is opened — fetching every
                                          blob list on page load would be a request per receipt. */}
                                      <PaymentReceipts
                                        bookingId={booking.id}
                                        payment={pay}
                                        canDelete={canManage}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">💳</div>
                    <p className="text-sm text-slate-400 font-medium">No payments recorded yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Summary — 4 cards */}
            <div style={{animation:"fadeUp .4s ease both .25s"}}>
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">Payment Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label:"Total Payable", value:fmtINR(totalPayable),          icon:"₹",  bg:"from-blue-600 to-indigo-500"    },
                  { label:"Paid",          value:fmtINR(paidAmount),            icon:"💰", bg:"from-green-500 to-emerald-500" },
                  { label:"Refunded",      value:fmtINR(totalRefunded),         icon:"↩️",  bg:"from-amber-500 to-yellow-500"  },
                  { label:"Due",           value:fmtINR(Math.max(0,dueAmount)), icon:"📋", bg:"from-red-500 to-rose-500"      },
                ].map((card, i) => (
                  <div key={card.label}
                    className={`bg-gradient-to-br ${card.bg} rounded-2xl p-4 text-white shadow-lg relative overflow-hidden`}
                    style={{animation:`fadeUp .4s ease both ${i*50+200}ms`}}>
                    <div className="absolute -right-3 -bottom-3 text-white/15 text-6xl pointer-events-none select-none">{card.icon}</div>
                    <p className="text-xs font-bold text-white/80 mb-1 truncate">{card.label}</p>
                    <p className="text-xl font-extrabold text-white leading-tight">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {batchOpen && (
        <BookingPaymentModal
          booking={booking}
          users={users}
          dueAmount={Math.max(0, dueAmount)}
          saving={saving}
          onClose={()=>setBatchOpen(false)}
          onSave={handleAddBatch}
        />
      )}

      {editing && (
        <BookingPaymentEditModal
          payment={editing}
          users={users}
          // Headroom this entry may grow into: everything still unpaid, plus what this entry itself
          // already contributes (raising it to X removes its old amount first).
          maxAmount={Math.max(0, dueAmount) + Number(editing.amount || 0)}
          saving={saving}
          onClose={()=>setEditing(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}