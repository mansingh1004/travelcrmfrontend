import { Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";

import { WhatsAppIcon } from "@shared/ui/WhatsAppIcon";

import {
  Badge, FOCUS_RING, STATUS_DOT, STATUS_STYLE, TIER_STYLE, TYPE_STYLE,
  initials, keyOf, titleCase,
} from "./profileUi";

/**
 * Who this is, and every way to act on them — in one band.
 *
 * This replaces a 186px dark-gradient hero. The gradient carried no data: it cost more vertical
 * space than the money strip below it and pushed the first row of actual content past the fold on
 * a 900px laptop. Everything it showed is still here — name, code, legal name, three badges, the
 * three contact channels, phone, location, channel preference and the owning agent — in roughly
 * half the height, because this is an operational screen and density is the point.
 *
 * Structure is two rows:
 *   1. Identity + actions. STICKY, so Call and WhatsApp stay reachable while the operator scrolls
 *      a 40-row booking table. (`sticky top-0` is safe here: Layout's <main> is the scroll
 *      container and the app Navbar sits outside it, so this pins below the Navbar, not under it.)
 *   2. The contact facts, which scroll away — they are reference, not action.
 *
 * The page-level actions (New booking, Edit, the overflow menu) come in as `children` because they
 * own state and refs that belong to the page. The three CONTACT actions are rendered here: they are
 * plain `<a href>` links with no state, and they are the reason the band exists.
 */

export function CommandBar({ summary, onBack, children }) {
  const typeKey = keyOf(summary.type) || "INDIVIDUAL";
  const tierKey = keyOf(summary.tier) || "BRONZE";
  const statusKey = keyOf(summary.status) || "INACTIVE";
  const phoneDigits = String(summary.phone || "").replace(/\D/g, "");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to customers"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 ${FOCUS_RING}`}
          >
            <BackGlyph />
          </button>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
            {initials(summary.name)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Customers / {summary.customerId}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {/* Capped rather than truncated to a single line: a 60-character company name is a
                  real record, and clipping it to "Shree Ganesh Tours &…" helps nobody. */}
              <h1 className="max-w-[26ch] truncate text-base font-extrabold text-slate-900 sm:max-w-none sm:text-lg"
                title={summary.name}>
                {summary.name}
              </h1>
              <Badge className={TYPE_STYLE[typeKey] || TYPE_STYLE.INDIVIDUAL}>{titleCase(typeKey)}</Badge>
              <Badge className={TIER_STYLE[tierKey] || TIER_STYLE.BRONZE}>{titleCase(tierKey)}</Badge>
              <Badge className={STATUS_STYLE[statusKey] || STATUS_STYLE.INACTIVE} dotClass={STATUS_DOT[statusKey]}>
                {titleCase(statusKey)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The operator's three. Icon-only below sm so they survive a phone without wrapping. */}
          {summary.phone && (
            <ContactAction href={`tel:${summary.phone}`} label="Call"
              tone="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Phone className="h-4 w-4" />
            </ContactAction>
          )}
          {phoneDigits && (
            <ContactAction href={`https://wa.me/${phoneDigits}`} label="WhatsApp" external
              tone="bg-emerald-600 text-white hover:bg-emerald-700">
              <WhatsAppIcon className="h-4 w-4" />
            </ContactAction>
          )}
          {summary.email && (
            <ContactAction href={`mailto:${summary.email}`} label="Email"
              tone="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Mail className="h-4 w-4" />
            </ContactAction>
          )}

          <span aria-hidden className="hidden h-6 w-px bg-slate-200 sm:block" />

          {children}
        </div>
      </div>
    </header>
  );
}

function ContactAction({ href, label, tone, external, children }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      aria-label={label}
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold sm:px-3.5 ${tone} ${FOCUS_RING}`}
    >
      {children}
      <span className="hidden lg:inline">{label}</span>
    </a>
  );
}

/** Inline back chevron — one glyph is not worth another lucide import in this file. */
function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * The reference facts — read, not acted on.
 *
 * One flowing row rather than a card grid. Each is worth a line of text and nothing more; giving
 * "Preferred channel: WhatsApp" its own bordered box was four times the pixels for the same word.
 */
export function IdentityFacts({ summary }) {
  const location = [summary.city, summary.state, summary.country].filter(Boolean).join(", ");

  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
      <Fact icon={Phone} value={summary.phone} fallback="Phone not added" />
      <Fact icon={Mail} value={summary.email} fallback="Email not added" />
      <Fact icon={MapPin} value={location} fallback="Location not added" />
      <Fact icon={MessageCircle} value={summary.commPref && titleCase(summary.commPref)} fallback="No channel preference" />
      {/* ownerUserId has always driven row-level scoping but appeared on no response until the
          summary endpoint — a record only one sub-agent could see showed no owner anywhere. */}
      <Fact icon={UserRound} value={summary.ownerUserName} fallback="Unassigned" />
      {summary.legalName && summary.legalName !== summary.name && (
        <span className="text-slate-500">Legally {summary.legalName}</span>
      )}
    </section>
  );
}

function Fact({ icon: Icon, value, fallback }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <span className={`truncate ${value ? "font-semibold text-slate-700" : "text-slate-500"}`}>
        {value || fallback}
      </span>
    </span>
  );
}
