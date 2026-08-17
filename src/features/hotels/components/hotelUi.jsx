// src/features/hotels/components/hotelUi.jsx
// ─────────────────────────────────────────────────────────────
// Self-contained UI kit for the Hotel Management module.
// Mirrors the app's design system 1:1 (same tokens as fleetUi.jsx):
//   • Plain Tailwind only — NO shadcn / cva dependency
//   • glass cards (bg-white/80 backdrop-blur), blue-600 accents, rounded-2xl
//   • Plus Jakarta Sans + shared keyframes injected per page
//   • inline Toast facade (app convention — no toast library)
//   • form primitives, portal Dialog, status maps + safe formatters
// Nothing outside this feature imports from here — the module's public
// surface is `../index.js`.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Inbox, X, ChevronDown, ArrowLeft, LayoutGrid, List, Star } from "lucide-react";

export { cn } from "@shared/lib/cn";
import { cn } from "@shared/lib/cn";
import { getErrorMessage } from "@shared/api/apiError";

/* ═════════════════════════════════════════════════════════════
   FORM PRIMITIVES (plain Tailwind — app themed)
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
  teal: "bg-teal-50 text-teal-700",
  indigo: "bg-indigo-50 text-indigo-700",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span className={cn(BADGE_BASE, BADGE_VARIANTS[variant] || BADGE_VARIANTS.default, className)} {...props} />
  );
}

export const Input = React.forwardRef(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-all",
        "focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-all resize-y",
        "focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50",
        className
      )}
      {...props}
    />
  );
});

export const Label = React.forwardRef(function Label({ className, required, children, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn("mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
});

export const Select = React.forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-slate-700 transition-all",
          "hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70",
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
   TABLE PRIMITIVES
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
    <tr ref={ref} className={cn("border-t border-slate-100 transition-colors hover:bg-slate-50/60", className)} {...props} />
  );
});
export const TableHead = React.forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn("px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap", className)}
      {...props}
    />
  );
});
export const TableCell = React.forwardRef(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn("px-4 py-3 text-slate-700 align-middle", className)} {...props} />;
});

/* ═════════════════════════════════════════════════════════════
   DIALOG (portal + overlay)
═════════════════════════════════════════════════════════════ */
export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onOpenChange?.(false); };
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
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => onOpenChange?.(false)} />
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
      className={cn("relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl", className)}
      style={{ animation: "hpopIn .25s ease both" }}
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

export function DialogHeader({ className, ...props }) { return <div className={cn("px-6 pt-6 pb-4", className)} {...props} />; }
export function DialogTitle({ className, ...props }) { return <h2 className={cn("text-lg font-extrabold text-slate-800", className)} {...props} />; }
export function DialogDescription({ className, ...props }) { return <p className={cn("mt-1 text-sm text-slate-500", className)} {...props} />; }
export function DialogBody({ className, ...props }) { return <div className={cn("px-6 py-2", className)} {...props} />; }
export function DialogFooter({ className, ...props }) {
  return <div className={cn("flex items-center justify-end gap-2.5 px-6 pt-4 pb-6", className)} {...props} />;
}

/* ═════════════════════════════════════════════════════════════
   PAGE CHROME
═════════════════════════════════════════════════════════════ */
export function HotelStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
      @keyframes hfadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes hpopIn  { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
      .hfade-up { animation:hfadeUp .4s ease both; }
      @keyframes hshimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
      .hskeleton { background:linear-gradient(90deg,#eef2f7 25%,#e2e8f0 37%,#eef2f7 63%); background-size:800px 100%; animation:hshimmer 1.4s ease-in-out infinite; }
    `}</style>
  );
}

/** Full-height gradient background + Plus Jakarta Sans, centered container. */
export function PageShell({ children, className }) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <HotelStyles />
      <div className={cn("mx-auto max-w-screen-2xl px-4 sm:px-6 py-6", className)}>{children}</div>
    </div>
  );
}

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

export function GlassCard({ className, children, ...props }) {
  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md", className)} {...props}>
      {children}
    </div>
  );
}

/** Card section with an icon header + body. */
export function SectionCard({ title, subtitle, icon: Icon, right, children, className, bodyClass }) {
  return (
    <GlassCard className={cn("overflow-hidden", className)}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
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
          {right}
        </div>
      )}
      <div className={cn("p-5", bodyClass)}>{children}</div>
    </GlassCard>
  );
}

/* ═════════════════════════════════════════════════════════════
   TOAST + ERROR
═════════════════════════════════════════════════════════════ */
export { useToast } from "@shared/ui/toast";
export function errMsg(e, fallback = "Something went wrong.") { return getErrorMessage(e, fallback); }

/* ═════════════════════════════════════════════════════════════
   STATES + SKELETONS
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

/** Shimmer block for loading skeletons. */
export function Skeleton({ className }) {
  return <div className={cn("hskeleton rounded-lg", className)} />;
}

/** A grid of skeleton cards — a graceful loading state matching the KPI/card layout. */
export function SkeletonCards({ count = 4, className }) {
  return (
    <div className={cn("grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white/70 p-5">
          <Skeleton className="mb-3 h-10 w-10 rounded-xl" />
          <Skeleton className="mb-2 h-6 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   CLIENT-SIDE PAGINATION
═════════════════════════════════════════════════════════════ */
export function usePaged(items, pageSize = 8) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(0);
  useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  return {
    page: safePage, setPage, totalPages, total, pageSize,
    pageItems: list.slice(start, start + pageSize),
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}

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
    <button type="button" disabled={disabled} onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}
function PagerNum({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold transition-all",
        active ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600")}>
      {children}
    </button>
  );
}
export function Pager({ page, totalPages, total, from, to, onPage, className }) {
  if (!total || totalPages <= 1) return null;
  const nums = pageWindow(totalPages, page);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5", className)}>
      <p className="text-[11px] font-medium text-slate-400">
        Showing <span className="font-bold text-slate-600">{from}</span>–<span className="font-bold text-slate-600">{to}</span> of{" "}
        <span className="font-bold text-slate-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PagerNav disabled={page === 0} onClick={() => onPage(page - 1)}>‹</PagerNav>
        {nums.map((p, i) =>
          typeof p === "string" ? (
            <span key={`e${i}`} className="px-1 text-[11px] text-slate-400">…</span>
          ) : (
            <PagerNum key={p} active={p === page} onClick={() => onPage(p)}>{p + 1}</PagerNum>
          )
        )}
        <PagerNav disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>›</PagerNav>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   KPI TILES + FILTER CHROME
═════════════════════════════════════════════════════════════ */
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
export function StatStrip({ items, className }) {
  return (
    <div className={cn("grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]", className)}>
      {items.map((s) => <StatTile key={s.key ?? s.label} {...s} />)}
    </div>
  );
}

/** Big gradient headline KPI card (dashboard hero row). */
export function GradientStat({ gradient, icon: Icon, label, value, sub }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 text-white shadow-lg", gradient)}>
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative z-10">
        {Icon && (
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <p className="text-3xl font-extrabold leading-none">{value ?? 0}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest opacity-80">{label}</p>
        {sub && <p className="mt-1 text-[11px] font-medium opacity-70">{sub}</p>}
      </div>
    </div>
  );
}

export function ChipBar({ options, value, onChange, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((o) => {
        const active = (value || "") === o.value;
        return (
          <button key={o.value || "all"} type="button" onClick={() => onChange(o.value)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-all",
              active ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                     : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700")}>
            {o.dot && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white/80" : o.dot)} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
export function statusChips(config, allLabel = "All") {
  return [{ value: "", label: allLabel }, ...Object.entries(config).map(([k, c]) => ({ value: k, label: c.label, dot: c.dot }))];
}

export function CardGrid({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", className)}>{children}</div>
  );
}

export function ViewToggle({ value, onChange, className }) {
  const opts = [{ key: "grid", icon: LayoutGrid, title: "Card view" }, { key: "list", icon: List, title: "List view" }];
  return (
    <div className={cn("inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white p-0.5", className)}>
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button key={o.key} type="button" title={o.title} onClick={() => onChange(o.key)}
            className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-all",
              active ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}>
            <o.icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
export function useViewMode(name, initial = "grid") {
  const storeKey = `hotel.view.${name}`;
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(storeKey) || initial; } catch { return initial; }
  });
  const set = useCallback((v) => {
    setView(v);
    try { localStorage.setItem(storeKey, v); } catch { /* ignore */ }
  }, [storeKey]);
  return [view, set];
}

export function FormHeader({ backLabel = "Back", onBack, icon: Icon, title, subtitle, right }) {
  return (
    <>
      {onBack && (
        <button onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600">
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

/* ═════════════════════════════════════════════════════════════
   RATING (★) — reused across list, details, reviews
═════════════════════════════════════════════════════════════ */
export function StarRating({ value = 0, size = 16, showValue = false, className }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} title={`${value} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < full;
        const isHalf = i === full && half;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-slate-200" style={{ width: size, height: size }} fill="currentColor" />
            {(active || isHalf) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: isHalf ? size / 2 : size }}>
                <Star className="text-amber-400" style={{ width: size, height: size }} fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
      {showValue && <span className="ml-1 text-xs font-bold text-slate-600">{Number(value).toFixed(1)}</span>}
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════
   STATUS / LABEL CONFIG
═════════════════════════════════════════════════════════════ */
export const HOTEL_STATUS = {
  ACTIVE: { label: "Active", variant: "green", dot: "bg-green-500" },
  INACTIVE: { label: "Inactive", variant: "slate", dot: "bg-slate-400" },
  MAINTENANCE: { label: "Maintenance", variant: "amber", dot: "bg-amber-500" },
};

export const ROOM_STATUS = {
  ACTIVE: { label: "Active", variant: "green", dot: "bg-green-500" },
  INACTIVE: { label: "Inactive", variant: "slate", dot: "bg-slate-400" },
  SOLD_OUT: { label: "Sold Out", variant: "red", dot: "bg-red-500" },
};

export const BOOKING_STATUS = {
  CONFIRMED: { label: "Confirmed", variant: "blue", dot: "bg-blue-500" },
  CHECKED_IN: { label: "Checked In", variant: "green", dot: "bg-green-500" },
  CHECKED_OUT: { label: "Checked Out", variant: "slate", dot: "bg-slate-400" },
  CANCELLED: { label: "Cancelled", variant: "red", dot: "bg-red-500" },
  PENDING: { label: "Pending", variant: "amber", dot: "bg-amber-500" },
};

export const PAYMENT_STATUS = {
  PAID: { label: "Paid", variant: "green", dot: "bg-green-500" },
  PENDING: { label: "Pending", variant: "amber", dot: "bg-amber-500" },
  REFUNDED: { label: "Refunded", variant: "purple", dot: "bg-purple-500" },
  FAILED: { label: "Failed", variant: "red", dot: "bg-red-500" },
};

export const HK_STATUS = {
  READY: { label: "Ready", variant: "green", dot: "bg-green-500" },
  CLEANING: { label: "Cleaning", variant: "blue", dot: "bg-blue-500" },
  DIRTY: { label: "Dirty", variant: "amber", dot: "bg-amber-500" },
  INSPECTED: { label: "Inspected", variant: "teal", dot: "bg-teal-500" },
  MAINTENANCE: { label: "Maintenance", variant: "red", dot: "bg-red-500" },
};

export const ROOM_STATE = {
  AVAILABLE: { label: "Available", variant: "green", dot: "bg-green-500" },
  OCCUPIED: { label: "Occupied", variant: "blue", dot: "bg-blue-500" },
  CLEANING: { label: "Cleaning", variant: "amber", dot: "bg-amber-500" },
  MAINTENANCE: { label: "Maintenance", variant: "red", dot: "bg-red-500" },
  BLOCKED: { label: "Blocked", variant: "slate", dot: "bg-slate-500" },
};

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
   FORMATTERS (timezone-safe)
═════════════════════════════════════════════════════════════ */
export function fmtDate(value) {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
export function fmtMoney(value, currency = "₹") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return currency + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
export function fmtMoneyShort(value, currency = "₹") {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e7) return `${currency}${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `${currency}${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `${currency}${(n / 1e3).toFixed(1)}k`;
  return currency + n.toLocaleString("en-IN");
}
export function fmtNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN") + suffix;
}
export function fmtPct(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Math.round(Number(value))}%`;
}
