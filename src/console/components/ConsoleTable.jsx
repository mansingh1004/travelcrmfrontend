import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2, SearchX, AlertTriangle, Inbox } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

/**
 * The console's one table.
 *
 * CONSOLE-ONLY, deliberately. The tenant app has its own table conventions and its own palette; this
 * one is built on the `.sa-console` semantic tokens (`bg-surface`, `border-border`, `text-heading`,
 * `ring-focus`) so it inherits light/dark correctly and can never drag tenant styling into god-mode.
 * TanStack Table is the engine only — it is already a dependency and owns sort/row state; every pixel
 * here is ours.
 *
 * DESIGN — quiet chrome, high density. The console's existing tables tint the header
 * (`bg-surface-hover`), left-align money, and mostly do not stick. All three are reversed here:
 *
 *   - the header is `bg-surface` with a single hairline, because a tinted bar is chrome competing
 *     with the data it labels; weight and letter-spacing carry the hierarchy instead
 *   - numeric columns are right-aligned with `tabular-nums`, so digits line up down the column and
 *     amounts can be compared by eye rather than read one at a time
 *   - the header sticks, because on any list longer than a screen the operator otherwise scrolls the
 *     column names away and is left reading unlabelled columns
 *   - no zebra striping: at this density it is noise, and a hairline already separates rows
 *
 * Colour is spent on state, never on the table itself — a selected row gets a 2px accent bar rather
 * than a full tint, because tinting a whole row reads as "this one is wrong".
 *
 * NOT VIRTUALISED, on purpose. Virtualisation earns its complexity past ~10k rows; the platform runs
 * ten tenants. Paging stays server-side where the endpoint supports it.
 */

/** Row height. One console-wide choice rather than a per-table guess. */
const DENSITY = {
  comfortable: { cell: "px-4 py-3", head: "px-4 py-2.5" },
  compact: { cell: "px-4 py-2", head: "px-4 py-2" },
};

/**
 * @param columns  TanStack column defs. Two extras are read from `meta`:
 *                   meta.numeric  → right-align + tabular-nums
 *                   meta.mono     → monospace, muted (ids, codes, references)
 * @param rows     the page of data already fetched
 * @param state    "loading" | "error" | "ready"
 * @param onRowClick optional; makes rows focusable and keyboard-activatable
 */
export function ConsoleTable({
  columns,
  rows,
  state = "ready",
  error = "",
  onRetry,
  onRowClick,
  isRowActive,
  density = "comfortable",
  emptyTitle = "Nothing here yet",
  emptyHint,
  /** True when the operator has a filter/search applied — changes empty copy from "none" to "no match". */
  filtered = false,
  stickyHeader = true,
  initialSorting = [],
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const skin = DENSITY[density] ?? DENSITY.comfortable;

  const table = useReactTable({
    data: rows ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const colCount = columns.length;

  return (
    /* The scroll container, not the page. A wide table scrolls inside its own frame so the console
       shell never gains a horizontal scrollbar. */
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="min-w-full border-collapse text-sm">
        <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          {table.getHeaderGroups().map((group) => (
            /* The console's own signature, not a grey bar: `--sa-gradient-soft` is the violet→pink
               wash the brand already uses on the dashboard hero, and it is defined in BOTH the light
               and dark token blocks, so it flips correctly instead of becoming a pale smear on dark.
               Using the token rather than a raw shade is also what keeps this from ever resembling
               the tenant app's blue chrome — the two palettes cannot collide.
               A slightly stronger accent-tinted rule underneath gives the bar a hard edge; a gradient
               fading into the first row with only a hairline reads as a smudge. */
            <tr
              key={group.id}
              className="border-b-2 border-accent/25"
              style={{ backgroundImage: "var(--sa-gradient-soft)" }}
            >
              {group.headers.map((header) => {
                const numeric = header.column.columnDef.meta?.numeric;
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                    /* 12px, not 11: a header is read at a glance and the extra pixel is the difference
                       between scanning and squinting. Bold + wide tracking on a tinted bar is what
                       makes it read as a label rather than as another row of data. */
                    className={`${skin.head} text-xs font-bold uppercase tracking-wide text-accent-soft-text ${
                      numeric ? "text-right" : "text-left"
                    }`}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        /* -mx-1.5 px-1.5 widens the hit area past the text without moving the label,
                           so the column heading lines up with the cells under it. */
                        className={`group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                          numeric ? "flex-row-reverse" : ""
                        }`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {/* Invisible until it is useful — hover, or actively sorted. A column of
                            permanent arrows is chrome on every single header. */}
                        {dir === "asc" ? <ArrowUp size={12} />
                          : dir === "desc" ? <ArrowDown size={12} />
                          : <ChevronsUpDown size={12} className="opacity-0 transition-opacity group-hover:opacity-50" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {state === "loading" && <SkeletonRows cols={colCount} skin={skin} />}

          {state === "error" && (
            <StateRow cols={colCount} Icon={AlertTriangle} tone="text-hue-rose"
              title="Could not load this list"
              hint={error || "Something went wrong."}
              action={onRetry && (
                <button type="button" onClick={onRetry}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus mt-3 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-heading hover:bg-surface-hover">
                  Try again
                </button>
              )} />
          )}

          {state === "ready" && table.getRowModel().rows.length === 0 && (
            /* "No results for this filter" and "nothing exists yet" are different facts and lead to
               different next actions — clearing a filter versus creating the first record. */
            <StateRow cols={colCount} Icon={filtered ? SearchX : Inbox} tone="text-muted"
              title={filtered ? "No matches" : emptyTitle}
              hint={filtered ? "No rows match the current filters. Try widening or clearing them." : emptyHint} />
          )}

          {state === "ready" && table.getRowModel().rows.map((row) => {
            const active = isRowActive?.(row.original);
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={row.id}
                onClick={clickable ? () => onRowClick(row.original) : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(row.original); }
                } : undefined}
                tabIndex={clickable ? 0 : undefined}
                className={`border-b border-border last:border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
                  clickable ? "cursor-pointer hover:bg-surface-hover" : ""
                } ${active ? "bg-surface-hover" : ""}`}
              >
                {row.getVisibleCells().map((cell, index) => {
                  const meta = cell.column.columnDef.meta ?? {};
                  return (
                    <td
                      key={cell.id}
                      className={`${skin.cell} align-middle ${
                        meta.numeric ? "text-right tabular-nums" : "text-left"
                      } ${meta.mono ? "font-mono text-[11px] text-muted" : "text-body"} ${
                        /* The accent bar marks the active row without tinting it — a full tint on a
                           neutral table reads as a warning rather than a selection. */
                        index === 0 && active ? "relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent" : ""
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton rows rather than a spinner: the table keeps its shape, so nothing jumps when data lands. */
function SkeletonRows({ cols, skin }) {
  return Array.from({ length: 5 }).map((_, r) => (
    <tr key={r} className="border-b border-border last:border-0">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className={skin.cell}>
          <div className="h-3 animate-pulse rounded bg-surface-hover" style={{ width: `${c === 0 ? 70 : 40}%` }} />
        </td>
      ))}
    </tr>
  ));
}

function StateRow({ cols, Icon, tone, title, hint, action }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-14">
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon size={22} className={tone} />
          <p className="text-sm font-semibold text-heading">{title}</p>
          {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
          {action}
        </div>
      </td>
    </tr>
  );
}

/**
 * The primary cell: a strong first line with a quiet identifier under it.
 *
 * Exists because "name over code" is the single most repeated cell shape in this console, and writing
 * it inline each time is how the code drifted into two weights for the same thing.
 */
export function PrimaryCell({ title, subtitle, mono = true }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-heading">{title}</p>
      {subtitle && (
        <p className={`truncate text-[11px] text-muted ${mono ? "font-mono" : ""}`}>{subtitle}</p>
      )}
    </div>
  );
}

/** Server-side pager. Deliberately numbered, not infinite scroll: ops work needs a citable position. */
export function ConsolePager({ page, size, total, onPage, busy }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (size || 1)));
  if (pages <= 1) return null;
  const from = page * size + 1;
  const to = Math.min((page + 1) * size, total);
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-3 text-xs text-muted">
      <span className="tabular-nums">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 0 || busy} onClick={() => onPage(page - 1)}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border px-2.5 py-1.5 font-semibold text-body hover:bg-surface-hover disabled:opacity-40">
          Previous
        </button>
        <span className="px-2 tabular-nums">{page + 1} / {pages}</span>
        <button type="button" disabled={page + 1 >= pages || busy} onClick={() => onPage(page + 1)}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg border border-border px-2.5 py-1.5 font-semibold text-body hover:bg-surface-hover disabled:opacity-40">
          Next
        </button>
      </div>
      {busy && <Loader2 size={13} className="animate-spin" />}
    </div>
  );
}

export default ConsoleTable;
