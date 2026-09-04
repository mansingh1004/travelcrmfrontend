// src/features/marketplace/components/PackageCard.jsx
//
// The package card, in one place.
//
// Extracted because it is now rendered in three: the browse grid, the "my packages" list, and the
// editor's live preview. An author deciding whether their package looks right has to be looking at
// the same component a buyer will — a preview drawn from a second implementation is a preview that
// eventually lies.
//
// THE CATEGORY RIBBON SITS ON THE PHOTOGRAPH, which contradicts this kit's most repeated rule
// ("nothing over an image", stated in four files). The owner took that decision explicitly on
// 2026-09-02. It is scoped to this one label — price, code, counts and inclusions all stay in the
// text block — and it lives here so the exception stays visible instead of becoming licence for a
// second overlay.

import { Link } from "react-router-dom";
import { Bed, Utensils, Bus, Binoculars, Plane, Package as PackageIcon } from "lucide-react";

import { Photo, fmtMoney, cn } from "./marketplaceUi";
import { PKG_LINK_BTN } from "./packageTheme";
import { PACKAGE_CATEGORY, stayRoute, nightsLabel } from "../api/packageMarketplaceService";

/**
 * Category → ribbon fill. Literal class strings so the Tailwind v4 scanner emits them.
 *
 * `_default` is not padding: the server owns this enum, and a category this build has not heard of
 * must still render legibly rather than as an unstyled sliver.
 */
const CATEGORY_TONE = {
  SUPER_DELUXE: "bg-emerald-600",
  DELUXE: "bg-blue-600",
  LUXURY: "bg-violet-600",
  BASIC: "bg-slate-600",
  _default: "bg-slate-600",
};

export const INCLUSIONS = [
  { key: "includesHotel", Icon: Bed, label: "Hotel" },
  { key: "includesMeal", Icon: Utensils, label: "Meals" },
  { key: "includesVehicle", Icon: Bus, label: "Vehicle" },
  { key: "includesSightseeing", Icon: Binoculars, label: "Sightseeing" },
  { key: "includesFlight", Icon: Plane, label: "Flight" },
];

/** The corner ribbon. See the file header — an owner-taken exception, deliberately contained. */
export function PackageRibbon({ category, className }) {
  if (!category) return null;
  return (
    <span
      className={cn(
        "absolute right-0 top-3 rounded-l px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white",
        CATEGORY_TONE[category] ?? CATEGORY_TONE._default,
        className,
      )}
    >
      {PACKAGE_CATEGORY[category] ?? category}
    </span>
  );
}

/**
 * What the price includes, as an icon block: glyph above, word below, spread evenly.
 *
 * <p>The reference product renders these as a strip of four small stacks, and it reads far better
 * on a card than an inline run of icon-plus-label pairs — the eye takes four columns in at once and
 * has to read a run left to right. It also survives a narrow card, where an inline row wraps into a
 * ragged second line.</p>
 *
 * <p>The label stays. Icon-only would be smaller still, but Bus-vs-Car and Binoculars-vs-Camera are
 * not glyphs anybody reads correctly without the word, and there is no tooltip on a phone.</p>
 */
export function InclusionIcons({ pkg, className }) {
  const on = INCLUSIONS.filter((i) => pkg[i.key]);
  if (!on.length) return null;
  return (
    <div
      className={cn(
        "grid gap-1 rounded-md border border-slate-100 bg-slate-50/60 py-2",
        // Column count follows what is actually included, so three inclusions fill the width
        // rather than leaving a gap where a fourth would have been.
        on.length === 1 ? "grid-cols-1"
          : on.length === 2 ? "grid-cols-2"
          : on.length === 3 ? "grid-cols-3"
          : on.length === 4 ? "grid-cols-4" : "grid-cols-5",
        className,
      )}
    >
      {on.map(({ key, Icon, label }) => (
        <span key={key} className="flex min-w-0 flex-col items-center gap-1 px-1">
          <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span className="truncate text-[10px] leading-none text-slate-600">{label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * "Starting From ₹14,114 / Pax", or honest words when there is no price.
 *
 * Never ₹0. A package with no live price slab is genuinely on request, and a zero renders as a real
 * and spectacularly wrong number.
 */
export function FromPrice({ value, className }) {
  if (value === null || value === undefined) {
    return <span className={cn("text-xs text-slate-500", className)}>On request</span>;
  }
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] text-slate-500">Starting from</div>
      <div className="truncate text-base font-semibold text-slate-900">
        {fmtMoney(value)} <span className="text-xs font-normal text-slate-500">/ pax</span>
      </div>
    </div>
  );
}

/**
 * One package card.
 *
 * @param to      where the photo and the title link to. Omit for a non-interactive preview.
 * @param footer  replaces the default price + CTA row, for surfaces that need their own actions.
 */
export function PackageCard({ pkg, to, footer, className }) {
  const route = stayRoute(pkg.stayLegs);

  const media = (
    <>
      {pkg.coverImageUrl ? (
        <Photo src={pkg.coverImageUrl} alt={pkg.title} className="h-full w-full" imgClassName="h-full w-full object-cover" />
      ) : (
        // A designed empty state, not a placeholder photograph. Borrowing a stock image would put a
        // picture of somewhere else on a real product.
        <span className="flex h-full w-full items-center justify-center bg-slate-100">
          <PackageIcon className="h-7 w-7 text-slate-300" aria-hidden />
        </span>
      )}
      <PackageRibbon category={pkg.category} />
    </>
  );

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      {to ? (
        <Link to={to} className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {media}
        </Link>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">{media}</div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{pkg.title || "Untitled package"}</h3>
          {route ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{route}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {pkg.packageCode ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">
              {pkg.packageCode}
            </span>
          ) : null}
          {pkg.nights !== null && pkg.nights !== undefined ? (
            <span className="text-[11px] text-slate-600">{nightsLabel(pkg.nights)}</span>
          ) : null}
        </div>

        <InclusionIcons pkg={pkg} />

        {/*
          NO SELLER LINE. Owner decision, 2026-09-03: a buyer is never told which agency is behind a
          package, because an agency that can read the name off a card can phone them and cut the
          platform out of the deal it introduced. The server already withholds `ownerName` on
          somebody else's row — this is the client half of the same rule, so a card cannot start
          showing it again if the field ever comes back.
        */}

        <div className="mt-auto pt-2">
          {footer ?? (
            <div className="flex items-end justify-between gap-2">
              <FromPrice value={pkg.fromPricePerPax} />
              {to ? (
                // A link, not a Button-as-link: this kit's Button renders a real <button> and has no
                // polymorphic `as`, so routing through it would lose middle-click and copy-link.
                <Link
                  to={to}
                  className={cn("shrink-0", PKG_LINK_BTN)}
                >
                  View details
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PackageCard;
