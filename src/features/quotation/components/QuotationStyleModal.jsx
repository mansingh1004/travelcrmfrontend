// "Which design?" picker, shown when a quotation PDF is downloaded.
//
// Presentation only: it never fetches, never navigates and never saves. It hands the chosen style
// back via onSelect(style) and the caller decides what to do with it — which is what lets the same
// dialog serve a download today and an email/share action later without growing new behaviour.
//
// The choice is a ONE-OFF render override (?style= on the PDF endpoint); the quotation's own saved
// design is untouched, so the customer's share link keeps showing what the agent actually chose.
//
// Styling follows AllLeads.jsx's inline-style modal idiom (fixed inset-0 z-50 overlay, click-outside
// to close, Plus Jakarta Sans set explicitly — the tenant app applies no global font).

import { X, FileText, Sparkles, Crown, Gem, Check } from "lucide-react";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const STYLES = [
  {
    value: "CLASSIC",
    title: "Classic",
    accent: "#2563eb",
    icon: FileText,
    points: ["The original layout your customers know", "Compact, information-dense pages"],
  },
  {
    value: "MODERN",
    title: "Modern",
    accent: "#b08d57",
    icon: Sparkles,
    points: ["Editorial design with hero photo", "Day-by-day itinerary timeline"],
  },
  {
    value: "PREMIUM",
    title: "Premium",
    accent: "#2e4460",
    icon: Crown,
    points: ["Quiet-luxury letterhead on ivory paper", "Settlement table, serif typography"],
  },
  // The only design NOT rendered by the backend's OpenPDF engine — it goes through headless
  // Chromium, so it is also the only one that can answer 503 ("not available on this server") when
  // the browser is missing or pdf.luxury.enabled=false. Nothing here needs to special-case that:
  // the shared http interceptor already toasts a 5xx, and the caller's usePdfDownload hook clears
  // its loading state on rejection like it does for any other failure.
  {
    value: "LUXURY",
    title: "Luxury",
    accent: "#c9a227",
    icon: Gem,
    points: ["Full-bleed navy & gold coffee-table book", "Photo cover, day cards, hotel spreads"],
  },
];

function StyleCard({ def, isSaved, actionLabel, onPick }) {
  const Icon = def.icon;
  return (
    <button
      onClick={() => onPick(def.value)}
      style={{
        border: "2px solid #e2e8f0", borderRadius: 16, background: "rgba(255,255,255,0.85)",
        padding: 16, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: FONT,
        transition: "all .18s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = def.accent; e.currentTarget.style.boxShadow = `0 8px 24px ${def.accent}33`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center",
          justifyContent: "center", background: `${def.accent}1a`, color: def.accent,
        }}>
          <Icon size={19} />
        </div>
        {/* Which design this quotation is actually saved as — the one its share link shows. */}
        {isSaved && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
            color: def.accent, background: `${def.accent}14`, border: `1px solid ${def.accent}44`,
            borderRadius: 999, padding: "3px 9px",
          }}>Saved</span>
        )}
      </div>

      <div style={{ marginTop: 11, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{def.title}</div>

      <ul style={{ margin: "7px 0 0 0", padding: 0, listStyle: "none" }}>
        {def.points.map((p) => (
          <li key={p} style={{
            display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11.5,
            color: "#475569", fontWeight: 600, padding: "2.5px 0",
          }}>
            <Check size={12} style={{ color: def.accent, flexShrink: 0, marginTop: 2 }} /> {p}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 11, fontSize: 12, fontWeight: 800, color: def.accent }}>
        {actionLabel} <span aria-hidden="true">→</span>
      </div>
    </button>
  );
}

/**
 * @param mode "download" (one-off, nothing saved), "share" (the pick is SAVED on the quotation,
 *             because the customer opens the weblink later and the server renders the stored design),
 *             or "preview" (one-off, nothing saved — just view the weblink in that design).
 *             The copy differs so the agent knows which of the three just happened — that difference
 *             is the whole point, not decoration.
 */
export default function QuotationStyleModal({ savedStyle, mode = "download", onSelect, onClose }) {
  const isShare = mode === "share";
  const isPreview = mode === "preview";
  const heading = isShare ? "Share as" : isPreview ? "Preview as" : "Download as";
  const subtitle = isShare
    ? "This becomes the design your customer sees when they open the link."
    : isPreview
      ? "See the weblink in this design. Nothing is saved — the customer's link stays as it is."
      : "Pick a design for this download. The quotation itself stays as it is.";
  const actionLabel = isShare ? "Share" : isPreview ? "Preview" : "Download";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full rounded-2xl border border-slate-200/60 shadow-2xl"
        style={{ maxWidth: 760, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", fontFamily: FONT }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 20px 0 20px" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{heading}</div>
            <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, marginTop: 3 }}>
              {subtitle}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, padding: 20 }}>
          {STYLES.map((def) => (
            <StyleCard
              key={def.value}
              def={def}
              isSaved={(savedStyle || "CLASSIC") === def.value}
              actionLabel={actionLabel}
              onPick={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
