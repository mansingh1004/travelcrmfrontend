// src/features/marketplace/pages/MarketplaceHotel.jsx
//
// Read-only detail of one catalog hotel, plus the two things a tenant may do with it: import a copy
// into its own Hotel Master, and send a booking request to the platform.
//
// The page is built around its PHOTOGRAPHS. An agent decides here whether a property is right for
// their customer, and until this release the page showed one cover image and described eight room
// types in grey sentences. The property gallery leads, and every room type carries its own gallery
// directly beneath its own facts — because the room is the thing being sold.
//
// Two rules the layout enforces rather than merely follows:
//   1. a room with no photos shows a designed empty state and NEVER a hotel photo. A lobby shot
//      standing in for a room misleads the agent's customer, and the agent never learns it did.
//   2. room photos may appear in the PROPERTY viewer, grouped under the room's name. Property
//      photos may never appear inside a room's gallery. The grouping is one-directional on purpose.
//
// Rooms carry an INDICATIVE per-night payable. That figure is the catalog's rate card already put
// through the platform's commercial rule — it is what the TENANT would owe, never what the platform
// pays the hotel, and the net rate is neither on this response nor derivable from it.
//
// It stays indicative because this release is ON_REQUEST: there is no rate calendar and no
// allotment, so the platform is not bound by it and the real amount is agreed with the property at
// approval. The list-level notice says so; do not render a per-night figure without it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Baby, BedDouble, Building2, Check, Download, ExternalLink, LogIn, LogOut, MapPin,
  ScrollText, Send, ShieldAlert, Star, Users, UtensilsCrossed,
} from "lucide-react";
import { amenityIcon } from "../components/amenityIcon";

/** Enough to judge a property by. The rest are one press away, with the count on the button. */
const AMENITY_PREVIEW = 12;
import { hasPermission, P } from "@shared/lib/access";
import { marketplaceService } from "../api/marketplaceService";
import { HeroGallery } from "../components/HeroGallery";
import { Lightbox } from "../components/Lightbox";
import { RoomRow } from "../components/RoomRow";
import {
  BackLink, Button, Card, Empty, Notice, Page, PageHeader, SectionLabel,
  errMsg, fmtDate, fmtMoney, useToast,
} from "../components/marketplaceUi";

export function MarketplaceHotel() {
  const { publicId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Carried in the URL rather than picked here. The search screen already knows the night the agent
  // is shopping for, and a commercial rule's validity window is matched against the STAY — so a
  // December stay priced at November's markup would be quietly wrong. It is not an availability
  // filter: this release holds no allotment.
  const stayDate = searchParams.get("stayDate") || undefined;

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);   // {tone, text} — a sticky version of the import result
  const [reviews, setReviews] = useState(null);
  const [viewer, setViewer] = useState(null);   // { scope: "property" | "room", roomPublicId?, index }
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  /**
   * The `alive` latch is not optional here. Opening a hotel and hitting Back before the response
   * lands used to setState on an unmounted component — React 19 does not crash on that, it just
   * warns and leaks the update, but the same race also lets a stale hotel overwrite a newer one when
   * the agent clicks two hotels quickly. MarketplaceSearch has always done it this way.
   */
  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    marketplaceService
      .getHotel(publicId, stayDate)
      .then((h) => { if (alive) setHotel(h); })
      .catch((e) => { if (alive) showToast(errMsg(e, "Could not load this hotel."), "error"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [publicId, stayDate, showToast]);

  useEffect(load, [load]);

  /**
   * Reviews are fetched SEPARATELY and never awaited by the page.
   *
   * They come from Google over a network the platform does not control. On the detail response a
   * single slow round-trip would hold back the photos, the rooms and the price — the three things
   * the agent actually opened this page for. A failure here is silent by design: nobody asked for
   * reviews, so nobody should be toasted about them.
   */
  useEffect(() => {
    let alive = true;
    marketplaceService
      .getHotelReviews(publicId)
      .then((r) => { if (alive) setReviews(r); })
      .catch(() => { if (alive) setReviews(null); });
    return () => { alive = false; };
  }, [publicId]);

  const runImport = async () => {
    setImporting(true);
    setNotice(null);
    try {
      const result = await marketplaceService.importHotel(publicId);
      showToast(
        result.created ? `${result.name} added to your hotels.` : `${result.name} refreshed.`,
        "success",
      );
      // LOCATION_MAPPING_REQUIRED is a *successful* import that could not be placed in the tenant's
      // geography. The message names the exact country/city to create, so it is pinned to the page
      // rather than left to a toast the user may miss.
      if (result.message) setNotice({ tone: "warn", text: result.message });
      load();
    } catch (e) {
      // A 409 here is the expected "your masters are missing this city" answer, and the shared
      // interceptor stays silent on 409 by design — so the call site has to show it.
      setNotice({ tone: "error", text: errMsg(e, "Could not import this hotel.") });
    } finally {
      setImporting(false);
    }
  };

  // Memoised only to keep the identity stable: `?? []` mints a fresh array on every render, which
  // would invalidate the grouping memo below on every keystroke elsewhere on the page.
  const rooms = useMemo(() => hotel?.rooms ?? [], [hotel]);

  /*
    Alphabetical, because the underlying column is free text entered by two different audiences in
    whatever order they typed it — and alphabetical is the only order that lets an agent check for one
    specific thing without reading all of them.

    Declared up here with the other memos and NOT beside the markup that uses it: everything below the
    early returns runs conditionally, and a hook that only sometimes runs breaks the hook order.
  */
  const sortedAmenities = useMemo(
    () => [...(hotel?.amenities ?? [])].sort((a, b) => String(a).localeCompare(String(b))),
    [hotel?.amenities],
  );

  /**
   * Room photos, keyed by room publicId, with the legacy `rooms[].images` string list as a fallback.
   *
   * `roomImages` is the response's structured map and is the field to trust. The fallback reads the
   * SAME underlying collection the server wraps to build that map, in the same order and with the
   * same first-is-cover rule — so it can only ever produce this room's own photographs. It exists
   * because a room silently showing "no photos" while its URLs sit one field away is the kind of
   * failure nobody reports: the agent just concludes the platform never uploaded any.
   *
   * That order is best-effort, not the property's chosen sequence: the legacy collection is an
   * unordered Hibernate bag with no order column. Never present it as a curated running order.
   */
  const roomPhotos = useMemo(() => {
    const structured = hotel?.roomImages ?? {};
    const out = {};
    for (const room of rooms) {
      const fromMap = structured[room.publicId];
      if (fromMap?.length) {
        out[room.publicId] = fromMap;
        continue;
      }
      const legacy = Array.isArray(room.images) ? room.images.filter(Boolean) : [];
      if (legacy.length > 0) {
        out[room.publicId] = legacy.map((url, i) => ({
          publicId: null, url, caption: null, category: "GENERAL", displayOrder: i, primary: i === 0,
        }));
      }
    }
    return out;
  }, [hotel, rooms]);

  /**
   * The property gallery, with the legacy single-column cover as its fallback.
   *
   * `primaryImageUrl` predates the gallery table and is still populated for hotels nobody has
   * uploaded a gallery for. Wrapping it into a one-item list keeps every downstream component on the
   * same shape instead of forcing each of them to special-case a bare string.
   */
  const propertyImages = useMemo(() => {
    const gallery = hotel?.propertyImages ?? [];
    if (gallery.length > 0) return gallery;
    return hotel?.primaryImageUrl
      ? [{ url: hotel.primaryImageUrl, category: "GENERAL", displayOrder: 0, primary: true }]
      : [];
  }, [hotel]);

  /**
   * What the PROPERTY viewer pages through: the property's own photos first, then each room's run
   * under the room's name.
   *
   * This direction only. A room's viewer is handed that room's array and nothing else, so the
   * grouping can enrich the property tour without ever letting a lobby shot surface inside a room.
   */
  const propertyGroups = useMemo(() => {
    const groups = [];
    if (propertyImages.length > 0) {
      groups.push({ label: hotel?.name ?? "Property", images: propertyImages });
    }
    for (const room of rooms) {
      const shots = roomPhotos[room.publicId] ?? [];
      if (shots.length > 0) groups.push({ label: room.name, images: shots });
    }
    return groups;
  }, [hotel?.name, propertyImages, rooms, roomPhotos]);

  if (loading) return <HotelSkeleton />;

  if (!hotel) {
    return (
      <Page>
        <Empty
          icon={Building2}
          title="Hotel not available"
          hint="It may have been withdrawn from Platform Hotel."
          action={<Button onClick={() => navigate("/marketplace")}>Back to Platform Hotel</Button>}
        />
      </Page>
    );
  }

  const location = [hotel.cityName, hotel.stateName, hotel.countryCode].filter(Boolean).join(", ");

  // Only show the "indicative" caveat when there is actually a figure to qualify. A hotel with no
  // rate card shows no prices, and a standing disclaimer about prices that are not on screen is
  // noise the reader has to decode.
  const hasAnyRoomPrice = rooms.some(
    (r) => r.indicativePayablePerNight !== null && r.indicativePayablePerNight !== undefined,
  );

  /*
    An icon per policy KIND, not per row. The four are read for different reasons — two are times an
    agent reads off to a customer, one is a rule about who may stay, one is money at risk — and giving
    them one shared bullet made them look like four instances of the same thing.
  */
  const visibleAmenities = showAllAmenities
    ? sortedAmenities
    : sortedAmenities.slice(0, AMENITY_PREVIEW);

  const has = (v) => v !== null && v !== undefined && String(v).trim() !== "";

  /** Kept only to decide whether the "Things to know" section renders at all. */
  const policies = [hotel.checkInTime, hotel.checkOutTime, hotel.childPolicy, hotel.cancellationPolicy]
    .filter(has);

  /*
    House rules. The prepositions are the point — "after 2:00 PM" and "before 11:00 AM" say something
    a bare time does not, and an agent reads these to a customer over the phone.

    The guest maximum is DERIVED from the largest room, not stored: a property's real ceiling is its
    biggest room's occupancy, and stating a number nobody entered would be worse than omitting it. It
    only appears when at least one room actually declares a maxOccupancy.
  */
  const maxGuests = rooms.reduce(
    (m, r) => (r.maxOccupancy != null && r.maxOccupancy > m ? r.maxOccupancy : m), 0);

  const houseRules = [
    has(hotel.checkInTime)
      && { text: `Check-in after ${hotel.checkInTime}`, Icon: LogIn, tone: "text-emerald-600" },
    has(hotel.checkOutTime)
      && { text: `Checkout before ${hotel.checkOutTime}`, Icon: LogOut, tone: "text-amber-600" },
    maxGuests > 0
      && { text: `${maxGuests} guest${maxGuests === 1 ? "" : "s"} maximum per room`, Icon: Users, tone: "text-sky-600" },
    has(hotel.childPolicy)
      && { text: hotel.childPolicy, Icon: Baby, tone: "text-pink-600" },
  ].filter(Boolean);

  const activeRoom = viewer?.scope === "room"
    ? rooms.find((r) => r.publicId === viewer.roomPublicId)
    : null;

  /*
    The cheapest room, for the summary panel. It is the number an agent needs before anything else on
    this page — "can I sell this at all" comes before amenities and policies — and until now it only
    existed inside a room row, several scrolls down.

    Null when no room has a rate: that hotel is "on request", not free. Rendering it as a figure would
    put a price on screen the platform is not bound by.
  */
  const fromPrice = rooms.reduce((min, r) => {
    const p = r.indicativePayablePerNight;
    if (p === null || p === undefined) return min;
    return min === null || Number(p) < Number(min) ? p : min;
  }, null);

  return (
    <Page width="max-w-6xl">
      <PageHeader
        back={<BackLink onClick={() => navigate("/marketplace")}>Platform Hotel</BackLink>}
        title={
          <span className="inline-flex items-center gap-2">
            {hotel.name}
            {hotel.stars ? (
              <span className="inline-flex items-center gap-0.5 text-sm font-normal text-amber-600">
                <Star className="h-3.5 w-3.5 fill-current" />{hotel.stars}
              </span>
            ) : null}
          </span>
        }
        subtitle={location}
        /*
          Header actions are the MOBILE path only. From `lg` up the sticky rail carries them, and two
          live copies of "Request booking" on one screen is a second thing to keep in step and a
          moment's doubt about whether they do the same thing. Below `lg` the rail stacks under the
          content, so without these the only way to act would be to scroll past the whole page.

          Requesting is independent of importing: a tenant can book through the platform without
          holding a copy in its own master, and approval creates the projection anyway. Gated on
          BOOK — importing only needs SYNC_MASTER.
        */
        actions={
          <div className="flex items-center gap-2 lg:hidden">
            {hotel.alreadyImported ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                <Check className="h-3.5 w-3.5" /> In your hotels
              </span>
            ) : (
              <Button onClick={runImport} loading={importing}>
                {!importing && <Download />}
                {importing ? "Importing…" : "Import to my hotels"}
              </Button>
            )}
            {hasPermission(P.HOTEL_MARKETPLACE_BOOK) && (
              <Button variant="primary" onClick={() => navigate(`/marketplace/${publicId}/request`)}>
                <Send /> Request booking
              </Button>
            )}
          </div>
        }
      />

      {/* The photographs lead. No heading above them — a "Photos" label over a grid of photographs
          is a caption for something already obvious. */}
      <HeroGallery
        images={propertyImages}
        title={hotel.name}
        onOpen={(index) => setViewer({ scope: "property", index })}
        className="mb-8"
      />

      {notice && <Notice tone={notice.tone} className="mb-6">{notice.text}</Notice>}

      {/*
        TWO COLUMNS, and the reason is not decoration.

        Everything used to be one `max-w-5xl` ribbon with `mb-8` between every block, so a wide screen
        showed a narrow strip of content framed by dead space and separated by gaps big enough to lose
        the thread in. The right rail costs nothing horizontally that the page was using, and it
        carries the two things an agent needs continuously — what it costs, and how to act on it —
        which were previously only reachable by scrolling back to the header.

        Section rhythm is `space-y-8` on the column rather than `mb-8` on each child: sibling margins
        collapse and double unpredictably once anything is conditional, and half of these blocks are.
      */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
        <div className="min-w-0 space-y-8">
          {/*
            ROOMS FIRST. This is the decision the agent came to make — which room, at what rate — and
            it used to sit below About, Amenities and Policies. Prose about the property is context
            for a choice; it should not stand in front of it.
          */}
          <section>
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> Room types</span>
            </SectionLabel>
            {rooms.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-500">No room types listed.</p>
              </Card>
            ) : (
              <ul className="border-t border-slate-100">
                {rooms.map((room) => (
                  <RoomRow
                    key={room.publicId}
                    room={room}
                    images={roomPhotos[room.publicId]}
                    currency={hotel.currency}
                    onOpenPhoto={(index) => setViewer({ scope: "room", roomPublicId: room.publicId, index })}
                  />
                ))}
              </ul>
            )}

            {/*
              One caveat for the whole room list, rather than one per row. It is the same sentence the
              quote endpoint returns in `note`, and it has to be here too: a per-night figure with no
              qualifier reads as a rate the platform is bound by, and this release is ON_REQUEST — the
              real amount is agreed with the property at approval.
            */}
            {hasAnyRoomPrice && (
              <Notice tone="info" className="mt-4">
                Indicative prices, for one room for one night
                {stayDate ? ` on ${fmtDate(stayDate)}` : ""}. The final amount is confirmed with the
                property when your request is approved, and you will be asked to accept any change
                before it applies.
              </Notice>
            )}
          </section>

          {/*
            Board basis sits directly under the rooms, not in its own far-away section. A room is SOLD
            with a meal plan — an agent reading a room row and then hunting three screens down to find
            out whether breakfast is included is doing the join by hand.
          */}
          {(hotel.mealPlans ?? []).length > 0 && (
            <section>
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5" /> Meal plans</span>
              </SectionLabel>
              {/* Said once, above the list. A board code on a room row is meaningless to anyone who
                  has not been told these are the options every room can be sold on. */}
              <p className="mb-2 text-sm text-slate-500">
                Boards this property sells. Any room above can be quoted on any of them.
              </p>
              <Card flush>
                <ul className="divide-y divide-slate-100">
                  {hotel.mealPlans.map((m) => (
                    <li key={m.publicId} className="flex items-start gap-3 px-4 py-3">
                      {/* Monospace and fixed-width: EP/CP/MAP/AP are codes an agent matches by shape,
                          and a proportional font makes a three-letter code and a two-letter one look
                          like different kinds of thing. */}
                      <span className="mt-px w-12 shrink-0 rounded border border-slate-200 bg-slate-50 py-0.5 text-center font-mono text-[12px] font-medium text-slate-700">
                        {m.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{m.name}</p>
                        {m.description && (
                          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{m.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {hotel.overview && (
            <section>
              <SectionLabel>About</SectionLabel>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{hotel.overview}</p>
            </section>
          )}

          {(hotel.amenities ?? []).length > 0 && (
            <section>
              <SectionLabel>Amenities ({hotel.amenities.length})</SectionLabel>
              {/*
                A columned list, not a wrapped chip cloud. 43 amenities as chips is a wall with no
                scanning order and no way to tell where it ends — and these are facts to READ, not
                controls to press, so making them look pressable was wrong twice over.

                Sorted, because the underlying column is free text entered by two different audiences
                in whatever order they happened to type it; alphabetical is the only order that lets
                an agent check for one specific thing without reading all of them.
              */}
              {/* An icon per KIND, so "is there parking" is a scan rather than a read of all 43.
                  The colour follows the meaning — water blue, food amber — and anything the map does
                  not recognise stays neutral rather than being given a colour it does not mean. */}
              <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleAmenities.map((a) => {
                  const { Icon, tone } = amenityIcon(a);
                  return (
                    <li key={a} className="flex items-start gap-2 text-sm text-slate-700">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
                      <span className="min-w-0 break-words">{a}</span>
                    </li>
                  );
                })}
              </ul>

              {/* Forty-three amenities is a wall with no end in sight, and the page below it stops
                  being reachable. Twelve is enough to judge a property by; the rest are one press
                  away and the count says exactly how many that is. */}
              {sortedAmenities.length > AMENITY_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllAmenities((v) => !v)}
                  className="mt-3 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                >
                  {showAllAmenities
                    ? "Show less"
                    : `Show all ${sortedAmenities.length} amenities`}
                </button>
              )}
            </section>
          )}

          {/*
            A definition list, not the kit's `Row` — `Row` pairs a label with an editable control and
            carries a `<label htmlFor>`, which points at nothing here. Same rhythm, honest semantics.
            Each field renders only when the catalog actually has it: a "Cancellation — —" line reads
            as "no cancellation policy", which is a claim nobody made.
          */}
          {/*
            "Things to know", split the way an agent actually uses it: what it costs to change your
            mind, and what the property requires of the guest. Two columns, not a flat list of four
            labelled rows — cancellation is money at risk and the rest are house rules, and reading
            them as one list is how a cancellation window gets skimmed past.

            Airbnb's third column, "Safety & property", has no counterpart here and is deliberately
            absent rather than empty. It can say "Smoke alarm not reported" because it ASKS every host
            and records the silence; this platform has never asked, so "not reported" would be a claim
            about an answer nobody was ever given the chance to give.

            The prepositions are load-bearing: "after 2:00 PM" and "before 11:00 AM" say something a
            bare time does not, and an agent reads these down a phone line.
          */}
          {(policies.length > 0 || houseRules.length > 0) && (
            <section>
              <SectionLabel>Things to know</SectionLabel>
              <div className="grid gap-6 border-t border-slate-100 pt-4 sm:grid-cols-2">
                {hotel.cancellationPolicy && (
                  <div>
                    <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                      Cancellation policy
                    </h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                      {hotel.cancellationPolicy}
                    </p>
                  </div>
                )}

                {houseRules.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ScrollText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                      House rules
                    </h3>
                    <ul className="space-y-1.5">
                      {houseRules.map((r) => (
                        <li key={r.text} className="flex items-start gap-2 text-sm leading-relaxed text-slate-600">
                          <r.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${r.tone}`} aria-hidden="true" />
                          <span className="min-w-0 whitespace-pre-line">{r.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Last in the column on purpose: it arrives on its own timeline, and anything below a
              block that appears late gets shoved down while the reader is mid-sentence. */}
          <Reviews data={reviews} />
        </div>

        {/*
          The rail. Sticky from `lg` up, stacked above the content below it — on a phone a panel that
          tried to stick would eat the screen the photographs need.
        */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-4">
            <div>
              {fromPrice !== null ? (
                <>
                  <p className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">
                    {fmtMoney(fromPrice, hotel.currency)}
                  </p>
                  <p className="text-sm text-slate-500">per night, from</p>
                </>
              ) : (
                /* Not ₹0 and not blank. "On request" is the honest answer for a hotel with no rate
                   card, and it is also the answer the agent has to give their own customer. */
                <>
                  <p className="text-[17px] font-semibold text-slate-900">Price on request</p>
                  <p className="text-sm text-slate-500">No published rate for this property yet.</p>
                </>
              )}
            </div>

            <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
              {hotel.propertyType && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Type</dt>
                  <dd className="text-slate-700">{humanPropertyType(hotel.propertyType)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Room types</dt>
                <dd className="tabular-nums text-slate-700">{rooms.length}</dd>
              </div>
              {hotel.address && (
                <div className="flex gap-2 pt-1 text-slate-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{hotel.address}</span>
                </div>
              )}
            </dl>

            {/* The actions follow the reader down the page. They were in the header, which meant they
                left the screen exactly when the agent reached the rooms and had decided. */}
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              {hasPermission(P.HOTEL_MARKETPLACE_BOOK) && (
                <Button variant="primary" onClick={() => navigate(`/marketplace/${publicId}/request`)}>
                  <Send /> Request booking
                </Button>
              )}
              {hotel.alreadyImported ? (
                <span className="inline-flex items-center justify-center gap-1.5 text-sm text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> In your hotels
                </span>
              ) : (
                <Button onClick={runImport} loading={importing}>
                  {!importing && <Download />}
                  {importing ? "Importing…" : "Import to my hotels"}
                </Button>
              )}
            </div>

            {(hotel.website || hotel.mapUrl) && (
              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3">
                {hotel.website && <ExternalLinkRow href={hotel.website} label="Website" />}
                {hotel.mapUrl && <ExternalLinkRow href={hotel.mapUrl} label="Map" />}
              </div>
            )}
          </Card>
        </aside>
      </div>

      <Lightbox
        open={viewer !== null}
        onClose={() => setViewer(null)}
        index={viewer?.index ?? 0}
        onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        title={viewer?.scope === "room" ? (activeRoom?.name ?? "Room") : hotel.name}
        groups={viewer?.scope === "property" ? propertyGroups : undefined}
        images={viewer?.scope === "room" ? (roomPhotos[viewer.roomPublicId] ?? []) : undefined}
      />
    </Page>
  );
}

/**
 * The layout, greyed out — not a centred spinner.
 *
 * A spinner on a photo-led page tells the reader nothing and then replaces itself with a page of a
 * completely different height, which throws the scroll position. Blocking out the header, the
 * gallery grid and the room rows means the page arrives into the shape it was already occupying.
 */
function HotelSkeleton() {
  const box = "animate-pulse rounded bg-slate-100 motion-reduce:animate-none";
  return (
    <Page>
      <div className="mb-8">
        <div className={`h-3 w-28 ${box}`} />
        <div className={`mt-4 h-7 w-2/3 ${box}`} />
        <div className={`mt-2 h-3 w-44 ${box}`} />
      </div>

      <div className={`mb-3 h-3 w-16 ${box}`} />
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`aspect-[4/3] w-full rounded-lg ${box}`} />
        ))}
      </div>

      <div className={`mb-3 h-3 w-20 ${box}`} />
      <div className="mb-8 space-y-2">
        <div className={`h-3 w-full ${box}`} />
        <div className={`h-3 w-11/12 ${box}`} />
        <div className={`h-3 w-3/5 ${box}`} />
      </div>

      <div className={`mb-3 h-3 w-24 ${box}`} />
      <div className="border-t border-slate-100">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border-b border-slate-100 py-6">
            <div className={`h-3.5 w-48 ${box}`} />
            <div className={`mt-2 h-3 w-64 ${box}`} />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className={`aspect-[4/3] w-full rounded-lg ${box}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/**
 * Guest reviews, from Google.
 *
 * Renders NOTHING — not an empty heading, not a "no reviews yet" line — when the platform could not
 * get them. `UNAVAILABLE` covers a hotel with no place id, an exhausted quota and an upstream
 * timeout alike, and none of those mean "this hotel has no reviews". Printing that heading over an
 * empty list would state something the platform does not know.
 *
 * Tightened to the real contract. This was written against guessed field names while the DTO was
 * still being authored in parallel, and it guessed one of them wrong: it tested `data.status`, while
 * `PlaceReviewDto` calls that field `source`. The effect was invisible in the worst way — an
 * UNAVAILABLE answer was not recognised as one, so the component fell through to its own emptiness
 * check and happened to render nothing anyway. Correct output, wrong reason, and it would have
 * started rendering a hollow block the moment the DTO gained any other populated field.
 *
 * `PlaceReviewDto` is `{ rating, userRatingCount, reviews[], attributionUrl, source }`, and
 * `source` is LIVE | CACHE | UNAVAILABLE.
 */
function Reviews({ data }) {
  // UNAVAILABLE means the flag is off, the hotel has no place id, or Google could not be reached.
  // All three are "we have nothing to say", and saying nothing is the honest render.
  if (!data || data.source === "UNAVAILABLE") return null;

  const rating = Number(data.rating);
  const count = Number(data.userRatingCount);
  const rows = Array.isArray(data.reviews) ? data.reviews : [];
  const hasRating = Number.isFinite(rating) && rating > 0;

  if (!hasRating && rows.length === 0) return null;

  return (
    <>
      <SectionLabel>Guest reviews</SectionLabel>
      <div className="mb-8">
        {hasRating && (
          <p className="mb-4 flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold text-slate-900">{rating.toFixed(1)}</span>
            <Star className="h-3.5 w-3.5 shrink-0 translate-y-0.5 fill-current text-amber-500" aria-hidden="true" />
            <span className="text-sm text-slate-500">
              {Number.isFinite(count) && count > 0
                ? `${count.toLocaleString("en-IN")} ratings on Google`
                : "on Google"}
            </span>
          </p>
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {rows.map((r, i) => {
              // PlaceReviewDto.Review is { author, authorPhotoUrl, rating, relativeTime, text }.
              // No id on it — Google does not give reviews a stable one — so the index is the key,
              // which is safe here because the list is replaced wholesale and never reordered.
              const author = r.author || "Google user";
              const when = r.relativeTime ?? "";
              const stars = Number(r.rating);
              return (
                <li key={`${author}-${i}`} className="py-3.5">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {/* Google's terms require the reviewer's own attribution to be shown with their
                        words — the name, and their photo where one is given. */}
                    {r.authorPhotoUrl && (
                      <img
                        src={r.authorPhotoUrl}
                        alt=""
                        loading="lazy"
                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <span className="text-sm font-medium text-slate-900">{author}</span>
                    {Number.isFinite(stars) && stars > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[12px] text-amber-600">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                        {stars}
                      </span>
                    )}
                    {when && <span className="text-[12px] text-slate-500">{when}</span>}
                  </div>
                  {r.text && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{r.text}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/*
          Google's terms require the source to be named wherever its review content is shown, and a
          link back to the listing where one is available. `attributionUrl` is the place's Google Maps
          URI, which the field mask asks for precisely so this link can exist.
        */}
        <p className="mt-3 text-[12px] text-slate-500">
          Reviews and ratings sourced from Google
          {data.attributionUrl && (
            <>
              {" · "}
              <a
                href={data.attributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-slate-700"
              >
                View on Google
              </a>
            </>
          )}
          {/* CACHE means the last good copy — worth saying, because a rating an hour stale is fine
              and a rating nobody flagged as stale is a small lie. */}
          {data.source === "CACHE" && " · showing the last available copy"}
        </p>
      </div>
    </>
  );
}

function ExternalLinkRow({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded text-sm text-slate-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
    >
      {label} <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
    </a>
  );
}

/**
 * `GUEST_HOUSE` → "Guest house".
 *
 * Derived rather than kept in a lookup map, deliberately: a map would have to be updated in lockstep
 * with the backend enum, and the failure mode when someone forgets is a blank cell — the value simply
 * vanishes from the panel with nothing to indicate it was ever there. Deriving it means a new
 * constant renders correctly, if plainly, the day it ships.
 */
function humanPropertyType(value) {
  const s = String(value ?? "").replace(/_/g, " ").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export default MarketplaceHotel;
