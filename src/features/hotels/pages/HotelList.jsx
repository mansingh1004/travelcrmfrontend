// src/features/hotels/pages/HotelList.jsx
// Portfolio list — searchable, filterable card/list view of all properties.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Search, MapPin, BedDouble, Gauge, Plus, ArrowRight } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, Input, Button, Badge,
  EmptyState, useToast, errMsg, cn,
  HOTEL_STATUS, StatusBadge, StarRating, ChipBar, statusChips,
  ViewToggle, useViewMode, usePaged, Pager, SkeletonCards,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  fmtMoneyShort, fmtPct,
} from "../components/hotelUi";

export default function HotelList() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [hotels, setHotels] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useViewMode("hotels", "grid");

  useEffect(() => {
    let alive = true;
    hotelService.listHotels()
      .then((d) => alive && setHotels(d))
      .catch((e) => alive && showToast(errMsg(e, "Failed to load hotels."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  const filtered = useMemo(() => {
    const list = hotels || [];
    const needle = q.trim().toLowerCase();
    return list.filter((h) =>
      (!status || h.status === status) &&
      (!needle || [h.name, h.city, h.code, h.chain].some((f) => f?.toLowerCase().includes(needle)))
    );
  }, [hotels, q, status]);

  const paged = usePaged(filtered, view === "grid" ? 9 : 10);

  return (
    <PageShell>
      <PageHeader title="Hotels" subtitle="All properties in your portfolio" icon={Building2}>
        <Button size="sm"><Plus className="h-4 w-4" /> Add Hotel</Button>
      </PageHeader>

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city, code…" className="pl-9" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <ChipBar options={statusChips(HOTEL_STATUS)} value={status} onChange={setStatus} />
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </GlassCard>

      {!hotels ? (
        <SkeletonCards count={6} />
      ) : filtered.length === 0 ? (
        <GlassCard><EmptyState icon={Building2} title="No hotels found" hint="Try a different search or filter." /></GlassCard>
      ) : view === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {paged.pageItems.map((h) => <HotelCard key={h.id} hotel={h} onOpen={() => navigate(`/hotels/${h.id}`)} />)}
          </div>
          <div className="mt-4"><Pager {...paged} onPage={paged.setPage} /></div>
        </>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Revenue / mo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.pageItems.map((h) => (
                <TableRow key={h.id} className="cursor-pointer" onClick={() => navigate(`/hotels/${h.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={h.images?.[0]} alt="" className="h-10 w-14 rounded-lg object-cover" loading="lazy" />
                      <div>
                        <p className="font-bold text-slate-700">{h.name}</p>
                        <p className="text-xs text-slate-400">{h.code} · {h.chain}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-slate-600">{h.city}, {h.state}</span></TableCell>
                  <TableCell><Badge variant="slate">{h.type}</Badge></TableCell>
                  <TableCell><StarRating value={h.rating} size={13} showValue /></TableCell>
                  <TableCell>{h.availableRooms}/{h.totalRooms}</TableCell>
                  <TableCell><OccBar value={h.occupancy} /></TableCell>
                  <TableCell className="font-bold text-slate-700">{fmtMoneyShort(h.revenueMonth)}</TableCell>
                  <TableCell><StatusBadge config={HOTEL_STATUS} value={h.status} /></TableCell>
                  <TableCell><ArrowRight className="h-4 w-4 text-slate-300" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager {...paged} onPage={paged.setPage} />
        </GlassCard>
      )}
    </PageShell>
  );
}

function HotelCard({ hotel: h, onOpen }) {
  return (
    <GlassCard className="group overflow-hidden transition-all hover:shadow-md hfade-up">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative overflow-hidden">
          <img src={h.images?.[0]} alt={h.name} loading="lazy"
            className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute left-3 top-3"><StatusBadge config={HOTEL_STATUS} value={h.status} /></div>
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 backdrop-blur">
            <StarRating value={h.rating} size={12} showValue />
          </div>
        </div>
        <div className="p-4">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="truncate font-extrabold text-slate-800">{h.name}</h3>
          </div>
          <p className="mb-3 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5" /> {h.city}, {h.state} · {h.code}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric icon={BedDouble} label="Rooms" value={h.totalRooms} />
            <Metric icon={Gauge} label="Occupancy" value={`${h.occupancy}%`} />
            <Metric label="Revenue" value={fmtMoneyShort(h.revenueMonth)} />
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

function OccBar({ value }) {
  const tone = value >= 85 ? "bg-red-500" : value >= 60 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-600">{fmtPct(value)}</span>
    </div>
  );
}
