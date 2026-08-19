// src/features/marketplace/components/RoomRow.jsx
//
// One room type on the hotel page.
//
// This replaces a text-only list item, and the change is not cosmetic: a room type is the thing the
// agent actually sells, and until now the page described it in a single grey sentence while the one
// property photo sat at the top doing the persuading. The photographs of THIS room are the content
// of this row; the words are the caption.
//
// The row keeps the north-star rhythm — hairline separation, quiet type, aligned columns, no card,
// no shadow — so a page of eight room types still reads as a list rather than eight boxes.

import { BedDouble, Maximize2, Users } from "lucide-react";
import { Gallery } from "./Gallery";
import { fmtMoney } from "./marketplaceUi";

/**
 * @param {object}   props
 * @param {object}   props.room          one entry of `MarketplaceHotelDetailDto.rooms`
 * @param {Array}    [props.images]      `roomImages[room.publicId]` — THIS room's photos, or nothing
 * @param {string}   [props.currency]
 * @param {Function} props.onOpenPhoto   `(index) => void`, opens the room-scoped viewer
 */
export function RoomRow({ room, images, currency, onOpenPhoto }) {
  /*
    The facts as DISCRETE, ICONED ITEMS rather than one grey "Sleeps 2 · King · 24 sqm" run-on.

    An agent reads this row to answer one question — does this room fit my party — and a joined
    sentence makes them parse to find the number. Separate items with a glyph each are scannable down
    a column of eight rooms, which is how they are actually read.

    The occupancy line also finally uses maxAdults/maxChildren. Both have been on the DTO all along
    and neither was ever rendered, so a room that sleeps four as 2+2 looked identical to one that
    sleeps four adults — a difference that decides whether the booking is even possible.
  */
  const occupancy = (() => {
    const { maxOccupancy, maxAdults, maxChildren } = room;
    if (maxOccupancy == null && maxAdults == null) return null;
    const total = maxOccupancy ?? maxAdults;
    const parts = [];
    if (maxAdults != null) parts.push(`${maxAdults} adult${maxAdults === 1 ? "" : "s"}`);
    if (maxChildren) parts.push(`${maxChildren} child${maxChildren === 1 ? "" : "ren"}`);
    return parts.length > 0 && total != null
      ? `Sleeps ${total} · ${parts.join(" + ")}`
      : `Sleeps ${total}`;
  })();

  const facts = [
    occupancy && { icon: Users, text: occupancy },
    room.bedType && { icon: BedDouble, text: room.bedType },
    room.size && { icon: Maximize2, text: room.size },
  ].filter(Boolean);

  return (
    <li className="border-b border-slate-100 py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* The room name is the heading of this block and now looks like one. It used to be the
              same size and weight as the facts beneath it, so a list of rooms had no scan line. */}
          <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{room.name}</h3>

          {facts.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {facts.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          )}

          {room.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{room.description}</p>
          )}
        </div>
        <IndicativePrice value={room.indicativePayablePerNight} currency={currency} />
      </div>

      {/*
        Only this room's photos are ever passed in, so the property's gallery cannot leak into a
        room's grid even by accident. When the array is empty the Gallery renders its designed empty
        state — it must not fall back to a hotel photo, because a lobby shot standing in for a room
        misleads the agent's own customer and nobody downstream ever learns it happened.
      */}
      <Gallery
        images={images}
        title={room.name}
        emptyLabel="No photos of this room type yet."
        onOpen={onOpenPhoto}
      />
    </li>
  );
}

/**
 * Indicative payable for one night of one room.
 *
 * Renders nothing at all when the catalog has no rate for the room — as opposed to the search
 * card's "On request", because here the absence sits beside rooms that DO have a price and an
 * explicit label per row would be noise. The list-level notice on the page covers it.
 *
 * Never renders 0 for a missing price: the server omits the field rather than sending zero, so the
 * check is on the field's presence, not on truthiness — a genuinely free night must still print.
 */
function IndicativePrice({ value, currency }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="block text-[17px] font-semibold tracking-[-0.01em] text-slate-900">
        {fmtMoney(value, currency || "INR")}
      </span>
      <span className="text-[12px] text-slate-500">per night</span>
    </span>
  );
}

export default RoomRow;
