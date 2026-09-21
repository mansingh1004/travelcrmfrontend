// src/features/marketplace/lib/packageReadiness.js
//
// The server's publish gate, mirrored so an author can see it before they hit it.
//
// `PackageMutationSupport.assertPublishable` refuses a package that has no nights, no stay legs, no
// active price slab, or stay legs that do not add up to the declared nights. Until now the only way
// to learn any of that was to press Publish and read a 409 — which is a bad way to find out that
// four separate things are missing, one per attempt.
//
// THIS IS A MIRROR, NOT THE RULE. The server remains the authority; if the two ever disagree the
// server wins and the author sees its message. Keeping the copy honest is the price of the warning
// being useful, so each check below names the server rule it reflects.

/** @returns {{key, label, ok, hint, blocking}[]} — blocking items are the ones Publish enforces. */
export function packageReadiness(pkg) {
  const nights = pkg?.nights;
  const legs = pkg?.stayLegs ?? [];
  const days = pkg?.itinerary ?? [];
  const slabs = pkg?.priceSlabs ?? [];
  const images = pkg?.images ?? [];

  const legNights = legs.reduce((sum, l) => sum + (Number(l.nights) || 0), 0);
  const hasNights = nights !== null && nights !== undefined;

  return [
    {
      key: "nights",
      label: "Duration set",
      // Server: `problems.add("nights is not set")`.
      ok: hasNights,
      hint: "How many nights the package runs for.",
      blocking: true,
    },
    {
      key: "legs",
      label: "Stay plan added",
      // Server: `problems.add("there are no stay legs, so the route line would be empty")`.
      ok: legs.length > 0,
      hint: "The stops buyers see on the card.",
      blocking: true,
    },
    {
      key: "legsMatch",
      label: "Nights add up",
      // Server: legs summing to N against a package declaring M.
      ok: !hasNights || legs.length === 0 || legNights === nights,
      hint: hasNights && legs.length > 0 && legNights !== nights
        ? `Stops total ${legNights} nights, package says ${nights}.`
        : "Stop nights must total the package nights.",
      blocking: true,
    },
    {
      key: "rates",
      label: "At least one rate",
      // Server: `problems.add("there is no active price slab, so the card would have no price")`.
      ok: slabs.length > 0,
      hint: "Without one the card reads “On request”.",
      blocking: true,
    },
    // Below here the server does not care, but a buyer does. Kept visually distinct so nobody
    // mistakes a suggestion for a rule and goes hunting for why Publish is refused.
    {
      key: "photo",
      label: "Cover photo",
      ok: images.length > 0 || !!pkg?.coverImageUrl,
      hint: "A package with no photo is the one nobody clicks.",
      blocking: false,
    },
    {
      key: "days",
      label: "Day-wise plan",
      ok: days.length > 0,
      hint: "What happens on each day.",
      blocking: false,
    },
  ];
}

/** True when everything the server enforces is satisfied. */
export function canPublish(pkg) {
  return packageReadiness(pkg).every((c) => !c.blocking || c.ok);
}

/** How many blocking items are still outstanding — for a one-line summary. */
export function blockingCount(pkg) {
  return packageReadiness(pkg).filter((c) => c.blocking && !c.ok).length;
}
