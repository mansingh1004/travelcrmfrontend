// src/fleet/fleetUi.jsx (cn now lives in @shared/lib/cn)
// ─────────────────────────────────────────────────────────────
// Self-contained UI kit for the Fleet / Vehicle Diary module.
// Plain Tailwind only — NO shadcn / cva / @/components/ui dependency.
// Keeps every Fleet page visually consistent with the rest of the app:
//   • inline Toast (app convention — no toast library)
//   • Plus Jakarta Sans + slideIn/popIn keyframes injected per page
//   • glass cards (bg-white/80 backdrop-blur), blue-600 accents
//   • form primitives (Button, Input, Select, …) + a portal Dialog
//   • status/label config maps + safe date/money formatters
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Inbox, X, ChevronDown, ArrowLeft, LayoutGrid, List } from "lucide-react";

export { cn } from "@shared/lib/cn";
import { cn } from "@shared/lib/cn";
import { getErrorMessage } from "@shared/api/apiError";

/* ═════════════════════════════════════════════════════════════
   FORM PRIMITIVES (plain Tailwind — replace shadcn ui)
═════════════════════════════════════════════════════════════ */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON_VARIANTS = {
  default: "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  outline: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  destructive: "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700",
  success: "bg-green-600 text-white shadow-sm shadow-green-600/20 hover:bg-green-700",
  link: "text-blue-600 underline-offset-4 hover:underline",
};

const BUTTON_SIZES = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-[13px]",
  lg: "h-11 px-6",
  icon: "h-9 w-9",
};

/** App-themed button (blue-600 primary, rounded-xl). Plain <button>, no cva. */
export const Button = React.forwardRef(function Button(
  { className, variant = "default", size = "default", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.default,
        BUTTON_SIZES[size] || BUTTON_SIZES.default,
        className
      )}
      {...props}
    />
  );
});

const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap";

const BADGE_VARIANTS = {
  default: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
  purple: "bg-purple-50 text-purple-700",
};

/** Small status pill. */
export function Badge({ className, variant = "default", ...props }) {
  return (
    <span className={cn(BADGE_BASE, BADGE_VARIANTS[variant] || BADGE_VARIANTS.default, className)} {...props} />
  );
}

/** Text input — matches the app's rounded-xl, blue focus ring. Forwards ref for react-hook-form. */
export const Input = React.forwardRef(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-all",
        "focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70",
        "aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:border-red-400 aria-[invalid=true]:focus:ring-red-50",
        className
      )}
      {...props}
    />
  );
});

/** Multi-line input, styled like Input. */
export const Textarea = React.forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-all resize-y",
        "focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50",
        "aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:border-red-400 aria-[invalid=true]:focus:ring-red-50",
        className
      )}
      {...props}
    />
  );
});

/** Field label — uppercase, extrabold slate convention. `required` adds a red asterisk. */
export const Label = React.forwardRef(function Label({ className, required, children, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn(
        "mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
});

/** Native <select> wrapper with a chevron — works directly with react-hook-form register(). */
export const Select = React.forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-slate-700 transition-all",
          "hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70",
          "aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:border-red-400 aria-[invalid=true]:focus:ring-red-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
});

/* ═════════════════════════════════════════════════════════════
   TABLE PRIMITIVES (plain Tailwind — themed to the app's list look)
═════════════════════════════════════════════════════════════ */
export const Table = React.forwardRef(function Table({ className, ...props }, ref) {
  return (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
});

export const TableHeader = React.forwardRef(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn("bg-slate-50/80", className)} {...props} />;
});

export const TableBody = React.forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn(className)} {...props} />;
});

export const TableRow = React.forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn("border-t border-slate-100 transition-colors hover:bg-slate-50/60", className)}
      {...props}
    />
  );
});

export const TableHead = React.forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        "px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
});

export const TableCell = React.forwardRef(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn("px-4 py-3 text-slate-700 align-middle", className)} {...props} />;
});

/* ═════════════════════════════════════════════════════════════
   DIALOG (portal + overlay — no Radix)
   Closes on overlay click and Escape; locks body scroll while open.
═════════════════════════════════════════════════════════════ */
export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </div>,
    document.body
  );
}

export const DialogContent = React.forwardRef(function DialogContent(
  { className, children, onClose, showClose = true, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      className={cn(
        "relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl",
        className
      )}
      style={{ animation: "popIn .25s ease both" }}
      {...props}
    >
      {showClose && (
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {children}
    </div>
  );
});

export function DialogHeader({ className, ...props }) {
  return <div className={cn("px-6 pt-6 pb-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn("text-lg font-extrabold text-slate-800", className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn("mt-1 text-sm text-slate-500", className)} {...props} />;
}

export function DialogBody({ className, ...props }) {
  return <div className={cn("px-6 py-2", className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return (
    <div className={cn("flex items-center justify-end gap-2.5 px-6 pt-4 pb-6", className)} {...props} />
  );
}

/* ═════════════════════════════════════════════════════════════
   PAGE CHROME
═════════════════════════════════════════════════════════════ */

/** Font @import + shared keyframes — injected once per page (matches app pages). */
export function FleetStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
      @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
      @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
      .fade-up { animation:fadeUp .4s ease both; }

      /* Grid cell separation — same idea as AllLeads.jsx (rows + columns), but a
         complete, evenly-visible grid: one solid slate-200 on both axes so every
         line reads fully. Cells own the grid; the primitive row border is cleared. */
      .fleet-table { border-collapse: collapse; }
      .fleet-table tr { border: 0; }
      .fleet-table th,
      .fleet-table td {
        border-top: 1px solid rgb(226 232 240);    /* slate-200 — full-width row separators    */
        border-left: 1px solid rgb(226 232 240);   /* slate-200 — full-height column separators */
      }
      .fleet-table thead th { border-top: 0; }
      .fleet-table th:first-child,
      .fleet-table td:first-child { border-left: 0; }
    `}</style>
  );
}

/** Full-height gradient background + Plus Jakarta Sans, with a centered container. */
export function PageShell({ children, className }) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <FleetStyles />
      <div className={cn("mx-auto max-w-screen-2xl px-4 sm:px-6 py-6", className)}>{children}</div>
    </div>
  );
}

/** Page title + subtitle + right-aligned actions. */
export function PageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Glass surface card used to wrap tables / sections. */
export function GlassCard({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   TOAST + ERROR TEXT — re-exported from the shared modules
═════════════════════════════════════════════════════════════ */
// These used to be local to Fleet: a per-page `useToast()` holding its own useState, and an `errMsg`
// that fell back to `e.message` (an axios error's technical string: "Request failed with status code
// 500"). Both now delegate to the app-wide implementations.
//
// The signatures are unchanged, so the six Fleet pages that do
//   `const { showToast, toastNode } = useToast();` … `{toastNode}`
// keep working untouched. `toastNode` is now `null` because <ToastHost/> (mounted in App.jsx)
// renders every toast — rendering `{null}` is a no-op.
export { useToast } from "@shared/ui/toast";

/**
 * Pull a human message out of an error (falls back to a default).
 *
 * Delegates to getErrorMessage(), which — unlike the old implementation — never returns axios's
 * `.message`, so the `fallback` argument is finally reachable.
 */
export function errMsg(e, fallback = "Something went wrong.") {
  return getErrorMessage(e, fallback);
}

/* ═════════════════════════════════════════════════════════════
   STATES
═════════════════════════════════════════════════════════════ */
export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-bold text-slate-600">{title}</p>
      {hint && <p className="max-w-sm text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   CLIENT-SIDE PAGINATION (for in-memory lists — dashboard cards etc.)
═════════════════════════════════════════════════════════════ */

/**
 * Slice an in-memory array into pages. Returns the current page's items plus the
 * meta a <Pager> needs. Page auto-clamps when the underlying list shrinks/reloads.
 *
 *   const p = usePaged(rows, 5);
 *   {p.pageItems.map(...)}  <Pager {...p} onPage={p.setPage} />
 */
export function usePaged(items, pageSize = 5) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  return {
    page: safePage,
    setPage,
    totalPages,
    total,
    pageSize,
    pageItems: list.slice(start, start + pageSize),
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}

/** Page numbers with 0/last always shown and an ellipsis around the current page. */
function pageWindow(totalPages, page) {
  return Array.from({ length: totalPages }, (_, i) => i)
    .filter((p) => p === 0 || p === totalPages - 1 || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
}

function PagerNav({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PagerNum({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold transition-all",
        active
          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
      )}
    >
      {children}
    </button>
  );
}

/** Compact numbered pager for card footers. Renders nothing when there's a single page. */
export function Pager({ page, totalPages, total, from, to, onPage, className }) {
  if (!total || totalPages <= 1) return null;
  const nums = pageWindow(totalPages, page);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5",
        className
      )}
    >
      <p className="text-[11px] font-medium text-slate-400">
        Showing <span className="font-bold text-slate-600">{from}</span>–
        <span className="font-bold text-slate-600">{to}</span> of{" "}
        <span className="font-bold text-slate-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PagerNav disabled={page === 0} onClick={() => onPage(page - 1)}>‹</PagerNav>
        {nums.map((p, i) =>
          typeof p === "string" ? (
            <span key={`e${i}`} className="px-1 text-[11px] text-slate-400">
              …
            </span>
          ) : (
            <PagerNum key={p} active={p === page} onClick={() => onPage(p)}>
              {p + 1}
            </PagerNum>
          )
        )}
        <PagerNav disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>›</PagerNav>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   LIST & FORM CHROME (modern list pages + card grids + forms)
═════════════════════════════════════════════════════════════ */

/** One KPI tile. */
function StatTile({ label, value, icon: Icon, tone = "text-slate-500", accent = "bg-slate-50" }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className={cn("h-4 w-4", tone)} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xl font-extrabold leading-none text-slate-800">{value ?? 0}</p>
          <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** Responsive KPI strip — auto-fills to any tile count. `items`: [{key,label,value,icon,tone,accent}]. */
export function StatStrip({ items, className }) {
  return (
    <div
      className={cn("mb-5 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(155px,1fr))]", className)}
    >
      {items.map((s) => (
        <StatTile key={s.key ?? s.label} {...s} />
      ))}
    </div>
  );
}

/** Segmented pill filter. `options`: [{value,label,dot?}]. Empty-string value = "All". */
export function ChipBar({ options, value, onChange, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((o) => {
        const active = (value || "") === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-all",
              active
                ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {o.dot && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white/80" : o.dot)} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Build ChipBar options from a status config map ({KEY:{label,dot}}), prefixed with "All". */
export function statusChips(config, allLabel = "All") {
  return [
    { value: "", label: allLabel },
    ...Object.entries(config).map(([k, c]) => ({ value: k, label: c.label, dot: c.dot })),
  ];
}

/** Responsive card grid for entity cards. */
export function CardGrid({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

/** Card ⇄ list view switch. `value`: "grid" | "list". */
export function ViewToggle({ value, onChange, className }) {
  const opts = [
    { key: "grid", icon: LayoutGrid, title: "Card view" },
    { key: "list", icon: List, title: "List view" },
  ];
  return (
    <div className={cn("inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white p-0.5", className)}>
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            title={o.title}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
              active ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <o.icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

/** View-mode state persisted per page in localStorage (key `fleet.view.<name>`). */
export function useViewMode(name, initial = "grid") {
  const storeKey = `fleet.view.${name}`;
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(storeKey) || initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((v) => {
    setView(v);
    try {
      localStorage.setItem(storeKey, v);
    } catch { /* ignore */ }
  }, [storeKey]);
  return [view, set];
}

/** Titled form section card (icon + title + body). */
export function FormSection({ title, subtitle, icon: Icon, children, className }) {
  return (
    <GlassCard className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </GlassCard>
  );
}

/** Labelled form field wrapper — label + control + hint/error. */
export function Field({ label, required, error, hint, children, className }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-red-500">{error.message || String(error)}</p>}
    </div>
  );
}

/** Modern page header for detail/form pages — back link + icon + title + right slot. */
export function FormHeader({ backLabel = "Back", onBack, icon: Icon, title, subtitle, right }) {
  return (
    <>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
      )}
      <div className="mb-6 flex items-center gap-3">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
    </>
  );
}

/** Elevated action bar for form footers. */
export function FormActions({ children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5 rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   CONFIRM DIALOG (reusable — delete / cancel etc.)
═════════════════════════════════════════════════════════════ */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  busy = false,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════
   STATUS / LABEL CONFIG
═════════════════════════════════════════════════════════════ */
export const VEHICLE_STATUS = {
  AVAILABLE: { label: "Available", variant: "green", dot: "bg-green-500" },
  ON_TRIP: { label: "On Trip", variant: "blue", dot: "bg-blue-500" },
  MAINTENANCE: { label: "Maintenance", variant: "amber", dot: "bg-amber-500" },
  OUT_OF_SERVICE: { label: "Out of Service", variant: "red", dot: "bg-red-500" },
};

export const DRIVER_STATUS = {
  ACTIVE: { label: "Active", variant: "green", dot: "bg-green-500" },
  INACTIVE: { label: "Inactive", variant: "slate", dot: "bg-slate-400" },
};

export const TRIP_STATUS = {
  PLANNED: { label: "Planned", variant: "slate", dot: "bg-slate-400" },
  ONGOING: { label: "Ongoing", variant: "blue", dot: "bg-blue-500" },
  COMPLETED: { label: "Completed", variant: "green", dot: "bg-green-500" },
  CANCELLED: { label: "Cancelled", variant: "red", dot: "bg-red-500" },
};

export const OWNER_TYPE = {
  OWN: "Owned",
  VENDOR: "Vendor",
  RENTED: "Rented",
};

/** Status pill using the config maps above. */
export function StatusBadge({ config, value }) {
  const c = config?.[value];
  if (!c) return <Badge variant="slate">{value || "—"}</Badge>;
  return (
    <Badge variant={c.variant}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </Badge>
  );
}

/* ═════════════════════════════════════════════════════════════
   FORMATTERS (timezone-safe for LocalDate / LocalDateTime)
═════════════════════════════════════════════════════════════ */

/** "2026-07-04" or "2026-07-04T09:30:00" → "04 Jul 2026" (no TZ drift for date-only). */
export function fmtDate(value) {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "2026-07-04T09:30:00" (LocalDateTime, no Z → parsed as local) → "04 Jul 2026, 9:30 AM". */
export function fmtDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** For <input type="date"> — trims any time part. */
export function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

/** For <input type="datetime-local"> — "YYYY-MM-DDTHH:MM" (never call toISOString: it shifts to UTC). */
export function toDateTimeInput(value) {
  return value ? String(value).slice(0, 16) : "";
}

/** Local "now" as "YYYY-MM-DDTHH:MM" for datetime-local defaults. */
export function nowDateTimeInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** Local "today" as "YYYY-MM-DD" for <input type="date"> defaults (no UTC off-by-one). */
export function todayDateInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function fmtNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN") + suffix;
}

/**
 * Expiry helper for compliance docs. Returns { days, text, variant } where variant maps
 * to a Badge tone: red (expired / ≤7d), amber (≤30d), green (later), slate (none).
 */
export function expiryInfo(dateStr) {
  if (!dateStr) return { days: null, text: "—", variant: "slate" };
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(y, m - 1, d);
  const days = Math.round((target - today) / 86400000);
  if (days < 0) return { days, text: `Expired ${Math.abs(days)}d ago`, variant: "red" };
  if (days === 0) return { days, text: "Expires today", variant: "red" };
  if (days <= 7) return { days, text: `${days}d left`, variant: "red" };
  if (days <= 30) return { days, text: `${days}d left`, variant: "amber" };
  return { days, text: fmtDate(dateStr), variant: "green" };
}

/* ═════════════════════════════════════════════════════════════
   BOOKINGS-MATCHED SURFACE  (Aug 2026)
   ─────────────────────────────────────────────────────────────
   Fleet used to render flat white stat tiles and bare glass cards while Bookings — the module
   users spend most of their day in — used gradient KPI cards, a coloured top strip on every
   entity card, and the Panel/Field pair from the rebuilt Create forms. Two products in one app.

   These primitives are lifted from `bookings/pages/Allbookings.jsx` and
   `bookings/pages/CreateBookingClean.jsx` so the two modules read as one. The older exports
   (StatStrip, GlassCard) are left in place — the existing Fleet pages still use them, and
   migrating a page is a deliberate act, not a side effect of importing this file.
═════════════════════════════════════════════════════════════ */

/**
 * Gradient KPI card with a count-up, matching `Allbookings.jsx:135`.
 *
 * <p>The animation is not decoration: these numbers change while you watch (a trip closes, a
 * receipt is entered), and a value that slides makes the change visible instead of it silently
 * swapping. `money` runs the value through the INR formatter.
 *
 * Gradients are the Bookings palette, so the same colour means the same kind of thing in both
 * modules: blue = volume, green = good/settled, amber = money in, rose = money out/problem,
 * slate = derived totals.
 */
export const KPI_GRADIENTS = {
  blue: "from-blue-600 to-indigo-500",
  green: "from-green-500 to-emerald-600",
  amber: "from-amber-500 to-orange-500",
  indigo: "from-blue-700 to-indigo-600",
  rose: "from-rose-500 to-red-600",
  slate: "from-slate-600 to-slate-700",
};

export function StatCard({ label, value, icon, tone = "blue", money = false }) {
  const [disp, setDisp] = React.useState(0);
  const raf = React.useRef();

  React.useEffect(() => {
    cancelAnimationFrame(raf.current);
    const target = Number(value) || 0;
    if (!target) { setDisp(0); return; }
    const start = performance.now();
    const step = (ts) => {
      const p = Math.min((ts - start) / 1000, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(ease * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg",
        "group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        KPI_GRADIENTS[tone] || KPI_GRADIENTS.blue
      )}
    >
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute -right-2 -bottom-7 h-20 w-20 rounded-full bg-white/10" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest opacity-80">{label}</p>
          <p className="text-2xl font-extrabold leading-none sm:text-3xl">
            {money ? fmtMoney(disp) : disp}
          </p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xl">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/** Responsive KPI row. Same breakpoints as the Bookings dashboard strip. */
export function StatCardRow({ children, className }) {
  return (
    <div className={cn("mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", className)}>
      {children}
    </div>
  );
}

/**
 * Bordered section with an icon header — `CreateBookingClean.jsx:145`.
 *
 * This is the unit of a fast-entry form: one Panel per decision the user is making, so the eye
 * lands on a heading rather than a wall of inputs. `action` is the right-aligned slot (an "add
 * row" button, a toggle).
 */
export function Panel({ icon: Icon, title, description, action, children, className }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * Labelled form field — `CreateBookingClean.jsx:165`.
 *
 * Marks BOTH required and optional explicitly. That asymmetry is deliberate in the create forms:
 * an unmarked field is ambiguous, and a user who cannot tell what is mandatory fills everything or
 * abandons the form.
 */
export function FieldRow({ label, required, optional, error, hint, children, className }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
          {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * Entity card with the Bookings top strip — `Allbookings.jsx:349`.
 *
 * The 1px gradient bar is what makes a list of these read as a stack of records rather than a
 * stack of boxes. `tone` colours the strip so status is legible before any text is read.
 */
export function EntityCard({ tone = "blue", children, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "space-y-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-200",
        "hover:border-blue-200 hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className={cn("-mx-4 -mt-4 mb-3 h-1 rounded-t-2xl bg-gradient-to-r",
        KPI_GRADIENTS[tone] || KPI_GRADIENTS.blue)} />
      {children}
    </div>
  );
}

/** Code chip — the `BKG-25-0042` treatment, reused for vehicle numbers and receipt references. */
export function CodeChip({ children, className }) {
  return (
    <span className={cn(
      "rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-extrabold text-blue-600",
      className)}>
      {children}
    </span>
  );
}

/** Small key/value tile used inside cards and modals — `Allbookings.jsx:403`. */
export function MiniStat({ label, value, className }) {
  return (
    <div className={cn("rounded-xl border border-slate-100 bg-slate-50 px-3 py-2", className)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-bold text-slate-700">{value ?? "—"}</p>
    </div>
  );
}
