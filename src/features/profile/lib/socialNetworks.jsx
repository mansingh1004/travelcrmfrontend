// src/features/profile/lib/socialNetworks.jsx
//
// The company's social presence: which networks it can be reached on, how to draw each one, and
// how to turn whatever an agent types into a link that actually opens.
//
// ── Why the icons are inline SVG ──────────────────────────────────────────────────────────────
// lucide-react dropped every brand glyph at v1 (this project is on 1.17), so `Facebook`,
// `Instagram`, `Linkedin`, `Youtube` and `Twitter` no longer exist as imports — the page would fail
// to resolve them. These are lucide's own retired paths, kept at the same 24x24 viewBox, stroke
// width 2 and round caps as every other icon on the page, so they sit in the same visual family
// rather than reading as pasted-in logos. Adding a brand-icon dependency for six marks would be a
// heavier answer to a smaller question.

/* Turn a typed value into an openable URL.
   Agents type what they know — "nepaltours", "@nepaltours", "facebook.com/nepaltours" or the full
   https:// address — and all four mean the same page. Storing them as typed pushes that problem
   onto every consumer (the profile, a quotation web view, a PDF footer), each of which would have
   to guess again. Normalising once, here, means the stored value is always a link. */
const normaliseHandle = (raw, base) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  // A bare domain ("facebook.com/x", "fb.me/x") is a URL missing only its scheme.
  if (/^[\w-]+(\.[\w-]+)+\//.test(value)) return `https://${value}`;
  return `${base}${value.replace(/^@/, "")}`;
};

/* WhatsApp is a PHONE NUMBER, not a handle, and wa.me wants it bare: no +, no spaces, no dashes,
   country code included. "+91 98765 43210" and "919876543210" are the same number and must produce
   the same link. A number with no country code cannot be dialled internationally, which is what
   the validator below insists on rather than silently building a link that opens to nothing. */
const normaliseWhatsapp = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
};

const svg = (children) => (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

const FacebookIcon = svg(<path d="M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />);

const InstagramIcon = svg(<>
  <rect width="20" height="20" x="2" y="2" rx="5" />
  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37" />
  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
</>);

const WhatsappIcon = svg(<>
  <path d="M3 21l1.9-5.6A8.4 8.4 0 1 1 8.6 19z" />
  <path d="M9 10c.4 2 1.9 3.6 4 4l.9-1.2 2.1.7v1.9c-3.6.3-7-3-7.3-6.6z" />
</>);

const YoutubeIcon = svg(<>
  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
  <path d="m10 15 5-3-5-3z" />
</>);

const LinkedinIcon = svg(<>
  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
  <rect width="4" height="12" x="2" y="9" />
  <circle cx="4" cy="4" r="2" />
</>);

const XIcon = svg(<path d="M3 3h3.5l6 8 5.5-8H21l-7.3 10.2L21.5 21H18l-6.3-8.4L5.9 21H3.4l7.8-10.6z" />);

/* One row per network, and the ORDER is the order they render in — the two an Indian travel agency
   is actually contacted on first, then the rest. `field` is the key on the company record, so
   adding a network is a row here plus a backend column, not a change to the form. */
export const SOCIAL_NETWORKS = [
  {
    key: "whatsapp",
    field: "whatsappNumber",
    label: "WhatsApp",
    Icon: WhatsappIcon,
    tone: "text-[#25D366]",
    placeholder: "+91 98765 43210",
    hint: "Include the country code",
    normalise: normaliseWhatsapp,
    /* Country code plus a national number: 8–15 digits, matching E.164 and the backend's own
       phone pattern. Anything shorter cannot be dialled from outside the country and would build a
       wa.me link that opens to nothing. */
    validate: (value) => {
      const digits = String(value || "").replace(/[^\d]/g, "");
      if (/^https?:\/\//i.test(String(value || "").trim())) return "";
      return /^\d{8,15}$/.test(digits) ? "" : "Enter the number with its country code";
    },
  },
  {
    key: "instagram",
    field: "instagramUrl",
    label: "Instagram",
    Icon: InstagramIcon,
    tone: "text-[#E1306C]",
    placeholder: "yourpage  or  instagram.com/yourpage",
    normalise: (v) => normaliseHandle(v, "https://instagram.com/"),
  },
  {
    key: "facebook",
    field: "facebookUrl",
    label: "Facebook",
    Icon: FacebookIcon,
    tone: "text-[#1877F2]",
    placeholder: "yourpage  or  facebook.com/yourpage",
    normalise: (v) => normaliseHandle(v, "https://facebook.com/"),
  },
  {
    key: "youtube",
    field: "youtubeUrl",
    label: "YouTube",
    Icon: YoutubeIcon,
    tone: "text-[#FF0000]",
    placeholder: "@yourchannel  or  youtube.com/@yourchannel",
    normalise: (v) => normaliseHandle(v, "https://youtube.com/@"),
  },
  {
    key: "linkedin",
    field: "linkedinUrl",
    label: "LinkedIn",
    Icon: LinkedinIcon,
    tone: "text-[#0A66C2]",
    placeholder: "company/yourcompany",
    normalise: (v) => normaliseHandle(v, "https://linkedin.com/"),
  },
  {
    key: "twitter",
    field: "twitterUrl",
    label: "X (Twitter)",
    Icon: XIcon,
    tone: "text-slate-900",
    placeholder: "@yourhandle",
    normalise: (v) => normaliseHandle(v, "https://x.com/"),
  },
];

/** Blank values for every social field — spread into the company record so the keys always exist. */
export const EMPTY_SOCIAL = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.field, ""]));

/**
 * The networks this company has actually filled in, ready to render as links.
 *
 * Returns `[{ ...network, url, display }]`. Empty fields are dropped rather than rendered as "—":
 * a profile listing four blank social rows says less than one listing the two that exist.
 */
export const connectedSocials = (company = {}) =>
  SOCIAL_NETWORKS
    .map((network) => {
      const url = network.normalise(company[network.field]);
      return url ? { ...network, url, display: url.replace(/^https?:\/\/(www\.)?/i, "") } : null;
    })
    .filter(Boolean);
