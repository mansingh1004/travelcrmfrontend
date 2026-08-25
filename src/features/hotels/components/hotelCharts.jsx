// src/features/hotels/components/hotelCharts.jsx
// Recharts wrappers themed to the app (blue-600 family, soft grid, rounded tips).
// Kept dependency-light: only the chart types the module actually uses.

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export const CHART_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"];

const axisProps = {
  tick: { fontSize: 11, fill: "#94a3b8", fontWeight: 600 },
  axisLine: false,
  tickLine: false,
};

function TipBox({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      {label != null && <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-extrabold">{fmt ? fmt(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueArea({ data, height = 260, fmt }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="hrev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={44} tickFormatter={fmt} />
        <Tooltip content={<TipBox fmt={fmt} />} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#hrev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({ data, dataKey = "revenue", name = "Revenue", height = 260, fmt, color = "#2563eb" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={44} tickFormatter={fmt} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TipBox fmt={fmt} />} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[6, 6, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, dataKey = "occupancy", name = "Occupancy", height = 260, fmt, color = "#14b8a6" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} tickFormatter={fmt} />
        <Tooltip content={<TipBox fmt={fmt} />} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DualTrend({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<TipBox />} />
        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
        <Line type="monotone" dataKey="adr" name="ADR" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="revpar" name="RevPAR" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SourcePie({ data, dataKey = "value", nameKey = "source", height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" innerRadius={54} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip content={<TipBox />} />
        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
