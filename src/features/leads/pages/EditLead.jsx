// ─────────────────────────────────────────────────────────────────────────────
// OLD — replaced in the lead-form redesign. Kept verbatim for review/rollback.
//
// Edit now renders the SAME LeadFormPanels definition as CreateLead, so the two screens cannot
// drift. That matters here specifically: the comment at the foot of TravelDetails.jsx records
// that Create and Edit each owning their own copy of these fields is exactly what produced a
// silent data-loss bug last time (adultMale/adultFemale vs male/female).
//
// Also removed: the "Search Existing Lead by Phone" block. On an EDIT page it overwrote the
// record you were editing with another lead's values — and it read res.data (the ApiResponse
// wrapper) instead of res.data.data, so lead.customerName was always undefined and a "match"
// blanked customerName/email on a saved lead. See handlePhoneSearch below.
// ─────────────────────────────────────────────────────────────────────────────

// // src/admin/leads/EditLead.jsx
// // ─────────────────────────────────────────────────────────────
// // Edit Lead Page — Travel CRM
// // Route: /EditLead/:id   (replaces the old EditLeadModal popup)
// // Reuses the exact same sub-components as CreateLead.jsx:
// //   LeadInformation | TravelDetails | ServicesSection
// //   ItinerarySection | LeadSummary
// // On mount: fetches the lead by publicId/id, pre-fills the form,
// //   selected services, and itinerary rows.
// // On submit: calls leadService.updateLead(id, payload, services, itinerary)
// // ─────────────────────────────────────────────────────────────
//
// import { useState, useCallback, useEffect } from "react";
// import { useForm } from "react-hook-form";
// import { useNavigate, useParams } from "react-router-dom";
// import { ArrowLeft as FiArrowLeft, Save as FiSave, CircleCheck as FiCheckCircle, Loader as FiLoader, FileText as FiFileText } from "lucide-react";
//
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
//
// const SERVICE_ID_MAP = {
//   hotel: "hotel",
//   flight: "flight",
//   cruise: "cruise",
//   visa: "visa",
//   sightseeing: "sightseeing",
//
//   vehicle: "vehicle",
//   "vehicle rental": "vehicle",
//
//   insurance: "insurance",
//   "travel insurance": "insurance",
//
//   passport: "passport",
//   "passport assistance": "passport",
// };
//
// const normalizeServiceId = (service) => {
//   const rawValue =
//     typeof service === "string"
//       ? service
//       : service?.id ??
//       service?.code ??
//       service?.value ??
//       service?.label ??
//       service?.name ??
//       "";
//
//   const normalized = String(rawValue)
//     .trim()
//     .replace(/[_-]+/g, " ")
//     .replace(/\s+/g, " ")
//     .toLowerCase();
//
//   return SERVICE_ID_MAP[normalized] || normalized;
// };
//
// const getEntityName = (value, fallback = "") => {
//   if (typeof value === "string") {
//     return value.trim();
//   }
//
//   return String(
//     value?.name ??
//     value?.label ??
//     value?.title ??
//     fallback ??
//     ""
//   ).trim();
// };
//
// const toDateInput = (value) => {
//   if (!value) return "";
//
//   const textValue = String(value);
//
//   // Handles yyyy-MM-dd and ISO datetime without timezone date shifting.
//   if (/^\d{4}-\d{2}-\d{2}/.test(textValue)) {
//     return textValue.slice(0, 10);
//   }
//
//   const parsedDate = new Date(value);
//
//   return Number.isNaN(parsedDate.getTime())
//     ? ""
//     : parsedDate.toISOString().slice(0, 10);
// };
//
// /* ─── SKELETON LOADER ────────────────────────────────────────── */
// function SkeletonBlock({ h = "h-64" }) {
//   return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${h} animate-pulse`} />;
// }
//
// /* ─── MAIN PAGE ──────────────────────────────────────────────── */
// export default function EditLead() {
//   const navigate = useNavigate();
//   const { id } = useParams(); // lead publicId/id from URL
//
//   const {
//     register, handleSubmit, watch, setValue, reset, setError, getValues,
//     clearErrors, trigger,
//     formState: { errors },
//   } = useForm({
//     // Same field names TravelDetails and transformFormData use — this page and CreateLead now
//     // drive one shared component, so the two must not drift apart again.
//     defaultValues: {
//       customerName: "", phone: "", email: "",
//       budget: "",
//       leadSource: "", leadType: "", leadStage: "New Lead",
//       assignedUserId: "", birthDate: "", anniversaryDate: "",
//       preferredCommunication: "", followUpDate: "", packageType: "",
//       travelDate: "", departCountry: "India", departCity: "",
//       departureMode: "",
//       departureAirport: "", airportCode: "", preferredFlightTime: "",
//       railwayStation: "", trainClass: "", preferredTrainTime: "",
//       pickupAddress: "", pickupDateTime: "", vehiclePreference: "",
//       // totalAdults derived hai (male + female) — TravelDetails ise auto set karta hai
//       rooms: 1, male: 1, female: 1, totalAdults: 2, children: 0, infants: 0, extraBeds: 0,
//       specialAssistanceRequired: false,
//       specialAssistanceTypes: [],
//       assistancePassengerCount: 0,
//       specialAssistanceNotes: "",
//       notes: "",
//     },
//   });
//
//   const [loadingLead, setLoadingLead] = useState(true);
//   const [leadCode, setLeadCode] = useState("");
//   // Label for the assignee already on the lead. LeadInformation needs it to render that
//   // assignee's <option> before /users resolves — without a name it would show a raw id.
//   const [assignedUserName, setAssignedUserName] = useState("");
//   const [selectedServices, setSelectedServices] = useState([]);
//   // const [itinerary, setItinerary]       = useState([{ id: nextId++, destination: "", city: "", nights: 2 }]);
//
//   const [itinerary, setItinerary] = useState([
//     {
//       id: nextId++,
//       destinationId: "",
//       destination: "",
//       cityId: "",
//       city: "",
//       nights: 2,
//     },
//   ]);
//   const [submitting, setSubmitting] = useState(false);
//   const [savingDraft, setSavingDraft] = useState(false);
//   const [searching, setSearching] = useState(false);
//
//   // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
//   // Argument order is (message, type) everywhere — see shared/ui/toast.jsx.
//   const { showToast } = useToast();
//
//   /**
//    * A 400 VALIDATION_ERROR carries `fieldErrors`, and those belong beside the input that caused
//    * them — never in a toast. Anything the form doesn't actually render (an unknown key, or a
//    * non-validation failure) still has to be said out loud, so that falls back to the toast.
//    */
//   const applyServerFieldErrors = useCallback((error, fallback) => {
//     const fieldErrors = getFieldErrors(error) || {};
//     const formFields = getValues();
//     const inline = Object.keys(fieldErrors).filter((name) => name in formFields);
//
//     inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));
//
//     if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
//   }, [getValues, setError, showToast]);
//
//   /* ── Load lead on mount ──────────────────────────────────── */
//   useEffect(() => {
//     if (!id) { showToast("No lead ID provided.", "error"); return; }
//     setLoadingLead(true);
//
//     leadService.getLeadById(id)
//       .then((res) => {
//         // const body = res.data;
//         // const lead = body?.data ?? body;
//
//         // // Normalize date inputs to yyyy-MM-dd for <input type="date">
//         // const toDateInput = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";
//
//         // const safeAssignedUserId =
//         //   lead.assignedUserId ||
//         //   lead.assignedUser?.publicId ||
//         //   lead.assignedUser?.id ||
//         //   "";
//
//         const body = res?.data;
//
//         const lead =
//           body?.data?.data ??
//           body?.data ??
//           body ??
//           {};
//
//         const safeAssignedUserId =
//           lead.assignedUserId ??
//           lead.assignedUserPublicId ??
//           lead.assignToPublicId ??
//           lead.assignedToPublicId ??
//           lead.assignedUser?.publicId ??
//           lead.assignedUser?.id ??
//           lead.assignTo?.publicId ??
//           lead.assignTo?.id ??
//           "";
//
//         // reset({
//         //   customerName:    lead.customerName || "",
//         //   phone:           lead.phone || "",
//         //   email:           lead.email || "",
//         //   budget:          lead.budget != null ? lead.budget : "",
//         //   leadSource:      lead.leadSource || "",
//         //   leadType:        lead.leadType || "",
//         //   leadStage:       lead.leadStage || "New Lead",
//         //   assignedUserId:  safeAssignedUserId,
//         //   birthDate:       toDateInput(lead.birthDate),
//         //   travelDate:      toDateInput(lead.travelDate),
//         //   departCountry:   lead.departCountry || "India",
//         //   departCity:      lead.departCity || "",
//         //   rooms:           lead.rooms ?? 1,
//         //   adults:          lead.adults ?? 2,
//         //   children:        lead.children ?? 0,
//         //   infants:         lead.infants ?? 0,
//         //   extraBeds:       lead.extraBeds ?? 0,
//         //   notes:           lead.notes || "",
//         // });
//
//
//         reset({
//           customerName:
//             lead.customerName ??
//             lead.customer?.name ??
//             lead.name ??
//             "",
//
//           phone:
//             lead.phone ??
//             lead.mobile ??
//             lead.contactNumber ??
//             lead.customer?.phone ??
//             "",
//
//           email:
//             lead.email ??
//             lead.customer?.email ??
//             "",
//
//           budget:
//             lead.budget ??
//             lead.estimatedValue ??
//             "",
//
//           leadSource:
//             lead.leadSource ??
//             lead.source ??
//             "",
//
//           leadType:
//             lead.leadType ??
//             lead.type ??
//             "",
//
//           leadStage:
//             lead.leadStage ??
//             lead.stage ??
//             "New Lead",
//
//           assignedUserId: safeAssignedUserId,
//
//           birthDate: toDateInput(
//             lead.birthDate ??
//             lead.dateOfBirth ??
//             lead.dob
//           ),
//
//           anniversaryDate: toDateInput(
//             lead.anniversaryDate ??
//             lead.marriageAnniversary ??
//             lead.anniversary
//           ),
//
//           preferredCommunication:
//             lead.preferredCommunication ??
//             lead.communicationPreference ??
//             lead.commPref ??
//             "",
//
//           followUpDate: toDateInput(
//             lead.followUpDate ??
//             lead.followupDate ??
//             lead.nextFollowUpDate
//           ),
//
//           packageType:
//             lead.packageType ??
//             lead.tripType ??
//             "",
//
//           travelDate: toDateInput(
//             lead.travelDate ??
//             lead.departureDate ??
//             lead.journeyDate
//           ),
//
//           departCountry:
//             lead.departCountry ??
//             lead.departingCountry ??
//             lead.departureCountry ??
//             "India",
//
//           departCity:
//             lead.departCity ??
//             lead.departingCity ??
//             lead.departureCity ??
//             "",
//
//           departureMode:
//             lead.departureMode ??
//             lead.transportMode ??
//             "",
//
//           departureAirport:
//             lead.departureAirport ??
//             lead.airportName ??
//             "",
//
//           airportCode:
//             lead.airportCode ??
//             lead.departureAirportCode ??
//             "",
//
//           preferredFlightTime: String(
//             lead.preferredFlightTime ??
//             lead.flightTime ??
//             ""
//           ).slice(0, 5),
//
//           railwayStation:
//             lead.railwayStation ??
//             lead.departureStation ??
//             "",
//
//           trainClass:
//             lead.trainClass ??
//             lead.railClass ??
//             "",
//
//           preferredTrainTime: String(
//             lead.preferredTrainTime ??
//             lead.trainTime ??
//             ""
//           ).slice(0, 5),
//
//           pickupAddress:
//             lead.pickupAddress ??
//             lead.roadPickupAddress ??
//             "",
//
//           pickupDateTime: String(
//             lead.pickupDateTime ??
//             lead.pickupAt ??
//             ""
//           ).slice(0, 16),
//
//           vehiclePreference:
//             lead.vehiclePreference ??
//             lead.preferredVehicle ??
//             "",
//
//           rooms: Number(
//             lead.rooms ??
//             lead.roomCount ??
//             lead.noOfRooms ??
//             1
//           ),
//
//           totalAdults: Number(
//             lead.totalAdults ??
//             lead.adults ??
//             lead.adultCount ??
//             2
//           ),
//
//           /*
//            * Male / Female may not come back from the server. Older leads carry only the `adults`
//            * total, so the gender split is unknown — seed the whole count into Male rather than
//            * lose it, and let the user correct it. Otherwise totalAdults (= male + female) would
//            * save as 0.
//            */
//           male: Number(
//             lead.male ??
//             lead.maleCount ??
//             (lead.female != null ? 0 : (lead.totalAdults ?? lead.adults ?? lead.adultCount ?? 0))
//           ),
//
//           female: Number(
//             lead.female ??
//             lead.femaleCount ??
//             0
//           ),
//
//           children: Number(
//             lead.children ??
//             lead.childCount ??
//             0
//           ),
//
//           infants: Number(
//             lead.infants ??
//             lead.infantCount ??
//             0
//           ),
//
//           extraBeds: Number(
//             lead.extraBeds ??
//             lead.extraBedCount ??
//             0
//           ),
//
//           /*
//            * Special assistance. The server may not return these yet — in that case the section
//            * simply opens empty. It is still filled in from the response wherever possible so an
//            * edit does not quietly blank out assistance the lead already had.
//            */
//           specialAssistanceRequired: Boolean(
//             lead.specialAssistanceRequired ??
//             lead.needsSpecialAssistance ??
//             (Array.isArray(lead.specialAssistanceTypes) && lead.specialAssistanceTypes.length > 0)
//           ),
//
//           specialAssistanceTypes: Array.isArray(lead.specialAssistanceTypes)
//             ? lead.specialAssistanceTypes
//             : Array.isArray(lead.assistanceTypes)
//               ? lead.assistanceTypes
//               : [],
//
//           assistancePassengerCount: Number(
//             lead.assistancePassengerCount ??
//             lead.assistancePassengers ??
//             0
//           ),
//
//           specialAssistanceNotes:
//             lead.specialAssistanceNotes ??
//             lead.assistanceNotes ??
//             "",
//
//           notes:
//             lead.notes ??
//             lead.note ??
//             lead.remarks ??
//             lead.requirements ??
//             "",
//         });
//
//         // Re-hydrate selected services (array of strings or {id,label})
//         // const svcs = Array.isArray(lead.services) ? lead.services : [];
//         // setSelectedServices(
//         //   svcs.map((s) => (typeof s === "string" ? s.toLowerCase() : (s.id || s.label || "").toLowerCase()))
//         // );
//
//
//         const rawServices =
//           lead.services ??
//           lead.selectedServices ??
//           lead.requiredServices ??
//           [];
//
//         const serviceList = Array.isArray(rawServices)
//           ? rawServices
//           : [];
//
//         const normalizedServices = [
//           ...new Set(
//             serviceList
//               .map(normalizeServiceId)
//               .filter(Boolean)
//           ),
//         ];
//
//         setSelectedServices(normalizedServices);
//
//         // Re-hydrate itinerary rows
//         // const itin = Array.isArray(lead.itinerary) ? lead.itinerary : [];
//         // setItinerary(
//         //   itin.length > 0
//         //     ? itin.map((row) => ({
//         //         id: nextId++,
//         //         destination: row.destination || "",
//         //         city: row.city || "",
//         //         nights: row.nights || 1,
//         //       }))
//         //     : [{ id: nextId++, destination: "", city: "", nights: 2 }]
//         // );
//
//
//         const rawItinerary =
//           lead.itinerary ??
//           lead.itineraries ??
//           lead.travelItinerary ??
//           [];
//
//         const itineraryList = Array.isArray(rawItinerary)
//           ? rawItinerary
//           : [];
//
//         const hydratedItinerary =
//           itineraryList.length > 0
//             ? itineraryList.map((row) => {
//               const destinationName = getEntityName(
//                 row.destination,
//                 row.destinationName ??
//                 row.destinationLabel ??
//                 ""
//               );
//
//               const cityName = getEntityName(
//                 row.city,
//                 row.cityName ??
//                 row.cityLabel ??
//                 ""
//               );
//
//               return {
//                 // UI-only unique key
//                 id: nextId++,
//
//                 destinationId:
//                   row.destinationId ??
//                   row.destinationPublicId ??
//                   row.destination?.id ??
//                   row.destination?.publicId ??
//                   "",
//
//                 destination: destinationName,
//
//                 cityId:
//                   row.cityId ??
//                   row.cityPublicId ??
//                   row.city?.id ??
//                   row.city?.publicId ??
//                   "",
//
//                 city: cityName,
//
//                 nights: Math.max(
//                   1,
//                   Number(
//                     row.nights ??
//                     row.noOfNights ??
//                     row.stayNights ??
//                     1
//                   )
//                 ),
//               };
//             })
//             : [
//               {
//                 id: nextId++,
//                 destinationId: "",
//                 destination: "",
//                 cityId: "",
//                 city: "",
//                 nights: 2,
//               },
//             ];
//
//         setItinerary(hydratedItinerary);
//
//         setAssignedUserName(
//           lead.assignedUser?.fullName ??
//           lead.assignedUser?.name ??
//           lead.assignedUser?.username ??
//           lead.assignedUserName ??
//           lead.assignTo?.fullName ??
//           lead.assignTo?.name ??
//           ""
//         );
//
//         // The human-readable reference now really is a code — it used to hold the raw publicId
//         // UUID, which is what the header rendered. Falls back for rows predating lead_code.
//         setLeadCode(lead.leadCode || lead.publicId || lead.id || id);
//       })
//       .catch((err) => {
//         if (isAlreadyReported(err)) return;   // the interceptor's toast already said it
//         showToast(getErrorMessage(err, "Failed to load lead details."), "error");
//       })
//       .finally(() => setLoadingLead(false));
//   }, [id, reset, showToast]);
//
//   /* ── Services + Itinerary handlers (same as CreateLead) ──── */
//   const toggleService = useCallback((svcId) => {
//     setSelectedServices((prev) =>
//       prev.includes(svcId) ? prev.filter((s) => s !== svcId) : [...prev, svcId]
//     );
//   }, []);
//
//   const addItineraryRow = () => {
//     setItinerary((prev) => [
//       ...prev,
//       {
//         id: nextId++,
//         destinationId: "",
//         destination: "",
//         cityId: "",
//         city: "",
//         nights: 2,
//       },
//     ]);
//   };
//   const removeItineraryRow = (rowId) => {
//     setItinerary((prev) => prev.filter((r) => r.id !== rowId));
//   };
//   const updateItineraryRow = (rowId, field, value) => {
//     setItinerary((prev) => prev.map((r) => r.id === rowId ? { ...r, [field]: value } : r));
//   };
//
//   /* ── Phone re-search (same UX as CreateLead, optional on edit) ── */
//   const handlePhoneSearch = async (phone) => {
//     if (!phone?.trim()) return;
//     setSearching(true);
//     try {
//       const res = await leadService.searchByPhone(phone);
//       const lead = res.data;
//       setValue("customerName", lead.customerName || "");
//       setValue("email", lead.email || "");
//       if (lead.budget != null) setValue("budget", lead.budget);
//       showToast(`Lead found: ${lead.customerName}`, "success");
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
//     } finally {
//       setSearching(false);
//     }
//   };
//
//   /* ── Save Draft (local only, same as CreateLead) ──────────── */
//   const onSaveDraft = async () => {
//     setSavingDraft(true);
//     await new Promise((r) => setTimeout(r, 800));
//     setSavingDraft(false);
//     showToast("Draft saved locally.", "success");
//   };
//
//   /* ── Submit (Update) ──────────────────────────────────────── */
//   const onSubmit = async (data) => {
//     if (selectedServices.length === 0) {
//       showToast("Please select at least one service.", "error");
//       return;
//     }
//     setSubmitting(true);
//     try {
//       const safeAssignedUserId = data.assignedUserId || null;
//
//       const payload = {
//         ...data,
//         assignedUserId: safeAssignedUserId,
//         budget: data.budget === "" || data.budget == null ? null : Number(data.budget),
//       };
//
//       await leadService.updateLead(
//         id,
//         payload,
//         selectedServices,
//         itinerary
//       );
//
//       showToast(`Lead "${data.customerName}" updated successfully!`, "success");
//
//       setTimeout(() => navigate("/allleads"), 1200);
//     } catch (err) {
//       if (isAlreadyReported(err)) return;   // the interceptor's toast already said it
//       applyServerFieldErrors(err, "Failed to update lead. Try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };
//
//   /* ── RENDER ──────────────────────────────────────────────── */
//   return (
//     <div className="min-h-screen bg-slate-50 font-sans">
//
//       {/* Page Header */}
//       <div className="bg-white border-b border-slate-100">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-200">
//                 <FiFileText className="w-5 h-5 text-white" />
//               </div>
//               <div>
//                 <div className="flex items-center gap-2 flex-wrap">
//                   <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Edit Lead</h1>
//                   {leadCode && (
//                     <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
//                       {leadCode}
//                     </span>
//                   )}
//                   {loadingLead && (
//                     <span className="text-xs text-slate-400 font-medium animate-pulse">Loading…</span>
//                   )}
//                 </div>
//                 <p className="text-sm text-slate-500 mt-0.5">Update lead information, itinerary & services</p>
//               </div>
//             </div>
//             <button
//               type="button"
//               onClick={() => navigate("/allleads")}
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300
//                 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 transition-all shadow-sm"
//             >
//               <FiArrowLeft className="w-4 h-4" /> Back to Leads
//             </button>
//           </div>
//         </div>
//       </div>
//
//       {/* Main Content */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//
//         {loadingLead ? (
//           <div className="flex flex-col lg:flex-row gap-6">
//             <div className="flex-1 space-y-6">
//               <SkeletonBlock h="h-72" />
//               <SkeletonBlock h="h-64" />
//               <SkeletonBlock h="h-56" />
//               <SkeletonBlock h="h-64" />
//               <SkeletonBlock h="h-48" />
//             </div>
//             <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
//               <SkeletonBlock h="h-48" />
//               <SkeletonBlock h="h-64" />
//             </div>
//           </div>
//         ) : (
//           <form onSubmit={handleSubmit(onSubmit)} noValidate>
//             <div className="flex flex-col lg:flex-row gap-6">
//
//               {/* Left Column */}
//               <div className="flex-1 min-w-0 space-y-6">
//                 <LeadInformation
//                   mode="edit"
//                   register={register}
//                   errors={errors}
//                   watch={watch}
//                   setValue={setValue}
//                   onPhoneSearch={handlePhoneSearch}
//                   searching={searching}
//                   assignedUserName={assignedUserName}
//                 />
//                 <TravelDetails
//                   register={register}
//                   watch={watch}
//                   setValue={setValue}
//                   getValues={getValues}
//                   errors={errors}
//                   clearErrors={clearErrors}
//                   trigger={trigger}
//                 />
//                 <ServicesSection
//                   selectedServices={selectedServices}
//                   onToggle={toggleService}
//                 />
//                 <ItinerarySection
//                   hydrationKey={id}
//                   itinerary={itinerary}
//                   onAdd={addItineraryRow}
//                   onRemove={removeItineraryRow}
//                   onUpdate={updateItineraryRow}
//                 />
//
//                 {/* Notes */}
//                 <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//                   <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-4 flex items-center gap-3">
//                     <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
//                       <FiFileText className="w-4 h-4 text-white" />
//                     </div>
//                     <div>
//                       <h2 className="text-white font-bold text-base">Customer Notes</h2>
//                       <p className="text-amber-100 text-xs">Special requirements, budget, preferences</p>
//                     </div>
//                   </div>
//                   <div className="p-6">
//                     <textarea
//                       {...register("notes")}
//                       rows={5}
//                       placeholder="Enter customer requirements, special requests, budget, preferred hotels, destinations, dietary needs, accessibility requirements, etc."
//                       className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
//                         focus:border-amber-400 focus:ring-2 focus:ring-amber-50 outline-none transition-all resize-none"
//                     />
//                   </div>
//                 </div>
//
//                 {/* Submit Buttons */}
//                 <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
//                   <div className="flex flex-col sm:flex-row items-stretch gap-3">
//                     <button
//                       type="button"
//                       onClick={onSaveDraft}
//                       disabled={savingDraft || submitting}
//                       className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl
//                         border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800
//                         font-semibold text-sm transition-all disabled:opacity-50 bg-white hover:bg-slate-50"
//                     >
//                       {savingDraft
//                         ? <FiLoader className="w-4 h-4 animate-spin" />
//                         : <FiSave className="w-4 h-4" />}
//                       {savingDraft ? "Saving Draft..." : "Save Draft"}
//                     </button>
//
//                     <button
//                       type="submit"
//                       disabled={submitting || savingDraft}
//                       className="w-full sm:flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
//                         bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm
//                         transition-all shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300
//                         disabled:opacity-60 disabled:cursor-not-allowed"
//                     >
//                       {submitting ? (
//                         <>
//                           <FiLoader className="w-4 h-4 animate-spin" />
//                           Updating Lead...
//                         </>
//                       ) : (
//                         <>
//                           <FiCheckCircle className="w-4 h-4" />
//                           Update Lead
//                         </>
//                       )}
//                     </button>
//
//                     <button
//                       type="button"
//                       onClick={() => navigate("/allleads")}
//                       disabled={submitting || savingDraft}
//                       className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl
//                         border-2 border-red-100 hover:border-red-200 text-red-400 hover:text-red-600
//                         font-semibold text-sm transition-all disabled:opacity-40 bg-white hover:bg-red-50"
//                     >
//                       <FiArrowLeft className="w-4 h-4" /> Discard
//                     </button>
//                   </div>
//
//                   <p className="text-center text-xs text-slate-400 mt-3">
//                     Changes are saved immediately when you click{" "}
//                     <span className="font-bold text-indigo-600">Update Lead</span>.
//                   </p>
//                 </div>
//               </div>
//
//               {/* Right Sidebar */}
//               <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
//                 <div className="lg:sticky lg:top-20">
//                   <LeadSummary
//                     watch={watch}
//                     selectedServices={selectedServices}
//                     itinerary={itinerary}
//                   />
//                 </div>
//               </div>
//             </div>
//           </form>
//         )}
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
//
//
//
//
//
//
//

// ─────────────────────────────────────────────────────────────────────────────
// NEW — lead-form redesign. Deliberately the SAME body as CreateLead: it renders CreateLead's
// exported LeadFormPanels, so there is one definition of the lead's fields and the two screens
// cannot drift apart again.
//
// Differences from Create, all intentional:
//   · seeds from the server instead of from sticky defaults
//   · no duplicate-phone check and no phone-search — this lead already exists, and the old search
//     overwrote the record being edited
//   · no Save & New
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LoaderCircle, RotateCcw } from "lucide-react";

import { leadService } from "../api/leadService";
import { LeadFormPanels, blankDefaults, toInt } from "./CreateLead";
import { buildAdultPayload, deriveAdultBreakdown } from "@shared/lib/adultBreakdown";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* The old file carried a lot of hard-won defensiveness about the shape of a lead coming back from
   the API — alias keys, entity-vs-string destinations, dates in two formats. None of that is
   cosmetic, so it is preserved verbatim below rather than simplified away. */
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

// Handles yyyy-MM-dd and ISO datetimes without timezone date-shifting.
const toDateInput = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

let nextRowId = 10_000; // offset so ids cannot collide with CreateLead's counter

export default function EditLead() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);

  const {
    register, handleSubmit, watch, setValue, setError, getValues, clearErrors, reset,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: blankDefaults(),
  });

  const [loading, setLoading] = useState(true);
  const [leadCode, setLeadCode] = useState("");
  const [services, setServices] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) { showToast("No lead ID provided.", "error"); setLoading(false); return undefined; }
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
          leadType: lead.leadType ?? lead.type ?? "",
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
          id: nextRowId++,
          destinationId: row.destinationId ?? row.destinationPublicId ?? row.destination?.id ?? row.destination?.publicId ?? "",
          destination: entityName(row.destination, row.destinationName ?? row.destinationLabel ?? ""),
          cityId: row.cityId ?? row.cityPublicId ?? row.city?.id ?? row.city?.publicId ?? "",
          city: entityName(row.city, row.cityName ?? row.cityLabel ?? ""),
          nights: Math.max(0, toInt(row.nights ?? row.noOfNights ?? row.stayNights ?? 1)),
        }));
        setItinerary(rows.length > 0
          ? rows
          : [{ id: nextRowId++, destinationId: "", destination: "", cityId: "", city: "", nights: 2 }]);
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Failed to load the lead."), "error");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id, reset, showToast]);

  const toggleService = (serviceId) => {
    setServices((list) => (list.includes(serviceId) ? list.filter((s) => s !== serviceId) : [...list, serviceId]));
    clearErrors("services");
  };

  const addRow = () =>
    setItinerary((rows) => [...rows, { id: nextRowId++, destinationId: "", destination: "", cityId: "", city: "", nights: 1 }]);
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

  const save = async (data) => {
    if (services.length === 0) {
      setError("services", { type: "manual", message: "Select at least one service." });
      document.getElementById("services-group")?.scrollIntoView({ block: "center", behavior: "smooth" });
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

      await leadService.updateLead(id, payload, services, itinerary);
      showToast(`Lead "${data.customerName}" updated.`, "success");
      navigate("/allleads");
    } catch (error) {
      if (isAlreadyReported(error)) return;
      const fieldErrors = getFieldErrors(error) || {};
      const own = getValues();
      const inline = Object.keys(fieldErrors).filter((name) => name in own);
      if (inline.length > 0) {
        inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));
        const node = formRef.current?.querySelector(`#${CSS.escape(inline[0])}`);
        node?.focus?.();
        node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      } else {
        showToast(getErrorMessage(error, "Failed to update lead. Try again."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onFormKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      handleSubmit(save)();
      return;
    }
    const target = event.target;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      event.preventDefault();
      focusNext(target);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> Loading lead…
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => handleSubmit(save)(event)}
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
                Edit Lead{leadCode ? ` · ${leadCode}` : ""}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                <kbd className="rounded bg-slate-100 px-1">Enter</kbd> next field ·
                <kbd className="ml-1 rounded bg-slate-100 px-1">Ctrl+Enter</kbd> save
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => navigate("/allleads")} disabled={submitting} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex">
              <RotateCcw className="h-3.5 w-3.5" /> Cancel
            </button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-4">
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
        />

        <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            <span className="font-bold text-red-500">*</span> Phone, name, travel date and assignee are required.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/allleads")} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </main>
    </form>
  );
}
