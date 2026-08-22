import { Info } from "lucide-react";
import Tabs from "@shared/ui/Tabs";
import { STATUS_TABS } from "../lib/hotelOperationModel";

export default function HotelOperationFilters({ status, onStatus, approvalCount, loading }) {
  const tabs = STATUS_TABS.map((tab) => ({
    ...tab,
    count: tab.key === "TENANT_APPROVAL_REQUIRED" ? approvalCount : undefined,
  }));

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Platform hotel bookings</h2>
          <p className="mt-0.5 text-xs text-slate-500">Status is filtered across the full tenant dataset on the server.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
          <Info className="h-3 w-3" aria-hidden="true" /> Platform hotels only
        </span>
      </div>

      <Tabs
        tabs={tabs}
        activeKey={status}
        loadingKey={loading ? status : undefined}
        onChange={onStatus}
        tone="blue"
        label="Filter platform hotel bookings by status"
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />
    </section>
  );
}
