// src/features/marketplace/pages/MyPackages.jsx
//
// An agency's own packages, and the daily work: switch one off, change the rates, send it for
// listing, take it back.
//
// The first version put six buttons on every row. That is a wall of controls where there is really
// one decision per package, so the row now carries exactly two things an author touches daily — the
// availability switch and one contextual primary action — and everything else lives behind a menu.
// A row also carries its photo and its route, because those are what an author recognises a package
// by; a text-only row makes you read the title of all eight to find one.
//
// Rows that cannot be published say so, with a count, rather than letting the author discover it by
// pressing a button and reading a 409.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package as PackageIcon, Plus, Search as SearchIcon, MoreHorizontal, Pencil, IndianRupee,
  Send, Undo2, Power, Trash2, AlertCircle, Image as ImageIcon, Inbox,
} from "lucide-react";

import {
  Page, PageHeader, Card, Button, Input, Pager, Empty, Loading, Notice, Modal, Photo,
  fmtMoney, useToast, errMsg, isAlreadyReported, useHotkeys, cn, FONT,
} from "../components/marketplaceUi";
import { PackageRateTable, toRateRows, toRatePayload, ratesAreValid } from "../components/PackageRateTable";
import { packageMarketplaceService, packageStatus, nightsLabel, stayRoute } from "../api/packageMarketplaceService";
import { PKG_PRIMARY, PKG_CHIP_ON } from "../components/packageTheme";
import { blockingCount } from "../lib/packageReadiness";
import { packageMixService } from "../api/packageMixService";

const PAGE_SIZE = 20;

/** Status filter chips. "" is All. */
const FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ACTIVE", label: "Live" },
  { value: "PENDING_REVIEW", label: "In review" },
  { value: "INACTIVE", label: "Paused" },
];

export function MyPackages() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const searchRef = useRef(null);

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [pricing, setPricing] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await packageMarketplaceService.listMine({ page, size: PAGE_SIZE });
      setRows(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setRows([]);
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not load your packages"), "error");
    }
  }, [page, showToast]);

  useEffect(() => { load(); }, [load]);

  useHotkeys({
    "/": () => searchRef.current?.focus(),
    n: () => navigate("/marketplace/packages/mine/new"),
  });

  /**
   * Search and the status chips narrow in the browser.
   *
   * Deliberate, and bounded: this endpoint returns one agency's own packages, which is tens of rows,
   * not the thousands the public catalog holds. Filtering server-side here would be a round trip per
   * keystroke to reorder a list that already fits in memory. If an agency ever passes a page of
   * these, the fix is a server filter — and the page size makes that visible rather than silent.
   */
  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (rows ?? []).filter((p) => {
      if (status && p.status !== status) return false;
      if (!q) return true;
      return [p.title, p.packageCode, p.stateName, stayRoute(p.stayLegs)]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, term, status]);

  /**
   * Run a write, then RE-READ rather than patching state from the response.
   *
   * The reload runs on failure too: a 409 means the state being rendered was the stale thing, and
   * leaving it on screen invites the same click again.
   */
  const run = async (publicId, fn, successMessage) => {
    setBusy(publicId);
    try {
      await fn();
      if (successMessage) showToast(successMessage, "success");
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "That did not work"), "error");
    } finally {
      setBusy(null);
      load();
    }
  };

  const totalPages = pagination?.totalPages ?? 1;
  const counts = useMemo(() => {
    const out = {};
    (rows ?? []).forEach((p) => { out[p.status] = (out[p.status] ?? 0) + 1; });
    return out;
  }, [rows]);

  // How many buyers are waiting on a custom price. Fails to zero on purpose: a badge that could
  // not load must not stop the page, and a toast about a number nobody asked for is noise.
  const [mixPending, setMixPending] = useState(0);
  useEffect(() => {
    packageMixService.pendingCount().then(setMixPending).catch(() => setMixPending(0));
  }, []);

  return (
    <Page width="max-w-none">
      <div style={FONT}>
        <PageHeader
          title="My packages"
          subtitle="Your own itineraries. Keep them private, or list them for other agencies to buy."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/*
                The seller's queue, reachable from where the seller actually lives. An author who
                has published a customisable package will be answered here, and the sidebar item
                alone is not enough — the count is the point, and it only means something beside
                the packages it is about.
              */}
              <Button onClick={() => navigate("/marketplace/packages/requests?tab=incoming")}>
                <Inbox className="h-4 w-4" aria-hidden />
                Mix requests
                {mixPending > 0 ? (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    {mixPending}
                  </span>
                ) : null}
              </Button>
              <Button variant="primary" className={PKG_PRIMARY} onClick={() => navigate("/marketplace/packages/mine/new")}>
                <Plus className="h-4 w-4" aria-hidden />
                New package
              </Button>
            </div>
          }
        />

        {rows !== null && rows.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search your packages…   (press /)"
                aria-label="Search your packages"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map((f) => {
                const n = f.value ? counts[f.value] ?? 0 : rows.length;
                if (f.value && n === 0) return null;   // a chip that filters to nothing is noise
                return (
                  <button
                    key={f.value || "all"}
                    type="button"
                    onClick={() => setStatus(f.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      status === f.value
                        ? PKG_CHIP_ON
                        : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {f.label}
                    <span className="ml-1 tabular-nums opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          {rows === null ? (
            <Loading label="Loading your packages…" />
          ) : rows.length === 0 ? (
            <Card>
              <Empty
                icon={PackageIcon}
                title="No packages yet"
                hint="Build one once, then quote it as often as you like — or list it for other agencies to buy."
                action={
                  <Button variant="primary" className={PKG_PRIMARY} onClick={() => navigate("/marketplace/packages/mine/new")}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Create your first package
                  </Button>
                }
              />
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <Empty
                icon={SearchIcon}
                title="Nothing matches"
                hint="Try a different search, or clear the filter."
                action={
                  <Button onClick={() => { setTerm(""); setStatus(""); }}>Clear</Button>
                }
              />
            </Card>
          ) : (
            <>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {visible.map((p) => (
                  <PackageRow
                    key={p.publicId}
                    pkg={p}
                    busy={busy === p.publicId}
                    onOpen={() => navigate(`/marketplace/packages/mine/${p.publicId}`)}
                    onPrices={() => setPricing(p)}
                    onToggle={(next) => run(
                      p.publicId,
                      () => packageMarketplaceService.setAvailability(p.publicId, next),
                      next ? "Available again" : "Switched off",
                    )}
                    onList={() => run(
                      p.publicId,
                      () => packageMarketplaceService.listOnMarketplace(p.publicId),
                      "Sent for marketplace review",
                    )}
                    onUnlist={() => run(
                      p.publicId,
                      () => packageMarketplaceService.unlist(p.publicId),
                      "Removed from the marketplace",
                    )}
                    onActivate={() => run(
                      p.publicId,
                      () => packageMarketplaceService.activate(p.publicId),
                      "Package activated",
                    )}
                    onDeactivate={() => run(
                      p.publicId,
                      () => packageMarketplaceService.deactivate(p.publicId),
                      "Package paused",
                    )}
                    onDelete={() => run(
                      p.publicId,
                      () => packageMarketplaceService.remove(p.publicId),
                      "Package deleted",
                    )}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-5">
                  <Pager page={page} totalPages={totalPages} total={pagination?.totalElements} onPage={setPage} />
                </div>
              ) : null}
            </>
          )}
        </div>

        {pricing ? (
          <RateModal pkg={pricing} onClose={() => setPricing(null)} onSaved={() => { setPricing(null); load(); }} />
        ) : null}
      </div>
    </Page>
  );
}

/* ── Row ─────────────────────────────────────────────────────────────────── */

function PackageRow({
  pkg, busy, onOpen, onPrices, onToggle, onList, onUnlist, onActivate, onDeactivate, onDelete,
}) {
  const status = packageStatus(pkg.status);
  const listed = pkg.visibility === "MARKETPLACE";
  const inReview = pkg.status === "PENDING_REVIEW";
  const suspended = pkg.status === "SUSPENDED";
  const route = stayRoute(pkg.stayLegs);
  const missing = blockingCount(pkg);

  /**
   * One primary action, chosen by where the package actually is.
   *
   * The alternative — rendering every verb and disabling the ones that do not apply — turns a row
   * into five greyed buttons and a puzzle. A state that has no next step simply has no button.
   */
  const primary = suspended ? null
    : inReview ? { label: "Withdraw", Icon: Undo2, onClick: onUnlist, variant: "secondary" }
    : listed ? { label: "Unlist", Icon: Undo2, onClick: onUnlist, variant: "secondary" }
    : { label: "List for sale", Icon: Send, onClick: onList, variant: "primary" };

  return (
    <div className="flex items-center gap-4 p-3 transition hover:bg-slate-50/60">
      <button
        type="button"
        onClick={onOpen}
        className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100"
        aria-label={`Open ${pkg.title}`}
      >
        {pkg.coverImageUrl ? (
          <Photo src={pkg.coverImageUrl} alt="" className="h-full w-full" imgClassName="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-slate-300" aria-hidden />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-sm font-semibold text-slate-900 hover:underline"
          >
            {pkg.title}
          </button>
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", status.cls)}>{status.label}</span>
          {pkg.available === false ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">Off</span>
          ) : null}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          {pkg.packageCode ? <span className="font-mono text-[11px]">{pkg.packageCode}</span> : null}
          {pkg.nights !== null && pkg.nights !== undefined ? <span>· {nightsLabel(pkg.nights)}</span> : null}
          {route ? <span className="truncate">· {route}</span> : null}
        </div>

        {missing > 0 ? (
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 hover:underline"
          >
            <AlertCircle className="h-3 w-3" aria-hidden />
            {missing} thing{missing === 1 ? "" : "s"} to finish before this can be published
          </button>
        ) : null}
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        {pkg.fromPricePerPax === null || pkg.fromPricePerPax === undefined ? (
          <span className="text-xs text-slate-400">No rate</span>
        ) : (
          <>
            <div className="text-sm font-semibold text-slate-900">{fmtMoney(pkg.fromPricePerPax)}</div>
            <div className="text-[11px] text-slate-500">per pax</div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={pkg.available !== false}
          disabled={busy}
          onChange={onToggle}
          label="Available"
        />

        {primary ? (
          <Button size="sm" variant={primary.variant} disabled={busy} onClick={primary.onClick}>
            <primary.Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{primary.label}</span>
          </Button>
        ) : null}

        <RowMenu
          disabled={busy}
          items={[
            { label: "Edit", Icon: Pencil, onClick: onOpen },
            { label: "Rates", Icon: IndianRupee, onClick: onPrices },
            pkg.status === "ACTIVE"
              ? { label: "Pause", Icon: Power, onClick: onDeactivate }
              : suspended ? null
              : { label: "Activate", Icon: Power, onClick: onActivate },
            { label: "Delete", Icon: Trash2, onClick: onDelete, danger: true },
          ].filter(Boolean)}
        />
      </div>
    </div>
  );
}

/* ── Small controls ──────────────────────────────────────────────────────── */

/** A labelled switch. Not a bare checkbox — this one is pressed daily and needs a hit area. */
function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Available — click to switch off" : "Switched off — click to make available"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          checked ? "left-[1.125rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

/** An overflow menu. Closes on outside click and on Escape, and returns focus to its trigger. */
function RowMenu({ items, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
        className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onClick(); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-slate-50",
                item.danger ? "text-rose-600" : "text-slate-700",
              )}
            >
              <item.Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Rate modal ──────────────────────────────────────────────────────────── */

function RateModal({ pkg, onClose, onSaved }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    packageMarketplaceService.getPackage(pkg.publicId)
      .then((full) => { if (!cancelled) setRows(toRateRows(full.priceSlabs)); })
      .catch((e) => {
        if (cancelled) return;
        if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not load rates"), "error");
        setRows(toRateRows([]));
      });
    return () => { cancelled = true; };
  }, [pkg.publicId, showToast]);

  const save = async () => {
    setSaving(true);
    try {
      await packageMarketplaceService.savePriceSlabs(pkg.publicId, toRatePayload(rows));
      showToast("Rates updated", "success");
      onSaved();
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(errMsg(e, "Could not save the rates"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Rates — ${pkg.title}`}
      width="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!rows || !ratesAreValid(rows)}
            onClick={save}
          >
            Save rates
          </Button>
        </div>
      }
    >
      {rows === null ? (
        <Loading label="Loading rates…" />
      ) : (
        <>
          <Notice tone="info" className="mb-3">
            Saving rates does not send this package back for review — an approved listing whose price
            moved is still the same listing.
          </Notice>
          <PackageRateTable rows={rows} onChange={setRows} />
        </>
      )}
    </Modal>
  );
}

export default MyPackages;
