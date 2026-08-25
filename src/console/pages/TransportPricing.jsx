// src/console/pages/TransportPricing.jsx
//
// ⚠ THE PLATFORM'S MARGIN STRUCTURE FOR TRANSPORT. SuperAdmin only, and there is no tenant
// counterpart: an agency who could read a rule could compute the platform's cut on every journey
// they book against that vehicle, and from that what the operator is paid.
//
// WHY RULES EXIST. Before them, `supplierAmount` and `tenantPayable` were typed by hand on every
// approval, so the margin lived in the operator's memory and no price could be shown to an agency
// BEFORE approval, because there was nothing to compute one from. An agency cannot quote their own
// customer against a number they will not learn until tomorrow — that is what made the transport
// marketplace commercially unusable.
//
// WHAT MAKES THIS SCREEN DIFFERENT FROM THE HOTEL ONE. A hotel rule is scoped on one axis: the
// property. A transport rule is scoped on TWO — the vehicle AND the journey type — because the same
// Innova earns a different margin on a ₹900 airport transfer than on a six-day outstation tour.
// Overlapping rules are therefore normal rather than a mistake, exactly ONE of them wins, and a
// screen that did not show which would be showing the operator a list they cannot reason about.
// Hence the four sections below: they are not a grouping choice, they ARE the resolution order.
//
// EDITING A RULE REPRICES THE FUTURE, NOT THE PAST. An order stores its agreed amounts and the
// publicId of the rule that produced them, so a March edit cannot restate what was earned in
// January. Every write here is platform-audited for the same reason: the change is the event.
//
// THE TWO MODELS ARE NOT TWO WAYS OF WRITING THE SAME SUM — they differ in what the operator's rate
// card MEANS. Under net-rate-markup it is what the platform pays the operator; under
// operator-paid-commission it is the operator's gross fare and the platform's cut comes out of it.
// Get it backwards on a commission operator and the agency is charged a markup on top of a
// commission the operator is already paying.
//
// STYLING: console realm. Semantic utilities only.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Info, Loader2, Percent, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { transportCommercialRuleService as svc } from "../api/transportPricingService";
import { transportAdminService } from "../api/transportAdminService";
import { ConsolePageHeader, ConsolePanel } from "../components/ConsoleUi";
import { ConsoleTable } from "../components/ConsoleTable";
import { useStepUp } from "../components/useStepUp";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { toast } from "@shared/ui/toast";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus";

const BLANK = {
  platformVehiclePublicId: "", serviceType: "", label: "",
  commercialModel: "NET_RATE_MARKUP", calculationType: "PERCENTAGE",
  value: "10", currency: "INR",
  validFrom: "", validTo: "", priority: 0, active: true, notes: "",
};

/**
 * The journey types, held LOCALLY — unlike the two model vocabularies, which come from
 * `/commercial-rules/options`. That endpoint carries `commercialModels` and `calculationTypes` only.
 *
 * A hardcoded enum list is how the lead-source select in the tenant app silently rewrites a lead's
 * source on every save, so the form does NOT trust this list to be complete: `serviceOptions` below
 * prepends whatever value a rule actually carries when it is not in here. Adding a backend
 * `TransportServiceType` still means editing this line — it just cannot lose data in the meantime.
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
  ["CUSTOM", "Custom"],
];

/**
 * The four precedence tiers, most specific first.
 *
 * This is the server's ordering verbatim — `PlatformTransportCommercialRuleRepository.findApplicable`
 * sorts by vehicle-before-global, then journey-type-before-any, then priority, then newest, and the
 * resolver takes the head of that list and stops. Rendering the rules in these four buckets, with
 * the server's own priority order preserved inside each, reproduces the resolution order exactly.
 * That is also why every column below sets `enableSorting: false`: letting an operator re-sort this
 * list would show them an order that has nothing to do with which rule actually wins.
 */
const TIERS = [
  { id: "VEHICLE_SERVICE", title: "Vehicle + journey type",
    why: "The most specific match there is. Nothing can outrank it." },
  { id: "VEHICLE_ANY", title: "Vehicle + any journey type",
    why: "Used when that vehicle has no rule for this particular journey type." },
  { id: "GLOBAL_SERVICE", title: "Every vehicle + journey type",
    why: "A platform-wide rule for one kind of journey — airport transfers everywhere, say." },
  { id: "GLOBAL_ANY", title: "Every vehicle + any journey type",
    why: "The global fallback. The last thing tried before the configured default." },
];

const isGlobal = (r) => (r.global !== undefined ? r.global : !r.platformVehiclePublicId);

const tierOf = (r) =>
  isGlobal(r)
    ? (r.serviceType ? "GLOBAL_SERVICE" : "GLOBAL_ANY")
    : (r.serviceType ? "VEHICLE_SERVICE" : "VEHICLE_ANY");

const human = (v) =>
  v ? String(v).replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "";

/** Server vocabulary first, humanised enum as the fallback — never a blank cell. */
const labelOf = (opts, value) =>
  opts?.find((o) => o.value === value)?.label || human(value) || "—";

const serviceLabel = (value) =>
  SERVICE_TYPES.find(([v]) => v === value)?.[1] || human(value) || "Any journey type";

export default function TransportPricing() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [options, setOptions] = useState({ commercialModels: [], calculationTypes: [] });
  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);   // BLANK-shaped draft, or an existing rule

  // Deleting a rule is MARKETPLACE_RULE_DELETE server-side, so it needs a step-up code. That gate
  // doubles as the confirmation this action would otherwise not have — a trash icon that deletes a
  // margin on first click is a bad afternoon.
  const stepUp = useStepUp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, opts] = await Promise.all([
        // One page at the server's ceiling: the four tiers below are only the true precedence order
        // if they are assembled from the whole set. `pagination.totalElements` is checked after, so
        // a platform that ever outgrows 100 rules is told rather than quietly mis-ordered.
        svc.list({ vehiclePublicId: vehicleFilter || undefined, size: 100 }),
        // Vocabularies from the server, never hardcoded here — see the service's note on drift.
        svc.options().catch(() => ({})),
      ]);
      setRows(list.rows);
      setTotal(list.pagination?.totalElements ?? list.rows.length);
      setOptions({
        commercialModels: opts.commercialModels ?? [],
        calculationTypes: opts.calculationTypes ?? [],
      });
    } catch (e) {
      if (!isAlreadyReported(e)) toast.error(getErrorMessage(e, "Could not load the pricing rules."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [vehicleFilter]);

  useEffect(() => { load(); }, [load]);

  // The vehicle picker. Best-effort and non-blocking: without it a rule can still be created as a
  // global, which is the more common case anyway.
  useEffect(() => {
    let alive = true;
    transportAdminService.listVehicles({ page: 0, size: 100 })
      .then((r) => { if (alive) setVehicles(r.rows ?? []); })
      .catch(() => { /* the picker degrades to "Every vehicle" only */ });
    return () => { alive = false; };
  }, []);

  const askDelete = (rule) =>
    stepUp.request({
      title: "Delete pricing rule",
      description: isGlobal(rule) && !rule.serviceType
        ? "This removes the global fallback. Vehicles with no rule of their own fall through to the configured default markup, and every price they produce is flagged as a fallback until a new global rule exists."
        : `This removes the rule for ${rule.vehicleName || "every vehicle"}${rule.serviceType ? ` on ${serviceLabel(rule.serviceType).toLowerCase()}` : ""}. Future orders resolve to the next rule down the order below.`,
      confirmLabel: "Delete rule",
      run: async (mfaCode) => {
        await svc.remove(rule.publicId, mfaCode);
        toast.success("Rule deleted.");
        load();
      },
    });

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(TIERS.map((t) => [t.id, []]));
    // Push in the order the server sent — priority DESC, then newest — so each bucket keeps the
    // tie-break the resolver applies inside a tier.
    for (const r of rows ?? []) buckets[tierOf(r)].push(r);
    return buckets;
  }, [rows]);

  const hasGlobalFallback = (grouped.GLOBAL_ANY ?? []).some((r) => r.active);
  const truncated = rows !== null && total > rows.length;

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Transport marketplace"
        title="Transport pricing"
        description="What the platform adds on top of, or takes out of, an operator's rate. A rule is scoped to a vehicle, to a journey type, to both, or to neither — and exactly one of them prices any given order."
        actions={
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
        }
      />

      <PrecedenceNote />

      {rows !== null && !hasGlobalFallback && !vehicleFilter && (
        <p className="rounded-xl border border-border bg-surface-hover px-4 py-3 text-sm text-body">
          <span className="font-semibold">No global fallback is configured.</span>{" "}
          Vehicles with no rule of their own are priced by the built-in default from
          <code className="mx-1 rounded bg-surface px-1 py-0.5 text-xs">app.transport-marketplace.pricing.default-markup-percent</code>
          — which works, and every price it produces is flagged as a fallback on the approve screen,
          but nobody chose it. Create a rule in the last section to make the margin deliberate.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Filter by vehicle</span>
          <select className={`${inputCls} mt-1 min-w-64`} value={vehicleFilter}
                  onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="">Every rule</option>
            {vehicles.map((v) => (
              <option key={v.publicId} value={v.publicId}>
                {v.name}{v.cityName ? ` — ${v.cityName}` : ""}
              </option>
            ))}
          </select>
          {vehicleFilter && (
            // The server's choice, and the UI has to say it: a global row shown under a vehicle
            // filter invites someone to edit it there and move the margin on every other vehicle.
            <p className="mt-1 max-w-md text-[11px] text-muted">
              Showing only the rules attached to this vehicle. The global rules that would also apply
              to it are deliberately not folded in — clear the filter to see them.
            </p>
          )}
        </label>

        {truncated && (
          <p className="text-[11px] text-hue-rose">
            Showing {rows.length} of {total} rules. The order below is only the true precedence order
            for the ones loaded — narrow by vehicle to see the rest.
          </p>
        )}
      </div>

      {TIERS.map((tier, i) => (
        <RuleTier
          key={tier.id}
          rank={i + 1}
          tier={tier}
          rows={grouped[tier.id] ?? []}
          options={options}
          loading={loading && rows === null}
          onEdit={setEditing}
          onDelete={askDelete}
        />
      ))}

      {editing && (
        <RuleDialog
          rule={editing} options={options} vehicles={vehicles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {stepUp.dialog}
    </div>
  );
}

/* ── How a price is chosen ────────────────────────────────────────────────── */

/**
 * The precedence order, stated on the screen rather than in a wiki.
 *
 * Overlapping rules are LEGAL here and only one wins, so an operator who cannot see the order cannot
 * predict what their own edit will do. This panel is the answer to "I created a rule and the price
 * did not move" — which is almost always a more specific rule sitting above it.
 */
function PrecedenceNote() {
  return (
    <ConsolePanel
      title="Which rule prices an order"
      description="Overlapping rules are normal. Exactly one of them wins, and this is the order it is looked for in."
    >
      <div className="px-5 py-4">
        <ol className="space-y-1.5 text-sm text-body">
          {TIERS.map((t, i) => (
            <li key={t.id} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
                {i + 1}
              </span>
              <span>
                <span className="font-semibold text-heading">{t.title}</span>
                <span className="text-muted"> — {t.why}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-muted">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Between two rules of equal specificity the higher <strong className="font-semibold text-body">priority</strong> wins,
            and between two of equal priority the <strong className="font-semibold text-body">newest</strong> one does. Inactive
            rules and rules whose validity window does not contain the PICKUP date are never
            considered. When nothing matches at all, the configured default markup applies and the
            resulting price is flagged as a <strong className="font-semibold text-body">fallback</strong> on the approve screen —
            it still prices the order, it just records that nobody chose the margin.
          </span>
        </p>
      </div>
    </ConsolePanel>
  );
}

/* ── One precedence tier ──────────────────────────────────────────────────── */

function RuleTier({ rank, tier, rows, options, loading, onEdit, onDelete }) {
  // Sorting is off on every column on purpose — see the note on TIERS. The order shown IS the
  // order the resolver walks.
  const columns = [
    {
      id: "rule",
      header: "Rule",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-heading">{row.original.label || "Untitled rule"}</p>
          <p className="truncate text-xs text-muted">
            {isGlobal(row.original) ? "Every vehicle" : (row.original.vehicleName || "One vehicle")}
            {" · "}
            {row.original.serviceType ? serviceLabel(row.original.serviceType) : "Any journey type"}
            {!row.original.active && (
              // Worth its own colour: the resolver skips inactive rules entirely, so an operator
              // wondering why their rule is not pricing anything needs to see this at a glance.
              <span className="ml-2 text-hue-rose">Inactive — never resolves</span>
            )}
          </p>
        </div>
      ),
    },
    {
      id: "model", header: "Model", enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body">{labelOf(options.commercialModels, row.original.commercialModel)}</span>
      ),
    },
    {
      id: "value",
      header: "Value",
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-heading">
            {row.original.calculationType === "PERCENTAGE"
              ? `${row.original.value}%`
              : `${row.original.currency || "INR"} ${row.original.value}`}
          </span>
          <span className="block text-[10px] font-normal text-muted">
            {labelOf(options.calculationTypes, row.original.calculationType)}
          </span>
        </div>
      ),
    },
    {
      id: "valid", header: "Valid", enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted">
          {row.original.validFrom || row.original.validTo
            ? `${row.original.validFrom || "any"} → ${row.original.validTo || "open"}`
            : "Always"}
        </span>
      ),
    },
    {
      id: "priority", header: "Priority", enableSorting: false, meta: { numeric: true },
      cell: ({ row }) => <span className="text-body">{row.original.priority ?? 0}</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => onEdit(row.original)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-body hover:bg-surface-hover">
            Edit
          </button>
          <button onClick={() => onDelete(row.original)} aria-label="Delete rule"
            className="rounded-lg border border-border px-2 py-1.5 text-hue-rose hover:bg-hue-rose-soft">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
          {rank}
        </span>
        {tier.title}
        <span className="font-normal normal-case tracking-normal">— {tier.why}</span>
      </h2>
      <ConsoleTable
        columns={columns}
        rows={rows}
        state={loading ? "loading" : "ready"}
        density="compact"
        emptyTitle="No rule at this level."
      />
    </section>
  );
}

/* ── Create / edit ────────────────────────────────────────────────────────── */

function RuleDialog({ rule, options, vehicles, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...BLANK, ...rule,
    platformVehiclePublicId: rule.platformVehiclePublicId ?? "",
    serviceType: rule.serviceType ?? "",
    value: rule.value ?? "10",
    priority: rule.priority ?? 0,
    label: rule.label ?? "",
    notes: rule.notes ?? "",
    validFrom: rule.validFrom ?? "",
    validTo: rule.validTo ?? "",
  });
  // MARKETPLACE_RULE_CREATE / _UPDATE are step-up guarded server-side; the code is collected once,
  // AFTER the form validates, so a typo in the value is caught before an authenticator is involved.
  const stepUp = useStepUp();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const value = Number(form.value);
  const isPct = form.calculationType === "PERCENTAGE";
  // Mirrors the server's own check, on the near side of the round trip so the operator learns while
  // they are still looking at the field. Above 100 on an operator-paid commission drives the
  // supplier amount negative — i.e. records that the operator pays the platform to run the journey.
  const invalid = !Number.isFinite(value) || value < 0 || (isPct && value > 100);
  const datesInvalid = form.validFrom && form.validTo && form.validTo < form.validFrom;

  // Tolerate a journey type this build does not know rather than silently rewriting it — the same
  // idiom the leads list uses for an unrecognised stage, and the fix for the bug the lead-source
  // select still has.
  const serviceOptions = useMemo(() => {
    const known = SERVICE_TYPES.some(([v]) => v === form.serviceType);
    return form.serviceType && !known
      ? [[form.serviceType, human(form.serviceType)], ...SERVICE_TYPES]
      : SERVICE_TYPES;
  }, [form.serviceType]);

  const askSave = () =>
    stepUp.request({
      title: rule.publicId ? "Confirm rule change" : "Confirm new rule",
      description: rule.publicId
        ? "This reprices every future order this rule wins. Orders already approved keep the amounts they were confirmed at, and the rule that produced them."
        : "This sets what the platform adds on top of, or takes out of, the operator's rate.",
      confirmLabel: rule.publicId ? "Save rule" : "Create rule",
      run: async (mfaCode) => {
        const payload = {
          // Absent, not empty: "every vehicle" and "any journey type" are the ABSENCE of a scope.
          platformVehiclePublicId: form.platformVehiclePublicId || undefined,
          serviceType: form.serviceType || undefined,
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
        if (rule.publicId) await svc.update(rule.publicId, payload, mfaCode);
        else await svc.create(payload, mfaCode);
        toast.success(rule.publicId ? "Rule updated." : "Rule created.");
        onSaved();
      },
    });

  return (
    /* The card is height-capped and scrolls its own BODY rather than the page. A rule has eight
       inputs and three explanations, which on a laptop ran past the bottom of the viewport — and
       because the OVERLAY was the scroller, Save and Cancel scrolled away with it, so the operator
       had to scroll back up to a button they could no longer see. Header and footer are pinned;
       only the fields move. Wider too (2xl), which costs nothing horizontally and buys back several
       rows of wrapped hint text. */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-heading">
            {rule.publicId ? "Edit pricing rule" : "New pricing rule"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-body">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Both hints are deliberately one short line. The banner directly below states where
                the chosen combination lands in the precedence order, which is the thing an operator
                actually needs here — repeating it per-field only made the dialog taller. */}
            <Field label="Vehicle" hint="Blank = every vehicle.">
              <select className={inputCls} value={form.platformVehiclePublicId}
                      onChange={(e) => set({ platformVehiclePublicId: e.target.value })}>
                <option value="">Every vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.publicId} value={v.publicId}>
                    {v.name}{v.cityName ? ` — ${v.cityName}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {/* The second axis, and the one the hotel side has no equivalent of: an airport transfer
                and a six-day tour do not carry the same margin. */}
            <Field label="Journey type" hint="Blank = any journey type.">
              <select className={inputCls} value={form.serviceType}
                      onChange={(e) => set({ serviceType: e.target.value })}>
                <option value="">Any journey type</option>
                {serviceOptions.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Where this rule will sit in the order the whole screen is built around. Stated here
              because the scope selects above are exactly where an operator forms the wrong
              expectation about which rule is going to win. */}
          <p className="rounded-lg bg-surface-hover px-3 py-2 text-[11px] leading-relaxed text-body">
            <span className="font-semibold">
              {form.platformVehiclePublicId ? "This vehicle" : "Every vehicle"}
              {" + "}
              {form.serviceType ? serviceLabel(form.serviceType).toLowerCase() : "any journey type"}
            </span>{" "}
            — level {TIERS.findIndex((t) => t.id === tierOf({
              platformVehiclePublicId: form.platformVehiclePublicId || null,
              serviceType: form.serviceType || null,
            })) + 1} of 4. Anything more specific than this outranks it whatever its priority.
          </p>

          {/* Model, calculation and value on ONE row. They are read together — "what the rate card
              means" then "how much on top of it" — and splitting them across two rows was both
              taller and a worse reading order. The model's explainer keeps its own line because the
              two models INVERT, and getting them the wrong way round charges the agency twice. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Model">
              <select className={inputCls} value={form.commercialModel}
                      onChange={(e) => set({ commercialModel: e.target.value })}>
                {options.commercialModels.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
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
          <p className="text-[11px] leading-relaxed text-muted">
            {form.commercialModel === "OPERATOR_PAID_COMMISSION"
              ? "The rate card is the operator's GROSS fare. The agency pays that; the platform's cut comes out of it."
              : "The rate card is what the platform PAYS the operator. The agency pays that plus the markup above."}
          </p>

          {invalid && (
            <p className="rounded-lg bg-hue-rose-soft px-3 py-2 text-[11px] text-hue-rose">
              {isPct && value > 100
                ? "A percentage above 100 is not a valid rule — on an operator-paid commission it would make the supplier amount negative. The server rejects it too; this is only so you find out sooner."
                : "Value cannot be negative."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid from" hint="Matched against the PICKUP date, not today.">
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
                     onChange={(e) => set({ label: e.target.value })} placeholder="Goa airport transfers 12%" />
            </Field>
            <Field label="Priority" hint="Higher wins among equally specific rules — never across levels.">
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

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={askSave}
                  disabled={invalid || datesInvalid || stepUp.busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-50">
            {stepUp.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {stepUp.dialog}
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
