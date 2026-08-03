// ─────────────────────────────────────────────────────────────────────────────
// OLD — replaced in Create Customer redesign. Kept verbatim for review/rollback.
//
// Create and Edit now share one UI, as asked: both render the same four components, so the
// only thing each page still owns is its header, its submit path and its wiring.
// ─────────────────────────────────────────────────────────────────────────────

// // src/customers/EditCustomer.jsx
// // ─────────────────────────────────────────────────────────────
// // Edit Customer Page — Travel CRM
// // Route: /EditCustomer/:id   (replaces CustomerFormModal popup)
// // Reuses all CreateCustomer sub-components unchanged:
// //   CustomerInformation | CustomerAddress
// //   CustomerDocuments   | CustomerNotes | CustomerSummary
// // On mount: fetches customer by id, pre-fills form
// // On submit: calls customerService.update(id, payload)
// // ─────────────────────────────────────────────────────────────
//
// import { useState, useCallback, useEffect } from "react";
// import { useForm } from "react-hook-form";
// import { useNavigate, useParams } from "react-router-dom";
// import { ArrowLeft as FiArrowLeft, CircleCheck as FiCheckCircle, Save as FiSave, User as FiUser } from "lucide-react";
//
//
// // ── Same folder imports (adjust if your structure differs) ────
// import CustomerInformation from "../components/CustomerInformation";
// import CustomerAddress     from "../components/CustomerAddress";
// import CustomerDocuments   from "../components/CustomerDocuments";
// import CustomerNotes       from "../components/CustomerNotes";
// import CustomerSummary     from "../components/CustomerSummary";
//
// import customerService     from "../api/customerService";
//
// const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
//
// /* ─── CRM TOAST (same pattern as every other page) ───────────── */
// function Toast({ msg, type, onClose }) {
//   useEffect(() => {
//     const t = setTimeout(onClose, 3800);
//     return () => clearTimeout(t);
//   }, [onClose]);
//   return (
//     <div
//       className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3
//         rounded-xl border shadow-2xl max-w-xs
//         ${type === "success"
//           ? "bg-green-50 border-green-200 text-green-800"
//           : "bg-red-50 border-red-200 text-red-800"}`}
//       style={{ animation: "slideIn .3s ease both" }}
//     >
//       <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
//       <p className="text-sm font-semibold flex-1">{msg}</p>
//       <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1 leading-none">×</button>
//     </div>
//   );
// }
//
// /* ─── SKELETON LOADER ────────────────────────────────────────── */
// function SkeletonBlock({ h = "h-64" }) {
//   return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${h} animate-pulse`}/>;
// }
//
// /* ─── MAIN PAGE ──────────────────────────────────────────────── */
// export default function EditCustomer() {
//   const navigate = useNavigate();
//   const { id }   = useParams();   // customer id from URL, e.g. CUS001
//
//   const [loadingCustomer, setLoadingCustomer] = useState(true);
//   const [customerCode,    setCustomerCode]    = useState("");
//   const [submitting,      setSubmitting]      = useState(false);
//   const [saving,          setSaving]          = useState(false);
//   const [toast,           setToast]           = useState(null);
//
//   const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);
//
//   const {
//     register,
//     handleSubmit,
//     watch,
//     setValue,
//     reset,
//     formState: { errors },
//   } = useForm({
//     defaultValues: {
//       name: "", phone: "", email: "", alternatePhone: "",
//       type: "Individual", commPref: "WhatsApp",
//       tier: "Bronze", status: "Active",
//       city: "", state: "", address: "", pincode: "",
//       birthday: "", anniversary: "",
//       passportNo: "", panNo: "", aadharNo: "", documents: "",
//       notes: "",
//     },
//   });
//
//   /* ── Load customer on mount ──────────────────────────────── */
//   useEffect(() => {
//     if (!id) {
//       showToast("No customer ID provided.", "error");
//       return;
//     }
//     setLoadingCustomer(true);
//
//     customerService
//       .getById(id)
//       .then((res) => {
//         // Support both { data: customer } and { data: { data: customer } }
//         const c = res.data?.data ?? res.data;
//
//         reset({
//           name:           c.name           || "",
//           phone:          c.phone          || "",
//           email:          c.email          || "",
//           alternatePhone: c.alternatePhone || "",
//           type:           c.type           || "Individual",
//           commPref:       c.commPref       || "WhatsApp",
//           tier:           c.tier           || "Bronze",
//           status:         c.status         || "Active",
//           city:           c.city           || "",
//           state:          c.state          || "",
//           address:        c.address        || "",
//           pincode:        c.pincode        || "",
//           birthday:       c.birthday       || "",
//           anniversary:    c.anniversary    || "",
//           passportNo:     c.passportNo     || "",
//           panNo:          c.panNo          || "",
//           aadharNo:       c.aadharNo       || "",
//           documents:      c.documents      || "",
//           notes:          c.notes          || "",
//         });
//
//         setCustomerCode(c.id || c.customerId || id);
//       })
//       .catch((err) => {
//         console.error("Failed to load customer:", err);
//         showToast(
//           err?.response?.data?.message || "Failed to load customer details.",
//           "error"
//         );
//       })
//       .finally(() => setLoadingCustomer(false));
//   }, [id, reset, showToast]);
//
//   /* ── Save Draft ──────────────────────────────────────────── */
//   const onSaveDraft = async () => {
//     setSaving(true);
//     await new Promise((r) => setTimeout(r, 700));
//     setSaving(false);
//     showToast("Draft saved locally.");
//   };
//
//   /* ── Submit (Update) ─────────────────────────────────────── */
//   const onSubmit = async (data) => {
//     setSubmitting(true);
//     try {
//       const payload = {
//         name:           data.name,
//         phone:          data.phone,
//         email:          data.email,
//         alternatePhone: data.alternatePhone,
//         type:           data.type,
//         commPref:       data.commPref,
//         tier:           data.tier,
//         status:         data.status,
//         city:           data.city,
//         state:          data.state,
//         address:        data.address,
//         pincode:        data.pincode,
//         birthday:       data.birthday || null,
//         anniversary:    data.anniversary || null,
//         passportNo:     data.passportNo,
//         panNo:          data.panNo,
//         aadharNo:       data.aadharNo,
//         documents:      data.documents,
//         notes:          data.notes,
//       };
//
//       await customerService.update(id, payload);
//
//       showToast(`Customer "${data.name}" updated successfully! ✅`);
//
//       setTimeout(() => navigate("/AllCustomers"), 1500);
//     } catch (err) {
//       showToast(
//         err?.response?.data?.message || "Failed to update customer.",
//         "error"
//       );
//     } finally {
//       setSubmitting(false);
//     }
//   };
//
//   /* ── RENDER ──────────────────────────────────────────────── */
//   return (
//     <div
//       className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
//       style={{ fontFamily: FONT }}
//     >
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
//         .fade-up { animation: fadeUp .4s ease both; }
//         ::-webkit-scrollbar{width:5px;height:5px}
//         ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
//         ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
//       `}</style>
//
//       {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
//
//       {/* ── PAGE HEADER ── */}
//       <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//             <div className="flex items-center gap-3">
//               <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500
//                 flex items-center justify-center text-white shadow-lg shadow-indigo-200 flex-shrink-0">
//                 <FiUser className="w-5 h-5"/>
//               </div>
//               <div>
//                 <div className="flex items-center gap-2 flex-wrap">
//                   <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Edit Customer</h1>
//                   {customerCode && (
//                     <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1
//                       rounded-full border border-indigo-200">
//                       {customerCode}
//                     </span>
//                   )}
//                   {loadingCustomer && (
//                     <span className="text-xs text-slate-400 font-medium animate-pulse">Loading…</span>
//                   )}
//                 </div>
//                 <p className="text-xs text-slate-400 hidden sm:block mt-0.5">
//                   <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/")}>Home</span>
//                   <span className="mx-1 text-slate-300">/</span>
//                   <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate("/AllCustomers")}>Customers</span>
//                   <span className="mx-1 text-slate-300">/</span>
//                   <span className="text-indigo-600 font-bold">Edit</span>
//                 </p>
//               </div>
//             </div>
//
//             <button
//               type="button"
//               onClick={() => navigate("/AllCustomers")}
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
//                 hover:border-indigo-300 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700
//                 text-sm font-bold transition-all shadow-sm self-start sm:self-auto"
//             >
//               <FiArrowLeft className="w-4 h-4"/> Back to Customers
//             </button>
//           </div>
//         </div>
//       </div>
//
//       {/* ── MAIN CONTENT ── */}
//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
//
//         {loadingCustomer ? (
//           <div className="flex flex-col lg:flex-row gap-6">
//             <div className="flex-1 space-y-5">
//               <SkeletonBlock h="h-72"/>
//               <SkeletonBlock h="h-56"/>
//               <SkeletonBlock h="h-64"/>
//               <SkeletonBlock h="h-48"/>
//             </div>
//             <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
//               <SkeletonBlock h="h-48"/>
//               <SkeletonBlock h="h-64"/>
//             </div>
//           </div>
//         ) : (
//           <form onSubmit={handleSubmit(onSubmit)} noValidate>
//             <div className="flex flex-col lg:flex-row gap-6">
//
//               {/* ── LEFT COLUMN — form sections ── */}
//               <div className="flex-1 min-w-0 space-y-5">
//
//                 <div className="fade-up">
//                   <CustomerInformation
//                     register={register}
//                     errors={errors}
//                     watch={watch}
//                     setValue={setValue}
//                   />
//                 </div>
//
//                 <div className="fade-up" style={{ animationDelay:"60ms" }}>
//                   <CustomerAddress
//                     register={register}
//                     errors={errors}
//                   />
//                 </div>
//
//                 <div className="fade-up" style={{ animationDelay:"100ms" }}>
//                   <CustomerDocuments
//                     register={register}
//                     errors={errors}
//                   />
//                 </div>
//
//                 <div className="fade-up" style={{ animationDelay:"140ms" }}>
//                   <CustomerNotes register={register}/>
//                 </div>
//
//                 {/* ── ACTION BUTTONS ── */}
//                 <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 fade-up"
//                   style={{ animationDelay:"180ms" }}>
//                   <div className="flex flex-col sm:flex-row items-stretch gap-3">
//
//                     <button
//                       type="button"
//                       onClick={onSaveDraft}
//                       disabled={saving || submitting}
//                       className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3
//                         rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600
//                         hover:text-slate-800 font-bold text-sm transition-all disabled:opacity-50
//                         bg-white hover:bg-slate-50"
//                     >
//                       {saving
//                         ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/>
//                         : <FiSave className="w-4 h-4"/>}
//                       {saving ? "Saving…" : "Save Draft"}
//                     </button>
//
//                     <button
//                       type="submit"
//                       disabled={submitting || saving}
//                       className="flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
//                         bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600
//                         active:from-indigo-800 text-white font-extrabold text-sm shadow-md shadow-indigo-200
//                         hover:shadow-lg hover:shadow-indigo-300 transition-all
//                         disabled:opacity-60 disabled:cursor-not-allowed"
//                     >
//                       {submitting ? (
//                         <>
//                           <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
//                           Updating Customer…
//                         </>
//                       ) : (
//                         <>
//                           <FiCheckCircle className="w-4 h-4"/>
//                           Update Customer
//                         </>
//                       )}
//                     </button>
//
//                     <button
//                       type="button"
//                       onClick={() => navigate("/AllCustomers")}
//                       disabled={submitting || saving}
//                       className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3
//                         rounded-xl border-2 border-red-100 hover:border-red-200 text-red-400
//                         hover:text-red-600 font-bold text-sm transition-all disabled:opacity-40
//                         bg-white hover:bg-red-50"
//                     >
//                       <FiArrowLeft className="w-4 h-4"/> Discard
//                     </button>
//                   </div>
//                   <p className="text-center text-xs text-slate-400 mt-3">
//                     Changes are saved immediately when you click{" "}
//                     <span className="font-bold text-indigo-600">Update Customer</span>.
//                   </p>
//                 </div>
//               </div>
//
//               {/* ── RIGHT SIDEBAR — live preview ── */}
//               <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
//                 <div className="lg:sticky lg:top-20">
//                   <CustomerSummary watch={watch} />
//                 </div>
//               </div>
//
//             </div>
//           </form>
//         )}
//       </div>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Create Customer redesign. Deliberately the SAME shell as Createcustomer.jsx, rendering the
// SAME four components, so Create and Edit are visually and behaviourally identical.
//
// Differences from Create, all of them intentional:
//   · no duplicate-phone check (this record already exists)
//   · no Save & New
//   · optional sections start EXPANDED — you came here to change a specific field, so hiding
//     two-thirds of the record behind a toggle would be the wrong default
//
// THE COMMPREF FIX lives here — see loadCustomer below.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, LoaderCircle, RotateCcw } from "lucide-react";

import customerService from "../api/customerService";
import CustomerInformation from "../components/CustomerInformation";
import CustomerAddress from "../components/CustomerAddress";
import CustomerDocuments from "../components/CustomerDocuments";
import CustomerNotes from "../components/CustomerNotes";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, getFieldErrors, isAlreadyReported } from "@shared/api/apiError";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

const trimmed = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const blankDefaults = () => ({
  name: "", phone: "", email: "", alternatePhone: "",
  commPref: "", type: "Individual", tier: "Bronze", status: "Active",
  city: "", state: "", address: "", pincode: "",
  birthday: "", anniversary: "",
  passportNo: "", panNo: "", aadharNo: "", documents: "",
  notes: "",
});

const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

// Module scope, not component scope — it is a constant, and keeping it out of the component means
// focusNext's useCallback does not need it as a dependency.
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function EditCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);

  const {
    register, handleSubmit, watch, reset, setError, getValues,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: blankDefaults(),
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(true);

  useEffect(() => {
    let active = true;
    customerService
      .getById(id)
      .then((response) => {
        if (!active) return;
        const c = response?.data?.data ?? response?.data ?? {};

        // OLD — replaced in Create Customer redesign
        // commPref: c.commPref || "WhatsApp",
        // type:     c.type     || "Individual",
        // tier:     c.tier     || "Bronze",
        // status:   c.status   || "Active",
        //
        // `comm_pref` is the one nullable column of those four — CustomerServiceImpl.applyDefaults()
        // back-fills type/tier/status and deliberately leaves commPref alone, because the backend
        // models "the customer never told us" as a real state. CustomerResponse is
        // @JsonInclude(NON_NULL), so a null arrives as an ABSENT key, `undefined || "WhatsApp"`
        // won, and the save below posted it straight back. Opening a customer to fix a typo in
        // their address therefore opted them into WhatsApp — and commPref is a live marketing
        // segment field (MarketingFieldCatalog / SegmentEvaluator), so that is a consent problem,
        // not a cosmetic one. Every customer created by a lead→booking conversion carries NULL
        // here, which made this the common path rather than an edge case.
        //
        // "" round-trips as null (see the payload below); the select renders it as the explicit
        // "No preference set" option, so the real state is visible and only changes deliberately.
        reset({
          name: c.name || "",
          phone: c.phone || "",
          email: c.email || "",
          alternatePhone: c.alternatePhone || "",
          commPref: c.commPref || "",
          type: c.type || "Individual",
          tier: c.tier || "Bronze",
          status: c.status || "Active",
          city: c.city || "",
          state: c.state || "",
          address: c.address || "",
          pincode: c.pincode || "",
          birthday: dateOnly(c.birthday),
          anniversary: dateOnly(c.anniversary),
          passportNo: c.passportNo || "",
          panNo: c.panNo || "",
          aadharNo: c.aadharNo || "",
          documents: c.documents || "",
          notes: c.notes || "",
        });
      })
      .catch((error) => {
        if (!active || isAlreadyReported(error)) return;
        showToast(getErrorMessage(error, "Failed to load customer details."), "error");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reset, showToast]);

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
    setSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: trimmed(data.email),
        alternatePhone: trimmed(data.alternatePhone),
        // "" -> null preserves "no preference stated" instead of inventing one.
        commPref: data.commPref || null,
        type: data.type || "Individual",
        tier: data.tier || "Bronze",
        status: data.status || "Active",
        city: trimmed(data.city),
        state: trimmed(data.state),
        address: trimmed(data.address),
        pincode: trimmed(data.pincode),
        birthday: data.birthday || null,
        anniversary: data.anniversary || null,
        passportNo: trimmed(data.passportNo),
        panNo: trimmed(data.panNo)?.toUpperCase() || null,
        aadharNo: trimmed(data.aadharNo),
        documents: trimmed(data.documents),
        notes: trimmed(data.notes),
      };

      await customerService.update(id, payload);
      showToast(`Customer "${payload.name}" updated.`, "success");
      navigate("/AllCustomers");
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
        showToast(getErrorMessage(error, "Failed to update customer."), "error");
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
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> Loading customer…
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
              onClick={() => navigate("/AllCustomers")}
              aria-label="Back to customers"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">Edit Customer</h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                <kbd className="rounded bg-slate-100 px-1">Enter</kbd> next field ·
                <kbd className="ml-1 rounded bg-slate-100 px-1">Ctrl+Enter</kbd> save
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => navigate("/AllCustomers")} disabled={submitting} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex">
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
        <CustomerInformation register={register} errors={errors} watch={watch} />

        <button
          type="button"
          onClick={() => setShowOptional((value) => !value)}
          aria-expanded={showOptional}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Hide address, documents & notes" : "Show address, documents & notes"}
        </button>

        {showOptional && (
          <>
            <CustomerAddress register={register} errors={errors} />
            <CustomerDocuments register={register} errors={errors} />
            <CustomerNotes register={register} errors={errors} />
          </>
        )}

        <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            <span className="font-bold text-red-500">*</span> Name and phone are required.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/AllCustomers")} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">Cancel</button>
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
