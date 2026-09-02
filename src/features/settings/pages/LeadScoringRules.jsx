// src/features/settings/pages/LeadScoringRules.jsx
//
// The tenant-admin rule builder: edit the Hot / Warm / Cold logic, and watch it run against a real
// lead before publishing.
//
// DESIGN NOTE — this screen deliberately does NOT use the glass-card / gradient kit the other
// settings pages use. It is a dense configuration surface: twelve rules, each with three conditions,
// each with a field, an operator and a value. Gradients and drop shadows at that density read as
// noise. Hairline borders, a single accent, and generous use of monospace-ish alignment keep the
// structure legible — the Notion/Linear register this product's newer screens aim for.
//
// EVERYTHING the builder offers comes from GET /leads/scoring/fields. No field key, operator list or
// enum value is hardcoded here. That is the whole point of the registry: adding a scoring field is
// one backend entry and zero frontend changes, and nothing can drift the way the hardcoded
// LEAD_SOURCES list in LeadInformation.jsx did.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronDown, History, LoaderCircle, Play, Plus, RotateCcw,
  Save, Search, Trash2, TriangleAlert, X,
} from "lucide-react";

import { leadScoringService } from "../api/leadScoringService";
import { leadService } from "@features/leads";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";

const FONT = { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" };

/* The three the engine can emit. Fresh is absent on purpose: it means "nobody has contacted this
   lead yet", which is a fact about the pipeline, not a verdict a rule can reach. The backend
   rejects it as an outcome or a default. */
const OUTCOMES = ["Hot", "Warm", "Cold"];

const TONE = {
  Hot: "bg-red-50 text-red-700 border-red-200",
  Warm: "bg-amber-50 text-amber-700 border-amber-200",
  Cold: "bg-slate-50 text-slate-600 border-slate-200",
  Fresh: "bg-blue-50 text-blue-700 border-blue-200",
};
const tone = (t) => TONE[t] || "bg-slate-50 text-slate-600 border-slate-200";

/* Operators taking no operand at all — the two absence tests. The value input is hidden for these,
   because "is known" with a value box beside it invites an answer that is then ignored. */
const NULLARY = ["is known", "is not known"];
const isNullary = (op) => NULLARY.includes(op);
const isRange = (op) => op === "is between";
const isList = (op) => op === "is any of" || op === "is none of";

let seq = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${seq++}`;

export default function LeadScoringRules() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({});          // { group: [field] }
  const [doc, setDoc] = useState(null);              // the working draft
  const [version, setVersion] = useState(null);
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);

  // Flat lookup by key, for rendering a condition row without walking the groups every time.
  const fieldByKey = useMemo(() => {
    const map = {};
    Object.values(fields).flat().forEach((f) => { map[f.key] = f; });
    return map;
  }, [fields]);

  /* ── Load ──────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [registry, config] = await Promise.all([
          leadScoringService.getFields(),
          leadScoringService.getConfig().catch(() => null),   // a tenant with none yet is not an error
        ]);
        if (!alive) return;
        setFields(registry || {});
        setDoc(config?.document || { mode: "Rule Based", defaultTemperature: "Warm", rules: [], factors: [], bands: [] });
        setVersion(config?.version ?? null);
      } catch (err) {
        if (!isAlreadyReported(err)) {
          showToast(getErrorMessage(err, "Could not load the scoring rules."), "error");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [showToast]);

  /* ── Draft mutation ────────────────────────────────────── */
  const patchDoc = useCallback((changes) => setDoc((d) => ({ ...d, ...changes })), []);

  const patchRule = useCallback((index, changes) => {
    setDoc((d) => {
      const rules = [...(d.rules || [])];
      rules[index] = { ...rules[index], ...changes };
      return { ...d, rules };
    });
  }, []);

  const patchCondition = useCallback((ruleIndex, condIndex, changes) => {
    setDoc((d) => {
      const rules = [...(d.rules || [])];
      const conditions = [...(rules[ruleIndex].conditions || [])];
      conditions[condIndex] = { ...conditions[condIndex], ...changes };
      rules[ruleIndex] = { ...rules[ruleIndex], conditions };
      return { ...d, rules };
    });
  }, []);

  const addRule = () => {
    // Priorities step by 10 so a rule can be slotted between two existing ones without renumbering
    // the list — the same reason the seeded default spaces them out.
    const highest = (doc.rules || []).reduce((m, r) => Math.max(m, r.priority || 0), 0);
    patchDoc({
      rules: [...(doc.rules || []), {
        id: nextId("rule"), name: "", priority: highest + 10,
        logic: "All", outcome: "Warm", enabled: true, conditions: [],
      }],
    });
  };

  const removeRule = (index) =>
    patchDoc({ rules: (doc.rules || []).filter((_, i) => i !== index) });

  const addCondition = (ruleIndex) => {
    const first = Object.values(fields).flat().find((f) => f.available);
    patchRule(ruleIndex, {
      conditions: [...(doc.rules[ruleIndex].conditions || []), {
        field: first?.key || "", operator: first?.operators?.[0] || "is", values: [""],
      }],
    });
  };

  const removeCondition = (ruleIndex, condIndex) =>
    patchRule(ruleIndex, {
      conditions: (doc.rules[ruleIndex].conditions || []).filter((_, i) => i !== condIndex),
    });

  /* Changing the FIELD resets the operator and the values. Keeping them would leave a condition
     like "Budget disclosed is more than 3" — an operator/type mismatch the server rejects, reported
     against a row the user did not think they had touched. */
  const changeConditionField = (ruleIndex, condIndex, key) => {
    const f = fieldByKey[key];
    patchCondition(ruleIndex, condIndex, {
      field: key,
      operator: f?.operators?.[0] || "is",
      values: [""],
    });
  };

  /* ── Save ──────────────────────────────────────────────── */
  const save = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const saved = await leadScoringService.saveConfig(doc, note || null, true);
      setVersion(saved?.version ?? null);
      setNote("");
      showToast(`Published v${saved?.version ?? ""} — every lead has been re-scored.`);
    } catch (err) {
      // A 400 is SILENT at the interceptor by design, so the call site renders it. fieldErrors are
      // keyed "rules[2].conditions[0].operator", which is what lets each row highlight itself.
      const fe = err?.response?.data?.fieldErrors;
      if (fe) {
        setFieldErrors(fe);
        showToast("Please correct the highlighted rules.", "error");
      } else if (!isAlreadyReported(err)) {
        showToast(getErrorMessage(err, "Could not save the rules."), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const loadVersions = async () => {
    try {
      setVersions(await leadScoringService.getVersions() || []);
      setShowVersions(true);
    } catch (err) {
      if (!isAlreadyReported(err)) showToast(getErrorMessage(err, "Could not load versions."), "error");
    }
  };

  const restore = async (publicId) => {
    try {
      const restored = await leadScoringService.restoreVersion(publicId);
      setDoc(restored?.document || doc);
      setVersion(restored?.version ?? null);
      setShowVersions(false);
      showToast(`Restored as v${restored?.version ?? ""}.`);
    } catch (err) {
      if (!isAlreadyReported(err)) showToast(getErrorMessage(err, "Could not restore that version."), "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white grid place-items-center" style={FONT}>
        <LoaderCircle className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800" style={FONT}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/CompanySettings")}
            className="p-1.5 -ml-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Back to settings">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-900">Lead temperature rules</h1>
            <p className="text-xs text-slate-500">
              {version ? `Version ${version} is live` : "No version published yet"}
              {" · "}first matching rule wins
            </p>
          </div>
          <button onClick={loadVersions}
            className="text-xs font-medium px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> History
          </button>
          <button onClick={save} disabled={saving}
            className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
            {saving ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Publish
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        <ExplainerBanner />

        {/* ── Rules ── */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rules</h2>
            <span className="text-xs text-slate-400">Evaluated top to bottom</span>
          </div>

          {typeof fieldErrors.rules === "string" && (
            <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
              <TriangleAlert className="w-3.5 h-3.5" /> {fieldErrors.rules}
            </p>
          )}

          <div className="border border-slate-200 rounded divide-y divide-slate-200">
            {(doc.rules || []).length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">
                No rules yet — every contacted lead will get the default below.
              </p>
            )}
            {(doc.rules || []).map((rule, i) => (
              <RuleRow
                key={rule.id || i}
                rule={rule} index={i} fields={fields} fieldByKey={fieldByKey}
                errors={fieldErrors}
                onPatch={(c) => patchRule(i, c)}
                onRemove={() => removeRule(i)}
                onAddCondition={() => addCondition(i)}
                onPatchCondition={(ci, c) => patchCondition(i, ci, c)}
                onChangeConditionField={(ci, k) => changeConditionField(i, ci, k)}
                onRemoveCondition={(ci) => removeCondition(i, ci)}
              />
            ))}
          </div>

          <button onClick={addRule}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add rule
          </button>
        </section>

        {/* ── Default ── */}
        <section className="border border-slate-200 rounded px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">When no rule matches</p>
            <p className="text-xs text-slate-500">
              A contacted lead that told us nothing is mid-pipeline, so Warm is the sensible fallback.
              Fresh is not offered: it means nobody has been contacted yet, which the rules never decide.
            </p>
          </div>
          <select value={doc.defaultTemperature || "Warm"}
            onChange={(e) => patchDoc({ defaultTemperature: e.target.value })}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded border ${tone(doc.defaultTemperature)}`}>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </section>

        {/* ── Publish note ── */}
        <section>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note for this version</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255}
            placeholder="e.g. dropped the value rule, it was over-firing"
            className="mt-1 w-full px-3 py-2 text-sm rounded border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none" />
        </section>

        <Simulator doc={doc} fieldByKey={fieldByKey} showToast={showToast} />
      </div>

      {showVersions && (
        <VersionDrawer versions={versions} onClose={() => setShowVersions(false)} onRestore={restore} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rule
   ───────────────────────────────────────────────────────────── */
function RuleRow({
  rule, index, fields, fieldByKey, errors,
  onPatch, onRemove, onAddCondition, onPatchCondition, onChangeConditionField, onRemoveCondition,
}) {
  const base = `rules[${index}]`;
  const err = (suffix = "") => errors[base + suffix];

  return (
    <div className={`px-4 py-3 ${rule.enabled ? "" : "bg-slate-50/60"}`}>
      <div className="flex items-center gap-2">
        {/* Disabled rules are dimmed rather than hidden — an author toggling one off wants to see it
            still sitting in its priority slot. */}
        <input type="checkbox" checked={rule.enabled !== false}
          onChange={(e) => onPatch({ enabled: e.target.checked })}
          className="w-3.5 h-3.5 accent-blue-600" aria-label="Rule enabled" />

        <input value={rule.priority ?? 0} type="number"
          onChange={(e) => onPatch({ priority: Number(e.target.value) })}
          title="Lower runs first"
          className={`w-14 px-1.5 py-1 text-xs text-center rounded border tabular-nums ${err(".priority") ? "border-red-300 bg-red-50" : "border-slate-200"}`} />

        <input value={rule.name || ""} onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Name this rule"
          className="flex-1 px-2 py-1 text-sm rounded border border-transparent hover:border-slate-200 focus:border-blue-400 outline-none font-medium" />

        <span className="text-xs text-slate-400">then</span>
        <select value={rule.outcome || "Warm"} onChange={(e) => onPatch({ outcome: e.target.value })}
          className={`text-xs font-semibold px-2 py-1 rounded border ${tone(rule.outcome)} ${err(".outcome") ? "ring-1 ring-red-300" : ""}`}>
          {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <button onClick={onRemove} className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
          aria-label="Delete rule">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {err(".priority") && <p className="mt-1 ml-[4.5rem] text-xs text-red-600">{err(".priority")}</p>}
      {err(".outcome") && <p className="mt-1 text-xs text-red-600">{err(".outcome")}</p>}

      {/* Conditions */}
      <div className="mt-2 ml-6 space-y-1.5">
        {err(".conditions") && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <TriangleAlert className="w-3.5 h-3.5" /> {err(".conditions")}
          </p>
        )}
        {(rule.conditions || []).map((cond, ci) => (
          <ConditionRow
            key={ci} cond={cond} fields={fields} fieldByKey={fieldByKey}
            logic={rule.logic} isFirst={ci === 0}
            onLogicChange={(v) => onPatch({ logic: v })}
            errors={errors} base={`${base}.conditions[${ci}]`}
            onPatch={(c) => onPatchCondition(ci, c)}
            onChangeField={(k) => onChangeConditionField(ci, k)}
            onRemove={() => onRemoveCondition(ci)}
          />
        ))}
        <button onClick={onAddCondition}
          className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1">
          <Plus className="w-3 h-3" /> condition
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Condition — field / operator / value, all driven by the registry
   ───────────────────────────────────────────────────────────── */
function ConditionRow({
  cond, fields, fieldByKey, logic, isFirst, onLogicChange,
  errors, base, onPatch, onChangeField, onRemove,
}) {
  const field = fieldByKey[cond.field];
  const err = (suffix = "") => errors[base + suffix];
  const values = cond.values || [];

  const setValue = (i, v) => {
    const next = [...values];
    next[i] = v;
    onPatch({ values: next });
  };

  return (
    <div className="flex items-start gap-1.5 text-xs">
      {/* The ALL/ANY joiner sits on the first row so the rule reads as a sentence. */}
      <div className="w-12 shrink-0 pt-1.5">
        {isFirst ? (
          <select value={logic || "All"} onChange={(e) => onLogicChange(e.target.value)}
            className="text-xs font-semibold text-slate-500 bg-transparent outline-none cursor-pointer">
            <option value="All">All</option>
            <option value="Any">Any</option>
          </select>
        ) : (
          <span className="text-slate-300 pl-1">{logic === "Any" ? "or" : "and"}</span>
        )}
      </div>

      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        {/* Field — grouped exactly as the registry groups it. Unavailable fields are shown DISABLED
            with their reason, not hidden: "why can't I score on competing quotes?" has an answer. */}
        <select value={cond.field || ""} onChange={(e) => onChangeField(e.target.value)}
          className={`px-2 py-1 rounded border bg-white ${err(".field") ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
          <option value="">Choose a field…</option>
          {Object.entries(fields).map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((f) => (
                <option key={f.key} value={f.key} disabled={!f.available}
                  title={f.unavailableReason || ""}>
                  {f.label}{f.available ? "" : " — not captured yet"}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Operators come from the field's own type, so an invalid pairing cannot be selected. */}
        <select value={cond.operator || ""} onChange={(e) => onPatch({ operator: e.target.value, values: [""] })}
          className={`px-2 py-1 rounded border bg-white ${err(".operator") ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
          {(field?.operators || []).map((op) => <option key={op} value={op}>{op}</option>)}
        </select>

        {/* Value input, shaped by the operator's arity and the field's type. */}
        {!isNullary(cond.operator) && (
          field?.type === "ENUM" && !isList(cond.operator) ? (
            <select value={values[0] || ""} onChange={(e) => setValue(0, e.target.value)}
              className={`px-2 py-1 rounded border bg-white ${err(".values[0]") ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
              <option value="">Choose…</option>
              {(field?.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : field?.type === "BOOLEAN" ? (
            <select value={values[0] || ""} onChange={(e) => setValue(0, e.target.value)}
              className={`px-2 py-1 rounded border bg-white ${err(".values[0]") ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
              <option value="">Choose…</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : isRange(cond.operator) ? (
            <>
              <input value={values[0] || ""} onChange={(e) => setValue(0, e.target.value)} placeholder="from"
                className={`w-20 px-2 py-1 rounded border tabular-nums ${err(".values[0]") ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
              <span className="text-slate-400">and</span>
              <input value={values[1] || ""} onChange={(e) => setValue(1, e.target.value)} placeholder="to"
                className={`w-20 px-2 py-1 rounded border tabular-nums ${err(".values[1]") ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
            </>
          ) : isList(cond.operator) ? (
            <input value={values.join(", ")}
              onChange={(e) => onPatch({ values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              placeholder="comma separated"
              className={`flex-1 min-w-[10rem] px-2 py-1 rounded border ${err(".values") ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
          ) : (
            <input value={values[0] || ""} onChange={(e) => setValue(0, e.target.value)} placeholder="value"
              className={`w-28 px-2 py-1 rounded border ${err(".values[0]") ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
          )
        )}

        <button onClick={onRemove} className="p-0.5 rounded text-slate-300 hover:text-red-600" aria-label="Remove condition">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Every fieldErrors key this row could carry, rendered inline beside it. */}
      {[".field", ".operator", ".values", ".values[0]", ".values[1]"].map((s) =>
        err(s) ? <p key={s} className="w-full pl-14 text-xs text-red-600">{err(s)}</p> : null
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Simulator — the same engine, on a real lead, before publishing
   ───────────────────────────────────────────────────────────── */
function Simulator({ doc, fieldByKey, showToast }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [lead, setLead] = useState(null);
  const [result, setResult] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    try {
      const res = await leadService.listLeads({ q: query.trim(), size: 8 });
      setOptions(res?.data?.data ?? res?.data ?? []);
    } catch (err) {
      if (!isAlreadyReported(err)) showToast(getErrorMessage(err, "Could not search leads."), "error");
    }
  };

  const run = useCallback(async (picked) => {
    if (!picked) return;
    setBusy(true);
    try {
      const [res, snap] = await Promise.all([
        leadScoringService.simulate(picked.id || picked.publicId, doc),
        leadScoringService.getSnapshot(picked.id || picked.publicId).catch(() => null),
      ]);
      setResult(res);
      setSnapshot(snap);
    } catch (err) {
      if (!isAlreadyReported(err)) showToast(getErrorMessage(err, "Could not simulate."), "error");
    } finally {
      setBusy(false);
    }
  }, [doc, showToast]);

  // Re-run whenever the draft changes, so the trace tracks what the author is typing. Debounced so
  // a keystroke in a value box does not fire a request per character.
  useEffect(() => {
    if (!lead) return undefined;
    const t = setTimeout(() => run(lead), 400);
    return () => clearTimeout(t);
  }, [doc, lead, run]);

  return (
    <section className="border border-slate-200 rounded">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <Play className="w-3.5 h-3.5 text-slate-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex-1">
          Try it on a real lead
        </h2>
        {busy && <LoaderCircle className="w-3.5 h-3.5 animate-spin text-slate-400" />}
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search a lead by name, phone or code…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-slate-200 focus:border-blue-400 outline-none" />
          </div>
          <button onClick={search}
            className="text-xs font-medium px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50">
            Search
          </button>
        </div>

        {options.length > 0 && !lead && (
          <ul className="mt-2 border border-slate-200 rounded divide-y divide-slate-100">
            {options.map((o) => (
              <li key={o.id}>
                <button onClick={() => { setLead(o); setOptions([]); run(o); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                  <span className="flex-1 truncate">{o.customerName}</span>
                  <span className="text-xs text-slate-400">{o.leadCode}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tone(o.leadType)}`}>
                    {o.leadType}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {lead && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium">{lead.customerName}</span>
              <span className="text-xs text-slate-400">{lead.leadCode}</span>
              <button onClick={() => { setLead(null); setResult(null); setSnapshot(null); }}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> change
              </button>
            </div>

            {result && <TraceView result={result} snapshot={snapshot} fieldByKey={fieldByKey} />}
          </div>
        )}
      </div>
    </section>
  );
}

/* The per-condition trace — the reason this engine is worth trusting. It shows the rules that did
   NOT fire too, because "why isn't this Hot?" is a question about a rule that failed. */
function TraceView({ result, snapshot, fieldByKey }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-1 rounded border ${tone(result.temperature)}`}>
          {result.temperature}
        </span>
        <span className="text-xs text-slate-500">{result.summary}</span>
        {typeof result.score === "number" && (
          <span className="text-xs text-slate-400 tabular-nums ml-auto">score {result.score}</span>
        )}
      </div>

      <ul className="border border-slate-200 rounded divide-y divide-slate-100">
        {(result.rules || []).map((r, i) => (
          <li key={r.ruleId || i}
            className={`px-3 py-2 ${r.applied ? "bg-blue-50/50" : r.shortCircuited ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-2 text-xs">
              {r.applied
                ? <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                : <span className="w-3.5 h-3.5 shrink-0" />}
              <span className="font-medium flex-1 truncate">{r.ruleName || `Rule ${r.priority}`}</span>
              <span className="text-slate-400">{r.logic}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tone(r.outcome)}`}>
                {r.outcome}
              </span>
            </div>

            {/* Short-circuited rules carry no conditions — nothing was evaluated, and pretending
                otherwise would be a fabricated trace. */}
            {r.shortCircuited ? (
              <p className="mt-1 ml-5 text-[11px] text-slate-400">a higher rule already matched</p>
            ) : (
              <ul className="mt-1 ml-5 space-y-0.5">
                {(r.conditions || []).map((c, ci) => (
                  <li key={ci} className="text-[11px] flex items-start gap-1.5">
                    <span className={c.passed ? "text-emerald-600" : "text-slate-300"}>
                      {c.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-slate-600">
                      {c.fieldLabel || c.field} <span className="text-slate-400">{c.operator}</span>{" "}
                      {(c.expected || []).join(" and ")}
                      {/* The whole reason a trace beats a verdict: it names the value it saw. */}
                      {c.nullShortCircuited
                        ? <em className="text-amber-600"> — not recorded for this lead</em>
                        : c.actualValue != null && <span className="text-slate-400"> (is {c.actualValue})</span>}
                      {c.error && <em className="text-red-600"> — {c.error}</em>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {snapshot && <SnapshotPanel snapshot={snapshot} fieldByKey={fieldByKey} />}
    </div>
  );
}

function SnapshotPanel({ snapshot, fieldByKey }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(snapshot).filter(([k]) => k !== "contacted");

  return (
    <div className="border border-slate-200 rounded">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        What we know about this lead
        {!snapshot.contacted && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
            not contacted yet
          </span>
        )}
      </button>
      {open && (
        <dl className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-slate-50 py-0.5">
              <dt className="text-slate-500 truncate">{fieldByKey[k]?.label || k}</dt>
              <dd className={v === null || v === undefined ? "text-slate-300 italic" : "text-slate-700 tabular-nums"}>
                {v === null || v === undefined ? "not known" : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Version history
   ───────────────────────────────────────────────────────────── */
function VersionDrawer({ versions, onClose, onRestore }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/20" />
      <div className="relative w-full max-w-md bg-white border-l border-slate-200 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()} style={FONT}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center">
          <h2 className="text-sm font-semibold flex-1">Version history</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {versions.map((v) => (
            <li key={v.publicId} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">v{v.version}</span>
                  {v.active && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      live
                    </span>
                  )}
                </div>
                {v.note && <p className="text-xs text-slate-500 mt-0.5">{v.note}</p>}
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {v.createdBy || "system"}
                  {v.createdAt ? ` · ${new Date(v.createdAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              {!v.active && (
                <button onClick={() => onRestore(v.publicId)}
                  className="text-xs font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 shrink-0">
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExplainerBanner() {
  return (
    <div className="border border-slate-200 rounded px-4 py-3 bg-slate-50/60">
      <p className="text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Hot means ready to book</strong> — one more call closes it.
        That is a readiness judgement, not a value one: a large enquiry with vague dates and no
        quotation activity is not hot, it is merely large.{" "}
        <strong className="text-slate-800">Fresh is not a rule outcome.</strong> It means nobody has
        contacted the lead yet, so the rules do not run at all until someone has.
      </p>
    </div>
  );
}
