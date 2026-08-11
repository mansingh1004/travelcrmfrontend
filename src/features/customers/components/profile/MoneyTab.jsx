import { ArrowDownLeft, ArrowUpRight, Ban, IndianRupee, Receipt } from "lucide-react";

import Pager from "@shared/ui/Pager";

import {
  Chip, EmptyState, MONEY_TONE, RowSkeleton, SectionCard, SectionError, TH_CLASS,
  fmtDate, money, signedMoney,
} from "./profileUi";
import { CardFact, CardFacts, MobileList, useClientPage } from "./profilePaging";

/**
 * Payment ledger, invoices and cancellations for one customer.
 *
 * Three lists from one call. None of the source tables carries a customer column — they are all
 * keyed by booking — so the backend resolves the customer's bookings once and fans in; the client
 * just renders.
 *
 * A 403 here is expected and normal: the tab is gated on PAYMENT_MANAGE / BOOKING_PROFIT_READ /
 * CRM_FULL, so an ordinary agent sees it as locked rather than broken (SectionError handles that).
 */
export default function MoneyTab({ state }) {
  const { data, loading, error, reload } = state;

  // Hooks run before the early returns below — a payment ledger is the one list here that can
  // genuinely reach the hundreds.
  const pagedPayments = useClientPage(data?.payments);
  const pagedInvoices = useClientPage(data?.invoices);

  if (loading) {
    return (
      <SectionCard icon={IndianRupee} title="Money" description="Receipts, invoices and cancellations">
        <RowSkeleton rows={5} />
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard icon={IndianRupee} title="Money" description="Receipts, invoices and cancellations">
        <SectionError error={error} onRetry={reload} />
      </SectionCard>
    );
  }

  const payments = data?.payments || [];
  const invoices = data?.invoices || [];
  const cancellations = data?.cancellations || [];

  return (
    <div className="space-y-5">
      <SectionCard
        icon={IndianRupee}
        title="Payment ledger"
        description="Receipts and refunds share one ledger — a refund is not a negative receipt"
      >
        {payments.length === 0
          ? <EmptyState icon={IndianRupee} title="No payments recorded" hint="Receipts and refunds against this customer's bookings will appear here." />
          : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px]">
                <thead className="bg-slate-50">
                  <tr className={`text-left ${TH_CLASS}`}>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Booking</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Method</th>
                    <th className="px-5 py-3.5">Paid by</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedPayments.slice.map((row) => {
                    const refund = String(row.entryType || "").toUpperCase() === "REFUND";
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-4 text-sm text-slate-600">{fmtDate(row.paymentDate)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-blue-700">{row.bookingCode || "—"}</td>
                        <td className="px-5 py-4">
                          <Chip tone={refund ? "rose" : "emerald"}>{refund ? "Refund" : "Receipt"}</Chip>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{row.paymentMethod || "—"}</td>
                        {/* Free text by design — the payer is often not the customer. */}
                        <td className="px-5 py-4 text-sm text-slate-600">{row.paidByName || "—"}</td>
                        {/* Sign + arrow carry the direction; the colour only reinforces it. */}
                        <td className={`px-5 py-4 text-right text-sm font-extrabold tabular-nums ${
                          refund ? MONEY_TONE.outflow : MONEY_TONE.settled}`}>
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {refund
                              ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                              : <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />}
                            {signedMoney(row.amount, refund ? "out" : "in")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <MobileList rows={pagedPayments.slice} render={(row) => {
              const refund = String(row.entryType || "").toUpperCase() === "REFUND";
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-blue-700">{row.bookingCode || "—"}</p>
                      <p className="mt-1 text-xs text-slate-500">{fmtDate(row.paymentDate)}</p>
                    </div>
                    <Chip tone={refund ? "rose" : "emerald"}>{refund ? "Refund" : "Receipt"}</Chip>
                  </div>
                  <CardFacts>
                    <CardFact label="Amount"
                      tone={refund ? MONEY_TONE.outflow : MONEY_TONE.settled}
                      value={signedMoney(row.amount, refund ? "out" : "in")} />
                    <CardFact label="Method" value={row.paymentMethod || "—"} />
                    <CardFact label="Paid by" value={row.paidByName || "—"} className="col-span-2" />
                  </CardFacts>
                </>
              );
            }} />

            <div className="border-t border-slate-100 px-4">
              <Pager {...pagedPayments} label="entries" />
            </div>
            </>
          )}
      </SectionCard>

      <SectionCard icon={Receipt} title="Tax invoices" description="Issued GST invoices, frozen at issue">
        {invoices.length === 0
          ? <EmptyState icon={Receipt} title="No invoices issued" hint="Tax invoices raised against this customer's bookings will appear here." />
          : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px]">
                <thead className="bg-slate-50">
                  <tr className={`text-left ${TH_CLASS}`}>
                    <th className="px-5 py-3.5">Invoice</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Booking</th>
                    <th className="px-5 py-3.5">Recipient</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Taxable</th>
                    <th className="px-5 py-3.5 text-right">Tax</th>
                    <th className="px-5 py-3.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedInvoices.slice.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-sm font-extrabold text-slate-800">{row.invoiceNumber}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{fmtDate(row.invoiceDate)}</td>
                      <td className="px-5 py-4 text-sm font-bold text-blue-700">{row.bookingCode || "—"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <span className="block truncate">{row.recipientName || "—"}</span>
                        {row.recipientGstin && <span className="text-xs text-slate-500">{row.recipientGstin}</span>}
                      </td>
                      <td className="px-5 py-4">
                        <Chip tone={String(row.status).toUpperCase() === "ISSUED" ? "emerald" : "slate"}>{row.status}</Chip>
                      </td>
                      {/* Stated amounts, not outcomes — neutral by rule, however large. */}
                      <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600">{money(row.taxableValue)}</td>
                      <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600">{money(row.totalTax)}</td>
                      <td className={`px-5 py-4 text-right text-sm font-extrabold tabular-nums ${MONEY_TONE.fact}`}>{money(row.invoiceTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <MobileList rows={pagedInvoices.slice} render={(row) => (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-800">{row.invoiceNumber}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{fmtDate(row.invoiceDate)} · {row.bookingCode || "—"}</p>
                  </div>
                  <Chip tone={String(row.status).toUpperCase() === "ISSUED" ? "emerald" : "slate"}>{row.status}</Chip>
                </div>
                <CardFacts>
                  <CardFact label="Taxable" value={money(row.taxableValue)} tone="text-slate-600" />
                  <CardFact label="Tax" value={money(row.totalTax)} tone="text-slate-600" />
                  <CardFact label="Total" value={money(row.invoiceTotal)} tone={MONEY_TONE.fact} />
                  <CardFact label="Recipient" value={row.recipientName || "—"} tone="text-slate-600" />
                </CardFacts>
              </>
            )} />

            <div className="border-t border-slate-100 px-4">
              <Pager {...pagedInvoices} label="invoices" />
            </div>
            </>
          )}
      </SectionCard>

      {cancellations.length > 0 && (
        <SectionCard
          icon={Ban}
          title="Cancellations"
          description="Retained charge excludes GST and TCS — those are not the agency's money"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50">
                <tr className={`text-left ${TH_CLASS}`}>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Booking</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">Refund status</th>
                  <th className="px-5 py-3.5 text-right">Retained</th>
                  <th className="px-5 py-3.5 text-right">Refund due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cancellations.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-sm text-slate-600">{fmtDate(row.cancelDate)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-blue-700">{row.bookingCode || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600"><span className="block max-w-xs truncate">{row.reason || "—"}</span></td>
                    <td className="px-5 py-4"><Chip tone="slate">{row.refundStatus || "—"}</Chip></td>
                    <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-700">{money(row.retainedCharge)}</td>
                    <td className={`px-5 py-4 text-right text-sm font-extrabold tabular-nums ${MONEY_TONE.outflow}`}>
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        {signedMoney(row.refundDue, "out")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
