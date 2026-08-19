// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Suggest a property type from a hotel's name.
//
// WHY THIS SUGGESTS AND NEVER WRITES.
// platform_hotels.property_type is nullable with no default, because neither the console form nor the
// hotel-partner registration form has ever asked the question — so every existing row genuinely does
// not know. Stamping them all 'HOTEL' in a migration would have manufactured an answer nobody gave
// and would have quietly mis-filed every resort and homestay in the catalog. A filter is only worth
// having if the values inside it are true.
//
// A name, though, is real evidence: "Coorg Coffee Homestay" is almost certainly a homestay. So the
// name is allowed to fill the select and say where the guess came from — and a human has to press
// save for it to become data.
//
// WHY AMBIGUITY OFFERS BOTH RATHER THAN GOING SILENT.
// The first cut of this returned null whenever two structural words matched ("Beach Resort & Villas"),
// on the reasoning that a confident wrong pre-fill is worse than nothing. Half right. A wrong pre-fill
// IS the danger — but silence is not the cure for it, it just throws the evidence away and makes the
// operator start from zero, which is the exact friction this exists to remove. If the name says
// "Resort & Villas" we know it is one of those two, and the honest move is to say so and let a human
// pick. Hence: prefill only when the name gives ONE answer; otherwise offer every candidate and
// prefill nothing.
//
// WHY "HOTEL" NEVER PREFILLS.
// Half the resorts in this market have "Hotel" in their name. Prefilling it means an operator clicking
// briskly through a form turns the whole catalog into HOTEL — the same fabrication as the migration
// default would have been, just arriving one save at a time. Weak signals get offered, never seated.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Structural types — an unambiguous claim about what the building IS.
 * Order within the list does not matter; a name matching two of these is ambiguous by definition.
 */
const STRUCTURAL = [
  { type: "HOUSEBOAT",   label: "houseboat",   patterns: [/\bhouse\s*boats?\b/] },
  { type: "CAMP",        label: "camp",        patterns: [/\bcamps?\b/, /\btented\b/, /\bglamping\b/] },
  { type: "HOMESTAY",    label: "homestay",    patterns: [/\bhome[\s-]*stays?\b/] },
  { type: "HOSTEL",      label: "hostel",      patterns: [/\bhostels?\b/, /\bbackpackers?\b/] },
  { type: "GUEST_HOUSE", label: "guest house", patterns: [/\bguest[\s-]*house\b/] },
  { type: "APARTMENT",   label: "apartment",   patterns: [/\bapartments?\b/, /\bapart[\s-]*hotel\b/, /\bserviced\s+residences?\b/] },
  { type: "VILLA",       label: "villa",       patterns: [/\bvillas?\b/] },
  { type: "RESORT",      label: "resort",      patterns: [/\bresorts?\b/] },
];

/**
 * Weak signals. "Boutique" is a positioning claim rather than a building type, and "Hotel" is the
 * default word for any lodging here. Both are offered as candidates; neither is ever seated in the
 * field on its own.
 */
const WEAK = [
  { type: "BOUTIQUE", label: "boutique", patterns: [/\bboutique\b/] },
  { type: "HOTEL",    label: "hotel",    patterns: [/\bhotels?\b/, /\binns?\b/] },
];

const matches = (name, entry) => entry.patterns.some((p) => p.test(name));

/**
 * @param   {string} name  the hotel's name as typed
 * @returns {{ prefill: string|null, candidates: Array<{type: string, reason: string}> }}
 *
 * `prefill` is non-null ONLY when the name points at exactly one structural type. Every other case —
 * two structural words, a weak word alone, nothing at all — leaves it null, and the caller must not
 * substitute a default. `candidates` is what the UI offers as one-tap chips, most confident first,
 * and is empty when the name says nothing.
 */
export function suggestPropertyType(name) {
  const n = String(name || "").toLowerCase().trim();
  if (n.length < 3) return { prefill: null, candidates: [] };

  const structural = STRUCTURAL.filter((e) => matches(n, e));
  const weak = WEAK.filter((e) => matches(n, e));

  const candidates = [
    ...structural.map((e) => ({ type: e.type, reason: `the name says "${e.label}"` })),
    ...weak.map((e) => ({
      type: e.type,
      reason:
        e.type === "HOTEL"
          ? 'the name says "hotel", which is the least specific option'
          : `the name says "${e.label}"`,
    })),
  ];

  // One structural word and nothing competing with it: confident enough to seat in the field. Two
  // structural words is a genuine fork and picking one would be a coin flip wearing a confident face.
  // A weak word alone never seats — see the header.
  const prefill = structural.length === 1 ? structural[0].type : null;

  return { prefill, candidates };
}

/**
 * True when the field still holds exactly what we put there and the operator has not touched it — the
 * condition for showing the "suggested from the name" hint. Once they choose something else the hint
 * must disappear, or it reads as the app arguing with them.
 */
export function isUnconfirmedSuggestion(currentValue, prefill) {
  return Boolean(prefill) && currentValue === prefill;
}
