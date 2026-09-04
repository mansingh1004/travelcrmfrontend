// src/console/components/consoleCharts.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The console's charting, lifted out of ConsoleHome so more than one dashboard
// can use it.
//
// `useChartTheme`, `Bars` and `Distribution` were private to ConsoleHome.jsx,
// which meant the only way to put a chart on a second dashboard was to copy them
// — and the console already carries three near-duplicate metric tiles from
// exactly that habit.
//
// NOT the same thing as `hotelCharts.jsx` in this folder. That file is dead code
// in the console (nothing imports it) and is hardcoded to the TENANT palette,
// including `#2563eb` — the one colour that must never appear here. Anything
// added to this file must read its colours from the console tokens or from
// `useChartTheme`, so dark mode and a rebranded accent both keep working.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { useConsoleTheme } from "../theme/ConsoleThemeProvider";
import { ConsolePanel } from "./ConsoleUi";

const number = (value) => Number(value || 0).toLocaleString("en-IN");

/**
 * Recharts renders to SVG, so it cannot read the CSS token layer — every colour
 * has to be handed to it as a value. This is the one place that translation
 * happens, and it is why a chart added anywhere else must come through here or it
 * will simply not flip in dark mode.
 */
export function useChartTheme() {
  const { isDark } = useConsoleTheme();
  return {
    axis: isDark ? "#7b749f" : "#948eb0",
    tooltip: {
      background: isDark ? "#1b1836" : "#ffffff",
      border: `1px solid ${isDark ? "#3a3560" : "#e7e5f2"}`,
      borderRadius: 10,
      color: isDark ? "#f3f1ff" : "#17143a",
      fontSize: 12,
      boxShadow: "0 12px 32px -14px rgb(30 27 75 / 0.4)",
    },
    tooltipItem: { color: isDark ? "#f3f1ff" : "#17143a" },
    tooltipLabel: { color: isDark ? "#b4aed6" : "#514c70", fontWeight: 600 },
  };
}

/** Lifecycle / portfolio split as stacked meters. No chart library — it is a div and a width. */
export function Distribution({ rows, total, colorFor, emptyLabel = "No portfolio data yet." }) {
  if (!rows?.length || total <= 0) {
    return <div className="px-5 py-10 text-center text-sm text-muted">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-3 px-5 py-4">
      {rows.map((row, index) => {
        const percent = Math.round((Number(row.value || 0) / total) * 100);
        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-body">{row.label}</span>
              <span className="font-mono text-muted">{number(row.value)} · {percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(percent, 2)}%`, background: colorFor(row, index) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A 12-bucket bar series in a ConsolePanel. `id` must be unique per mounted chart — it keys the gradient def. */
export function Bars({ title, description, data, id, from, to, tickFormatter, tooltipFormatter }) {
  const theme = useChartTheme();
  return (
    <ConsolePanel title={title} description={description}>
      <div className="h-72 px-3 pb-4 pt-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={from} stopOpacity={0.95} />
                <stop offset="100%" stopColor={to} stopOpacity={0.88} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.axis} strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={{ stroke: theme.axis, strokeOpacity: 0.3 }} tickLine={false} />
            <YAxis tick={{ fill: theme.axis, fontSize: 11 }} axisLine={false} tickLine={false}
              width={tickFormatter ? 52 : 32} tickFormatter={tickFormatter} allowDecimals={false} />
            <Tooltip contentStyle={theme.tooltip} itemStyle={theme.tooltipItem} labelStyle={theme.tooltipLabel}
              cursor={{ fill: theme.axis, fillOpacity: 0.1 }}
              formatter={(value) => (tooltipFormatter ? tooltipFormatter(value) : value)} />
            <Bar dataKey="value" fill={`url(#${id})`} radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ConsolePanel>
  );
}

/**
 * Tenant lifecycle colours.
 *
 * PAST_DUE is orange and SUSPENDED is red on purpose — one is a tenant still
 * working while money is chased, the other is a tenant locked out. Amber is left
 * to TRIAL. Same reading as the `hue-orange` token's own note.
 */
export const STATUS_COLORS = {
  ACTIVE: "#10b981",
  TRIAL: "#f59e0b",
  PAST_DUE: "#f97316",
  SUSPENDED: "#ef4444",
  EXPIRED: "#64748b",
  INACTIVE: "#94a3b8",
};

/** Positional, because plan names are tenant-defined and cannot be mapped by identity. */
export const PLAN_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#db2777"];
