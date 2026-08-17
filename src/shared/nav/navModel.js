// src/shared/nav/navModel.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers over a NAV REGISTRY. No React, no DOM, no styling — so the tenant
// app and the platform console can share one behaviour and keep two visual
// languages (see console/theme/tokens.css).
//
// A registry is an array of SECTIONS:
//
//   { id, label, items: [ item, … ] }
//
// and an item is:
//
//   {
//     id,                  // stable — pins + recents are stored by this
//     label,
//     path,                // optional for a pure group; a group with a path is
//                          // clickable AND expandable
//     Icon,                // lucide component
//     tone,                // optional accent key for the icon
//     can,                 // () => boolean — permission / module / role gate
//     alt: ['/EditLead'],  // extra path prefixes that still count as "here"
//     keywords: 'enquiry', // extra search terms
//     children: [ item ],  // one level only, deliberately
//     badge: 'key',        // caller-resolved live count
//   }
//
// `can` is evaluated at RESOLVE time, never cached across renders — the gates read
// localStorage, which the entitlement refresh rewrites while the app is running.
// ─────────────────────────────────────────────────────────────────────────────

const ok = (item) => {
  try {
    return typeof item.can === "function" ? !!item.can() : true;
  } catch {
    // A throwing gate must not blank the whole menu — hide just that item.
    return false;
  }
};

/**
 * Filter a registry down to what THIS user may see, dropping:
 *  - items whose own `can` is false
 *  - group items left with no reachable child and no path of their own
 *  - sections left with no items
 * Returns a new array; the registry itself is never mutated.
 */
export function resolveSections(sections) {
  const out = [];
  for (const section of sections) {
    if (section.can && !ok(section)) continue;
    const items = [];
    for (const item of section.items || []) {
      if (!ok(item)) continue;
      const children = (item.children || []).filter(ok);
      // A group whose children are all gated away, and which has no destination of
      // its own, is a dead row — drop it rather than render a menu that does nothing.
      if (!item.path && !children.length) continue;
      items.push({ ...item, children, sectionId: section.id, sectionLabel: section.label });
    }
    if (items.length) out.push({ ...section, items });
  }
  return out;
}

/**
 * Every reachable DESTINATION as a flat list — the search index behind the command
 * palette and the app launcher. A group that has its own `path` appears once as
 * itself, and its children appear as their own entries.
 */
export function flattenDestinations(sections) {
  const out = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.path) {
        out.push({
          id: item.id,
          label: item.label,
          path: item.path,
          Icon: item.Icon,
          tone: item.tone,
          alt: item.alt,
          exact: item.exact,
          primary: item.primary,
          badge: item.badge,
          keywords: item.keywords,
          sectionId: section.id,
          sectionLabel: section.label,
          parentId: null,
          parentLabel: null,
        });
      }
      for (const child of item.children || []) {
        if (!child.path) continue;
        out.push({
          id: child.id,
          label: child.label,
          path: child.path,
          Icon: child.Icon || item.Icon,
          tone: child.tone || item.tone,
          alt: child.alt,
          exact: child.exact,
          primary: child.primary,
          badge: child.badge,
          keywords: child.keywords,
          sectionId: section.id,
          sectionLabel: section.label,
          // The owning group's ID, not just its label. The sidebar re-groups pinned leaves back
          // under their parent, and it keys that group on this id so the rail's one-open-at-a-time
          // accordion — which is seeded from `activeTrail.itemId`, itself an item id — opens the
          // pinned group automatically when the route lands inside it. Keyed on the label instead,
          // navigating to a child would seed the accordion with an id nothing matches and the
          // group the user is standing in would collapse.
          parentId: item.id,
          parentLabel: item.label,
        });
      }
    }
  }
  return out;
}

/**
 * Every GROUP as a pinnable entry — a module the user can put on the rail whole,
 * instead of pinning its pages one at a time.
 *
 * <p>Deliberately NOT folded into {@link flattenDestinations}. That list is the
 * search index and the active-route matcher, and both are about single pages: a
 * group is not somewhere you can be, it is a heading over places you can be.
 * Mixing the two would put "Platform Hotels" in the command palette next to the
 * two pages it merely contains.
 *
 * <p>`path` is the FIRST child's, so every consumer that just navigates a pinned
 * entry keeps working unchanged — the mobile tab bar in particular renders pins
 * as plain links and would otherwise get a tab that goes nowhere. `children`
 * carries the resolved leaves so the sidebar can expand the group without
 * re-walking the registry.
 *
 * <p>Only groups with at least TWO children: a "group" of one is the page itself
 * wearing a disclosure triangle.
 */
export function flattenGroups(sections) {
  const out = [];
  for (const section of sections) {
    for (const item of section.items) {
      const children = (item.children || []).filter((c) => c.path);
      if (children.length < 2) continue;
      out.push({
        kind: "group",
        id: item.id,
        label: item.label,
        Icon: item.Icon,
        tone: item.tone,
        keywords: item.keywords,
        sectionId: section.id,
        sectionLabel: section.label,
        path: children[0].path,
        children: children.map((child) => ({
          id: child.id,
          label: child.label,
          path: child.path,
          badge: child.badge,
          exact: child.exact,
        })),
      });
    }
  }
  return out;
}

/** Look a destination up by its stable id (pins/recents store ids, not paths). */
export function destinationById(destinations, id) {
  return destinations.find((d) => d.id === id) || null;
}

// ── Active-route matching ────────────────────────────────────────────────────
// Routes in this app are mixed-case (`/Allbookings`, `/AllCustomers`) while a
// pasted or typed URL may not be, so every comparison is lowercased.

const norm = (p) => (p || "").toLowerCase().replace(/\/+$/, "") || "/";

/** True when `pathname` is `base` or sits underneath it. */
export function isUnder(pathname, base) {
  const a = norm(pathname);
  const b = norm(base);
  if (b === "/") return a === "/";
  return a === b || a.startsWith(`${b}/`);
}

/**
 * How specifically `pathname` matches this destination — longer wins, 0 = no match.
 *
 * `exact: true` opts a destination out of subtree matching. Needed for index
 * routes: `/console` is the parent of every console page, so without this the
 * console dashboard would stay lit on all sixteen of them.
 */
function matchStrength(pathname, dest) {
  const candidates = [dest.path, ...(dest.alt || [])];
  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    const hit = dest.exact ? norm(pathname) === norm(c) : isUnder(pathname, c);
    if (hit) best = Math.max(best, norm(c).length);
  }
  return best;
}

/**
 * The destination the current URL belongs to. Chooses the LONGEST match, so
 * `/marketplace/bookings` beats `/marketplace` and `/fleet/vehicles` beats `/fleet`
 * regardless of registry order.
 */
export function findActiveDestination(destinations, pathname) {
  let winner = null;
  let strength = 0;
  for (const d of destinations) {
    const s = matchStrength(pathname, d);
    if (s > strength) {
      strength = s;
      winner = d;
    }
  }
  return winner;
}

/**
 * `{ sectionId, itemId, childId }` for the current URL — drives which section is
 * open, which row is highlighted and the breadcrumb.
 */
export function findActiveTrail(sections, pathname) {
  let trail = { sectionId: null, itemId: null, childId: null };
  let strength = 0;

  const consider = (s, sectionId, itemId, childId) => {
    if (s > strength) {
      strength = s;
      trail = { sectionId, itemId, childId };
    }
  };

  for (const section of sections) {
    for (const item of section.items) {
      if (item.path) consider(matchStrength(pathname, item), section.id, item.id, null);
      for (const child of item.children || []) {
        if (child.path) consider(matchStrength(pathname, child), section.id, item.id, child.id);
      }
    }
  }
  return trail;
}

/**
 * The ANCESTORS of the current page — `[{label, href}]` — or `null` for a
 * top-level page.
 *
 * Deliberately NOT "Section / Group / Page":
 *  • The section ("Sales", "Operations") is an organising device for the app
 *    launcher's headings. It is not a place — there is no Sales screen and no
 *    Sales row in the rail — so putting it in a breadcrumb promises a level of
 *    navigation that does not exist.
 *  • The page itself is already rendered as the header title, so repeating it as
 *    the last crumb is noise.
 *
 * What is left is the one thing a breadcrumb is for here: which module this page
 * belongs to. `href` is undefined for a pure group (a group with no landing page
 * of its own), and the renderer draws those as plain text rather than a dead link.
 */
export function buildBreadcrumb(sections, pathname) {
  const { sectionId, itemId, childId } = findActiveTrail(sections, pathname);
  if (!itemId || !childId) return null;
  const section = sections.find((s) => s.id === sectionId);
  const item = section?.items.find((i) => i.id === itemId);
  if (!item) return null;
  return [{ label: item.label, href: item.path }];
}

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * Subsequence match with position bonuses. Returns a score (higher = better) or
 * `null` when the query's characters don't appear in order.
 *
 * Ranking intent, best → worst: exact label, label prefix, word-start run
 * ("bk" → "BooKings" no; "bo" → "BOokings" yes), scattered subsequence.
 */
export function fuzzyScore(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase().trim();
  const t = (text || "").toLowerCase();
  if (!t) return null;

  if (t === q) return 1000;
  const at = t.indexOf(q);
  if (at === 0) return 900 - t.length;
  if (at > 0) {
    // Matching at a word boundary reads as intentional; mid-word is weaker.
    const boundary = /[\s/&·-]/.test(t[at - 1]);
    return (boundary ? 700 : 500) - at - t.length * 0.1;
  }

  let score = 200;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    if (found === ti && ti > 0) {
      streak += 1;
      score += 8 + streak * 2;
    } else {
      streak = 0;
      score -= Math.min(found - ti, 12);
    }
    // A hit at the start of a word is worth more than one buried inside it.
    if (found === 0 || /[\s/&·-]/.test(t[found - 1])) score += 12;
    ti = found + 1;
  }
  return score - t.length * 0.2;
}

/**
 * Rank destinations against a query. Matches the label first, then
 * "Parent · Label", then the section name and any extra keywords — each fallback
 * scoring lower, so a label hit always outranks a keyword hit.
 */
export function searchDestinations(destinations, query, limit = 20) {
  const q = (query || "").trim();
  if (!q) return [];
  const scored = [];
  for (const d of destinations) {
    const label = fuzzyScore(q, d.label);
    const parent = d.parentLabel ? fuzzyScore(q, `${d.parentLabel} ${d.label}`) : null;
    const section = fuzzyScore(q, d.sectionLabel);
    const keywords = d.keywords ? fuzzyScore(q, d.keywords) : null;
    const best = Math.max(
      label ?? -Infinity,
      (parent ?? -Infinity) - 40,
      (section ?? -Infinity) - 120,
      (keywords ?? -Infinity) - 60,
    );
    if (best > -Infinity) scored.push({ ...d, score: best });
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return scored.slice(0, limit);
}

/**
 * Narrow a resolved registry to the sections/items/children matching `query`.
 * A parent that matches keeps ALL its children (you searched for the group, you
 * want the group); a parent that doesn't keeps only its matching children.
 */
export function filterSections(sections, query) {
  const q = (query || "").trim();
  if (!q) return sections;
  const out = [];
  for (const section of sections) {
    const items = [];
    for (const item of section.items) {
      const own =
        fuzzyScore(q, item.label) ?? (item.keywords ? fuzzyScore(q, item.keywords) : null);
      const children = (item.children || []).filter(
        (c) => fuzzyScore(q, c.label) !== null || (c.keywords && fuzzyScore(q, c.keywords) !== null),
      );
      if (own !== null) items.push(item);
      else if (children.length) items.push({ ...item, children });
    }
    if (items.length) out.push({ ...section, items });
  }
  return out;
}
