// src/features/marketplace/pages/PackageQuotes.jsx
//
// Every quotation link this agency has sent.
//
// The screen exists for one reason: without it the link is only ever shown once, in the dialog that
// created it, and an agent who closes that dialog has lost the thing they just made. It is also
// where "did they open it?" gets answered — the view count is on the row.
//
// Rows carry no document (the server's list query never selects it), so this page is cheap however
// many quotations sit behind it.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, ExternalLink, Eye, Link2, Search, Trash2 } from "lucide-react";

import {
  Button, Card, Empty, Input, Loading, Page, PageHeader, Pager,
  cn, errMsg, fmtDate, fmtMoney, isAlreadyReported, useToast,
} from "../components/marketplaceUi";
import { PKG_ACCENT_TEXT } from "../components/packageTheme";
import { packageQuoteLink, packageQuoteService } from "../api/packageQuoteService";

const STATUS_STYLE = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  SENT: "border-blue-200 bg-blue-50 text-blue-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DECLINED: "border-slate-200 bg-slate-50 text-slate-500",
  EXPIRED: "border-amber-200 bg-amber-50 text-amber-700",
};

function StatusChip({ status }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function PackageQuotes() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [state, setState] = useState({ loading: true, items: [], pagination: null });
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await packageQuoteService.list({ q: q.trim() || undefined, page, size: 20 });
      setState({ loading: false, items: res.items, pagination: res.pagination });
    } catch (e) {
      setState({ loading: false, items: [], pagination: null });
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not load quotations"), "error");
    }
  }, [q, page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (quote) => {
    const link = packageQuoteLink(quote);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(quote.publicId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Blocked on insecure origins and in some webviews. Opening the page is the fallback the
      // agent can still act on.
      window.open(link, "_blank", "noopener");
    }
  };

  const setStatus = async (quote, status) => {
    try {
      await packageQuoteService.setStatus(quote.publicId, status);
      showToast(`Marked ${status.toLowerCase()}`, "success");
      load();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not update it"), "error");
    }
  };

  const withdraw = async (quote) => {
    // No window.confirm: it blocks the whole tab and this is reversible only by re-composing, so
    // the honest thing is to say what happens on the button itself. The row disappears on success.
    try {
      await packageQuoteService.remove(quote.publicId);
      showToast("Withdrawn — the link no longer opens", "success");
      load();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not withdraw it"), "error");
    }
  };

  return (
    <Page width="max-w-6xl">
      <PageHeader
        title="Quotation links"
        subtitle="Package pages you have sent to customers"
        actions={
          <Button onClick={() => navigate("/marketplace/packages")}>
            <Link2 className="h-4 w-4" aria-hidden />
            New from a package
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
          placeholder="Search by customer, title or package code"
          className="border-slate-200 bg-white pl-9"
          aria-label="Search quotations"
        />
      </div>

      {state.loading ? (
        <Loading label="Loading quotations…" />
      ) : !state.items.length ? (
        <Empty
          icon={Link2}
          title="No quotation links yet"
          hint="Open a package and press Quotation link to create one."
          action={<Button onClick={() => navigate("/marketplace/packages")}>Browse packages</Button>}
        />
      ) : (
        <Card flush>
          <ul className="divide-y divide-slate-100">
            {state.items.map((quote) => (
              <li key={quote.publicId} className="flex flex-wrap items-start gap-4 p-4 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{quote.title}</p>
                    <StatusChip status={quote.effectiveStatus} />
                    {quote.tierCount > 1 ? (
                      <span className={cn("text-[11px] font-medium", PKG_ACCENT_TEXT)}>
                        {quote.tierCount} options
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[
                      quote.customerName,
                      quote.packageCode,
                      quote.variantName,
                      quote.pax ? `${quote.pax} pax` : null,
                      quote.travelDate ? fmtDate(quote.travelDate) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                    <span>Created {fmtDate(quote.createdAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden />
                      {quote.viewCount || 0} view{quote.viewCount === 1 ? "" : "s"}
                    </span>
                    {quote.validUntil ? <span>Valid to {fmtDate(quote.validUntil)}</span> : null}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmtMoney(quote.sellTotal)}</p>
                  <p className="text-xs text-slate-500">{fmtMoney(quote.sellPerPax)} / pax</p>
                  {quote.marginTotal != null ? (
                    <p className="text-[11px] text-emerald-700">
                      margin {fmtMoney(quote.marginTotal)}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button onClick={() => copy(quote)} title="Copy the customer link">
                    {copiedId === quote.publicId ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                  <Button
                    onClick={() => window.open(packageQuoteLink(quote), "_blank", "noopener")}
                    title="Open the page"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Button>
                  {quote.effectiveStatus === "DRAFT" ? (
                    <Button onClick={() => setStatus(quote, "SENT")} title="Mark as sent">
                      Sent
                    </Button>
                  ) : null}
                  <Button onClick={() => withdraw(quote)} title="Withdraw — the link stops opening">
                    <Trash2 className="h-4 w-4 text-slate-400" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pager
        page={page}
        totalPages={state.pagination?.totalPages ?? 0}
        total={state.pagination?.totalElements ?? 0}
        onPage={setPage}
        className="mt-4"
      />
    </Page>
  );
}

export default PackageQuotes;
