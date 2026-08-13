// src/features/bookings/components/BookingInvoiceModal.jsx
// ─────────────────────────────────────────────────────────────
// The GST invoice for a booking — the SAME accounting invoice the accountant issues
// (backend bridge: /api/bookings/{id}/gst-invoices → accounting InvoiceService).
// Listing + PDF need BOOKING_READ; GENERATE + CANCEL are limited to tenant-admin +
// accountant (ACCOUNTING_INVOICE_MANAGE) — enforced on the backend and mirrored here.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { FiX, FiPlus, FiEye, FiSlash, FiFileText, FiRefreshCw } from "react-icons/fi";
import bookingService from "../api/bookingService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { openBlob, hydrateBlobError } from "@shared/lib/download";
import { hasPermission, P } from "@shared/lib/access";

const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const TYPE_LABEL = { TAX_INVOICE: "Tax Invoice", BILL_OF_SUPPLY: "Bill of Supply", SIMPLE_INVOICE: "Simple Invoice" };

export default function BookingInvoiceModal({ bookingId, bookingCode, overseasTourPackage, onClose }) {
  const { showToast } = useToast();
  const canManage = hasPermission(P.ACCOUNTING_INVOICE_MANAGE);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cancelId, setCancelId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingService.getGstInvoices(bookingId);
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load GST invoices."), "error");
    } finally {
      setLoading(false);
    }
  }, [bookingId, showToast]);

  useEffect(() => { load(); }, [load]);

  const viewPdf = async (row) => {
    try { openBlob((await bookingService.gstInvoicePdf(bookingId, row.publicId)).data); }
    catch (e) { await hydrateBlobError(e); if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't open the PDF."), "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <style>{`@keyframes popIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10" style={{ animation: "popIn .25s ease both" }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-5 rounded-t-3xl flex items-start justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white"><FiFileText className="w-5 h-5" /></div>
            <div>
              <h2 className="text-white text-lg font-extrabold tracking-tight">GST Invoice</h2>
              <p className="text-blue-100 text-sm mt-0.5">{bookingCode} · same document the accountant issues</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all"><FiX className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Generate */}
          {canManage ? (
            showForm ? (
              <GenerateForm bookingId={bookingId} overseasTourPackage={overseasTourPackage} onClose={() => setShowForm(false)}
                onDone={() => { setShowForm(false); load(); }} />
            ) : (
              <button onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-200 transition-all">
                <FiPlus className="w-4 h-4" /> Generate GST Invoice
              </button>
            )
          ) : (
            <p className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-500">
              Only a tenant admin or accountant can generate a GST invoice. You can view and download any that exist.
            </p>
          )}

          {/* List */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Issued Invoices</h3>
            <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors">
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-4xl mb-2">🧾</div>
              <p className="text-sm font-bold text-slate-600">No GST invoice yet</p>
              <p className="text-xs text-slate-400">{canManage ? "Generate one above." : "Ask an accountant to generate one."}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 rounded-2xl border border-slate-100">
              {rows.map((r) => {
                const cancelled = r.status === "CANCELLED";
                return (
                  <div key={r.publicId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-slate-800 truncate">{r.invoiceNumber}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cancelled ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{r.status}</span>
                      </div>
                      <p className="text-xs text-slate-400">{fmtDate(r.invoiceDate)} · {r.invoiceTypeLabel || TYPE_LABEL[r.invoiceType] || r.invoiceType}{r.recipientGstin ? ` · ${r.recipientGstin}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-extrabold text-slate-800">{fmt(r.invoiceTotal)}</span>
                      <button onClick={() => viewPdf(r)} title="View PDF"
                        className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center transition-all"><FiEye className="w-3.5 h-3.5" /></button>
                      {canManage && !cancelled && (
                        <button onClick={() => setCancelId(r.publicId)} title="Cancel"
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 flex items-center justify-center transition-all"><FiSlash className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {cancelId && <CancelForm bookingId={bookingId} invoiceId={cancelId}
        onClose={() => setCancelId(null)} onDone={() => { setCancelId(null); load(); }} />}
    </div>
  );
}

function GenerateForm({ bookingId, overseasTourPackage, onClose, onDone }) {
  const { showToast } = useToast();
  /* Seeded from the BOOKING, not hardcoded false. The server applies 206C(1G) TCS from this flag
     alone and never consults the stored booking, so a false default quietly under-taxed every
     overseas package invoiced from the detail page. Still editable — the operator can correct it. */
  const [form, setForm] = useState({ invoiceType: "TAX_INVOICE", overseasTourPackage: Boolean(overseasTourPackage), recipientGstin: "", placeOfSupplyState: "", invoiceDate: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all";

  const submit = async () => {
    setSaving(true);
    try {
      const res = await bookingService.issueGstInvoice(bookingId, {
        invoiceType: form.invoiceType,
        overseasTourPackage: form.overseasTourPackage,
        recipientGstin: form.recipientGstin || null,
        placeOfSupplyState: form.placeOfSupplyState || null,
        invoiceDate: form.invoiceDate || null,
      });
      showToast(`GST invoice issued: ${res?.data?.data?.invoiceNumber || ""}`, "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't generate the invoice."), "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold text-slate-700">Generate GST Invoice</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX className="w-4 h-4" /></button>
      </div>
      <div>
        <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">Invoice Type</label>
        <select value={form.invoiceType} onChange={(e) => set("invoiceType", e.target.value)} className={inputCls}>
          <option value="TAX_INVOICE">Tax Invoice (with GST)</option>
          <option value="BILL_OF_SUPPLY">Bill of Supply (no GST)</option>
          <option value="SIMPLE_INVOICE">Simple Invoice (no GST)</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">Recipient GSTIN</label>
          <input value={form.recipientGstin} onChange={(e) => set("recipientGstin", e.target.value.toUpperCase())} placeholder="B2C → leave blank" maxLength={15} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">Place of Supply</label>
          <input value={form.placeOfSupplyState} onChange={(e) => set("placeOfSupplyState", e.target.value)} placeholder="Maharashtra / 27" className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">Invoice Date</label>
          <input type="date" value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} className={inputCls} />
        </div>
        <label className="flex items-end gap-2 pb-2 cursor-pointer">
          <input type="checkbox" checked={form.overseasTourPackage} onChange={(e) => set("overseasTourPackage", e.target.checked)} className="h-4 w-4 accent-blue-600" />
          <span className="text-sm font-semibold text-slate-600">Overseas package (TCS 206C(1G))</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-50">Cancel</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-50">
          {saving ? "Issuing…" : "Issue Invoice"}
        </button>
      </div>
    </div>
  );
}

function CancelForm({ bookingId, invoiceId, onClose, onDone }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) { showToast("A reason is required.", "error"); return; }
    setBusy(true);
    try {
      await bookingService.cancelGstInvoice(bookingId, invoiceId, reason.trim());
      showToast("Invoice cancelled. Its number is retained.", "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't cancel."), "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 p-6 space-y-4" style={{ animation: "popIn .2s ease both" }}>
        <h3 className="text-base font-extrabold text-slate-800">Cancel this GST invoice?</h3>
        <p className="text-sm text-slate-500">The number is retained and reported as cancelled — it is never reused.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (wrong recipient, duplicate…)"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-50 outline-none" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-50">Keep</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-bold shadow-md shadow-red-200 transition-all disabled:opacity-50">
            {busy ? "Cancelling…" : "Cancel Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}