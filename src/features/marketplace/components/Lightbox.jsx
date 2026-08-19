// src/features/marketplace/components/Lightbox.jsx
//
// The full-screen photo viewer for the platform hotel catalog.
//
// The north star is minimal chrome, and here that is not an aesthetic preference — it is the whole
// job. An agent opens this to decide whether a property is right for their customer, so nothing may
// sit on top of the photograph: no gradient scrim, no "+N" tile, no floating badge, no urgency
// copy. Everything the viewer needs to say is said in the header, the counter and the strip, all
// outside the image.
//
// The one thing it MUST be loud about is scope. A room gallery and the property gallery look
// identical once you are two arrow presses in, and an agent who mistakes a lobby shot for the room
// they are selling only finds out when their own customer checks in. So the scope name is in the
// header at all times, and when the property viewer walks into a room's run of photos the room name
// replaces it.

import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { Modal, Photo, cn, useHotkeys } from "./marketplaceUi";

/**
 * Flatten `[{ label, images }]` into the one indexed list the viewer pages through.
 *
 * Exported because the CALLER has to compute an index into exactly this list to open at the right
 * photo, and the viewer uses the same function internally — two independent flattenings would
 * eventually disagree by one and open the wrong picture, which is the single most confusing bug a
 * gallery can have.
 */
export function flattenGroups(groups) {
  const out = [];
  for (const g of groups ?? []) {
    const images = g?.images ?? [];
    images.forEach((image, i) => {
      out.push({ ...image, groupLabel: g.label, groupStart: i === 0 });
    });
  }
  return out;
}

/** `POOL` → `Pool`, `WELLNESS` → `Wellness`. The API sends the raw enum name. */
function humanCategory(value) {
  if (!value) return "";
  return String(value).toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Category chips are a shortcut, not a filter.
 *
 * Filtering would fork the index space — the caller holds `index`, and a chip that hid photos would
 * make every index it receives back mean something different from the index it sent in. Jumping to
 * the first photo of a category keeps one flat list and can never desync.
 *
 * They only appear when they can carry weight: at least two categories with at least two photos
 * each, over a scope big enough to be worth navigating. A chip row where every chip hides one photo
 * is chrome pretending to be navigation.
 */
const CHIPS_MIN_IMAGES = 6;

function useCategoryChips(list) {
  return useMemo(() => {
    if (list.length < CHIPS_MIN_IMAGES) return [];
    const firstIndex = new Map();
    const counts = new Map();
    list.forEach((image, i) => {
      const key = image.category || "GENERAL";
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!firstIndex.has(key)) firstIndex.set(key, i);
    });
    const chips = [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([key, count]) => ({ key, count, index: firstIndex.get(key), label: humanCategory(key) }))
      .sort((a, b) => a.index - b.index);
    return chips.length >= 2 ? chips : [];
  }, [list]);
}

/**
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onClose
 * @param {Array}    [props.images]        flat `HotelImageDto[]`; ignored when `groups` is given
 * @param {number}   props.index           index into the flat list — the caller owns it
 * @param {Function} props.onIndexChange
 * @param {string}   props.title           the SCOPE: a room's name, or the hotel's
 * @param {Array}    [props.groups]        `[{ label, images }]`; the viewer flattens it itself
 */
export function Lightbox({ open, onClose, images, index, onIndexChange, title, groups }) {
  /**
   * A STABLE `onClose` for the Modal, and it is not a micro-optimisation.
   *
   * Modal's setup effect keys on `[open, onClose]`, and its cleanup restores body scroll and pushes
   * focus back to the opener. Callers write `onClose={() => setViewer(null)}`, so the identity
   * changes on every render — and here every arrow press IS a render. The effect would therefore
   * tear down and rebuild on each step, yanking focus out of the viewer and onto the close button,
   * where the next Enter would shut the whole thing. Routing through a ref pins the identity for the
   * lifetime of the component and leaves Modal's own contract untouched.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const close = useCallback(() => onCloseRef.current?.(), []);

  const list = useMemo(
    () => (groups?.length ? flattenGroups(groups) : (images ?? [])),
    [groups, images],
  );
  const total = list.length;

  // Clamp rather than trust: the caller may re-fetch and shrink the list while the viewer is open,
  // and an out-of-range index would render a blank stage with a counter that reads "9 / 4".
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(index ?? 0, 0), total - 1);
  const current = list[safeIndex];
  const chips = useCategoryChips(list);

  const step = (delta) => {
    if (total < 2) return;
    onIndexChange((safeIndex + delta + total) % total);
  };

  // Bare arrows, which is why `useHotkeys` learned them. Escape is already handled by Modal on the
  // capture phase, so it is deliberately NOT registered here — two handlers would fight over which
  // overlay a nested Escape belongs to.
  useHotkeys(
    { left: () => step(-1), right: () => step(1) },
    { enabled: open && total > 1 },
  );

  // Decode the neighbours while the current one is on screen, so an arrow press paints immediately
  // instead of flashing an empty stage on a hotel whose photos are 2 MB each.
  useEffect(() => {
    if (!open || total < 2) return;
    for (const offset of [1, -1]) {
      const next = list[(safeIndex + offset + total) % total];
      if (!next?.url) continue;
      const img = new Image();
      img.src = next.url;
    }
  }, [open, safeIndex, total, list]);

  if (!open || total === 0) return null;

  // The room name wins over the hotel name whenever the property viewer walks into a room's run —
  // otherwise the header keeps claiming "The Leela" while a bathroom is on screen.
  const scope = current?.groupLabel || title || "Photos";
  const navBtn =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full " +
    "bg-white/10 text-white transition-colors hover:bg-white/20 motion-reduce:transition-none " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-slate-950";

  return (
    <Modal open={open} onClose={close} surface="dark" title={scope}>
      <div className="flex h-full min-h-0 flex-col">
        {/* ── header: scope, counter, close ───────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{scope}</p>
            {current?.groupLabel && title && current.groupLabel !== title && (
              <p className="truncate text-[12px] text-white/45">{title}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* `role="status"` is what makes the aria-label reach assistive tech at all — a bare
                span carrying only a label is not exposed, so "3 / 12" would be read as "three
                twelve" or skipped entirely. */}
            <span
              role="status"
              aria-live="polite"
              aria-label={`Photo ${safeIndex + 1} of ${total}`}
              className="text-sm tabular-nums text-white/60"
            >
              {safeIndex + 1} / {total}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close photos"
              className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2 sm:px-6">
            {chips.map((chip) => {
              const active = (current?.category || "GENERAL") === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onIndexChange(chip.index)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[12px] transition-colors motion-reduce:transition-none",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    active
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
                  )}
                >
                  {chip.label}
                  <span className="ml-1 tabular-nums text-current opacity-60">{chip.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── stage ───────────────────────────────────────────────────────── */}
        {/*
          Clicking the empty space beside a photo closes, the way the console viewer does — but only
          when the click landed on the padding itself. Testing the target rather than stopping
          propagation on the image keeps the arrows and chips clickable without each of them having
          to remember to swallow their own event.
        */}
        <div className="relative min-h-0 flex-1">
          {total > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={cn(navBtn, "left-2 sm:left-4")}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className={cn(navBtn, "right-2 sm:right-4")}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/*
            An absolutely-positioned layer rather than a flex child: `object-contain` letterboxes
            inside a box, so the box needs a definite height, and `inset-0` gives it one no matter
            how tall the header, the chips row and the strip happen to be. The arrows sit above this
            layer on `z-10`, so they stay clickable through it.
          */}
          <div
            className="absolute inset-0 flex items-center justify-center p-4 sm:px-16"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <Photo
              key={current?.url ?? safeIndex}
              src={current?.url}
              alt={current?.caption || `${scope} photo ${safeIndex + 1}`}
              fit="contain"
              loading="eager"
              className="h-full w-full bg-transparent"
              fallback={<span className="text-sm text-white/60">Image failed to load</span>}
            />
          </div>
        </div>

        {current?.caption && (
          <p className="shrink-0 px-4 pb-2 text-center text-sm text-white/70 sm:px-6">{current.caption}</p>
        )}

        {/* ── strip: every photo, nothing hidden behind a "+N" ─────────────── */}
        {total > 1 && (
          <div className="shrink-0 border-t border-white/10">
            <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
              {list.map((image, i) => (
                <Fragment key={image.publicId ?? `${i}-${image.url}`}>
                  {image.groupStart && (
                    <span className="shrink-0 whitespace-nowrap px-1 text-[12px] text-white/40">
                      {image.groupLabel}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onIndexChange(i)}
                    aria-label={`Show photo ${i + 1}${image.groupLabel ? ` — ${image.groupLabel}` : ""}`}
                    aria-current={i === safeIndex ? "true" : undefined}
                    className={cn(
                      "shrink-0 overflow-hidden rounded-md transition-opacity motion-reduce:transition-none",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      i === safeIndex ? "ring-2 ring-white" : "opacity-55 ring-1 ring-white/15 hover:opacity-100",
                    )}
                  >
                    <Photo
                      src={image.url}
                      alt=""
                      className="h-14 w-20 bg-white/5"
                      fallback={<ImageOff className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />}
                    />
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default Lightbox;
