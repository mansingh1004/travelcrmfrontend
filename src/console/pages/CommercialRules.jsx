// src/console/pages/CommercialRules.jsx
//
// ⚠ THE PLATFORM'S MARGIN STRUCTURE. SuperAdmin only, and there is no tenant counterpart: a tenant
// who could read a rule could compute the platform's cut on every booking against that hotel.
//
// WHY RULES EXIST. Before them, `supplierTotal` and `tenantPayable` were typed by hand on every
// approval, so the margin lived in the operator's memory — the same hotel could be sold to two
// tenants at two margins for no reason anyone could reconstruct. Worse, no price could be shown to a
// tenant BEFORE approval, because there was nothing to compute one from. That is what made the
// marketplace commercially unusable: a tenant cannot quote their own customer against a number they
// will not learn until tomorrow.
//
// EDITING A RULE REPRICES THE FUTURE, NOT THE PAST. Bookings carry their agreed amounts and the rule
// that produced them, so a March edit cannot restate what was earned in January. Every write here is
// platform-audited for the same reason: the change is the event, not the price.
//
// THE TWO MODELS ARE NOT TWO WAYS OF WRITING THE SAME SUM — they differ in what the hotel's rate
// card MEANS. Under net-rate-markup it is what the platform pays; under hotel-paid-commission it is
// the hotel's gross, and the platform's cut comes out of it. Get it backwards on a commission hotel
// and the tenant is charged a markup on top of a commission the hotel is already paying.
//
// STYLING: console realm. Semantic utilities only.

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Percent, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { commercialRuleService as svc } from "../api/marketplaceAdminService";
import { platformHotelService } from "../api/platformHotelService";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus";

const BLANK = {
  hotelPublicId: "", label: "", commercialModel: "NET_RATE_MARKUP",
  calculationType: "PERCENTAGE", value: "10", currency: "INR",
  validFrom: "", validTo: "", priority: 0, active: true, notes: "",
};

export default function CommercialRules() {
  const { showToast } = useToast();

  const [rows, setRows] = useState(null);
  const [options, setOptions] = useState({ commercialModels: [], calculationTypes: [] });
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);   // BLANK-shaped draft, or an existing rule

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, opts] = await Promise.all([
        svc.list(),
        // Vocabularies from the server, never hardcoded here — see the service's note on drift.
        svc.options().catch(() => ({})),
      ]);
      setRows(list);
      setOptions({
        commercialModels: opts.commercialModels ?? [],
        calculationTypes: opts.calculationTypes ?? [],
      });
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load commercial rules."), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // The hotel picker. Best-effort and non-blocking: without it a rule can still be created as a
  // global fallback, which is the more common case anyway.
  useEffect(() => {
    let alive = true;
    platformHotelService.list({ page: 0, size: 200 })
      .then((r) => { if (alive) setHotels(r.items ?? r ?? []); })
      .catch(() => { /* the picker degrades to "All hotels" only */ });
    return () => { alive = false; };
  }, []);

  const remove = async (rule) => {
    try {
      await svc.remove(rule.publicId);
      showToast("Rule deleted.", "success");
      load();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not delete the rule."), "error");
    }
  };

  const globals = (rows ?? []).filter((r) => r.global);
  const perHotel = (rows ?? []).filter((r) => !r.global);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-heading">Commercial rules</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            What the platform adds on top of, or takes out of, a hotel's rate. A hotel with no rule
            of its own is priced by the global fallback.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <button type="button" onClick={() => setEditing({ ...BLANK })}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover">
            <Plus className="h-4 w-4" /> New rule
          </button>
        </div>
      </header>

      {rows !== null && globals.length === 0 && (
        <p className="rounded-xl border border-border bg-surface-hover px-4 py-3 text-sm text-body">
          <span className="font-semibold">No global fallback is configured.</span>{" "}
          Hotels without a rule of their own are priced by the built-in default from
          <code className="mx-1 rounded bg-surface px-1 py-0.5 text-xs">app.marketplace.pricing.default-markup-percent</code>
          — which works, but nobody chose it. Create a global rule to make the margin deliberate.
        </p>
      )}

      <RuleTable title="Global fallback" rows={globals} loading={loading && rows === null}
                 onEdit={setEditing} onDelete={remove}
                 empty="No global rule — the configured default applies." />

      <RuleTable title="Per hotel" rows={perHotel} loading={loading && rows === null}
                 onEdit={setEditing} onDelete={remove}
                 empty="No hotel has its own rule yet." />

      {editing && (
        <RuleDialog
          rule={editing} options={options} hotels={hotels}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function RuleTable({ title, rows, loading, empty, onEdit, onDelete }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !rows.length ? (
          <p className="px-4 py-6 text-sm text-muted">{empty}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Rule</th>
                <th className="px-4 py-2 text-left font-semibold">Model</th>
                <th className="px-4 py-2 text-right font-semibold">Value</th>
                <th className="px-4 py-2 text-left font-semibold">Valid</th>
                <th className="px-4 py-2 text-right font-semibold">Priority</th>
                <th className="px-4 py-2 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.publicId} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-heading">{r.label}</p>
                    <p className="text-xs text-muted">
                      {r.hotelName || "All hotels without their own rule"}
                      {!r.active && <span className="ml-2 text-hue-rose">Inactive</span>}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-body">{r.commercialModelLabel}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-heading">
                    {r.calculationType === "PERCENTAGE" ? `${r.value}%` : `${r.currency} ${r.value}`}
                    <span className="block text-[10px] font-normal text-muted">{r.calculationTypeLabel}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {r.validFrom || r.validTo
                      ? `${r.validFrom || "any"} → ${r.validTo || "open"}`
                      : "Always"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-body">{r.priority}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => onEdit(r)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover">
                        Edit
                      </button>
                      <button onClick={() => onDelete(r)} aria-label="Delete rule"
                        className="rounded-lg border border-border px-2 py-1.5 text-hue-rose hover:bg-hue-rose-soft">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function RuleDialog({ rule, options, hotels, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    ...BLANK, ...rule,
    hotelPublicId: rule.hotelPublicId ?? "",
    value: rule.value ?? "10",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const value = Number(form.value);
  const isPct = form.calculationType === "PERCENTAGE";
  // Mirrors the server's own check. Above 100 on a commission model drives the supplier total
  // negative — i.e. records that the hotel pays the platform to take the booking.
  const invalid = !Number.isFinite(value) || value < 0 || (isPct && value > 100);
  const datesInvalid = form.validFrom && form.validTo && form.validTo < form.validFrom;

  const save = async () => {
    setBusy(true);
    const payload = {
      hotelPublicId: form.hotelPublicId || undefined,
      label: form.label?.trim() || undefined,
      commercialModel: form.commercialModel,
      calculationType: form.calculationType,
      value,
      currency: form.currency || "INR",
      validFrom: form.validFrom || undefined,
      validTo: form.validTo || undefined,
      priority: Number(form.priority) || 0,
      active: !!form.active,
      notes: form.notes?.trim() || undefined,
    };
    try {
      if (rule.publicId) await svc.update(rule.publicId, payload);
      else await svc.create(payload);
      showToast(rule.publicId ? "Rule updated." : "Rule created.", "success");
      onSaved();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not save the rule."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-base font-bold text-heading">
            {rule.publicId ? "Edit commercial rule" : "New commercial rule"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-body">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Applies to"
                 hint="Leave as All hotels for the global fallback — a hotel's own rule always wins over it.">
            <select className={inputCls} value={form.hotelPublicId}
                    onChange={(e) => set({ hotelPublicId: e.target.value })}>
              <option value="">All hotels (global fallback)</option>
              {hotels.map((h) => (
                <option key={h.publicId} value={h.publicId}>{h.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Model" hint="What the hotel's rate card means — read the two carefully, they invert.">
            <select className={inputCls} value={form.commercialModel}
                    onChange={(e) => set({ commercialModel: e.target.value })}>
              {options.commercialModels.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {form.commercialModel === "HOTEL_PAID_COMMISSION"
                ? "The rate card is the hotel's GROSS. The tenant pays that; the platform's cut comes out of it."
                : "The rate card is what the platform PAYS. The tenant pays that plus the markup below."}
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Calculation">
              <select className={inputCls} value={form.calculationType}
                      onChange={(e) => set({ calculationType: e.target.value })}>
                {options.calculationTypes.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label={isPct ? "Percent" : "Amount"}>
              <div className="relative">
                <input type="number" min="0" step="0.01" className={inputCls} value={form.value}
                       onChange={(e) => set({ value: e.target.value })} />
                {isPct && <Percent className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />}
              </div>
            </Field>
          </div>

          {invalid && (
            <p className="rounded-lg bg-hue-rose-soft px-3 py-2 text-[11px] text-hue-rose">
              {isPct && value > 100
                ? "A percentage above 100 is not a valid rule — on a commission model it would make the supplier total negative."
                : "Value cannot be negative."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid from" hint="Matched against CHECK-IN, not today.">
              <input type="date" className={inputCls} value={form.validFrom}
                     onChange={(e) => set({ validFrom: e.target.value })} />
            </Field>
            <Field label="Valid to">
              <input type="date" className={inputCls} value={form.validTo}
                     onChange={(e) => set({ validTo: e.target.value })} />
            </Field>
          </div>
          {datesInvalid && (
            <p className="rounded-lg bg-hue-rose-soft px-3 py-2 text-[11px] text-hue-rose">
              Valid-to is before valid-from.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Label" hint="What you will recognise it by later.">
              <input className={inputCls} maxLength={150} value={form.label}
                     onChange={(e) => set({ label: e.target.value })} placeholder="Goa monsoon 12%" />
            </Field>
            <Field label="Priority" hint="Higher wins among equally specific rules.">
              <input type="number" className={inputCls} value={form.priority}
                     onChange={(e) => set({ priority: e.target.value })} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea rows={2} className={inputCls} value={form.notes}
                      onChange={(e) => set({ notes: e.target.value })}
                      placeholder="Who agreed this, and when to revisit it" />
          </Field>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.active}
                   onChange={(e) => set({ active: e.target.checked })}
                   className="h-3.5 w-3.5 accent-current" />
            <span className="text-xs font-semibold text-body">Active</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={save} disabled={invalid || datesInvalid || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </label>
  );
}
