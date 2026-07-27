// // src/components/CreateVendor/CreateVendor.jsx
// // ─────────────────────────────────────────────────────────────
// // Create Vendor Page — Travel CRM
// // Same structure as CreateLead.jsx / CreateCustomer.jsx
// // Font: Plus Jakarta Sans | Tailwind CSS | React Hook Form
// // ─────────────────────────────────────────────────────────────

// import { useState, useCallback } from "react";
// import { useForm } from "react-hook-form";
// import { ArrowLeft as FiArrowLeft, CircleCheck as FiCheckCircle, Save as FiSave, Handshake as FaHandshake } from "lucide-react";


// import VendorInformation from "../components/VendorInformation";
// import VendorLocation    from "../components/VendorLocation";
// import VendorServices    from "../components/VendorServices";
// import VendorFinancials  from "../components/VendorFinancials";
// import VendorNotes       from "../components/VendorNotes";
// import VendorSummary     from "../components/VendorSummary";

// // ── Uncomment when backend is ready ──────────────────────────
// import  vendorService  from "../api/vendorService";
// import { useNavigate }    from "react-router-dom";

// /* ─── TOAST ──────────────────────────────────────────────────── */
// function Toast({ msg, type, onClose }) {
//   return (
//     <div
//       className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl
//         border shadow-2xl max-w-xs
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

// /* ─── MAIN PAGE ──────────────────────────────────────────────── */
// export default function CreateVendor() {
//   const navigate = useNavigate();

//   const {
//     register,
//     handleSubmit,
//     watch,
//     setValue,
//     reset,
//     formState: { errors },
//   } = useForm({
//     defaultValues: {
//       vendorName: "", vendorType: "", contactPerson: "",
//       phone: "", alternatePhone: "", email: "", whatsapp: "",
//       contractType: "Rate Contract", paymentTerms: "Net 30",
//       commPref: "WhatsApp", status: "ACTIVE",
//       city: "", state: "", country: "India",
//       address: "", pincode: "", coverageAreas: "",
//       serviceDescription: "",
//       commissionRate: "", currency: "INR (₹)", creditPeriod: "Net 30",
//       creditLimit: "", openingBalance: "",
//       bankName: "", accountName: "", accountNumber: "", ifscCode: "", upiId: "",
//       gstNumber: "", panNumber: "",
//       notes: "", specialConditions: "",
//     },
//   });

//   const [selectedServices, setSelectedServices] = useState([]);
//   const [submitting, setSubmitting] = useState(false);
//   const [saving,     setSaving]     = useState(false);
//   const [toast,      setToast]      = useState(null);

//   const showToast = (msg, type = "success") => setToast({ msg, type });

//   /* ── Toggle service selection ── */
//   const handleServiceToggle = useCallback((id, label) => {
//     setSelectedServices(prev => {
//       const exists = prev.find(s => s.id === id);
//       return exists ? prev.filter(s => s.id !== id) : [...prev, { id, label }];
//     });
//   }, []);

//   /* ── Save Draft ── */
//   const onSaveDraft = async () => {
//     setSaving(true);
//     // ── BACKEND: save to localStorage or API ─────────────────
//     await new Promise(r => setTimeout(r, 800));
//     setSaving(false);
//     showToast("Draft saved successfully.");
//   };

//   /* ── Submit ── */
//   const onSubmit = async (data) => {
//     if (selectedServices.length === 0) {
//       showToast("Please select at least one service.", "error");
//       return;
//     }
//     setSubmitting(true);
//     try {
//   const payload = {
//     vendorName: data.vendorName,
//     vendorType: data.vendorType,
//     contactPerson: data.contactPerson,
//     phone: data.phone,
//     alternatePhone: data.alternatePhone,
//     email: data.email,
//     whatsapp: data.whatsapp,
//     contractType: data.contractType,
//     paymentTerms: data.paymentTerms,
//     commPref: data.commPref,
//     status: data.status,

//     city: data.city,
//     state: data.state,
//     country: data.country,
//     address: data.address,
//     pincode: data.pincode,

//     coverageAreas: data.coverageAreas,

//     services: selectedServices.map(s => s.label),

//     serviceDescription: data.serviceDescription,

//     commissionRate: parseFloat(data.commissionRate) || 0,
//     currency: data.currency,

//     creditPeriod: data.creditPeriod,
//     creditLimit: parseFloat(data.creditLimit) || 0,
//     openingBalance: parseFloat(data.openingBalance) || 0,

//     bankName: data.bankName,
//     accountName: data.accountName,
//     accountNumber: data.accountNumber,
//     ifscCode: data.ifscCode,
//     upiId: data.upiId,

//     gstNumber: data.gstNumber,
//     panNumber: data.panNumber,

//     notes: data.notes,
//     specialConditions: data.specialConditions,
//   };

//   const res = await vendorService.create(payload);

//   showToast(
//     `Vendor "${res.data.vendorName}" created! Code: ${res.data.vendorCode}`
//   );

//   reset();
//   setSelectedServices([]);

//   navigate("/AllVendors");
// }
//    catch (err) {
//       showToast(err?.response?.data?.message || "Failed to create vendor.", "error");
//     } finally {
//       setSubmitting(false);
//     }
//   };

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

//       {toast && (
//         <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
//       )}

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
//             <span className="hover:text-blue-600 cursor-pointer transition-colors">Vendors</span>
//             <span className="mx-1 text-slate-300">/</span>
//             <span className="text-blue-600 font-bold">Create</span>
//           </div>
//         </div>
//       </nav> */}

//       {/* ── PAGE HEADER ── */}
//       <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
//         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
//                 <FaHandshake className="w-6 h-6" />
//               </div>
//               <div>
//                 <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create New Vendor</h1>
//                 <p className="text-sm text-slate-400 mt-0.5">Add a hotel, airline, transport or DMC partner</p>
//               </div>
//             </div>
//             <button
//               type="button"
//                    onClick={() => { navigate("/AllVendors") }}
//             // onClick={() => (window.location.href = "/AllVendors")}
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
//                 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
//                 text-sm font-bold transition-all shadow-sm"
//             >
//               <FiArrowLeft className="w-4 h-4" /> Back to Vendors
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* ── MAIN CONTENT ── */}
//       <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
//         <form onSubmit={handleSubmit(onSubmit)} noValidate>
//           <div className="flex flex-col lg:flex-row gap-6">

//             {/* ── LEFT COLUMN ── */}
//             <div className="flex-1 min-w-0 space-y-5">

//               <VendorInformation
//                 register={register}
//                 errors={errors}
//                 watch={watch}
//                 setValue={setValue}
//               />

//               <VendorLocation
//                 register={register}
//                 errors={errors}
//               />

//               <VendorServices
//                 selectedServices={selectedServices}
//                 onToggle={handleServiceToggle}
//                 register={register}
//               />

//               <VendorFinancials
//                 register={register}
//                 errors={errors}
//               />

//               <VendorNotes
//                 register={register}
//               />

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
//                         Creating Vendor...
//                       </>
//                     ) : (
//                       <>
//                         <FiCheckCircle className="w-4 h-4" />
//                         Create Vendor
//                       </>
//                     )}
//                   </button>

//                   <button
//                     type="button"
//                     onClick={() => { reset(); setSelectedServices([]); }}
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
//                   Vendor name, type, and phone are mandatory.
//                 </p>
//               </div>
//             </div>

//             {/* ── RIGHT SIDEBAR ── */}
//             <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
//               <div className="lg:sticky lg:top-20">
//                 <VendorSummary
//                   watch={watch}
//                   selectedServices={selectedServices}
//                 />
//               </div>
//             </div>

//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }




// src/components/CreateVendor/CreateVendor.jsx
// ─────────────────────────────────────────────────────────────
// Create Vendor Page — Travel CRM
// Same structure as CreateLead.jsx / CreateCustomer.jsx
// Font: Plus Jakarta Sans | Tailwind CSS | React Hook Form
// ─────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft as FiArrowLeft, CircleCheck as FiCheckCircle, Save as FiSave, Handshake as FaHandshake } from "lucide-react";


import VendorInformation from "../components/VendorInformation";
import VendorLocation    from "../components/VendorLocation";
import VendorServices    from "../components/VendorServices";
import VendorFinancials  from "../components/VendorFinancials";
import VendorNotes       from "../components/VendorNotes";
import VendorSummary     from "../components/VendorSummary";

// ── Uncomment when backend is ready ──────────────────────────
import  vendorService  from "../api/vendorService";
import { useNavigate }    from "react-router-dom";

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  return (
    <div
      className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl
        border shadow-2xl max-w-xs
        ${type === "success"
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}
    >
      <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1 leading-none">×</button>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function CreateVendor() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      vendorName: "", vendorType: "", contactPerson: "",
      phone: "", alternatePhone: "", email: "", whatsapp: "",
      contractType: "Rate Contract", paymentTerms: "Net 30",
      commPref: "WhatsApp", status: "ACTIVE",
      city: "", state: "", country: "India",
      address: "", pincode: "", coverageAreas: "",
      serviceDescription: "",
      commissionRate: "", currency: "INR (₹)", creditPeriod: "Net 30",
      creditLimit: "", openingBalance: "",
      bankName: "", accountName: "", accountNumber: "", ifscCode: "", upiId: "",
      gstNumber: "", panNumber: "",
      notes: "", specialConditions: "",
    },
  });

  const [selectedServices, setSelectedServices] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  /* ── Toggle service selection ── */
  const handleServiceToggle = useCallback((id, label) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === id);
      return exists ? prev.filter(s => s.id !== id) : [...prev, { id, label }];
    });
  }, []);

  /* ── Save Draft ── */
  const onSaveDraft = async () => {
    setSaving(true);
    // ── BACKEND: save to localStorage or API ─────────────────
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    showToast("Draft saved successfully.");
  };

  /* ── Submit ── */
  const onSubmit = async (data) => {
    if (selectedServices.length === 0) {
      showToast("Please select at least one service.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        vendorName: data.vendorName,
        vendorType: data.vendorType,
        contactPerson: data.contactPerson,
        phone: data.phone,
        alternatePhone: data.alternatePhone,
        email: data.email,
        whatsapp: data.whatsapp,
        contractType: data.contractType,
        paymentTerms: data.paymentTerms,
        commPref: data.commPref,
        status: data.status,

        city: data.city,
        state: data.state,
        country: data.country,
        address: data.address,
        pincode: data.pincode,

        coverageAreas: data.coverageAreas,

        services: selectedServices.map(s => s.label),

        serviceDescription: data.serviceDescription,

        commissionRate: parseFloat(data.commissionRate) || 0,
        currency: data.currency,

        creditPeriod: data.creditPeriod,
        creditLimit: parseFloat(data.creditLimit) || 0,
        openingBalance: parseFloat(data.openingBalance) || 0,

        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        upiId: data.upiId,

        gstNumber: data.gstNumber,
        panNumber: data.panNumber,

        notes: data.notes,
        specialConditions: data.specialConditions,
      };

      const res = await vendorService.create(payload);

      showToast(
        `Vendor "${res.data.vendorName}" created! Code: ${res.data.vendorCode}`
      );

      reset();
      setSelectedServices([]);

      navigate("/AllVendors");
    }
    catch (err) {
      showToast(err?.response?.data?.message || "Failed to create vendor.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200 shrink-0">
                <FaHandshake className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight truncate">Create New Vendor</h1>
                <p className="text-sm text-slate-400 mt-0.5 truncate">Add a hotel, airline, transport or DMC partner</p>
              </div>
            </div>
            
            {/* Added shrink-0 and whitespace-nowrap to prevent button from breaking */}
            <button
              type="button"
              onClick={() => { navigate("/AllVendors") }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                text-sm font-bold transition-all shadow-sm shrink-0 whitespace-nowrap w-full sm:w-auto"
            >
              <FiArrowLeft className="w-4 h-4" /> Back to Vendors
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── LEFT COLUMN ── */}
            <div className="flex-1 min-w-0 space-y-5">

              <VendorInformation
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
              />

              <VendorLocation
                register={register}
                errors={errors}
              />

              <VendorServices
                selectedServices={selectedServices}
                onToggle={handleServiceToggle}
                register={register}
              />

              <VendorFinancials
                register={register}
                errors={errors}
              />

              <VendorNotes
                register={register}
              />

              {/* ── SUBMIT BUTTONS (MADE RESPONSIVE) ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5">
                <div className="flex flex-col md:flex-row flex-wrap items-stretch gap-3">
                  
                  <button
                    type="button"
                    onClick={onSaveDraft}
                    disabled={saving || submitting}
                    className="w-full md:flex-1 md:w-auto flex items-center justify-center gap-2 px-4 py-3
                      rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600
                      hover:text-slate-800 font-bold text-sm transition-all disabled:opacity-50
                      bg-white hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    {saving
                      ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      : <FiSave className="w-4 h-4" />}
                    {saving ? "Saving Draft..." : "Save Draft"}
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || saving}
                    className="w-full md:flex-[2] md:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                      bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-sm
                      transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300
                      disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Creating Vendor...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        Create Vendor
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { reset(); setSelectedServices([]); }}
                    disabled={submitting || saving}
                    className="w-full md:flex-1 md:w-auto flex items-center justify-center gap-2 px-4 py-3
                      rounded-xl border-2 border-red-100 hover:border-red-200 text-red-400
                      hover:text-red-600 font-bold text-sm transition-all disabled:opacity-40
                      bg-white hover:bg-red-50 whitespace-nowrap shrink-0"
                  >
                    <FiArrowLeft className="w-4 h-4" /> Reset
                  </button>
                  
                </div>
                <p className="text-center text-xs text-slate-400 mt-3 sm:mt-4">
                  Fields marked with <span className="text-red-500 font-bold">*</span> are required.
                  Vendor name, type, and phone are mandatory.
                </p>
              </div>
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
              <div className="lg:sticky lg:top-20">
                <VendorSummary
                  watch={watch}
                  selectedServices={selectedServices}
                />
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}