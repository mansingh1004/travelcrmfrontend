import { useCallback, useEffect, useState } from "react";
import { Settings, Save, Plus, Pencil, Trash2, Star, Percent, ShieldCheck, ReceiptText } from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { isAlreadyReported, getErrorMessage } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import {
  Page, Panel, PanelHead, Badge, Btn, IconBtn, Modal, Field, Select, Toggle, Loading,
  theadCls, Th, EmptyRow, inputCls,
} from "../components/accountingUi";
import accountingService from "../api/accountingService";
import { pct } from "../lib/format";

const SCHEMES = [
  { value: "REGULAR", label: "Regular — issues GST Tax Invoices (CGST/SGST/IGST)" },
  { value: "COMPOSITION", label: "Composition — Bill of Supply, no tax charged" },
  { value: "UNREGISTERED", label: "Unregistered — plain non-GST invoices only" },
];

const TCS_MODES = [
  { value: "NEVER", label: "Never — domestic-only, or TCS handled outside this system" },
  { value: "OVERSEAS_ONLY", label: "Overseas packages only — matches the statute" },
  { value: "ALWAYS", label: "Every booking — legacy behaviour, rarely correct" },
];

/** Empty string must reach the server as null, or a cleared box would post NaN and 400. */
const num = (v) => (v === "" || v == null ? null : Number(v));

export default function AccountingSettings() {
  const { showToast } = useToast();
  const canManage = hasPermission(P.ACCOUNTING_SETTINGS_MANAGE);

  const [settings, setSettings] = useState(null);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editRate, setEditRate] = useState(null);
  const [deleteRate, setDeleteRate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([accountingService.getSettings(), accountingService.getHsnRates()]);
      setSettings(sRes?.data?.data ?? null);
      setRates(Array.isArray(rRes?.data?.data) ? rRes.data.data : []);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load settings."), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const saveSettings = async () => {
    setSaving(true);
    try {
      // The server applies each field only when it is non-null, so sending the whole shape is
      // safe — but the reverse was the bug this section fixes: the page used to post only the
      // four registration fields, so the booking tax rates below existed on the server, drove
      // every booking's total, and could not be changed from anywhere in the product.
      await accountingService.updateSettings({
        gstScheme: settings.gstScheme, autoTcsOnOverseas: settings.autoTcsOnOverseas,
        roundInvoiceTotal: settings.roundInvoiceTotal, inputTaxCreditEligible: settings.inputTaxCreditEligible,

        applyGstOnBookings: settings.applyGstOnBookings,
        bookingGstRatePct: num(settings.bookingGstRatePct),
        gstInclusiveOnBookings: settings.gstInclusiveOnBookings,
        tcsApplicability: settings.tcsApplicability,
        bookingTcsRatePct: num(settings.bookingTcsRatePct),
      });
      showToast("Settings saved.", "success");
      load();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't save settings."), "error"); }
    finally { setSaving(false); }
  };

  return (
    <Page icon={Settings} title="Accounting Settings" crumb="Settings" subtitle="GST registration scheme and the HSN/SAC rate master">
      {loading ? <Panel><Loading label="Loading…" /></Panel> : (
        <>
          {settings && (
            <Panel className="p-5">
              <h3 className="mb-4 text-sm font-extrabold text-slate-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> GST Registration</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Field label="GST Scheme" hint="Decides whether this agency can raise a GST Tax Invoice at all.">
                  <Select value={settings.gstScheme} onChange={(e) => set("gstScheme", e.target.value)} disabled={!canManage}>
                    {SCHEMES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Field>
                <div className="flex flex-wrap items-center gap-2 pt-6">
                  <Badge tone={settings.canIssueTaxInvoice ? "green" : "amber"}>{settings.canIssueTaxInvoice ? "Can issue Tax Invoices" : "Cannot issue Tax Invoices"}</Badge>
                  <Badge tone="slate">GSTIN: {settings.supplierGstin || "not set"}</Badge>
                  {settings.supplierStateCode && <Badge tone="slate">State {settings.supplierStateCode}</Badge>}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Toggle label="Auto-TCS on overseas packages" hint="Apply 206C(1G) automatically" checked={settings.autoTcsOnOverseas} disabled={!canManage} onChange={(v) => set("autoTcsOnOverseas", v)} />
                <Toggle label="Round invoice total" hint="Round off to the nearest rupee" checked={settings.roundInvoiceTotal} disabled={!canManage} onChange={(v) => set("roundInvoiceTotal", v)} />
                <Toggle label="Input Tax Credit eligible" hint="Treat vendor GST as recoverable ITC" checked={settings.inputTaxCreditEligible} disabled={!canManage} onChange={(v) => set("inputTaxCreditEligible", v)} />
              </div>

              {/* ── Booking tax defaults ──────────────────────────────────────────────
                  What a NEW booking is charged before anyone overrides it. These already
                  drove every booking's total — BookingTaxCalculator reads them off this row
                  — but nothing in the product could edit them, so a tenant was stuck on 5%
                  whatever their business model. An individual booking can still say
                  otherwise; this is only the starting point. */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <h3 className="mb-1 text-sm font-extrabold text-slate-700 flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-emerald-500" /> Booking Tax Defaults
                </h3>
                <p className="mb-4 text-xs text-slate-400">
                  Applied to new bookings. Any single booking can still override them on its own money panel.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Field
                    label="Booking GST rate %"
                    hint="Tour operator packages (SAC 998552) are 5% without ITC. A pure commission/service-fee model is a different rate — your CA's call, not this screen's."
                  >
                    <input
                      type="number" min="0" max="100" step="0.01" className={inputCls}
                      value={settings.bookingGstRatePct ?? ""}
                      disabled={!canManage || !settings.applyGstOnBookings}
                      onChange={(e) => set("bookingGstRatePct", e.target.value)}
                    />
                  </Field>

                  <Field label="TCS on bookings" hint="Section 206C(1G) / s.394(1). A domestic-only operator collects none.">
                    <Select
                      value={settings.tcsApplicability ?? "ALWAYS"}
                      disabled={!canManage}
                      onChange={(e) => set("tcsApplicability", e.target.value)}
                    >
                      {TCS_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                  </Field>

                  <Field label="Booking TCS rate %" hint="Ignored when TCS is set to Never.">
                    <input
                      type="number" min="0" max="100" step="0.01" className={inputCls}
                      value={settings.bookingTcsRatePct ?? ""}
                      disabled={!canManage || settings.tcsApplicability === "NEVER"}
                      onChange={(e) => set("bookingTcsRatePct", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle
                    label="Charge GST on bookings"
                    hint="Turn off if you are not GST-registered, or you quote net"
                    checked={!!settings.applyGstOnBookings} disabled={!canManage}
                    onChange={(v) => set("applyGstOnBookings", v)}
                  />
                  <Toggle
                    label="Prices are GST-inclusive"
                    hint="The amount typed is the all-in price; GST is back-derived out of it"
                    checked={!!settings.gstInclusiveOnBookings} disabled={!canManage}
                    onChange={(v) => set("gstInclusiveOnBookings", v)}
                  />
                </div>

                {!settings.applyGstOnBookings && (
                  <p className="mt-3 text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
                    GST is off — new bookings will show no GST at all, whatever the rate above says.
                  </p>
                )}
              </div>

              {canManage && <div className="mt-5 flex justify-end"><Btn variant="primary" onClick={saveSettings} disabled={saving}><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}</Btn></div>}
            </Panel>
          )}

          <Panel className="overflow-hidden">
            <PanelHead icon={Percent} title="HSN/SAC Rate Master" count={rates.length}
              right={canManage && <Btn variant="primary" size="sm" onClick={() => setEditRate({})}><Plus className="w-4 h-4" /> Add Rate</Btn>} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className={theadCls}>
                  <tr>
                    <Th>Code</Th><Th>Description</Th><Th>Category</Th><Th right>GST</Th><Th right>Cess</Th>
                    <Th>ITC</Th><Th>Flags</Th>{canManage && <Th right>Actions</Th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rates.length === 0 ? <EmptyRow colSpan={canManage ? 8 : 7} icon="％" title="No rates configured" hint="The default 998552 @ 5% (no ITC) is seeded on first invoice." />
                    : rates.map((r) => (
                      <tr key={r.publicId} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-3 py-3.5 text-sm font-extrabold text-slate-800">{r.code}</td>
                        <td className="px-3 py-3.5 text-sm text-slate-600 max-w-[220px] truncate">{r.description || "—"}</td>
                        <td className="px-3 py-3.5 text-sm text-slate-500">{r.category || "—"}</td>
                        <td className="px-3 py-3.5 text-right text-sm font-semibold text-slate-700">{pct(r.gstRatePct)}</td>
                        <td className="px-3 py-3.5 text-right text-sm text-slate-600">{Number(r.cessPct) > 0 ? pct(r.cessPct) : "—"}</td>
                        <td className="px-3 py-3.5"><Badge tone={r.itcEligible ? "green" : "slate"}>{r.itcEligible ? "Yes" : "No"}</Badge></td>
                        <td className="px-3 py-3.5">
                          <div className="flex gap-1.5">
                            {r.isDefault && <Badge tone="blue"><Star className="w-3 h-3" /> Default</Badge>}
                            {!r.active && <Badge tone="red">Inactive</Badge>}
                          </div>
                        </td>
                        {canManage && (
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <IconBtn tone="amber" title="Edit" onClick={() => setEditRate(r)}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                              <IconBtn tone="red" title="Delete" onClick={() => setDeleteRate(r)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {editRate && <RateModal row={editRate.publicId ? editRate : null} onClose={() => setEditRate(null)} onDone={() => { setEditRate(null); load(); }} />}
      {deleteRate && <DeleteRateModal row={deleteRate} onClose={() => setDeleteRate(null)} onDone={() => { setDeleteRate(null); load(); }} />}
    </Page>
  );
}

function RateModal({ row, onClose, onDone }) {
  const { showToast } = useToast();
  const isEdit = !!row;
  const [form, setForm] = useState({
    code: row?.code ?? "", description: row?.description ?? "", category: row?.category ?? "",
    gstRatePct: row?.gstRatePct ?? "5", cessPct: row?.cessPct ?? "0",
    itcEligible: row?.itcEligible ?? false, isDefault: row?.isDefault ?? false, active: row?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.code.trim()) { showToast("Code is required.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(), description: form.description || null, category: form.category || null,
        gstRatePct: Number(form.gstRatePct), cessPct: Number(form.cessPct || 0),
        itcEligible: form.itcEligible, isDefault: form.isDefault, active: form.active,
      };
      if (isEdit) await accountingService.updateHsnRate(row.publicId, payload);
      else await accountingService.createHsnRate(payload);
      showToast(isEdit ? "Rate updated." : "Rate added.", "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't save the rate."), "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal icon={Percent} title={isEdit ? "Edit Rate" : "Add HSN/SAC Rate"} subtitle="Travel services usually fall under SAC 9985 (e.g. 998552 tour operator @ 5%)" onClose={onClose} maxW="max-w-lg"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save" : "Add Rate"}</Btn>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="HSN/SAC Code" required><input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="998552" maxLength={12} /></Field>
        <Field label="Category"><input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Tour operator" /></Field>
        <Field label="GST Rate %" required><input type="number" min="0" max="100" step="0.01" className={inputCls} value={form.gstRatePct} onChange={(e) => set("gstRatePct", e.target.value)} /></Field>
        <Field label="Cess %"><input type="number" min="0" max="100" step="0.01" className={inputCls} value={form.cessPct} onChange={(e) => set("cessPct", e.target.value)} /></Field>
      </div>
      <Field label="Description"><input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Tour operator services" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Toggle label="ITC eligible" checked={form.itcEligible} onChange={(v) => set("itcEligible", v)} />
        <Toggle label="Default rate" checked={form.isDefault} onChange={(v) => set("isDefault", v)} />
        <Toggle label="Active" checked={form.active} onChange={(v) => set("active", v)} />
      </div>
    </Modal>
  );
}

function DeleteRateModal({ row, onClose, onDone }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await accountingService.deleteHsnRate(row.publicId);
      showToast("Rate removed.", "success");
      onDone();
    } catch (e) { if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't delete."), "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal icon={Trash2} title={`Remove rate ${row.code}?`} subtitle="Existing invoices keep their frozen rate — only future invoices are affected" onClose={onClose}
      maxW="max-w-md" gradient="from-red-500 to-rose-600"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Keep</Btn>
        <Btn variant="danger" onClick={submit} disabled={busy}>{busy ? "Removing…" : "Remove"}</Btn>
      </>}>
      <p className="text-sm text-slate-500">This removes <span className="font-bold text-slate-700">{row.code}</span> from the rate master.</p>
    </Modal>
  );
}