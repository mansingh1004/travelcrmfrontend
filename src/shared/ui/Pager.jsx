import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination control for any list driven by `usePagedList`.
 *
 * Deliberately dumb: it renders what the SERVER reported (`PaginationMeta`) and reports clicks
 * back. It never slices rows itself — a pager that paginates in the browser is exactly the bug
 * this component exists to remove.
 */
export function Pager({
  page,               // 0-based, as the API uses
  totalPages = 0,
  total = 0,
  pageSize = 25,
  onPage,
  onPageSize,
  loading = false,
  sizeOptions = [10, 25, 50, 100],
  label = "records",
}) {
  // One page and nothing hidden ⇒ the control is noise.
  if (totalPages <= 1 && total <= pageSize) return null;

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to   = Math.min(total, (page + 1) * pageSize);
  const canPrev = page > 0 && !loading;
  const canNext = page + 1 < totalPages && !loading;

  const btn = "inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 " +
              "text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3">
      <p className="text-sm font-medium text-slate-500">
        Showing <span className="font-bold text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-bold text-slate-700">{total}</span> {label}
      </p>

      <div className="flex items-center gap-2">
        {onPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
            aria-label="Rows per page"
          >
            {sizeOptions.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}

        <button type="button" className={btn} disabled={!canPrev} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={16} /> Prev
        </button>

        <span className="px-2 text-sm font-bold text-slate-600">
          {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>

        <button type="button" className={btn} disabled={!canNext} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default Pager;
