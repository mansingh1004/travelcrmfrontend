// src/features/marketplace/components/Gallery.jsx
//
// The on-page photo grid. ONE component for both scopes — the property's gallery and each room's —
// and that is deliberate design, not just deduplication.
//
// Because a room's Gallery is handed only that room's photos, there is no code path by which a
// hotel photo can reach a room's grid: the isolation is structural, not a rule someone has to
// remember. And the two scopes look identical because they ARE identical, so an agent never has to
// re-learn the layout halfway down the page.
//
// Nothing is truncated. A hotel with forty photos shows forty tiles; the grid grows. The "+N more"
// tile layered over the last thumbnail is the industry habit this feature is explicitly rejecting —
// it puts chrome on top of a photograph and hides the very content the owner asked to show.

import { ImageOff } from "lucide-react";
import { Photo, SectionLabel, cn } from "./marketplaceUi";

/**
 * @param {object}   props
 * @param {Array}    props.images       `HotelImageDto[]` for THIS scope only
 * @param {string}   props.title        the scope's name — alt-text fallback and the grid's a11y label
 * @param {string}   props.emptyLabel   what to say when the scope genuinely has no photos
 * @param {Function} props.onOpen       `(index) => void`, opens the viewer at that tile
 * @param {string}   [props.className]
 */
export function Gallery({ images, title, emptyLabel, onOpen, className }) {
  const list = Array.isArray(images) ? images : [];

  /*
    The designed empty state, and the reason it exists at all.

    A room with no photos must NEVER borrow one from the hotel. A lobby shot standing in for a room
    misrepresents the room to the agent's own customer, and the failure is invisible from here: the
    agent quotes it, the customer books it, and nobody ever learns the photo was a substitute. An
    honest blank is recoverable — the agent asks the platform for room photos. A plausible wrong
    photo is not.
  */
  if (list.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center", className)}>
        <ImageOff className="mx-auto mb-1.5 h-5 w-5 text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-500">{emptyLabel ?? "No photos yet."}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* The count lives in text, above the grid — never as a badge floating over a picture. */}
      <SectionLabel>
        {list.length} photo{list.length === 1 ? "" : "s"}
      </SectionLabel>

      <ul
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
        aria-label={title ? `${title} photos` : "Photos"}
      >
        {list.map((image, i) => (
          <li key={image.publicId ?? `${i}-${image.url}`}>
            <button
              type="button"
              onClick={() => onOpen?.(i)}
              aria-label={image.caption || `${title ?? "Photo"} ${i + 1} of ${list.length} — open full size`}
              className={cn(
                "block w-full overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors",
                "hover:border-slate-300 motion-reduce:transition-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-1",
              )}
            >
              {/*
                The aspect box is what keeps the page still. The API sends no intrinsic dimensions,
                so the only way to reserve the right space before the bytes land is a ratio — and a
                grid that reflows as photos arrive moves the tile out from under the cursor.
              */}
              <Photo
                src={image.url}
                alt={image.caption || `${title ?? "Hotel"} photo ${i + 1}`}
                className="aspect-[4/3] w-full"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Gallery;
