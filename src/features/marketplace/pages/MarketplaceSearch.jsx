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
  Building2, Check, ClipboardList, Download, DownloadCloud, Loader2, MapPin, Send, Star, X,
} from "lucide-react";
import { hasPermission, P } from "@shared/lib/access";
import { marketplaceService } from "../api/marketplaceService";
import { FilterRail } from "../components/FilterRail";
import { StaySearchBar } from "../components/StaySearchBar";
import {
  Button, Card, Empty, Page, PageHeader, Pager, Photo,
  errMsg, fmtMoney, useHotkeys, useToast,
} from "../components/marketplaceUi";

const PAGE_SIZE = 12;

/**
 * A tone per property type.
 *
 * <p>The hues are chosen to be distinguishable rather than meaningful — nothing here says a resort is
 * "better" than a guest house, and they are deliberately all at the same low saturation so no type
 * shouts over the others. What the colour buys is scanning: an agent looking for homestays finds them
 * by shape across a grid instead of reading twelve names.</p>
 *
 * <p>All light-background pairs clear 4.5:1 on white. `_default` catches any constant the backend
 * gains before this map does — a new type renders plainly rather than invisibly, which is the failure
 * mode to prefer.</p>
 */
const PROPERTY_TYPE_TONE = {
  HOTEL: "bg-blue-50 text-blue-700",
  RESORT: "bg-emerald-50 text-emerald-700",
  VILLA: "bg-violet-50 text-violet-700",
  HOMESTAY: "bg-amber-50 text-amber-800",
  APARTMENT: "bg-cyan-50 text-cyan-800",
  GUEST_HOUSE: "bg-teal-50 text-teal-700",
  HOSTEL: "bg-orange-50 text-orange-800",
  BOUTIQUE: "bg-fuchsia-50 text-fuchsia-700",
  CAMP: "bg-lime-50 text-lime-800",
  HOUSEBOAT: "bg-sky-50 text-sky-800",
  _default: "bg-slate-100 text-slate-700",
};

/**
 * Where/when/who as a query string, so it survives the hop to the detail page and the request form.
 *
 * <p>This is the whole point of the search bar: an agent with a customer on the phone enters the
 * stay once. Without it they typed the destination here and the dates and party size again one
 * screen later, from memory, which is where a party of four becomes a party of two.</p>
 *
 * <p>Only non-defaults are emitted — a URL carrying `adults=2&children=0&rooms=1` on every click is
 * noise in a link an agent may paste to a colleague.</p>
 */
function stayQuery(stay) {
  const p = new URLSearchParams();
  if (stay.checkIn) p.set("checkIn", stay.checkIn);
  if (stay.checkOut) p.set("checkOut", stay.checkOut);
  if (stay.rooms && stay.rooms !== 1) p.set("rooms", String(stay.rooms));
  if (stay.adults && stay.adults !== 2) p.set("adults", String(stay.adults));
  if (stay.children) p.set("children", String(stay.children));
  // The detail page still reads `stayDate` for pricing; check-in is that date.
  if (stay.checkIn) p.set("stayDate", stay.checkIn);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** `GUEST_HOUSE` → "Guest house". Derived, so a new backend constant still renders. */
function humanPropertyType(value) {
  const s = String(value ?? "").replace(/_/g, " ").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/**
 * The rail's cleared state. A module constant so "clear" and "initial" can never drift — they are
 * the same object, and a filter added to one is added to both.
 */
const EMPTY_FILTERS = {
  stars: [],
  propertyTypes: [],
  mealPlans: [],
  amenities: [],
  refundableOnly: false,
  minPrice: "",
  maxPrice: "",
};

export function MarketplaceSearch() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  /*
    Where / when / who, as one object.

    `where` feeds the server's `q`, which matches hotel name OR city as a substring. The old screen
    had BOTH a free-text box and an exact-match "City" box, and the exact one returned nothing for
    "Mana" while its neighbour matched "Manali" — strictly worse than the control beside it.

    The dates do not filter. They pick the commercial rule the "from" price is quoted under, and they
    travel to the request form so the agent does not type them twice. StaySearchBar says so on screen,
    because a date field that silently narrows nothing still reads as availability.
  */
  const [stay, setStay] = useState({
    where: "", checkIn: "", checkOut: "", rooms: 1, adults: 2, children: 0,
  });
  const [debouncedWhere, setDebouncedWhere] = useState("");

  /*
    The filter rail's state, kept as ONE object rather than eight useStates. Every change resets the
    page to 0 in a single place — a filter that narrows the set while leaving the reader on page 4 of
    a 2-page result shows an empty grid, and that reads as "no hotels match" rather than "you are past
    the end".
  */
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [facets, setFacets] = useState(null);
  const resultsRef = useRef(null);

  /*
    The top of the price bar, and the one number on this screen that is derived rather than fetched.

    A hotel's price is not a column — it is a supplier net through a per-hotel commercial rule — so
    the catalog's true maximum cannot be known without pricing every hotel in it, which is why the
    facets endpoint deliberately returns no price bounds. What CAN be known is the priciest hotel the
    agent is currently looking at, so the bar is scaled to that and its top thumb means "no upper
    limit" rather than that number.

    It only ever RISES within a session, and that is the point: recomputing it from each result set
    would rescale the bar underneath a thumb the agent is dragging — narrow to ₹4,000 and the ceiling
    would collapse to ₹4,000, pinning the thumb at the top and making the next drag mean something
    different from the last. Clearing the filters resets it.
  */
  const [priceCeiling, setPriceCeiling] = useState(0);

  /* Raised where the rows land, not in an effect watching them — an effect that setStates off its
     own render's data is a second render per page load for a number nothing is waiting on. */
  const raisePriceCeiling = useCallback((items) => {
    const top = (items ?? []).reduce((max, r) => {
      const n = Number(r.fromPricePerNight);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    // Rounded up to a round step, so the end of the bar is a number a person would say.
    if (top > 0) setPriceCeiling((c) => Math.max(c, Math.ceil(top / 500) * 500));
  }, []);

  const patchFilters = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPriceCeiling(0);
    setPage(0);
  }, []);

  /*
    Options are fetched once, not per search. They describe what the CATALOG contains, which changes
    when an operator edits it — not when the agent types. Failing silently is deliberate: a rail with
    no options is a degraded screen, but a toast about it is noise the agent cannot act on, and the
    grid itself still works.
  */
  useEffect(() => {
    let alive = true;
    marketplaceService.getFilters()
      .then((f) => { if (alive) setFacets(f); })
      .catch(() => { if (alive) setFacets(null); });
    return () => { alive = false; };
  }, []);
  const [importing, setImporting] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Debounced, because it is typed. Nine keystrokes of "Bangalore" used to be nine round trips whose
  // only lasting effect was the last one. The dates and the steppers commit on a single change and
  // need none.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedWhere(stay.where.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [stay.where]);

  const load = useCallback(() => {
    let alive = true;
    setRows(null);
    marketplaceService
      .searchHotels({
        page, size: PAGE_SIZE,
        q: debouncedWhere,
        // Check-in is what prices the list: a commercial rule's validity window is matched against
        // the STAY, so a December trip shopped with no date is quoted at today's markup.
        stayDate: stay.checkIn || undefined,
        ...filters,
      })
      .then((r) => {
        if (!alive) return;
        setRows(r.items);
        setPagination(r.pagination);
        raisePriceCeiling(r.items);
      })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        showToast(errMsg(e, "Could not load Platform Hotel."), "error");
      });
    return () => { alive = false; };
  }, [page, debouncedWhere, stay.checkIn, filters, showToast, raisePriceCeiling]);

  useEffect(load, [load]);

  /**
   * The Search button. Skips the debounce and puts the results under the reader's eye.
   *
   * <p>Typing is debounced by a third of a second so that nine keystrokes of "Bangalore" are not
   * nine round trips. Someone who has finished typing and reached for Search should not then wait
   * out a delay that exists for the person still typing — so this commits the term immediately. If
   * the term has not changed there is nothing to re-fetch, and the scroll is then the whole effect,
   * which on a phone is the useful half anyway: the bar is tall and the first card is below it.</p>
   */
  const runSearch = useCallback(() => {
    setDebouncedWhere(stay.where.trim());
    setPage(0);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stay.where]);

  // "/" jumps to search from anywhere on the page — and is ignored while a field already has focus.
  // "/" jumps to the Where field, which StaySearchBar owns. Queried by id rather than a ref threaded
  // through props: one line here beats forwarding a ref through a component whose job is laying out
  // three fields.
  useHotkeys({ "/": () => document.getElementById("stay-where")?.focus() });

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
      // The DEBOUNCED filters, not the live inputs — "Import all" has to mean the list that is on
      // screen. Reading the raw box would import against a filter the user can see but the results
      // below have not caught up to yet.
      const result = await marketplaceService.importAllHotels({
        q: debouncedWhere,
        // The rail's filters ride along too, or "Import all" imports a wider set than the grid is
        // showing. The server answers both through the same specification for the same reason.
        ...filters,
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
                      <span className="text-slate-500">·</span>
                      <span>{f.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setBulkResult(null)}
              className="rounded p-1 text-slate-500 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/*
        WHERE / WHEN / WHO replaces a filter strip.

        Three of the old controls are gone and each for its own reason:
          - the separate exact-match "City" box returned nothing for "Mana" while the free-text box
            beside it matched "Manali" — it was strictly worse than its neighbour;
          - the "Any rating" star select ANDed with the rail's exact-star checkboxes, so ticking 3
            there and 4 here produced an unsatisfiable filter and an empty grid with no explanation;
          - the lone stay-date input became the check-in of a real range.

        "Where" feeds `q`, which matches hotel name OR city as a substring, so a partial destination
        works the way anyone typing a destination expects.
      */}
      <StaySearchBar
        value={stay}
        destinations={facets?.destinations ?? []}
        onChange={(patch) => { setStay((s) => ({ ...s, ...patch })); setPage(0); }}
        onSearch={runSearch}
      />

      <div className="mb-6 mt-3" />

      {/*
        Rail beside results, not above them. A filter column stacked on top would push every
        photograph below the fold on the exact screen where that costs the most, and the rail
        collapses to a disclosure under lg for the same reason.
      */}
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterRail
          facets={facets}
          value={filters}
          onChange={patchFilters}
          onClear={clearFilters}
          priceCeiling={priceCeiling}
        />

        <div className="min-w-0 scroll-mt-4" ref={resultsRef}>
      {rows === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200">
              {/* Mirrors the card's own aspect box, so the grid does not resize under the cursor
                  the moment the first page of results lands. */}
              <div className="aspect-[4/3] w-full animate-pulse rounded-t-lg bg-slate-100 motion-reduce:animate-none" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
                <div className="h-7 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              </div>
            </div>
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
                onOpen={() => navigate(
                  `/marketplace/${h.publicId}${stayQuery(stay)}`,
                )}
                onImport={() => runImport(h)}
                // The chosen night rides along, so the request form quotes the same stay the grid
                // priced. Without it the agent shops a December rate and the form re-quotes at
                // today's markup, silently.
                onRequest={() => navigate(
                  `/marketplace/${h.publicId}/request${stayQuery(stay)}`,
                )}
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
        </div>
      </div>
    </Page>
  );
}

/**
 * One catalog hotel.
 *
 * The cover photo now runs the full width of the card in a 4:3 box instead of a 160px letterbox
 * strip. A hotel is chosen on how it looks, and the old strip was too short to show a building —
 * but nothing is layered ON the photograph: the star, the counts and the price all sit in the text
 * block below it, and the photo count is a quiet sentence, never a badge floating over the image.
 */
function HotelCard({ hotel: h, busy, onOpen, onImport, onRequest }) {
  const photoCount = Number(h.photoCount);
  const hasPhotoCount = Number.isFinite(photoCount) && photoCount > 0;

  return (
    /* Hover picks up the brand blue rather than a darker grey, and adds a soft ring instead of a
       shadow — enough to say "this is one object and it is pressable" without putting a raised card
       on a page whose whole idiom is hairlines. */
    <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-blue-300 hover:ring-1 hover:ring-blue-100 motion-reduce:transition-none">
      <button
        onClick={onOpen}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/20"
      >
        {/*
          `Photo` reserves the box before the bytes land and announces a dead URL in words. The
          no-URL case stays a separate branch on purpose: an `<img>` with no `src` never fires an
          error event, so the broken-image path cannot cover "this hotel has no cover photo".
        */}
        {h.primaryImageUrl ? (
          <Photo
            src={h.primaryImageUrl}
            alt={h.name}
            className="aspect-[4/3] w-full"
            fallback={
              <span className="flex flex-col items-center gap-1 text-slate-500">
                <Building2 className="h-6 w-6 text-slate-300" aria-hidden="true" />
                <span className="text-[12px]">Photo unavailable</span>
              </span>
            }
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-slate-50">
            <Building2 className="h-7 w-7 text-slate-300" aria-hidden="true" />
          </div>
        )}
        <div className="px-4 pt-3.5">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium text-slate-900">{h.name}</h3>
            {/*
              The star CLASSIFICATION — "a 4-star hotel" — not a guest score. It is a property
              attribute an operator records, and it sits apart from the Google rating below because
              conflating the two puts a number on screen meaning something other than it appears to.
            */}
            {h.stars ? (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-amber-600"
                title={`${h.stars}-star property`}
              >
                <Star className="h-3 w-3 fill-current" />{h.stars}
              </span>
            ) : null}
          </div>
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{[h.cityName, h.stateName, h.countryCode].filter(Boolean).join(", ")}</span>
          </p>
          {/*
            The property type, and this is where the card's colour comes from.

            Colour that ENCODES rather than decorates: a resort, a homestay and a serviced apartment
            are different products an agent sells to different customers, and the type was the one
            genuinely categorical fact on this card with no visual weight at all. A tone per type
            makes a grid of twelve scannable by kind without reading a word of it.

            Absent renders NOTHING. Most rows are legitimately unclassified — nobody has ever been
            asked the question — and an "Unknown" chip would give equal visual weight to a fact and
            to the absence of one.
          */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {h.propertyType && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  PROPERTY_TYPE_TONE[h.propertyType] ?? PROPERTY_TYPE_TONE._default
                }`}
              >
                {humanPropertyType(h.propertyType)}
              </span>
            )}
            <span className="text-[12px] text-slate-500">
              {h.roomCount ?? 0} room type{h.roomCount === 1 ? "" : "s"}
              {hasPhotoCount && ` · ${photoCount} photo${photoCount === 1 ? "" : "s"}`}
            </span>
          </div>

          {/*
            The GUEST rating, and it is Google's. Labelled as Google's for two reasons: their terms
            require the attribution wherever their content appears, and an unlabelled score beside a
            hotel reads as this platform's own verdict on it.

            Absent renders NOTHING — no placeholder, no zero, no empty stars. A hotel with no Google
            listing, or whose cached score has aged past its TTL, is a hotel we do not know the rating
            of; a greyed-out zero would say we know it and it is terrible.
          */}
          {h.googleRating != null && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-600">
              <Star className="h-3 w-3 shrink-0 fill-current text-amber-500" aria-hidden="true" />
              <span className="font-semibold text-slate-900">{Number(h.googleRating).toFixed(1)}</span>
              <span className="text-slate-500">
                on Google
                {h.googleRatingCount != null && ` · ${Number(h.googleRatingCount).toLocaleString("en-IN")} ratings`}
              </span>
            </p>
          )}

          <div className="mt-2 flex items-end justify-end gap-2">
            <FromPrice value={h.fromPricePerNight} currency={h.currency} />
          </div>
        </div>
      </button>

      {/*
        Both actions on the card, so neither needs a detour through the detail page.

        Requesting a booking used to be TWO hops from here — open the hotel, then find the button —
        and an agent who already knows the property they want was made to read a page to reach it.
        The two are independent operations: importing takes a copy into the tenant's own master,
        requesting books through the platform, and approval creates the projection anyway. Neither
        is a step toward the other, so neither belongs behind the other.

        Gated separately too: BOOK for the request, and the server gates the import on SYNC_MASTER.
      */}
      {/*
        Icon buttons, not two labelled ones. A card is a small surface and its content is the
        photograph — two full-width text buttons under every tile turned a grid of twelve into a grid
        of twenty-four buttons, and the eye had to read them all to find the picture again.

        Every one carries BOTH `aria-label` and `title`: an icon with neither is unusable with a
        screen reader and a guessing game with a mouse. The state that is not an action — "in your
        hotels" — stays a labelled mark rather than becoming a third button, because there is nothing
        to press.
      */}
      <div className="flex items-center justify-end gap-1.5 px-4 pb-4 pt-3">
        {h.alreadyImported ? (
          <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
            <Check className="h-3.5 w-3.5" /> In your hotels
          </span>
        ) : (
          <Button
            size="sm"
            onClick={onImport}
            loading={busy}
            aria-label="Import to my hotels"
            title="Import to my hotels"
            className="!px-2"
          >
            {!busy && <Download className="h-4 w-4" />}
          </Button>
        )}
        {hasPermission(P.HOTEL_MARKETPLACE_BOOK) && (
          <Button
            size="sm"
            variant="primary"
            onClick={onRequest}
            aria-label="Request booking"
            title="Request booking"
            className="!px-2"
          >
            <Send className="h-4 w-4" />
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
    /* Not ₹0 and not blank. A hotel with no rate card genuinely has no price, and "On request" is
       also the answer the agent has to give their own customer. Kept in slate: an absent price is
       not a warning, and colouring it would make an ordinary state look like a problem. */
    return <span className="shrink-0 text-[12px] text-slate-500">On request</span>;
  }
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="block text-[11px] uppercase tracking-wide text-slate-500">from</span>
      {/* The one number the whole card is scanned for, and it was the same size and weight as the
          room count beside it. Emerald because it is money the agent BUYS at — the same tone the
          "in your hotels" mark uses for a settled, good state — and larger because a grid is read by
          price far more often than by name. */}
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-emerald-700">
        {fmtMoney(value, currency || "INR")}
      </span>
      <span className="text-[12px] text-slate-500"> /night</span>
    </span>
  );
}

export default MarketplaceSearch;
