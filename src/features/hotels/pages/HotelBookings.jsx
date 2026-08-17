// src/features/hotels/pages/HotelBookings.jsx
// Reservations table across the portfolio — filter by status / source / hotel.
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Search, Users, Baby, Plus } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, Input, Button, Badge,
  EmptyState, useToast, errMsg,
  BOOKING_STATUS, PAYMENT_STATUS, StatusBadge, ChipBar, statusChips,
  usePaged, Pager, SkeletonCards, StatStrip,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, fmtMoney, fmtDate,
} from "../components/hotelUi";

export default function HotelBookings() {
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [q, setQ] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([hotelService.listBookings(), hotelService.listHotels()])
      .then(([b, h]) => { if (alive) { setRows(b); setHotels(h); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load bookings."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  const sources = useMemo(() => [...new Set((rows || []).map((r) => r.source))], [rows]);

  const filtered = useMemo(() => {
    const list = rows || [];
    const needle = q.trim().toLowerCase();
    return list.filter((b) =>
      (!hotelId || b.hotelId === hotelId) &&
      (!status || b.status === status) &&
      (!source || b.source === source) &&
      (!needle || [b.id, b.guest, b.room, b.hotelName].some((f) => f?.toLowerCase().includes(needle)))
    );
  }, [rows, q, hotelId, status, source]);

  const paged = usePaged(filtered, 10);

  const stats = useMemo(() => {
    const list = rows || [];
    const count = (s) => list.filter((b) => b.status === s).length;
    return [
      { key: "t", label: "Total Bookings", value: list.length, tone: "text-blue-500", accent: "bg-blue-50" },
      { key: "ci", label: "Checked In", value: count("CHECKED_IN"), tone: "text-green-500", accent: "bg-green-50" },
      { key: "cf", label: "Confirmed", value: count("CONFIRMED"), tone: "text-indigo-500", accent: "bg-indigo-50" },
      { key: "pn", label: "Pending", value: count("PENDING"), tone: "text-amber-500", accent: "bg-amber-50" },
      { key: "cx", label: "Cancelled", value: count("CANCELLED"), tone: "text-red-500", accent: "bg-red-50" },
    ];
  }, [rows]);

  return (
    <PageShell>
      <PageHeader title="Hotel Bookings" subtitle="All reservations across your properties" icon={CalendarRange}>
        <Button size="sm"><Plus className="h-4 w-4" /> New Booking</Button>
      </PageHeader>

      {rows && <StatStrip items={stats} className="mb-5" />}

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, guest, room…" className="pl-9" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect value={hotelId} onChange={setHotelId}>
                <option value="">All Hotels</option>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </FilterSelect>
              <FilterSelect value={source} onChange={setSource}>
                <option value="">All Sources</option>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </FilterSelect>
            </div>
          </div>
          <ChipBar options={statusChips(BOOKING_STATUS)} value={status} onChange={setStatus} />
        </div>
      </GlassCard>

      {!rows ? (
        <SkeletonCards count={4} />
      ) : filtered.length === 0 ? (
        <GlassCard><EmptyState icon={CalendarRange} title="No bookings found" hint="Adjust filters to see more." /></GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.pageItems.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-bold text-blue-600">{b.id}</TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-700">{b.guest}</p>
                    <p className="text-xs text-slate-400">{b.hotelName}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-700">{b.room}</p>
                    <p className="text-xs text-slate-400">No. {b.roomNo}</p>
                  </TableCell>
                  <TableCell>{fmtDate(b.checkIn)}</TableCell>
                  <TableCell>{fmtDate(b.checkOut)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-0.5"><Users className="h-3.5 w-3.5" />{b.adults}</span>
                      <span className="inline-flex items-center gap-0.5"><Baby className="h-3.5 w-3.5" />{b.children}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-700">{fmtMoney(b.amount)}</TableCell>
                  <TableCell><StatusBadge config={PAYMENT_STATUS} value={b.paymentStatus} /></TableCell>
                  <TableCell><StatusBadge config={BOOKING_STATUS} value={b.status} /></TableCell>
                  <TableCell><Badge variant="slate">{b.source}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
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

function FilterSelect({ value, onChange, children }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50">
      {children}
    </select>
  );
}
