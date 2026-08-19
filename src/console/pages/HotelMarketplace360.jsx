// src/console/pages/HotelMarketplace360.jsx
//
// Everything about one platform hotel, in one place.
//
// WHY THIS EXISTS. Managing a single property meant four screens: the catalog list, this detail page,
// a separate full-page editor behind it, and the occupancy calendar on a different route entirely
// that showed every hotel at once. An operator answering "what is going on with Manali Pine Resort"
// had to hold the property in their head across all four, and nothing on any of them said what the
// others knew.
//
// WHAT IT IS NOT. Not a rewrite. The existing detail page is rendered UNCHANGED as the first tab —
// its rooms, rates, meal plans, amenities and step-up flows are correct and hard-won, and replacing
// working screens to make a nicer container is how working screens stop working. The three new tabs
// are additions beside it.
//
// STYLING: console realm. Semantic utilities only (bg-surface / text-heading / border-border /
// bg-accent). Raw slate-*/blue-* resolve to the TENANT palette and would break the violet theme —
// they are not scoped to `.sa-console` and would leak the wrong brand onto this screen.

import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BedDouble, CalendarRange, Image as ImageIcon, Loader2, Building2 } from "lucide-react";
import PlatformHotelDetail from "./PlatformHotelDetail";
import GoogleListingPanel from "./hotelmarketplace360/GoogleListingPanel";
import { platformHotelService, CATALOG_STATUS } from "../api/platformHotelService";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

/*
  The three new tabs load on demand.

  Each pulls its own data — the calendar a 92-day fold, the bookings tab a paged list — and an
  operator who opened this page to change a room name should not pay for either. Overview is NOT
  lazy: it is what the route resolves to by default, so deferring it would put a spinner in front of
  the thing everyone came for.
*/
const TabPhotos = lazy(() => import("./hotelmarketplace360/TabPhotos"));
const TabCalendar = lazy(() => import("./hotelmarketplace360/TabCalendar"));
const TabBookings = lazy(() => import("./hotelmarketplace360/TabBookings"));

const TABS = [
  { id: "overview", label: "Overview", Icon: BedDouble },
  { id: "photos", label: "Photos", Icon: ImageIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarRange },
  { id: "bookings", label: "Bookings", Icon: Building2 },
];

export default function HotelMarketplace360() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  /*
    Tab lives in the URL, not in state.

    An operator working a property sends "look at this" to a colleague, and a tab held in memory
    makes that link land on Overview every time. It also makes the browser Back button mean what it
    looks like it means — without it, Back from the Calendar tab leaves the catalog entirely.
  */
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab = TABS.some((t) => t.id === raw) ? raw : "overview";

  const setTab = useCallback((id) => {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  }, [params, setParams]);

  /*
    A LIGHT header load, separate from whatever each tab fetches.

    The header needs a name and a status and nothing else, and it has to be there before any tab
    resolves — otherwise switching tabs flashes an unlabelled page and the operator loses track of
    which property they are editing. Tabs own their own data; this owns the identity.
  */
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    platformHotelService.get(publicId)
      .then((h) => { if (alive) setHotel(h); })
      .catch((e) => {
        if (!alive) return;
        if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load this hotel."), "error");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [publicId, showToast]);

  const status = hotel?.status ? CATALOG_STATUS[hotel.status] : null;

  return (
    <div className="min-h-screen bg-page">
      {/* Sticky, so the property being worked on and the tab bar stay put through a long rooms list
          or a 92-day calendar. Losing which hotel you are on is the failure this whole page fixes. */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/console/hotel-catalog")}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Hotel catalog
          </button>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-extrabold tracking-tight text-heading">
              {hotel?.name ?? (loading ? "Loading…" : "Hotel")}
            </h1>
            {status && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                {status.label}
              </span>
            )}
            {hotel?.cityName && (
              <span className="text-sm text-muted">
                {[hotel.cityName, hotel.stateName, hotel.countryCode].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto" aria-label="Hotel sections">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
                    active
                      ? "border-accent text-heading"
                      : "border-transparent text-muted hover:text-body",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/*
        Overview stays MOUNTED once opened, the others unmount.

        The detail page holds edit state — a half-typed room name, an open dialog — and remounting it
        on every tab switch would silently discard that. The read-only tabs have nothing to lose and
        cost a fetch to keep alive.
      */}
      <div className={tab === "overview" ? "" : "hidden"}>
        <PlatformHotelDetail />

        {/* Rendered BESIDE the detail page rather than inside it: that component is left untouched,
            and a panel appended here cannot break its edit state or its step-up flows. */}
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <GoogleListingPanel
            hotel={hotel}
            publicId={publicId}
            onChanged={() => platformHotelService.get(publicId).then(setHotel).catch(() => {})}
          />
        </div>
      </div>

      {tab !== "overview" && (
        <Suspense fallback={<TabLoading />}>
          {tab === "photos" && <TabPhotos hotel={hotel} publicId={publicId} onChanged={() => {
            // A cover change moves primaryImageUrl, which the header and the catalog card both read.
            platformHotelService.get(publicId).then(setHotel).catch(() => {});
          }} />}
          {tab === "calendar" && <TabCalendar hotel={hotel} publicId={publicId} />}
          {tab === "bookings" && <TabBookings hotel={hotel} publicId={publicId} />}
        </Suspense>
      )}
    </div>
  );
}

function TabLoading() {
  return (
    <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-16 text-sm text-muted sm:px-6">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading…
    </div>
  );
}
