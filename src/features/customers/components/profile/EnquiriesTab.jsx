import { useMemo } from "react";
import { ChevronDown, ChevronRight, FileText, MessageSquarePlus, Plus } from "lucide-react";

import Pager from "@shared/ui/Pager";

import {
  Chip, EmptyState, LEAD_STAGE_TONE, RowSkeleton, SectionCard, SectionError,
  fmtDate, keyOf, money,
} from "./profileUi";
import { useClientPage } from "./profilePaging";

/**
 * Enquiries, with each enquiry's quotations nested under it.
 *
 * Nested rather than shown as a sibling tab because a quotation has no customer link of its own —
 * it belongs to a lead, and the only path here was customer → leads → quotations. Presenting the
 * quotations as a flat customer-level list would imply a relationship the data does not have, and
 * would lose the answer to the question an agent actually asks: *which* enquiry did we quote, and
 * how many times.
 *
 * Quotations arrive in one call for the whole customer and are grouped client-side by `leadId`,
 * so expanding a row costs nothing.
 */
export default function EnquiriesTab({
  leadsState,
  quotationsState,
  canCreateLead,
  canReadQuotation,
  expandedLeadId,
  onToggleLead,
  onNewEnquiry,
  onOpenLead,
  onOpenQuotation,
}) {
  const { data: leads, loading, error, reload } = leadsState;
  const rows = Array.isArray(leads) ? leads : [];
  const paged = useClientPage(rows);

  // Group the customer's quotations by the lead they were built for.
  const quotationsByLead = useMemo(() => {
    const list = Array.isArray(quotationsState.data) ? quotationsState.data : [];
    const map = new Map();
    list.forEach((q) => {
      const key = q.leadId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(q);
    });
    return map;
  }, [quotationsState.data]);

  // One expansion at a time, held in the URL by the page. Component state would not survive the
  // tab unmounting on every switch.
  const toggle = (id) => onToggleLead(expandedLeadId === id ? null : id);

  return (
    <SectionCard
      icon={MessageSquarePlus}
      title="Enquiries"
      description="Every enquiry this customer has raised, with the quotations built for each"
      action={canCreateLead && (
        <button
          type="button"
          onClick={onNewEnquiry}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
        >
          <Plus className="h-4 w-4" /> New enquiry
        </button>
      )}
    >
      {loading ? <RowSkeleton /> : error ? <SectionError error={error} onRetry={reload} />
        : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="No enquiries yet"
            hint="Enquiries linked to this customer will appear here — including ones raised before they became a customer, as soon as the phone or email matched."
            action={canCreateLead && (
              <button type="button" onClick={onNewEnquiry}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100">
                New enquiry
              </button>
            )}
          />
        ) : (
          <>
          <ul className="divide-y divide-slate-100">
            {paged.slice.map((lead) => {
              const isOpen = expandedLeadId === lead.id;
              const quotations = quotationsByLead.get(lead.id) || [];
              const stageKey = keyOf(lead.leadStage);

              return (
                <li key={lead.id}>
                  <div className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-blue-50/30">
                    <button
                      type="button"
                      onClick={() => toggle(lead.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Collapse enquiry" : "Expand enquiry"}
                      disabled={lead.quotationCount === 0}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => onOpenLead(lead.id)}
                          className="truncate text-sm font-extrabold text-blue-700 hover:underline">
                          {lead.leadCode || "Enquiry"}
                        </button>
                        <Chip tone={LEAD_STAGE_TONE[stageKey] || "slate"}>{lead.leadStage || "—"}</Chip>
                        {/* convertedBookingPublicId, not the stage: the stage can be moved by hand,
                            this is stamped by the conversion itself. */}
                        {lead.convertedBookingPublicId && <Chip tone="emerald">Converted</Chip>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {lead.packageType || "No package"} · {lead.leadSource || "Source unknown"}
                        {lead.assignedUserName ? ` · ${lead.assignedUserName}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 text-right">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Travel</p>
                        <p className="text-xs font-semibold text-slate-700">{fmtDate(lead.travelDate)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Budget</p>
                        <p className="text-xs font-bold text-slate-800">{lead.budget ? money(lead.budget) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quotes</p>
                        <p className="text-xs font-bold text-slate-800">{lead.quotationCount ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Raised</p>
                        <p className="text-xs text-slate-600">{fmtDate(lead.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-slate-50/70 px-5 py-4">
                      {!canReadQuotation ? (
                        <p className="text-xs text-slate-500">
                          You don't have permission to view quotations.
                        </p>
                      ) : quotationsState.loading ? (
                        <p className="text-xs text-slate-500">Loading quotations…</p>
                      ) : quotations.length === 0 ? (
                        <p className="text-xs text-slate-500">No quotations were built for this enquiry.</p>
                      ) : (
                        <ul className="space-y-2">
                          {quotations.map((q) => (
                            <li key={q.publicId}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800">
                                    {q.title || "Quotation"}
                                    {q.versionNumber ? <span className="ml-1.5 text-xs font-semibold text-slate-500">v{q.versionNumber}</span> : null}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {q.destination || "—"} · {fmtDate(q.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {q.quotationStage && <Chip tone="indigo">{q.quotationStage}</Chip>}
                                <span className="text-sm font-extrabold tabular-nums text-slate-900">{money(q.grandTotal)}</span>
                                <button type="button" onClick={() => onOpenQuotation(q.publicId)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">
                                  Open <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="border-t border-slate-100 px-4">
            <Pager {...paged} label="enquiries" />
          </div>
          </>
        )}
    </SectionCard>
  );
}
