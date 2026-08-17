// src/features/hotels/pages/InventoryCalendar.jsx
// Availability calendar — room types (rows) × dates (cols), colour-coded.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, Button, cn,
  LoadingState, useToast, errMsg,
} from "../components/hotelUi";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATE_STYLE = {
  AVAILABLE: { cell: "bg-green-50 text-green-700 hover:bg-green-100", dot: "bg-green-500", label: "Available" },
  PARTIAL: { cell: "bg-amber-50 text-amber-700 hover:bg-amber-100", dot: "bg-amber-500", label: "Partially Booked" },
  SOLD_OUT: { cell: "bg-red-50 text-red-600 hover:bg-red-100", dot: "bg-red-500", label: "Sold Out" },
};

// Fixed "today" to match the mock dataset's reference date (2026-07-18).
const TODAY = { year: 2026, month: 6, day: 18 };

export default function InventoryCalendar() {
  const [params] = useSearchParams();
  const { showToast } = useToast();
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState(params.get("hotel") || "");
  const [roomFilter, setRoomFilter] = useState("");
  const [cursor, setCursor] = useState({ year: TODAY.year, month: TODAY.month });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    hotelService.listHotels()
      .then((h) => { if (alive) { setHotels(h); if (!hotelId && h.length) setHotelId(h[0].id); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load hotels."), "error"));
    return () => { alive = false; };
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hotelId) return;
    let alive = true;
    setLoading(true);
    hotelService.inventory(hotelId, cursor.year, cursor.month)
      .then((d) => alive && setData(d))
      .catch((e) => alive && showToast(errMsg(e, "Failed to load inventory."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [hotelId, cursor, showToast]);

  const shift = (d) => setCursor((c) => {
    let m = c.month + d, y = c.year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { year: y, month: m };
  });
  const goToday = () => setCursor({ year: TODAY.year, month: TODAY.month });

  const grid = data?.grid?.filter((g) => !roomFilter || g.roomTypeId === roomFilter) || [];
  const roomOpts = data?.grid || [];

  return (
    <PageShell>
      <PageHeader title="Inventory Calendar" subtitle="Room availability at a glance" icon={CalendarRange} />

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={hotelId} onChange={setHotelId} label="Hotel">
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
            <Select value={roomFilter} onChange={setRoomFilter} label="Room Type">
              <option value="">All Room Types</option>
              {roomOpts.map((g) => <option key={g.roomTypeId} value={g.roomTypeId}>{g.roomType}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[150px] text-center text-sm font-extrabold text-slate-700">{MONTHS[cursor.month]} {cursor.year}</span>
            <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {Object.values(STATE_STYLE).map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} /> {s.label}
            </span>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {loading || !data ? (
          <LoadingState label="Loading inventory…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Room Type
                  </th>
                  {Array.from({ length: data.days }).map((_, i) => {
                    const day = i + 1;
                    const isToday = cursor.year === TODAY.year && cursor.month === TODAY.month && day === TODAY.day;
                    const dow = new Date(cursor.year, cursor.month, day).getDay();
                    const weekend = dow === 0 || dow === 6;
                    return (
                      <th key={day} className={cn("border-b border-l border-slate-100 px-1 py-2 text-center text-[10px] font-bold",
                        isToday ? "bg-blue-600 text-white" : weekend ? "bg-slate-50 text-slate-400" : "text-slate-400")}>
                        <div>{day}</div>
                        <div className="text-[8px] font-medium opacity-70">{["S", "M", "T", "W", "T", "F", "S"][dow]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <tr key={row.roomTypeId}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2">
                      <p className="whitespace-nowrap text-sm font-bold text-slate-700">{row.roomType}</p>
                      <p className="text-[11px] text-slate-400">{row.total} rooms</p>
                    </td>
                    {row.cells.map((c) => {
                      const st = STATE_STYLE[c.state];
                      return (
                        <td key={c.day} className="border-b border-l border-slate-100 p-0.5">
                          <div className={cn("flex h-11 min-w-[38px] cursor-default flex-col items-center justify-center rounded-md text-[11px] font-extrabold transition-colors", st.cell)}
                            title={`${row.roomType} · Day ${c.day}: ${c.available}/${c.total} available (${st.label})`}>
                            {c.available}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </PageShell>
  );
}

function Select({ value, onChange, label, children }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50">
        {children}
      </select>
    </label>
  );
}
