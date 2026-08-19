// src/features/profile/lib/businessListings.jsx
//
// Business directory listings — the places customers FIND this agency, as opposed to the social
// accounts where they follow it.
//
// ═══ WHY THIS IS A LIST AND NOT MORE COLUMNS ═══════════════════════════════════════════════════
// Justdial started life as a seventh row in socialNetworks.jsx: one field, one column,
// `justdialUrl`. That model is wrong for directories for a reason that shows up the first time an
// agency opens a second branch — Gorakhpur, Lucknow and Delhi each get their OWN Justdial page,
// with its own reviews and its own enquiries. One column cannot hold three.
//
// The alternative that suggests itself, justdialUrl / justdialUrl2 / justdialUrl3, caps the count
// arbitrarily and forces every consumer to know what the cap is. So listings are a repeatable list
// instead, and the platform is a field ON the row rather than the identity of the column.
//
// That generalises for free: TripAdvisor, MakeMyTrip and IndiaMART are all real lead sources for an
// Indian travel agency, and none of them costs a schema change now. Adding one is a row in
// LISTING_PLATFORMS below.
//
// Social accounts stay one-per-company in socialNetworks.jsx and are NOT affected — a company has
// one Instagram, however many branches it runs.

/* Listing URLs are opaque and cannot be built from a handle.
   A Justdial address is city, business name and an id all at once:
     https://www.justdial.com/Gorakhpur/Nepal-Tours-And-Travels/9999PX551-X551-...-BZDET
   Nothing there is derivable from a business name, so unlike the social networks there is no
   `base + handle` form to fall back on. Accepts a full address or a bare domain, and leaves
   anything else untouched so the validator can reject it rather than storing a mangled link. */
export const normaliseListingUrl = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+\//.test(value)) return `https://${value}`;
  return value;
};

export const isListingUrl = (raw) => {
  const value = String(raw || "").trim();
  return /^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+\//.test(value);
};

/* Same factory idea as socialNetworks.jsx: a bare arrow returning JSX is detected as a component,
   and a file exporting both components and data breaks Fast Refresh. */
const badge = (children) => (props) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    {children}
  </svg>
);

/* Monogram badges — the form these brands use at icon size, and the only form legible at 16px.
   Reproducing a full wordmark that small is unreadable, and tracing trademarked artwork from
   memory produces something subtly wrong, which looks worse than not trying. Swap in official
   assets here if you have them; nothing outside this file needs to move. */
const monogram = (text, size = 10.5) => badge(<>
  <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
  <text
    x="12" y={size >= 10 ? 16.3 : 15.9}
    textAnchor="middle"
    fontSize={size}
    fontWeight="800"
    letterSpacing="-0.5"
    fill="#ffffff"
    // Inherits the page face rather than naming a font that may not be loaded.
    fontFamily="inherit"
  >
    {text}
  </text>
</>);

const JustdialIcon = monogram("JD");
const GoogleIcon = monogram("G", 12);
const TripadvisorIcon = monogram("TA", 9);
const MakeMyTripIcon = monogram("MMT", 7);
const IndiamartIcon = monogram("IM", 9);

const GenericIcon = badge(<>
  <path d="M3 9.5 4.5 4h15L21 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M4.5 11.5V20h15v-8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M9.5 20v-5h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
</>);

/* The platforms offered in the row's dropdown. `id` is what gets STORED, so these strings are a
   data contract — renaming one orphans every row already saved against it. Add freely; rename
   never. "other" exists so an unlisted directory is still recordable rather than being a reason to
   come back and change code. */
export const LISTING_PLATFORMS = [
  { id: "justdial", label: "Justdial", Icon: JustdialIcon, tone: "text-[#1A6DAD]", hintUrl: "justdial.com/City/Your-Business/..." },
  { id: "google", label: "Google Business", Icon: GoogleIcon, tone: "text-[#4285F4]", hintUrl: "g.page/your-business" },
  { id: "tripadvisor", label: "TripAdvisor", Icon: TripadvisorIcon, tone: "text-[#00AA6C]", hintUrl: "tripadvisor.in/..." },
  { id: "makemytrip", label: "MakeMyTrip", Icon: MakeMyTripIcon, tone: "text-[#EB2026]", hintUrl: "makemytrip.com/..." },
  { id: "indiamart", label: "IndiaMART", Icon: IndiamartIcon, tone: "text-[#2E3192]", hintUrl: "indiamart.com/..." },
  { id: "other", label: "Other directory", Icon: GenericIcon, tone: "text-slate-500", hintUrl: "https://..." },
];

export const platformOf = (id) =>
  LISTING_PLATFORMS.find((p) => p.id === id) || LISTING_PLATFORMS[LISTING_PLATFORMS.length - 1];

/* Rows need a stable key for React across reorders and deletes, and a saved row has no id until
   the server gives it one. A client-side counter is enough: it never leaves the browser and is
   stripped before the payload goes out (see toListingsPayload). */
let seq = 0;
export const emptyListingRow = (platform = "justdial") => ({
  rowId: `l${(seq += 1)}`,
  platform,
  label: "",
  url: "",
});

/* Server rows in, client rows out. Tolerates a null/absent array — a company saved before listings
   existed has no field at all, and that must render as "none yet", not as a crash. */
export const toListingRows = (listings) =>
  (Array.isArray(listings) ? listings : []).map((row) => ({
    ...emptyListingRow(row?.platform || "other"),
    platform: row?.platform || "other",
    label: row?.label || "",
    url: row?.url || "",
  }));

/* Client rows out, server rows in.
   Drops rows with no URL — a row someone added and abandoned is not a listing, and storing it
   would put an empty entry on every consumer that renders these. rowId is stripped: it is a React
   key, not data. */
export const toListingsPayload = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.url || "").trim())
    .map((row) => ({
      platform: row.platform || "other",
      label: String(row.label || "").trim() || null,
      url: normaliseListingUrl(row.url),
    }));

/* Saved listings ready to render as links — the read-only counterpart to connectedSocials.

   The platform's fields are picked out ONE BY ONE rather than spread over the row, and that is not
   style. Both objects carry a `label`: the row's is what the user typed ("Lucknow branch") and the
   platform's is the directory name ("Justdial"). A spread would let the platform silently win, and
   every listing tile would show the same word — losing the only part of the row that distinguishes
   one branch from another. They get separate names here so neither can shadow the other. */
export const savedListings = (company = {}) =>
  toListingsPayload(toListingRows(company?.businessListings)).map((row) => {
    const platform = platformOf(row.platform);
    return {
      url: row.url,
      // What the user called it — may be null, which is why platformLabel is always sent too.
      label: row.label,
      platformLabel: platform.label,
      Icon: platform.Icon,
      tone: platform.tone,
      display: row.url.replace(/^https?:\/\/(www\.)?/i, ""),
    };
  });
