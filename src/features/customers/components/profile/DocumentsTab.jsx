import { FileCheck2, Globe, ShieldAlert } from "lucide-react";

import Pager from "@shared/ui/Pager";

import {
  Chip, EmptyState, RowSkeleton, SectionCard, SectionError, TH_CLASS,
  daysUntil, fmtDate, fmtDateTime, titleCase,
} from "./profileUi";
import { CardFact, CardFacts, MobileList, useClientPage } from "./profilePaging";

/**
 * Uploaded documents and portal access.
 *
 * Metadata only — no file bytes are served to staff here. Document content stays behind the
 * traveler portal's ownership-checked download endpoint; surfacing it from a staff profile page
 * would be a PII decision taken by accident rather than on purpose.
 *
 * The expiry column is the reason this tab exists at all. The backend has always computed it and
 * always run the reminder job, but the only staff-visible output was a transient bell notification
 * — so an operator could not answer "is their passport still valid" without asking the customer.
 */
const EXPIRY_WARNING_DAYS = 60;

export default function DocumentsTab({ state }) {
  const { data, loading, error, reload } = state;
  const paged = useClientPage(data?.documents);

  if (loading) {
    return (
      <SectionCard icon={FileCheck2} title="Documents & portal" description="Uploaded documents and portal access">
        <RowSkeleton />
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard icon={FileCheck2} title="Documents & portal" description="Uploaded documents and portal access">
        <SectionError error={error} onRetry={reload} />
      </SectionCard>
    );
  }

  const documents = data?.documents || [];

  return (
    <div className="space-y-5">
      <SectionCard icon={Globe} title="Traveler portal" description="Whether this customer can sign in to see their trips">
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Fact label="Portal account" value={data?.hasPortalAccount ? "Active" : "Not set up"} />
          <Fact label="Account status" value={data?.portalAccountStatus ? titleCase(data.portalAccountStatus) : "—"} />
          <Fact label="Last signed in" value={fmtDateTime(data?.portalLastLoginAt, "Never")} />
        </div>
        {!data?.hasPortalAccount && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Accounts are created automatically the first time the customer requests a login code —
            "not set up" usually means they have simply never tried, not that access was denied.
          </p>
        )}
      </SectionCard>

      <SectionCard
        icon={FileCheck2}
        title="Uploaded documents"
        description="Uploaded by the customer through the portal. Files are not downloadable from here."
      >
        {documents.length === 0
          ? (
            <EmptyState
              icon={FileCheck2}
              title="No documents uploaded"
              hint="Passports and other documents the customer uploads through the traveler portal appear here."
            />
          )
          : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50">
                  <tr className={`text-left ${TH_CLASS}`}>
                    <th className="px-5 py-3.5">Document</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Expires</th>
                    <th className="px-5 py-3.5">Verification</th>
                    <th className="px-5 py-3.5 text-right">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.slice.map((doc) => {
                    const left = daysUntil(doc.expiryDate);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <p className="max-w-xs truncate text-sm font-semibold text-slate-800">{doc.fileName}</p>
                          <p className="text-xs text-slate-500">{Math.round((doc.sizeBytes || 0) / 1024)} KB</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{titleCase(doc.type)}</td>
                        <td className="px-5 py-4">
                          {!doc.expiryDate ? (
                            // Absence of a date is not a statement that it does not expire.
                            <span className="text-sm text-slate-500">Not recorded</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600">{fmtDate(doc.expiryDate)}</span>
                              {left !== null && left < 0 && <Chip tone="rose">Expired</Chip>}
                              {left !== null && left >= 0 && left <= EXPIRY_WARNING_DAYS && (
                                <Chip tone="amber">{left}d left</Chip>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Chip tone={String(doc.verificationStatus).toUpperCase() === "VERIFIED" ? "emerald" : "slate"}>
                            {titleCase(doc.verificationStatus)}
                          </Chip>
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-slate-600">{fmtDate(doc.uploadedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <MobileList rows={paged.slice} render={(doc) => {
              const left = daysUntil(doc.expiryDate);
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{doc.fileName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {titleCase(doc.type)} · {Math.round((doc.sizeBytes || 0) / 1024)} KB
                      </p>
                    </div>
                    <Chip tone={String(doc.verificationStatus).toUpperCase() === "VERIFIED" ? "emerald" : "slate"}>
                      {titleCase(doc.verificationStatus)}
                    </Chip>
                  </div>
                  <CardFacts>
                    <CardFact label="Expires"
                      value={doc.expiryDate ? fmtDate(doc.expiryDate) : "Not recorded"}
                      tone={doc.expiryDate && left !== null && left < 0 ? "text-rose-700" : "text-slate-700"} />
                    <CardFact label="Uploaded" value={fmtDate(doc.uploadedAt)} />
                  </CardFacts>
                  {doc.expiryDate && left !== null && left >= 0 && left <= EXPIRY_WARNING_DAYS && (
                    <p className="mt-2"><Chip tone="amber">{left}d left</Chip></p>
                  )}
                </>
              );
            }} />

            <div className="border-t border-slate-100 px-4">
              <Pager {...paged} label="documents" />
            </div>
            </>
          )}

        {documents.length > 0 && (
          <p className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {/* Stated plainly so nobody reads "Pending" as "reviewed and rejected". */}
            Verification is recorded at upload and there is no review workflow yet, so every document
            stays "Pending" until one is built.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50/80 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
