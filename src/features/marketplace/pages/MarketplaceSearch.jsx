// src/features/marketplace/pages/MarketplaceSearch.jsx
//
// The tenant's browse screen over the platform hotel catalog. Read-only by construction: the catalog
// belongs to the platform, and the only write a tenant can make from here is importing a copy into
// its own Hotel Master.
//
// Renders through `../components/marketplaceUi` so the whole feature speaks one visual language.
// It must never reach into `src/console/` — that is a separate realm with its own token and its own
// theme layer, and its semantic utilities resolve to nothing outside `.sa-console`.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Check, ClipboardList, Download, DownloadCloud, Loader2, MapPin, Search, Star, X,
} from "lucide-react";
import { marketplaceService } from "../api/marketplaceService";
import {
  Button, Card, Empty, Hint, Input, Page, PageHeader, Pager, Select,
  errMsg, fmtMoney, useHotkeys, useToast,
} from "../components/marketplaceUi";

const PAGE_SIZE = 12;

export function MarketplaceSearch() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const searchRef = useRef(null);

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [city, setCity] = useState("");
  const [minStars, setMinStars] = useState("");
  const [importing, setImporting] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    let alive = true;
    setRows(null);
    marketplaceService
      .searchHotels({ page, size: PAGE_SIZE, q: debouncedQ, city: city.trim(), minStars: minStars || undefined })
      .then((r) => { if (alive) { setRows(r.items); setPagination(r.pagination); } })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        showToast(errMsg(e, "Could not load Platform Hotel."), "error");
      });
    return () => { alive = false; };
  }, [page, debouncedQ, city, minStars, showToast]);

  useEffect(load, [load]);

  // "/" jumps to search from anywhere on the page — and is ignored while a field already has focus.
  useHotkeys({ "/": () => searchRef.current?.focus() });

  /**
   * Import everything matching the CURRENT filters, so "Import all" means what is on screen.
   *
   * The server caps each call, so `truncated` is surfaced rather than hidden — otherwise a partial
   * run reads as a finished one and the tenant never learns there is more.
   */
  const runImportAll = async () => {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const result = await marketplaceService.importAllHotels({
        q: debouncedQ, city: city.trim(), minStars: minStars || undefined,
      });
      setBulkResult(result);
      showToast(result.summary, result.failed > 0 ? "warning" : "success");
      load();
    } catch (e) {
      showToast(errMsg(e, "Could not import the hotels."), "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const runImport = async (hotel) => {
    setImporting(hotel.publicId);
    try {
      const result = await marketplaceService.importHotel(hotel.publicId);
      showToast(
        result.created
          ? `${result.name} added to your hotels.`
          : `${result.name} was already in your hotels — refreshed.`,
        "success",
      );
      // Only present when the sync could not fully complete; it names the exact city/country the
      // tenant has to create, so it earns a second toast rather than a footnote.
      if (result.message) showToast(result.message, "error");
      load();
    } catch (e) {
      // A 409 with an actionable message is a normal outcome here, not an app failure — and the
      // shared interceptor stays silent on 409 by design, so the call site must surface it.
      showToast(errMsg(e, "Could not import this hotel."), "error");
    } finally {
      setImporting(null);
    }
  };

  return (
    <Page width="max-w-7xl">
      <PageHeader
        title="Platform Hotel"
        subtitle="Hotels the platform has contracted. Import one to use it in your quotations, or request a booking through the platform."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={runImportAll} disabled={bulkBusy || !rows?.length}>
              {bulkBusy ? <Loader2 className="animate-spin" /> : <DownloadCloud />}
              {bulkBusy ? "Importing…" : "Import all"}
            </Button>
            <Button onClick={() => navigate("/marketplace/bookings")}>
              <ClipboardList /> My requests
            </Button>
          </div>
        }
      />

      {/*
        Bulk result. Deliberately a persistent panel, not a toast: importing 200 hotels routinely
        skips most of them because the tenant's geography master has no matching City, and the list
        of which cities to add IS the useful output. A toast would take that away after 6 seconds.
      */}
      {bulkResult && (
        <Card className="mb-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{bulkResult.summary}</p>
              {bulkResult.failures?.length > 0 && (
                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-xs text-slate-600">
                  {bulkResult.failures.map((f) => (
                    <li key={f.platformHotelPublicId} className="flex gap-2">
                      <span className="font-medium text-slate-800">{f.name}</span>
                      <span className="text-slate-400">·</span>
                      <span>{f.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setBulkResult(null)}
              className="rounded p-1 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hotels…"
            className="pl-8"
          />
          {!q && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <Hint keys={["/"]} />
            </span>
          )}
        </div>
        <Input
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(0); }}
          placeholder="City"
          className="sm:max-w-[11rem]"
        />
        <Select
          value={minStars}
          onChange={(e) => { setMinStars(e.target.value); setPage(0); }}
          className="sm:max-w-[10rem]"
        >
          <option value="">Any rating</option>
          {[3, 4, 5].map((s) => <option key={s} value={s}>{s}★ and up</option>)}
        </Select>
      </div>

      {rows === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <Empty
            icon={Building2}
            title="No hotels found"
            hint="Try a different search or filter."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((h) => (
              <HotelCard
                key={h.publicId}
                hotel={h}
                busy={importing === h.publicId}
                onOpen={() => navigate(`/marketplace/${h.publicId}`)}
                onImport={() => runImport(h)}
              />
            ))}
          </div>

          <Pager
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 1}
            total={pagination?.totalElements ?? rows.length}
            onPage={setPage}
            className="mt-6"
          />
        </>
      )}
    </Page>
  );
}

function HotelCard({ hotel: h, busy, onOpen, onImport }) {
  return (
    <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <button onClick={onOpen} className="block w-full text-left focus:outline-none focus-visible:bg-slate-50">
        {h.primaryImageUrl ? (
          <img src={h.primaryImageUrl} alt={h.name} loading="lazy" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-slate-50">
            <Building2 className="h-7 w-7 text-slate-300" />
          </div>
        )}
        <div className="px-4 pt-3.5">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium text-slate-900">{h.name}</h3>
            {h.stars ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-amber-600">
                <Star className="h-3 w-3 fill-current" />{h.stars}
              </span>
            ) : null}
          </div>
          <p className="flex items-center gap-1 text-[13px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{[h.cityName, h.stateName, h.countryCode].filter(Boolean).join(", ")}</span>
          </p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="text-[11px] text-slate-400">
              {h.roomCount ?? 0} room type{h.roomCount === 1 ? "" : "s"}
            </p>
            <FromPrice value={h.fromPricePerNight} currency={h.currency} />
          </div>
        </div>
      </button>

      <div className="px-4 pb-4 pt-3">
        {h.alreadyImported ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
            <Check className="h-3.5 w-3.5" /> In your hotels
          </span>
        ) : (
          <Button size="sm" onClick={onImport} loading={busy}>
            {!busy && <Download />}
            {busy ? "Importing…" : "Import to my hotels"}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * "From ₹X / night" on a catalog card.
 *
 * <p>The figure is a TENANT PAYABLE — the catalog rate already through the platform's commercial
 * rule. The hotel's net rate is not on this response and cannot be recovered from it.
 *
 * <p><b>A missing price renders "On request", never ₹0.</b> A hotel with no rate card in the
 * catalog genuinely has no price, and a zero here is a number a tenant could quote to a customer
 * and then be held to. The server omits the field entirely in that case rather than sending 0,
 * which is why this tests for null rather than falsiness — a genuinely free night would still
 * render as a price.
 */
function FromPrice({ value, currency }) {
  if (value === null || value === undefined) {
    return <span className="shrink-0 text-[11px] text-slate-400">On request</span>;
  }
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="block text-[10px] uppercase tracking-wide text-slate-400">from</span>
      <span className="text-[13px] font-semibold text-slate-900">
        {fmtMoney(value, currency || "INR")}
      </span>
      <span className="text-[11px] text-slate-400"> /night</span>
    </span>
  );
}

export default MarketplaceSearch;
