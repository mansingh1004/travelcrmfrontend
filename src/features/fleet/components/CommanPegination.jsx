import { memo, useMemo } from "react";

function buildPageNumbers(totalPages, pageIndex) {
  return Array.from({ length: totalPages }, (_, i) => i)
    .filter(p => p === 0 || p === totalPages - 1 || Math.abs(p - pageIndex) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
}

const NavButton = memo(function NavButton({ label, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold
        hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
    >
      {label}
    </button>
  );
});

const PageButton = memo(function PageButton({ page, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border shrink-0 flex items-center justify-center ${
        isActive
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
      }`}
    >
      {page + 1}
    </button>
  );
});

/**
 * CommonPagination
 * Reusable across Bookings, Leads, Customers, Suppliers, Payments, etc.
 *
 * @param {number}   pageIndex
 * @param {number}   pageSize
 * @param {number}   totalElements
 * @param {number}   totalPages
 * @param {function} goToPage
 * @param {function} changePageSize
 */
function CommonPagination({ pageIndex, pageSize, totalElements, totalPages, goToPage, changePageSize }) {
  const from = pageIndex * pageSize + 1;
  const to   = Math.min((pageIndex + 1) * pageSize, totalElements);

  const pageNumbers = useMemo(
    () => buildPageNumbers(totalPages, pageIndex),
    [totalPages, pageIndex],
  );

  if (totalElements === 0) return null;

  const isFirst = pageIndex === 0;
  const isLast  = pageIndex >= totalPages - 1;

  return (
    <div className="px-4 sm:px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col lg:flex-row items-center justify-between gap-4">
      <p className="text-xs text-slate-400 font-medium text-center lg:text-left w-full lg:w-auto">
        Showing{" "}
        <span className="font-bold text-slate-600">{from}</span>–<span className="font-bold text-slate-600">{to}</span>
        {" "}of{" "}
        <span className="font-bold text-slate-600">{totalElements}</span>
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full lg:w-auto">
        {/* Buttons wrapper with flex-wrap to prevent overflow */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <NavButton label="«" onClick={() => goToPage(0)}             disabled={isFirst} />
          <NavButton label="‹" onClick={() => goToPage(pageIndex - 1)} disabled={isFirst} />

          {pageNumbers.map((p, i) =>
            typeof p === "string"
              ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 shrink-0">…</span>
              : <PageButton key={p} page={p} isActive={pageIndex === p} onClick={() => goToPage(p)} />
          )}

          <NavButton label="›" onClick={() => goToPage(pageIndex + 1)} disabled={isLast} />
          <NavButton label="»" onClick={() => goToPage(totalPages - 1)} disabled={isLast} />
        </div>

        {/* Page size select drops below the buttons on tiny screens */}
        <select
          value={pageSize}
          onChange={e => changePageSize(Number(e.target.value))}
          className="h-8 px-2 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium bg-white focus:border-blue-400 outline-none cursor-pointer w-full sm:w-auto text-center sm:text-left"
        >
          {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
    </div>
  );
}

export default memo(CommonPagination);