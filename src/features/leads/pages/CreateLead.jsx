import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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

export default function CreateLead() {
  const navigate = useNavigate();

  const {
    register, handleSubmit, watch, setValue, setError, getValues,
    formState: { errors },
    reset,
  } = useForm({
    // ── SMART DEFAULTS: form khulte hi ye auto-selected honge ──
    // User change kar sakta hai; reset() ke baad bhi yehi defaults aayenge.
    defaultValues: {
      customerName: "", phone: "", email: "",
      // ── budget field ──
      budget: "",
      leadSource: "Direct Call",   // ← default: Direct Call
      leadType: "Fresh Lead",      // ← default: Fresh Lead
      leadStage: "New Lead",
      assignTo: "",
      assignedUserId: "",          // ← logged-in user auto-select hota hai (LeadInformation mein)
      birthDate: "",
      travelDate: "", departCountry: "India", departCity: "",
      // adults ab derived hai (male + female) — TravelDetails ise auto set karta hai
      rooms: 1, male: 1, female: 1, adults: 2, children: 0, handicap: 0, infants: 0, extraBeds: 0,
      notes: "",
    },
  });

  console.log(handleSubmit)
  const [selectedServices, setSelectedServices] = useState(["hotel"]);
  const [itinerary, setItinerary] = useState([{ id: nextId++, destination: "", city: "", nights: 2 }]);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [searching, setSearching] = useState(false);

  // Centralized toaster: <ToastHost/> (mounted beside the router in App.jsx) renders it.
  // Argument order is (message, type) everywhere — see shared/ui/toast.jsx.
  const { showToast } = useToast();

  const toggleService = useCallback((id) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const addItineraryRow = () => {
    setItinerary((prev) => [...prev, { id: nextId++, destination: "", city: "", nights: 2 }]);
  };

  const removeItineraryRow = (id) => {
    setItinerary((prev) => prev.filter((r) => r.id !== id));
  };

  const updateItineraryRow = (id, field, value) => {
    setItinerary((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  /**
   * A 400 VALIDATION_ERROR carries `fieldErrors`, and those belong beside the input that caused
   * them — never in a toast. Anything the form doesn't actually render (an unknown key, or a
   * non-validation failure) still has to be said out loud, so that falls back to the toast.
   */
  const applyServerFieldErrors = (error, fallback) => {
    const fieldErrors = getFieldErrors(error) || {};
    const formFields = getValues();
    const inline = Object.keys(fieldErrors).filter((name) => name in formFields);

    inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));

    if (inline.length === 0) showToast(getErrorMessage(error, fallback), "error");
  };

  const onSubmit = async (data) => {
    if (selectedServices.length === 0) {
      showToast("Please select at least one service.", "error");
      return;
    }

    setSubmitting(true);

    try {
      // ── budget is already inside `data` via register("budget") ──
      // normalize empty string → null so the backend doesn't receive ""
      const payload = {
        ...data,
        budget: data.budget === "" || data.budget == null ? null : Number(data.budget),
      };

      const response = await leadService.createLead(
        payload,
        selectedServices,
        itinerary
      );

      console.log("Lead Created:", response.data);

      showToast(`Lead for "${data.customerName}" created successfully!`, "success");

      reset();
      setSelectedServices(["hotel"]);
      setItinerary([{ id: nextId++, destination: "", city: "", nights: 2 }]);

      // ── Navigate to All Leads after 1.2s so user sees the success toast ──
      setTimeout(() => navigate("/allleads"), 1200);

    } catch (error) {
      if (isAlreadyReported(error)) return;   // the interceptor's toast already said it

      applyServerFieldErrors(error, "Failed to create lead. Try again.");

    } finally {
      setSubmitting(false);
    }
  };

  const onSaveDraft = async () => {
    const data = watch();
    setSavingDraft(true);
    await new Promise((r) => setTimeout(r, 1000));
    console.log("Draft saved:", data);
    setSavingDraft(false);
    showToast("Draft saved successfully!", "success");
  };

  const handlePhoneSearch = async (phone) => {
    if (!phone?.trim()) return;

    setSearching(true);

    try {
      const res = await leadService.searchByPhone(phone);

      const lead = res.data;

      setValue("customerName", lead.customerName || "");
      setValue("email", lead.email || "");
      setValue("leadSource", lead.leadSource || "");
      setValue("leadType", lead.leadType || "");
      setValue("leadStage", lead.leadStage || "");
      setValue("assignTo", lead.assignTo || "");
      // ── prefill budget on phone-match too ──
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-md shadow-blue-200">
                <FiFileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create New Lead</h1>
                <p className="text-sm text-slate-500 mt-0.5">Manage customer travel enquiries efficiently</p>
              </div>
            </div>
            <button onClick={() => navigate("/allleads")}
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300
                text-sm font-semibold text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 transition-all shadow-sm"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Leads
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column */}
            <div className="flex-1 min-w-0 space-y-6">
              <LeadInformation
                mode="create"
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                onPhoneSearch={handlePhoneSearch}
                searching={searching}
              />
              <TravelDetails
                register={register}
                watch={watch}
                setValue={setValue}
                getValues={getValues}
              />
              <ServicesSection
                selectedServices={selectedServices}
                onToggle={toggleService}
              />
              <ItinerarySection
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
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={onSaveDraft}
                    disabled={savingDraft || submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl
                      border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800
                      font-semibold text-sm transition-all disabled:opacity-50 bg-white hover:bg-slate-50"
                  >
                    {savingDraft ? (
                      <FiLoader className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiSave className="w-4 h-4" />
                    )}
                    {savingDraft ? "Saving Draft..." : "Save Draft"}
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || savingDraft}
                    className="w-full sm:flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
                      bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm
                      transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Creating Lead...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        Create Lead
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-3">
                  Fields marked with <span className="text-red-500">*</span> are required.
                  Customer name and phone are mandatory.
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