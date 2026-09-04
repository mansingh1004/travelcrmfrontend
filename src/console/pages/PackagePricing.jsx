// src/console/pages/PackagePricing.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The platform's markup on PACKAGES — the third supply line to get one.
//
// ── What makes this different from the hotel and transport rule screens ──────
// Two things, and both come from the domain rather than from taste.
//
// 1. THREE levels of scope, not two. A hotel rule is either that hotel's or
//    global. A package can also be scoped to ONE TIER, because a Basic and a
//    Luxury cut of the same itinerary do not carry the same margin — one rule
//    across both either under-prices the luxury tier or over-prices the basic
//    one. So the list groups Tier → Package → Catalog default, which is exactly
//    the order the resolver reads them in.
//
// 2. A rule here FILLS A GAP; it does not restate a price. A slab with a typed
//    per-pax price keeps it and no rule is consulted. Only a slab authored as
//    cost-only is priced by these rules. That is stated on the screen, because
//    an operator who creates a 20% rule and sees no price move would otherwise
//    conclude the feature is broken.
//
// SuperAdmin only, and every write is step-up gated — editing a margin is not a
// routine save.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Info, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";

import { getErrorMessage } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

import { ConsolePageHeader } from "../components/ConsoleUi";
import { useStepUp } from "../components/useStepUp";
import { packagePricingService as svc } from "../api/packagePricingService";
import { platformPackageService } from "../api/platformPackageService";

const BLANK = {
  packagePublicId: "",
  variantPublicId: "",
  label: "",
  commercialModel: "NET_RATE_MARKUP",
  calculationType: "PERCENTAGE",
  value: "",
  currency: "INR",
  validFrom: "",
  validTo: "",
  priority: 0,
  active: true,
  notes: "",
};

/* The order the resolver reads them in, so the screen and the server tell the same story. */
const TIERS = [
  { id: "TIER", label: "Tier rules", hint: "One tier of one package. Most specific — these win first." },
  { id: "PACKAGE", label: "Package rules", hint: "Every tier of one package." },
  { id: "GLOBAL", label: "Catalog default", hint: "Every package without a rule of its own." },
];

const FIELD =
  "w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-body outline-none " +
  "focus:ring-2 focus:ring-focus";

function valueSuffix(calculationType, currency) {
  if (calculationType === "PERCENTAGE") return "%";
  return currency || "INR";
}

export default function PackagePricing({ embedded = false }) {
  const [rows, setRows] = useState(null);
  const [packages, setPackages] = useState([]);
  const [options, setOptions] = useState({ commercialModels: [], calculationTypes: [] });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const stepUp = useStepUp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await svc.list());
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load package pricing rules."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    svc.options()
      .then((o) => { if (alive) setOptions({ commercialModels: o.commercialModels ?? [], calculationTypes: o.calculationTypes ?? [] }); })
      .catch(() => { /* the selects fall back to the two defaults in BLANK */ });
    /* The package picker. A failure here degrades the form to "every package" only, which is still
       a usable rule — so it is caught rather than surfaced. */
    platformPackageService.list({ page: 0, size: 200 })
      .then((res) => { if (alive) setPackages(res?.rows ?? res?.items ?? []); })
      .catch(() => { /* picker degrades to the catalog default only */ });
    return () => { alive = false; };
  }, []);

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(TIERS.map((t) => [t.id, []]));
    // Pushed in the order the server sent — specificity, then priority, then newest — so each
    // bucket keeps the precedence the resolver will actually apply.
    (rows ?? []).forEach((r) => { (buckets[r.scope] ?? buckets.GLOBAL).push(r); });
    return buckets;
  }, [rows]);

  const hasGlobal = (grouped.GLOBAL ?? []).length > 0;

  const askDelete = (rule) =>
    stepUp.request({
      title: "Delete pricing rule",
      description: rule.scope === "GLOBAL"
        ? "This removes the catalog default. Packages with no rule of their own fall through to the configured default markup, and every price produced that way is flagged as a fallback until a new default exists."
        : `This removes the rule for ${rule.packageTitle || "this package"}${rule.variantName ? ` / ${rule.variantName}` : ""}. Future pricing resolves to the next rule down the order below.`,
      confirmLabel: "Delete rule",
      run: async (mfaCode) => {
        await svc.remove(rule.publicId, mfaCode);
        toast.success("Rule deleted.");
        load();
      },
    });

  const save = (draft) =>
    stepUp.request({
      title: draft.publicId ? "Update pricing rule" : "Create pricing rule",
      description: "This changes what agencies are charged for packages priced by this rule.",
      confirmLabel: draft.publicId ? "Save rule" : "Create rule",
      run: async (mfaCode) => {
        const payload = {
          packagePublicId: draft.packagePublicId || null,
          variantPublicId: draft.variantPublicId || null,
          label: draft.label?.trim() || null,
          commercialModel: draft.commercialModel,
          calculationType: draft.calculationType,
          value: Number(draft.value),
          currency: draft.currency || "INR",
          validFrom: draft.validFrom || null,
          validTo: draft.validTo || null,
          priority: Number(draft.priority) || 0,
          active: draft.active,
          notes: draft.notes?.trim() || null,
        };
        if (draft.publicId) await svc.update(draft.publicId, payload, mfaCode);
        else await svc.create(payload, mfaCode);
        toast.success(draft.publicId ? "Rule saved." : "Rule created.");
        setEditing(null);
        load();
      },
    });

  const actions = (
    <>
      <button type="button" onClick={load} disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Refresh
      </button>
      <button type="button" onClick={() => setEditing({ ...BLANK })}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover">
        <Plus className="h-4 w-4" /> New rule
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      ) : (
        <ConsolePageHeader
          eyebrow="Package marketplace"
          title="Package pricing"
          description="What the platform adds on top of an agency's net cost for a package. A rule can cover one tier, one package, or the whole catalog."
          actions={actions}
        />
      )}

      {/* Said once, prominently, because it is the thing that surprises people: a rule does not
          move a price somebody typed. Without this an operator creates a 20% rule, sees nothing
          change on the packages they are looking at, and reasonably concludes it is broken. */}
      <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-hover px-4 py-3 text-sm text-body">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span>
          These rules price a slab that was authored as <span className="font-semibold">cost only</span>.
          A price slab with a per-pax price already typed keeps that price, and no rule is applied
          to it — so creating a rule never re-prices a package that is already selling.
        </span>
      </p>

      {rows !== null && !hasGlobal && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-body">
          <span className="font-semibold">No catalog default is configured.</span>{" "}
          Cost-only slabs on packages without a rule fall through to the configured default markup,
          and every price produced that way is flagged as a fallback.
        </p>
      )}

      {loading && rows === null ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" /></div>
      ) : (
        TIERS.map((tier) => (
          <section key={tier.id}
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-heading">{tier.label}</h2>
                <p className="mt-0.5 text-xs text-muted">{tier.hint}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-semibold text-muted">
                {(grouped[tier.id] ?? []).length}
              </span>
            </div>

            {(grouped[tier.id] ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {grouped[tier.id].map((r) => (
                  <li key={r.publicId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-heading">{r.label}</span>
                        {!r.active && (
                          <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {r.packageTitle ?? "Every package"}
                        {r.variantName ? ` · ${r.variantName}` : ""}
                        {" · "}{r.commercialModelLabel}
                        {" · "}{r.calculationTypeLabel}
                        {(r.validFrom || r.validTo) && (
                          <> {" · "}{r.validFrom ?? "open"} → {r.validTo ?? "open"}</>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-bold tabular-nums text-heading">
                        {r.value}{valueSuffix(r.calculationType, r.currency)}
                      </div>
                      <div className="text-[11px] text-muted">priority {r.priority}</div>
                    </div>

                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" title="Edit"
                        onClick={() => setEditing({
                          publicId: r.publicId,
                          packagePublicId: r.packagePublicId ?? "",
                          variantPublicId: r.variantPublicId ?? "",
                          label: r.label ?? "",
                          commercialModel: r.commercialModel,
                          calculationType: r.calculationType,
                          value: r.value ?? "",
                          currency: r.currency ?? "INR",
                          validFrom: r.validFrom ?? "",
                          validTo: r.validTo ?? "",
                          priority: r.priority ?? 0,
                          active: r.active,
                          notes: r.notes ?? "",
                        })}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-heading">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" title="Delete" onClick={() => askDelete(r)}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-hue-rose-soft hover:text-hue-rose">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {editing && (
        <RuleDialog
          draft={editing}
          packages={packages}
          options={options}
          busy={stepUp.busy}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => save(editing)}
        />
      )}

      {stepUp.dialog}
    </div>
  );
}

function RuleDialog({ draft, packages, options, busy, onChange, onClose, onSave }) {
  const set = (patch) => onChange({ ...draft, ...patch });

  const selected = packages.find((p) => p.publicId === draft.packagePublicId);
  const variants = selected?.variants ?? [];

  const valueInvalid = draft.value === "" || Number.isNaN(Number(draft.value)) || Number(draft.value) < 0;
  const datesInvalid = draft.validFrom && draft.validTo && draft.validTo < draft.validFrom;
  const invalid = valueInvalid || datesInvalid;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface shadow-[var(--sa-card-shadow)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-bold text-heading">{draft.publicId ? "Edit pricing rule" : "New pricing rule"}</h3>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-body">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="text-xs font-semibold text-body">Package</span>
            <select className={`mt-1 ${FIELD}`} value={draft.packagePublicId}
              onChange={(e) => set({ packagePublicId: e.target.value, variantPublicId: "" })}>
              <option value="">Every package (catalog default)</option>
              {packages.map((p) => (
                <option key={p.publicId} value={p.publicId}>{p.title}</option>
              ))}
            </select>
          </label>

          {/* Only offered once a package is chosen. A tier rule without its package cannot be
              resolved, and the server rejects that combination rather than guessing the parent. */}
          {draft.packagePublicId && variants.length > 0 && (
            <label className="block">
              <span className="text-xs font-semibold text-body">Tier</span>
              <select className={`mt-1 ${FIELD}`} value={draft.variantPublicId}
                onChange={(e) => set({ variantPublicId: e.target.value })}>
                <option value="">Every tier of this package</option>
                {variants.map((v) => (
                  <option key={v.publicId} value={v.publicId}>{v.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-body">Model</span>
              <select className={`mt-1 ${FIELD}`} value={draft.commercialModel}
                onChange={(e) => set({ commercialModel: e.target.value })}>
                {(options.commercialModels.length
                  ? options.commercialModels
                  : [{ value: "NET_RATE_MARKUP", label: "Net rate + markup" }]
                ).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-body">Calculation</span>
              <select className={`mt-1 ${FIELD}`} value={draft.calculationType}
                onChange={(e) => set({ calculationType: e.target.value })}>
                {(options.calculationTypes.length
                  ? options.calculationTypes
                  : [{ value: "PERCENTAGE", label: "Percentage of cost" }]
                ).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-body">
                Value {draft.calculationType === "PERCENTAGE" ? "(%)" : `(${draft.currency || "INR"})`}
              </span>
              <input type="number" min="0" step="0.01" className={`mt-1 ${FIELD}`} value={draft.value}
                onChange={(e) => set({ value: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-body">Priority</span>
              <input type="number" className={`mt-1 ${FIELD}`} value={draft.priority}
                onChange={(e) => set({ priority: e.target.value })} />
              {/* Said here because it is the rule people get wrong: priority does NOT let a broad
                  rule beat a narrow one. */}
              <span className="mt-1 block text-[11px] text-muted">
                Breaks ties within one scope only — a catalog rule never outranks a package rule.
              </span>
            </label>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-body">Valid from</span>
              <input type="date" className={`mt-1 ${FIELD}`} value={draft.validFrom}
                onChange={(e) => set({ validFrom: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-body">Valid to</span>
              <input type="date" className={`mt-1 ${FIELD}`} value={draft.validTo}
                onChange={(e) => set({ validTo: e.target.value })} />
            </label>
          </div>
          <p className="text-[11px] text-muted">
            Matched against the departure date, not today — a rule expiring next week must not price
            a departure three months out.
          </p>

          <label className="block">
            <span className="text-xs font-semibold text-body">Label</span>
            <input className={`mt-1 ${FIELD}`} value={draft.label} placeholder="Optional — one is generated"
              onChange={(e) => set({ label: e.target.value })} />
          </label>

          <label className="flex items-center gap-2 text-sm text-body">
            <input type="checkbox" checked={draft.active}
              onChange={(e) => set({ active: e.target.checked })} />
            Active
          </label>

          {datesInvalid && (
            <p className="text-xs font-semibold text-hue-rose">Valid-to is before valid-from.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={invalid || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {draft.publicId ? "Save rule" : "Create rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
