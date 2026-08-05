// features/calendar/components/tasksUi.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Feature-local UI primitives for the All Tasks screen.
//
// WHY THIS FILE EXISTS RATHER THAN AN IMPORT FROM marketingUi:
// per-feature kits in this app are strictly feature-local — nothing outside a feature may reach
// into its components/, and no kit is re-exported from a feature's index.js. Importing
// `@features/marketing/components/marketingUi` from the calendar feature would break that boundary
// in the one direction the rule exists to prevent. So this carries only the handful of primitives
// the tasks grid actually needs (~a tenth of marketingUi), in the same visual language:
// blue-600→indigo-500 accent, glass cards, gold row hover.
//
// The font is applied here, in <Page/>. There is no global font-family rule in the tenant app —
// omit it and the screen silently renders in the browser default.
// ─────────────────────────────────────────────────────────────────────────────
import { Inbox, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

const GLOBAL_STYLE = `
@keyframes fadeUp { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform:none;} }
.tasks-scope ::-webkit-scrollbar { height: 8px; width: 8px; }
.tasks-scope ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
.tasks-scope ::-webkit-scrollbar-track { background: transparent; }
`;

/** Page shell: gradient background, font, header row with breadcrumb + actions. */
export function Page({ icon: Icon, title, crumb, actions, children }) {
  return (
    <div
      className="tasks-scope min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: FONT }}
    >
      <style>{GLOBAL_STYLE}</style>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 truncate">{title}</h1>
              {crumb && <p className="text-xs font-bold text-slate-400 tracking-wide">{crumb}</p>}
            </div>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Glass card — the house container. */
export function Panel({ className = "", children, style }) {
  return (
    <div
      className={`bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/** `cols` is a CSS grid-template-columns string; the header, rows and skeleton all share it. */
export function GridHead({ cols, children }) {
  return (
    <div
      className="hidden md:grid items-stretch gap-0 px-5 py-3 bg-slate-50/80 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export function GridRow({ cols, index = 0, children, className = "" }) {
  return (
    <div
      className={`hidden md:grid items-stretch gap-0 px-5 py-3.5 border-b border-slate-50 transition-colors group ${className}`}
      style={{
        gridTemplateColumns: cols,
        animation: "fadeUp .35s ease both",
        animationDelay: `${index * 30}ms`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#eeda9218"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </div>
  );
}

/** `first` = left-aligned with no separator; otherwise centred with a left separator. */
export function Cell({ children, first, right, className = "" }) {
  const base = first
    ? "flex items-center pr-3 min-w-0"
    : `flex items-center ${right ? "justify-end" : "justify-center"} border-l border-slate-200/70 pl-3 min-w-0`;
  return <div className={`${base} ${className}`}>{children}</div>;
}

const TONES = {
  red:    "bg-red-100 text-red-700",
  amber:  "bg-amber-100 text-amber-700",
  green:  "bg-green-100 text-green-700",
  blue:   "bg-blue-100 text-blue-700",
  slate:  "bg-slate-100 text-slate-600",
};

export function Badge({ tone = "slate", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${TONES[tone] ?? TONES.slate} ${className}`}>
      {children}
    </span>
  );
}

export const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all hover:border-slate-300";

export function GridSkeleton({ cols, rows = 5 }) {
  return [...Array(rows)].map((_, i) => (
    <div
      key={i}
      className="hidden md:grid items-center gap-0 px-5 py-3.5 border-b border-slate-50"
      style={{ gridTemplateColumns: cols }}
    >
      {cols.split(" ").map((_, j) => (
        <div key={j} className={j === 0 ? "" : "border-l border-slate-200/70 pl-3"}>
          <div
            className="h-4 rounded-lg bg-slate-200 animate-pulse"
            style={{ width: `${45 + ((i * 7 + j * 13) % 45)}%` }}
          />
        </div>
      ))}
    </div>
  ));
}

export function GridEmpty({ icon: Icon = Inbox, title = "Nothing here yet", hint }) {
  return (
    <div className="text-center py-20 px-5">
      <div className="flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm -rotate-3">
          <Icon size={28} className="text-slate-400" />
        </div>
        <p className="text-lg font-extrabold text-slate-600 mb-1">{title}</p>
        {hint && <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">{hint}</p>}
      </div>
    </div>
  );
}

export function Pager({ page, totalPages, total, from, to, onPage }) {
  if (!total) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i)
    .filter((p) => p === 0 || p === totalPages - 1 || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-slate-400 font-medium">
        Showing <span className="font-bold text-slate-600">{from}</span> to{" "}
        <span className="font-bold text-slate-600">{to}</span> of{" "}
        <span className="font-bold text-slate-600">{total}</span> entries
      </p>
      <div className="flex items-center gap-1.5">
        <PBtn disabled={page === 0} onClick={() => onPage(0)}><ChevronsLeft className="w-3.5 h-3.5" /></PBtn>
        <PBtn disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></PBtn>
        {pages.map((p, i) =>
          typeof p === "string" ? (
            <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                page === p
                  ? "bg-gradient-to-r from-blue-600 to-indigo-500 border-blue-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {p + 1}
            </button>
          )
        )}
        <PBtn disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></PBtn>
        <PBtn disabled={page >= totalPages - 1} onClick={() => onPage(totalPages - 1)}><ChevronsRight className="w-3.5 h-3.5" /></PBtn>
      </div>
    </div>
  );
}

function PBtn({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      {children}
    </button>
  );
}
