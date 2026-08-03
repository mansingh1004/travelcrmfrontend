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
import { Building2, Check, ClipboardList, Download, MapPin, Search, Star } from "lucide-react";
import { marketplaceService } from "../api/marketplaceService";
import {
  Button, Card, Empty, Hint, Input, Page, PageHeader, Pager, Select,
  errMsg, useHotkeys, useToast,
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
        showToast(errMsg(e, "Could not load the hotel marketplace."), "error");
      });
    return () => { alive = false; };
  }, [page, debouncedQ, city, minStars, showToast]);

  useEffect(load, [load]);

  // "/" jumps to search from anywhere on the page — and is ignored while a field already has focus.
  useHotkeys({ "/": () => searchRef.current?.focus() });

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
        title="Hotel Marketplace"
        subtitle="Hotels the platform has contracted. Import one to use it in your quotations, or request a booking through the platform."
        actions={
          <Button onClick={() => navigate("/marketplace/bookings")}>
            <ClipboardList /> My requests
          </Button>
        }
      />

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
          <p className="mt-1.5 text-[11px] text-slate-400">
            {h.roomCount ?? 0} room type{h.roomCount === 1 ? "" : "s"}
          </p>
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

export default MarketplaceSearch;
