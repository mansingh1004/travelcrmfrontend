// src/features/hotels/pages/RoomTypes.jsx
// Room-type catalogue across all hotels — the table spec from the brief.
import { useEffect, useMemo, useState } from "react";
import { BedDouble, Search, Users, Plus } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, Input, Button, Badge,
  EmptyState, useToast, errMsg,
  ROOM_STATUS, StatusBadge, ChipBar, statusChips, usePaged, Pager, SkeletonCards,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, fmtMoney,
} from "../components/hotelUi";

export default function RoomTypes() {
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [q, setQ] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([hotelService.allRoomTypes(), hotelService.listHotels()])
      .then(([r, h]) => { if (alive) { setRows(r); setHotels(h); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load room types."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  const filtered = useMemo(() => {
    const list = rows || [];
    const needle = q.trim().toLowerCase();
    return list.filter((r) =>
      (!hotelId || r.hotelId === hotelId) &&
      (!status || r.status === status) &&
      (!needle || [r.name, r.hotelName].some((f) => f?.toLowerCase().includes(needle)))
    );
  }, [rows, q, hotelId, status]);

  const paged = usePaged(filtered, 10);

  return (
    <PageShell>
      <PageHeader title="Room Types" subtitle="All room categories & rates across properties" icon={BedDouble}>
        <Button size="sm"><Plus className="h-4 w-4" /> Add Room Type</Button>
      </PageHeader>

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search room or hotel…" className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}
              className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50">
              <option value="">All Hotels</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <ChipBar options={statusChips(ROOM_STATUS)} value={status} onChange={setStatus} />
          </div>
        </div>
      </GlassCard>

      {!rows ? (
        <SkeletonCards count={4} />
      ) : filtered.length === 0 ? (
        <GlassCard><EmptyState icon={BedDouble} title="No room types found" /></GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Extra Adult</TableHead>
                <TableHead>Extra Child</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Booked</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.pageItems.map((r) => (
                <TableRow key={`${r.hotelId}-${r.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={r.image} alt="" className="h-11 w-16 rounded-lg object-cover" loading="lazy" />
                      <span className="font-bold text-slate-700">{r.name}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-slate-500">{r.hotelName}</span></TableCell>
                  <TableCell><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-slate-400" />{r.capacity}</span></TableCell>
                  <TableCell className="font-bold text-slate-700">{fmtMoney(r.basePrice)}</TableCell>
                  <TableCell>{fmtMoney(r.extraAdult)}</TableCell>
                  <TableCell>{fmtMoney(r.extraChild)}</TableCell>
                  <TableCell><Badge variant="green">{r.available}</Badge></TableCell>
                  <TableCell><Badge variant="blue">{r.booked}</Badge></TableCell>
                  <TableCell><StatusBadge config={ROOM_STATUS} value={r.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  </TableCell>
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
