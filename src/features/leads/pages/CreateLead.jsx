// import { useState, useCallback } from "react";
// import { useForm ,useWatch} from "react-hook-form";
// import { useNavigate } from "react-router-dom";
// import { ArrowLeft as FiArrowLeft, Save as FiSave, CircleCheck as FiCheckCircle, Loader as FiLoader, FileText as FiFileText } from "lucide-react";
// import { leadService } from "../api/leadService";
// import { useToast } from "@shared/ui/toast";
// import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";

// import LeadInformation from "../components/LeadInformation";
// import TravelDetails from "../components/TravelDetails";
// import ServicesSection from "../components/ServicesSection";
// import ItinerarySection from "../components/ItinerarySection";
// import LeadSummary from "../components/LeadSummary";

// let nextId = 1;

// export default function CreateLead() {
//   const navigate = useNavigate();

//   const {
//     register, handleSubmit, watch, setValue, setError, getValues,
//     formState: { errors },
//     reset,
//   } = useForm({
//     // ── SMART DEFAULTS: form khulte hi ye auto-selected honge ──
//     // User change kar sakta hai; reset() ke baad bhi yehi defaults aayenge.
//     defaultValues: {
//       customerName: "", phone: "", email: "",
//       // ── budget field ──
//       budget: "",
//       leadSource: "Direct Call",   // ← default: Direct Call
//       leadType: "Fresh Lead",      // ← default: Fresh Lead
//       leadStage: "New Lead",
//       assignTo: "",
//       assignedUserId: "",          // ← logged-in user auto-select hota hai (LeadInformation mein)
//       birthDate: "",
//       travelDate: "", departCountry: "India", departCity: "",
//       // adults ab derived hai (male + female) — TravelDetails ise auto set karta hai
//       rooms: 1, male: 1, female: 1, adults: 2, children: 0, handicap: 0, infants: 0, extraBeds: 0,
//       notes: "",
//     },
//   });

//   console.log(handleSubmit)
//   const [selectedServices, setSelectedServices] = useState(["hotel"]);
//   const [itinerary, setItinerary] = useState([{ id: nextId++, destination: "", city: "", nights: 2 }]);
//   const [submitting, setSubmitting] = useState(false);
//   const [savingDraft, setSavingDraft] = useState(false);
//   const [searching, setSearching] = useState(false);

//   // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
//   // Argument order is (message, type) everywhere — see shared/ui/toast.jsx.
//   const { showToast } = useToast();

//   const toggleService = useCallback((id) => {
//     setSelectedServices((prev) =>
//       prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
//     );
//   }, []);

//   const addItineraryRow = () => {
//     setItinerary((prev) => [...prev, { id: nextId++, destination: "", city: "", nights: 2 }]);
//   };

//   const removeItineraryRow = (id) => {
//     setItinerary((prev) => prev.filter((r) => r.id !== id));
//   };

//   const updateItineraryRow = (id, field, value) => {
//     setItinerary((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
//   };

//   /**
//    * A 400 VALIDATION_ERROR carries `fieldErrors`, and those belong beside the input that caused
//    * them — never in a toast. Anything the form doesn't actually render (an unknown key, or a
//    * non-validation failure) still has to be said out loud, so that falls back to the toast.
//    */
//   const applyServerFieldErrors = (error, fallback) => {
//     const fieldErrors = getFieldErrors(error) || {};
//     const formFields = getValues();
//     const inline = Object.keys(fieldErrors).filter((name) => name in formFields);

//     inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));

//     if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
//   };

//   const onSubmit = async (data) => {
//     if (selectedServices.length === 0) {
//       showToast("Please select at least one service.", "error");
//       return;
//     }

//     setSubmitting(true);

//     try {
//       // ── budget is already inside `data` via register("budget") ──
//       // normalize empty string → null so the backend doesn't receive ""
//       const payload = {
//         ...data,
//         budget: data.budget === "" || data.budget == null ? null : Number(data.budget),
//       };

//       const response = await leadService.createLead(
//         payload,
//         selectedServices,
//         itinerary
//       );

//       console.log("Lead Created:", response.data);

//       showToast(`Lead for "${data.customerName}" created successfully!`, "success");

//       reset();
//       setSelectedServices(["hotel"]);
//       setItinerary([{ id: nextId++, destination: "", city: "", nights: 2 }]);

//       // ── Navigate to All Leads after 1.2s so user sees the success toast ──
//       setTimeout(() => navigate("/allleads"), 1200);

//     } catch (error) {
//       if (isAlreadyReported(error)) return;   // the interceptor's toast already said it

//       applyServerFieldErrors(error, "Failed to create lead. Try again.");

//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const onSaveDraft = async () => {
//     const data = watch();
//     setSavingDraft(true);
//     await new Promise((r) => setTimeout(r, 1000));
//     console.log("Draft saved:", data);
//     setSavingDraft(false);
//     showToast("Draft saved successfully!", "success");
//   };

//   const handlePhoneSearch = async (phone) => {
//     if (!phone?.trim()) return;

//     setSearching(true);

//     try {
//       const res = await leadService.searchByPhone(phone);

//       const lead = res.data;

//       setValue("customerName", lead.customerName || "");
//       setValue("email", lead.email || "");
//       setValue("leadSource", lead.leadSource || "");
//       setValue("leadType", lead.leadType || "");
//       setValue("leadStage", lead.leadStage || "");
//       setValue("assignTo", lead.assignTo || "");
//       // ── prefill budget on phone-match too ──
//       if (lead.budget != null) setValue("budget", lead.budget);

//       showToast(`Lead found: ${lead.customerName}`, "success");

//     } catch (error) {
//       if (isAlreadyReported(error)) return;

//       // "No match" is the expected 404 and is not a failure the user needs alarming about.
//       // Anything else (a 400, a conflict) must not be disguised as an empty result.
//       const notFound = error?.response?.status === 404;
//       showToast(
//         notFound
//           ? "No existing lead found for this phone number."
//           : getErrorMessage(error, "Couldn't search by phone number."),
//         notFound ? "info" : "error"
//       );

//     } finally {
//       setSearching(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 font-sans">
//       {/* Page Header */}
//       <div className="bg-white border-b border-slate-100">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-md shadow-blue-200">
//                 <FiFileText className="w-5 h-5 text-white" />
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create New Lead</h1>
//                 <p className="text-sm text-slate-500 mt-0.5">Manage customer travel enquiries efficiently</p>
//               </div>
//             </div>
//             <button onClick={() => navigate("/allleads")}
//               type="button"
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300
//                 text-sm font-semibold text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 transition-all shadow-sm"
//             >
//               <FiArrowLeft className="w-4 h-4" />
//               Back to Leads
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//         <form onSubmit={handleSubmit(onSubmit)} noValidate>
//           <div className="flex flex-col lg:flex-row gap-6">
//             {/* Left Column */}
//             <div className="flex-1 min-w-0 space-y-6">
//               <LeadInformation
//                 mode="create"
//                 register={register}
//                 errors={errors}
//                 watch={watch}
//                 setValue={setValue}
//                 onPhoneSearch={handlePhoneSearch}
//                 searching={searching}
//               />
//               <TravelDetails
//                 register={register}
//                 watch={watch}
//                 setValue={setValue}
//                 getValues={getValues}
//               />
//               <ServicesSection
//                 selectedServices={selectedServices}
//                 onToggle={toggleService}
//               />
//               <ItinerarySection
//                 itinerary={itinerary}
//                 onAdd={addItineraryRow}
//                 onRemove={removeItineraryRow}
//                 onUpdate={updateItineraryRow}
//               />

//               {/* Notes */}
//               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//                 <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-4 flex items-center gap-3">
//                   <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
//                     <FiFileText className="w-4 h-4 text-white" />
//                   </div>
//                   <div>
//                     <h2 className="text-white font-bold text-base">Customer Notes</h2>
//                     <p className="text-amber-100 text-xs">Special requirements, budget, preferences</p>
//                   </div>
//                 </div>
//                 <div className="p-6">
//                   <textarea
//                     {...register("notes")}
//                     rows={5}
//                     placeholder="Enter customer requirements, special requests, budget, preferred hotels, destinations, dietary needs, accessibility requirements, etc."
//                     className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
//                       focus:border-amber-400 focus:ring-2 focus:ring-amber-50 outline-none transition-all resize-none"
//                   />
//                 </div>
//               </div>

//               {/* Submit Buttons */}
//               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
//                 <div className="flex flex-col sm:flex-row items-center gap-3">
//                   <button
//                     type="button"
//                     onClick={onSaveDraft}
//                     disabled={savingDraft || submitting}
//                     className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl
//                       border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800
//                       font-semibold text-sm transition-all disabled:opacity-50 bg-white hover:bg-slate-50"
//                   >
//                     {savingDraft ? (
//                       <FiLoader className="w-4 h-4 animate-spin" />
//                     ) : (
//                       <FiSave className="w-4 h-4" />
//                     )}
//                     {savingDraft ? "Saving Draft..." : "Save Draft"}
//                   </button>

//                   <button
//                     type="submit"
//                     disabled={submitting || savingDraft}
//                     className="w-full sm:flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
//                       bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm
//                       transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300
//                       disabled:opacity-60 disabled:cursor-not-allowed"
//                   >
//                     {submitting ? (
//                       <>
//                         <FiLoader className="w-4 h-4 animate-spin" />
//                         Creating Lead...
//                       </>
//                     ) : (
//                       <>
//                         <FiCheckCircle className="w-4 h-4" />
//                         Create Lead
//                       </>
//                     )}
//                   </button>
//                 </div>

//                 <p className="text-center text-xs text-slate-400 mt-3">
//                   Fields marked with <span className="text-red-500">*</span> are required.
//                   Customer name and phone are mandatory.
//                 </p>
//               </div>
//             </div>

//             {/* Right Sidebar */}
//             <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
//               <div className="lg:sticky lg:top-20">
//                 <LeadSummary
//                   watch={watch}
//                   selectedServices={selectedServices}
//                   itinerary={itinerary}
//                 />
//               </div>
//             </div>
//           </div>
//         </form>
//       </div>

//       <style>{`
//         @keyframes slide-in {
//           from { transform: translateX(100%); opacity: 0; }
//           to { transform: translateX(0); opacity: 1; }
//         }
//         .animate-slide-in { animation: slide-in 0.3s ease-out; }
//       `}</style>
//     </div>
//   );
// }









// ─────────────────────────────────────────────────────────────────────────────
// OLD — replaced in create-form redesign. Kept verbatim, commented, for review/rollback.
//
// Why it was replaced (see the audit): validation only fired on submit (useForm had no mode),
// the duplicate lookup hung off a SECOND phone box and read the wrong envelope level so a match
// blanked the form, "Save Draft" toasted success while persisting nothing, there was no
// save-and-add-another, no autofocus, and the page ran ~3.5 screens tall behind six differently
// coloured gradient headers. The replacement lives directly below this block.
// ─────────────────────────────────────────────────────────────────────────────

// import { useState, useCallback } from "react";
// import { useForm } from "react-hook-form";
// import { useNavigate } from "react-router-dom";
// import {
//   ArrowLeft as FiArrowLeft,
//   Save as FiSave,
//   CircleCheck as FiCheckCircle,
//   Loader as FiLoader,
//   FileText as FiFileText,
// } from "lucide-react";
// import { leadService } from "../api/leadService";
// import { useToast } from "@shared/ui/toast";
// import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";
//
// import LeadInformation from "../components/LeadInformation";
// import TravelDetails from "../components/TravelDetails";
// import ServicesSection from "../components/ServicesSection";
// import ItinerarySection from "../components/ItinerarySection";
// import LeadSummary from "../components/LeadSummary";
//
// let nextId = 1;
//
// const toPayloadCount = (value, min = 0) => {
//   const numberValue = Number(value);
//
//   if (!Number.isFinite(numberValue)) {
//     return min;
//   }
//
//   return Math.max(min, Math.floor(numberValue));
// };
//
// const getCreateLeadPassengerTotals = (values = {}) => {
//   const male = toPayloadCount(values.male);
//   const female = toPayloadCount(values.female);
//   const totalAdults = male + female;
//   const children = toPayloadCount(values.children);
//   const infants = toPayloadCount(values.infants);
//
//   return {
//     totalAdults,
//     children,
//     infants,
//     rooms: toPayloadCount(values.rooms, 1),
//     extraBeds: toPayloadCount(values.extraBeds),
//   };
// };
//
// export default function CreateLead() {
//   const navigate = useNavigate();
//
//   const {
//     register, handleSubmit, watch, setValue, setError, getValues, clearErrors, trigger,
//     formState: { errors },
//     reset,
//   } = useForm({
//     // ── SMART DEFAULTS: form khulte hi ye auto-selected honge ──
//     // User change kar sakta hai; reset() ke baad bhi yehi defaults aayenge.
//     defaultValues: {
//       customerName: "", phone: "", email: "",
//       // ── budget field ──
//       budget: "",
//       leadSource: "Direct Call",   // ← default: Direct Call
//       leadType: "Fresh Lead",      // ← default: Fresh Lead
//       leadStage: "New Lead",
//       assignTo: "",
//       assignedUserId: "",          // ← logged-in user auto-select hota hai (LeadInformation mein)
//       birthDate: "",
//       anniversaryDate: "",
//       preferredCommunication: "",
//       followUpDate: "",
//       packageType: "",
//       travelDate: "", departCountry: "India", departCity: "",
//       departureMode: "",
//       departureAirport: "", airportCode: "", preferredFlightTime: "",
//       railwayStation: "", trainClass: "", preferredTrainTime: "",
//       pickupAddress: "", pickupDateTime: "", vehiclePreference: "",
//       male: 1,
//       female: 1,
//       totalAdults: 2,
//       children: 0,
//       infants: 0,
//       rooms: 1,
//       extraBeds: 0,
//       specialAssistanceRequired: false,
//       specialAssistanceTypes: [],
//       assistancePassengerCount: 0,
//       specialAssistanceNotes: "",
//       notes: "",
//     },
//   });
//
//   /* LeadSummary used to need a translating shim here, because this form called the fields
//      male/female/totalAdults while the summary read male/female/adults. The form and
//      the summary now share one set of names, so the shim is gone and `watch` goes straight in. */
//
//   const [selectedServices, setSelectedServices] = useState(["hotel"]);
//   const [itinerary, setItinerary] = useState([{ id: nextId++, destination: "", city: "", nights: 2 }]);
//   const [submitting, setSubmitting] = useState(false);
//   const [savingDraft, setSavingDraft] = useState(false);
//   const [searching, setSearching] = useState(false);
//
//   // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
//   // Argument order is (message, type) everywhere — see shared/ui/toast.jsx.
//   const { showToast } = useToast();
//
//   const toggleService = useCallback((id) => {
//     setSelectedServices((prev) =>
//       prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
//     );
//   }, []);
//
//   const addItineraryRow = () => {
//     setItinerary((prev) => [...prev, { id: nextId++, destination: "", city: "", nights: 2 }]);
//   };
//
//   const removeItineraryRow = (id) => {
//     setItinerary((prev) => prev.filter((r) => r.id !== id));
//   };
//
//   const updateItineraryRow = (id, field, value) => {
//     setItinerary((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
//   };
//
//   /**
//    * A 400 VALIDATION_ERROR carries `fieldErrors`, and those belong beside the input that caused
//    * them — never in a toast. Anything the form doesn't actually render (an unknown key, or a
//    * non-validation failure) still has to be said out loud, so that falls back to the toast.
//    */
//   const applyServerFieldErrors = (error, fallback) => {
//     const fieldErrors = getFieldErrors(error) || {};
//     const formFields = getValues();
//     const inline = Object.keys(fieldErrors).filter((name) => name in formFields);
//
//     inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));
//
//     if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
//   };
//
//   const onSubmit = async (data) => {
//     if (selectedServices.length === 0) {
//       showToast("Please select at least one service.", "error");
//       return;
//     }
//
//     setSubmitting(true);
//
//     try {
//       const passengerTotals = getCreateLeadPassengerTotals(data);
//
//       // Backend payload wiring for adult gender split and special assistance
//       // details will be added after the API contract exists.
//       // leadService keeps only currently supported lead fields before POST.
//       const payload = {
//         ...data,
//         rooms: passengerTotals.rooms,
//         adults: passengerTotals.totalAdults,
//         children: passengerTotals.children,
//         infants: passengerTotals.infants,
//         extraBeds: passengerTotals.extraBeds,
//         budget: data.budget === "" || data.budget == null ? null : Number(data.budget),
//       };
//
//       const response = await leadService.createLead(
//         payload,
//         selectedServices,
//         itinerary
//       );
//
//       console.log("Lead Created:", response.data);
//
//       // ── Follow-up date → LeadLog → Reminder ──
//       // Follow-up has no column on Lead, deliberately: the durable record is a LeadLog, and it is
//       // LeadLogServiceImpl that raises the Reminder. The lead payload drops the `followUpDate`
//       // key entirely, so this second call is the only reason the form's Follow-up Date field does
//       // anything at all. Avoids a second source of truth for the same fact.
//       const created = response?.data?.data ?? response?.data;
//       const leadPublicId = created?.id || created?.publicId;
//       if (leadPublicId && data.followUpDate) {
//         try {
//           await leadService.addLog(leadPublicId, {
//             comment: `Follow-up scheduled for ${data.followUpDate} at lead creation.`,
//             createReminder: true,
//             followUpDate: data.followUpDate,
//             stage: data.leadStage || null,
//           });
//         } catch {
//           // The lead itself is already saved — a failed follow-up log must not be reported as a
//           // failed create, or the agent re-submits and duplicates the lead.
//           showToast("Lead created, but the follow-up reminder could not be scheduled.", "warning");
//         }
//       }
//
//       showToast(`Lead for "${data.customerName}" created successfully!`, "success");
//
//       reset();
//       setSelectedServices(["hotel"]);
//       setItinerary([{ id: nextId++, destination: "", city: "", nights: 2 }]);
//
//       // ── Navigate to All Leads after 1.2s so user sees the success toast ──
//       setTimeout(() => navigate("/allleads"), 1200);
//
//     } catch (error) {
//       if (isAlreadyReported(error)) return;   // the interceptor's toast already said it
//
//       applyServerFieldErrors(error, "Failed to create lead. Try again.");
//
//     } finally {
//       setSubmitting(false);
//     }
//   };
//
//   const onSaveDraft = async () => {
//     const data = getValues();
//     setSavingDraft(true);
//     await new Promise((r) => setTimeout(r, 1000));
//     console.log("Draft saved:", data);
//     setSavingDraft(false);
//     showToast("Draft saved successfully!", "success");
//   };
//
//   const handlePhoneSearch = async (phone) => {
//     if (!phone?.trim()) return;
//
//     setSearching(true);
//
//     try {
//       const res = await leadService.searchByPhone(phone);
//
//       const lead = res.data;
//
//       setValue("customerName", lead.customerName || "");
//       setValue("email", lead.email || "");
//       setValue("leadSource", lead.leadSource || "");
//       setValue("leadType", lead.leadType || "");
//       setValue("leadStage", lead.leadStage || "");
//       setValue("assignTo", lead.assignTo || "");
//       // ── prefill budget on phone-match too ──
//       if (lead.budget != null) setValue("budget", lead.budget);
//
//       showToast(`Lead found: ${lead.customerName}`, "success");
//
//     } catch (error) {
//       if (isAlreadyReported(error)) return;
//
//       // "No match" is the expected 404 and is not a failure the user needs alarming about.
//       // Anything else (a 400, a conflict) must not be disguised as an empty result.
//       const notFound = error?.response?.status === 404;
//       showToast(
//         notFound
//           ? "No existing lead found for this phone number."
//           : getErrorMessage(error, "Couldn't search by phone number."),
//         notFound ? "info" : "error"
//       );
//
//     } finally {
//       setSearching(false);
//     }
//   };
//
//   return (
//     <div className="min-h-screen bg-slate-50 font-sans">
//       {/* Page Header */}
//       <div className="bg-white border-b border-slate-100">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-md shadow-blue-200">
//                 <FiFileText className="w-5 h-5 text-white" />
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create New Lead</h1>
//                 <p className="text-sm text-slate-500 mt-0.5">Manage customer travel enquiries efficiently</p>
//               </div>
//             </div>
//             <button onClick={() => navigate("/allleads")}
//               type="button"
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300
//                 text-sm font-semibold text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 transition-all shadow-sm"
//             >
//               <FiArrowLeft className="w-4 h-4" />
//               Back to Leads
//             </button>
//           </div>
//         </div>
//       </div>
//
//       {/* Main Content */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//         <form onSubmit={handleSubmit(onSubmit)} noValidate>
//           <div className="flex flex-col lg:flex-row gap-6">
//             {/* Left Column */}
//             <div className="flex-1 min-w-0 space-y-6">
//               <LeadInformation
//                 mode="create"
//                 register={register}
//                 errors={errors}
//                 watch={watch}
//                 setValue={setValue}
//                 onPhoneSearch={handlePhoneSearch}
//                 searching={searching}
//               />
//               <TravelDetails
//                 register={register}
//                 watch={watch}
//                 setValue={setValue}
//                 getValues={getValues}
//                 errors={errors}
//                 clearErrors={clearErrors}
//                 trigger={trigger}
//               />
//               <ServicesSection
//                 selectedServices={selectedServices}
//                 onToggle={toggleService}
//               />
//               <ItinerarySection
//                 itinerary={itinerary}
//                 onAdd={addItineraryRow}
//                 onRemove={removeItineraryRow}
//                 onUpdate={updateItineraryRow}
//               />
//
//               {/* Notes */}
//               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//                 <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-4 flex items-center gap-3">
//                   <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
//                     <FiFileText className="w-4 h-4 text-white" />
//                   </div>
//                   <div>
//                     <h2 className="text-white font-bold text-base">Customer Notes</h2>
//                     <p className="text-amber-100 text-xs">Special requirements, budget, preferences</p>
//                   </div>
//                 </div>
//                 <div className="p-6">
//                   <textarea
//                     {...register("notes")}
//                     rows={5}
//                     placeholder="Enter customer requirements, special requests, budget, preferred hotels, destinations, dietary needs, accessibility requirements, etc."
//                     className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
//                       focus:border-amber-400 focus:ring-2 focus:ring-amber-50 outline-none transition-all resize-none"
//                   />
//                 </div>
//               </div>
//
//               {/* Submit Buttons */}
//               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
//                 <div className="flex flex-col sm:flex-row items-center gap-3">
//                   <button
//                     type="button"
//                     onClick={onSaveDraft}
//                     disabled={savingDraft || submitting}
//                     className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl
//                       border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800
//                       font-semibold text-sm transition-all disabled:opacity-50 bg-white hover:bg-slate-50"
//                   >
//                     {savingDraft ? (
//                       <FiLoader className="w-4 h-4 animate-spin" />
//                     ) : (
//                       <FiSave className="w-4 h-4" />
//                     )}
//                     {savingDraft ? "Saving Draft..." : "Save Draft"}
//                   </button>
//
//                   <button
//                     type="submit"
//                     disabled={submitting || savingDraft}
//                     className="w-full sm:flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
//                       bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm
//                       transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300
//                       disabled:opacity-60 disabled:cursor-not-allowed"
//                   >
//                     {submitting ? (
//                       <>
//                         <FiLoader className="w-4 h-4 animate-spin" />
//                         Creating Lead...
//                       </>
//                     ) : (
//                       <>
//                         <FiCheckCircle className="w-4 h-4" />
//                         Create Lead
//                       </>
//                     )}
//                   </button>
//                 </div>
//
//                 <p className="text-center text-xs text-slate-400 mt-3">
//                   Fields marked with <span className="text-red-500">*</span> are required.
//                   Customer name and phone are mandatory.
//                 </p>
//               </div>
//             </div>
//
//             {/* Right Sidebar */}
//             <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
//               <div className="lg:sticky lg:top-20">
//                 <LeadSummary
//                   watch={watch}
//                   selectedServices={selectedServices}
//                   itinerary={itinerary}
//                 />
//               </div>
//             </div>
//           </div>
//         </form>
//       </div>
//
//       <style>{`
//         @keyframes slide-in {
//           from { transform: translateX(100%); opacity: 0; }
//           to { transform: translateX(0); opacity: 1; }
//         }
//         .animate-slide-in { animation: slide-in 0.3s ease-out; }
//       `}</style>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — create-form redesign.
//
// Built on the idiom the live booking form already uses (CreateBookingClean + Fast*): flat panels,
// one border, no gradient headers, dense grids. Deliberately NOT a new style language.
//
// What a clerk gets that they did not have:
//   · autofocus on Phone, and Enter advances field-to-field instead of submitting
//   · Ctrl/⌘+Enter saves; Ctrl/⌘+Shift+Enter saves and immediately starts the next record
//   · sticky source/type/assignee/departure carried into the next record (sessionStorage)
//   · duplicate check on the REAL phone field, debounced, shown as an inline strip — prefill is
//     opt-in, so a match can no longer silently overwrite what was typed
//   · validation on blur, inline, never as a toast
//
// LeadInformation / TravelDetails / ItinerarySection / ServicesSection / LeadSummary are all left
// untouched on purpose: EditLead.jsx renders the same five components, and redesigning them here
// would silently redesign Edit too. The panels below are local to this screen.
// ─────────────────────────────────────────────────────────────────────────────




import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accessibility,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  ExternalLink,
  Globe2,
  IndianRupee,
  LoaderCircle,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  Plane,
  Plus,
  RotateCcw,
  Route,
  Search,
  TrainFront,
  Trash2,
  TriangleAlert,
  UserCheck,
  Zap,
} from "lucide-react";

import { leadService } from "../api/leadService";
import { useLeadSources } from "../lib/useLeadSources";
import SearchableSelect from "../components/SearchableSelect";
import QuickDestinationModal from "../../masters/components/QuickDestinationModal";
import QuickCityModal from "../../masters/components/QuickCityModal";
// Cross-feature, through the barrel — customers owns "does this person already exist?" and the
// lead form only asks the question.
import { customerService } from "@features/customers";
import { geographyService } from "@shared/api/geographyService";
import { hasPermission, P } from "@shared/lib/access";
import { buildAdultPayload, deriveAdultBreakdown, getAdultBreakdownError } from "@shared/lib/adultBreakdown";
import TravellerCountFields from "@shared/ui/TravellerCountFields";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";
import { phoneRule } from "@shared/lib/phone";

// Backend LeadType — the priority vocabulary, exactly four values. Keep in step with
// LeadInformation.jsx, AllLeads.jsx and the leads_lead_type_check constraint.
const LEAD_TYPES = ["Fresh", "Hot", "Warm", "Cold"];
const LEAD_STAGES = [
  "New Lead", "Contacted", "Follow Up", "Qualified",
  "Proposal Sent", "Converted", "Reopened", "Lost",
];
// Must be the backend CommunicationPreference display values verbatim — the lead's choice is copied
// straight onto Customer.commPref at conversion, and both sides share one CHECK constraint.
// "Call" was NOT one of them ("Phone Call" is), so picking it 400'd the save with an opaque
// deserialization error carrying no field to show it against.
const COMMUNICATION_PREFERENCES = ["WhatsApp", "Phone Call", "Email", "SMS", "All Channels"];
const PACKAGE_TYPES = ["Family", "Honeymoon", "Group", "Corporate", "Pilgrimage", "Adventure"];
const DEPARTURE_MODES = ["Flight / Airport", "Train / Rail", "Car / Road", "Bus", "Other"];
const ASSISTANCE_TYPES = [
  "Wheelchair Assistance",
  "Senior Citizen Assistance",
  "Special Meal Requirement",
  "Airport Assistance",
];

// ids, not labels — the backend stores these lowercase keys and AllLeads colours off them.
const SERVICES = [
  { id: "hotel", label: "Hotel" },
   { id: "vehicle", label: "Vehicle" },
   { id: "sightseeing", label: "Sightseeing" },
  { id: "flight", label: "Flight" },
  { id: "cruise", label: "Cruise" },
  { id: "visa", label: "Visa" },
  
 
  { id: "insurance", label: "Insurance" },
  { id: "passport", label: "Passport" },
];

const SERVICE_ID_MAP = {
  hotel: "hotel",
  flight: "flight",
  cruise: "cruise",
  visa: "visa",
  sightseeing: "sightseeing",
  vehicle: "vehicle",
  "vehicle rental": "vehicle",
  insurance: "insurance",
  "travel insurance": "insurance",
  passport: "passport",
  "passport assistance": "passport",
};

const normalizeServiceId = (service) => {
  const raw = typeof service === "string"
    ? service
    : service?.id ?? service?.code ?? service?.value ?? service?.label ?? service?.name ?? "";
  const normalized = String(raw).trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  return SERVICE_ID_MAP[normalized] || normalized;
};

const entityName = (value, fallback = "") => {
  if (typeof value === "string") return value.trim();
  return String(value?.name ?? value?.label ?? value?.title ?? fallback ?? "").trim();
};

const toDateInput = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const MODE_FIELDS = {
  "Flight / Airport": ["departureAirport", "airportCode", "preferredFlightTime"],
  "Train / Rail": ["railwayStation", "trainClass", "preferredTrainTime"],
  "Car / Road": ["pickupAddress", "pickupDateTime", "vehiclePreference"],
};

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";
const today = () => new Date().toISOString().slice(0, 10);

// Shape of "nobody matched". A frozen module constant so every reset points at the same object and
// no effect can accidentally leave half of it behind.
const EMPTY_MATCH = Object.freeze({ lead: null, customer: null });
// Enough to decide the email is worth probing — the field's own @Email rule is the real gate.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return "";
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
};
const MATCH_LABEL = { PHONE: "this phone number", EMAIL: "this email address", BOTH: "this phone and email" };
export const toInt = (value, min = 0) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, n) : min;
};
const extractArray = (value) => {
  const candidates = [value, value?.data, value?.data?.data, value?.content, value?.data?.content];
  return candidates.find(Array.isArray) ?? [];
};
const idOf = (item) => item?.id ?? item?.destinationId ?? item?.cityId ?? item?.publicId ?? "";

/* Sticky fields — the single biggest lever on a 50-100/day screen. A clerk working a batch keeps
   the same source, the same assignee and the same departure city for a whole run, so those ride
   into the next record instead of being retyped. sessionStorage (not local) so it dies with the
   tab and never leaks between staff on a shared machine. */
const STICKY_KEY = "leadEntry:sticky";
const SESSION_COUNT_KEY = "leadEntry:savedCount";
const STICKY_FIELDS = [
  "leadSource", "leadType", "assignedUserId", "departCountry",
  "departCity", "packageType", "preferredCommunication",
];
const readSticky = () => {
  try {
    const raw = sessionStorage.getItem(STICKY_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw);
    return Object.fromEntries(
      STICKY_FIELDS.filter((key) => stored[key]).map((key) => [key, stored[key]])
    );
  } catch { return {}; }
};
const readStickyServices = () => {
  try {
    const raw = sessionStorage.getItem(STICKY_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const validIds = new Set(SERVICES.map(({ id }) => id));
    const selected = Array.isArray(stored.services)
      ? stored.services.filter((id) => validIds.has(id))
      : [];
    return selected.length > 0 ? selected : ["hotel"];
  } catch { return ["hotel"]; }
};
const writeSticky = (values, services) => {
  try {
    const slice = {};
    STICKY_FIELDS.forEach((key) => { if (values[key]) slice[key] = values[key]; });
    slice.services = Array.isArray(services) && services.length > 0 ? services : ["hotel"];
    sessionStorage.setItem(STICKY_KEY, JSON.stringify(slice));
  } catch { /* private mode — sticky is a convenience, never a requirement */ }
};
const readSessionCount = () => {
  try { return toInt(sessionStorage.getItem(SESSION_COUNT_KEY)); }
  catch { return 0; }
};

export const blankDefaults = () => ({
  customerName: "", phone: "", email: "", budget: "",
  leadSource: "", leadType: "Fresh", leadStage: "New Lead",
  assignedUserId: "", birthDate: "", anniversaryDate: "",
  preferredCommunication: "", followUpDate: "", packageType: "",
  travelDate: "", departCountry: "India", departCity: "",
  departureMode: "", departureAirport: "", airportCode: "", preferredFlightTime: "",
  railwayStation: "", trainClass: "", preferredTrainTime: "",
  pickupAddress: "", pickupDateTime: "", vehiclePreference: "",
  showAdultBreakdown: false, male: null, female: null,
  totalAdults: 2, children: 0, infants: 0, rooms: 1, extraBeds: 0,
  specialAssistanceRequired: false, specialAssistanceTypes: [],
  assistancePassengerCount: 0, specialAssistanceNotes: "",
  notes: "",
});

let nextRowId = 1;
export const blankRow = () => ({ id: nextRowId++, destinationId: "", destination: "", cityId: "", city: "", nights: 2 });

// ── Local presentational primitives — same shapes as CreateBookingClean's Panel/Field ──────────
const controlBase =
  "w-full rounded-lg border bg-white py-2.5 text-sm text-slate-800 outline-none transition " +
  "hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const control = (invalid, icon) =>
  `${controlBase} ${icon ? "pl-9 pr-3" : "px-3"} ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200"}`;

function Panel({ icon: Icon, title, description, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
function Field({ id, label, required, optional, error, hint, children }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
/* Counter tile. Click-to-select on focus so the clerk overtypes instead of having to clear first —
   copied from FastTravelDetails, where it already earns its keep. */
function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
        selected
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
      }`}
    >
      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}
// Module scope, not component scope — it is a constant, and keeping it out of the components
// means focusNext's useCallback does not need it as a dependency.
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Every field of the lead form, in one place.
 *
 * Exported so EditLead renders THIS definition rather than a copy. That is not tidiness — the
 * comment at the bottom of TravelDetails.jsx records what happened last time Create and Edit each
 * owned their own version of these fields: they drifted onto different names (adultMale/adultFemale
 * vs male/female, totalAdults vs adults), the transformer could only read one set, and every lead
 * update silently wrote 0 over the other. One definition makes that class of bug impossible.
 *
 * The page owns the form, the save path and the keyboard; this owns the reference data and the
 * markup. `belowPhone` is a slot the create page fills with its duplicate strip.
 */
export function LeadFormPanels({
  register,
  errors,
  watch,
  setValue,
  getValues,
  clearErrors,
  services,
  onToggleService,
  itinerary,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  phoneRef,
  belowPhone = null,
  compactRail = false,
  rapidEntry = false,
}) {
  const { withCurrent: sourceOptionsFor, loading: sourcesLoading, error: sourcesError } = useLeadSources();

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [forcedSelf, setForcedSelf] = useState(false);
  const [selfUser, setSelfUser] = useState(null);

  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [rowCities, setRowCities] = useState({});
  const [loadingRows, setLoadingRows] = useState({});
  const [destinationModalRow, setDestinationModalRow] = useState(null);
  const [cityModalRow, setCityModalRow] = useState(null);

  const departureMode = watch("departureMode");
  const assistanceRequired = watch("specialAssistanceRequired");
  const assistanceTypes = watch("specialAssistanceTypes") || [];

  const showAdultBreakdown = Boolean(watch("showAdultBreakdown"));
  const totalAdults = toInt(watch("totalAdults"));
  const totalTravellers = totalAdults + toInt(watch("children")) + toInt(watch("infants"));

  /* specialAssistanceTypes is written with setValue from the chip row, so it has no rendered input
     to hang rules off — it has to be registered explicitly or it is never validated at all, and the
     red asterisk below would be decoration. */
  useEffect(() => {
    register("specialAssistanceTypes", {
      validate: (types) =>
        getValues("specialAssistanceRequired") !== true ||
        (Array.isArray(types) && types.length > 0) ||
        "Select at least one assistance type",
    });
  }, [getValues, register]);

  useEffect(() => {
    register("totalAdults", {
      validate: () => getAdultBreakdownError(getValues()) || true,
    });
  }, [getValues, register]);

  // ── Reference data. Independent effects, so they run in parallel; none blocks typing. ─────────
  useEffect(() => {
    let active = true;
    geographyService.getCountries()
      .then((response) => {
        if (!active) return;
        const list = extractArray(response)
          .map((c) => (typeof c === "string" ? c : c?.label || c?.name || c?.countryName))
          .filter(Boolean)
          .map((name) => ({ value: name, label: name }));
        setCountries(list);
      })
      .catch(() => { if (active) setCountries([]); })
      .finally(() => { if (active) setLoadingCountries(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadFallback = async () => {
      try {
        const response = await leadService.getUsers();
        const list = extractArray(response);
        if (!active) return;
        setUsers(list.map((u) => ({ value: u.publicId || u.id, label: u.fullName || u.name || u.username })));
      } catch { if (active) setUsers([]); }
    };

    leadService.getAssignmentRecommendation()
      .then((response) => {
        if (!active) return;
        const rec = response?.data?.data ?? response?.data ?? {};
        if (rec.forcedSelf) {
          const self = rec.self || {};
          setForcedSelf(true);
          setSelfUser({ id: self.id, name: self.name });
          if (self.id && !getValues("assignedUserId")) {
            setValue("assignedUserId", self.id, { shouldValidate: true });
          }
          return;
        }
        const pool = Array.isArray(rec.eligibleUsers) ? rec.eligibleUsers : [];
        setUsers(pool.map((u) => ({
          value: u.id,
          label: typeof u.activeLeads === "number" ? `${u.name} · ${u.activeLeads} active` : u.name,
        })));
        if (!getValues("assignedUserId") && rec.recommendedUserId) {
          setValue("assignedUserId", rec.recommendedUserId, { shouldValidate: true });
        }
      })
      .catch(() => active && loadFallback())
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [getValues, setValue]);

  useEffect(() => {
    let active = true;
    geographyService.getAllDestinations()
      .then((response) => { if (active) setDestinations(extractArray(response)); })
      .catch(() => { if (active) setDestinations([]); })
      .finally(() => { if (active) setLoadingDestinations(false); });
    return () => { active = false; };
  }, []);

  // Switching mode clears the other modes' fields so a Flight lead cannot ship a railway station.
  useEffect(() => {
    const keep = new Set(MODE_FIELDS[departureMode] || []);
    Object.values(MODE_FIELDS).flat().forEach((field) => {
      if (!keep.has(field) && getValues(field)) {
        setValue(field, "", { shouldDirty: true, shouldValidate: false });
      }
    });
  }, [departureMode, getValues, setValue]);

  useEffect(() => {
    if (assistanceRequired) return;
    setValue("specialAssistanceTypes", []);
    setValue("assistancePassengerCount", 0);
    setValue("specialAssistanceNotes", "");
    clearErrors?.(["specialAssistanceTypes", "assistancePassengerCount"]);
  }, [assistanceRequired, clearErrors, setValue]);

  // ── Itinerary row helpers ─────────────────────────────────────────────────────────────────────
  const loadCities = useCallback(async (rowId, destinationId) => {
    if (!destinationId) { setRowCities((c) => ({ ...c, [rowId]: [] })); return []; }
    setLoadingRows((c) => ({ ...c, [rowId]: true }));
    try {
      const cities = extractArray(await geographyService.getCitiesByDestination(destinationId));
      setRowCities((c) => ({ ...c, [rowId]: cities }));
      return cities;
    } catch {
      setRowCities((c) => ({ ...c, [rowId]: [] }));
      return [];
    } finally {
      setLoadingRows((c) => ({ ...c, [rowId]: false }));
    }
  }, []);

  /* Edit opens with rows that carry names but often no ids, because that is what the API returns.
     Resolve them once against the destination master so the selects show the saved values instead
     of rendering blank and inviting the user to re-pick a destination that was already right. */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || loadingDestinations || destinations.length === 0) return;
    const needy = itinerary.filter((row) => !row.destinationId && row.destination);
    if (needy.length === 0) { hydratedRef.current = true; return; }

    hydratedRef.current = true;
    needy.forEach(async (row) => {
      const match = destinations.find(
        (d) => String(d?.name || "").trim().toLowerCase() === String(row.destination).trim().toLowerCase()
      );
      if (!match) return;
      const destinationId = String(idOf(match));
      onUpdateRow(row.id, { destinationId });
      const cities = await loadCities(row.id, destinationId);
      if (!row.city) return;
      const city = cities.find(
        (c) => String(c?.name || "").trim().toLowerCase() === String(row.city).trim().toLowerCase()
      );
      if (city) onUpdateRow(row.id, { cityId: String(idOf(city)) });
    });
  }, [destinations, itinerary, loadCities, loadingDestinations, onUpdateRow]);

  const chooseDestination = async (rowId, destinationId) => {
    const destination = destinations.find((d) => String(idOf(d)) === String(destinationId));
    onUpdateRow(rowId, {
      destinationId: destinationId ? String(destinationId) : "",
      destination: destination?.name || "",
      cityId: "",
      city: "",
    });
    await loadCities(rowId, destinationId);
  };

  const chooseCity = (rowId, cityId) => {
    const city = (rowCities[rowId] || []).find((c) => String(idOf(c)) === String(cityId));
    onUpdateRow(rowId, { cityId: cityId ? String(cityId) : "", city: city?.name || "" });
  };

  const onDestinationCreated = async (saved) => {
    const rowId = destinationModalRow;
    setDestinations((list) => [...list, saved]);
    setDestinationModalRow(null);
    if (rowId != null) await chooseDestination(rowId, idOf(saved));
  };

  const onCityCreated = (saved) => {
    const rowId = cityModalRow;
    setCityModalRow(null);
    if (rowId == null) return;
    setRowCities((c) => ({ ...c, [rowId]: [...(c[rowId] || []), saved] }));
    onUpdateRow(rowId, { cityId: String(idOf(saved)), city: saved.name || "" });
  };

  const cityModalDestination = useMemo(() => {
    if (cityModalRow == null) return null;
    const row = itinerary.find((r) => r.id === cityModalRow);
    return destinations.find((d) => String(idOf(d)) === String(row?.destinationId)) || null;
  }, [cityModalRow, destinations, itinerary]);

  const toggleAssistance = (type) => {
    const next = assistanceTypes.includes(type)
      ? assistanceTypes.filter((t) => t !== type)
      : [...assistanceTypes, type];
    setValue("specialAssistanceTypes", next, { shouldDirty: true, shouldValidate: true });
  };

  const setAdultCount = (name, value) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: name === "totalAdults",
    });
    if (name !== "totalAdults") setValue("totalAdults", getValues("totalAdults"), { shouldValidate: true });
  };

  const toggleAdultBreakdown = (checked) => {
    setValue("showAdultBreakdown", checked, { shouldDirty: true });
    setValue("male", checked ? toInt(getValues("male")) : null, { shouldDirty: true });
    setValue("female", checked ? toInt(getValues("female")) : null, { shouldDirty: true });
    setValue("totalAdults", getValues("totalAdults"), { shouldValidate: true });
  };

  // Was `pattern: /^[+\d\s\-()]{7,20}$/`, which accepted spaces, dashes and brackets that the
  // server's @Pattern ("^\\+?[1-9]\\d{7,14}$") rejects — including this field's OWN placeholder,
  // "+91 98765 43210". phoneRule validates the normalised value against the server's exact
  // pattern, so what the placeholder shows now genuinely saves.
  const phoneReg = register("phone", phoneRule);

  // Name must not contain numbers. Registered here so the input can wrap onChange to STRIP digits
  // as they're typed; the pattern is the on-submit backstop, the backend @Pattern is the real gate.
  const nameReg = register("customerName", {
    required: "Customer name is required",
    pattern: { value: /^[\p{L}\s.'-]+$/u, message: "Customer name cannot contain numbers" },
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] lg:items-start">
      {/* ── 1 · Customer ──────────────────────────────────────────────────────────────────────── */}
      <div className={`min-w-0 ${compactRail ? "lg:col-start-1" : "lg:col-span-2"}`}>
      <Panel
        icon={CircleUserRound}
        title="Customer"
        description="Phone first — an existing lead on this number is flagged as you type"
      >
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${rapidEntry ? "lg:grid-cols-2" : "lg:grid-cols-4"}`}>
          <Field id="phone" label="Phone" required error={errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...phoneReg}
                onChange={(e) => { e.target.value = e.target.value.replace(/[^+\d\s\-()]/g, ""); phoneReg.onChange(e); }}
                ref={(node) => { phoneReg.ref(node); if (phoneRef) phoneRef.current = node; }}
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                className={control(errors.phone, true)}
              />
            </div>
          </Field>

          <Field id="customerName" label="Customer Name" required error={errors.customerName?.message}>
            <input
              {...nameReg}
              onChange={(e) => { e.target.value = e.target.value.replace(/[0-9]/g, ""); nameReg.onChange(e); }}
              id="customerName"
              autoComplete="name"
              placeholder="Full name"
              aria-invalid={Boolean(errors.customerName)}
              aria-describedby={errors.customerName ? "customerName-error" : undefined}
              className={control(errors.customerName)}
            />
          </Field>

          {!rapidEntry && (
            <>
              <Field id="email" label="Email" optional error={errors.email?.message}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register("email", {
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                    })}
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@email.com"
                    aria-invalid={Boolean(errors.email)}
                    className={control(errors.email, true)}
                  />
                </div>
              </Field>

              <Field id="budget" label="Budget (₹)" optional error={errors.budget?.message}>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register("budget", { min: { value: 0, message: "Budget cannot be negative" } })}
                    id="budget"
                    type="number"
                    min={0}
                    step="1000"
                    inputMode="numeric"
                    placeholder="150000"
                    onWheel={(event) => event.currentTarget.blur()}
                    className={control(errors.budget, true)}
                  />
                </div>
              </Field>
            </>
          )}
        </div>

        {belowPhone}

        {!rapidEntry && <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="birthDate" label="Birth Date" optional>
            <input {...register("birthDate")} id="birthDate" type="date" max={today()} className={control(false)} />
          </Field>
          <Field id="anniversaryDate" label="Anniversary" optional>
            <input {...register("anniversaryDate")} id="anniversaryDate" type="date" max={today()} className={control(false)} />
          </Field>
          <Field id="preferredCommunication" label="Preferred Channel" optional>
            <div className="relative">
              <select {...register("preferredCommunication")} id="preferredCommunication" className={`${control(false)} appearance-none pr-9`}>
                <option value="">Select channel</option>
                {COMMUNICATION_PREFERENCES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>
          <Field id="followUpDate" label="Follow-up Date" optional hint="Creates a reminder on save">
            <input {...register("followUpDate")} id="followUpDate" type="date" min={today()} className={control(false)} />
          </Field>
        </div>}
      </Panel>
      </div>

      {/* ── 2 · Trip ──────────────────────────────────────────────────────────────────────────── */}
      <div className={`min-w-0 ${compactRail ? "lg:col-start-1" : "lg:col-span-2"}`}>
      <Panel
        icon={Route}
        title="Trip"
        description="Dates, departure and party size"
        action={
          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {totalTravellers} traveller{totalTravellers === 1 ? "" : "s"} · {toInt(watch("rooms"), 1)} room
            {toInt(watch("rooms"), 1) === 1 ? "" : "s"}
          </span>
        }
      >
        <div className={rapidEntry ? "max-w-sm" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"}>
          <Field id="travelDate" label="Travel Date" required error={errors.travelDate?.message}>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...register("travelDate", { required: "Travel date is required" })}
                id="travelDate"
                type="date"
                aria-invalid={Boolean(errors.travelDate)}
                className={control(errors.travelDate, true)}
              />
            </div>
          </Field>

          {!rapidEntry && (
            <>
              <Field id="departCountry" label="Departing Country" optional>
                <SearchableSelect
                  options={countries}
                  value={watch("departCountry") || ""}
                  onChange={(value) => setValue("departCountry", value, { shouldDirty: true })}
                  placeholder="Select country"
                  loading={loadingCountries}
                  icon={Globe2}
                  searchable
                />
              </Field>

              <Field id="departCity" label="Departing City" optional>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input {...register("departCity")} id="departCity" placeholder="e.g. Pune" className={control(false, true)} />
                </div>
              </Field>

              <Field id="departureMode" label="Departure Mode" optional>
                <div className="relative">
                  <select {...register("departureMode")} id="departureMode" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select mode</option>
                    {DEPARTURE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>
            </>
          )}
        </div>

        {!rapidEntry && departureMode === "Flight / Airport" && (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-sky-100 bg-sky-50/50 p-3 sm:grid-cols-3">
            <Field id="departureAirport" label="Departure Airport" optional>
              <div className="relative">
                <Plane className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input {...register("departureAirport")} id="departureAirport" placeholder="Airport name" className={control(false, true)} />
              </div>
            </Field>
            <Field id="airportCode" label="Airport Code" optional>
              <input {...register("airportCode")} id="airportCode" maxLength={8} placeholder="DEL" className={`${control(false)} uppercase`} />
            </Field>
            <Field id="preferredFlightTime" label="Preferred Time" optional>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input {...register("preferredFlightTime")} id="preferredFlightTime" type="time" className={control(false, true)} />
              </div>
            </Field>
          </div>
        )}

        {!rapidEntry && departureMode === "Train / Rail" && (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-violet-100 bg-violet-50/50 p-3 sm:grid-cols-3">
            <Field id="railwayStation" label="Railway Station" optional>
              <div className="relative">
                <TrainFront className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input {...register("railwayStation")} id="railwayStation" placeholder="Station name" className={control(false, true)} />
              </div>
            </Field>
            <Field id="trainClass" label="Train Class" optional>
              <input {...register("trainClass")} id="trainClass" placeholder="2A, 3A, Sleeper" className={control(false)} />
            </Field>
            <Field id="preferredTrainTime" label="Preferred Time" optional>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input {...register("preferredTrainTime")} id="preferredTrainTime" type="time" className={control(false, true)} />
              </div>
            </Field>
          </div>
        )}

        {!rapidEntry && departureMode === "Car / Road" && (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-3">
            <Field id="pickupAddress" label="Pickup Address" optional>
              <input {...register("pickupAddress")} id="pickupAddress" placeholder="Pickup address" className={control(false)} />
            </Field>
            <Field id="pickupDateTime" label="Pickup Date & Time" optional>
              <input {...register("pickupDateTime")} id="pickupDateTime" type="datetime-local" className={control(false)} />
            </Field>
            <Field id="vehiclePreference" label="Vehicle Preference" optional>
              <input {...register("vehiclePreference")} id="vehiclePreference" placeholder="Sedan, SUV, Traveller" className={control(false)} />
            </Field>
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Travellers &amp; Rooms</h3>
            <p className="text-[11px] text-slate-400">Click a number and type to replace it</p>
          </div>
          <TravellerCountFields
            values={{
              totalAdults: watch("totalAdults"),
              showAdultBreakdown,
              male: watch("male"),
              female: watch("female"),
              children: watch("children"),
              infants: watch("infants"),
              rooms: watch("rooms"),
              extraBeds: watch("extraBeds"),
            }}
            onCountChange={setAdultCount}
            onToggleBreakdown={toggleAdultBreakdown}
          />
        </div>

        {!rapidEntry && <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(assistanceRequired)}
              onChange={(event) => {
                setValue("specialAssistanceRequired", event.target.checked, { shouldDirty: true });
                if (event.target.checked && toInt(getValues("assistancePassengerCount")) < 1) {
                  setValue("assistancePassengerCount", 1);
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Accessibility className="h-4 w-4 text-blue-600" /> Special assistance required
          </label>

          {assistanceRequired && (
            <div className="mt-3 grid gap-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3 lg:grid-cols-[1fr_140px_1fr]">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">
                  Assistance Type <span className="text-red-500">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {ASSISTANCE_TYPES.map((type) => (
                    <Chip key={type} selected={assistanceTypes.includes(type)} onClick={() => toggleAssistance(type)}>
                      {type}
                    </Chip>
                  ))}
                </div>
                {errors.specialAssistanceTypes && (
                  <p className="mt-1 text-xs text-red-500">{errors.specialAssistanceTypes.message}</p>
                )}
              </div>
              <Field id="assistancePassengerCount" label="Passengers" error={errors.assistancePassengerCount?.message}>
                <input
                  {...register("assistancePassengerCount", {
                    validate: (value) => {
                      if (getValues("specialAssistanceRequired") !== true) return true;
                      const count = toInt(value, 0);
                      if (count < 1) return "At least one passenger needs assistance";
                      if (count > totalTravellers) return "Cannot exceed the total travellers";
                      return true;
                    },
                  })}
                  id="assistancePassengerCount"
                  type="number"
                  min={1}
                  max={Math.max(1, totalTravellers)}
                  onFocus={(event) => event.target.select()}
                  onWheel={(event) => event.currentTarget.blur()}
                  className={control(false)}
                />
              </Field>
              <Field id="specialAssistanceNotes" label="Assistance Notes" optional error={errors.specialAssistanceNotes?.message}>
                <input
                  {...register("specialAssistanceNotes", { maxLength: { value: 500, message: "Max 500 characters" } })}
                  id="specialAssistanceNotes"
                  placeholder="Specific support required"
                  className={control(errors.specialAssistanceNotes)}
                />
              </Field>
            </div>
          )}
        </div>}
      </Panel>
      </div>

      {/* ── 3 · Itinerary + Pipeline ──────────────────────────────────────────────────────────── */}
      <div className="min-w-0 lg:col-start-1">
        <Panel
          icon={MapPinned}
          title="Itinerary"
          // Says so out loud now that an untouched row is genuinely ignored on save. It used to be
          // silently mandatory: leaving this panel alone posted a blank row and the server rejected
          // the entire lead.
          description="Optional — leave blank if the route is not decided yet"
          action={
            <button
              type="button"
              onClick={onAddRow}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Stop
            </button>
          }
        >
          <div className="mb-2 hidden grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_96px_34px] gap-3 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
            <span>#</span><span>Destination</span><span>City</span><span>Nights</span><span />
          </div>

          {/* id is the scroll target for the half-filled-row check in save(). */}
          <div id="itinerary-group" className="space-y-2.5">
            {itinerary.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_96px_34px] md:items-center md:border-0 md:bg-transparent md:p-0"
              >
                <span className="hidden h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 md:flex">
                  {index + 1}
                </span>

                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Destination</span>
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        options={destinations}
                        value={row.destinationId ? Number(row.destinationId) || row.destinationId : ""}
                        onChange={(value) => chooseDestination(row.id, value)}
                        placeholder={row.destination || "Select destination"}
                        loading={loadingDestinations}
                        searchable
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDestinationModalRow(row.id)}
                      title="Add a new destination"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">City</span>
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        options={rowCities[row.id] || []}
                        value={row.cityId ? Number(row.cityId) || row.cityId : ""}
                        onChange={(value) => chooseCity(row.id, value)}
                        placeholder={
                          !row.destinationId ? "Select destination first"
                            : loadingRows[row.id] ? "Loading..."
                            : row.city || "Select city"
                        }
                        loading={Boolean(loadingRows[row.id])}
                        searchable
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!row.destinationId}
                      onClick={() => setCityModalRow(row.id)}
                      title={row.destinationId ? "Add a new city" : "Select destination first"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Nights</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step="1"
                    inputMode="numeric"
                    value={row.nights}
                    onFocus={(event) => event.target.select()}
                    onWheel={(event) => event.currentTarget.blur()}
                    onChange={(event) => onUpdateRow(row.id, { nights: event.target.value })}
                    onBlur={(event) => onUpdateRow(row.id, { nights: toInt(event.target.value) })}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (index === itinerary.length - 1) onAddRow();
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveRow(row.id)}
                  disabled={itinerary.length === 1}
                  aria-label={`Remove stop ${index + 1}`}
                  className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 md:w-9"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {itinerary.reduce((sum, row) => sum + toInt(row.nights), 0)} nights ·{" "}
              {itinerary.reduce((sum, row) => sum + toInt(row.nights), 0) + 1} days
            </span>
            <span>Press Enter in Nights to add the next stop.</span>
          </div>
        </Panel>
      </div>

        <aside className={`min-w-0 ${compactRail ? "space-y-4 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-start-1 lg:row-span-3" : "space-y-5 lg:col-start-2 lg:row-start-3"}`}>
          <Panel icon={UserCheck} title="Pipeline" description="Source, stage and ownership">
            <div className={compactRail ? "space-y-3" : "space-y-4"}>
              <Field
                id="leadSource"
                label="Lead Source"
                required
                error={errors.leadSource?.message || (sourcesError ? "Couldn't load sources — showing the current value only." : undefined)}
              >
                <input type="hidden" {...register("leadSource", { required: "Lead source is required" })} />
                <SearchableSelect
                  options={sourceOptionsFor(watch("leadSource"))}
                  value={watch("leadSource") || ""}
                  onChange={(value) => setValue("leadSource", value, { shouldDirty: true, shouldValidate: true })}
                  placeholder="Select source"
                  loading={sourcesLoading}
                  searchable
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field id="leadType" label="Lead Type" required error={errors.leadType?.message}>
                  <div className="relative">
                    <select {...register("leadType", { required: "Lead type is required" })} id="leadType" className={`${control(errors.leadType)} appearance-none pr-9`}>
                      <option value="">Select type</option>
                      {LEAD_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>

                <Field id="leadStage" label="Stage" required error={errors.leadStage?.message}>
                  <div className="relative">
                    <select {...register("leadStage", { required: "Lead stage is required" })} id="leadStage" className={`${control(errors.leadStage)} appearance-none pr-9`}>
                      {LEAD_STAGES.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
              </div>

              <Field id="assignedUserId" label="Assign To" required error={errors.assignedUserId?.message}>
                {forcedSelf ? (
                  <>
                    <input type="hidden" {...register("assignedUserId", { required: "Assigned user is required" })} />
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <UserCheck className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="truncate text-sm font-semibold text-slate-700">{selfUser?.name || "You"}</span>
                      <span className="ml-auto shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Assigned to you
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <input type="hidden" {...register("assignedUserId", { required: "Assigned user is required" })} />
                    <SearchableSelect
                      options={users}
                      value={watch("assignedUserId") || ""}
                      onChange={(value) => setValue("assignedUserId", value, { shouldDirty: true, shouldValidate: true })}
                      placeholder="Select team member"
                      loading={usersLoading}
                      searchable
                    />
                  </>
                )}
              </Field>

              {!rapidEntry && <Field id="packageType" label="Package Type" optional>
                <div className="relative">
                  <select {...register("packageType")} id="packageType" className={`${control(false)} appearance-none pr-9`}>
                    <option value="">Select package</option>
                    {PACKAGE_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>}
            </div>
          </Panel>

          <Panel icon={Search} title="Services & Notes" description="What the enquiry is for">
            <div id="services-group">
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map((service) => (
                  <Chip
                    key={service.id}
                    selected={services.includes(service.id)}
                    onClick={() => onToggleService(service.id)}
                  >
                    {service.label}
                  </Chip>
                ))}
              </div>
              {errors.services && <p className="mt-2 text-xs text-red-500">{errors.services.message}</p>}
            </div>

            <div className={compactRail ? "mt-3" : "mt-4"}>
              <Field id="notes" label="Customer Notes" optional>
                <textarea
                  {...register("notes")}
                  id="notes"
                  rows={compactRail ? 4 : 5}
                  placeholder="Requirements, preferred hotels, dietary needs, budget context"
                  className={`${control(false)} resize-y`}
                />
              </Field>
            </div>
          </Panel>
        </aside>
      </div>

      <QuickDestinationModal
        open={destinationModalRow != null}
        onClose={() => setDestinationModalRow(null)}
        onCreated={onDestinationCreated}
        defaultCountryName="India"
      />
      <QuickCityModal
        open={cityModalRow != null}
        onClose={() => setCityModalRow(null)}
        onCreated={onCityCreated}
        destination={cityModalDestination}
      />
    </>
  );
}
export default function LeadFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);
  const phoneRef = useRef(null);

  const {
    register, handleSubmit, watch, setValue, setError, getValues, clearErrors, reset,
    formState: { errors },
  } = useForm({
    // onTouched = validate on first blur, then live. The old form passed no mode, so RHF defaulted
    // to onSubmit and the clerk learned about a bad phone number only after filling forty fields.
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { ...blankDefaults(), ...(editing ? {} : readSticky()) },
  });

  const [services, setServices] = useState(() => (editing ? [] : readStickyServices()));
  const [itinerary, setItinerary] = useState(() => [blankRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [leadCode, setLeadCode] = useState("");
  /* Two different records, two different consequences, so they are tracked separately:
       lead     — an enquiry from this person already exists. A duplicate risk; nothing is written
                  unless the clerk asks for it.
       customer — this person is an existing client. A prefill opportunity, and the reason the
                  backend has carried GET /api/customers/lookup all along. */
  const [contactMatch, setContactMatch] = useState(EMPTY_MATCH);
  const [checkingContact, setCheckingContact] = useState(false);
  const [autoFilled, setAutoFilled] = useState([]);
  const [rapidEntry, setRapidEntry] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(readSessionCount);

  const phone = watch("phone");
  const email = watch("email");
  // A clerk with no CUSTOMER_READ would get a 403 on every probe, and the shared interceptor toasts
  // 403s — one per keystroke burst. Their lead form simply does not run the customer half.
  const canReadCustomers = useMemo(() => hasPermission(P.CUSTOMER_READ), []);

  const changeEntryMode = (nextRapidEntry) => {
    setRapidEntry(nextRapidEntry);
  };

  useEffect(() => {
    if (!editing) phoneRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;

    leadService.getLeadById(id)
      .then((response) => {
        if (!active) return;
        const body = response?.data;
        const lead = body?.data?.data ?? body?.data ?? body ?? {};
        setLeadCode(lead.leadCode || "");

        const assignedUserId =
          lead.assignedUserId ?? lead.assignedUserPublicId ?? lead.assignToPublicId ??
          lead.assignedToPublicId ?? lead.assignedUser?.publicId ?? lead.assignedUser?.id ??
          lead.assignTo?.publicId ?? lead.assignTo?.id ?? "";
        const adultPrefill = deriveAdultBreakdown({
          totalAdults: lead.totalAdults ?? lead.adults ?? lead.adultCount,
          male: lead.male ?? lead.maleCount,
          female: lead.female ?? lead.femaleCount,
        });

        reset({
          ...blankDefaults(),
          customerName: lead.customerName ?? lead.customer?.name ?? lead.name ?? "",
          phone: lead.phone ?? lead.mobile ?? lead.contactNumber ?? lead.customer?.phone ?? "",
          email: lead.email ?? lead.customer?.email ?? "",
          budget: lead.budget ?? lead.estimatedValue ?? "",
          leadSource: lead.leadSource ?? lead.source ?? "",
          leadType: lead.leadType ?? lead.type ?? "Fresh",
          leadStage: lead.leadStage ?? lead.stage ?? "New Lead",
          assignedUserId,
          birthDate: toDateInput(lead.birthDate ?? lead.dateOfBirth ?? lead.dob),
          anniversaryDate: toDateInput(lead.anniversaryDate ?? lead.marriageAnniversary ?? lead.anniversary),
          preferredCommunication:
            lead.preferredCommunication ?? lead.communicationPreference ?? lead.commPref ?? "",
          followUpDate: toDateInput(lead.followUpDate ?? lead.followupDate ?? lead.nextFollowUpDate),
          packageType: lead.packageType ?? lead.tripType ?? "",
          travelDate: toDateInput(lead.travelDate ?? lead.tripDate ?? lead.departureDate),
          departCountry: lead.departCountry ?? lead.departureCountry ?? "India",
          departCity: lead.departCity ?? lead.departureCity ?? "",
          departureMode: lead.departureMode ?? lead.transportMode ?? "",
          departureAirport: lead.departureAirport ?? lead.airportName ?? "",
          airportCode: lead.airportCode ?? lead.departureAirportCode ?? "",
          preferredFlightTime: String(lead.preferredFlightTime ?? lead.flightTime ?? "").slice(0, 5),
          railwayStation: lead.railwayStation ?? lead.departureStation ?? "",
          trainClass: lead.trainClass ?? lead.railClass ?? "",
          preferredTrainTime: String(lead.preferredTrainTime ?? lead.trainTime ?? "").slice(0, 5),
          pickupAddress: lead.pickupAddress ?? lead.roadPickupAddress ?? "",
          pickupDateTime: String(lead.pickupDateTime ?? lead.pickupAt ?? "").slice(0, 16),
          vehiclePreference: lead.vehiclePreference ?? lead.preferredVehicle ?? "",
          rooms: toInt(lead.rooms ?? lead.roomCount ?? lead.noOfRooms ?? 1, 1),
          ...adultPrefill,
          children: toInt(lead.children ?? lead.childCount ?? 0),
          infants: toInt(lead.infants ?? lead.infantCount ?? 0),
          extraBeds: toInt(lead.extraBeds ?? lead.extraBedCount ?? 0),
          specialAssistanceRequired: Boolean(
            lead.specialAssistanceRequired ?? lead.needsSpecialAssistance ??
            (Array.isArray(lead.specialAssistanceTypes) && lead.specialAssistanceTypes.length > 0)
          ),
          specialAssistanceTypes: Array.isArray(lead.specialAssistanceTypes)
            ? lead.specialAssistanceTypes
            : Array.isArray(lead.assistanceTypes) ? lead.assistanceTypes : [],
          assistancePassengerCount: toInt(lead.assistancePassengerCount ?? lead.assistancePassengers ?? 0),
          specialAssistanceNotes: lead.specialAssistanceNotes ?? lead.assistanceNotes ?? "",
          notes: lead.notes ?? lead.note ?? lead.remarks ?? lead.requirements ?? "",
        });

        const rawServices = lead.services ?? lead.selectedServices ?? lead.requiredServices ?? [];
        setServices([
          ...new Set((Array.isArray(rawServices) ? rawServices : []).map(normalizeServiceId).filter(Boolean)),
        ]);

        const rawItinerary = lead.itinerary ?? lead.itineraries ?? lead.travelItinerary ?? [];
        const rows = (Array.isArray(rawItinerary) ? rawItinerary : []).map((row) => ({
          ...blankRow(),
          destinationId: row.destinationId ?? row.destinationPublicId ?? row.destination?.id ?? row.destination?.publicId ?? "",
          destination: entityName(row.destination, row.destinationName ?? row.destinationLabel ?? ""),
          cityId: row.cityId ?? row.cityPublicId ?? row.city?.id ?? row.city?.publicId ?? "",
          city: entityName(row.city, row.cityName ?? row.cityLabel ?? ""),
          nights: Math.max(0, toInt(row.nights ?? row.noOfNights ?? row.stayNights ?? 1)),
        }));
        setItinerary(rows.length > 0 ? rows : [blankRow()]);
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Failed to load the lead."), "error");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [editing, id, reset, showToast]);

  /* ── Contact check: is this person already in the CRM? ───────────────────────────────────────
     Debounced against the real Phone and Email fields. The old form had a SECOND phone box that the
     clerk had to retype into and press Search, so in practice nobody ever ran it — and it only ever
     asked about LEADS, by PHONE.

     Both books are now asked, on either identifier:
       • leads/search        → "there is already an enquiry from them"      (duplicate risk)
       • customers/lookup    → "they are an existing client"                (prefill opportunity)

     The customer half is the one the backend was already built for: CustomerController.lookup's
     javadoc calls itself "the probe behind the lead form's Customer found popup", it answers 200
     with matched:false for the common no-match case, and it runs the SAME CustomerMatcher that links
     the lead at creation — so this can never promise a link the save does not make. It was simply
     never called from here.

     A miss stays silent. At 100 records a day, a toast saying "nobody found" on every one of them is
     pure noise. */
  const probeContact = useCallback(async (rawPhone, rawEmail) => {
    // Phone first — it is the per-tenant natural key. Email is the fallback, which is what lets an
    // enquiry that arrives by email still find its own history.
    const identifiers = [rawPhone, rawEmail].filter(Boolean);

    const findLead = async () => {
      for (const identifier of identifiers) {
        const found = await leadService.findLeadByContact(identifier);
        if (found) return found;
      }
      return null;
    };

    const [lead, customer] = await Promise.all([
      findLead().catch(() => null),
      canReadCustomers
        ? customerService.lookup({ phone: rawPhone, email: rawEmail }).catch(() => null)
        : Promise.resolve(null),
    ]);

    return { lead, customer: customer?.matched ? customer : null };
  }, [canReadCustomers]);

  /* Blank-only by design. The clerk is still typing while this lands, and a lookup that overwrites a
     name they just corrected is worse than no lookup at all. "Use this customer" is the explicit,
     overwriting version of the same call. Returns the labels of what it actually wrote so the strip
     can say precisely that, instead of implying the whole form was rewritten. */
  const prefillFromCustomer = useCallback((customer, { overwrite = false } = {}) => {
    if (!customer) return [];
    const written = [];
    const apply = (field, label, value) => {
      if (value == null || value === "") return;
      const current = getValues(field);
      if (!overwrite && String(current ?? "").trim() !== "") return;
      if (String(current ?? "") === String(value)) return;
      setValue(field, value, { shouldDirty: true, shouldValidate: false });
      written.push(label);
    };
    // Phone is never written back — the caret is in it.
    apply("customerName", "name", customer.name);
    apply("email", "email", customer.email);
    apply("departCity", "departure city", customer.city);
    apply("birthDate", "birth date", toDateInput(customer.birthday));
    apply("anniversaryDate", "anniversary", toDateInput(customer.anniversary));
    return written;
  }, [getValues, setValue]);

  const lastPrefilledCustomer = useRef("");

  useEffect(() => {
    if (editing) return undefined;
    const rawPhone = String(phone || "").trim();
    const rawEmail = String(email || "").trim();
    const phoneReady = rawPhone.replace(/\D/g, "").length >= 7;
    const emailReady = EMAIL_PATTERN.test(rawEmail);

    if (!phoneReady && !emailReady) {
      setContactMatch(EMPTY_MATCH);
      setAutoFilled([]);
      lastPrefilledCustomer.current = "";
      return undefined;
    }

    let active = true;
    setCheckingContact(true);
    const timer = window.setTimeout(async () => {
      const match = await probeContact(
        phoneReady ? rawPhone : "",
        emailReady ? rawEmail : "",
      );
      if (!active) return;
      setContactMatch(match);
      setCheckingContact(false);

      // Auto-fill once per matched customer. Without the guard every re-probe (the clerk keeps
      // typing) would re-announce the same fill.
      const customerKey = match.customer?.customerId || "";
      if (customerKey && customerKey !== lastPrefilledCustomer.current) {
        lastPrefilledCustomer.current = customerKey;
        setAutoFilled(prefillFromCustomer(match.customer));
      } else if (!customerKey) {
        lastPrefilledCustomer.current = "";
        setAutoFilled([]);
      }
    }, 500);

    return () => { active = false; window.clearTimeout(timer); setCheckingContact(false); };
  }, [editing, phone, email, probeContact, prefillFromCustomer]);

  /* Clearing the strip has to clear the "already prefilled this one" ref too, or the next record for
     the SAME customer would show the card with no prefill and look broken. */
  const resetContactMatch = () => {
    setContactMatch(EMPTY_MATCH);
    setAutoFilled([]);
    lastPrefilledCustomer.current = "";
  };

  const useMatchedCustomer = () => {
    const written = prefillFromCustomer(contactMatch.customer, { overwrite: true });
    setAutoFilled(written);
    showToast(
      written.length > 0
        ? `Loaded ${contactMatch.customer?.name || "customer"} into the form.`
        : "Form already matches this customer.",
      "success",
    );
  };

  const prefillFromDuplicate = () => {
    const duplicate = contactMatch.lead;
    if (!duplicate) return;
    const apply = (field, value) => { if (value != null && value !== "") setValue(field, value, { shouldDirty: true }); };
    apply("customerName", duplicate.customerName);
    apply("email", duplicate.email);
    apply("leadSource", duplicate.leadSource);
    apply("leadType", duplicate.leadType);
    apply("budget", duplicate.budget);
    apply("departCity", duplicate.departCity);
    apply("packageType", duplicate.packageType);
    // leadStage is deliberately NOT copied — a new enquiry starts at New Lead, and the old code
    // pulling the previous stage across is how leads silently travelled backwards in the pipeline.
    showToast(`Prefilled from ${duplicate.customerName || "the existing lead"}.`, "success");
  };

  const toggleService = (id) => {
    setServices((list) => (list.includes(id) ? list.filter((s) => s !== id) : [...list, id]));
    clearErrors("services");
  };

  const addRow = () => setItinerary((rows) => [...rows, blankRow()]);
  const removeRow = (rowId) =>
    setItinerary((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== rowId) : rows));
  const updateRow = useCallback((rowId, patch) => {
    setItinerary((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }, []);

  const focusNext = useCallback((from) => {
    const root = formRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
      (node) => node === from || node.offsetParent !== null
    );
    const next = nodes[nodes.indexOf(from) + 1];
    if (!next) return;
    next.focus();
    if (typeof next.select === "function" && /^(text|number|tel|email|search)$/.test(next.type || "")) {
      next.select();
    }
  }, []);

  const applyServerFieldErrors = (error, fallback) => {
    const fieldErrors = getFieldErrors(error) || {};
    const own = getValues();
    const inline = Object.keys(fieldErrors).filter((name) => name in own);
    inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));
    if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
  };

  /* RHF refuses to call save() when a rule fails, and by default does it in complete silence — no
     scroll, no message. On a form this tall the offending field is usually off-screen (an unresolved
     Assign To, three panels up, is the classic one), so BOTH Save and Save & New read as dead
     buttons. Every submit path routes its invalid case through here. */
  const onInvalid = (formErrors) => {
    const first = Object.keys(formErrors || {})[0];
    if (!first) return;
    const root = formRef.current;
    // The visible control first: assignedUserId's registered input is type="hidden" and cannot take
    // focus or be scrolled to, but its Field wrapper carries the id.
    const node = root?.querySelector(`[name="${first}"]:not([type="hidden"])`)
      || document.getElementById(first)
      || root?.querySelector(`[name="${first}"]`);
    node?.focus?.();
    (node?.closest?.("div") || node)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    showToast(formErrors[first]?.message || "Please fix the highlighted fields.", "error");
  };

  const save = async (data, { addAnother } = {}) => {
    if (services.length === 0) {
      // Inline, beside the picker — the old form raised this as a toast, which interrupts and then
      // disappears, leaving nothing next to the control that caused it.
      setError("services", { type: "manual", message: "Select at least one service." });
      document.getElementById("services-group")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    /* An itinerary row with only ONE of destination/city cannot go to the server — the backend binds
       both @NotBlank and one bad row rejects the whole lead — and must not be dropped silently
       either, because somebody typed it. Rows left completely blank are the form's own template and
       the transformer ignores those; this names the half-filled ones instead of letting the save
       come back as a 400 whose field path matches nothing on screen. */
    const incompleteRow = itinerary.findIndex((row) =>
      Boolean(String(row.destination || "").trim()) !== Boolean(String(row.city || "").trim()));
    if (incompleteRow >= 0) {
      showToast(
        `Itinerary stop ${incompleteRow + 1}: choose both a destination and a city, or clear the row.`,
        "error",
      );
      document.getElementById("itinerary-group")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    clearErrors("services");
    setSubmitting(true);

    try {
      const adultPayload = buildAdultPayload(data);
      const payload = {
        ...data,
        assignedUserId: data.assignedUserId || null,
        rooms: toInt(data.rooms, 1),
        extraBeds: toInt(data.extraBeds),
        male: adultPayload.male,
        female: adultPayload.female,
        totalAdults: adultPayload.totalAdults,
        adults: adultPayload.totalAdults,
        children: toInt(data.children),
        infants: toInt(data.infants),
        assistancePassengerCount: data.specialAssistanceRequired ? toInt(data.assistancePassengerCount) : 0,
        budget: data.budget === "" || data.budget == null || Number.isNaN(Number(data.budget))
          ? null
          : Number(data.budget),
      };

      if (editing) {
        await leadService.updateLead(id, payload, services, itinerary);
        showToast(`Lead "${data.customerName}" updated.`, "success");
        navigate("/allleads");
        return;
      }

      const response = await leadService.createLead(payload, services, itinerary);
      const created = response?.data?.data ?? response?.data;
      const leadPublicId = created?.publicId || created?.id;

      // Follow-up has no column on Lead: the durable record is a LeadLog, and LeadLogServiceImpl is
      // what raises the Reminder. Unchanged from the previous implementation.
      if (leadPublicId && data.followUpDate) {
        try {
          await leadService.addLog(leadPublicId, {
            comment: `Follow-up scheduled for ${data.followUpDate} at lead creation.`,
            createReminder: true,
            followUpDate: data.followUpDate,
            stage: data.leadStage || null,
          });
        } catch {
          showToast("Lead created, but the follow-up reminder could not be scheduled.", "warning");
        }
      }

      writeSticky(data, services);
      const nextSessionCount = savedThisSession + 1;
      setSavedThisSession(nextSessionCount);
      try { sessionStorage.setItem(SESSION_COUNT_KEY, String(nextSessionCount)); }
      catch { /* progress count is optional */ }

      if (addAnother) {
        // No navigation, no 1.2s timeout. Blank record, sticky fields kept, cursor already in
        // Phone — this is the whole point of the redesign for a 50-100/day operator.
        reset({ ...blankDefaults(), ...readSticky() });
        setServices(readStickyServices());
        setItinerary([blankRow()]);
        resetContactMatch();
        showToast(`${created?.leadCode || "Lead"} saved — next record ready.`, "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => phoneRef.current?.focus(), 0);
      } else {
        showToast(`Lead for "${data.customerName}" created successfully.`, "success");
        navigate("/allleads");
      }
    } catch (error) {
      if (isAlreadyReported(error)) return;
      applyServerFieldErrors(error, editing ? "Failed to update lead. Try again." : "Failed to create lead. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onFormKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const addAnother = !editing && event.shiftKey; // edit mode always performs one update
      handleSubmit((data) => save(data, { addAnother }), onInvalid)();
      return;
    }
    const target = event.target;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      // Implicit submission is the enemy here: a 30-field form should never be created because
      // someone pressed Enter after the third field.
      event.preventDefault();
      focusNext(target);
    }
  };

  const clearForm = () => {
    reset({ ...blankDefaults(), ...readSticky() });
    setServices(readStickyServices());
    setItinerary([blankRow()]);
    resetContactMatch();
    phoneRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> Loading lead…
      </div>
    );
  }

  /* One slot under the Phone field carrying both answers. They are stacked rather than merged
     because they mean different things and can both be true: a repeat client (green — reuse their
     details) who also has an enquiry still open (amber — do not raise a second one). */
  const customerMatch = contactMatch.customer;
  const duplicate = contactMatch.lead;

  const customerCard = customerMatch ? (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <CircleUserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 text-xs">
            <p className="font-bold text-emerald-900">
              Existing customer found with {MATCH_LABEL[customerMatch.matchedOn] || "this contact"}
            </p>
            <p className="mt-0.5 truncate text-emerald-800">
              {[customerMatch.name, customerMatch.customerCode, customerMatch.city]
                .filter(Boolean).join(" · ")}
            </p>
            {/* Relationship context is what makes the strip worth reading — a clerk decides
                differently for a 6-booking repeat client than for a row that merely exists. */}
            {(customerMatch.totalBookings > 0 || customerMatch.lastBookingDate) && (
              <p className="mt-0.5 truncate text-[11px] text-emerald-700">
                {[
                  customerMatch.totalBookings > 0
                    ? `${customerMatch.totalBookings} booking${customerMatch.totalBookings === 1 ? "" : "s"}`
                    : "",
                  inr(customerMatch.totalSpent) ? `${inr(customerMatch.totalSpent)} lifetime` : "",
                  customerMatch.lastBookingDate ? `last travel ${customerMatch.lastBookingDate}` : "",
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={useMatchedCustomer}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
          >
            Use this customer
          </button>
        </div>
      </div>
      {autoFilled.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-emerald-200/70 pt-2 text-[11px] text-emerald-700">
          <Check className="mt-0.5 h-3 w-3 shrink-0" />
          {/* Names exactly what was written. Blank fields only — anything already typed is left
              alone, so this list is never a surprise. */}
          Auto-filled the blank fields: {autoFilled.join(", ")}. Anything you had already typed was left as-is.
        </p>
      )}
    </div>
  ) : null;

  const leadCard = duplicate ? (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 text-xs">
          <p className="font-bold text-amber-900">A lead already exists for this contact</p>
          <p className="mt-0.5 truncate text-amber-800">
            {[duplicate.leadCode, duplicate.customerName, duplicate.leadStage].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={prefillFromDuplicate}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          Use this
        </button>
        <button
          type="button"
          onClick={() => navigate(`/EditLead/${duplicate.publicId || duplicate.id}`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </button>
      </div>
    </div>
  ) : null;

  const duplicateStrip = (customerCard || leadCard) ? (
    <>{customerCard}{leadCard}</>
  ) : checkingContact ? (
    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
      <LoaderCircle className="h-3 w-3 animate-spin" /> Checking existing leads and customers…
    </p>
  ) : null;

  return (
    <form
      ref={formRef}
      onSubmit={(event) => handleSubmit((data) => save(data, { addAnother: false }), onInvalid)(event)}
      onKeyDown={onFormKeyDown}
      noValidate
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: FONT }}
    >
      <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/allleads")}
              aria-label="Back to leads"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {editing ? `Edit Lead${leadCode ? ` · ${leadCode}` : ""}` : "Create Lead"}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                <kbd className="rounded bg-slate-100 px-1">Enter</kbd> next field ·
                <kbd className="ml-1 rounded bg-slate-100 px-1">Ctrl+Enter</kbd> save
                {!editing && (
                  <>
                    {" · "}<kbd className="rounded bg-slate-100 px-1">Ctrl+Shift+Enter</kbd> save &amp; new
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={editing ? () => navigate("/allleads") : clearForm} disabled={submitting} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex">
              <RotateCcw className="h-3.5 w-3.5" /> {editing ? "Cancel" : "Clear"}
            </button>
            {!editing && <button
              type="button"
              onClick={handleSubmit((data) => save(data, { addAnother: true }), onInvalid)}
              disabled={submitting}
              className="hidden items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" /> Save &amp; New
            </button>}
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Saving..." : editing ? "Save Changes" : "Save Lead"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-4">
        <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Zap className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">
                {rapidEntry ? "Rapid Entry" : "Full Details"}
                {!editing && savedThisSession > 0 && (
                  <span className="ml-2 font-semibold text-blue-700">
                    {savedThisSession} saved this session
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {rapidEntry
                  ? editing
                    ? "Only daily-use fields are shown; hidden lead details remain preserved."
                    : "Only daily-use fields are shown. Common pipeline choices and services carry into the next lead."
                  : "All customer, transport and assistance fields are available."}
              </p>
            </div>
          </div>
          <div className="inline-flex w-fit shrink-0 rounded-lg border border-blue-200 bg-white p-1" role="group" aria-label="Lead entry mode">
            <button
              type="button"
              onClick={() => changeEntryMode(true)}
              aria-pressed={rapidEntry}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${rapidEntry ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Rapid
            </button>
            <button
              type="button"
              onClick={() => changeEntryMode(false)}
              aria-pressed={!rapidEntry}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${!rapidEntry ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Full details
            </button>
          </div>
        </div>

        <LeadFormPanels
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          getValues={getValues}
          clearErrors={clearErrors}
          services={services}
          onToggleService={toggleService}
          itinerary={itinerary}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateRow={updateRow}
          phoneRef={phoneRef}
          belowPhone={editing ? null : duplicateStrip}
          compactRail
          rapidEntry={rapidEntry}
        />

        <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            <span className="font-bold text-red-500">*</span> Required fields are marked.
            {!editing && " Save & New keeps repeated pipeline choices and services selected."}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/allleads")} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">
              Cancel
            </button>
            {!editing && <button
              type="button"
              onClick={handleSubmit((data) => save(data, { addAnother: true }), onInvalid)}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:flex-none"
            >
              <Plus className="h-4 w-4" /> Save &amp; New
            </button>}
            <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Saving..." : editing ? "Save Changes" : "Save Lead"}
            </button>
          </div>
        </div>
      </main>
    </form>
  );
}
