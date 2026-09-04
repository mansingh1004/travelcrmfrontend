// Lifecycle and plan splits, as stacked meters. No chart library — a div and a width.
//
// Plans with nobody on them are filtered out: the backend maps over every Plan row, so an unused
// tier rendered as a 0 · 0% bar taking a slot from a real one.
import { Distribution, PLAN_COLORS, STATUS_COLORS } from "../../components/consoleCharts";

export default function DistributionWidget({ data, opts }) {
  const analytics = data?.analytics;
  const byStatus = opts?.series === "status";

  const rows = byStatus
    ? (analytics?.tenantsByStatus ?? [])
    : (analytics?.tenantsByPlan ?? []).filter((r) => Number(r.value || 0) > 0);
  const total = rows.reduce((sum, r) => sum + Number(r.value || 0), 0);

  return (
    <Distribution
      rows={rows}
      total={total}
      colorFor={byStatus
        ? (row) => STATUS_COLORS[row.label] || "#64748b"
        : (_, index) => PLAN_COLORS[index % PLAN_COLORS.length]}
      emptyLabel={byStatus ? "No tenant lifecycle data yet." : "No tenant is on a plan yet."}
    />
  );
}
