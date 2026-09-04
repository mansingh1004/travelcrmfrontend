// src/features/marketplace/pages/PackageSearch.jsx
//
// Browse ready-to-book packages: region tabs, a filter rail with counts, and a card grid.
//
// Two deliberate departures from the rest of this feature, both taken explicitly rather than by
// drift, and both recorded in docs/PACKAGE_MARKETPLACE_DESIGN.md §8.1:
//
//  1. THE CATEGORY RIBBON SITS ON THE PHOTOGRAPH. Every other screen in this kit refuses to put
//     chrome over an image, and the rule is stated in four files. The owner overruled it for this
//     one label on 2026-09-02. It is scoped: only the category, only this ribbon, and nothing else
//     — price, code, counts and inclusions all stay in the text block. See PackageRibbon below.
//  2. FILTERS LIVE IN THE URL. FilterRail's own screens keep filters out of the URL, so a filtered
//     result cannot be shared or reloaded. With region tabs plus state plus night count that
//     becomes untenable, so this page serialises them. It is new work, not a copy.
//
// Facet counts are also a reversal of FilterRail's stated position; the server computes them per
// facet with that facet's own selections removed, so ticking "Kerala" does not collapse the state
// list to one row.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, Search as SearchIcon } from "lucide-react";

import {
  Page, PageHeader, Card, Button, Input, Tabs, Pager, Empty,
  useToast, errMsg, isAlreadyReported, useHotkeys, FONT,
} from "../components/marketplaceUi";
import { PackageFilterRail } from "../components/PackageFilterRail";
import { PackageCard } from "../components/PackageCard";
import { PKG_PRIMARY } from "../components/packageTheme";
import {
  packageMarketplaceService, PACKAGE_REGION,
} from "../api/packageMarketplaceService";

const PAGE_SIZE = 12;

/** The region tabs. "" is All — FilterRail's active check compares `(value || "")`. */
const REGION_TABS = [
  { value: "", label: "All" },
  ...Object.entries(PACKAGE_REGION).map(([value, label]) => ({ value, label })),
];

/** Filter keys that round-trip through the URL. Anything absent here is not shareable, on purpose. */
const URL_KEYS = ["q", "region", "states", "categories", "nights", "pax", "priceMin", "priceMax", "mine"];

export function PackageSearch() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  const [rows, setRows] = useState(null);      // null = first load, so the skeleton shows
  const [pagination, setPagination] = useState(null);
  const [facets, setFacets] = useState(null);
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState(params.get("q") ?? "");

  /** The filter state, read straight off the URL so a reload and a shared link agree. */
  const filters = useMemo(() => ({
    q: params.get("q") ?? "",
    region: params.get("region") ?? "",
    states: params.getAll("states").flatMap((v) => v.split(",")).filter(Boolean),
    categories: params.getAll("categories").flatMap((v) => v.split(",")).filter(Boolean),
    nights: params.getAll("nights").flatMap((v) => v.split(",")).filter(Boolean),
    pax: params.get("pax") ?? "",
    priceMin: params.get("priceMin") ?? "",
    priceMax: params.get("priceMax") ?? "",
    mine: params.get("mine") === "1",
  }), [params]);

  const activeCount = useMemo(() =>
    filters.states.length + filters.categories.length + filters.nights.length
    + (filters.region ? 1 : 0) + (filters.pax ? 1 : 0)
    + (filters.priceMin ? 1 : 0) + (filters.priceMax ? 1 : 0)
    + (filters.mine ? 1 : 0), [filters]);

  /** Write filters back to the URL. Every change resets to page 0, in exactly one place. */
  const patch = useCallback((next) => {
    const merged = { ...filters, ...next };
    const out = new URLSearchParams();
    for (const key of URL_KEYS) {
      const value = merged[key];
      if (value === "" || value === null || value === undefined || value === false) continue;
      if (Array.isArray(value)) {
        if (value.length) out.set(key, value.join(","));
        continue;
      }
      out.set(key, value === true ? "1" : String(value));
    }
    setPage(0);
    setParams(out, { replace: true });
  }, [filters, setParams]);

  const clearFilters = useCallback(() => {
    setTerm("");
    setPage(0);
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  /** The wire shape. Arrays go as arrays; the service comma-joins them. */
  const query = useMemo(() => ({
    q: filters.q || undefined,
    regions: filters.region ? [filters.region] : undefined,
    states: filters.states,
    categories: filters.categories,
    nights: filters.nights,
    pax: filters.pax || undefined,
    priceMin: filters.priceMin || undefined,
    priceMax: filters.priceMax || undefined,
    mineOnly: filters.mine ? true : undefined,
  }), [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await packageMarketplaceService.searchPackages({
          ...query, page, size: PAGE_SIZE,
        });
        if (cancelled) return;
        setRows(res.items);
        setPagination(res.pagination);
      } catch (e) {
        if (cancelled) return;
        setRows([]);
        // 400/404/409 are silent in the shared interceptor by design, so this call site renders it.
        if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not load packages"), "error");
      }
    })();
    return () => { cancelled = true; };
  }, [query, page, showToast]);

  /**
   * Facets refresh when a filter changes, not while typing: the option list does not move under a
   * keystroke, and recomputing it per character asks the server a question whose answer did not
   * change.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await packageMarketplaceService.facets(query);
        if (!cancelled) setFacets(res);
      } catch {
        // A missing rail degrades to no rail. Never toast for it — the grid is still usable, and
        // the agent did not ask for facets.
        if (!cancelled) setFacets(null);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  useHotkeys({ "/": () => searchRef.current?.focus() });

  const submitSearch = (e) => {
    e.preventDefault();
    patch({ q: term.trim() });
  };

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <Page width="max-w-none">
      <div style={FONT}>
        <PageHeader
          title="Packages"
          subtitle="Ready-to-book itineraries you can quote in one click."
          actions={
            <Button variant="secondary" onClick={() => navigate("/marketplace/packages/mine")}>
              My packages
            </Button>
          }
        />

        <form onSubmit={submitSearch} className="mt-4 flex gap-2">
          <Input
            ref={searchRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a destination, a state, or a stop on the route…"
            aria-label="Search packages"
          />
          <Button type="submit" variant="primary" className={PKG_PRIMARY}>
            <SearchIcon className="h-4 w-4" aria-hidden />
            Search
          </Button>
        </form>

        <div className="mt-4">
          <Tabs
            options={REGION_TABS}
            value={filters.region}
            onChange={(value) => patch({ region: value })}
          />
        </div>

        <div className="mb-6 mt-3" />

        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <PackageFilterRail
            facets={facets}
            value={filters}
            onChange={patch}
            onClear={clearFilters}
            activeCount={activeCount}
          />

          <div className="min-w-0 scroll-mt-4" ref={resultsRef}>
            {rows === null ? (
              <CardGridSkeleton />
            ) : rows.length === 0 ? (
              <Card>
                <Empty
                  icon={Package}
                  title={activeCount ? "No packages match those filters" : "No packages yet"}
                  hint={activeCount
                    ? "Try clearing a filter."
                    : "Packages published by the platform and by other agencies will appear here."}
                  action={activeCount
                    ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
                    : null}
                />
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((p) => (
                    <PackageCard
                      key={p.publicId}
                      pkg={p}
                      to={`/marketplace/packages/${p.publicId}`}
                    />
                  ))}
                </div>
                <div className="mt-6">
                  <Pager
                    page={page}
                    totalPages={totalPages}
                    total={pagination?.totalElements}
                    onPage={(next) => {
                      setPage(next);
                      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}

/** Mirrors the card's aspect box so the grid does not resize under the cursor when data lands. */
function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200">
          <div className="aspect-[4/3] w-full animate-pulse rounded-t-lg bg-slate-100 motion-reduce:animate-none" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
            <div className="h-7 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default PackageSearch;
