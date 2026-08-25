// src/features/marketplace/pages/TransportSearch.jsx
//
// The tenant's browse screen over the platform TRANSPORT catalog. Sibling of MarketplaceSearch,
// which does the same job for hotels — same feature, same kit, so the two read as one Marketplace
// rather than two products bolted together.
//
// Read-only by construction: the catalog belongs to the platform. The only writes reachable from
// here are importing a copy into this tenant's own Vehicle Master, and starting a request.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Armchair, Briefcase, Car, DownloadCloud, Loader2, MapPin, Search, Send, Snowflake, X,
} from "lucide-react";
import { hasPermission, P } from "@shared/lib/access";
import { transportMarketplaceService } from "../api/transportMarketplaceService";
import {
  Button, Card, Chip, Empty, Hint, Input, Notice, Page, PageHeader, Pager, Photo,
  SkeletonRows, errMsg, fmtMoney, useHotkeys, useToast,
} from "../components/marketplaceUi";

const PAGE_SIZE = 12;

/**
 * A tone per vehicle type.
 *
 * Chosen to be distinguishable rather than meaningful — nothing here says a coach is "better" than
 * a sedan — and all at the same low saturation so no type shouts over the others. What the colour
 * buys is scanning: an agent looking for tempo travellers finds them by shape across a grid instead
 * of reading twenty names. `_default` catches any constant the backend gains before this map does,
 * so a new type renders plainly rather than invisibly.
 */
const VEHICLE_TYPE_TONE = {
  SEDAN: "bg-blue-50 text-blue-700",
  HATCHBACK: "bg-cyan-50 text-cyan-800",
  SUV: "bg-emerald-50 text-emerald-700",
  MUV: "bg-teal-50 text-teal-700",
  TEMPO_TRAVELLER: "bg-violet-50 text-violet-700",
  MINI_BUS: "bg-amber-50 text-amber-800",
  BUS: "bg-orange-50 text-orange-800",
  COACH: "bg-fuchsia-50 text-fuchsia-700",
  LUXURY: "bg-indigo-50 text-indigo-700",
  _default: "bg-slate-100 text-slate-700",
};

const typeTone = (t) => VEHICLE_TYPE_TONE[t] ?? VEHICLE_TYPE_TONE._default;

/** `TEMPO_TRAVELLER` → `Tempo traveller`. The backend sends constants; a grid should not shout. */
export function humanise(value) {
  if (!value) return "";
  const s = String(value).replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Goa, Goa" without the trailing comma when only one of the two is known. */
function placeOf(v) {
  return [v?.cityName, v?.stateName].filter(Boolean).join(", ");
}

/**
 * What ONE unit of a rate model is, in words.
 *
 * `fromPrice` is the price of a single unit of `fromPriceRateModel`, so the unit is not decoration —
 * "₹2,400" against a per-day model and against a per-kilometre one are two numbers three orders of
 * magnitude apart, and an agent quoting the wrong one quotes a trip they cannot deliver.
 *
 * A model this map lacks renders with NO unit rather than a guessed one: an unlabelled amount is
 * ambiguous, an amount labelled "/day" that is really per km is wrong, and wrong is worse.
 * `CUSTOM_QUOTE` is deliberately in the map with an empty unit — it has no unit by definition.
 */
const RATE_MODEL_UNIT = {
  FLAT_PER_TRANSFER: "per transfer",
  FLAT_PER_VEHICLE: "per vehicle",
  PER_KILOMETRE: "per km",
  PER_DAY: "per day",
  PER_HOUR: "per hour",
  PACKAGE: "per package",
  ROUTE_FIXED: "per route",
  CUSTOM_QUOTE: "",
};

const rateUnit = (model) => RATE_MODEL_UNIT[model] ?? "";

export function TransportSearch() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // The box the agent types in, and the term actually on the wire. Kept apart so a search fires on
  // Enter rather than on every keystroke — the catalog is a server query, not a local filter.
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  const [importing, setImporting] = useState(null);
  const canBook = hasPermission(P.TRANSPORT_MARKETPLACE_BOOK);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: data, pagination: meta } = await transportMarketplaceService.searchVehicles({
        page,
        size: PAGE_SIZE,
        q: query || undefined,
      });
      setRows(data ?? []);
      setPagination(meta ?? null);
      setDenied(false);
    } catch (e) {
      // 403 here is an ENTITLEMENT answer, not a bug: the agency has not bought the add-on. The
      // interceptor already toasted it, so the page just explains itself instead of looking broken.
      if (e?.response?.status === 403) setDenied(true);
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useHotkeys({
    "/": () => searchRef.current?.focus(),
  });

  function runSearch(e) {
    e?.preventDefault();
    setPage(0);
    setQuery(term.trim());
  }

  function clearSearch() {
    setTerm("");
    setPage(0);
    setQuery("");
    searchRef.current?.focus();
  }

  /**
   * Copy a catalog vehicle into this tenant's own Vehicle Master.
   *
   * Idempotent, so a second press re-syncs rather than duplicating. A 409 here is ACTIONABLE and
   * must be shown verbatim: transport deliberately refuses to invent a city the tenant does not
   * have, and the message names the exact row to create.
   */
  async function importVehicle(v) {
    setImporting(v.publicId);
    try {
      await transportMarketplaceService.importVehicle(v.publicId);
      showToast(`${v.name} is now in your Vehicle Master.`, "success");
      load();
    } catch (e) {
      showToast(errMsg(e, "Could not import that vehicle."), "error");
    } finally {
      setImporting(null);
    }
  }

  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.totalElements ?? rows.length;

  if (denied) {
    return (
      <Page>
        <PageHeader title="Transport" subtitle="Vehicles the platform has contracted, bookable on request." />
        <Notice tone="info">
          Transport Marketplace is not on your plan yet. Your own Vehicle Master and quotations are
          unaffected — this screen only adds the platform's contracted fleet on top of them.
        </Notice>
      </Page>
    );
  }

  return (
    <Page width="max-w-6xl">
      <PageHeader
        title="Transport"
        subtitle="Vehicles the platform has contracted. Every listing is on request — you send an enquiry, the platform team confirms it."
        actions={
          <Button variant="secondary" onClick={() => navigate("/marketplace/transport/orders")}>
            My requests
          </Button>
        }
      />

      <form onSubmit={runSearch} className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by vehicle, type or city"
            className="pl-9 pr-9"
            aria-label="Search the transport catalog"
          />
          {term && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" variant="primary">Search</Button>
        <Hint keys={["/"]} label="to search" className="hidden sm:flex" />
      </form>

      {loading ? (
        <SkeletonRows count={6} />
      ) : rows.length === 0 ? (
        <Empty
          icon={Car}
          title={query ? "No vehicles match that" : "The catalog is empty"}
          hint={
            query
              ? "Try a broader term — the search covers the vehicle name, its type and the city it reports from."
              : "The platform team has not published any vehicles yet."
          }
          action={query ? <Button onClick={clearSearch}>Clear search</Button> : null}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((v) => (
              <Card key={v.publicId} flush className="flex flex-col overflow-hidden">
                <Photo
                  src={v.primaryImageUrl}
                  alt={v.name}
                  className="h-40 w-full"
                  fallback={
                    <span className="flex h-full items-center justify-center text-slate-300">
                      <Car className="size-8" />
                    </span>
                  }
                />

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-slate-900">{v.name}</h3>
                    {placeOf(v) && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-slate-500">
                        <MapPin className="size-3.5 shrink-0" />
                        {placeOf(v)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${typeTone(v.vehicleType)}`}>
                      {humanise(v.vehicleType)}
                    </span>
                    {v.passengerCapacity != null && (
                      <Chip>
                        <Armchair className="size-3" /> {v.passengerCapacity}
                      </Chip>
                    )}
                    {v.luggageCapacity != null && (
                      <Chip>
                        <Briefcase className="size-3" /> {v.luggageCapacity}
                      </Chip>
                    )}
                    {v.airConditioned && (
                      <Chip>
                        <Snowflake className="size-3" /> AC
                      </Chip>
                    )}
                  </div>

                  <FromPrice
                    value={v.fromPrice}
                    currency={v.fromPriceCurrency}
                    rateModel={v.fromPriceRateModel}
                  />

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      disabled={!canBook}
                      title={canBook ? undefined : "You do not have permission to request transport"}
                      onClick={() => navigate(`/marketplace/transport/${v.publicId}/request`)}
                    >
                      <Send className="size-3.5" /> Request
                    </Button>

                    {/* Import is a MASTER write, not a booking one, so it stands apart from the
                        primary action and reads as tidying rather than buying. */}
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={importing === v.publicId}
                      onClick={() => importVehicle(v)}
                      title={
                        v.tenantVehiclePublicId
                          ? "Already in your Vehicle Master — re-sync it"
                          : "Copy into your Vehicle Master"
                      }
                    >
                      {importing === v.publicId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <DownloadCloud className="size-3.5" />
                      )}
                      {v.tenantVehiclePublicId ? "Re-sync" : "Import"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} className="mt-6" />
        </>
      )}
    </Page>
  );
}

/**
 * The starting price of a vehicle, or the honest absence of one.
 *
 * <h3>Why a "from" price and not a price</h3>
 * The catalog row cannot know the journey — how many days, how far, which service type — so the
 * server prices ONE unit of the vehicle's cheapest rate model and sends that. It is a floor to
 * compare cards by, not the amount anybody pays, which is why the unit is rendered beside it and
 * why the word "indicative" is on the card rather than buried in a tooltip. The real figure comes
 * from the quote on the request form, and the binding one from the platform's approval.
 *
 * <h3>null is not zero</h3>
 * A vehicle whose rate card the engine cannot price yet has NO price — the field arrives null, and
 * rendering ₹0 would put a number in front of an agent that they could quote to a customer and then
 * be held to. "Quoted on request" is also the sentence they have to say on the phone, so it is the
 * useful thing to show. Tested for null explicitly rather than falsiness: a genuinely free transfer
 * would still be a price.
 *
 * <h3>Availability is still on request either way</h3>
 * v1 holds nothing. A priced card is not a bookable seat — the line under the amount says so, and
 * removing it would turn an indicative floor into a promise the platform has not made.
 */
function FromPrice({ value, currency, rateModel }) {
  if (value === null || value === undefined) {
    /* Kept in slate: an absent price is an ordinary state of an ON_REQUEST marketplace, and
       colouring it would make it look like something went wrong. */
    return (
      <p className="text-[12px] text-slate-500">
        Quoted on request — the platform team confirms availability and price.
      </p>
    );
  }

  const unit = rateUnit(rateModel);
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">from</span>
        {/* Emerald and larger than the chips beside it, matching the hotel card: a grid of vehicles
            is scanned by price far more often than by name. */}
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-emerald-700">
          {fmtMoney(value, currency || "INR")}
        </span>
        {unit && <span className="text-[12px] text-slate-500">{unit}</span>}
        {/* Quiet on purpose. It has to be readable next to every price — a loud badge repeated
            twelve times down a grid stops being read by the third card. */}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          indicative
        </span>
      </p>
      <p className="mt-0.5 text-[12px] text-slate-500">
        On request — the platform team confirms availability and the final price.
      </p>
    </div>
  );
}

export default TransportSearch;
