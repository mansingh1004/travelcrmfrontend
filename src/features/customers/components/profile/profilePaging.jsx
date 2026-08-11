import { useEffect, useMemo, useState } from "react";

/**
 * Client-side paging and the small-screen card list, for the profile's seven list surfaces.
 *
 * ── Why paging happens in the browser ────────────────────────────────────────────────────────
 * Every profile section endpoint returns an UNBOUNDED list — bookings, leads, payments, invoices,
 * campaigns and drip enrolments all come back whole. A customer with four hundred payments shipped
 * four hundred rows into the DOM and rendered every one of them. Slicing here fixes the render
 * cost, which is the half that hurts today; it does not fix the transfer cost, and cannot from the
 * client. Server-side paging on those endpoints is a backend change and is listed as a dependency.
 *
 * `@shared/ui/Pager` is reused for the control itself. Note its own docstring says it "renders what
 * the SERVER reported" and warns against browser-side pagination — that warning is aimed at a pager
 * that slices its own rows, which this one still does not. The slicing lives in useClientPage, and
 * every call site says out loud that the meta is client-derived.
 */

const DEFAULT_SIZE = 25;

export function useClientPage(rows, initialSize = DEFAULT_SIZE) {
  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Deleting rows or shrinking the page size can strand the viewer past the end — an empty table
  // with a "3 / 2" pager reads as a failure rather than as arithmetic.
  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [page, totalPages]);

  const slice = useMemo(
    () => list.slice(page * pageSize, page * pageSize + pageSize),
    [list, page, pageSize],
  );

  return {
    slice,
    total,
    totalPages,
    page,
    pageSize,
    onPage: setPage,
    onPageSize: (size) => { setPageSize(size); setPage(0); },
  };
}

/**
 * The phone rendering of a table.
 *
 * Wide tables stay horizontally scrollable on desktop — hiding columns is not on the table — but a
 * 760px-wide grid on a 375px screen is a two-handed operation, so each row becomes a card instead.
 * Bookings already did this; four other tabs did not, and the inconsistency was arbitrary.
 *
 * `render` returns the card's body, so each tab keeps ownership of its own fields.
 */
export function MobileList({ rows, render, rowKey }) {
  return (
    <div className="space-y-3 p-4 md:hidden">
      {rows.map((row, index) => (
        <article
          key={rowKey ? rowKey(row, index) : (row.id ?? index)}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          {render(row, index)}
        </article>
      ))}
    </div>
  );
}

/** A label/value pair inside a card. Values keep tabular-nums so columns of money still line up. */
export function CardFact({ label, value, tone = "text-slate-700", className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** The 2-up grid the card facts sit in — one definition so the five card lists match. */
export function CardFacts({ children }) {
  return <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">{children}</div>;
}
