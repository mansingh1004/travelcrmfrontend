// src/console/pages/PricingRules.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ONE screen for the platform's margin, with a section per supply line.
//
// There were two rows in the console menu — "Hotel pricing rules" and "Transport
// pricing rules" — and packages were about to make a third. Both existing rows
// were literally called "Pricing Rules" until recently, which meant the launcher
// and ⌘K showed two identical strings for the two screens where opening the
// wrong one is most expensive.
//
// They are one job: what the platform takes on what it sells. The supply line is
// a filter on that job, not a different job — which is exactly the shape a
// segmented control expresses and a pair of menu rows does not.
//
// ── Why the three sections stay separate components ─────────────────────────
// They are NOT the same rule. A hotel rule scopes to a hotel; a transport rule to
// a product and a service type; a package rule to a package or one of its tiers.
// Three tables, three resolvers, three vocabularies. Merging them into one
// component would mean a form that hides two thirds of its fields at all times.
// So: one page, one place to look, three sections that each know their own
// domain — and each keeps its own Refresh and New rule, because that is how a
// section is actually used.
// ─────────────────────────────────────────────────────────────────────────────

import { useSearchParams } from "react-router-dom";
import { BedDouble, Car, Package } from "lucide-react";

import { ConsolePageHeader } from "../components/ConsoleUi";
import CommercialRules from "./CommercialRules";
import TransportPricing from "./TransportPricing";
import PackagePricing from "./PackagePricing";

const SECTIONS = [
  { key: "hotel", label: "Hotels", Icon: BedDouble },
  { key: "transport", label: "Vehicles", Icon: Car },
  { key: "package", label: "Packages", Icon: Package },
];

export default function PricingRules() {
  /* In the URL so /console/hotel-pricing and /console/transport-pricing can each redirect straight
     to their own section rather than dropping an operator on whichever one happens to be first. */
  const [params, setParams] = useSearchParams();
  const raw = params.get("section");
  const section = SECTIONS.some((s) => s.key === raw) ? raw : "hotel";

  const setSection = (next) => {
    const p = new URLSearchParams(params);
    if (next === "hotel") p.delete("section");
    else p.set("section", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow="Commercials"
        title="Pricing rules"
        description="What the platform adds on top of, or takes out of, a supplier's rate. Rules are resolved most-specific first, and a price produced with no rule in force is flagged as a fallback."
      />

      {/* ⚠ The platform's own margin structure. No tenant counterpart exists or may exist — an
          agency that could read a rule could compute the platform's cut on everything it buys. */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              aria-pressed={active}
              className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                active ? "bg-accent-soft text-accent-soft-text" : "text-muted hover:text-heading"
              }`}
            >
              <s.Icon className="h-4 w-4" aria-hidden="true" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Only the active section is mounted. Each fetches its own rules on mount, and rendering all
          three would fire three sets of requests for two lists nobody is looking at. */}
      {section === "hotel" && <CommercialRules embedded />}
      {section === "transport" && <TransportPricing embedded />}
      {section === "package" && <PackagePricing embedded />}
    </div>
  );
}
