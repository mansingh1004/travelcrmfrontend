// src/features/hotels/pages/HotelReports.jsx
// Analytics — revenue, occupancy, ADR/RevPAR, source & city breakdowns.
import { useEffect, useState } from "react";
import { BarChart3, IndianRupee, Gauge, TrendingUp, MapPin, Radio, Download } from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, PageHeader, SectionCard, Button, StatStrip,
  LoadingState, useToast, errMsg, fmtMoneyShort, fmtMoney, fmtNumber,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "../components/hotelUi";
import { RevenueArea, BarSeries, TrendLine, DualTrend, SourcePie } from "../components/hotelCharts";

export default function HotelReports() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    hotelService.reports()
      .then((d) => alive && setData(d))
      .catch((e) => alive && showToast(errMsg(e, "Failed to load reports."), "error"));
    return () => { alive = false; };
  }, [showToast]);

  if (!data) return <PageShell><LoadingState label="Loading reports…" /></PageShell>;

  const totalRevenue = data.monthly.reduce((s, m) => s + m.revenue, 0);
  const totalBookings = data.monthly.reduce((s, m) => s + m.bookings, 0);
  const avgOcc = Math.round(data.monthly.reduce((s, m) => s + m.occupancy, 0) / data.monthly.length);
  const avgAdr = Math.round(data.monthly.reduce((s, m) => s + m.adr, 0) / data.monthly.length);
  const avgRevpar = Math.round(data.monthly.reduce((s, m) => s + m.revpar, 0) / data.monthly.length);

  const stats = [
    { key: "rev", label: "Total Revenue", value: fmtMoneyShort(totalRevenue), icon: IndianRupee, tone: "text-emerald-500", accent: "bg-emerald-50" },
    { key: "bk", label: "Total Bookings", value: fmtNumber(totalBookings), icon: TrendingUp, tone: "text-blue-500", accent: "bg-blue-50" },
    { key: "oc", label: "Avg Occupancy", value: `${avgOcc}%`, icon: Gauge, tone: "text-amber-500", accent: "bg-amber-50" },
    { key: "adr", label: "Avg ADR", value: fmtMoney(avgAdr), icon: IndianRupee, tone: "text-indigo-500", accent: "bg-indigo-50" },
    { key: "rp", label: "Avg RevPAR", value: fmtMoney(avgRevpar), icon: IndianRupee, tone: "text-purple-500", accent: "bg-purple-50" },
  ];

  return (
    <PageShell>
      <PageHeader title="Reports" subtitle="Revenue & performance analytics" icon={BarChart3}>
        <Button variant="outline" size="sm" onClick={() => showToast("Report exported.", "success")}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </PageHeader>

      <StatStrip items={stats} className="mb-6" />

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Monthly Revenue" icon={IndianRupee}>
          <RevenueArea data={data.monthly} fmt={(v) => fmtMoneyShort(v)} />
        </SectionCard>
        <SectionCard title="Bookings by Month" icon={TrendingUp}>
          <BarSeries data={data.monthly} dataKey="bookings" name="Bookings" fmt={(v) => fmtNumber(v)} color="#0ea5e9" />
        </SectionCard>
        <SectionCard title="Occupancy Trend" icon={Gauge}>
          <TrendLine data={data.monthly} dataKey="occupancy" name="Occupancy %" fmt={(v) => `${v}%`} />
        </SectionCard>
        <SectionCard title="ADR & RevPAR" subtitle="Average Daily Rate vs RevPAR" icon={IndianRupee}>
          <DualTrend data={data.monthly} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Booking Sources" subtitle="Channel distribution" icon={Radio}>
          <SourcePie data={data.bySource} />
        </SectionCard>
        <SectionCard title="Revenue by City" icon={MapPin} bodyClass="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>City</TableHead><TableHead>Revenue</TableHead><TableHead>Share</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[...data.byCity].sort((a, b) => b.revenue - a.revenue).map((c) => {
                const total = data.byCity.reduce((s, x) => s + x.revenue, 0);
                const pct = Math.round((c.revenue / total) * 100);
                return (
                  <TableRow key={c.city}>
                    <TableCell className="font-bold text-slate-700">{c.city}</TableCell>
                    <TableCell>{fmtMoneyShort(c.revenue)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-500">{pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </PageShell>
  );
}
