import {
  BriefcaseBusiness, CakeSlice, CalendarDays, ChevronDown, Clock3, FileText,
  Globe2, IdCard, LoaderCircle, Mail, MapPin, MessageCircle, Phone, Receipt,
  ShieldCheck, StickyNote, UserRound,
} from "lucide-react";

import {
  DetailItem, SectionCard, fmtDate, maskIdentifier, titleCase,
} from "./profileUi";

/**
 * The profile facts — everything stored on the customer record itself.
 *
 * Rendered from the full `CustomerResponse` (the same payload the edit form round-trips), so this
 * is the one tab that needs no extra request: the page already has it.
 *
 * Identity numbers are masked here. The list screen's modal used to print them in full while this
 * page masked the same three fields; the masked form is the correct one and is now the only one.
 */
export default function OverviewTab({
  customer,
  canEdit,
  updating,
  onStatusChange,
  onTierChange,
  statusOptions,
  tierOptions,
}) {
  const typeKey = String(customer?.type || "").toUpperCase().replace(/\s+/g, "_");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard icon={UserRound} title="Contact details" description="Primary contact and preferred channel">
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <DetailItem icon={Phone} label="Phone" value={customer.phone}
              href={customer.phone ? `tel:${customer.phone}` : null} />
            <DetailItem icon={Phone} label="Alternate phone" value={customer.alternatePhone}
              href={customer.alternatePhone ? `tel:${customer.alternatePhone}` : null} />
            <DetailItem icon={Mail} label="Email" value={customer.email}
              href={customer.email ? `mailto:${customer.email}` : null} />
            <DetailItem icon={MessageCircle} label="Preferred communication" value={customer.commPref} />
          </div>
        </SectionCard>

        <SectionCard icon={MapPin} title="Address" description="Durable address information">
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <DetailItem icon={MapPin} label="Full address" value={customer.address} wide />
            <DetailItem icon={BriefcaseBusiness} label="City" value={customer.city} />
            <DetailItem icon={MapPin} label="State" value={customer.state} />
            <DetailItem icon={IdCard} label="Pincode" value={customer.pincode} />
            <DetailItem icon={Globe2} label="Country" value={customer.country} />
          </div>
        </SectionCard>

        {/*
          Tax identity. Shown for every customer rather than only CORPORATE ones, because the type
          is a hand-set label and a business customer filed as "Individual" would otherwise have
          nowhere to show a GSTIN — which is exactly the case that used to force the number to be
          re-typed on every invoice.
        */}
        <SectionCard icon={Receipt} title="Tax identity" description="Used when raising a GST invoice">
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <DetailItem icon={Receipt} label="GSTIN" value={customer.gstin} />
            <DetailItem icon={BriefcaseBusiness} label="Registered legal name" value={customer.legalName} />
          </div>
          {!customer.gstin && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              No GSTIN on file — invoices for this customer are raised as B2C unless one is entered
              on the invoice itself.
            </p>
          )}
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard icon={CalendarDays} title="Important dates" description="Relationship and marketing reminders">
            <div className="space-y-3 p-5">
              <DetailItem icon={CakeSlice} label="Birthday" value={customer.birthday ? fmtDate(customer.birthday) : null} />
              <DetailItem icon={CalendarDays} label="Anniversary" value={customer.anniversary ? fmtDate(customer.anniversary) : null} />
            </div>
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="Identity details" description="Masked on screen">
            <div className="space-y-3 p-5">
              <DetailItem icon={IdCard} label="Passport"
                value={customer.passportNo ? maskIdentifier(customer.passportNo) : null} />
              <DetailItem icon={CalendarDays} label="Passport expiry"
                value={customer.passportExpiry ? fmtDate(customer.passportExpiry) : null} />
              <DetailItem icon={Globe2} label="Nationality" value={customer.nationality} />
              <DetailItem icon={IdCard} label="PAN"
                value={customer.panNo ? maskIdentifier(customer.panNo, 3) : null} />
              <DetailItem icon={IdCard} label="Aadhar"
                value={customer.aadharNo ? maskIdentifier(customer.aadharNo) : null} />
            </div>
          </SectionCard>
        </div>

        <SectionCard icon={StickyNote} title="Notes & document references"
          description="Permanent preferences, not trip-specific details">
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                <StickyNote className="h-4 w-4" /> Customer notes
              </p>
              <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${customer.notes ? "text-amber-950" : "text-amber-700/60"}`}>
                {customer.notes || "No customer preferences or notes added."}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <FileText className="h-4 w-4" /> Document notes
              </p>
              <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${customer.documents ? "text-slate-700" : "text-slate-500"}`}>
                {customer.documents || "No document references added."}
              </p>
              {/* These are notes, not files. Uploaded files live on the Documents tab. */}
              <p className="mt-3 text-[11px] text-slate-500">
                Free text only — uploaded files appear under the Documents tab.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-4">
        <SectionCard icon={ShieldCheck} title="Customer profile" description="Classification and relationship status">
          <div className="space-y-4 p-5">
            <ProfileSelect
              id="customer-status" label="Status" value={customer.status}
              options={statusOptions} disabled={!canEdit || Boolean(updating)}
              busy={updating === "status"} onChange={onStatusChange}
            />
            <ProfileSelect
              id="customer-tier" label="Loyalty tier" value={customer.tier}
              options={tierOptions} disabled={!canEdit || Boolean(updating)}
              busy={updating === "tier"} onChange={onTierChange}
            />

            {[
              ["Customer type", titleCase(typeKey)],
              ["Communication", customer.commPref || "Not set"],
              ["Customer code", customer.customerId || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500">{label}</span>
                <span className="text-right text-sm font-bold text-slate-800">{value}</span>
              </div>
            ))}

            {!canEdit && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                You have read-only access to this customer.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Clock3} title="Record information" description="Profile audit timestamps">
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">Created</span>
              <span className="text-sm font-bold text-slate-700">{fmtDate(customer.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">Last updated</span>
              <span className="text-sm font-bold text-slate-700">{fmtDate(customer.updatedAt)}</span>
            </div>
          </div>
        </SectionCard>
      </aside>
    </div>
  );
}

/**
 * A status/tier select whose option list always contains the record's current value.
 *
 * The old page hardcoded the option lists with no such guard, so a value added server-side would
 * have no matching <option>, the select would fall back to the first entry, and merely opening the
 * page and touching the control would rewrite the record. `statusOptions`/`tierOptions` are built
 * with the current value folded in — the same idiom AllLeads uses for an unknown lead stage.
 */
function ProfileSelect({ id, label, value, options, disabled, busy, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
        >
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {busy
          ? <LoaderCircle className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-blue-600" />
          : <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />}
      </div>
    </div>
  );
}
