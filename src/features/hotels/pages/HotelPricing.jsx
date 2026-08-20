// src/features/hotels/pages/HotelPricing.jsx
// Rate management — weekday / weekend / peak pricing per room type, editable inline.
import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Search, Save, TrendingUp } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, GlassCard, Input, Button, cn,
  EmptyState, useToast, errMsg, SkeletonCards, StatStrip,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, fmtMoney,
} from "../components/hotelUi";

export default function HotelPricing() {
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState("");
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all([hotelService.allRoomTypes(), hotelService.listHotels()])
      .then(([r, h]) => { if (alive) { setRows(r); setHotels(h); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load pricing."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  const filtered = useMemo(() => {
    const list = rows || [];
    const needle = q.trim().toLowerCase();
    return list.filter((r) =>
      (!hotelId || r.hotelId === hotelId) &&
      (!needle || [r.name, r.hotelName].some((f) => f?.toLowerCase().includes(needle)))
    );
  }, [rows, q, hotelId]);

  const setEdit = (key, field, value) =>
    setEdits((e) => ({ ...e, [key]: { ...e[key], [field]: value } }));
  const valueOf = (r, field) => edits[`${r.hotelId}-${r.id}`]?.[field] ?? r[field];

  const dirty = Object.keys(edits).length > 0;
  const save = () => {
    // In production this posts `edits` to the pricing API. Mock: confirm + clear.
    showToast("Pricing updated successfully.", "success");
    setEdits({});
  };

  const stats = useMemo(() => {
    const list = rows || [];
    if (!list.length) return [];
    const avg = (f) => Math.round(list.reduce((s, r) => s + r[f], 0) / list.length);
    return [
      { key: "wd", label: "Avg Weekday", value: fmtMoney(avg("weekday")), tone: "text-blue-500", accent: "bg-blue-50" },
      { key: "we", label: "Avg Weekend", value: fmtMoney(avg("weekend")), tone: "text-amber-500", accent: "bg-amber-50" },
      { key: "pk", label: "Avg Peak", value: fmtMoney(avg("peak")), tone: "text-red-500", accent: "bg-red-50" },
      { key: "rt", label: "Room Types", value: list.length, tone: "text-teal-500", accent: "bg-teal-50" },
    ];
  }, [rows]);

  return (
    <PageShell>
      <PageHeader title="Pricing" subtitle="Seasonal rate plans per room type" icon={IndianRupee}>
        <Button size="sm" disabled={!dirty} onClick={save}><Save className="h-4 w-4" /> Save Changes</Button>
      </PageHeader>

      {rows && <StatStrip items={stats} className="mb-5" />}

      <GlassCard className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search room or hotel…" className="pl-9" />
          </div>
          <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}
            className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50">
            <option value="">All Hotels</option>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      </GlassCard>

      {!rows ? (
        <SkeletonCards count={4} />
      ) : filtered.length === 0 ? (
        <GlassCard><EmptyState icon={IndianRupee} title="No room types found" /></GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room / Hotel</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Weekday</TableHead>
                <TableHead>Weekend</TableHead>
                <TableHead>Peak Season</TableHead>
                <TableHead>Extra Adult</TableHead>
                <TableHead>Extra Child</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const key = `${r.hotelId}-${r.id}`;
                const rowDirty = !!edits[key];
                return (
                  <TableRow key={key} className={cn(rowDirty && "bg-blue-50/40")}>
                    <TableCell>
                      <p className="font-bold text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.hotelName}</p>
                    </TableCell>
                    <TableCell className="font-bold text-slate-700">{fmtMoney(r.basePrice)}</TableCell>
                    <TableCell><RateInput value={valueOf(r, "weekday")} onChange={(v) => setEdit(key, "weekday", v)} /></TableCell>
                    <TableCell><RateInput value={valueOf(r, "weekend")} onChange={(v) => setEdit(key, "weekend", v)} /></TableCell>
                    <TableCell><RateInput value={valueOf(r, "peak")} onChange={(v) => setEdit(key, "peak", v)} /></TableCell>
                    <TableCell>{fmtMoney(r.extraAdult)}</TableCell>
                    <TableCell>{fmtMoney(r.extraChild)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {dirty && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-blue-50/40 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                <TrendingUp className="h-4 w-4" /> {Object.keys(edits).length} room type(s) changed
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEdits({})}>Discard</Button>
                <Button size="sm" onClick={save}><Save className="h-4 w-4" /> Save</Button>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </PageShell>
  );
}

function RateInput({ value, onChange }) {
  return (
    <div className="relative w-28">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm font-semibold text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
    </div>
  );
}
