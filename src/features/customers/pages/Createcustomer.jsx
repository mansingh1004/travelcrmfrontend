
// ─────────────────────────────────────────────────────────────────────────────
// OLD — replaced in Create Customer redesign. Kept verbatim for review/rollback.
//
// Create and Edit now share one UI, as asked: both render the same four components, so the
// only thing each page still owns is its header, its submit path and its wiring.
// ─────────────────────────────────────────────────────────────────────────────

// // ─────────────────────────────────────────────────────────────
// // Create Customer — Travel CRM
// // Same structure as CreateLead.jsx
// // ─────────────────────────────────────────────────────────────
//
// import { useState } from "react";
// import { useForm } from "react-hook-form";
// import { ArrowLeft as FiArrowLeft, CircleCheck as FiCheckCircle, Save as FiSave, User as FiUser } from "lucide-react";
//
//
// import CustomerInformation from "../components/CustomerInformation";
// import CustomerAddress     from "../components/CustomerAddress";
// import CustomerDocuments   from "../components/CustomerDocuments";
// import CustomerNotes       from "../components/CustomerNotes";
// import CustomerSummary     from "../components/CustomerSummary";
//
// // ── Uncomment when backend is ready ──────────────────────────
// import  customerService  from "../api/customerService";
// import { useNavigate }     from "react-router-dom";
// import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
//
// /* ─── TOAST ──────────────────────────────────────────────────── */
// function Toast({ msg, type, onClose }) {
//   return (
//     <div
//       className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border
//         shadow-2xl max-w-xs
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
// /* ─── MAIN PAGE ──────────────────────────────────────────────── */
// export default function CreateCustomer() {
//   const navigate = useNavigate();
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
//   const [submitting, setSubmitting] = useState(false);
//   const [saving,     setSaving]     = useState(false);
//   const [toast,      setToast]      = useState(null);
//
//   const showToast = (msg, type = "success") => setToast({ msg, type });
//
//   /* ── Save Draft ── */
//   const onSaveDraft = async () => {
//     setSaving(true);
//     // ── BACKEND: save draft to localStorage or API ────────────
//     await new Promise(r => setTimeout(r, 800));
//     setSaving(false);
//     showToast("Draft saved successfully.");
//   };
//
//   /* ── Submit ── */
//   const onSubmit = async (data) => {
//   setSubmitting(true);
//
//   try {
//     const payload = {
//       name: data.name,
//       phone: data.phone,
//       email: data.email,
//       alternatePhone: data.alternatePhone,
//       type: data.type,
//       commPref: data.commPref,
//       tier: data.tier,
//       status: data.status,
//       city: data.city,
//       state: data.state,
//       address: data.address,
//       pincode: data.pincode,
//       birthday: data.birthday || null,
//       anniversary: data.anniversary || null,
//       passportNo: data.passportNo,
//       panNo: data.panNo,
//       aadharNo: data.aadharNo,
//       documents: data.documents,
//       notes: data.notes,
//     };
//
//     const res = await customerService.create(payload);
//
//     // POST /api/customers answers ApiResponse<CustomerResponse>, so the customer sits at
//     // res.data.data. Reading res.data.name made the success toast read
//     // `Customer "undefined" created! ID: undefined` on every single create.
//     const created = res?.data?.data ?? res?.data ?? {};
//
//     showToast(
//       `Customer "${created.name || payload.name}" created!${created.customerId ? ` ID: ${created.customerId}` : ""}`
//     );
//
//     reset();
//
//     navigate("/AllCustomers");
//
//   } catch (err) {
//     // 400/404/409 are silent by design in the interceptor — a duplicate phone (409
//     // DuplicateCustomerException) and a trashed match (RestoreAvailableException) both land
//     // here, and this is the only place they can be shown.
//     if (isAlreadyReported(err)) return;
//     showToast(getErrorMessage(err, "Failed to create customer."), "error");
//   } finally {
//     setSubmitting(false);
//   }
// };
//
//   return (
//     <div
//       className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
//       style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
//     >
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
//       `}</style>
//
//       {toast && (
//         <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
//       )}
//
//       {/* ── TOP NAV ── */}
//       {/* <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 shadow-sm">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white font-black text-sm shadow">T</div>
//             <span className="font-extrabold text-slate-800 text-sm hidden sm:block">TravelCRM</span>
//           </div>
//           <div className="text-xs text-slate-400 flex items-center gap-1 font-medium">
//             <span className="hover:text-blue-600 cursor-pointer transition-colors">Home</span>
//             <span className="mx-1 text-slate-300">/</span>
//             <span className="hover:text-blue-600 cursor-pointer transition-colors">Customers</span>
//             <span className="mx-1 text-slate-300">/</span>
//             <span className="text-blue-600 font-bold">Create</span>
//           </div>
//         </div>
//       </nav> */}
//
//       {/* ── PAGE HEADER ── */}
//       <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
//                 <FiUser className="w-6 h-6" />
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create New Customer</h1>
//                 <p className="text-sm text-slate-400 mt-0.5">Add a new customer to your Travel CRM</p>
//               </div>
//             </div>
//             <button
//               type="button"
//               onClick={() => (window.location.href = "/AllCustomers")}
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300
//                 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-bold transition-all shadow-sm"
//             >
//               <FiArrowLeft className="w-4 h-4" /> Back to Customers
//             </button>
//           </div>
//         </div>
//       </div>
//
//       {/* ── MAIN CONTENT ── */}
//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
//         <form onSubmit={handleSubmit(onSubmit)} noValidate>
//           <div className="flex flex-col lg:flex-row gap-6">
//
//             {/* ── LEFT COLUMN ── */}
//             <div className="flex-1 min-w-0 space-y-5">
//
//               <CustomerInformation
//                 register={register}
//                 errors={errors}
//                 watch={watch}
//                 setValue={setValue}
//               />
//
//               <CustomerAddress
//                 register={register}
//                 errors={errors}
//               />
//
//               <CustomerDocuments
//                 register={register}
//                 errors={errors}
//               />
//
//               <CustomerNotes
//                 register={register}
//               />
//
//               {/* ── SUBMIT ── */}
//               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
//                 <div className="flex flex-col sm:flex-row items-stretch gap-3">
//                   <button
//                     type="button"
//                     onClick={onSaveDraft}
//                     disabled={saving || submitting}
//                     className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3
//                       rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600
//                       hover:text-slate-800 font-bold text-sm transition-all disabled:opacity-50
//                       bg-white hover:bg-slate-50"
//                   >
//                     {saving
//                       ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
//                       : <FiSave className="w-4 h-4" />}
//                     {saving ? "Saving Draft..." : "Save Draft"}
//                   </button>
//
//                   <button
//                     type="submit"
//                     disabled={submitting || saving}
//                     className="flex-1 flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl
//                       bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-sm
//                       transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300
//                       disabled:opacity-60 disabled:cursor-not-allowed"
//                   >
//                     {submitting ? (
//                       <>
//                         <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
//                         Creating Customer...
//                       </>
//                     ) : (
//                       <>
//                         <FiCheckCircle className="w-4 h-4" />
//                         Create Customer
//                       </>
//                     )}
//                   </button>
//
//                   <button
//                     type="button"
//                     onClick={() => reset()}
//                     disabled={submitting || saving}
//                     className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3
//                       rounded-xl border-2 border-red-100 hover:border-red-200 text-red-400
//                       hover:text-red-600 font-bold text-sm transition-all disabled:opacity-40
//                       bg-white hover:bg-red-50"
//                   >
//                     <FiArrowLeft className="w-4 h-4" /> Reset
//                   </button>
//                 </div>
//                 <p className="text-center text-xs text-slate-400 mt-3">
//                   Fields marked with <span className="text-red-500 font-bold">*</span> are required.
//                   Full Name and Phone are mandatory.
//                 </p>
//               </div>
//             </div>
//
//             {/* ── RIGHT SIDEBAR ── */}
//             <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
//               <div className="lg:sticky lg:top-20">
//                 <CustomerSummary watch={watch} />
//               </div>
//             </div>
//
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Create Customer redesign.
//
// Same shell as CreateBookingClean: compact header, flat panels, no
// gradient bands, no sidebar. The 17 optional fields collapse behind one toggle so the 2 that are
// actually required own the top of the screen.
//
// Three dead controls were removed rather than restyled:
//   · the 900ms setTimeout "Search Existing Customer by Phone" — replaced by a real debounced
//     lookup on the phone field itself, rendered as an inline strip
//   · "Save Draft", which slept 800ms, console.logged nothing and toasted "Draft saved successfully"
//   · the 320px CustomerSummary sidebar — a progress meter that opened at 33% on an empty form,
//     plus a live preview of the fields the clerk was looking at 320px to its left
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import customerService from "../api/customerService";
import CustomerInformation from "../components/CustomerInformation";
import CustomerAddress from "../components/CustomerAddress";
import CustomerDocuments from "../components/CustomerDocuments";
import CustomerNotes from "../components/CustomerNotes";
import { trashService } from "@features/trash";
import { useToast } from "@shared/ui/toast";
import { ErrorCode, getErrorMessage, getFieldErrors, isAlreadyReported, normalizeError } from "@shared/api/apiError";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

/* Sticky fields — same idea as the lead and booking forms. A clerk entering a batch keeps the same
   city/state/type for a run; sessionStorage so it dies with the tab. */
const STICKY_KEY = "customerEntry:sticky";
const STICKY_FIELDS = ["type", "tier", "status", "city", "state"];
const readSticky = () => {
  try { const raw = sessionStorage.getItem(STICKY_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
};
const writeSticky = (values) => {
  try {
    const slice = {};
    STICKY_FIELDS.forEach((k) => { if (values[k]) slice[k] = values[k]; });
    sessionStorage.setItem(STICKY_KEY, JSON.stringify(slice));
  } catch { /* private mode — sticky is a convenience, never a requirement */ }
};

/* commPref is deliberately NOT defaulted. The old form hardcoded "WhatsApp" here, which is how a
   preference nobody stated ended up on every manually-created customer — and commPref feeds
   marketing segmentation, so an invented value is a consent problem. Empty means "not stated",
   which is exactly what the nullable column is for. */
const blankDefaults = () => ({
  name: "", phone: "", email: "", alternatePhone: "",
  commPref: "", type: "Individual", tier: "Bronze", status: "Active",
  city: "", state: "", address: "", pincode: "",
  birthday: "", anniversary: "",
  passportNo: "", panNo: "", aadharNo: "", documents: "",
  notes: "",
});

const trimmed = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

// Module scope, not component scope — it is a constant, and keeping it out of the component means
// focusNext's useCallback does not need it as a dependency.
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function CreateCustomer() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);
  const phoneRef = useRef(null);

  const {
    register, handleSubmit, watch, reset, setError, getValues,
    formState: { errors },
  } = useForm({
    // The old form passed no mode, so RHF defaulted to onSubmit and nothing was checked until the
    // button at the bottom of a ~2,040px page.
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { ...blankDefaults(), ...readSticky() },
  });

  const [submitting, setSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [duplicate, setDuplicate] = useState(null);   // { kind: 'live'|'trashed', ... }
  const [restoring, setRestoring] = useState(false);

  const phone = watch("phone");

  useEffect(() => { phoneRef.current?.focus(); }, []);

  /* ── Duplicate check ────────────────────────────────────────────────────────────────────────
     Phone is the per-tenant natural key. The old "search" was a 900ms setTimeout with the real
     call commented out, so nothing was ever caught until the server rejected the save.
     A miss is silent — at 100 records a day a toast on every new customer is pure noise. */
  useEffect(() => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 7) { setDuplicate(null); return undefined; }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await customerService.searchByPhone(String(phone).trim());
        const found = response?.data?.data ?? response?.data;
        if (active && found && (found.publicId || found.id)) {
          setDuplicate({ kind: "live", customer: found });
        } else if (active) {
          setDuplicate(null);
        }
      } catch (error) {
        if (!active) return;
        // A 404 is the ordinary answer for a new customer.
        if (error?.response?.status === 404) { setDuplicate(null); return; }
        // A trashed match comes back as RESTORE_AVAILABLE with the publicId in `details` — that is
        // the one case worth interrupting for, because the clerk can recover the record instead of
        // re-keying it.
        const normalized = normalizeError(error);
        if (normalized?.code === ErrorCode.RESTORE_AVAILABLE && normalized.details?.publicId) {
          setDuplicate({
            kind: "trashed",
            entityType: normalized.details.entityType || "customer",
            publicId: normalized.details.publicId,
            message: normalized.message,
          });
          return;
        }
        setDuplicate(null); // a failed check must never block data entry
      }
    }, 500);

    return () => { active = false; window.clearTimeout(timer); };
  }, [phone]);

  const restoreTrashed = async () => {
    if (!duplicate || duplicate.kind !== "trashed") return;
    setRestoring(true);
    try {
      await trashService.restoreItem(duplicate.entityType, duplicate.publicId);
      showToast("Customer restored. Opening the existing record.", "success");
      navigate(`/EditCustomer/${duplicate.publicId}`);
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Could not restore that customer."), "error");
      }
    } finally {
      setRestoring(false);
    }
  };

  /* ── Keyboard: Enter advances, Ctrl+Enter saves, Ctrl+Shift+Enter saves and starts the next ── */
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

  const save = async (data, { addAnother } = {}) => {
    setSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: trimmed(data.email),
        alternatePhone: trimmed(data.alternatePhone),
        // "" means "not stated" and must reach the backend as null, not as a fabricated channel.
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

      const response = await customerService.create(payload);
      const created = response?.data?.data ?? response?.data ?? {};
      writeSticky(data);

      if (addAnother) {
        reset({ ...blankDefaults(), ...readSticky() });
        setDuplicate(null);
        showToast(`${created.customerId || created.name || "Customer"} saved — next record ready.`, "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => phoneRef.current?.focus(), 0);
      } else {
        showToast(`Customer "${created.name || payload.name}" created.`, "success");
        navigate("/AllCustomers");
      }
    } catch (error) {
      if (isAlreadyReported(error)) return;

      // 400 VALIDATION_ERROR carries fieldErrors, and those belong beside the input that caused
      // them. The old catch flattened every server failure into one string in a local toast.
      const fieldErrors = getFieldErrors(error) || {};
      const own = getValues();
      const inline = Object.keys(fieldErrors).filter((name) => name in own);
      if (inline.length > 0) {
        inline.forEach((name) => setError(name, { type: "server", message: fieldErrors[name] }));
        const node = formRef.current?.querySelector(`#${CSS.escape(inline[0])}`);
        node?.focus?.();
        node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      } else {
        showToast(getErrorMessage(error, "Failed to create customer."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onFormKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const addAnother = event.shiftKey;
      handleSubmit((data) => save(data, { addAnother }))();
      return;
    }
    const target = event.target;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      event.preventDefault();
      focusNext(target);
    }
  };

  const clearForm = () => {
    reset(blankDefaults());
    setDuplicate(null);
    phoneRef.current?.focus();
  };

  const duplicateStrip = duplicate && (
    <div
      className={`mt-4 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
        duplicate.kind === "trashed" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {duplicate.kind === "trashed"
          ? <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
        <div className="min-w-0 text-xs">
          <p className={`font-bold ${duplicate.kind === "trashed" ? "text-rose-900" : "text-amber-900"}`}>
            {duplicate.kind === "trashed"
              ? "This phone belongs to a deleted customer"
              : "A customer already exists on this number"}
          </p>
          <p className={`mt-0.5 truncate ${duplicate.kind === "trashed" ? "text-rose-800" : "text-amber-800"}`}>
            {duplicate.kind === "trashed"
              ? "Restore it instead of creating a duplicate."
              : [duplicate.customer.customerId, duplicate.customer.name, duplicate.customer.city]
                  .filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {duplicate.kind === "trashed" ? (
          <button
            type="button"
            onClick={restoreTrashed}
            disabled={restoring}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
          >
            {restoring ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/EditCustomer/${duplicate.customer.publicId || duplicate.customer.id}`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </button>
        )}
      </div>
    </div>
  );

  return (
    <form
      ref={formRef}
      onSubmit={(event) => handleSubmit((data) => save(data, { addAnother: false }))(event)}
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
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">Create Customer</h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                <kbd className="rounded bg-slate-100 px-1">Enter</kbd> next field ·
                <kbd className="ml-1 rounded bg-slate-100 px-1">Ctrl+Enter</kbd> save ·
                <kbd className="ml-1 rounded bg-slate-100 px-1">Ctrl+Shift+Enter</kbd> save &amp; new
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={clearForm} disabled={submitting} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex">
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              type="button"
              onClick={handleSubmit((data) => save(data, { addAnother: true }))}
              disabled={submitting}
              className="hidden items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" /> Save &amp; New
            </button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-4">
        <CustomerInformation
          register={register}
          errors={errors}
          watch={watch}
          phoneRef={phoneRef}
          belowPhone={duplicateStrip}
        />

        {/* 17 of the 19 fields are optional. Collapsing them keeps the two that matter above the
            fold instead of making the clerk scroll past everything that does not. */}
        <button
          type="button"
          onClick={() => setShowOptional((value) => !value)}
          aria-expanded={showOptional}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Hide optional details" : "Add address, documents & notes (optional)"}
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
            <span className="font-bold text-red-500">*</span> Only name and phone are required — everything else can be added later.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/AllCustomers")} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">Cancel</button>
            <button
              type="button"
              onClick={handleSubmit((data) => save(data, { addAnother: true }))}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:flex-none"
            >
              <Plus className="h-4 w-4" /> Save &amp; New
            </button>
            <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      </main>
    </form>
  );
}
