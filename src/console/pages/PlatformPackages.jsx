// src/console/pages/PlatformPackages.jsx
//
// The SuperAdmin's package catalog, and the two jobs it carries:
//
//   1. The platform's own packages — publish and withdraw them.
//   2. AGENCY listings — an agency asked to sell its own package to every other agency, and only
//      the platform can say yes.
//
// Both live on one screen because they are one mental model (what is in the catalog, and who may
// sell into it) and because the review queue would otherwise be a page nobody opens. The tab is in
// the URL so a link to "the queue" is a link someone can send.
//
// CARD GRID, not a table, matching the hotel and transport catalogs and the product this is modelled
// on. A package is sold on its photograph and its route; a table row shows neither, and an operator
// checking that the catalog "looks right" is doing so with their eyes.
//
// Every write goes through useStepUp — the server rejects any of these without an
// X-SuperAdmin-Mfa-Code, and errors stay inside that dialog because the operator is still standing
// at the code field.
//
// Palette: `.sa-console` semantic + hue tokens only. A raw slate-*/blue-* here resolves to the
// TENANT palette and carries no dark-mode partner (TransportCommissions.jsx:35-47 is the live
// violation not to copy).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, Check, X, Eye, EyeOff, Plus, Pencil, MapPin, Bed, Utensils, Bus, Binoculars, Plane, Link as LinkIcon } from "lucide-react";

import {
  PageShell, PageHeader, HotelStyles, SectionCard, Button, Badge,
  EmptyState, SkeletonCards, errMsg,
} from "../components/hotelUi";
import { useStepUp } from "../components/useStepUp";
import {
  platformPackageService, packageStatus, PACKAGE_CATEGORY,
} from "../api/platformPackageService";

const PAGE_SIZE = 24;

/**
 * Catalog first, queue second.
 *
 * The queue led originally and it was wrong: an empty queue is the NORMAL state — it means nobody
 * is waiting — so a SuperAdmin opening "Package Catalog" was shown "Nothing waiting" and reasonably
 * concluded the catalog was empty, with five live packages one tab away. A screen's default view
 * has to answer the question its name asks.
 *
 * The queue keeps its own count in the tab label so it is still impossible to miss when it matters.
 */
const TABS = [
  { value: "all", label: "All packages" },
  { value: "queue", label: "Review queue" },
];

/**
 * Category → ribbon fill. Literal classes so the Tailwind v4 scanner emits them.
 *
 * Only the six hue tokens that exist — there is no `hue-slate`. Text on these is `text-surface`,
 * not `text-white`: a strong hue token flips to a LIGHT tint in dark mode, where white on it is
 * unreadable. hotelUi's own solid hue buttons make the same choice for the same reason.
 */
const CATEGORY_TONE = {
  SUPER_DELUXE: "bg-hue-emerald",
  DELUXE: "bg-hue-sky",
  LUXURY: "bg-hue-violet",
  BASIC: "bg-hue-indigo",
  _default: "bg-hue-indigo",
};

const INCLUSIONS = [
  { key: "includesHotel", Icon: Bed, label: "Hotel" },
  { key: "includesMeal", Icon: Utensils, label: "Meals" },
  { key: "includesVehicle", Icon: Bus, label: "Vehicle" },
  { key: "includesSightseeing", Icon: Binoculars, label: "Sightseeing" },
  { key: "includesFlight", Icon: Plane, label: "Flight" },
];

export default function PlatformPackages() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get("tab") === "queue" ? "queue" : "all";

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [pendingCount, setPendingCount] = useState(null);
  const [error, setError] = useState("");
  const stepUp = useStepUp();

  /**
   * Copy the public submission URL.
   *
   * <p>Built from the browser's own origin rather than a configured base, because the link is only
   * ever shared from the machine looking at it and a stale env var would hand somebody a URL
   * pointing at the wrong deployment.</p>
   *
   * <p>Falls back to a prompt when the clipboard API is unavailable — it needs a secure context, and
   * a console opened over plain http would otherwise have a button that silently does nothing.</p>
   */
  const [copied, setCopied] = useState(false);
  const copySubmitLink = () => {
    const url = `${window.location.origin}/submit-package`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
        .catch(() => window.prompt("Copy this link", url));
    } else {
      window.prompt("Copy this link", url);
    }
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const res = tab === "queue"
        ? await platformPackageService.reviewQueue({ page, size: PAGE_SIZE })
        : await platformPackageService.list({ page, size: PAGE_SIZE });
      setRows(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setRows([]);
      setError(errMsg(e, "Could not load the catalog."));
    }
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  /**
   * How many agency listings are waiting, for the tab label.
   *
   * Its own tiny request rather than a number derived from the rows on screen: the "All packages"
   * tab does not contain the queue, and reading a count off a page of results would report whatever
   * happened to fit on page one.
   */
  useEffect(() => {
    let cancelled = false;
    platformPackageService.reviewQueue({ page: 0, size: 1 })
      .then((res) => { if (!cancelled) setPendingCount(res.pagination?.totalElements ?? 0); })
      // A missing count degrades to no badge. Never an error — nobody asked for this number.
      .catch(() => { if (!cancelled) setPendingCount(null); });
    return () => { cancelled = true; };
  }, [rows]);

  const switchTab = (value) => {
    setPage(0);
    setRows(null);
    setParams({ tab: value }, { replace: true });
  };

  /** Run a step-up action, then RE-READ — the server owns this state machine. */
  const act = (spec) => stepUp.request({ ...spec, run: async (code) => { await spec.run(code); await load(); } });

  const approve = (pkg) => act({
    title: `Approve “${pkg.title}”?`,
    description: `${pkg.ownerName ?? "This agency"} will be able to sell this package to every other agency on the platform.`,
    confirmLabel: "Approve listing",
    run: (code) => platformPackageService.approveListing(pkg.publicId, code),
  });

  const reject = (pkg) => {
    const reason = window.prompt(
      "Why is this listing being declined? The agency sees this, so make it something they can act on.",
    );
    // A cancelled prompt is not a rejection with an empty reason — the server requires one, and
    // sending "" would 400 after the operator had already decided not to reject.
    if (reason === null) return;
    if (!reason.trim()) return;
    act({
      title: `Decline “${pkg.title}”?`,
      description: "The agency keeps the package and can fix it and resubmit.",
      confirmLabel: "Decline listing",
      run: (code) => platformPackageService.rejectListing(pkg.publicId, reason.trim(), code),
    });
  };

  const publish = (pkg) => act({
    title: `Publish “${pkg.title}”?`,
    description: "Every tenant with the package marketplace will be able to see and quote it.",
    confirmLabel: "Publish",
    run: (code) => platformPackageService.publish(pkg.publicId, code),
  });

  const withdraw = (pkg) => act({
    title: `Withdraw “${pkg.title}”?`,
    description:
      "Suspends the package. It stops selling immediately and the owning agency cannot lift a "
      + "suspension themselves. Nothing already quoted from it changes.",
    confirmLabel: "Suspend",
    run: (code) => platformPackageService.unpublish(pkg.publicId, { target: "SUSPENDED" }, code),
  });

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <PageShell>
      <HotelStyles />
      <PageHeader
        title="Package catalog"
        subtitle="Ready-to-book packages, and the agency listings waiting on a decision."
        icon={Package}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/*
            The public submission link had no entry point anywhere in the product — it worked, and
            nobody could find it. It lives here because this is the screen an operator is on when
            they think "I want more packages in the catalog".
          */}
          <Button variant="outline" size="sm" onClick={copySubmitLink}>
            <LinkIcon className="h-3.5 w-3.5" aria-hidden />
            {copied ? "Link copied" : "Public submission link"}
          </Button>
          <Button size="sm" onClick={() => navigate("/console/package-catalog/new")}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New package
          </Button>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => switchTab(t.value)}
            className={
              "-mb-px flex items-center border-b-2 px-3 py-2 text-sm font-semibold transition "
              + (tab === t.value
                ? "border-accent text-heading"
                : "border-transparent text-muted hover:text-body")
            }
          >
            {t.label}
            {t.value === "queue" && pendingCount ? (
              <span className="ml-1.5 rounded-full bg-hue-amber-soft px-1.5 py-0.5 text-xs font-bold text-hue-amber">
                {pendingCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <SectionCard
        title={tab === "queue" ? "Awaiting review" : "All packages"}
        subtitle={
          tab === "queue"
            ? "Oldest first — an agency is waiting on each of these."
            : "Everything in the catalog: the platform's own packages and every agency's, in any state."
        }
        right={
          pagination?.totalElements ? (
            <span className="text-xs text-muted">{pagination.totalElements} total</span>
          ) : null
        }
      >
        {error ? (
          <p className="px-1 py-3 text-sm text-hue-rose">{error}</p>
        ) : rows === null ? (
          <SkeletonCards count={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title={tab === "queue" ? "Nothing waiting" : "No packages yet"}
            hint={
              tab === "queue"
                ? "Agency listings appear here the moment they are submitted. An empty queue is the normal state."
                : "Create one, or seed the demo catalog with the dev-seed profile."
            }
            action={
              tab === "queue" ? null : (
                <Button size="sm" onClick={() => navigate("/console/package-catalog/new")}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  New package
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) => (
                <PackageCard
                  key={p.publicId}
                  pkg={p}
                  onApprove={() => approve(p)}
                  onReject={() => reject(p)}
                  onPublish={() => publish(p)}
                  onWithdraw={() => withdraw(p)}
                  onEdit={() => navigate(`/console/package-catalog/${p.publicId}/edit`)}
                  onOpen={() => navigate(`/console/package-catalog/${p.publicId}`)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-muted">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {stepUp.dialog}
    </PageShell>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */

function PackageCard({ pkg, onApprove, onReject, onPublish, onWithdraw, onEdit, onOpen }) {
  const status = packageStatus(pkg.status);
  const isAgency = pkg.ownerType === "TENANT";
  const inReview = pkg.status === "PENDING_REVIEW";
  const live = pkg.status === "ACTIVE";

  const route = useMemo(
    () => (pkg.stayLegs ?? [])
      .map((l) => `${String(l.nights ?? 0).padStart(2, "0")}N ${l.cityName ?? ""}`.trim())
      .join("  |  "),
    [pkg.stayLegs],
  );

  const inclusions = INCLUSIONS.filter((i) => pkg[i.key]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {/*
        The photo opens the 360. A button rather than a link because the console route tree is
        driven by navigate() throughout, and a card that only reacted to a small "View" control
        would hide the page an operator opens most.
      */}
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[4/3] w-full bg-muted text-left transition hover:opacity-95"
        aria-label={`Open ${pkg.title}`}
      >
        {pkg.coverImageUrl ? (
          <img
            src={pkg.coverImageUrl}
            alt={pkg.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-8 w-8 text-muted" aria-hidden />
          </div>
        )}

        {/* The category ribbon, matching what a buyer sees on the tenant card — the console should
            show the product as it is actually presented, not a sanitised version of it. */}
        {pkg.category ? (
          <span
            className={`absolute right-0 top-3 rounded-l px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-surface ${CATEGORY_TONE[pkg.category] ?? CATEGORY_TONE._default}`}
          >
            {PACKAGE_CATEGORY[pkg.category] ?? pkg.category}
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 truncate text-left text-sm font-bold text-heading transition hover:text-accent"
          >
            {pkg.title}
          </button>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {route ? <p className="line-clamp-2 text-xs text-muted">{route}</p> : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {pkg.packageCode ? (
            <span className="rounded bg-hue-amber-soft px-1.5 py-0.5 font-mono text-[11px] text-hue-amber">
              {pkg.packageCode}
            </span>
          ) : null}
          {pkg.nights !== null && pkg.nights !== undefined ? (
            <span className="text-[11px] text-muted">
              {String(pkg.nights).padStart(2, "0")} Nights {String(pkg.dayCount ?? pkg.nights + 1).padStart(2, "0")} Days
            </span>
          ) : null}
          {pkg.available === false ? <span className="text-[11px] text-muted">· switched off</span> : null}
        </div>

        {inclusions.length ? (
          <div className="flex flex-wrap items-center gap-3">
            {inclusions.map(({ key, Icon, label }) => (
              <span key={key} className="flex items-center gap-1 text-[11px] text-muted" title={label}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <MapPin className="h-3 w-3" aria-hidden />
          {isAgency ? (
            <span className="truncate">{pkg.ownerName ?? `Tenant ${pkg.ownerTenantId ?? "?"}`}</span>
          ) : (
            <Badge>Platform</Badge>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">Starting from</div>
            {/* Never a zero — a package with no live slab is genuinely on request. */}
            <div className="truncate text-sm font-bold text-heading">
              {pkg.fromPricePerPax === null || pkg.fromPricePerPax === undefined
                ? "On request"
                : `₹${Number(pkg.fromPricePerPax).toLocaleString("en-IN")}`}
              {pkg.fromPricePerPax !== null && pkg.fromPricePerPax !== undefined ? (
                <span className="text-[11px] font-normal text-muted"> / pax</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          {/* Editing is offered on PLATFORM rows only. An agency's package is theirs: the platform
              reviews it, suspends it, or leaves it alone — it does not rewrite someone else's
              product. The server enforces that too; this simply does not offer the button. */}
          {!isAgency ? (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          ) : null}

          {/* An agency listing is reviewed; a platform package is published. Different acts, and
              the server refuses the wrong one — so only the right button is offered. */}
          {isAgency && inReview ? (
            <>
              <Button size="sm" onClick={onApprove}>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={onReject}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Decline
              </Button>
            </>
          ) : null}

          {!isAgency && !live ? (
            <Button size="sm" onClick={onPublish}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Publish
            </Button>
          ) : null}

          {live ? (
            <Button size="sm" variant="outline" onClick={onWithdraw}>
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Suspend
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
