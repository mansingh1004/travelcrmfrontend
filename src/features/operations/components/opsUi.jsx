// features/operations/components/opsUi.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Feature-local UI primitives for the Operations screen.
//
// The shell primitives are the same shape as tasksUi.jsx, copied rather than imported:
// per-feature kits in this app are strictly feature-local, and nothing outside a feature
// may reach into its components/. Same visual language — blue-600→indigo-500 accent,
// glass cards, gold row hover.
//
// What is NEW here is the bottom half: readiness dots and the travel span bar. Those are
// what make this an operations screen rather than another list of bookings.
//
// The font is applied in <Page/>. There is no global font-family rule in the tenant app —
// omit it and the screen silently renders in the browser default.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Inbox, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Bed, Car, FileText, Camera, Wallet, User, Boxes, PlaneTakeoff,
} from "lucide-react";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

const GLOBAL_STYLE = `
@keyframes fadeUp { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform:none;} }
@keyframes slideIn { from { opacity:0; transform: translateX(24px);} to {opacity:1; transform:none;} }
.ops-scope ::-webkit-scrollbar { height: 8px; width: 8px; }
.ops-scope ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
.ops-scope ::-webkit-scrollbar-track { background: transparent; }
`;

export function Page({ icon: Icon, title, crumb, actions, children }) {
  return (
    <div
      className="ops-scope min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: FONT }}
    >
      <style>{GLOBAL_STYLE}</style>
      {/* Full-bleed, unlike the other list screens in this app. An operations board is a
          wide table of departures against a calendar; capping it at 1600px leaves the
          readiness columns cramped on exactly the large monitors this screen lives on. */}
      <div className="w-full px-4 sm:px-6 py-6">
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

export function GridRow({ cols, index = 0, children, className = "", onClick, active }) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`hidden md:grid items-stretch gap-0 px-5 py-3.5 border-b border-slate-50 transition-colors group ${
        onClick ? "cursor-pointer" : ""
      } ${active ? "ring-1 ring-inset ring-blue-300" : ""} ${className}`}
      style={{
        gridTemplateColumns: cols,
        animation: "fadeUp .35s ease both",
        animationDelay: `${index * 30}ms`,
        background: active ? "#eeda9226" : undefined,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#eeda9218"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </div>
  );
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   Operations-specific primitives
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The dimensions a row reports on, in the order they are worked through.
 *
 * Server-driven values; this map only decides how each is drawn. A dimension the
 * server adds later renders with a fallback icon rather than disappearing.
 */
export const DIMENSIONS = [
  { key: "HOTEL",      label: "Hotel",      Icon: Bed },
  { key: "VEHICLE",    label: "Vehicle",    Icon: Car },
  { key: "ACTIVITIES", label: "Sightseeing", Icon: Camera },
  // The long-haul leg, split from VEHICLE server-side so the Vehicle column can mean vehicles.
  { key: "TRAVEL",     label: "Travel",     Icon: PlaneTakeoff },
  { key: "DOCUMENTS",  label: "Documents",  Icon: FileText },
  // Everything the server's service-type tokens do not recognise — meals, cruises, whatever an
  // agency invents. It has to be listed here or it is computed and then never drawn, which is
  // the state it was invisible in before.
  { key: "OTHER",      label: "Other",      Icon: Boxes },
  { key: "GUIDE",      label: "Guide",      Icon: User },
  { key: "PAYMENT",    label: "Payment",    Icon: Wallet },
];

/**
 * The three the table gives a column of its own.
 *
 * The rest still count towards Overall Status and still appear in the expanded row — they
 * simply do not each get a column, because nine columns of dots is not a glance. Overall
 * Status is computed server-side over ALL dimensions, so a row can read green across these
 * three and still say ACTION NEEDED; that is not a bug, and the expanded row says why.
 */
export const COLUMN_DIMENSIONS = [
  { key: "HOTEL",      label: "Hotel",       Icon: Bed },
  { key: "VEHICLE",    label: "Vehicle",     Icon: Car },
  { key: "ACTIVITIES", label: "Sightseeing", Icon: Camera },
];

/**
 * Readiness → colour.
 *
 * NOT_APPLICABLE is deliberately the faintest thing on the row rather than a
 * fourth colour competing for attention: it means "this booking does not need
 * this", and drawing it loudly is how a column becomes noise people skip.
 */
export const READINESS_STYLE = {
  READY:          { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Ready" },
  IN_PROGRESS:    { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 ring-amber-200",       label: "In progress" },
  NOT_STARTED:    { dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 ring-rose-200",          label: "Not started" },
  NOT_APPLICABLE: { dot: "bg-slate-200",   chip: "bg-slate-50 text-slate-400 ring-slate-200",       label: "Not needed" },
};

const fallbackStyle = READINESS_STYLE.NOT_APPLICABLE;

/** A row of readiness dots — the whole point of the board, in about 100 pixels. */
export function ReadinessDots({ readiness = {} }) {
  return (
    <div className="flex items-center gap-1.5">
      {DIMENSIONS.map(({ key, label, Icon }) => {
        const status = readiness[key] ?? "NOT_APPLICABLE";
        const style = READINESS_STYLE[status] ?? fallbackStyle;
        return (
          <span
            key={key}
            title={`${label}: ${style.label}`}
            aria-label={`${label}: ${style.label}`}
            className="relative inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white border border-slate-200"
          >
            <Icon size={12} className="text-slate-400" />
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white ${style.dot}`} />
          </span>
        );
      })}
    </div>
  );
}

/** Full-width chips for the detail panel, where there is room to spell it out. */
export function ReadinessList({ readiness = {} }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DIMENSIONS.map(({ key, label, Icon }) => {
        const status = readiness[key] ?? "NOT_APPLICABLE";
        const style = READINESS_STYLE[status] ?? fallbackStyle;
        return (
          <div
            key={key}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ${style.chip}`}
          >
            <Icon size={14} />
            <span className="text-xs font-bold truncate">{label}</span>
            <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * One dimension in a table cell: a word, and the count behind it.
 *
 * The word is the worst case across that dimension's lines and the count is the arithmetic —
 * "PENDING · 3 of 4" says both "not done" and "nearly done", which a single badge cannot. A
 * dimension with no lines reads NOT ARRANGED rather than a blank cell: nothing arranged is a
 * state, and an empty cell reads as a rendering failure.
 */
export function DimensionCell({ status, count }) {
  const total = count?.total ?? 0;
  const confirmed = count?.confirmed ?? 0;

  const style =
    status === "READY"       ? { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "CONFIRMED" }
    : status === "IN_PROGRESS" ? { chip: "bg-amber-50 text-amber-700 ring-amber-200",     label: "PENDING" }
    : status === "NOT_STARTED" ? { chip: "bg-rose-50 text-rose-700 ring-rose-200",        label: "PENDING" }
    : { chip: "bg-rose-50 text-rose-700 ring-rose-200", label: "NOT ARRANGED" };

  // NOT_APPLICABLE with zero lines is "nothing arranged"; with lines it is genuinely not needed.
  const notNeeded = status === "NOT_APPLICABLE" && total > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`inline-flex items-center text-[10px] font-extrabold tracking-wide px-2 py-1 rounded-md ring-1 ${
          notNeeded ? "bg-slate-50 text-slate-400 ring-slate-200" : style.chip
        }`}
      >
        {notNeeded ? "NOT NEEDED" : style.label}
      </span>
      {total > 0 && (
        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
          {confirmed} of {total}
        </span>
      )}
    </div>
  );
}

/**
 * The row's one-word verdict, computed server-side over EVERY dimension.
 *
 * Deliberately not derived in the browser from the three columns beside it. Those are three of
 * eight, and a row can be green across all three while a visa nobody has applied for sits in the
 * expanded panel. The server owns this because the server is the only one that sees all of it.
 */
export function OverallBadge({ status }) {
  const style =
    status === "READY"   ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "URGENT" ? "bg-rose-50 text-rose-700 ring-rose-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";

  const label =
    status === "READY" ? "READY" : status === "URGENT" ? "URGENT" : "ACTION NEEDED";

  return (
    <span className={`inline-flex items-center text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-md ring-1 ${style}`}>
      {label}
    </span>
  );
}

/**
 * One of the figures across the top of the board.
 *
 * `hint` carries what the number is OF — "40% of total", "Traveling today / tomorrow". A bare
 * count invites the reader to invent a denominator, and they invent the wrong one.
 */
export function SummaryCard({ icon: Icon, tone = "blue", label, value, hint, loading, onClick, active }) {
  const tones = {
    blue:    "bg-blue-50 text-blue-600 ring-blue-100",
    green:   "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber:   "bg-amber-50 text-amber-600 ring-amber-100",
    red:     "bg-rose-50 text-rose-600 ring-rose-100",
    indigo:  "bg-indigo-50 text-indigo-600 ring-indigo-100",
  };
  const rings = {
    blue: "ring-blue-400", green: "ring-emerald-400", amber: "ring-amber-400",
    red: "ring-rose-400", indigo: "ring-indigo-400",
  };

  // A card that filters has to look like it does. Pressed state is a ring in the card's own
  // colour rather than a fill: the number is what people read, and inverting the card makes
  // the one figure they came for the hardest to see.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border shadow-sm min-w-0 text-left transition-all ${
        active
          ? `border-transparent ring-2 ${rings[tone] ?? rings.blue} shadow-md`
          : "border-slate-200/60 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <span className={`shrink-0 w-11 h-11 rounded-xl grid place-items-center ring-1 ${tones[tone] ?? tones.blue}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-slate-500 truncate">{label}</p>
        <p className="text-xl font-extrabold text-slate-800 tabular-nums leading-tight">
          {loading ? <span className="text-slate-300">·</span> : value}
        </p>
        {hint && <p className="text-[10px] font-bold text-slate-400 truncate">{hint}</p>}
      </div>
    </button>
  );
}

/**
 * Days-to-departure, coloured by how close it is.
 *
 * Past departures read "in progress" rather than a negative number: the board
 * keeps showing a trip while it is being delivered, and "-3 days" reads as an
 * error to anyone scanning quickly.
 */
export function DaysBadge({ days }) {
  if (days == null) return <span className="text-slate-400">—</span>;
  if (days < 0) return <Badge tone="blue">In progress</Badge>;
  if (days === 0) return <Badge tone="red">Today</Badge>;
  if (days === 1) return <Badge tone="red">Tomorrow</Badge>;
  if (days <= 3) return <Badge tone="amber">{days} days</Badge>;
  return <Badge tone="slate">{days} days</Badge>;
}

/**
 * The travel span as a bar, positioned inside the visible window.
 *
 * A booking with no end date draws a single-day tick rather than a bar that runs
 * to the edge — the honest rendering of "we do not know when this comes back".
 */
export function SpanBar({ start, end, windowStart, windowEnd }) {
  const dayMs = 86400000;
  const toDay = (v) => Math.floor(new Date(`${v}T00:00:00`).getTime() / dayMs);

  if (!start || !windowStart || !windowEnd) return null;

  const w0 = toDay(windowStart);
  const w1 = toDay(windowEnd);
  const total = Math.max(1, w1 - w0);

  const s = Math.max(w0, toDay(start));
  const e = end ? Math.min(w1, Math.max(s, toDay(end))) : s;

  const left = ((s - w0) / total) * 100;
  const width = Math.max(2.5, ((e - s) / total) * 100);

  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden" title={end ? `${start} → ${end}` : start}>
      <div
        className="absolute top-0 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}
