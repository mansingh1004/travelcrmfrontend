// import { useCallback, useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   Landmark, Wallet, Receipt, TrendingUp, FileText, Percent, Download, RefreshCw, ArrowUpRight,
// } from "lucide-react";
// import {
//   ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
// } from "recharts";
// import { useToast } from "@shared/ui/toast";
// import { isAlreadyReported, getErrorMessage } from "@shared/api/apiError";
// import { downloadBlob, hydrateBlobError } from "@shared/lib/download";
// import { Page, Hero, Panel, PanelHead, Badge, Btn, Pills, Loading, EmptyBlock } from "../components/accountingUi";
// import accountingService from "../api/accountingService";
// import { inr, inrShort, pct } from "../lib/format";
// import { RANGE_PRESETS, resolveRange } from "../lib/dateRange";

// const DONUT = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

// function ChartTip({ active, payload, label }) {
//   if (!active || !payload?.length) return null;
//   return (
//     <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
//       <p className="mb-1 font-bold text-slate-700">{label}</p>
//       {payload.map((p) => (
//         <p key={p.name} className="flex items-center gap-2 font-semibold capitalize" style={{ color: p.color || p.fill }}>
//           {p.name}: {inr(p.value)}
//         </p>
//       ))}
//     </div>
//   );
// }

// export default function AccountingDashboard() {
//   const { showToast } = useToast();
//   const navigate = useNavigate();
//   const [preset, setPreset] = useState("this-month");
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await accountingService.getDashboard(resolveRange(preset));
//       setData(res?.data?.data ?? res?.data ?? null);
//     } catch (e) {
//       if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load the dashboard."), "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [preset, showToast]);

//   useEffect(() => { load(); }, [load]);

//   const onExport = async () => {
//     try {
//       const res = await accountingService.exportLedger({ ...resolveRange(preset), format: "CSV" });
//       downloadBlob(res.data, `ledger-${preset}.csv`);
//       showToast("Ledger exported.", "success");
//     } catch (e) {
//       await hydrateBlobError(e);
//       if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Export failed."), "error");
//     }
//   };

//   const taxDonut = data ? [
//     { name: "Output GST", value: Number(data.outputGst || 0) },
//     { name: "Input Credit", value: Number(data.inputGstCredit || 0) },
//     { name: "TCS", value: Number(data.tcsCollected || 0) },
//     { name: "TDS", value: Number(data.tdsDeducted || 0) },
//   ].filter((d) => d.value > 0) : [];

//   return (
//     <Page icon={Landmark} title="Accounts Dashboard" crumb="Dashboard" subtitle="Overview of your business finances"
//       actions={<>
//         <Pills options={RANGE_PRESETS} value={preset} onChange={setPreset} />
//         <Btn variant="outline" size="sm" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Btn>
//         <Btn variant="primary" size="sm" onClick={onExport}><Download className="w-4 h-4" /> Export</Btn>
//       </>}>

//       {loading ? (
//         <Panel><Loading label="Loading dashboard…" /></Panel>
//       ) : !data ? (
//         <Panel><EmptyBlock icon={Landmark} title="No accounting data yet" hint="Issue an invoice or raise a vendor bill to see figures here." /></Panel>
//       ) : (
//         <>
//           {/* KPI hero cards */}
//           <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
//             <Hero label="Total Revenue" value={data.totalRevenue} money gradient="from-emerald-500 to-green-600" icon={<TrendingUp className="w-5 h-5" />} delay={0} />
//             <Hero label="Receivable" value={data.outstandingReceivable} money gradient="from-blue-500 to-indigo-600" icon={<Wallet className="w-5 h-5" />} delay={50} />
//             <Hero label="Payable" value={data.outstandingPayable} money gradient="from-amber-500 to-orange-500" icon={<FileText className="w-5 h-5" />} delay={100} />
//             <Hero label="Gross Margin" value={data.grossMargin} money sub={pct(data.grossMarginPct)} gradient="from-violet-500 to-purple-600" icon={<Percent className="w-5 h-5" />} delay={150} />
//             <Hero label="Net GST Payable" value={data.netGstPayable} money gradient="from-rose-500 to-red-600" icon={<Receipt className="w-5 h-5" />} delay={200} />
//             <Hero label="TCS Collected" value={data.tcsCollected} money gradient="from-teal-500 to-cyan-600" icon={<Landmark className="w-5 h-5" />} delay={250} />
//           </div>

//           {/* Trend + tax snapshot */}
//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
//             <Panel className="p-5 lg:col-span-2">
//               <div className="mb-3 flex items-center justify-between">
//                 <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Revenue vs Expenses</h3>
//                 <Badge tone="slate">{data.from} – {data.to}</Badge>
//               </div>
//               {data.revenueVsExpenses?.length ? (
//                 <ResponsiveContainer width="100%" height={250}>
//                   <AreaChart data={data.revenueVsExpenses} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
//                     <defs>
//                       <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
//                       <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
//                     <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: "#64748b" }} axisLine={false} tickLine={false} />
//                     <YAxis tickFormatter={inrShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={54} />
//                     <Tooltip content={<ChartTip />} />
//                     <Area type="monotone" dataKey="revenue" name="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revG)" />
//                     <Area type="monotone" dataKey="expenses" name="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expG)" />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               ) : <EmptyBlock title="No trend yet" hint="Data appears once invoices and bills exist in this period." />}
//             </Panel>

//             <Panel className="p-5">
//               <h3 className="mb-2 text-sm font-extrabold text-slate-700 flex items-center gap-2"><Receipt className="w-4 h-4 text-blue-500" /> Tax Snapshot</h3>
//               {taxDonut.length ? (
//                 <>
//                   <ResponsiveContainer width="100%" height={190}>
//                     <PieChart>
//                       <Pie data={taxDonut} cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value">
//                         {taxDonut.map((e, i) => <Cell key={e.name} fill={DONUT[i % DONUT.length]} />)}
//                       </Pie>
//                       <Tooltip formatter={(v, n) => [inr(v), n]} />
//                     </PieChart>
//                   </ResponsiveContainer>
//                   <div className="mt-2 space-y-1.5">
//                     {taxDonut.map((e, i) => (
//                       <div key={e.name} className="flex items-center justify-between text-xs">
//                         <span className="flex items-center gap-2 font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />{e.name}</span>
//                         <span className="font-bold text-slate-800">{inr(e.value)}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </>
//               ) : <EmptyBlock title="No tax yet" hint="Issue a GST invoice to populate this." />}
//             </Panel>
//           </div>

//           {/* Recent strips */}
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//             <RecentCard title="Recent Invoices" rows={data.recentInvoices} onView={() => navigate("/accounting/invoices")}
//               primary="invoiceNumber" secondary="recipientName" money="invoiceTotal" />
//             <RecentCard title="Recent Vendor Bills" rows={data.recentVendorBills} onView={() => navigate("/accounting/vendor-bills")}
//               primary="vendorName" secondary="billNumber" money="netPayable" />
//           </div>
//         </>
//       )}
//     </Page>
//   );
// }

// function statusTone(s) {
//   return s === "PAID" || s === "ISSUED" ? "green" : s === "CANCELLED" ? "red" : "amber";
// }

// function RecentCard({ title, rows, primary, secondary, money, onView }) {
//   return (
//     <Panel className="overflow-hidden">
//       <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
//         <h3 className="text-sm font-extrabold text-slate-700">{title}</h3>
//         <button onClick={onView} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline">
//           View all <ArrowUpRight className="h-3.5 w-3.5" />
//         </button>
//       </div>
//       {rows?.length ? (
//         <div className="divide-y divide-slate-50">
//           {rows.map((r, i) => (
//             <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
//               <div className="min-w-0">
//                 <p className="truncate font-bold text-slate-800">{r[primary] || "—"}</p>
//                 <p className="truncate text-xs text-slate-400">{r[secondary] || "—"}</p>
//               </div>
//               <div className="text-right flex flex-col items-end gap-1">
//                 <p className="font-bold text-slate-800">{inr(r[money])}</p>
//                 <Badge tone={statusTone(r.status)}>{r.status}</Badge>
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : <EmptyBlock title="Nothing yet" />}
//     </Panel>
//   );
// }









import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Landmark, Wallet, Receipt, TrendingUp, FileText, Percent, Download, RefreshCw, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import { useToast } from "@shared/ui/toast";
import { isAlreadyReported, getErrorMessage } from "@shared/api/apiError";
import { downloadBlob, hydrateBlobError } from "@shared/lib/download";
import { Page, Hero, Panel, PanelHead, Badge, Btn, Pills, Loading, EmptyBlock } from "../components/accountingUi";
import accountingService from "../api/accountingService";
import { inr, inrShort, pct } from "../lib/format";
import { RANGE_PRESETS, resolveRange } from "../lib/dateRange";

const DONUT = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-bold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 font-semibold capitalize" style={{ color: p.color || p.fill }}>
          {p.name}: {inr(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function AccountingDashboard() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [preset, setPreset] = useState("this-month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingService.getDashboard(resolveRange(preset));
      setData(res?.data?.data ?? res?.data ?? null);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load the dashboard."), "error");
    } finally {
      setLoading(false);
    }
  }, [preset, showToast]);

  useEffect(() => { load(); }, [load]);

  const onExport = async () => {
    try {
      const res = await accountingService.exportLedger({ ...resolveRange(preset), format: "CSV" });
      downloadBlob(res.data, `ledger-${preset}.csv`);
      showToast("Ledger exported.", "success");
    } catch (e) {
      await hydrateBlobError(e);
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Export failed."), "error");
    }
  };

  const taxDonut = data ? [
    { name: "Output GST", value: Number(data.outputGst || 0) },
    { name: "Input Credit", value: Number(data.inputGstCredit || 0) },
    { name: "TCS", value: Number(data.tcsCollected || 0) },
    { name: "TDS", value: Number(data.tdsDeducted || 0) },
  ].filter((d) => d.value > 0) : [];

  return (
    <Page icon={Landmark} title="Accounts Dashboard" crumb="Dashboard" subtitle="Overview of your business finances"
      actions={
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full mt-3 sm:mt-0 sm:w-auto">
          <div className="flex-1 sm:flex-none overflow-x-auto pb-1 sm:pb-0">
            <Pills options={RANGE_PRESETS} value={preset} onChange={setPreset} />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Btn variant="outline" size="sm" onClick={load}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 
              <span className="hidden sm:inline">Refresh</span>
            </Btn>
            <Btn variant="primary" size="sm" onClick={onExport}>
              <Download className="w-4 h-4" /> 
              <span className="hidden sm:inline">Export</span>
            </Btn>
          </div>
        </div>
      }>

      {loading ? (
        <Panel><Loading label="Loading dashboard…" /></Panel>
      ) : !data ? (
        <Panel><EmptyBlock icon={Landmark} title="No accounting data yet" hint="Issue an invoice or raise a vendor bill to see figures here." /></Panel>
      ) : (
        <div className="space-y-4">
          {/* KPI hero cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
            <Hero label="Total Revenue" value={data.totalRevenue} money gradient="from-emerald-500 to-green-600" icon={<TrendingUp className="w-5 h-5" />} delay={0} />
            <Hero label="Receivable" value={data.outstandingReceivable} money gradient="from-blue-500 to-indigo-600" icon={<Wallet className="w-5 h-5" />} delay={50} />
            <Hero label="Payable" value={data.outstandingPayable} money gradient="from-amber-500 to-orange-500" icon={<FileText className="w-5 h-5" />} delay={100} />
            <Hero label="Gross Margin" value={data.grossMargin} money sub={pct(data.grossMarginPct)} gradient="from-violet-500 to-purple-600" icon={<Percent className="w-5 h-5" />} delay={150} />
            <Hero label="Net GST Payable" value={data.netGstPayable} money gradient="from-rose-500 to-red-600" icon={<Receipt className="w-5 h-5" />} delay={200} />
            <Hero label="TCS Collected" value={data.tcsCollected} money gradient="from-teal-500 to-cyan-600" icon={<Landmark className="w-5 h-5" />} delay={250} />
          </div>

          {/* Trend + tax snapshot */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
            <Panel className="p-4 sm:p-5 xl:col-span-2 overflow-hidden">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Revenue vs Expenses</h3>
                <Badge tone="slate" className="w-fit">{data.from} – {data.to}</Badge>
              </div>
              {data.revenueVsExpenses?.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={data.revenueVsExpenses} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={inrShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="revenue" name="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revG)" />
                    <Area type="monotone" dataKey="expenses" name="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expG)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyBlock title="No trend yet" hint="Data appears once invoices and bills exist in this period." />}
            </Panel>

            <Panel className="p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-extrabold text-slate-700 flex items-center gap-2"><Receipt className="w-4 h-4 text-blue-500" /> Tax Snapshot</h3>
              {taxDonut.length ? (
                <>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={taxDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                        {taxDonut.map((e, i) => <Cell key={e.name} fill={DONUT[i % DONUT.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [inr(v), n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {taxDonut.map((e, i) => (
                      <div key={e.name} className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="flex items-center gap-2 font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: DONUT[i % DONUT.length] }} />{e.name}</span>
                        <span className="font-bold text-slate-800">{inr(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <EmptyBlock title="No tax yet" hint="Issue a GST invoice to populate this." />}
            </Panel>
          </div>

          {/* Recent strips */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <RecentCard title="Recent Invoices" rows={data.recentInvoices} onView={() => navigate("/accounting/invoices")}
              primary="invoiceNumber" secondary="recipientName" money="invoiceTotal" />
            <RecentCard title="Recent Vendor Bills" rows={data.recentVendorBills} onView={() => navigate("/accounting/vendor-bills")}
              primary="vendorName" secondary="billNumber" money="netPayable" />
          </div>
        </div>
      )}
    </Page>
  );
}

function statusTone(s) {
  return s === "PAID" || s === "ISSUED" ? "green" : s === "CANCELLED" ? "red" : "amber";
}

function RecentCard({ title, rows, primary, secondary, money, onView }) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-5 py-3 sm:py-3.5">
        <h3 className="text-sm font-extrabold text-slate-700">{title}</h3>
        <button onClick={onView} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline">
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {rows?.length ? (
        <div className="divide-y divide-slate-50">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3 text-xs sm:text-sm">
              <div className="min-w-0 pr-3">
                <p className="truncate font-bold text-slate-800">{r[primary] || "—"}</p>
                <p className="truncate text-slate-400 mt-0.5">{r[secondary] || "—"}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                <p className="font-bold text-slate-800">{inr(r[money])}</p>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyBlock title="Nothing yet" />}
    </Panel>
  );
}