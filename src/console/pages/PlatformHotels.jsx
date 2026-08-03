// src/console/pages/PlatformHotels.jsx
//
// The SuperAdmin's list of catalog hotels. Converted from the old mocked
// `features/hotels/pages/HotelList.jsx`: same card/table shell, `ViewToggle`, chip filter and Pager,
// but every hotelier metric it used to show (occupancy, ADR, monthly revenue) is gone. Those describe
// running a property; this screen is about distributing one. What replaces them is what a catalog
// operator actually needs: publish state, where it is, how many rooms it sells, and how many tenants
// have taken a copy.
//
// Paging, search and the status filter are SERVER-side now. The mock version filtered a fully-loaded
// array in a `useMemo`, which silently truncates the moment the catalog outgrows one page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BedDouble, Building2, MapPin, Plus, Search, Users } from "lucide-react";
import {
  PageShell, PageHeader, GlassCard, HotelStyles,
  Input, Label, Button, Badge, Select,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  EmptyState, SkeletonCards, Pager, ChipBar, ViewToggle, useViewMode,
  StarRating, useToast, errMsg, cn,
} from "../components/hotelUi";
import { platformHotelService, CATALOG_STATUS } from "../api/platformHotelService";

const PAGE_SIZE = 12;

const STATUS_CHIPS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Published" },
  { value: "INACTIVE", label: "Withdrawn" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default function PlatformHotels() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rows, setRows] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useViewMode("platform-hotels", "grid");
  const [creating, setCreating] = useState(false);

  // Debounced so typing does not fire a request per keystroke; resets to page 0 because a filtered
  // result set has no page 3 to stay on.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    let alive = true;
    setRows(null);
    platformHotelService
      .list({ page, size: PAGE_SIZE, status, q: debouncedQ })
      .then((r) => {
        if (!alive) return;
        setRows(r.items);
        setPagination(r.pagination);
      })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        showToast(errMsg(e, "Failed to load the hotel catalog."), "error");
      });
    return () => { alive = false; };
  }, [page, status, debouncedQ, showToast]);

  useEffect(load, [load]);

  const pagerProps = useMemo(() => {
    const totalPages = pagination?.totalPages ?? 1;
    const total = pagination?.totalElements ?? (rows?.length ?? 0);
    const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const to = Math.min(total, (page + 1) * PAGE_SIZE);
    return { page, totalPages, total, from, to };
  }, [pagination, page, rows]);

  return (
    <PageShell>
      <HotelStyles />
      <PageHeader
        title="Hotel Catalog"
        subtitle="Hotels the platform sells to every tenant"
        icon={Building2}
      >
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Add Hotel
        </Button>
      </PageHeader>

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by hotel or city…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <ChipBar
              options={STATUS_CHIPS}
              value={status}
              onChange={(v) => { setStatus(v); setPage(0); }}
            />
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </GlassCard>

      {rows === null ? (
        <SkeletonCards count={6} />
      ) : rows.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={Building2}
            title="No hotels in the catalog"
            hint={q || status ? "Try a different search or filter." : "Add the first hotel to start selling it to tenants."}
            action={!q && !status ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Hotel</Button> : null}
          />
        </GlassCard>
      ) : view === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((h) => (
              <HotelCard key={h.publicId} hotel={h} onOpen={() => navigate(`/console/hotel-catalog/${h.publicId}`)} />
            ))}
          </div>
          <div className="mt-4"><Pager {...pagerProps} onPage={setPage} /></div>
        </>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Imported by</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow
                  key={h.publicId}
                  className="cursor-pointer"
                  onClick={() => navigate(`/console/hotel-catalog/${h.publicId}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {h.primaryImageUrl ? (
                        <img src={h.primaryImageUrl} alt="" className="h-10 w-14 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-slate-100">
                          <Building2 className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                      <p className="font-bold text-slate-700">{h.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600">
                      {[h.cityName, h.stateName, h.countryCode].filter(Boolean).join(", ")}
                    </span>
                  </TableCell>
                  <TableCell><StarRating value={h.rating ?? h.stars ?? 0} size={13} showValue /></TableCell>
                  <TableCell>{h.rooms?.length ?? "—"}</TableCell>
                  <TableCell>{h.linkedTenantCount ?? "—"}</TableCell>
                  <TableCell className="text-slate-500">v{h.catalogVersion}</TableCell>
                  <TableCell><CatalogStatusBadge value={h.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager {...pagerProps} onPage={setPage} />
        </GlassCard>
      )}

      {creating && (
        <CreateHotelDialog
          onClose={() => setCreating(false)}
          onCreated={(publicId) => {
            setCreating(false);
            navigate(`/console/hotel-catalog/${publicId}`);
          }}
        />
      )}
    </PageShell>
  );
}

/** The catalog has its own statuses, so it does not reuse the kit's HOTEL_STATUS map. */
export function CatalogStatusBadge({ value }) {
  const cfg = CATALOG_STATUS[value] ?? { label: value ?? "—", className: "bg-slate-100 text-slate-600" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", cfg.className)}>{cfg.label}</span>;
}

function HotelCard({ hotel: h, onOpen }) {
  return (
    <GlassCard className="group overflow-hidden transition-all hover:shadow-md hfade-up">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative overflow-hidden">
          {h.primaryImageUrl ? (
            <img
              src={h.primaryImageUrl}
              alt={h.name}
              loading="lazy"
              className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-slate-100">
              <Building2 className="h-8 w-8 text-slate-300" />
            </div>
          )}
          <div className="absolute left-3 top-3"><CatalogStatusBadge value={h.status} /></div>
          {(h.rating || h.stars) && (
            <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 backdrop-blur">
              <StarRating value={h.rating ?? h.stars} size={12} showValue />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="mb-1 truncate font-extrabold text-slate-800">{h.name}</h3>
          <p className="mb-3 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            {[h.cityName, h.countryCode].filter(Boolean).join(", ")} · v{h.catalogVersion}
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Metric icon={BedDouble} label="Rooms" value={h.rooms?.length ?? "—"} />
            <Metric icon={Users} label="Imported by" value={h.linkedTenantCount ?? "—"} />
          </div>
        </div>
      </button>
    </GlassCard>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2">
      <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-slate-700">
        {Icon && <Icon className="h-3.5 w-3.5 text-blue-500" />}{value}
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

/**
 * Minimal create form. Only the three fields the backend requires plus the two that make the row
 * findable — everything else is edited on the detail page, which is where the operator lands next.
 *
 * `countryCode` is an ISO code and it is load-bearing: the tenant-side import matches a tenant's
 * Country on exactly this value, so a wrong or blank code is why an import later fails with
 * LOCATION_MAPPING_REQUIRED.
 */
function CreateHotelDialog({ onClose, onCreated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", cityName: "", countryCode: "IN", stateName: "", stars: "" });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && form.cityName.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const created = await platformHotelService.create({
        name: form.name.trim(),
        cityName: form.cityName.trim(),
        countryCode: form.countryCode.trim().toUpperCase() || null,
        stateName: form.stateName.trim() || null,
        stars: form.stars === "" ? null : Number(form.stars),
      });
      showToast(`${created.name} created as a draft.`, "success");
      onCreated(created.publicId);
    } catch (err) {
      showToast(errMsg(err, "Could not create the hotel."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent onClose={() => { if (!saving) onClose(); }}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a catalog hotel</DialogTitle>
            <DialogDescription>
              Created as a draft — no tenant sees it until you publish.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-2">
            <div>
              <Label required htmlFor="ph-name">Hotel name</Label>
              <Input id="ph-name" value={form.name} onChange={set("name")} autoFocus placeholder="The Goa Bay Resort" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required htmlFor="ph-city">City</Label>
                <Input id="ph-city" value={form.cityName} onChange={set("cityName")} placeholder="Goa" />
              </div>
              <div>
                <Label htmlFor="ph-country">Country code (ISO)</Label>
                <Input
                  id="ph-country"
                  value={form.countryCode}
                  onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="IN"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Tenants' geography is matched on this code when they import.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ph-state">State / region</Label>
                <Input id="ph-state" value={form.stateName} onChange={set("stateName")} placeholder="Goa" />
              </div>
              <div>
                <Label htmlFor="ph-stars">Star rating</Label>
                <Select id="ph-stars" value={form.stars} onChange={set("stars")}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={!valid || saving}>{saving ? "Creating…" : "Create draft"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
