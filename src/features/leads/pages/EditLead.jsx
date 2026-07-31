// src/admin/leads/EditLead.jsx
// ─────────────────────────────────────────────────────────────
// Edit Lead Page — Travel CRM
// Route: /EditLead/:id   (replaces the old EditLeadModal popup)
// Reuses the exact same sub-components as CreateLead.jsx:
//   LeadInformation | TravelDetails | ServicesSection
//   ItinerarySection | LeadSummary
// On mount: fetches the lead by publicId/id, pre-fills the form,
//   selected services, and itinerary rows.
// On submit: calls leadService.updateLead(id, payload, services, itinerary)
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft as FiArrowLeft, Save as FiSave, CircleCheck as FiCheckCircle, Loader as FiLoader, FileText as FiFileText } from "lucide-react";

import { leadService } from "../api/leadService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";

import LeadInformation from "../components/LeadInformation";
import TravelDetails from "../components/TravelDetails";
import ServicesSection from "../components/ServicesSection";
import ItinerarySection from "../components/ItinerarySection";
import LeadSummary from "../components/LeadSummary";

let nextId = 1;


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
  const rawValue =
    typeof service === "string"
      ? service
      : service?.id ??
      service?.code ??
      service?.value ??
      service?.label ??
      service?.name ??
      "";

  const normalized = String(rawValue)
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  return SERVICE_ID_MAP[normalized] || normalized;
};

const getEntityName = (value, fallback = "") => {
  if (typeof value === "string") {
    return value.trim();
  }

  return String(
    value?.name ??
    value?.label ??
    value?.title ??
    fallback ??
    ""
  ).trim();
};

const toDateInput = (value) => {
  if (!value) return "";

  const textValue = String(value);

  // Handles yyyy-MM-dd and ISO datetime without timezone date shifting.
  if (/^\d{4}-\d{2}-\d{2}/.test(textValue)) {
    return textValue.slice(0, 10);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toISOString().slice(0, 10);
};

/* ─── SKELETON LOADER ────────────────────────────────────────── */
function SkeletonBlock({ h = "h-64" }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${h} animate-pulse`} />;
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function EditLead() {
  const navigate = useNavigate();
  const { id } = useParams(); // lead publicId/id from URL

  const {
    register, handleSubmit, watch, setValue, reset, setError, getValues,
    clearErrors, trigger,
    formState: { errors },
  } = useForm({
    // Same field names TravelDetails and transformFormData use — this page and CreateLead now
    // drive one shared component, so the two must not drift apart again.
    defaultValues: {
      customerName: "", phone: "", email: "",
      budget: "",
      leadSource: "", leadType: "", leadStage: "New Lead",
      assignedUserId: "", birthDate: "", anniversaryDate: "",
      travelDate: "", departCountry: "India", departCity: "",
      // totalAdults derived hai (male + female) — TravelDetails ise auto set karta hai
      rooms: 1, male: 1, female: 1, totalAdults: 2, children: 0, infants: 0, extraBeds: 0,
      specialAssistanceRequired: false,
      specialAssistanceTypes: [],
      assistancePassengerCount: 0,
      specialAssistanceNotes: "",
      notes: "",
    },
  });

  const [loadingLead, setLoadingLead] = useState(true);
  const [leadCode, setLeadCode] = useState("");
  // Label for the assignee already on the lead. LeadInformation needs it to render that
  // assignee's <option> before /users resolves — without a name it would show a raw id.
  const [assignedUserName, setAssignedUserName] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  // const [itinerary, setItinerary]       = useState([{ id: nextId++, destination: "", city: "", nights: 2 }]);

  const [itinerary, setItinerary] = useState([
    {
      id: nextId++,
      destinationId: "",
      destination: "",
      cityId: "",
      city: "",
      nights: 2,
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [searching, setSearching] = useState(false);

  // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
  // Argument order is (message, type) everywhere — see shared/ui/toast.jsx.
  const { showToast } = useToast();

  /**
   * A 400 VALIDATION_ERROR carries `fieldErrors`, and those belong beside the input that caused
   * them — never in a toast. Anything the form doesn't actually render (an unknown key, or a
   * non-validation failure) still has to be said out loud, so that falls back to the toast.
   */
  const applyServerFieldErrors = useCallback((error, fallback) => {
    const fieldErrors = getFieldErrors(error) || {};
    const formFields = getValues();
    const inline = Object.keys(fieldErrors).filter((name) => name in formFields);

    inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));

    if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
  }, [getValues, setError, showToast]);

  /* ── Load lead on mount ──────────────────────────────────── */
  useEffect(() => {
    if (!id) { showToast("No lead ID provided.", "error"); return; }
    setLoadingLead(true);

    leadService.getLeadById(id)
      .then((res) => {
        // const body = res.data;
        // const lead = body?.data ?? body;

        // // Normalize date inputs to yyyy-MM-dd for <input type="date">
        // const toDateInput = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

        // const safeAssignedUserId =
        //   lead.assignedUserId ||
        //   lead.assignedUser?.publicId ||
        //   lead.assignedUser?.id ||
        //   "";

        const body = res?.data;

        const lead =
          body?.data?.data ??
          body?.data ??
          body ??
          {};

        const safeAssignedUserId =
          lead.assignedUserId ??
          lead.assignedUserPublicId ??
          lead.assignToPublicId ??
          lead.assignedToPublicId ??
          lead.assignedUser?.publicId ??
          lead.assignedUser?.id ??
          lead.assignTo?.publicId ??
          lead.assignTo?.id ??
          "";

        // reset({
        //   customerName:    lead.customerName || "",
        //   phone:           lead.phone || "",
        //   email:           lead.email || "",
        //   budget:          lead.budget != null ? lead.budget : "",
        //   leadSource:      lead.leadSource || "",
        //   leadType:        lead.leadType || "",
        //   leadStage:       lead.leadStage || "New Lead",
        //   assignedUserId:  safeAssignedUserId,
        //   birthDate:       toDateInput(lead.birthDate),
        //   travelDate:      toDateInput(lead.travelDate),
        //   departCountry:   lead.departCountry || "India",
        //   departCity:      lead.departCity || "",
        //   rooms:           lead.rooms ?? 1,
        //   adults:          lead.adults ?? 2,
        //   children:        lead.children ?? 0,
        //   infants:         lead.infants ?? 0,
        //   extraBeds:       lead.extraBeds ?? 0,
        //   notes:           lead.notes || "",
        // });


        reset({
          customerName:
            lead.customerName ??
            lead.customer?.name ??
            lead.name ??
            "",

          phone:
            lead.phone ??
            lead.mobile ??
            lead.contactNumber ??
            lead.customer?.phone ??
            "",

          email:
            lead.email ??
            lead.customer?.email ??
            "",

          budget:
            lead.budget ??
            lead.estimatedValue ??
            "",

          leadSource:
            lead.leadSource ??
            lead.source ??
            "",

          leadType:
            lead.leadType ??
            lead.type ??
            "",

          leadStage:
            lead.leadStage ??
            lead.stage ??
            "New Lead",

          assignedUserId: safeAssignedUserId,

          birthDate: toDateInput(
            lead.birthDate ??
            lead.dateOfBirth ??
            lead.dob
          ),

          anniversaryDate: toDateInput(
            lead.anniversaryDate ??
            lead.marriageAnniversary ??
            lead.anniversary
          ),

          travelDate: toDateInput(
            lead.travelDate ??
            lead.departureDate ??
            lead.journeyDate
          ),

          departCountry:
            lead.departCountry ??
            lead.departingCountry ??
            lead.departureCountry ??
            "India",

          departCity:
            lead.departCity ??
            lead.departingCity ??
            lead.departureCity ??
            "",

          rooms: Number(
            lead.rooms ??
            lead.roomCount ??
            lead.noOfRooms ??
            1
          ),

          totalAdults: Number(
            lead.totalAdults ??
            lead.adults ??
            lead.adultCount ??
            2
          ),

          /*
           * Male / Female may not come back from the server. Older leads carry only the `adults`
           * total, so the gender split is unknown — seed the whole count into Male rather than
           * lose it, and let the user correct it. Otherwise totalAdults (= male + female) would
           * save as 0.
           */
          male: Number(
            lead.male ??
            lead.maleCount ??
            (lead.female != null ? 0 : (lead.totalAdults ?? lead.adults ?? lead.adultCount ?? 0))
          ),

          female: Number(
            lead.female ??
            lead.femaleCount ??
            0
          ),

          children: Number(
            lead.children ??
            lead.childCount ??
            0
          ),

          infants: Number(
            lead.infants ??
            lead.infantCount ??
            0
          ),

          extraBeds: Number(
            lead.extraBeds ??
            lead.extraBedCount ??
            0
          ),

          /*
           * Special assistance. The server may not return these yet — in that case the section
           * simply opens empty. It is still filled in from the response wherever possible so an
           * edit does not quietly blank out assistance the lead already had.
           */
          specialAssistanceRequired: Boolean(
            lead.specialAssistanceRequired ??
            lead.needsSpecialAssistance ??
            (Array.isArray(lead.specialAssistanceTypes) && lead.specialAssistanceTypes.length > 0)
          ),

          specialAssistanceTypes: Array.isArray(lead.specialAssistanceTypes)
            ? lead.specialAssistanceTypes
            : Array.isArray(lead.assistanceTypes)
              ? lead.assistanceTypes
              : [],

          assistancePassengerCount: Number(
            lead.assistancePassengerCount ??
            lead.assistancePassengers ??
            0
          ),

          specialAssistanceNotes:
            lead.specialAssistanceNotes ??
            lead.assistanceNotes ??
            "",

          notes:
            lead.notes ??
            lead.note ??
            lead.remarks ??
            lead.requirements ??
            "",
        });

        // Re-hydrate selected services (array of strings or {id,label})
        // const svcs = Array.isArray(lead.services) ? lead.services : [];
        // setSelectedServices(
        //   svcs.map((s) => (typeof s === "string" ? s.toLowerCase() : (s.id || s.label || "").toLowerCase()))
        // );


        const rawServices =
          lead.services ??
          lead.selectedServices ??
          lead.requiredServices ??
          [];

        const serviceList = Array.isArray(rawServices)
          ? rawServices
          : [];

        const normalizedServices = [
          ...new Set(
            serviceList
              .map(normalizeServiceId)
              .filter(Boolean)
          ),
        ];

        setSelectedServices(normalizedServices);

        // Re-hydrate itinerary rows
        // const itin = Array.isArray(lead.itinerary) ? lead.itinerary : [];
        // setItinerary(
        //   itin.length > 0
        //     ? itin.map((row) => ({
        //         id: nextId++,
        //         destination: row.destination || "",
        //         city: row.city || "",
        //         nights: row.nights || 1,
        //       }))
        //     : [{ id: nextId++, destination: "", city: "", nights: 2 }]
        // );


        const rawItinerary =
          lead.itinerary ??
          lead.itineraries ??
          lead.travelItinerary ??
          [];

        const itineraryList = Array.isArray(rawItinerary)
          ? rawItinerary
          : [];

        const hydratedItinerary =
          itineraryList.length > 0
            ? itineraryList.map((row) => {
              const destinationName = getEntityName(
                row.destination,
                row.destinationName ??
                row.destinationLabel ??
                ""
              );

              const cityName = getEntityName(
                row.city,
                row.cityName ??
                row.cityLabel ??
                ""
              );

              return {
                // UI-only unique key
                id: nextId++,

                destinationId:
                  row.destinationId ??
                  row.destinationPublicId ??
                  row.destination?.id ??
                  row.destination?.publicId ??
                  "",

                destination: destinationName,

                cityId:
                  row.cityId ??
                  row.cityPublicId ??
                  row.city?.id ??
                  row.city?.publicId ??
                  "",

                city: cityName,

                nights: Math.max(
                  1,
                  Number(
                    row.nights ??
                    row.noOfNights ??
                    row.stayNights ??
                    1
                  )
                ),
              };
            })
            : [
              {
                id: nextId++,
                destinationId: "",
                destination: "",
                cityId: "",
                city: "",
                nights: 2,
              },
            ];

        setItinerary(hydratedItinerary);

        setAssignedUserName(
          lead.assignedUser?.fullName ??
          lead.assignedUser?.name ??
          lead.assignedUser?.username ??
          lead.assignedUserName ??
          lead.assignTo?.fullName ??
          lead.assignTo?.name ??
          ""
        );

        setLeadCode(lead.publicId || lead.id || id);
      })
      .catch((err) => {
        if (isAlreadyReported(err)) return;   // the interceptor's toast already said it
        showToast(getErrorMessage(err, "Failed to load lead details."), "error");
      })
      .finally(() => setLoadingLead(false));
  }, [id, reset, showToast]);

  /* ── Services + Itinerary handlers (same as CreateLead) ──── */
  const toggleService = useCallback((svcId) => {
    setSelectedServices((prev) =>
      prev.includes(svcId) ? prev.filter((s) => s !== svcId) : [...prev, svcId]
    );
  }, []);

  const addItineraryRow = () => {
    setItinerary((prev) => [
      ...prev,
      {
        id: nextId++,
        destinationId: "",
        destination: "",
        cityId: "",
        city: "",
        nights: 2,
      },
    ]);
  };
  const removeItineraryRow = (rowId) => {
    setItinerary((prev) => prev.filter((r) => r.id !== rowId));
  };
  const updateItineraryRow = (rowId, field, value) => {
    setItinerary((prev) => prev.map((r) => r.id === rowId ? { ...r, [field]: value } : r));
  };

  /* ── Phone re-search (same UX as CreateLead, optional on edit) ── */
  const handlePhoneSearch = async (phone) => {
    if (!phone?.trim()) return;
    setSearching(true);
    try {
      const res = await leadService.searchByPhone(phone);
      const lead = res.data;
      setValue("customerName", lead.customerName || "");
      setValue("email", lead.email || "");
      if (lead.budget != null) setValue("budget", lead.budget);
      showToast(`Lead found: ${lead.customerName}`, "success");
    } catch (error) {
      if (isAlreadyReported(error)) return;

      // "No match" is the expected 404 and is not a failure the user needs alarming about.
      // Anything else (a 400, a conflict) must not be disguised as an empty result.
      const notFound = error?.response?.status === 404;
      showToast(
        notFound
          ? "No existing lead found for this phone number."
          : getErrorMessage(error, "Couldn't search by phone number."),
        notFound ? "info" : "error"
      );
    } finally {
      setSearching(false);
    }
  };

  /* ── Save Draft (local only, same as CreateLead) ──────────── */
  const onSaveDraft = async () => {
    setSavingDraft(true);
    await new Promise((r) => setTimeout(r, 800));
    setSavingDraft(false);
    showToast("Draft saved locally.", "success");
  };

  /* ── Submit (Update) ──────────────────────────────────────── */
  const onSubmit = async (data) => {
    if (selectedServices.length === 0) {
      showToast("Please select at least one service.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const safeAssignedUserId = data.assignedUserId || null;

      const payload = {
        ...data,
        assignedUserId: safeAssignedUserId,
        budget: data.budget === "" || data.budget == null ? null : Number(data.budget),
      };

      await leadService.updateLead(
        id,
        payload,
        selectedServices,
        itinerary
      );

      showToast(`Lead "${data.customerName}" updated successfully!`, "success");

      setTimeout(() => navigate("/allleads"), 1200);
    } catch (err) {
      if (isAlreadyReported(err)) return;   // the interceptor's toast already said it
      applyServerFieldErrors(err, "Failed to update lead. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Page Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-200">
                <FiFileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Edit Lead</h1>
                  {leadCode && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                      #{leadCode}
                    </span>
                  )}
                  {loadingLead && (
                    <span className="text-xs text-slate-400 font-medium animate-pulse">Loading…</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">Update lead information, itinerary & services</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/allleads")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300
                text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 transition-all shadow-sm"
            >
              <FiArrowLeft className="w-4 h-4" /> Back to Leads
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {loadingLead ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <SkeletonBlock h="h-72" />
              <SkeletonBlock h="h-64" />
              <SkeletonBlock h="h-56" />
              <SkeletonBlock h="h-64" />
              <SkeletonBlock h="h-48" />
            </div>
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
              <SkeletonBlock h="h-48" />
              <SkeletonBlock h="h-64" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Left Column */}
              <div className="flex-1 min-w-0 space-y-6">
                <LeadInformation
                  mode="edit"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                  onPhoneSearch={handlePhoneSearch}
                  searching={searching}
                  assignedUserName={assignedUserName}
                />
                <TravelDetails
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  getValues={getValues}
                  errors={errors}
                  clearErrors={clearErrors}
                  trigger={trigger}
                />
                <ServicesSection
                  selectedServices={selectedServices}
                  onToggle={toggleService}
                />
                <ItinerarySection
                  hydrationKey={id}
                  itinerary={itinerary}
                  onAdd={addItineraryRow}
                  onRemove={removeItineraryRow}
                  onUpdate={updateItineraryRow}
                />

                {/* Notes */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <FiFileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base">Customer Notes</h2>
                      <p className="text-amber-100 text-xs">Special requirements, budget, preferences</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <textarea
                      {...register("notes")}
                      rows={5}
                      placeholder="Enter customer requirements, special requests, budget, preferred hotels, destinations, dietary needs, accessibility requirements, etc."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
                        focus:border-amber-400 focus:ring-2 focus:ring-amber-50 outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <div className="flex flex-col sm:flex-row items-stretch gap-3">
                    <button
                      type="button"
                      onClick={onSaveDraft}
                      disabled={savingDraft || submitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl
                        border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800
                        font-semibold text-sm transition-all disabled:opacity-50 bg-white hover:bg-slate-50"
                    >
                      {savingDraft
                        ? <FiLoader className="w-4 h-4 animate-spin" />
                        : <FiSave className="w-4 h-4" />}
                      {savingDraft ? "Saving Draft..." : "Save Draft"}
                    </button>

                    <button
                      type="submit"
                      disabled={submitting || savingDraft}
                      className="w-full sm:flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
                        bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm
                        transition-all shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300
                        disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <FiLoader className="w-4 h-4 animate-spin" />
                          Updating Lead...
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          Update Lead
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/allleads")}
                      disabled={submitting || savingDraft}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                        border-2 border-red-100 hover:border-red-200 text-red-400 hover:text-red-600
                        font-semibold text-sm transition-all disabled:opacity-40 bg-white hover:bg-red-50"
                    >
                      <FiArrowLeft className="w-4 h-4" /> Discard
                    </button>
                  </div>

                  <p className="text-center text-xs text-slate-400 mt-3">
                    Changes are saved immediately when you click{" "}
                    <span className="font-bold text-indigo-600">Update Lead</span>.
                  </p>
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
                <div className="lg:sticky lg:top-20">
                  <LeadSummary
                    watch={watch}
                    selectedServices={selectedServices}
                    itinerary={itinerary}
                  />
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}






