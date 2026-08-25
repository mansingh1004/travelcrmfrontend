// src/features/hotels/pages/Housekeeping.jsx
// Room cleaning board — status per room with housekeeper + ETA.
import { useEffect, useMemo, useState } from "react";
import { BrushCleaning, DoorClosed } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, cn,
  LoadingState, EmptyState, useToast, errMsg,
  HK_STATUS, StatusBadge, ChipBar, statusChips,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge,
} from "../components/hotelUi";

export default function Housekeeping() {
  const { showToast } = useToast();
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    hotelService.listHotels()
      .then((h) => { if (alive) { setHotels(h); if (h.length) setHotelId(h[0].id); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load hotels."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  useEffect(() => {
    if (!hotelId) return;
    let alive = true;
    setLoading(true);
    hotelService.housekeeping(hotelId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && showToast(errMsg(e, "Failed to load housekeeping."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [hotelId, showToast]);

  const rows = data?.rows || [];
  const filtered = useMemo(() => rows.filter((r) => !status || r.status === status), [rows, status]);

  return (
    <PageShell>
      <PageHeader title="Housekeeping" subtitle="Live room cleaning status" icon={BrushCleaning}>
        <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}
          className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50">
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </PageHeader>

      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.keys(HK_STATUS).map((k) => {
            const n = rows.filter((r) => r.status === k).length;
            return (
              <GlassCard key={k} className="p-4">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", HK_STATUS[k].dot)} />
                  <p className="text-2xl font-extrabold text-slate-800">{n}</p>
                </div>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{HK_STATUS[k].label}</p>
              </GlassCard>
            );
          })}
        </div>
      )}

      <GlassCard className="mb-5 p-4">
        <ChipBar options={statusChips(HK_STATUS)} value={status} onChange={setStatus} />
      </GlassCard>

      {loading || !data ? (
        <GlassCard><LoadingState label="Loading housekeeping…" /></GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard><EmptyState icon={DoorClosed} title="No rooms match this filter" /></GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room Number</TableHead>
                <TableHead>Room Type</TableHead>
                <TableHead>Cleaning Status</TableHead>
                <TableHead>Housekeeper</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-bold text-slate-700">Room {r.roomNo}</TableCell>
                  <TableCell>{r.roomType}</TableCell>
                  <TableCell><StatusBadge config={HK_STATUS} value={r.status} /></TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-700">{r.housekeeper[0]}</span>
                      <span className="text-slate-600">{r.housekeeper}</span>
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="slate">{r.eta}</Badge></TableCell>
                  <TableCell>
                    <button className="text-xs font-bold text-blue-600 hover:underline">Mark Ready</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </PageShell>
  );
}
