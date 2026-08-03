// src/features/fleet/components/RegisterDocuments.jsx
// Compact read-only view of the compliance register for ONE vehicle or driver — mounted on both
// detail pages. Shows the current papers only; superseded and revoked live on the Compliance
// screen, where the renewal chain is the point.
import { useEffect, useState } from "react";
import { ArrowRight, Ban } from "lucide-react";

import { Badge, LoadingState, fmtDate } from "./fleetUi";

/** Same status vocabulary as the Compliance screen — map + fallback, never an enum copy. */
const DOC_STATUS_TONE = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  EXPIRING: "bg-amber-100 text-amber-700 border border-amber-200",
  EXPIRED: "bg-rose-100 text-rose-700 border border-rose-200",
  SUPERSEDED: "bg-slate-100 text-slate-500 border border-slate-200",
  REVOKED: "bg-rose-100 text-rose-700 border border-rose-200",
};
const docStatusTone = (s) => DOC_STATUS_TONE[s] || "bg-slate-100 text-slate-600 border border-slate-200";

/**
 * @param fetch      () => Promise<FleetDocumentResponseDto[]> — documentsForVehicle / documentsForDriver
 * @param refreshKey re-fetch when this changes (the owner's publicId); `fetch` identity is ignored
 * @param gridClass  chip grid columns — the driver page mounts this in a narrow column
 */
export default function RegisterDocuments({
  fetch, refreshKey, navigate, emptyHint,
  gridClass = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
}) {
  const [docs, setDocs] = useState(null);   // null = still loading

  useEffect(() => {
    let alive = true;
    setDocs(null);
    fetch()
      .then((d) => { if (alive) setDocs(d || []); })
      .catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (docs === null) return <LoadingState label="Loading documents…" />;

  const current = docs.filter((d) => d.status !== "SUPERSEDED" && d.status !== "REVOKED");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {current.length === 0 ? "No papers on record." : `${current.length} current`}
        </p>
        <button onClick={() => navigate("/fleet/compliance")}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
          Manage documents <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {current.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-400">{emptyHint}</p>
      ) : (
        <div className={`grid gap-3 ${gridClass}`}>
          {current.map((d) => (
            <div key={d.publicId} className="min-w-0 rounded-xl border border-slate-100 bg-white/60 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {d.categoryLabel}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${docStatusTone(d.status)}`}>
                  {d.statusLabel}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-slate-700">
                {d.documentNumber || <span className="italic text-slate-400">no number on record</span>}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="font-semibold text-slate-600">
                  {d.validUntil ? fmtDate(d.validUntil) : "lifetime"}
                </span>
                {d.daysLeft != null && (
                  <span className={`font-bold ${
                    d.daysLeft < 0 ? "text-rose-600" : d.daysLeft <= 30 ? "text-amber-600" : "text-emerald-600"}`}>
                    {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}
                  </span>
                )}
                {d.blocking && (
                  <span title="An expired instance of this refuses an assignment">
                    <Ban className="h-3 w-3 text-rose-400" />
                  </span>
                )}
                {d.needsReview && (
                  <Badge className="bg-indigo-100 text-indigo-700">needs review</Badge>
                )}
              </div>
              {/* A Nepal entry's exit deadline is NOT its validity — the paper can be valid for a
                  month while the vehicle must be back in seven days. */}
              {d.exitDaysLeft != null && (
                <p className={`mt-1 text-[11px] font-bold ${
                  d.exitDaysLeft < 0 ? "text-rose-600" : d.exitDaysLeft <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                  {d.exitDaysLeft < 0
                    ? `Exit deadline missed by ${Math.abs(d.exitDaysLeft)}d`
                    : `Must exit in ${d.exitDaysLeft}d`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
