// src/features/marketplace/pages/MixRequests.jsx
//
// Mix-and-match enquiries — both directions, on one screen.
//
// ── Why one screen and not two ───────────────────────────────────────────────────────────────
//
// The agency that sends an enquiry on Monday answers one on Tuesday. Split across two menu items
// they read as two products, and the one you are not looking at is the one with something waiting
// in it. So: two tabs, the tab is in the URL so a link to "the queue" is a link someone can send,
// and the incoming tab carries its count in the label so it is impossible to miss.
//
// ── Why the incoming tab does not lead ───────────────────────────────────────────────────────
//
// An empty queue is the NORMAL state. Landing on it shows "nothing waiting" to an agency with six
// live enquiries of their own, which is the exact mistake the console package catalog made and had
// to have corrected. The screen's name is "Requests"; the first thing it answers is "what have I
// asked for".

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Wand2, Inbox, Send, Bed, Car, ChevronRight } from "lucide-react";

import {
  Page, PageHeader, Card, Button, Select, Loading, Empty,
  fmtMoney, useToast, errMsg, isAlreadyReported, cn, FONT,
} from "../components/marketplaceUi";
import { PKG_TAB_ON } from "../components/packageTheme";
import { packageMixService, mixStatus } from "../api/packageMixService";
import { hasPermission, P } from "@shared/lib/access";

const PAGE_SIZE = 20;

const STATUSES = ["PENDING", "PRICED", "ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"];

export function MixRequests() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const canSell = hasPermission(P.PACKAGE_MARKETPLACE_AUTHOR);
  const tab = params.get("tab") === "incoming" && canSell ? "incoming" : "mine";
  const status = params.get("status") ?? "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const call = tab === "incoming" ? packageMixService.listQueue : packageMixService.listMine;
      const { items } = await call({ status: status || undefined, page: 0, size: PAGE_SIZE });
      setRows(items);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not load requests"), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, status, showToast]);

  useEffect(() => { load(); }, [load]);

  // The badge. Failing quietly is right: a count that could not load must not stop the page, and
  // a toast about a number nobody asked for is noise.
  useEffect(() => {
    if (!canSell) return;
    packageMixService.pendingCount().then(setPendingCount).catch(() => setPendingCount(0));
  }, [canSell, rows]);

  const setTab = (next) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    p.delete("status");
    setParams(p, { replace: true });
  };

  const setStatus = (next) => {
    const p = new URLSearchParams(params);
    if (next) p.set("status", next); else p.delete("status");
    setParams(p, { replace: true });
  };

  const tabs = useMemo(() => {
    const list = [{ value: "mine", label: "My requests", Icon: Send }];
    if (canSell) {
      list.push({
        value: "incoming",
        label: pendingCount > 0 ? `Requests to me (${pendingCount})` : "Requests to me",
        Icon: Inbox,
      });
    }
    return list;
  }, [canSell, pendingCount]);

  return (
    <Page width="max-w-none">
      <div style={FONT}>
        <PageHeader
          title="Mix and match"
          subtitle="Selections composed across a package's levels, and the prices agreed on them"
          actions={
            <Button onClick={() => navigate("/marketplace/packages")}>
              <Wand2 className="h-4 w-4" aria-hidden />
              Browse packages
            </Button>
          }
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  tab === t.value ? PKG_TAB_ON : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                <t.Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
          <Select
            className="mb-1 w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{mixStatus(s).label}</option>)}
          </Select>
        </div>

        {loading ? (
          <Loading label="Loading requests…" />
        ) : rows.length === 0 ? (
          <Card className="mt-4">
            <Empty
              title={tab === "incoming" ? "Nothing waiting on you" : "You have not asked for a custom price yet"}
              hint={tab === "incoming"
                ? "When another agency composes their own version of one of your packages, it lands here."
                : "Open a package that allows it and use “Build your own” to pick a different level at each stop."}
            />
          </Card>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <RequestRow
                key={r.publicId}
                request={r}
                incoming={tab === "incoming"}
                onOpen={() => navigate(`/marketplace/packages/requests/${r.publicId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

/**
 * One enquiry, as a row.
 *
 * <p>Shows the price that matters for its state — the seller's quote once there is one, the
 * estimate until then — and says which it is. Two numbers side by side on a list row would be read
 * as a discount.</p>
 */
function RequestRow({ request, incoming, onOpen }) {
  const st = mixStatus(request.status);
  const quoted = request.quotedPerPax !== null && request.quotedPerPax !== undefined;
  const hotels = (request.lines ?? []).filter((l) => l.kind === "HOTEL");
  const vehicle = (request.lines ?? []).find((l) => l.kind === "VEHICLE");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{request.packageTitle}</span>
          <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
          <span className="font-mono text-[11px] text-slate-400">{request.requestCode}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Bed className="h-3 w-3" aria-hidden />
            {/* The tier names, deduplicated — "Basic, Super Deluxe" IS the mix, in three words. */}
            {[...new Set(hotels.map((h) => h.variantName).filter(Boolean))].join(", ") || "—"}
          </span>
          {vehicle?.vehicleName ? (
            <span className="flex items-center gap-1">
              <Car className="h-3 w-3" aria-hidden />
              {vehicle.vehicleName}
            </span>
          ) : null}
          <span>{request.pax} pax</span>
          {request.travelDate ? <span>{request.travelDate}</span> : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[11px] text-slate-400">{quoted ? "Quoted" : "Estimated"}</div>
        <div className="text-sm font-semibold text-slate-900">
          {quoted
            ? fmtMoney(request.quotedPerPax)
            : (request.estimatePerPax === null || request.estimatePerPax === undefined
                ? "On request"
                : fmtMoney(request.estimatePerPax))}
        </div>
        {incoming && request.status === "PENDING" ? (
          <div className="text-[11px] font-medium text-amber-700">Needs a price</div>
        ) : null}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
    </button>
  );
}

export default MixRequests;
