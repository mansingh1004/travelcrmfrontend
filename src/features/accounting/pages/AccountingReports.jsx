// import { useCallback, useEffect, useState } from "react";
// import { BarChart3, Download, RefreshCw, FileSpreadsheet, Receipt, ChevronDown,
//   ChevronUp, } from "lucide-react";
// import { useToast } from "@shared/ui/toast";
// import { isAlreadyReported, getErrorMessage } from "@shared/api/apiError";
// import { downloadBlob, hydrateBlobError } from "@shared/lib/download";
// import {
//   Page, Hero, Panel, PanelHead, Badge, Btn, Pills, Loading, EmptyBlock,
//   theadCls, Th, EmptyRow,
// } from "../components/accountingUi";
// import accountingService from "../api/accountingService";
// import { RANGE_PRESETS, resolveRange } from "../lib/dateRange";
// import { inr, pct, fmtDate } from "../lib/format";

// const TABS = [{ value: "pnl", label: "Profit & Loss" }, { value: "gst", label: "GST Summary" }];

// export default function AccountingReports() {
//   const { showToast } = useToast();
//   const [tab, setTab] = useState("pnl");
//   const [preset, setPreset] = useState("this-fy");
//   const [pnl, setPnl] = useState(null);
//   const [gst, setGst] = useState(null);
//   const [loading, setLoading] = useState(true);

//   const [reportStatsOpen, setReportStatsOpen] = useState(false);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const range = resolveRange(preset);
//       const [pnlRes, gstRes] = await Promise.all([accountingService.getPnl(range), accountingService.getGstSummary(range)]);
//       setPnl(pnlRes?.data?.data ?? null);
//       setGst(gstRes?.data?.data ?? null);
//     } catch (e) {
//       if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load reports."), "error");
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

//   return (
//     <Page icon={BarChart3} title="Accounting Reports" crumb="Reports" subtitle="Tax-aware P&L and a GSTR-style output summary"
//       actions={<>
//         <Pills options={RANGE_PRESETS} value={preset} onChange={setPreset} />
//         <Btn variant="outline" size="sm" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Btn>
//         <Btn variant="primary" size="sm" onClick={onExport}><Download className="w-4 h-4" /> Export CSV</Btn>
//       </>}>

//       <Pills options={TABS} value={tab} onChange={setTab} />

//       {loading ? (
//   <Panel>
//     <Loading label="Loading reports…" />
//   </Panel>
// ) : tab === "pnl" ? (
//   <PnlView
//     data={pnl}
//     statsOpen={reportStatsOpen}
//     setStatsOpen={setReportStatsOpen}
//   />
// ) : (
//   <GstView
//     data={gst}
//     statsOpen={reportStatsOpen}
//     setStatsOpen={setReportStatsOpen}
//   />
// )}
//     </Page>
//   );
// }

// function PnlView({ data, statsOpen, setStatsOpen }) {
//   if (!data) return <Panel><EmptyBlock icon={BarChart3} title="No P&L data" hint="Issue invoices and raise bills to populate the P&L." /></Panel>;
//   return (
//     <>
//       {/* <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
//         <Hero label="Taxable Revenue" value={data.taxableRevenue} money gradient="from-emerald-500 to-green-600" icon={<BarChart3 className="w-5 h-5" />} delay={0} />
//         <Hero label="Vendor Cost (net)" value={data.vendorCostNet} money gradient="from-amber-500 to-orange-500" icon={<FileSpreadsheet className="w-5 h-5" />} delay={50} />
//         <Hero label="Gross Margin" value={data.grossMargin} money sub={pct(data.grossMarginPct)} gradient="from-violet-500 to-purple-600" icon={<BarChart3 className="w-5 h-5" />} delay={100} />
//         <Hero label="Net GST Payable" value={data.netGstPayable} money gradient="from-rose-500 to-red-600" icon={<Receipt className="w-5 h-5" />} delay={150} />
//         <Hero label="TCS Collected" value={data.tcsCollected} money gradient="from-teal-500 to-cyan-600" icon={<Receipt className="w-5 h-5" />} delay={200} />
//         <Hero label="TDS Deducted" value={data.tdsDeducted} money gradient="from-blue-500 to-indigo-600" icon={<Receipt className="w-5 h-5" />} delay={250} />
//       </div> */}

//       {/* ── COLLAPSIBLE P&L ANALYTICS ── */}
// <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

//   {/* Toggle header */}
//   <button
//     type="button"
//     onClick={() => setStatsOpen((previous) => !previous)}
//     aria-expanded={statsOpen}
//     className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
//   >
//     <div className="flex items-center gap-3 flex-wrap min-w-0">
//       <div className="flex items-center gap-2">
//         <BarChart3 className="w-4 h-4 text-emerald-600" />

//         <span className="text-sm font-extrabold text-slate-700">
//           Profit & Loss Analytics
//         </span>
//       </div>

//       {/* Compact values displayed while closed */}
//       {!statsOpen && (
//         <div className="flex items-center gap-2 flex-wrap">
//           <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
//             Revenue {inr(data.taxableRevenue)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
//             Cost {inr(data.vendorCostNet)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
//             Margin {inr(data.grossMargin)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
//             GST {inr(data.netGstPayable)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
//             TCS {inr(data.tcsCollected)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
//             TDS {inr(data.tdsDeducted)}
//           </span>
//         </div>
//       )}
//     </div>

//     <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
//       {statsOpen ? (
//         <ChevronUp className="w-4 h-4" />
//       ) : (
//         <ChevronDown className="w-4 h-4" />
//       )}
//     </div>
//   </button>

//   {/* Expandable cards */}
//   <div
//     className={`grid transition-all duration-300 ease-in-out ${
//       statsOpen
//         ? "grid-rows-[1fr] opacity-100"
//         : "grid-rows-[0fr] opacity-0"
//     }`}
//   >
//     <div className="min-h-0 overflow-hidden">
//       <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-4 pt-1">
//         <Hero
//           label="Taxable Revenue"
//           value={data.taxableRevenue}
//           money
//           gradient="from-emerald-500 to-green-600"
//           icon={<BarChart3 className="w-5 h-5" />}
//           delay={0}
//         />

//         <Hero
//           label="Vendor Cost (net)"
//           value={data.vendorCostNet}
//           money
//           gradient="from-amber-500 to-orange-500"
//           icon={<FileSpreadsheet className="w-5 h-5" />}
//           delay={50}
//         />

//         <Hero
//           label="Gross Margin"
//           value={data.grossMargin}
//           money
//           sub={pct(data.grossMarginPct)}
//           gradient="from-violet-500 to-purple-600"
//           icon={<BarChart3 className="w-5 h-5" />}
//           delay={100}
//         />

//         <Hero
//           label="Net GST Payable"
//           value={data.netGstPayable}
//           money
//           gradient="from-rose-500 to-red-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={150}
//         />

//         <Hero
//           label="TCS Collected"
//           value={data.tcsCollected}
//           money
//           gradient="from-teal-500 to-cyan-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={200}
//         />

//         <Hero
//           label="TDS Deducted"
//           value={data.tdsDeducted}
//           money
//           gradient="from-blue-500 to-indigo-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={250}
//         />
//       </div>
//     </div>
//   </div>
// </div>

//       <Panel className="p-5">
//         <div className="mb-4 flex items-center justify-between">
//           <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> Summary</h3>
//           <Badge tone="slate">{fmtDate(data.from)} – {fmtDate(data.to)}</Badge>
//         </div>
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
//           <Line label={`Taxable revenue (${data.invoiceCount} invoices)`} value={inr(data.taxableRevenue)} />
//           <Line label="Output GST (pass-through)" value={inr(data.outputGst)} muted />
//           <Line label={`Vendor cost gross (${data.purchaseCount} bills)`} value={inr(data.vendorCostGross)} />
//           <Line label="Input GST credit" value={inr(data.inputGstCredit)} muted={!data.inputTaxCreditEligible} />
//           <Line label="Vendor cost (net of ITC)" value={inr(data.vendorCostNet)} />
//           <Line label="TDS deducted" value={inr(data.tdsDeducted)} muted />
//           <Line label="Gross margin" value={inr(data.grossMargin)} strong />
//           <Line label="Net GST payable" value={inr(data.netGstPayable)} strong />
//         </div>
//         {!data.inputTaxCreditEligible && <p className="mt-3 text-xs text-slate-400">Input Tax Credit is disabled for this tenant — vendor GST is treated as cost.</p>}
//       </Panel>

//       {data.monthly?.length > 0 && (
//         <Panel className="overflow-hidden">
//           <PanelHead icon={BarChart3} title="Monthly Breakdown" />
//           <div className="overflow-x-auto">
//             <table className="w-full min-w-[640px]">
//               <thead className={theadCls}>
//                 <tr><Th>Month</Th><Th right>Taxable Revenue</Th><Th right>Output GST</Th><Th right>Vendor Cost (net)</Th><Th right>Gross Margin</Th></tr>
//               </thead>
//               <tbody className="divide-y divide-slate-50">
//                 {data.monthly.map((m) => (
//                   <tr key={m.month} className="hover:bg-emerald-50/30 transition-colors">
//                     <td className="px-3 py-3.5 text-sm font-bold text-slate-800">{m.month}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(m.taxableRevenue)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(m.outputGst)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(m.vendorCostNet)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm font-extrabold text-emerald-700">{inr(m.grossMargin)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </Panel>
//       )}
//     </>
//   );
// }

// function GstView({ data, statsOpen, setStatsOpen }) {
//   if (!data) return <Panel><EmptyBlock icon={Receipt} title="No GST data" hint="Issue GST tax invoices to populate the summary." /></Panel>;
//   return (
//     <>
//       {/* <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
//         <Hero label="Total Taxable" value={data.totalTaxable} money gradient="from-blue-500 to-indigo-600" icon={<Receipt className="w-5 h-5" />} delay={0} />
//         <Hero label="CGST" value={data.totalCgst} money gradient="from-emerald-500 to-green-600" icon={<Receipt className="w-5 h-5" />} delay={50} />
//         <Hero label="SGST" value={data.totalSgst} money gradient="from-teal-500 to-cyan-600" icon={<Receipt className="w-5 h-5" />} delay={100} />
//         <Hero label="IGST" value={data.totalIgst} money gradient="from-violet-500 to-purple-600" icon={<Receipt className="w-5 h-5" />} delay={150} />
//         <Hero label="Input GST (ITC)" value={data.inputGst} money gradient="from-amber-500 to-orange-500" icon={<Receipt className="w-5 h-5" />} delay={200} />
//         <Hero label="Net GST Payable" value={data.netGstPayable} money gradient="from-rose-500 to-red-600" icon={<Receipt className="w-5 h-5" />} delay={250} />
//       </div> */}

//       {/* ── COLLAPSIBLE GST ANALYTICS ── */}
// <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

//   {/* Toggle header */}
//   <button
//     type="button"
//     onClick={() => setStatsOpen((previous) => !previous)}
//     aria-expanded={statsOpen}
//     className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
//   >
//     <div className="flex items-center gap-3 flex-wrap min-w-0">
//       <div className="flex items-center gap-2">
//         <Receipt className="w-4 h-4 text-blue-600" />

//         <span className="text-sm font-extrabold text-slate-700">
//           GST Analytics
//         </span>
//       </div>

//       {/* Compact values displayed while closed */}
//       {!statsOpen && (
//         <div className="flex items-center gap-2 flex-wrap">
//           <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
//             Taxable {inr(data.totalTaxable)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
//             CGST {inr(data.totalCgst)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
//             SGST {inr(data.totalSgst)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
//             IGST {inr(data.totalIgst)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
//             ITC {inr(data.inputGst)}
//           </span>

//           <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
//             Payable {inr(data.netGstPayable)}
//           </span>
//         </div>
//       )}
//     </div>

//     <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
//       {statsOpen ? (
//         <ChevronUp className="w-4 h-4" />
//       ) : (
//         <ChevronDown className="w-4 h-4" />
//       )}
//     </div>
//   </button>

//   {/* Expandable cards */}
//   <div
//     className={`grid transition-all duration-300 ease-in-out ${
//       statsOpen
//         ? "grid-rows-[1fr] opacity-100"
//         : "grid-rows-[0fr] opacity-0"
//     }`}
//   >
//     <div className="min-h-0 overflow-hidden">
//       <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-4 pt-1">
//         <Hero
//           label="Total Taxable"
//           value={data.totalTaxable}
//           money
//           gradient="from-blue-500 to-indigo-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={0}
//         />

//         <Hero
//           label="CGST"
//           value={data.totalCgst}
//           money
//           gradient="from-emerald-500 to-green-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={50}
//         />

//         <Hero
//           label="SGST"
//           value={data.totalSgst}
//           money
//           gradient="from-teal-500 to-cyan-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={100}
//         />

//         <Hero
//           label="IGST"
//           value={data.totalIgst}
//           money
//           gradient="from-violet-500 to-purple-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={150}
//         />

//         <Hero
//           label="Input GST (ITC)"
//           value={data.inputGst}
//           money
//           gradient="from-amber-500 to-orange-500"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={200}
//         />

//         <Hero
//           label="Net GST Payable"
//           value={data.netGstPayable}
//           money
//           gradient="from-rose-500 to-red-600"
//           icon={<Receipt className="w-5 h-5" />}
//           delay={250}
//         />
//       </div>
//     </div>
//   </div>
// </div>

//       <div className="flex flex-wrap items-center gap-2">
//         <Badge tone="blue">B2B: {data.b2bInvoiceCount}</Badge>
//         <Badge tone="slate">B2C: {data.b2cInvoiceCount}</Badge>
//         <Badge tone="amber">TCS: {inr(data.totalTcs)}</Badge>
//         <Badge tone="slate">{fmtDate(data.from)} – {fmtDate(data.to)}</Badge>
//       </div>

//       <Panel className="overflow-hidden">
//         <PanelHead icon={Receipt} title="Output Tax by Rate" />
//         {data.outputByRate?.length ? (
//           <div className="overflow-x-auto">
//             <table className="w-full min-w-[640px]">
//               <thead className={theadCls}>
//                 <tr><Th>GST Rate</Th><Th right>Taxable Value</Th><Th right>CGST</Th><Th right>SGST</Th><Th right>IGST</Th><Th right>Cess</Th></tr>
//               </thead>
//               <tbody className="divide-y divide-slate-50">
//                 {data.outputByRate.map((r, i) => (
//                   <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
//                     <td className="px-3 py-3.5 text-sm font-bold text-slate-800">{pct(r.gstRatePct)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.taxableValue)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.cgst)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.sgst)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.igst)}</td>
//                     <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.cess)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         ) : <EmptyBlock title="No output tax in this period" />}
//       </Panel>
//     </>
//   );
// }

// function Line({ label, value, strong, muted }) {
//   return (
//     <div className={`flex items-center justify-between border-b border-slate-50 py-1.5 text-sm ${muted ? "text-slate-400" : "text-slate-600"}`}>
//       <span className="font-semibold">{label}</span>
//       <span className={strong ? "font-extrabold text-slate-800" : "font-bold"}>{value}</span>
//     </div>
//   );
// }








import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw, FileSpreadsheet, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@shared/ui/toast";
import { isAlreadyReported, getErrorMessage } from "@shared/api/apiError";
import { downloadBlob, hydrateBlobError } from "@shared/lib/download";
import {
  Page, Hero, Panel, PanelHead, Badge, Btn, Pills, Loading, EmptyBlock,
  theadCls, Th, EmptyRow,
} from "../components/accountingUi";
import accountingService from "../api/accountingService";
import { RANGE_PRESETS, resolveRange } from "../lib/dateRange";
import { inr, pct, fmtDate } from "../lib/format";

const TABS = [{ value: "pnl", label: "Profit & Loss" }, { value: "gst", label: "GST Summary" }];

export default function AccountingReports() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("pnl");
  const [preset, setPreset] = useState("this-fy");
  const [pnl, setPnl] = useState(null);
  const [gst, setGst] = useState(null);
  const [loading, setLoading] = useState(true);

  const [reportStatsOpen, setReportStatsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = resolveRange(preset);
      const [pnlRes, gstRes] = await Promise.all([accountingService.getPnl(range), accountingService.getGstSummary(range)]);
      setPnl(pnlRes?.data?.data ?? null);
      setGst(gstRes?.data?.data ?? null);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Couldn't load reports."), "error");
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

  return (
    <Page icon={BarChart3} title="Accounting Reports" crumb="Reports" subtitle="Tax-aware P&L and a GSTR-style output summary"
      actions={
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 w-full mt-3 sm:mt-0 min-w-0">
          <div className="w-full lg:flex-1 min-w-0 overflow-x-auto pb-1 scrollbar-hide">
            <div className="w-max">
              <Pills options={RANGE_PRESETS} value={preset} onChange={setPreset} />
            </div>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end shrink-0">
            <Btn variant="outline" size="sm" onClick={load}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 
              <span className="hidden sm:inline whitespace-nowrap">Refresh</span>
            </Btn>
            <Btn variant="primary" size="sm" onClick={onExport}>
              <Download className="w-4 h-4" /> 
              <span className="hidden sm:inline whitespace-nowrap">Export CSV</span>
            </Btn>
          </div>
        </div>
      }>

      <div className="mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <Pills options={TABS} value={tab} onChange={setTab} />
      </div>

      {loading ? (
        <Panel>
          <Loading label="Loading reports…" />
        </Panel>
      ) : tab === "pnl" ? (
        <PnlView
          data={pnl}
          statsOpen={reportStatsOpen}
          setStatsOpen={setReportStatsOpen}
        />
      ) : (
        <GstView
          data={gst}
          statsOpen={reportStatsOpen}
          setStatsOpen={setReportStatsOpen}
        />
      )}
    </Page>
  );
}

function PnlView({ data, statsOpen, setStatsOpen }) {
  if (!data) return <Panel><EmptyBlock icon={BarChart3} title="No P&L data" hint="Issue invoices and raise bills to populate the P&L." /></Panel>;
  
  return (
    <div className="space-y-4">
      {/* ── COLLAPSIBLE P&L ANALYTICS ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setStatsOpen((previous) => !previous)}
          aria-expanded={statsOpen}
          className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-extrabold text-slate-700">
                Profit & Loss Analytics
              </span>
            </div>

            {/* Compact values displayed while closed */}
            {!statsOpen && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
                  Revenue {inr(data.taxableRevenue)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold whitespace-nowrap">
                  Cost {inr(data.vendorCostNet)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold whitespace-nowrap">
                  Margin {inr(data.grossMargin)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold whitespace-nowrap">
                  GST {inr(data.netGstPayable)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold whitespace-nowrap">
                  TCS {inr(data.tcsCollected)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold whitespace-nowrap">
                  TDS {inr(data.tdsDeducted)}
                </span>
              </div>
            )}
          </div>

          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            {statsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Expandable cards */}
        <div className={`grid transition-all duration-300 ease-in-out ${statsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 p-4 pt-1">
              <Hero label="Taxable Revenue" value={data.taxableRevenue} money gradient="from-emerald-500 to-green-600" icon={<BarChart3 className="w-5 h-5" />} delay={0} />
              <Hero label="Vendor Cost (net)" value={data.vendorCostNet} money gradient="from-amber-500 to-orange-500" icon={<FileSpreadsheet className="w-5 h-5" />} delay={50} />
              <Hero label="Gross Margin" value={data.grossMargin} money sub={pct(data.grossMarginPct)} gradient="from-violet-500 to-purple-600" icon={<BarChart3 className="w-5 h-5" />} delay={100} />
              <Hero label="Net GST Payable" value={data.netGstPayable} money gradient="from-rose-500 to-red-600" icon={<Receipt className="w-5 h-5" />} delay={150} />
              <Hero label="TCS Collected" value={data.tcsCollected} money gradient="from-teal-500 to-cyan-600" icon={<Receipt className="w-5 h-5" />} delay={200} />
              <Hero label="TDS Deducted" value={data.tdsDeducted} money gradient="from-blue-500 to-indigo-600" icon={<Receipt className="w-5 h-5" />} delay={250} />
            </div>
          </div>
        </div>
      </div>

      <Panel className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> Summary</h3>
          <Badge tone="slate" className="w-fit whitespace-nowrap">{fmtDate(data.from)} – {fmtDate(data.to)}</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">
          <Line label={`Taxable revenue (${data.invoiceCount} invoices)`} value={inr(data.taxableRevenue)} />
          <Line label="Output GST (pass-through)" value={inr(data.outputGst)} muted />
          <Line label={`Vendor cost gross (${data.purchaseCount} bills)`} value={inr(data.vendorCostGross)} />
          <Line label="Input GST credit" value={inr(data.inputGstCredit)} muted={!data.inputTaxCreditEligible} />
          <Line label="Vendor cost (net of ITC)" value={inr(data.vendorCostNet)} />
          <Line label="TDS deducted" value={inr(data.tdsDeducted)} muted />
          <Line label="Gross margin" value={inr(data.grossMargin)} strong />
          <Line label="Net GST payable" value={inr(data.netGstPayable)} strong />
        </div>
        {!data.inputTaxCreditEligible && <p className="mt-3 text-xs text-slate-400">Input Tax Credit is disabled for this tenant — vendor GST is treated as cost.</p>}
      </Panel>

      {data.monthly?.length > 0 && (
        <Panel className="overflow-hidden">
          <PanelHead icon={BarChart3} title="Monthly Breakdown" />
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[640px]">
              <thead className={theadCls}>
                <tr><Th>Month</Th><Th right>Taxable Revenue</Th><Th right>Output GST</Th><Th right>Vendor Cost (net)</Th><Th right>Gross Margin</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.monthly.map((m) => (
                  <tr key={m.month} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-3 py-3.5 text-sm font-bold text-slate-800 whitespace-nowrap">{m.month}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(m.taxableRevenue)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(m.outputGst)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(m.vendorCostNet)}</td>
                    <td className="px-3 py-3.5 text-right text-sm font-extrabold text-emerald-700">{inr(m.grossMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function GstView({ data, statsOpen, setStatsOpen }) {
  if (!data) return <Panel><EmptyBlock icon={Receipt} title="No GST data" hint="Issue GST tax invoices to populate the summary." /></Panel>;
  
  return (
    <div className="space-y-4">
      {/* ── COLLAPSIBLE GST ANALYTICS ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setStatsOpen((previous) => !previous)}
          aria-expanded={statsOpen}
          className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-extrabold text-slate-700">
                GST Analytics
              </span>
            </div>

            {/* Compact values displayed while closed */}
            {!statsOpen && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold whitespace-nowrap">
                  Taxable {inr(data.totalTaxable)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
                  CGST {inr(data.totalCgst)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold whitespace-nowrap">
                  SGST {inr(data.totalSgst)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold whitespace-nowrap">
                  IGST {inr(data.totalIgst)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold whitespace-nowrap">
                  ITC {inr(data.inputGst)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold whitespace-nowrap">
                  Payable {inr(data.netGstPayable)}
                </span>
              </div>
            )}
          </div>

          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            {statsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Expandable cards */}
        <div className={`grid transition-all duration-300 ease-in-out ${statsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 p-4 pt-1">
              <Hero label="Total Taxable" value={data.totalTaxable} money gradient="from-blue-500 to-indigo-600" icon={<Receipt className="w-5 h-5" />} delay={0} />
              <Hero label="CGST" value={data.totalCgst} money gradient="from-emerald-500 to-green-600" icon={<Receipt className="w-5 h-5" />} delay={50} />
              <Hero label="SGST" value={data.totalSgst} money gradient="from-teal-500 to-cyan-600" icon={<Receipt className="w-5 h-5" />} delay={100} />
              <Hero label="IGST" value={data.totalIgst} money gradient="from-violet-500 to-purple-600" icon={<Receipt className="w-5 h-5" />} delay={150} />
              <Hero label="Input GST (ITC)" value={data.inputGst} money gradient="from-amber-500 to-orange-500" icon={<Receipt className="w-5 h-5" />} delay={200} />
              <Hero label="Net GST Payable" value={data.netGstPayable} money gradient="from-rose-500 to-red-600" icon={<Receipt className="w-5 h-5" />} delay={250} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue" className="whitespace-nowrap">B2B: {data.b2bInvoiceCount}</Badge>
        <Badge tone="slate" className="whitespace-nowrap">B2C: {data.b2cInvoiceCount}</Badge>
        <Badge tone="amber" className="whitespace-nowrap">TCS: {inr(data.totalTcs)}</Badge>
        <Badge tone="slate" className="whitespace-nowrap">{fmtDate(data.from)} – {fmtDate(data.to)}</Badge>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead icon={Receipt} title="Output Tax by Rate" />
        {data.outputByRate?.length ? (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[640px]">
              <thead className={theadCls}>
                <tr><Th>GST Rate</Th><Th right>Taxable Value</Th><Th right>CGST</Th><Th right>SGST</Th><Th right>IGST</Th><Th right>Cess</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.outputByRate.map((r, i) => (
                  <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-3 py-3.5 text-sm font-bold text-slate-800 whitespace-nowrap">{pct(r.gstRatePct)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.taxableValue)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.cgst)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.sgst)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.igst)}</td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-600">{inr(r.cess)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock title="No output tax in this period" />}
      </Panel>
    </div>
  );
}

function Line({ label, value, strong, muted }) {
  return (
    <div className={`flex items-center justify-between border-b border-slate-50 py-2 sm:py-1.5 text-sm ${muted ? "text-slate-400" : "text-slate-600"}`}>
      <span className="font-semibold">{label}</span>
      <span className={strong ? "font-extrabold text-slate-800" : "font-bold whitespace-nowrap"}>{value}</span>
    </div>
  );
}