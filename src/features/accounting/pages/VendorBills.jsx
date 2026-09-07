import { useCallback, useEffect, useState } from "react";
import { ReceiptText, Plus, Eye, Ban, Wallet, RefreshCw, Landmark, AlertTriangle } from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { isAlreadyReported, getErrorMessage } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
// Through the barrel, not the file: nothing outside a feature may reach into its api/ (the deep
// import here predates the rule and resolved only by luck of the alias).
import { vendorService } from "@features/vendors";
import {
  Page, Hero, Panel, PanelHead, Badge, Btn, IconBtn, Modal, Field, Select, Pager, KV,
  theadCls, Th, EmptyRow, SkeletonRows, Loading, inputCls,
} from "../components/accountingUi";
import accountingService from "../api/accountingService";
import { resolveRange } from "../lib/dateRange";
import { inr, fmtDate } from "../lib/format";

const STATUS_TONE = { UNPAID: "amber", PARTIALLY_PAID: "blue", PAID: "green", CANCELLED: "red" };
const TDS_SECTIONS = [
  { value: "", label: "No TDS" },
  { value: "SEC_194C", label: "Contractor (194C)" },
  { value: "SEC_194H", label: "Commission / Brokerage (194H)" },
  { value: "SEC_194J", label: "Professional fees (194J)" },
];
const HERO_GRADS = ["from-blue-500 to-indigo-600", "from-teal-500 to-cyan-600", "from-violet-500 to-purple-600", "from-amber-500 to-orange-500"];

export default function VendorBills() {
  const { showToast } = useToast();
  const canManage = hasPermission(P.ACCOUNTING_TDS_MANAGE);

  const [rows, setRows] = useState([]);
  const [tds, setTds] = useState([]);
  const [meta, setMeta] = useState({ page: 0, totalPages: 1, total: 0, from: 0, to: 0 });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  /* The two exception lists. They are the reason nothing here auto-raises a draft bill: the gap is
     shown to the person whose job it is to close it, rather than half-filled bills being created by
     whoever assigned the supplier. */
  const [unbilled, setUnbilled] = useState([]);
  const [cancelledOpen, setCancelledOpen] = useState([]);
  /* When set, the raise modal is filing a bill against this specific service line. */
  const [raiseFor, setRaiseFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fy = resolveRange("this-fy");
      const [billsRes, tdsRes, unbilledRows, cancelledRows] = await Promise.all([
        accountingService.getVendorBills(page, 20),
        accountingService.getTdsSummary(fy),
        // Both degrade to empty rather than failing the page: an exception list that cannot load is
        // a missing prompt, not a reason to hide the payables ledger behind an error.
        accountingService.getUnbilledLines({ limit: 50 }).catch(() => []),
        accountingService.getCancelledBookingPayables({ limit: 50 }).catch(() => []),
      ]);
      setUnbilled(Array.isArray(unbilledRows) ? unbilledRows : []);
      setCancelledOpen(Array.isArray(cancelledRows) ? cancelledRows : []);
      const body = billsRes.data;
      setRows(Array.isArray(body?.data) ? body.data : []);
      const pg = body?.pagination;
      if (pg) setMeta({
        page: pg.page, totalPages: pg.totalPages, total: pg.totalElements,
        from: pg.totalElements === 0 ? 0 : pg.page * pg.size + 1,
        to: Math.min((pg.page + 1) * pg.size, pg.totalElements),
      });
      setTds(Array.isArray(tdsRes?.data?.data) ? tdsRes.data.data : []);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load vendor bills."), "error");
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => { load(); }, [load]);

  const totalTds = tds.reduce((s, r) => s + Number(r.totalTds || 0), 0);

  return (
    <Page icon={ReceiptText} title="Vendor Bills & TDS" crumb="Vendor Bills" subtitle="Payables with TDS withheld under 194C / 194H / 194J"
      actions={<>
        <Btn variant="outline" size="sm" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Btn>
        {canManage && <Btn variant="primary" size="sm" onClick={() => setRaiseOpen(true)}><Plus className="w-4 h-4" /> Raise Bill</Btn>}
      </>}>

      {tds.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          <Hero label="TDS Deducted (FY)" value={totalTds} money gradient="from-rose-500 to-red-600" icon={<Landmark className="w-5 h-5" />} delay={0} />
          {tds.map((r, i) => (
            <Hero key={r.section} label={`${r.sectionLabel} · ${r.billCount} bill${r.billCount === 1 ? "" : "s"}`}
              value={r.totalTds} money gradient={HERO_GRADS[i % HERO_GRADS.length]} icon={<ReceiptText className="w-5 h-5" />} delay={(i + 1) * 60} />
          ))}
        </div>
      )}

      <Panel className="overflow-hidden">
        <PanelHead icon={ReceiptText} title="Payables" count={loading ? null : meta.total} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className={theadCls}>
              <tr>
                <Th>Vendor</Th><Th>Bill #</Th><Th>Date</Th><Th right>Gross</Th><Th right>TDS</Th>
                <Th right>Net Payable</Th><Th right>Balance</Th><Th>Status</Th><Th right>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? <SkeletonRows rows={5} cols={9} />
                : rows.length === 0 ? <EmptyRow colSpan={9} title="No vendor bills yet" hint="Raise a bill against a vendor to track payables and TDS." />
                : rows.map((r, idx) => (
                  <tr key={r.publicId} className="hover:bg-emerald-50/30 transition-colors acc-fade" style={{ animationDelay: `${idx * 25}ms` }}>
                    <td className="px-3 py-3.5 text-sm font-bold text-slate-800">{r.vendorName || "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{r.billNumber || "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{fmtDate(r.billDate)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.grossAmount)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{Number(r.tdsAmount) > 0 ? inr(r.tdsAmount) : "—"}</td>
                    <td className="px-3 py-3.5 text-right text-sm font-extrabold text-slate-800">{inr(r.netPayable)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.balancePayable)}</td>
                    <td className="px-3 py-3.5"><Badge tone={STATUS_TONE[r.status] || "slate"}>{r.status?.replace("_", " ")}</Badge></td>
                    <td className="px-3 py-3.5"><div className="flex items-center justify-end"><IconBtn tone="blue" title="Details" onClick={() => setDetailId(r.publicId)}><Eye className="w-3.5 h-3.5" /></IconBtn></div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} from={meta.from} to={meta.to} onPage={setPage} />
      </Panel>

      {/* ── Exceptions ─────────────────────────────────────────────────────────
          Two lists, both read-only prompts. Neither creates anything: a bill still comes from an
          accountant who knows the section and the invoice number, and a cancelled booking's payable
          is still settled by talking to that supplier. */}
      {unbilled.length > 0 && (
        <Panel className="overflow-hidden">
          <PanelHead icon={AlertTriangle} title="Services with a supplier but no bill" count={unbilled.length} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className={theadCls}>
                <tr>
                  <Th>Booking</Th><Th>Service</Th><Th>Date</Th><Th>Supplier</Th>
                  <Th right>Expected cost</Th><Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unbilled.map((r, idx) => (
                  <tr key={r.serviceItemPublicId} className="hover:bg-amber-50/40 transition-colors acc-fade" style={{ animationDelay: `${idx * 25}ms` }}>
                    <td className="px-3 py-3.5 text-sm font-bold text-slate-800">{r.bookingCode || "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">
                      {r.title || "—"}
                      {r.serviceType && <span className="ml-1.5 text-[11px] font-bold text-slate-400">{r.serviceType}</span>}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{fmtDate(r.serviceDate)}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{r.vendorName || "—"}</td>
                    {/* The operator's figure, not a bill — it seeds the form and nothing else. */}
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{r.vendorCost != null ? inr(r.vendorCost) : "—"}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center justify-end">
                        {canManage && (
                          <Btn variant="outline" size="sm" onClick={() => setRaiseFor(r)}>
                            <Plus className="w-3.5 h-3.5" /> Raise bill
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {cancelledOpen.length > 0 && (
        <Panel className="overflow-hidden">
          <PanelHead icon={AlertTriangle} title="Open payables on cancelled bookings" count={cancelledOpen.length} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className={theadCls}>
                <tr>
                  <Th>Vendor</Th><Th>Booking</Th><Th>Bill #</Th><Th>Date</Th>
                  <Th right>Balance</Th><Th>Status</Th><Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cancelledOpen.map((r, idx) => (
                  <tr key={r.publicId} className="hover:bg-rose-50/40 transition-colors acc-fade" style={{ animationDelay: `${idx * 25}ms` }}>
                    <td className="px-3 py-3.5 text-sm font-bold text-slate-800">{r.vendorName || "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{r.bookingCode || "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{r.billNumber || "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-slate-600">{fmtDate(r.billDate)}</td>
                    <td className="px-3 py-3.5 text-right text-sm font-extrabold text-slate-800">{inr(r.balancePayable)}</td>
                    <td className="px-3 py-3.5"><Badge tone={STATUS_TONE[r.status] || "slate"}>{r.status?.replace("_", " ")}</Badge></td>
                    <td className="px-3 py-3.5"><div className="flex items-center justify-end"><IconBtn tone="blue" title="Details" onClick={() => setDetailId(r.publicId)}><Eye className="w-3.5 h-3.5" /></IconBtn></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {raiseOpen && <RaiseBillModal onClose={() => setRaiseOpen(false)} onDone={() => { setRaiseOpen(false); setPage(0); load(); }} />}
      {raiseFor && <RaiseBillModal prefill={raiseFor} onClose={() => setRaiseFor(null)} onDone={() => { setRaiseFor(null); setPage(0); load(); }} />}
      {detailId && <BillDetailModal publicId={detailId} canManage={canManage} onClose={() => setDetailId(null)} onChanged={load} />}
    </Page>
  );
}

/**
 * @param prefill optional line this bill is being raised for — {@link UnbilledLineResponse} shaped.
 *        When present the bill is filed against that booking AND that service line, which is what
 *        makes "is this hotel billed yet" answerable at all: the API has always accepted the link,
 *        and this modal was the only reason nothing ever sent it.
 */
function RaiseBillModal({ onClose, onDone, prefill = null }) {
  const { showToast } = useToast();
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({
    vendorPublicId: prefill?.vendorPublicId || "",
    billNumber: "", billDate: "",
    description: prefill ? [prefill.bookingCode, prefill.title].filter(Boolean).join(" · ") : "",
    // The operator's expected cost is a starting figure, never the bill — the accountant still
    // types what the vendor actually invoiced.
    grossAmount: prefill?.vendorCost != null ? String(prefill.vendorCost) : "",
    gstInput: "", tdsBase: "", tdsSection: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const res = await vendorService.getAll();
        setVendors(Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : []);
      } catch { /* leave empty */ }
    })();
  }, []);

  const submit = async () => {
    if (!form.vendorPublicId) { showToast("Pick a vendor.", "error"); return; }
    if (!(Number(form.grossAmount) > 0)) { showToast("Gross amount must be greater than zero.", "error"); return; }
    setSaving(true);
    try {
      const res = await accountingService.raiseVendorBill({
        vendorPublicId: form.vendorPublicId, billNumber: form.billNumber || null, billDate: form.billDate || null,
        // Only sent when the bill is being raised against a specific line; a booking-level bill
        // leaves both null, which the API already treats as "not linked".
        bookingPublicId: prefill?.bookingPublicId || null,
        serviceItemPublicId: prefill?.serviceItemPublicId || null,
        description: form.description || null, grossAmount: Number(form.grossAmount),
        gstInput: form.gstInput === "" ? null : Number(form.gstInput),
        tdsBase: form.tdsBase === "" ? null : Number(form.tdsBase), tdsSection: form.tdsSection || null,
      });
      const tdsAmt = res?.data?.data?.tdsAmount;
      showToast(Number(tdsAmt) > 0 ? `Bill raised — TDS ${inr(tdsAmt)} withheld.` : "Bill raised.", "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't raise the bill."), "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal icon={ReceiptText} title="Raise Vendor Bill"
      subtitle={prefill
        ? `Against ${prefill.title || "this service"}${prefill.bookingCode ? ` on ${prefill.bookingCode}` : ""} — TDS from the section and the vendor's PAN`
        : "TDS is computed from the section and the vendor's PAN (206AA 20% if no PAN)"}
      onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Raising…" : "Raise Bill"}</Btn>
      </>}>
      <Field label="Vendor" required>
        <Select value={form.vendorPublicId} onChange={(e) => set("vendorPublicId", e.target.value)}>
          <option value="">Select a vendor…</option>
          {vendors.map((v) => <option key={v.publicId} value={v.publicId}>{v.vendorName}{v.panNumber ? "" : " (no PAN)"}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vendor Bill #"><input className={inputCls} value={form.billNumber} onChange={(e) => set("billNumber", e.target.value)} placeholder="INV-2026-14" /></Field>
        <Field label="Bill Date" hint="Defaults to today"><input type="date" className={inputCls} value={form.billDate} onChange={(e) => set("billDate", e.target.value)} /></Field>
        <Field label="Gross Amount" required><input type="number" min="0" step="0.01" className={inputCls} value={form.grossAmount} onChange={(e) => set("grossAmount", e.target.value)} placeholder="0.00" /></Field>
        <Field label="Input GST" hint="GST embedded in the gross (ITC)"><input type="number" min="0" step="0.01" className={inputCls} value={form.gstInput} onChange={(e) => set("gstInput", e.target.value)} placeholder="0.00" /></Field>
        <Field label="TDS Section">
          <Select value={form.tdsSection} onChange={(e) => set("tdsSection", e.target.value)}>{TDS_SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
        </Field>
        <Field label="TDS Base" hint="Blank → gross − input GST"><input type="number" min="0" step="0.01" className={inputCls} value={form.tdsBase} onChange={(e) => set("tdsBase", e.target.value)} placeholder="auto" disabled={!form.tdsSection} /></Field>
      </div>
      <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ground handling — Bali, Mar 2026" /></Field>
    </Modal>
  );
}

function BillDetailModal({ publicId, canManage, onClose, onChanged }) {
  const { showToast } = useToast();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingService.getVendorBill(publicId);
      setBill(res?.data?.data ?? null);
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load the bill."), "error"); }
    finally { setLoading(false); }
  }, [publicId, showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = () => { fetch(); onChanged?.(); };
  const canAct = canManage && bill && bill.status !== "CANCELLED" && bill.status !== "PAID";

  return (
    <Modal icon={ReceiptText} title={`Vendor Bill${bill?.billNumber ? ` · ${bill.billNumber}` : ""}`} subtitle={bill?.vendorName} onClose={onClose} maxW="max-w-2xl"
      footer={<>
        {canAct && <Btn variant="danger" onClick={() => setCancelOpen(true)}><Ban className="w-4 h-4" /> Cancel Bill</Btn>}
        {canAct && <Btn variant="primary" onClick={() => setPayOpen(true)}><Wallet className="w-4 h-4" /> Record Payment</Btn>}
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </>}>
      {loading || !bill ? <Loading label="Loading…" /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KV label="Status"><Badge tone={STATUS_TONE[bill.status] || "slate"}>{bill.status?.replace("_", " ")}</Badge></KV>
            <KV label="Bill Date" value={fmtDate(bill.billDate)} />
            <KV label="PAN" value={bill.panSnapshot || "—"} />
            <KV label="Gross" value={inr(bill.grossAmount)} />
            <KV label="Input GST" value={inr(bill.gstInput)} />
            <KV label="TDS Section" value={bill.tdsSectionLabel || "—"} />
            <KV label="TDS Base" value={inr(bill.tdsBase)} />
            <KV label={`TDS @ ${bill.tdsRatePct ?? 0}%`} value={inr(bill.tdsAmount)} />
            <KV label="Net Payable" value={inr(bill.netPayable)} strong />
            <KV label="Paid" value={inr(bill.amountPaid)} />
            <KV label="Balance" value={inr(bill.balancePayable)} strong />
          </div>
          {bill.description && <p className="text-sm text-slate-500">{bill.description}</p>}

          <div>
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">Payments</h4>
            {bill.payments?.length ? (
              <div className="divide-y divide-slate-50 rounded-2xl border border-slate-100">
                {bill.payments.map((p) => (
                  <div key={p.publicId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-bold text-slate-800">{inr(p.amount)}</p>
                      <p className="text-xs text-slate-400">{fmtDate(p.paymentDate)} · {p.paymentMethod || "—"}{p.reference ? ` · ${p.reference}` : ""}</p>
                    </div>
                    {Number(p.tdsWithheld) > 0 && <Badge tone="slate">TDS {inr(p.tdsWithheld)}</Badge>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No payments recorded yet.</p>}
          </div>

          {bill.status === "CANCELLED" && bill.cancelReason && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Cancelled: {bill.cancelReason}</p>
          )}
        </>
      )}

      {payOpen && <RecordPaymentModal bill={bill} onClose={() => setPayOpen(false)} onDone={() => { setPayOpen(false); refresh(); }} />}
      {cancelOpen && <CancelBillModal bill={bill} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); refresh(); onClose(); }} />}
    </Modal>
  );
}

function RecordPaymentModal({ bill, onClose, onDone }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ amount: bill?.balancePayable ?? "", paymentDate: "", paymentMethod: "", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!(Number(form.amount) > 0)) { showToast("Amount must be greater than zero.", "error"); return; }
    setSaving(true);
    try {
      await accountingService.payVendorBill(bill.publicId, {
        amount: Number(form.amount), paymentDate: form.paymentDate || null, paymentMethod: form.paymentMethod || null,
        reference: form.reference || null, notes: form.notes || null,
      });
      showToast("Payment recorded.", "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't record the payment."), "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal icon={Wallet} title="Record Payment" subtitle={`Balance payable: ${inr(bill?.balancePayable)}`} onClose={onClose} maxW="max-w-md"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Btn>
      </>}>
      <Field label="Amount" required><input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date" hint="Defaults to today"><input type="date" className={inputCls} value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} /></Field>
        <Field label="Method"><input className={inputCls} value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} placeholder="NEFT / UPI / Cash" /></Field>
      </div>
      <Field label="Reference"><input className={inputCls} value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="UTR / cheque no." /></Field>
      <Field label="Notes"><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function CancelBillModal({ bill, onClose, onDone }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) { showToast("A reason is required.", "error"); return; }
    setBusy(true);
    try {
      await accountingService.cancelVendorBill(bill.publicId, reason.trim());
      showToast("Bill cancelled.", "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't cancel."), "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal icon={Ban} title="Cancel this bill?" subtitle="Cancelling reverses the payable. This cannot be undone." onClose={onClose}
      maxW="max-w-md" gradient="from-red-500 to-rose-600"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Keep</Btn>
        <Btn variant="danger" onClick={submit} disabled={busy}>{busy ? "Cancelling…" : "Cancel Bill"}</Btn>
      </>}>
      <Field label="Reason" required><textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}