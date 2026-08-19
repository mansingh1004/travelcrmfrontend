// src/features/marketplace/components/HeroGallery.jsx
//
// The property's opening photo block — one large frame with a 2×2 run beside it, and a "Show all N
// photos" control. The shape a hotel page has had since Airbnb settled it, for a good reason: it
// gives one photograph enough size to actually be judged, while showing that there are more without
// spending a screen on them.
//
// WHY THIS IS NOT A DEPARTURE FROM THE NORTH STAR. The north star governs CHROME — hairline rules,
// no gradients, no coloured furniture, colour reserved for the exceptional. It never said photographs
// must be small. Nothing here is decoration: there is no overlay, no gradient scrim, no floating
// badge, no counter stamped on a picture. It is photographs at the size the job needs, with the same
// quiet frame every other surface in this feature uses.
//
// WHY NOT REUSE `Gallery` WITH A col-span-2 FIRST TILE. That was tried and rejected: `Gallery` sizes
// every tile with its own `aspect-[4/3]` box, and a tile spanning two rows then disagrees with the
// two tiles stacked beside it, leaving a gap that changes with the viewport. Here the RATIO LIVES ON
// THE CONTAINER and the children fill it, so the block is one rectangle at every width. `Gallery` is
// still the right component for a room's photos and for the flat grid — this is a different job.

import { Images, ImageOff } from "lucide-react";
import { Photo, cn } from "./marketplaceUi";

/** The large frame plus a 2×2 run. More than this and the tiles get too small to tell apart. */
const TILES = 5;

/**
 * @param {object}   props
 * @param {Array}    props.images   `HotelImageDto[]` for the PROPERTY scope only
 * @param {string}   props.title    the property's name — alt-text fallback and the block's a11y label
 * @param {Function} props.onOpen   `(index) => void`, opens the viewer at that photo
 * @param {number}   [props.total]  total photo count for the "show all" label; defaults to images.length
 */
export function HeroGallery({ images, title, onOpen, total, className }) {
  const list = Array.isArray(images) ? images : [];
  const count = total ?? list.length;

  /*
    No photos is a real state, not an error, and it must never be papered over with a stand-in. This
    is the property scope so a substitute would not misrepresent a room — but it would still tell the
    agent the platform holds photographs it does not hold, and they would stop asking for them.
  */
  if (list.length === 0) {
    return (
      <div className={cn(
        "flex aspect-[2/1] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200",
        className,
      )}>
        <ImageOff className="mb-1.5 h-6 w-6 text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-500">No photos of this property yet.</p>
      </div>
    );
  }

  const tiles = list.slice(0, TILES);
  const hero = tiles[0];
  const rest = tiles.slice(1);

  /*
    One photo gets the whole frame rather than a large tile beside four empty cells. Two to four fall
    back to an even grid for the same reason — a 2×2 run with holes in it reads as a loading state
    that never finished.
  */
  const single = tiles.length === 1;

  const frame =
    "relative overflow-hidden bg-slate-50 transition-colors hover:opacity-95 motion-reduce:transition-none " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 focus-visible:ring-offset-2";

  return (
    <section className={cn("relative", className)} aria-label={title ? `${title} photos` : "Photos"}>
      <div
        className={cn(
          "grid gap-1.5 overflow-hidden rounded-xl sm:gap-2",
          single ? "aspect-[16/9]" : "aspect-[3/2] grid-cols-2 sm:aspect-[2/1] sm:grid-cols-4 sm:grid-rows-2",
        )}
      >
        <button
          type="button"
          onClick={() => onOpen?.(0)}
          aria-label={hero.caption || `${title ?? "Property"} photo 1 of ${count} — open full size`}
          className={cn(frame, single ? "h-full w-full" : "col-span-2 row-span-2 h-full w-full")}
        >
          <Photo
            src={hero.url}
            alt={hero.caption || `${title ?? "Hotel"} photo 1`}
            className="h-full w-full"
          />
        </button>

        {rest.map((image, i) => (
          <button
            key={image.publicId ?? `${i}-${image.url}`}
            type="button"
            onClick={() => onOpen?.(i + 1)}
            aria-label={image.caption || `${title ?? "Property"} photo ${i + 2} of ${count} — open full size`}
            className={cn(frame, "hidden h-full w-full sm:block")}
          >
            <Photo
              src={image.url}
              alt={image.caption || `${title ?? "Hotel"} photo ${i + 2}`}
              className="h-full w-full"
            />
          </button>
        ))}
      </div>

      {/*
        The control sits BESIDE the block, not stamped across the corner of a photograph. Same
        decision as the search card's photo count: chrome laid over a picture is chrome competing
        with the only content on the screen. It also means the count is readable regardless of what
        the photo underneath happens to be.
      */}
      {count > 1 && (
        <button
          type="button"
          onClick={() => onOpen?.(0)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
        >
          <Images className="h-3.5 w-3.5" />
          Show all {count} photos
        </button>
      )}
    </section>
  );
}

export default HeroGallery;
