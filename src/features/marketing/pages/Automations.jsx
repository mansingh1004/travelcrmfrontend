// // src/features/marketing/pages/Automations.jsx
// import { useCallback, useEffect, useState } from "react";
// import { Zap, Pencil, Beaker, CalendarHeart, CheckCircle2, PauseCircle, Clock, Send as SendIcon } from "lucide-react";
// import { toast, useToast } from "@shared/ui/toast";
// import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
// import { hasPermission, P } from "@shared/lib/access";
// import marketingService from "../api/marketingService";
// import { AUTOMATION_META } from "../constants";
// import MarketingNav from "../components/MarketingNav";
// import MessageComposer from "../components/MessageComposer";
// import TestSendModal from "../components/TestSendModal";
// import {
//   Page, Panel, PanelHead, Badge, ChannelBadge, Btn, Th, theadCls, EmptyRow, Loading,
//   Modal, Field, inputCls, Select, Toggle,
//   GridHead, GridRow, Cell, Avatar, GridEmpty,
// } from "../components/marketingUi";

// const UPC_COLS = "1.7fr 1fr 0.9fr 0.55fr 0.9fr 0.9fr";

// export default function Automations() {
//   const { showToast } = useToast();
//   const canUpdate = hasPermission(P.MARKETING_UPDATE);
//   const canSend = hasPermission(P.MARKETING_SEND);

//   const [autos, setAutos] = useState([]);
//   const [upcoming, setUpcoming] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [editing, setEditing] = useState(null);
//   const [testing, setTesting] = useState(null);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const [a, u] = await Promise.all([
//         marketingService.listAutomations(),
//         marketingService.getUpcomingCelebrations({ days: 30 }),
//       ]);
//       setAutos(a.data?.data ?? []);
//       setUpcoming(u.data?.data ?? []);
//     } catch (error) {
//       if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Couldn't load automations."), "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [showToast]);

//   useEffect(() => { load(); }, [load]);

//   const quickToggle = async (a, enabled) => {
//     try {
//       await marketingService.updateAutomation(a.triggerType, { ...a, enabled });
//       toast.success(`${AUTOMATION_META[a.triggerType]?.label} automation ${enabled ? "enabled" : "disabled"}.`);
//       load();
//     } catch (error) {
//       if (!isAlreadyReported(error)) toast.error(getErrorMessage(error, "Couldn't update the automation."));
//     }
//   };

//   return (
//     <Page icon={Zap} title="Automations" crumb="Automations" subtitle="Birthday & anniversary auto-messages">
//       <MarketingNav active="automations" />

//       {loading ? <Loading label="Loading automations…" /> : (
//         <>
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//             {autos.map((a) => {
//               const meta = AUTOMATION_META[a.triggerType] || { label: a.triggerType, icon: "🎉", blurb: "" };
//               return (
//                 <Panel key={a.triggerType} className="overflow-hidden">
//                   <div className={`px-5 py-4 flex items-center gap-3 border-b border-slate-100 ${a.enabled ? "bg-gradient-to-r from-blue-600 to-indigo-500" : "bg-slate-100"}`}>
//                     <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl ${a.enabled ? "bg-white/20" : "bg-white"}`}>{meta.icon}</div>
//                     <div className="flex-1 min-w-0">
//                       <h3 className={`text-base font-extrabold ${a.enabled ? "text-white" : "text-slate-700"}`}>{meta.label} Trigger</h3>
//                       <p className={`text-xs ${a.enabled ? "text-white/80" : "text-slate-400"}`}>{meta.blurb}</p>
//                     </div>
//                     <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${a.enabled ? "bg-white/20 text-white" : "bg-white text-slate-500"}`}>
//                       {a.enabled ? <><CheckCircle2 className="w-3.5 h-3.5" /> Active</> : <><PauseCircle className="w-3.5 h-3.5" /> Off</>}
//                     </span>
//                   </div>

//                   <div className="p-5 space-y-4">
//                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
//                       <Stat label="Channel"><ChannelBadge channel={a.channel} /></Stat>
//                       <Stat label="Timing" value={a.daysBefore === 0 ? "On the day" : `${a.daysBefore} day(s) before`} />
//                       <Stat label="Send at" value={a.sendTime} />
//                       <Stat label="Total sent" value={(a.totalSent ?? 0).toLocaleString("en-IN")} />
//                     </div>

//                     <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
//                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">Message</p>
//                       <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{a.body || "—"}</p>
//                     </div>

//                     <div className="flex items-center justify-between gap-2 flex-wrap">
//                       <span className="text-xs text-slate-400">{a.upcomingCount ?? 0} upcoming this month</span>
//                       <div className="flex items-center gap-2">
//                         {canSend && <Btn variant="ghost" size="sm" onClick={() => setTesting(a)}><Beaker className="w-3.5 h-3.5" /> Test</Btn>}
//                         {canUpdate && <Btn variant="ghost" size="sm" onClick={() => quickToggle(a, !a.enabled)}>{a.enabled ? "Disable" : "Enable"}</Btn>}
//                         {canUpdate && <Btn size="sm" onClick={() => setEditing(a)}><Pencil className="w-3.5 h-3.5" /> Configure</Btn>}
//                       </div>
//                     </div>
//                   </div>
//                 </Panel>
//               );
//             })}
//           </div>

//           {/* Upcoming celebrations */}
//           <Panel>
//             <PanelHead icon={CalendarHeart} title="Upcoming celebrations" count={upcoming.length} right={<span className="text-xs text-slate-400">next 30 days</span>} />
//             <GridHead cols={UPC_COLS}>
//               <Cell first>Customer</Cell><Cell>Occasion</Cell><Cell>Date</Cell><Cell right>In</Cell><Cell>Channel</Cell><Cell>Reachable</Cell>
//             </GridHead>
//             <div>
//               {upcoming.length === 0 ? <GridEmpty icon={CalendarHeart} title="No upcoming celebrations" hint="Birthdays and anniversaries in the next 30 days will appear here." />
//                 : upcoming.slice(0, 25).map((u, i) => {
//                   const occasion = <Badge tone={u.triggerType === "BIRTHDAY" ? "amber" : "rose"}>{AUTOMATION_META[u.triggerType]?.icon} {u.triggerType === "BIRTHDAY" ? "Birthday" : "Anniversary"}</Badge>;
//                   const reachBadge = u.reachable ? <Badge tone="green"><CheckCircle2 className="w-3 h-3" /> Yes</Badge> : <Badge tone="slate">No</Badge>;
//                   return (
//                     <div key={`${u.customerPublicId}-${u.triggerType}`}>
//                       {/* Desktop grid row */}
//                       <GridRow cols={UPC_COLS} index={i}>
//                         <Cell first>
//                           <Avatar text={u.customerName} gradient={u.triggerType === "BIRTHDAY" ? "from-amber-400 to-orange-500" : "from-rose-400 to-pink-600"} size="w-9 h-9" />
//                           <span className="ml-3 text-sm font-bold text-slate-700 truncate">{u.customerName}</span>
//                         </Cell>
//                         <Cell>{occasion}</Cell>
//                         <Cell><span className="text-sm text-slate-500">{u.date}</span></Cell>
//                         <Cell right><span className="text-sm font-bold text-slate-600">{u.daysAway === 0 ? "Today" : `${u.daysAway}d`}</span></Cell>
//                         <Cell><ChannelBadge channel={u.channel} /></Cell>
//                         <Cell>{reachBadge}</Cell>
//                       </GridRow>
//                       {/* Mobile card */}
//                       <div className="md:hidden px-4 py-3 border-b border-slate-50 flex items-center gap-3">
//                         <Avatar text={u.customerName} gradient={u.triggerType === "BIRTHDAY" ? "from-amber-400 to-orange-500" : "from-rose-400 to-pink-600"} size="w-9 h-9" />
//                         <div className="flex-1 min-w-0">
//                           <p className="text-sm font-bold text-slate-700 truncate">{u.customerName}</p>
//                           <div className="flex items-center gap-2 mt-1 flex-wrap">{occasion}<span className="text-xs text-slate-400">{u.date} · {u.daysAway === 0 ? "Today" : `${u.daysAway}d`}</span></div>
//                         </div>
//                         <div className="flex-shrink-0">{reachBadge}</div>
//                       </div>
//                     </div>
//                   );
//                 })}
//             </div>
//           </Panel>
//         </>
//       )}

//       {editing && <AutomationEditor auto={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
//       {testing && <TestSendModal title={`Test ${AUTOMATION_META[testing.triggerType]?.label} message`} channel={testing.channel} onClose={() => setTesting(null)} onSend={(to) => marketingService.testAutomation(testing.triggerType, to)} />}
//     </Page>
//   );
// }

// function Stat({ label, value, children }) {
//   return (
//     <div>
//       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">{label}</p>
//       {children ?? <p className="text-sm font-extrabold text-slate-700">{value}</p>}
//     </div>
//   );
// }

// /* ── Automation config editor ─────────────────────────────────────────────────── */
// function AutomationEditor({ auto, onClose, onSaved }) {
//   const meta = AUTOMATION_META[auto.triggerType] || { label: auto.triggerType };
//   const [enabled, setEnabled] = useState(!!auto.enabled);
//   const [channel, setChannel] = useState(auto.channel || "WHATSAPP");
//   const [daysBefore, setDaysBefore] = useState(auto.daysBefore ?? 0);
//   const [sendTime, setSendTime] = useState(auto.sendTime || "09:00");
//   const [subject, setSubject] = useState(auto.subject || "");
//   const [body, setBody] = useState(auto.body || "");
//   const [templateName, setTemplateName] = useState(auto.templateName || "");
//   const [mergeTags, setMergeTags] = useState([]);
//   const [errors, setErrors] = useState({});
//   const [busy, setBusy] = useState(false);

//   useEffect(() => { marketingService.getMergeTags().then((res) => setMergeTags(res.data?.data ?? [])).catch(() => {}); }, []);

//   const save = async () => {
//     const e = {};
//     if (!body.trim()) e.body = "Message body is required.";
//     if (channel === "EMAIL" && !subject.trim()) e.subject = "Subject is required for email.";
//     setErrors(e);
//     if (Object.keys(e).length) return;
//     setBusy(true);
//     try {
//       await marketingService.updateAutomation(auto.triggerType, {
//         enabled, channel, daysBefore: Number(daysBefore) || 0, sendTime,
//         subject: channel === "EMAIL" ? subject.trim() : null, body: body.trim(),
//         templateName: channel === "WHATSAPP" ? (templateName.trim() || null) : null,
//       });
//       toast.success(`${meta.label} automation saved.`);
//       onSaved();
//     } catch (error) {
//       if (!isAlreadyReported(error)) toast.error(getErrorMessage(error, "Couldn't save the automation."));
//     } finally {
//       setBusy(false);
//     }
//   };

//   return (
//     <Modal icon={Zap} title={`${meta.label} Automation`} subtitle="Auto-message customers on their special day" maxW="max-w-2xl" onClose={onClose}
//       footer={<>
//         <Btn variant="outline" onClick={onClose}>Cancel</Btn>
//         <Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save automation"}</Btn>
//       </>}>

//       <Toggle label={`Enable ${meta.label.toLowerCase()} messages`} hint="When on, the daily job sends to every matching customer." checked={enabled} onChange={setEnabled} />

//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <Field label="Send" hint="Relative to the date">
//           <Select value={String(daysBefore)} onChange={(e) => setDaysBefore(Number(e.target.value))}>
//             <option value="0">On the day</option>
//             <option value="1">1 day before</option>
//             <option value="3">3 days before</option>
//             <option value="7">7 days before</option>
//           </Select>
//         </Field>
//         <Field label="Send at (time)"><input type="time" className={inputCls} value={sendTime} onChange={(e) => setSendTime(e.target.value)} /></Field>
//         <Field label="Occasion"><input className={inputCls} value={meta.label} disabled /></Field>
//       </div>

//       <MessageComposer channel={channel} onChannel={setChannel} subject={subject} onSubject={setSubject}
//         body={body} onBody={setBody} templateName={templateName} onTemplateName={setTemplateName} mergeTags={mergeTags} errors={errors} />
//     </Modal>
//   );
// }





// src/features/marketing/pages/Automations.jsx
import { useCallback, useEffect, useState } from "react";
import { Zap, Pencil, Beaker, CalendarHeart, CheckCircle2, PauseCircle, Clock, Send as SendIcon } from "lucide-react";
import { toast, useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";
import marketingService from "../api/marketingService";
import { AUTOMATION_META } from "../constants";
import MarketingNav from "../components/MarketingNav";
import MessageComposer from "../components/MessageComposer";
import TestSendModal from "../components/TestSendModal";
import {
  Page, Panel, PanelHead, Badge, ChannelBadge, Btn, Th, theadCls, EmptyRow, Loading,
  Modal, Field, inputCls, Select, Toggle,
  GridHead, GridRow, Cell, Avatar, GridEmpty,
} from "../components/marketingUi";

const UPC_COLS = "1.7fr 1fr 0.9fr 0.55fr 0.9fr 0.9fr";

export default function Automations() {
  const { showToast } = useToast();
  const canUpdate = hasPermission(P.MARKETING_UPDATE);
  const canSend = hasPermission(P.MARKETING_SEND);

  const [autos, setAutos] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [testing, setTesting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, u] = await Promise.all([
        marketingService.listAutomations(),
        marketingService.getUpcomingCelebrations({ days: 30 }),
      ]);
      setAutos(a.data?.data ?? []);
      setUpcoming(u.data?.data ?? []);
    } catch (error) {
      if (!isAlreadyReported(error)) showToast(getErrorMessage(error, "Couldn't load automations."), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const quickToggle = async (a, enabled) => {
    try {
      await marketingService.updateAutomation(a.triggerType, { ...a, enabled });
      toast.success(`${AUTOMATION_META[a.triggerType]?.label} automation ${enabled ? "enabled" : "disabled"}.`);
      load();
    } catch (error) {
      if (!isAlreadyReported(error)) toast.error(getErrorMessage(error, "Couldn't update the automation."));
    }
  };

  return (
    <Page icon={Zap} title="Automations" crumb="Automations" subtitle="Birthday & anniversary auto-messages">
      <MarketingNav active="automations" />

      {loading ? <Loading label="Loading automations…" /> : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {autos.map((a) => {
              const meta = AUTOMATION_META[a.triggerType] || { label: a.triggerType, icon: "🎉", blurb: "" };
              return (
                <Panel key={a.triggerType} className="overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className={`px-4 sm:px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 ${a.enabled ? "bg-gradient-to-r from-blue-600 to-indigo-500" : "bg-slate-100"}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${a.enabled ? "bg-white/20" : "bg-white shadow-sm"}`}>{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-base font-extrabold truncate ${a.enabled ? "text-white" : "text-slate-700"}`}>{meta.label} Trigger</h3>
                        <p className={`text-xs truncate ${a.enabled ? "text-white/80" : "text-slate-400"}`}>{meta.blurb}</p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${a.enabled ? "bg-white/20 text-white" : "bg-white text-slate-500 shadow-sm"}`}>
                      {a.enabled ? <><CheckCircle2 className="w-3.5 h-3.5" /> Active</> : <><PauseCircle className="w-3.5 h-3.5" /> Off</>}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <Stat label="Channel"><ChannelBadge channel={a.channel} /></Stat>
                      <Stat label="Timing" value={a.daysBefore === 0 ? "On the day" : `${a.daysBefore} day(s) before`} />
                      <Stat label="Send at" value={a.sendTime} />
                      <Stat label="Total sent" value={(a.totalSent ?? 0).toLocaleString("en-IN")} />
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 mb-2 flex-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">Message</p>
                      <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap min-w-0 break-words">{a.body || "—"}</p>
                    </div>

                    {/* Card Actions (Fixed alignment to the right) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 mt-2">
                      <span className="text-xs font-medium text-slate-400 text-center sm:text-left">
                        <span className="font-bold text-slate-600">{a.upcomingCount ?? 0}</span> upcoming this month
                      </span>
                      
                      {/* Using justify-end forces buttons to the right. flex-1 makes them equal size on mobile. */}
                      <div className="flex items-center justify-end gap-2 w-full sm:w-auto flex-wrap">
                        {canSend && (
                          <Btn variant="ghost" size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => setTesting(a)}>
                            <Beaker className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Test</span>
                          </Btn>
                        )}
                        {canUpdate && (
                          <Btn variant="ghost" size="sm" className="flex-1 sm:flex-none justify-center" onClick={() => quickToggle(a, !a.enabled)}>
                            {a.enabled ? "Disable" : "Enable"}
                          </Btn>
                        )}
                        {canUpdate && (
                          <Btn size="sm" className="flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700" onClick={() => setEditing(a)}>
                            <Pencil className="w-3.5 h-3.5" /> Configure
                          </Btn>
                        )}
                      </div>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>

          {/* Upcoming celebrations */}
          <Panel>
            <PanelHead icon={CalendarHeart} title="Upcoming celebrations" count={upcoming.length} right={<span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Next 30 days</span>} />
            
            {/* Hidden on mobile, visible on desktop */}
            <div className="hidden md:block">
              <GridHead cols={UPC_COLS} bp="md">
                <Cell first>Customer</Cell><Cell>Occasion</Cell><Cell>Date</Cell><Cell right>In</Cell><Cell>Channel</Cell><Cell>Reachable</Cell>
              </GridHead>
            </div>

            <div>
              {upcoming.length === 0 ? (
                <GridEmpty icon={CalendarHeart} title="No upcoming celebrations" hint="Birthdays and anniversaries in the next 30 days will appear here." />
              ) : (
                upcoming.slice(0, 25).map((u, i) => {
                  const occasion = <Badge tone={u.triggerType === "BIRTHDAY" ? "amber" : "rose"}>{AUTOMATION_META[u.triggerType]?.icon} {u.triggerType === "BIRTHDAY" ? "Birthday" : "Anniversary"}</Badge>;
                  const reachBadge = u.reachable ? <Badge tone="green"><CheckCircle2 className="w-3 h-3" /> Yes</Badge> : <Badge tone="slate">No</Badge>;
                  
                  return (
                    <div key={`${u.customerPublicId}-${u.triggerType}`}>
                      {/* Desktop grid row */}
                      <div className="hidden md:block">
                        <GridRow cols={UPC_COLS} index={i} bp="md">
                          <Cell first>
                            <Avatar text={u.customerName} gradient={u.triggerType === "BIRTHDAY" ? "from-amber-400 to-orange-500" : "from-rose-400 to-pink-600"} size="w-9 h-9" />
                            <span className="ml-3 text-sm font-bold text-slate-700 truncate min-w-0">{u.customerName}</span>
                          </Cell>
                          <Cell>{occasion}</Cell>
                          <Cell><span className="text-sm text-slate-500">{u.date}</span></Cell>
                          <Cell right><span className="text-sm font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-md">{u.daysAway === 0 ? "Today" : `${u.daysAway}d`}</span></Cell>
                          <Cell><ChannelBadge channel={u.channel} /></Cell>
                          <Cell>{reachBadge}</Cell>
                        </GridRow>
                      </div>

                      {/* Mobile card (Responsive layout) */}
                      <div className="md:hidden px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Avatar text={u.customerName} gradient={u.triggerType === "BIRTHDAY" ? "from-amber-400 to-orange-500" : "from-rose-400 to-pink-600"} size="w-10 h-10" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-extrabold text-slate-800 truncate">{u.customerName}</p>
                              <p className="text-xs font-bold text-slate-500 mt-0.5 truncate">{u.date} • {u.daysAway === 0 ? <span className="text-blue-600">Today</span> : `${u.daysAway} days away`}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {occasion}
                            <div className="flex items-center gap-1">
                              <ChannelBadge channel={u.channel} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </>
      )}

      {editing && <AutomationEditor auto={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {testing && <TestSendModal title={`Test ${AUTOMATION_META[testing.triggerType]?.label} message`} channel={testing.channel} onClose={() => setTesting(null)} onSend={(to) => marketingService.testAutomation(testing.triggerType, to)} />}
    </Page>
  );
}

function Stat({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1 truncate">{label}</p>
      {children ?? <p className="text-sm font-extrabold text-slate-700 truncate">{value}</p>}
    </div>
  );
}

/* ── Automation config editor ─────────────────────────────────────────────────── */
function AutomationEditor({ auto, onClose, onSaved }) {
  const meta = AUTOMATION_META[auto.triggerType] || { label: auto.triggerType };
  const [enabled, setEnabled] = useState(!!auto.enabled);
  const [channel, setChannel] = useState(auto.channel || "WHATSAPP");
  const [daysBefore, setDaysBefore] = useState(auto.daysBefore ?? 0);
  const [sendTime, setSendTime] = useState(auto.sendTime || "09:00");
  const [subject, setSubject] = useState(auto.subject || "");
  const [body, setBody] = useState(auto.body || "");
  const [templateName, setTemplateName] = useState(auto.templateName || "");
  const [mergeTags, setMergeTags] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { marketingService.getMergeTags().then((res) => setMergeTags(res.data?.data ?? [])).catch(() => {}); }, []);

  const save = async () => {
    const e = {};
    if (!body.trim()) e.body = "Message body is required.";
    if (channel === "EMAIL" && !subject.trim()) e.subject = "Subject is required for email.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await marketingService.updateAutomation(auto.triggerType, {
        enabled, channel, daysBefore: Number(daysBefore) || 0, sendTime,
        subject: channel === "EMAIL" ? subject.trim() : null, body: body.trim(),
        templateName: channel === "WHATSAPP" ? (templateName.trim() || null) : null,
      });
      toast.success(`${meta.label} automation saved.`);
      onSaved();
    } catch (error) {
      if (!isAlreadyReported(error)) toast.error(getErrorMessage(error, "Couldn't save the automation."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal icon={Zap} title={`${meta.label} Automation`} subtitle="Auto-message customers on their special day" maxW="max-w-2xl" onClose={onClose}
      footer={<>
        <Btn variant="outline" className="w-full sm:w-auto flex-1 sm:flex-none" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={busy} className="w-full sm:w-auto flex-1 sm:flex-none">{busy ? "Saving…" : "Save automation"}</Btn>
      </>}>

      <Toggle label={`Enable ${meta.label.toLowerCase()} messages`} hint="When on, the daily job sends to every matching customer." checked={enabled} onChange={setEnabled} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Send" hint="Relative to the date">
          <Select value={String(daysBefore)} onChange={(e) => setDaysBefore(Number(e.target.value))}>
            <option value="0">On the day</option>
            <option value="1">1 day before</option>
            <option value="3">3 days before</option>
            <option value="7">7 days before</option>
          </Select>
        </Field>
        <Field label="Send at (time)"><input type="time" className={inputCls} value={sendTime} onChange={(e) => setSendTime(e.target.value)} /></Field>
        <Field label="Occasion"><input className={inputCls} value={meta.label} disabled /></Field>
      </div>

      <MessageComposer channel={channel} onChannel={setChannel} subject={subject} onSubject={setSubject}
        body={body} onBody={setBody} templateName={templateName} onTemplateName={setTemplateName} mergeTags={mergeTags} errors={errors} />
    </Modal>
  );
}