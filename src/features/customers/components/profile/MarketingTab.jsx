import { Megaphone, Workflow } from "lucide-react";

import Pager from "@shared/ui/Pager";

import {
  CAMPAIGN_STATUS_TONE, Chip, DRIP_STATUS_TONE, EmptyState, RowSkeleton, SectionCard,
  SectionError, TH_CLASS, fmtDateTime, titleCase,
} from "./profileUi";
import { CardFact, CardFacts, MobileList, useClientPage } from "./profilePaging";

/**
 * What marketing has sent this customer.
 *
 * Two lists: campaign sends and drip-sequence enrolments. Both tables have always carried a NOT
 * NULL customer_id; only the finders and the customer-first indexes were missing.
 *
 * Birthday and anniversary greetings are NOT here and the footnote says so out loud, because the
 * automation runner writes no per-customer row at all — it dispatches and bumps a tenant-level
 * counter. Silently omitting them would read as "we never sent any".
 */
export default function MarketingTab({ state }) {
  const { data, loading, error, reload } = state;
  const pagedCampaigns = useClientPage(data?.campaigns);
  const pagedDrips = useClientPage(data?.drips);

  if (loading) {
    return (
      <SectionCard icon={Megaphone} title="Marketing" description="Campaigns and drip sequences">
        <RowSkeleton />
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard icon={Megaphone} title="Marketing" description="Campaigns and drip sequences">
        <SectionError error={error} onRetry={reload} />
      </SectionCard>
    );
  }

  const campaigns = data?.campaigns || [];
  const drips = data?.drips || [];

  return (
    <div className="space-y-5">
      <SectionCard icon={Megaphone} title="Campaign sends" description="Broadcasts this customer was included in">
        {campaigns.length === 0
          ? <EmptyState icon={Megaphone} title="No campaign sends" hint="Campaigns that included this customer will appear here." />
          : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-50">
                  <tr className={`text-left ${TH_CLASS}`}>
                    <th className="px-5 py-3.5">Campaign</th>
                    <th className="px-5 py-3.5">Channel</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedCampaigns.slice.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="max-w-sm truncate text-sm font-semibold text-slate-800">
                          {row.campaignName || "Campaign removed"}
                        </p>
                        {row.errorMsg && <p className="max-w-sm truncate text-xs text-rose-600">{row.errorMsg}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{titleCase(row.channel)}</td>
                      <td className="px-5 py-4">
                        <Chip tone={CAMPAIGN_STATUS_TONE[String(row.status).toUpperCase()] || "slate"}>
                          {titleCase(row.status)}
                        </Chip>
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-slate-600">
                        {fmtDateTime(row.sentAt, "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <MobileList rows={pagedCampaigns.slice} render={(row) => (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {row.campaignName || "Campaign removed"}
                    </p>
                    {row.errorMsg && <p className="mt-0.5 truncate text-xs text-rose-600">{row.errorMsg}</p>}
                  </div>
                  <Chip tone={CAMPAIGN_STATUS_TONE[String(row.status).toUpperCase()] || "slate"}>
                    {titleCase(row.status)}
                  </Chip>
                </div>
                <CardFacts>
                  <CardFact label="Channel" value={titleCase(row.channel)} />
                  <CardFact label="Sent" value={fmtDateTime(row.sentAt, "—")} />
                </CardFacts>
              </>
            )} />

            <div className="border-t border-slate-100 px-4">
              <Pager {...pagedCampaigns} label="sends" />
            </div>
            </>
          )}
        {campaigns.length > 0 && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            {/* Do not let "Sent" be read as "Opened" — there is no read tracking anywhere. */}
            "Sent" means handed to the provider. Delivery and read receipts are not tracked.
          </p>
        )}
      </SectionCard>

      <SectionCard icon={Workflow} title="Drip sequences" description="Automated sequences this customer is enrolled in">
        {drips.length === 0
          ? <EmptyState icon={Workflow} title="No drip enrolments" hint="Sequences this customer has been enrolled in will appear here." />
          : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-50">
                  <tr className={`text-left ${TH_CLASS}`}>
                    <th className="px-5 py-3.5">Sequence</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Step</th>
                    <th className="px-5 py-3.5">Enrolled</th>
                    <th className="px-5 py-3.5 text-right">Next run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedDrips.slice.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                        {row.sequenceName || "Sequence removed"}
                      </td>
                      <td className="px-5 py-4">
                        <Chip tone={DRIP_STATUS_TONE[String(row.status).toUpperCase()] || "slate"}>
                          {titleCase(row.status)}
                        </Chip>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{row.currentStepOrder ?? "—"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{fmtDateTime(row.enrolledAt, "—")}</td>
                      <td className="px-5 py-4 text-right text-sm text-slate-600">{fmtDateTime(row.nextRunAt, "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <MobileList rows={pagedDrips.slice} render={(row) => (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                    {row.sequenceName || "Sequence removed"}
                  </p>
                  <Chip tone={DRIP_STATUS_TONE[String(row.status).toUpperCase()] || "slate"}>
                    {titleCase(row.status)}
                  </Chip>
                </div>
                <CardFacts>
                  <CardFact label="Step" value={row.currentStepOrder ?? "—"} />
                  <CardFact label="Next run" value={fmtDateTime(row.nextRunAt, "—")} />
                  <CardFact label="Enrolled" value={fmtDateTime(row.enrolledAt, "—")} className="col-span-2" />
                </CardFacts>
              </>
            )} />

            <div className="border-t border-slate-100 px-4">
              <Pager {...pagedDrips} label="enrolments" />
            </div>
            </>
          )}
      </SectionCard>

      <p className="px-1 text-xs text-slate-500">
        Birthday and anniversary greetings are not listed — the automation that sends them records
        no per-customer entry, so this page cannot show them without inventing one.
      </p>
    </div>
  );
}
