// The two monthly series, rendered inside the widget frame rather than in their own panel — Bars
// brings its own ConsolePanel, so this uses the chart directly and lets WidgetFrame own the shell.
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { useChartTheme } from "../../components/consoleCharts";

const money = (currency) => (value) => {
  const symbol = currency === "INR" ? "₹" : currency ? `${currency} ` : "";
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000000) return `${symbol}${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `${symbol}${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `${symbol}${Math.round(n / 1000)}k`;
  return `${symbol}${n}`;
};

export default function SeriesWidget({ data, opts }) {
  const theme = useChartTheme();
  const analytics = data?.analytics;
  const isRevenue = opts?.series === "revenue";
  const currency = analytics?.currency || "INR";

  const rows = isRevenue
    ? (analytics?.revenueByMonth ?? []).map((r) => ({ label: r.month, value: r.amount }))
    : (analytics?.newTenantsByMonth ?? []);

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted">No history yet.</p>;
  }

  // The gradient id must be unique per mounted chart — two charts sharing one id means the second
  // silently paints with the first one's fill.
  const gradientId = `wgrad-${opts?.series ?? "series"}`;

  return (
    <div className="h-60 px-3 pb-4 pt-5">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isRevenue ? "#34d399" : "#a855f7"} stopOpacity={0.95} />
              <stop offset="100%" stopColor={isRevenue ? "#059669" : "#7c3aed"} stopOpacity={0.88} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.axis} strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: theme.axis, fontSize: 11 }}
            axisLine={{ stroke: theme.axis, strokeOpacity: 0.3 }} tickLine={false} />
          <YAxis tick={{ fill: theme.axis, fontSize: 11 }} axisLine={false} tickLine={false}
            width={isRevenue ? 52 : 32} tickFormatter={isRevenue ? money(currency) : undefined}
            allowDecimals={false} />
          <Tooltip contentStyle={theme.tooltip} itemStyle={theme.tooltipItem} labelStyle={theme.tooltipLabel}
            cursor={{ fill: theme.axis, fillOpacity: 0.1 }} />
          <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
