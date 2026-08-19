// src/features/profile/components/BusinessListingRows.jsx
//
// The repeatable Business Listings editor: one row per directory page the agency is listed on.
//
// Controlled, like every other field in EditProfileTab — it holds no state of its own and reports
// every change upward, so the rows save with the form's existing Save button rather than needing
// their own endpoint. That is what keeps this consistent with the social links beside it.

import { Plus as FiPlus, Trash2 as FiTrash, ChevronDown as FiChevron, ExternalLink as FiExternal, CircleAlert as FiAlert } from "lucide-react";

import {
  LISTING_PLATFORMS, platformOf, emptyListingRow, normaliseListingUrl, isListingUrl,
} from "../lib/businessListings";

const CELL =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 " +
  "outline-none transition-all placeholder-slate-400 hover:border-slate-300 " +
  "focus:border-blue-400 focus:ring-2 focus:ring-blue-50 disabled:bg-slate-50";

export default function BusinessListingRows({ rows = [], onChange, disabled = false }) {
  const update = (rowId, key, value) =>
    onChange(rows.map((row) => (row.rowId === rowId ? { ...row, [key]: value } : row)));

  const add = () => onChange([...rows, emptyListingRow()]);
  const remove = (rowId) => onChange(rows.filter((row) => row.rowId !== rowId));

  /* Normalise on blur, matching the social fields: "justdial.com/x" becomes a real link in the box
     the moment focus leaves it, so what will be stored is visible and still editable. Doing it
     silently at save would show one thing and store another. */
  const normalise = (row) => {
    const next = normaliseListingUrl(row.url);
    if (next && next !== row.url) update(row.rowId, "url", next);
  };

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        /* Column headers only above actual rows. Three headings floating over nothing read as a
           table that failed to load, which is what the empty state below is for instead. */
        <div className="hidden gap-3 px-1 md:grid md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,1.4fr)_40px]">
          {["Platform", "Label", "Listing URL"].map((h) => (
            <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{h}</span>
          ))}
          <span />
        </div>
      )}

      {rows.map((row) => {
        const platform = platformOf(row.platform);
        const { Icon, tone } = platform;
        const typed = String(row.url || "").trim();
        const bad = typed && !isListingUrl(typed);

        return (
          /* A bordered card per row on phones, an aligned grid from md up — the same responsive
             treatment the booking form's requirement rows use, so multi-row editors behave the
             same way everywhere in this app. */
          <div
            key={row.rowId}
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,1.4fr)_40px] md:items-start md:rounded-none md:border-0 md:p-0"
          >
            <div className="relative">
              <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <select
                value={row.platform}
                onChange={(e) => update(row.rowId, "platform", e.target.value)}
                disabled={disabled}
                aria-label="Directory"
                className={`${CELL} appearance-none pl-10 pr-9`}
              >
                {LISTING_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <FiChevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {/* The label is what makes multiple rows usable. Three Justdial URLs are three opaque
                strings; "Gorakhpur (main)" and "Lucknow branch" are a list someone can read. */}
            <input
              value={row.label}
              onChange={(e) => update(row.rowId, "label", e.target.value)}
              disabled={disabled}
              placeholder="e.g. Gorakhpur (main)"
              aria-label="Listing label"
              className={CELL}
            />

            <div className="min-w-0">
              <input
                value={row.url}
                onChange={(e) => update(row.rowId, "url", e.target.value)}
                onBlur={() => normalise(row)}
                disabled={disabled}
                placeholder={platform.hintUrl}
                aria-label="Listing URL"
                inputMode="url"
                className={`${CELL} ${bad ? "border-red-300 focus:border-red-400 focus:ring-red-50" : ""}`}
              />
              {bad ? (
                <p className="mt-1.5 flex items-start gap-1 text-xs text-red-500">
                  <FiAlert className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  Paste the full address — copy it from the listing page
                </p>
              ) : typed && (
                /* The finished link, live. On a page of near-identical directory URLs it is the
                   only way to catch a row pointing at the wrong branch before saving. */
                <a
                  href={normaliseListingUrl(typed)} target="_blank" rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 break-all text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  {normaliseListingUrl(typed).replace(/^https?:\/\//i, "")}
                  <FiExternal className="h-3 w-3 flex-shrink-0" />
                </a>
              )}
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={() => remove(row.rowId)}
                aria-label="Remove listing"
                title="Remove listing"
                /* type="button" is load-bearing here: these rows render INSIDE EditProfileTab's
                   <form>, and a button without it submits the company profile — the payload the
                   quotation PDF header is built from. */
                className="grid h-11 w-10 place-items-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500 md:border-0"
              >
                <FiTrash className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <p className="text-xs text-slate-400">
          No directory listings yet. Add the pages customers find you on — one row per listing, so a
          branch in another city gets its own.
        </p>
      )}

      {!disabled && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
        >
          <FiPlus className="h-3.5 w-3.5" /> Add listing
        </button>
      )}
    </div>
  );
}
