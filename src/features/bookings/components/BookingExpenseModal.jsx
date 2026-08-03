// import { useMemo, useState } from "react";
// import {
//   X,
//   WalletCards,
//   Plus,
//   Trash2,
//   IndianRupee,
//   CalendarDays,
//   Building2,
//   CreditCard,
//   ReceiptText,
//   Save,
//   LoaderCircle,
//   MapPin,
//   UserRound,
// } from "lucide-react";

// const EXPENSE_CATEGORIES = [
//   "Hotel",
//   "Flight",
//   "Transport",
//   "Sightseeing",
//   "Visa",
//   "Meals",
//   "Guide",
//   "Commission",
//   "Refund",
//   "Office Expense",
//   "Other",
// ];

// const PAYMENT_MODES = [
//   "Cash",
//   "UPI",
//   "Bank Transfer",
//   "Credit Card",
//   "Debit Card",
//   "Cheque",
//   "Wallet",
//   "Other",
// ];

// const today = () => new Date().toISOString().split("T")[0];

// const createEmptyExpense = () => ({
//   category: "",
//   description: "",
//   vendorName: "",
//   amount: "",
//   paymentMode: "",
//   expenseDate: today(),
//   referenceNumber: "",
//   notes: "",
// });

// const inputClass = `
//   w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5
//   text-sm font-medium text-slate-700 outline-none transition-all
//   placeholder:text-slate-400
//   hover:border-slate-300
//   focus:border-blue-500 focus:ring-4 focus:ring-blue-100
//   disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70
// `;

// const labelClass =
//   "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500";

// export default function BookingExpenseModal({
//   booking,
//   saving = false,
//   onClose,
//   onSave,
// }) {
//   const [expenses, setExpenses] = useState([createEmptyExpense()]);
//   const [errors, setErrors] = useState({});

//   const totalExpense = useMemo(
//     () =>
//       expenses.reduce(
//         (total, expense) => total + (Number(expense.amount) || 0),
//         0
//       ),
//     [expenses]
//   );

//   const updateExpense = (index, field, value) => {
//     setExpenses((previous) =>
//       previous.map((expense, currentIndex) =>
//         currentIndex === index
//           ? {
//               ...expense,
//               [field]: value,
//             }
//           : expense
//       )
//     );

//     setErrors((previous) => {
//       const updated = { ...previous };
//       delete updated[`${index}-${field}`];
//       return updated;
//     });
//   };

//   const addExpense = () => {
//     setExpenses((previous) => [...previous, createEmptyExpense()]);
//   };

//   const removeExpense = (index) => {
//     if (expenses.length === 1) {
//       setExpenses([createEmptyExpense()]);
//       setErrors({});
//       return;
//     }

//     setExpenses((previous) =>
//       previous.filter((_, currentIndex) => currentIndex !== index)
//     );

//     setErrors({});
//   };

//   const validateExpenses = () => {
//     const validationErrors = {};

//     expenses.forEach((expense, index) => {
//       if (!expense.category) {
//         validationErrors[`${index}-category`] = "Category is required.";
//       }

//       if (!expense.description.trim()) {
//         validationErrors[`${index}-description`] =
//           "Expense details are required.";
//       }

//       if (!expense.amount || Number(expense.amount) <= 0) {
//         validationErrors[`${index}-amount`] = "Enter a valid amount.";
//       }

//       if (!expense.expenseDate) {
//         validationErrors[`${index}-expenseDate`] = "Date is required.";
//       }
//     });

//     setErrors(validationErrors);
//     return Object.keys(validationErrors).length === 0;
//   };

//   const handleSave = async () => {
//     if (!validateExpenses()) return;

//     const payload = expenses.map((expense) => ({
//       category: expense.category,
//       description: expense.description.trim(),
//       vendorName: expense.vendorName.trim() || null,
//       amount: Number(expense.amount),
//       paymentMode: expense.paymentMode || null,
//       expenseDate: expense.expenseDate,
//       referenceNumber: expense.referenceNumber.trim() || null,
//       notes: expense.notes.trim() || null,
//     }));

//     await onSave?.(payload);
//   };

//   const handleBackdropClick = (event) => {
//     if (event.target === event.currentTarget && !saving) {
//       onClose?.();
//     }
//   };

//   if (!booking) return null;

//   return (
//     <div
//       className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
//       onMouseDown={handleBackdropClick}
//     >
//       <div
//         className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
//         style={{ animation: "expenseModalOpen 220ms ease-out both" }}
//         onMouseDown={(event) => event.stopPropagation()}
//       >
//         <style>{`
//           @keyframes expenseModalOpen {
//             from {
//               opacity: 0;
//               transform: translateY(14px) scale(.97);
//             }
//             to {
//               opacity: 1;
//               transform: translateY(0) scale(1);
//             }
//           }
//         `}</style>

//         {/* Header */}
//         <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-5 py-5 text-white sm:px-7">
//           <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10" />
//           <div className="absolute bottom-[-80px] left-[35%] h-40 w-40 rounded-full bg-indigo-300/10" />

//           <div className="relative flex items-start justify-between gap-4">
//             <div className="flex min-w-0 items-start gap-3.5">
//               <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
//                 <WalletCards className="h-6 w-6" />
//               </div>

//               <div className="min-w-0">
//                 <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-100">
//                   Booking Accounts
//                 </p>

//                 <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
//                   Add Booking Expenses
//                 </h2>

//                 <p className="mt-1 text-xs font-medium text-blue-100 sm:text-sm">
//                   Add all costs associated with this booking.
//                 </p>
//               </div>
//             </div>

//             <button
//               type="button"
//               onClick={onClose}
//               disabled={saving}
//               aria-label="Close expense popup"
//               className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:rotate-90 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
//             >
//               <X className="h-5 w-5" />
//             </button>
//           </div>
//         </div>

//         {/* Booking summary */}
//         <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
//           <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
//             <SummaryItem
//               icon={<ReceiptText className="h-4 w-4" />}
//               label="Booking"
//               value={booking.code || "—"}
//               accent="blue"
//             />

//             <SummaryItem
//               icon={<UserRound className="h-4 w-4" />}
//               label="Customer"
//               value={booking.customer || "—"}
//             />

//             <SummaryItem
//               icon={<MapPin className="h-4 w-4" />}
//               label="Destination"
//               value={booking.destination || "—"}
//             />
//           </div>
//         </div>

//         {/* Scrollable content */}
//         <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-4 py-5 sm:px-7">
//           {expenses.map((expense, index) => (
//             <div
//               key={index}
//               className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
//             >
//               {/* Expense card header */}
//               <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
//                 <div className="flex items-center gap-3">
//                   <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-sm font-extrabold text-purple-700">
//                     {index + 1}
//                   </div>

//                   <div>
//                     <p className="text-sm font-extrabold text-slate-800">
//                       Expense {index + 1}
//                     </p>

//                     <p className="text-[11px] font-medium text-slate-400">
//                       Enter expense and payment details
//                     </p>
//                   </div>
//                 </div>

//                 <button
//                   type="button"
//                   onClick={() => removeExpense(index)}
//                   disabled={saving}
//                   title="Remove expense"
//                   className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition-all hover:border-red-200 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
//                 >
//                   <Trash2 className="h-4 w-4" />
//                 </button>
//               </div>

//               {/* Expense fields */}
//               <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
//                 <Field
//                   label="Expense Category"
//                   error={errors[`${index}-category`]}
//                 >
//                   <select
//                     value={expense.category}
//                     onChange={(event) =>
//                       updateExpense(index, "category", event.target.value)
//                     }
//                     disabled={saving}
//                     className={inputClass}
//                   >
//                     <option value="">Select category</option>

//                     {EXPENSE_CATEGORIES.map((category) => (
//                       <option key={category} value={category}>
//                         {category}
//                       </option>
//                     ))}
//                   </select>
//                 </Field>

//                 <Field
//                   label="Expense Date"
//                   error={errors[`${index}-expenseDate`]}
//                 >
//                   <div className="relative">
//                     <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

//                     <input
//                       type="date"
//                       value={expense.expenseDate}
//                       onChange={(event) =>
//                         updateExpense(
//                           index,
//                           "expenseDate",
//                           event.target.value
//                         )
//                       }
//                       disabled={saving}
//                       className={`${inputClass} pl-10`}
//                     />
//                   </div>
//                 </Field>

//                 <Field
//                   label="Amount"
//                   error={errors[`${index}-amount`]}
//                 >
//                   <div className="relative">
//                     <IndianRupee className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

//                     <input
//                       type="number"
//                       min="0"
//                       step="0.01"
//                       value={expense.amount}
//                       onChange={(event) =>
//                         updateExpense(index, "amount", event.target.value)
//                       }
//                       placeholder="0.00"
//                       disabled={saving}
//                       className={`${inputClass} pl-10 font-extrabold text-slate-800`}
//                     />
//                   </div>
//                 </Field>

//                 <Field label="Payment Mode">
//                   <div className="relative">
//                     <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

//                     <select
//                       value={expense.paymentMode}
//                       onChange={(event) =>
//                         updateExpense(
//                           index,
//                           "paymentMode",
//                           event.target.value
//                         )
//                       }
//                       disabled={saving}
//                       className={`${inputClass} pl-10`}
//                     >
//                       <option value="">Select payment mode</option>

//                       {PAYMENT_MODES.map((mode) => (
//                         <option key={mode} value={mode}>
//                           {mode}
//                         </option>
//                       ))}
//                     </select>
//                   </div>
//                 </Field>

//                 <div className="sm:col-span-2">
//                   <Field
//                     label="Expense Details"
//                     error={errors[`${index}-description`]}
//                   >
//                     <input
//                       type="text"
//                       value={expense.description}
//                       onChange={(event) =>
//                         updateExpense(
//                           index,
//                           "description",
//                           event.target.value
//                         )
//                       }
//                       placeholder="Example: Hotel payment for 3 nights"
//                       disabled={saving}
//                       className={inputClass}
//                     />
//                   </Field>
//                 </div>

//                 <Field label="Vendor / Payee">
//                   <div className="relative">
//                     <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

//                     <input
//                       type="text"
//                       value={expense.vendorName}
//                       onChange={(event) =>
//                         updateExpense(
//                           index,
//                           "vendorName",
//                           event.target.value
//                         )
//                       }
//                       placeholder="Vendor name"
//                       disabled={saving}
//                       className={`${inputClass} pl-10`}
//                     />
//                   </div>
//                 </Field>

//                 <Field label="Reference Number">
//                   <input
//                     type="text"
//                     value={expense.referenceNumber}
//                     onChange={(event) =>
//                       updateExpense(
//                         index,
//                         "referenceNumber",
//                         event.target.value
//                       )
//                     }
//                     placeholder="UTR, bill or receipt no."
//                     disabled={saving}
//                     className={inputClass}
//                   />
//                 </Field>

//                 <div className="sm:col-span-2 lg:col-span-4">
//                   <Field label="Internal Notes">
//                     <textarea
//                       rows={2}
//                       value={expense.notes}
//                       onChange={(event) =>
//                         updateExpense(index, "notes", event.target.value)
//                       }
//                       placeholder="Optional notes for your accounts team..."
//                       disabled={saving}
//                       className={`${inputClass} resize-none`}
//                     />
//                   </Field>
//                 </div>
//               </div>
//             </div>
//           ))}

//           {/* Add another */}
//           <button
//             type="button"
//             onClick={addExpense}
//             disabled={saving}
//             className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-4 text-sm font-extrabold text-blue-700 transition-all hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
//           >
//             <Plus className="h-4 w-4" />
//             Add Another Expense
//           </button>
//         </div>

//         {/* Sticky footer */}
//         <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_25px_rgba(15,23,42,0.05)] sm:px-7">
//           <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
//             <div className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 sm:min-w-[280px]">
//               <div>
//                 <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500">
//                   Total Booking Expense
//                 </p>

//                 <p className="mt-0.5 text-xl font-black text-purple-800">
//                   ₹
//                   {totalExpense.toLocaleString("en-IN", {
//                     minimumFractionDigits: 2,
//                     maximumFractionDigits: 2,
//                   })}
//                 </p>
//               </div>

//               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-200">
//                 <WalletCards className="h-5 w-5" />
//               </div>
//             </div>

//             <div className="flex gap-3">
//               <button
//                 type="button"
//                 onClick={onClose}
//                 disabled={saving}
//                 className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
//               >
//                 Cancel
//               </button>

//               <button
//                 type="button"
//                 onClick={handleSave}
//                 disabled={saving || totalExpense <= 0}
//                 className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:flex-none"
//               >
//                 {saving ? (
//                   <>
//                     <LoaderCircle className="h-4 w-4 animate-spin" />
//                     Saving...
//                   </>
//                 ) : (
//                   <>
//                     <Save className="h-4 w-4" />
//                     Save {expenses.length} Expense
//                     {expenses.length > 1 ? "s" : ""}
//                   </>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function Field({ label, error, children }) {
//   return (
//     <div>
//       <label className={labelClass}>{label}</label>
//       {children}

//       {error && (
//         <p className="mt-1 text-[11px] font-bold text-red-500">{error}</p>
//       )}
//     </div>
//   );
// }

// function SummaryItem({ icon, label, value, accent }) {
//   return (
//     <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
//       <div
//         className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
//           accent === "blue"
//             ? "bg-blue-100 text-blue-600"
//             : "bg-slate-100 text-slate-500"
//         }`}
//       >
//         {icon}
//       </div>

//       <div className="min-w-0">
//         <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
//           {label}
//         </p>

//         <p className="truncate text-sm font-extrabold text-slate-700">
//           {value}
//         </p>
//       </div>
//     </div>
//   );
// }

// import { useMemo, useState } from "react";
// import {
//   X,
//   WalletCards,
//   Plus,
//   Trash2,
//   IndianRupee,
//   CalendarDays,
//   Building2,
//   CreditCard,
//   ReceiptText,
//   Save,
//   LoaderCircle,
//   MapPin,
//   UserRound,
//   CircleDollarSign,
//   Clock3,
//   BadgeIndianRupee,
// } from "lucide-react";

// const EXPENSE_CATEGORIES = [
//   "Hotel",
//   "Flight",
//   "Transport",
//   "Sightseeing",
//   "Visa",
//   "Meals",
//   "Guide",
//   "Commission",
//   "Refund",
//   "Office Expense",
//   "Other",
// ];

// const PAYMENT_STATUSES = [
//   { value: "CREDIT", label: "Credit / Udhar" },
//   { value: "PARTIAL", label: "Partially Paid" },
//   { value: "PAID", label: "Fully Paid" },
// ];

// const PAYMENT_MODES = [
//   "Cash",
//   "UPI",
//   "Bank Transfer",
//   "Credit Card",
//   "Debit Card",
//   "Cheque",
//   "Wallet",
//   "Other",
// ];

// const today = () => new Date().toISOString().split("T")[0];

// const getDefaultExpenseCategory = (booking) => {
//   const rawServices = [
//     ...(Array.isArray(booking?.services) ? booking.services : []),
//     booking?.serviceType,
//     booking?.bookingType,
//     booking?.category,
//   ].filter(Boolean);

//   const services = rawServices.map((service) =>
//     typeof service === "string"
//       ? service.toLowerCase()
//       : String(
//           service?.name ??
//             service?.serviceName ??
//             service?.type ??
//             service?.category ??
//             ""
//         ).toLowerCase()
//   );

//   if (services.some((service) => service.includes("hotel"))) return "Hotel";
//   if (services.some((service) => service.includes("flight") || service.includes("air") || service.includes("ticket"))) return "Flight";
//   if (services.some((service) => service.includes("vehicle") || service.includes("car") || service.includes("cab") || service.includes("transport") || service.includes("transfer"))) return "Transport";
//   if (services.some((service) => service.includes("sightseeing") || service.includes("activity") || service.includes("tour"))) return "Sightseeing";
//   if (services.some((service) => service.includes("visa"))) return "Visa";
//   if (services.some((service) => service.includes("meal") || service.includes("food") || service.includes("restaurant"))) return "Meals";
//   if (services.some((service) => service.includes("guide"))) return "Guide";

//   return "Other";
// };

// const createEmptyExpense = (booking) => ({
//   category: getDefaultExpenseCategory(booking),
//   description: "",
//   vendorName: "",
//   amount: "",
//   paymentStatus: "CREDIT",
//   paymentMode: "",
//   expenseDate: today(),
//   dueDate: "",
//   paidAmount: "",
//   referenceNumber: "",
//   notes: "",
// });

// const inputClass = `
//   w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5
//   text-sm font-medium text-slate-700 outline-none transition-all
//   placeholder:text-slate-400 hover:border-slate-300
//   focus:border-blue-500 focus:ring-4 focus:ring-blue-100
//   disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70
// `;

// const labelClass =
//   "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500";

// const formatINR = (value) =>
//   `₹${Number(value || 0).toLocaleString("en-IN", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;

// export default function BookingExpenseModal({
//   booking,
//   saving = false,
//   onClose,
//   onSave,
// }) {
//   const [expenses, setExpenses] = useState(() => [
//     createEmptyExpense(booking),
//   ]);
//   const [errors, setErrors] = useState({});

//   const totals = useMemo(() => {
//     return expenses.reduce(
//       (summary, expense) => {
//         const amount = Math.max(0, Number(expense.amount) || 0);
//         let paidAmount = Math.max(0, Number(expense.paidAmount) || 0);

//         if (expense.paymentStatus === "PAID") paidAmount = amount;
//         if (expense.paymentStatus === "CREDIT") paidAmount = 0;

//         paidAmount = Math.min(paidAmount, amount);
//         summary.totalExpense += amount;
//         summary.totalPaid += paidAmount;
//         summary.totalOutstanding += Math.max(0, amount - paidAmount);
//         return summary;
//       },
//       { totalExpense: 0, totalPaid: 0, totalOutstanding: 0 }
//     );
//   }, [expenses]);

//   const updateExpense = (index, field, value) => {
//     setExpenses((previous) =>
//       previous.map((expense, currentIndex) => {
//         if (currentIndex !== index) return expense;

//         const updated = { ...expense, [field]: value };

//         if (field === "paymentStatus") {
//           if (value === "CREDIT") {
//             updated.paymentMode = "";
//             updated.paidAmount = "";
//             updated.referenceNumber = "";
//           }

//           if (value === "PAID") {
//             updated.paidAmount = updated.amount || "";
//             updated.dueDate = "";
//           }
//         }

//         if (field === "amount" && updated.paymentStatus === "PAID") {
//           updated.paidAmount = value;
//         }

//         return updated;
//       })
//     );

//     setErrors((previous) => {
//       const updatedErrors = { ...previous };
//       [
//         `${index}-${field}`,
//         `${index}-paymentMode`,
//         `${index}-paidAmount`,
//         `${index}-dueDate`,
//       ].forEach((key) => delete updatedErrors[key]);
//       return updatedErrors;
//     });
//   };

//   const addExpense = () => {
//     setExpenses((previous) => [
//       ...previous,
//       createEmptyExpense(booking),
//     ]);
//   };

//   const removeExpense = (index) => {
//     if (expenses.length === 1) {
//       setExpenses([createEmptyExpense(booking)]);
//       setErrors({});
//       return;
//     }

//     setExpenses((previous) =>
//       previous.filter((_, currentIndex) => currentIndex !== index)
//     );
//     setErrors({});
//   };

//   const validateExpenses = () => {
//     const validationErrors = {};

//     expenses.forEach((expense, index) => {
//       const amount = Number(expense.amount) || 0;
//       const paidAmount = Number(expense.paidAmount) || 0;

//       if (!expense.category) {
//         validationErrors[`${index}-category`] = "Category is required.";
//       }

//       if (!expense.description.trim()) {
//         validationErrors[`${index}-description`] =
//           "Expense details are required.";
//       }

//       if (amount <= 0) {
//         validationErrors[`${index}-amount`] = "Enter a valid amount.";
//       }

//       if (!expense.expenseDate) {
//         validationErrors[`${index}-expenseDate`] =
//           "Expense date is required.";
//       }

//       if (!expense.paymentStatus) {
//         validationErrors[`${index}-paymentStatus`] =
//           "Payment status is required.";
//       }

//       if (
//         expense.paymentStatus !== "CREDIT" &&
//         !expense.paymentMode
//       ) {
//         validationErrors[`${index}-paymentMode`] =
//           "Payment mode is required.";
//       }

//       if (expense.paymentStatus === "PARTIAL") {
//         if (paidAmount <= 0) {
//           validationErrors[`${index}-paidAmount`] =
//             "Enter the paid amount.";
//         } else if (paidAmount >= amount) {
//           validationErrors[`${index}-paidAmount`] =
//             "Partial amount must be less than total.";
//         }
//       }

//       if (
//         expense.dueDate &&
//         expense.expenseDate &&
//         expense.dueDate < expense.expenseDate
//       ) {
//         validationErrors[`${index}-dueDate`] =
//           "Due date cannot be before expense date.";
//       }
//     });

//     setErrors(validationErrors);
//     return Object.keys(validationErrors).length === 0;
//   };

//   const handleSave = async () => {
//     if (!validateExpenses()) return;

//     const payload = expenses.map((expense) => {
//       const amount = Number(expense.amount);
//       const isCredit = expense.paymentStatus === "CREDIT";
//       const isPaid = expense.paymentStatus === "PAID";
//       const paidAmount = isCredit
//         ? 0
//         : isPaid
//           ? amount
//           : Number(expense.paidAmount) || 0;

//       return {
//         category: expense.category,
//         description: expense.description.trim(),
//         vendorName: expense.vendorName.trim() || null,
//         amount,
//         paymentStatus: expense.paymentStatus,
//         paymentMode: isCredit ? null : expense.paymentMode || null,
//         expenseDate: expense.expenseDate,
//         dueDate:
//           expense.paymentStatus === "PAID"
//             ? null
//             : expense.dueDate || null,
//         paidAmount,
//         outstandingAmount: Math.max(0, amount - paidAmount),
//         referenceNumber: isCredit
//           ? null
//           : expense.referenceNumber.trim() || null,
//         notes: expense.notes.trim() || null,
//       };
//     });

//     await onSave?.(payload);
//   };

//   const handleBackdropClick = (event) => {
//     if (event.target === event.currentTarget && !saving) {
//       onClose?.();
//     }
//   };

//   if (!booking) return null;

//   return (
//     <div
//       className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
//       onMouseDown={handleBackdropClick}
//     >
//       <div
//         className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
//         style={{ animation: "expenseModalOpen 220ms ease-out both" }}
//         onMouseDown={(event) => event.stopPropagation()}
//       >
//         <style>{`
//           @keyframes expenseModalOpen {
//             from { opacity: 0; transform: translateY(14px) scale(.97); }
//             to { opacity: 1; transform: translateY(0) scale(1); }
//           }
//         `}</style>

//         <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-5 py-5 text-white sm:px-7">
//           <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10" />
//           <div className="absolute bottom-[-80px] left-[35%] h-40 w-40 rounded-full bg-indigo-300/10" />

//           <div className="relative flex items-start justify-between gap-4">
//             <div className="flex min-w-0 items-start gap-3.5">
//               <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
//                 <WalletCards className="h-6 w-6" />
//               </div>

//               <div className="min-w-0">
//                 <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-100">
//                   Booking Accounts
//                 </p>
//                 <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
//                   Add Booking Expenses
//                 </h2>
//                 <p className="mt-1 text-xs font-medium text-blue-100 sm:text-sm">
//                   Record vendor costs, credit dues and payments for this booking.
//                 </p>
//               </div>
//             </div>

//             <button
//               type="button"
//               onClick={onClose}
//               disabled={saving}
//               aria-label="Close expense popup"
//               className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:rotate-90 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
//             >
//               <X className="h-5 w-5" />
//             </button>
//           </div>
//         </div>

//         <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
//           <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
//             <SummaryItem
//               icon={<ReceiptText className="h-4 w-4" />}
//               label="Booking"
//               value={booking.code || booking.bookingCode || "—"}
//               accent="blue"
//             />
//             <SummaryItem
//               icon={<UserRound className="h-4 w-4" />}
//               label="Customer"
//               value={
//                 booking.customer ||
//                 booking.customerNameSnapshot ||
//                 "—"
//               }
//             />
//             <SummaryItem
//               icon={<MapPin className="h-4 w-4" />}
//               label="Destination"
//               value={
//                 booking.destination ||
//                 booking.destinationSnapshot ||
//                 "—"
//               }
//             />
//             <SummaryItem
//               icon={<CalendarDays className="h-4 w-4" />}
//               label="Travel Date"
//               value={
//                 booking.travelDate
//                   ? new Date(booking.travelDate).toLocaleDateString("en-IN", {
//                       day: "2-digit",
//                       month: "short",
//                       year: "numeric",
//                     })
//                   : "—"
//               }
//             />
//           </div>
//         </div>

//         <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-4 py-5 sm:px-7">
//           {expenses.map((expense, index) => {
//             const amount = Number(expense.amount) || 0;
//             const paidAmount =
//               expense.paymentStatus === "PAID"
//                 ? amount
//                 : expense.paymentStatus === "CREDIT"
//                   ? 0
//                   : Number(expense.paidAmount) || 0;
//             const outstandingAmount = Math.max(0, amount - paidAmount);

//             return (
//               <div
//                 key={index}
//                 className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
//               >
//                 <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
//                   <div className="flex items-center gap-3">
//                     <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-sm font-extrabold text-purple-700">
//                       {String(index + 1).padStart(2, "0")}
//                     </div>
//                     <div>
//                       <div className="flex flex-wrap items-center gap-2">
//                         <p className="text-sm font-extrabold text-slate-800">
//                           Expense {index + 1}
//                         </p>
//                         {expense.paymentStatus === "CREDIT" && (
//                           <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
//                             Credit / Udhar
//                           </span>
//                         )}
//                       </div>
//                       <p className="text-[11px] font-medium text-slate-400">
//                         Vendor expense and settlement details
//                       </p>
//                     </div>
//                   </div>

//                   <button
//                     type="button"
//                     onClick={() => removeExpense(index)}
//                     disabled={saving}
//                     title="Remove expense"
//                     className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition-all hover:border-red-200 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
//                   >
//                     <Trash2 className="h-4 w-4" />
//                   </button>
//                 </div>

//                 <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
//                   <Field
//                     label="Expense Category"
//                     required
//                     error={errors[`${index}-category`]}
//                   >
//                     <select
//                       value={expense.category}
//                       onChange={(event) =>
//                         updateExpense(index, "category", event.target.value)
//                       }
//                       disabled={saving}
//                       className={inputClass}
//                     >
//                       {EXPENSE_CATEGORIES.map((category) => (
//                         <option key={category} value={category}>
//                           {category}
//                         </option>
//                       ))}
//                     </select>
//                     <p className="mt-1 text-[10px] font-semibold text-blue-600">
//                       Auto-selected from booking services
//                     </p>
//                   </Field>

//                   <Field
//                     label="Expense Date"
//                     required
//                     error={errors[`${index}-expenseDate`]}
//                   >
//                     <div className="relative">
//                       <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                       <input
//                         type="date"
//                         value={expense.expenseDate}
//                         onChange={(event) =>
//                           updateExpense(index, "expenseDate", event.target.value)
//                         }
//                         disabled={saving}
//                         className={`${inputClass} pl-10`}
//                       />
//                     </div>
//                   </Field>

//                   <Field
//                     label="Expense Amount"
//                     required
//                     error={errors[`${index}-amount`]}
//                   >
//                     <div className="relative">
//                       <IndianRupee className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                       <input
//                         type="number"
//                         min="0"
//                         step="0.01"
//                         value={expense.amount}
//                         onChange={(event) =>
//                           updateExpense(index, "amount", event.target.value)
//                         }
//                         placeholder="0.00"
//                         disabled={saving}
//                         className={`${inputClass} pl-10 font-extrabold text-slate-800`}
//                       />
//                     </div>
//                   </Field>

//                   <Field
//                     label="Vendor Payment"
//                     required
//                     error={errors[`${index}-paymentStatus`]}
//                   >
//                     <div className="relative">
//                       <Clock3 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                       <select
//                         value={expense.paymentStatus}
//                         onChange={(event) =>
//                           updateExpense(index, "paymentStatus", event.target.value)
//                         }
//                         disabled={saving}
//                         className={`${inputClass} pl-10`}
//                       >
//                         {PAYMENT_STATUSES.map((status) => (
//                           <option key={status.value} value={status.value}>
//                             {status.label}
//                           </option>
//                         ))}
//                       </select>
//                     </div>
//                     {expense.paymentStatus === "CREDIT" && (
//                       <p className="mt-1 text-[10px] font-semibold text-amber-600">
//                         Default: full amount remains payable to vendor
//                       </p>
//                     )}
//                   </Field>

//                   <div className="sm:col-span-2">
//                     <Field
//                       label="Expense Details"
//                       required
//                       error={errors[`${index}-description`]}
//                     >
//                       <input
//                         type="text"
//                         value={expense.description}
//                         onChange={(event) =>
//                           updateExpense(index, "description", event.target.value)
//                         }
//                         placeholder="Example: Hotel payment for 3 nights"
//                         disabled={saving}
//                         className={inputClass}
//                       />
//                     </Field>
//                   </div>

//                   <Field label="Vendor / Payee">
//                     <div className="relative">
//                       <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                       <input
//                         type="text"
//                         value={expense.vendorName}
//                         onChange={(event) =>
//                           updateExpense(index, "vendorName", event.target.value)
//                         }
//                         placeholder="Vendor name"
//                         disabled={saving}
//                         className={`${inputClass} pl-10`}
//                       />
//                     </div>
//                   </Field>

//                   <Field
//                     label="Payment Due Date"
//                     error={errors[`${index}-dueDate`]}
//                   >
//                     <div className="relative">
//                       <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                       <input
//                         type="date"
//                         value={expense.dueDate}
//                         onChange={(event) =>
//                           updateExpense(index, "dueDate", event.target.value)
//                         }
//                         min={expense.expenseDate}
//                         disabled={saving || expense.paymentStatus === "PAID"}
//                         className={`${inputClass} pl-10`}
//                       />
//                     </div>
//                   </Field>

//                   {expense.paymentStatus !== "CREDIT" && (
//                     <>
//                       <Field
//                         label="Payment Mode"
//                         required
//                         error={errors[`${index}-paymentMode`]}
//                       >
//                         <div className="relative">
//                           <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                           <select
//                             value={expense.paymentMode}
//                             onChange={(event) =>
//                               updateExpense(index, "paymentMode", event.target.value)
//                             }
//                             disabled={saving}
//                             className={`${inputClass} pl-10`}
//                           >
//                             <option value="">Select payment mode</option>
//                             {PAYMENT_MODES.map((mode) => (
//                               <option key={mode} value={mode}>
//                                 {mode}
//                               </option>
//                             ))}
//                           </select>
//                         </div>
//                       </Field>

//                       {expense.paymentStatus === "PARTIAL" && (
//                         <Field
//                           label="Paid Amount"
//                           required
//                           error={errors[`${index}-paidAmount`]}
//                         >
//                           <div className="relative">
//                             <BadgeIndianRupee className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                             <input
//                               type="number"
//                               min="0"
//                               max={expense.amount || undefined}
//                               step="0.01"
//                               value={expense.paidAmount}
//                               onChange={(event) =>
//                                 updateExpense(index, "paidAmount", event.target.value)
//                               }
//                               placeholder="Amount paid now"
//                               disabled={saving}
//                               className={`${inputClass} pl-10`}
//                             />
//                           </div>
//                         </Field>
//                       )}

//                       <Field label="Reference Number">
//                         <input
//                           type="text"
//                           value={expense.referenceNumber}
//                           onChange={(event) =>
//                             updateExpense(index, "referenceNumber", event.target.value)
//                           }
//                           placeholder="UTR, cheque or receipt no."
//                           disabled={saving}
//                           className={inputClass}
//                         />
//                       </Field>
//                     </>
//                   )}

//                   <div className="sm:col-span-2 xl:col-span-4">
//                     <Field label="Internal Notes">
//                       <textarea
//                         rows={2}
//                         value={expense.notes}
//                         onChange={(event) =>
//                           updateExpense(index, "notes", event.target.value)
//                         }
//                         placeholder="Optional notes for accounts team..."
//                         disabled={saving}
//                         className={`${inputClass} resize-none`}
//                       />
//                     </Field>
//                   </div>

//                   <div className="sm:col-span-2 xl:col-span-4">
//                     <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-3">
//                       <AmountSummary
//                         label="Expense"
//                         value={amount}
//                         className="text-slate-800"
//                       />
//                       <AmountSummary
//                         label="Paid"
//                         value={paidAmount}
//                         className="text-emerald-700"
//                       />
//                       <AmountSummary
//                         label="Outstanding"
//                         value={outstandingAmount}
//                         className={
//                           outstandingAmount > 0
//                             ? "text-amber-700"
//                             : "text-emerald-700"
//                         }
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}

//           <button
//             type="button"
//             onClick={addExpense}
//             disabled={saving}
//             className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-4 text-sm font-extrabold text-blue-700 transition-all hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
//           >
//             <Plus className="h-4 w-4" />
//             Add Another Expense
//           </button>
//         </div>

//         <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_25px_rgba(15,23,42,0.05)] sm:px-7">
//           <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
//             <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[620px]">
//               <FooterTotal
//                 icon={<WalletCards className="h-5 w-5" />}
//                 label="Total Expense"
//                 value={totals.totalExpense}
//                 tone="purple"
//               />
//               <FooterTotal
//                 icon={<CircleDollarSign className="h-5 w-5" />}
//                 label="Total Paid"
//                 value={totals.totalPaid}
//                 tone="green"
//               />
//               <FooterTotal
//                 icon={<Clock3 className="h-5 w-5" />}
//                 label="Vendor Outstanding"
//                 value={totals.totalOutstanding}
//                 tone="amber"
//               />
//             </div>

//             <div className="flex gap-3">
//               <button
//                 type="button"
//                 onClick={onClose}
//                 disabled={saving}
//                 className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 xl:flex-none"
//               >
//                 Cancel
//               </button>

//               <button
//                 type="button"
//                 onClick={handleSave}
//                 disabled={saving || totals.totalExpense <= 0}
//                 className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 xl:flex-none"
//               >
//                 {saving ? (
//                   <>
//                     <LoaderCircle className="h-4 w-4 animate-spin" />
//                     Saving...
//                   </>
//                 ) : (
//                   <>
//                     <Save className="h-4 w-4" />
//                     Save {expenses.length} Expense
//                     {expenses.length > 1 ? "s" : ""}
//                   </>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function Field({ label, error, required = false, children }) {
//   return (
//     <div>
//       <label className={labelClass}>
//         {label}
//         {required && <span className="ml-1 text-red-500">*</span>}
//       </label>
//       {children}
//       {error && (
//         <p className="mt-1 text-[11px] font-bold text-red-500">
//           {error}
//         </p>
//       )}
//     </div>
//   );
// }

// function SummaryItem({ icon, label, value, accent }) {
//   return (
//     <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
//       <div
//         className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
//           accent === "blue"
//             ? "bg-blue-100 text-blue-600"
//             : "bg-slate-100 text-slate-500"
//         }`}
//       >
//         {icon}
//       </div>
//       <div className="min-w-0">
//         <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
//           {label}
//         </p>
//         <p className="truncate text-sm font-extrabold text-slate-700">
//           {value}
//         </p>
//       </div>
//     </div>
//   );
// }

// function AmountSummary({ label, value, className }) {
//   return (
//     <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
//       <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
//         {label}
//       </span>
//       <span className={`text-sm font-extrabold ${className}`}>
//         {formatINR(value)}
//       </span>
//     </div>
//   );
// }

// function FooterTotal({ icon, label, value, tone }) {
//   const tones = {
//     purple: "border-purple-100 bg-purple-50 text-purple-800",
//     green: "border-emerald-100 bg-emerald-50 text-emerald-800",
//     amber: "border-amber-100 bg-amber-50 text-amber-800",
//   };

//   const iconTones = {
//     purple: "bg-purple-600 text-white",
//     green: "bg-emerald-600 text-white",
//     amber: "bg-amber-500 text-white",
//   };

//   return (
//     <div
//       className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
//         tones[tone] || tones.purple
//       }`}
//     >
//       <div>
//         <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">
//           {label}
//         </p>
//         <p className="mt-0.5 text-lg font-black">
//           {formatINR(value)}
//         </p>
//       </div>
//       <div
//         className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${
//           iconTones[tone] || iconTones.purple
//         }`}
//       >
//         {icon}
//       </div>
//     </div>
//   );
// }


/**
 * Expense Ledger — design tokens (change here to retheme)
 *   ink     #1B2A41   primary text, header, primary action
 *   rust    #9C4221   credit / amount due
 *   ochre   #8A6D1B   partially paid
 *   forest  #2E6A4E   fully paid / settled
 *   muted   #6B6558   secondary text, labels
 *   faint   #B8B2A2   decorative-only (index numbers, chevrons)
 *   paper   #F4F2EC   panel fill (detail drawer)
 *   line    #E4E0D2   hairline rules
 *
 * Fonts are pulled via @import below for a self-contained preview.
 * In production, move the Google Fonts import to your global stylesheet
 * instead of loading it per-mount.
 */
import { useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  IndianRupee,
  Save,
  LoaderCircle,
  ChevronDown,
  Landmark,
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Hotel",
  "Flight",
  "Transport",
  "Sightseeing",
  "Visa",
  "Meals",
  "Guide",
  "Commission",
  "Refund",
  "Office Expense",
  "Other",
];

const PAYMENT_STATUSES = [
  { value: "CREDIT", label: "Credit" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
];

// VENDOR = supplier cost (cash book only, already covered by the booking's typed vendorCost).
// INTERNAL = the agency's own cost — the only kind the backend sums into totalInternalCosts,
// so only INTERNAL rows reduce the booking's netProfit.
const COST_TYPES = [
  { value: "VENDOR", label: "Vendor" },
  { value: "INTERNAL", label: "Company" },
];

// Categories that are agency overhead by nature — preselect Company for them. "Refund" stays
// Vendor by default (ambiguous); the user can flip the toggle on any row.
const INTERNAL_DEFAULT_CATEGORIES = new Set(["Commission", "Office Expense"]);
const defaultCostType = (category) =>
  INTERNAL_DEFAULT_CATEGORIES.has(category) ? "INTERNAL" : "VENDOR";

// Backend caps a batch at @Size(max = 50) — one row over rejects the whole submission.
const MAX_EXPENSE_ROWS = 50;

// Mirrors backend @Digits(integer = 10, fraction = 2) on amount/paidAmount.
const TWO_DECIMALS = /^\d{1,10}(\.\d{1,2})?$/;

const PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Credit Card",
  "Debit Card",
  "Cheque",
  "Wallet",
  "Other",
];

const today = () => new Date().toISOString().split("T")[0];

const getDefaultExpenseCategory = (booking) => {
  const rawServices = [
    ...(Array.isArray(booking?.services) ? booking.services : []),
    booking?.serviceType,
    booking?.bookingType,
    booking?.category,
  ].filter(Boolean);

  const services = rawServices.map((service) =>
    typeof service === "string"
      ? service.toLowerCase()
      : String(
          service?.name ??
            service?.serviceName ??
            service?.type ??
            service?.category ??
            ""
        ).toLowerCase()
  );

  if (services.some((s) => s.includes("hotel"))) return "Hotel";
  if (services.some((s) => s.includes("flight") || s.includes("air") || s.includes("ticket"))) return "Flight";
  if (services.some((s) => s.includes("vehicle") || s.includes("car") || s.includes("cab") || s.includes("transport") || s.includes("transfer"))) return "Transport";
  if (services.some((s) => s.includes("sightseeing") || s.includes("activity") || s.includes("tour"))) return "Sightseeing";
  if (services.some((s) => s.includes("visa"))) return "Visa";
  if (services.some((s) => s.includes("meal") || s.includes("food") || s.includes("restaurant"))) return "Meals";
  if (services.some((s) => s.includes("guide"))) return "Guide";
  return "Other";
};

const createEmptyExpense = (booking) => {
  const category = getDefaultExpenseCategory(booking);
  return {
    category,
    costType: defaultCostType(category),
    costTypeTouched: false, // once the user picks a cost type, category changes stop resetting it
    description: "",
    vendorName: "",
    amount: "",
    paymentStatus: "CREDIT",
    paymentMode: "",
    expenseDate: today(),
    dueDate: "",
    paidAmount: "",
    referenceNumber: "",
    notes: "",
  };
};

const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export default function BookingExpenseModal({
  booking,
  saving = false,
  onClose,
  onSave,
}) {
  const [expenses, setExpenses] = useState(() => [createEmptyExpense(booking)]);
  const [errors, setErrors] = useState({});
  const [openIndex, setOpenIndex] = useState(0);

  const totals = useMemo(() => {
    return expenses.reduce(
      (summary, expense) => {
        const amount = Math.max(0, Number(expense.amount) || 0);
        let paidAmount = Math.max(0, Number(expense.paidAmount) || 0);
        if (expense.paymentStatus === "PAID") paidAmount = amount;
        if (expense.paymentStatus === "CREDIT") paidAmount = 0;
        paidAmount = Math.min(paidAmount, amount);
        summary.totalExpense += amount;
        summary.totalPaid += paidAmount;
        summary.totalOutstanding += Math.max(0, amount - paidAmount);
        return summary;
      },
      { totalExpense: 0, totalPaid: 0, totalOutstanding: 0 }
    );
  }, [expenses]);

  const updateExpense = (index, field, value) => {
    setExpenses((previous) =>
      previous.map((expense, currentIndex) => {
        if (currentIndex !== index) return expense;
        const updated = { ...expense, [field]: value };

        if (field === "paymentStatus") {
          if (value === "CREDIT") {
            updated.paymentMode = "";
            updated.paidAmount = "";
            updated.referenceNumber = "";
          }
          if (value === "PAID") {
            updated.paidAmount = updated.amount || "";
            updated.dueDate = "";
          }
        }
        if (field === "amount" && updated.paymentStatus === "PAID") {
          updated.paidAmount = value;
        }
        if (field === "category" && !updated.costTypeTouched) {
          updated.costType = defaultCostType(value);
        }
        if (field === "costType") {
          updated.costTypeTouched = true;
        }
        return updated;
      })
    );

    setErrors((previous) => {
      const updatedErrors = { ...previous };
      [
        `${index}-${field}`,
        `${index}-paymentMode`,
        `${index}-paidAmount`,
        `${index}-dueDate`,
      ].forEach((key) => delete updatedErrors[key]);
      return updatedErrors;
    });
  };

  const addExpense = () => {
    if (expenses.length >= MAX_EXPENSE_ROWS) return;
    setExpenses((previous) =>
      previous.length >= MAX_EXPENSE_ROWS
        ? previous
        : [...previous, createEmptyExpense(booking)]
    );
    setOpenIndex(expenses.length);
  };

  const removeExpense = (index) => {
    if (expenses.length === 1) {
      setExpenses([createEmptyExpense(booking)]);
      setErrors({});
      return;
    }
    setExpenses((previous) => previous.filter((_, i) => i !== index));
    setErrors({});
    setOpenIndex(0);
  };

  const validateExpenses = () => {
    const validationErrors = {};

    expenses.forEach((expense, index) => {
      const amount = Number(expense.amount) || 0;
      const paidAmount = Number(expense.paidAmount) || 0;

      if (!expense.category) validationErrors[`${index}-category`] = "Required";
      if (!expense.description.trim()) validationErrors[`${index}-description`] = "Required";
      if (amount <= 0) validationErrors[`${index}-amount`] = "Enter a valid amount";
      else if (!TWO_DECIMALS.test(String(expense.amount).trim()))
        validationErrors[`${index}-amount`] = "Max 2 decimal places";
      if (!expense.expenseDate) validationErrors[`${index}-expenseDate`] = "Required";

      if (expense.paymentStatus !== "CREDIT" && !expense.paymentMode) {
        validationErrors[`${index}-paymentMode`] = "Required";
      }

      if (expense.paymentStatus === "PARTIAL") {
        if (paidAmount <= 0) validationErrors[`${index}-paidAmount`] = "Enter paid amount";
        else if (paidAmount >= amount) validationErrors[`${index}-paidAmount`] = "Must be less than total";
        else if (!TWO_DECIMALS.test(String(expense.paidAmount).trim()))
          validationErrors[`${index}-paidAmount`] = "Max 2 decimal places";
      }

      if (expense.dueDate && expense.expenseDate && expense.dueDate < expense.expenseDate) {
        validationErrors[`${index}-dueDate`] = "Before expense date";
      }
    });

    setErrors(validationErrors);
    const firstErrorIndex = expenses.findIndex((_, i) =>
      Object.keys(validationErrors).some((k) => k.startsWith(`${i}-`))
    );
    if (firstErrorIndex >= 0) setOpenIndex(firstErrorIndex);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateExpenses()) return;

    const payload = expenses.map((expense) => {
      const amount = Number(expense.amount);
      const isCredit = expense.paymentStatus === "CREDIT";
      const isPaid = expense.paymentStatus === "PAID";
      const paidAmount = isCredit ? 0 : isPaid ? amount : Number(expense.paidAmount) || 0;

      return {
        category: expense.category,
        costType: expense.costType || "VENDOR",
        description: expense.description.trim(),
        vendorName: expense.vendorName.trim() || null,
        amount,
        paymentStatus: expense.paymentStatus,
        paymentMode: isCredit ? null : expense.paymentMode || null,
        expenseDate: expense.expenseDate,
        dueDate: isPaid ? null : expense.dueDate || null,
        paidAmount,
        outstandingAmount: Math.max(0, amount - paidAmount),
        referenceNumber: isCredit ? null : expense.referenceNumber.trim() || null,
        notes: expense.notes.trim() || null,
      };
    });

    await onSave?.(payload);
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && !saving) onClose?.();
  };

  // ── Keyboard: Enter advances, Ctrl+Enter saves — the same contract the create pages
  // (CreateBookingClean / CreateLead) teach, so batch entry never needs the mouse. The row
  // headers keep their own Enter (expand/collapse): they are DIVs with role="button", which this
  // handler deliberately ignores.
  const panelRef = useRef(null);
  const FOCUSABLE =
    'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])';

  const focusNext = (from) => {
    const root = panelRef.current;
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
  };

  const onPanelKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (!saving) handleSave();
      return;
    }
    const target = event.target;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      event.preventDefault();
      focusNext(target);
    }
  };

  if (!booking) return null;

  return (
    <div
      className="eb-root eb-backdrop fixed inset-0 z-[70] flex items-center justify-center p-3"
      onMouseDown={handleBackdropClick}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        .eb-root { font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; color:#1e293b; }
        .eb-serif { font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; }
        .eb-mono { font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; font-variant-numeric:tabular-nums; }

        .eb-backdrop { background:rgba(15,23,42,.60); backdrop-filter:blur(4px); }

        .eb-panel-enter { animation:ebPanelIn 180ms ease-out both; }
        @keyframes ebPanelIn { from{opacity:0;transform:translateY(10px) scale(.98);} to{opacity:1;transform:none;} }

        .eb-header { background:linear-gradient(90deg,#2563eb,#6366f1); border-bottom:1px solid rgba(255,255,255,.16); }

        .eb-row { border-bottom:1px solid #f1f5f9; }
        .eb-row-header:hover { background:#f8fafc; }

        .eb-detail { background:#f8fafc; border-top:1px solid #f1f5f9; }
        .eb-detail-wrap { display:grid; grid-template-rows:0fr; transition:grid-template-rows 200ms ease; }
        .eb-detail-wrap.eb-open { grid-template-rows:1fr; }
        .eb-detail-inner { overflow:hidden; }

        .eb-field { width:100%; border:1px solid #e2e8f0; border-radius:12px; background:#fff; padding:10px 14px; font-size:13px; color:#334155; outline:none; transition:border-color 120ms ease, box-shadow 120ms ease; }
        .eb-field::placeholder { color:#94a3b8; }
        .eb-field:hover { border-color:#cbd5e1; }
        .eb-field:focus { border-color:#60a5fa; box-shadow:0 0 0 3px rgba(59,130,246,.10); }
        .eb-field:disabled { background:#f8fafc; color:#94a3b8; cursor:not-allowed; }

        .eb-label { font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin-bottom:4px; display:block; }

        .eb-stamp { display:inline-flex; align-items:center; padding:2px 8px; border:1px solid currentColor; border-radius:999px; font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; font-size:9.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; position:relative; white-space:nowrap; }
        .eb-stamp::after { content:''; position:absolute; inset:1.5px; border:1px solid currentColor; border-radius:999px; opacity:0; }
        .eb-stamp-CREDIT { color:#b45309; background:#fffbeb; border-color:#fde68a; }
        .eb-stamp-PARTIAL { color:#7c3aed; background:#f5f3ff; border-color:#ddd6fe; }
        .eb-stamp-PAID { color:#15803d; background:#f0fdf4; border-color:#bbf7d0; }

        .eb-toggle { border:1px solid #e2e8f0; background:#fff; color:#64748b; transition:background 120ms ease, border-color 120ms ease, color 120ms ease; }
        .eb-toggle-CREDIT.eb-active { background:#f59e0b; border-color:#f59e0b; color:#fff; }
        .eb-toggle-PARTIAL.eb-active { background:#7c3aed; border-color:#7c3aed; color:#fff; }
        .eb-toggle-PAID.eb-active { background:#16a34a; border-color:#16a34a; color:#fff; }
        .eb-toggle-VENDOR.eb-active { background:#475569; border-color:#475569; color:#fff; }
        .eb-toggle-INTERNAL.eb-active { background:#0f766e; border-color:#0f766e; color:#fff; }

        .eb-btn-primary { background:linear-gradient(90deg,#2563eb,#6366f1); color:#fff; transition:filter 120ms ease, transform 120ms ease; }
        .eb-btn-primary:hover:not(:disabled) { filter:brightness(.95); }
        .eb-btn-primary:disabled { opacity:.5; cursor:not-allowed; }

        .eb-btn-secondary { border:1px solid #e2e8f0; background:#fff; color:#475569; transition:background 120ms ease, border-color 120ms ease; }
        .eb-btn-secondary:hover:not(:disabled) { background:#f8fafc; border-color:#cbd5e1; }

        .eb-footer { border-top:1px solid #e2e8f0; }

        .eb-add-row { border-top:1px dashed #cbd5e1; color:#2563eb; transition:background 120ms ease, color 120ms ease; }
        .eb-add-row:hover:not(:disabled) { background:#eff6ff; color:#1d4ed8; }

        .eb-root button:focus-visible,
        .eb-root [role="button"]:focus-visible,
        .eb-root select:focus-visible {
          outline:2px solid #2563eb; outline-offset:2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .eb-panel-enter { animation:none; }
          .eb-detail-wrap { transition:none; }
        }
      `}</style>

      <div
        ref={panelRef}
        className="eb-panel-enter flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        {/* Header */}
        <div className="eb-header flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Landmark className="h-4 w-4 flex-shrink-0" style={{ color: "#bfdbfe" }} />
            <div className="min-w-0">
              <h2 className="eb-serif truncate text-[16px] font-semibold leading-tight text-white">
                Expense Ledger
              </h2>
              <p className="eb-mono truncate text-[10.5px] tracking-wide" style={{ color: "#dbeafe" }}>
                {booking.code || booking.bookingCode || "—"} · {booking.customer || booking.customerNameSnapshot || "—"} · {booking.destination || booking.destinationSnapshot || "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto">
          {expenses.map((expense, index) => {
            const isOpen = openIndex === index;
            const amount = Number(expense.amount) || 0;
            const paidAmount =
              expense.paymentStatus === "PAID"
                ? amount
                : expense.paymentStatus === "CREDIT"
                  ? 0
                  : Number(expense.paidAmount) || 0;
            const outstanding = Math.max(0, amount - paidAmount);
            const hasError = Object.keys(errors).some((k) => k.startsWith(`${index}-`));
            const statusMeta = PAYMENT_STATUSES.find((s) => s.value === expense.paymentStatus);

            return (
              <div
                key={index}
                className="eb-row"
                style={hasError ? { boxShadow: "inset 3px 0 0 #ef4444" } : undefined}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={`eb-detail-panel-${index}`}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenIndex(isOpen ? -1 : index);
                    }
                  }}
                  className="eb-row-header flex cursor-pointer items-start gap-3 px-4 py-2.5"
                >
                  <span className="eb-mono mt-0.5 w-5 flex-shrink-0 text-[11px]" style={{ color: "#94a3b8" }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold">
                        {expense.description || <span style={{ color: "#94a3b8" }}>Untitled entry</span>}
                      </p>
                      <span className="eb-mono flex-shrink-0 text-[13.5px] font-bold">
                        {formatINR(amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="eb-mono truncate text-[10.5px]" style={{ color: "#64748b" }}>
                        {expense.expenseDate
                          ? new Date(expense.expenseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : "—"}{" "}
                        · {expense.category}
                        {expense.costType === "INTERNAL" && " · Company"}
                      </span>
                      <span className={`eb-stamp eb-stamp-${expense.paymentStatus} flex-shrink-0`}>
                        {statusMeta?.label}
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    style={{ color: "#94a3b8" }}
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExpense(index);
                    }}
                    disabled={saving}
                    aria-label="Remove entry"
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: "#94a3b8" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div id={`eb-detail-panel-${index}`} className={`eb-detail-wrap ${isOpen ? "eb-open" : ""}`}>
                  <div className="eb-detail-inner">
                    <div className="eb-detail space-y-3 px-4 py-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="Category" required error={errors[`${index}-category`]}>
                          <select
                            value={expense.category}
                            onChange={(e) => updateExpense(index, "category", e.target.value)}
                            disabled={saving}
                            className="eb-field"
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[9.5px] font-medium" style={{ color: "#64748b" }}>
                            Auto-filled from services
                          </p>
                        </Field>

                        <Field label="Date" required error={errors[`${index}-expenseDate`]}>
                          <input
                            type="date"
                            value={expense.expenseDate}
                            onChange={(e) => updateExpense(index, "expenseDate", e.target.value)}
                            disabled={saving}
                            className="eb-field eb-mono"
                          />
                        </Field>

                        <Field label="Amount" required error={errors[`${index}-amount`]}>
                          <div className="relative">
                            <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94a3b8" }} />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={expense.amount}
                              onChange={(e) => updateExpense(index, "amount", e.target.value)}
                              placeholder="0.00"
                              disabled={saving}
                              className="eb-field eb-mono pl-7 font-bold"
                            />
                          </div>
                        </Field>

                        <Field label="Payment Status">
                          <div className="flex gap-1">
                            {PAYMENT_STATUSES.map((status) => (
                              <button
                                key={status.value}
                                type="button"
                                disabled={saving}
                                onClick={() => updateExpense(index, "paymentStatus", status.value)}
                                className={`eb-toggle eb-toggle-${status.value} ${expense.paymentStatus === status.value ? "eb-active" : ""} flex-1 rounded-md py-1.5 text-[10.5px] font-bold uppercase tracking-wide`}
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </Field>

                        <Field label="Cost Type">
                          <div className="flex gap-1">
                            {COST_TYPES.map((type) => (
                              <button
                                key={type.value}
                                type="button"
                                disabled={saving}
                                onClick={() => updateExpense(index, "costType", type.value)}
                                className={`eb-toggle eb-toggle-${type.value} ${expense.costType === type.value ? "eb-active" : ""} flex-1 rounded-md py-1.5 text-[10.5px] font-bold uppercase tracking-wide`}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1 text-[9.5px] font-medium" style={{ color: "#64748b" }}>
                            {expense.costType === "INTERNAL"
                              ? "Company cost — reduces booking profit"
                              : "Supplier cost — cash book only"}
                          </p>
                        </Field>
                      </div>

                      <Field label="Particulars" required error={errors[`${index}-description`]}>
                        <input
                          type="text"
                          maxLength={300}
                          value={expense.description}
                          onChange={(e) => updateExpense(index, "description", e.target.value)}
                          placeholder="e.g. Hotel payment for 3 nights"
                          disabled={saving}
                          className="eb-field"
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="Vendor / Payee">
                          <input
                            type="text"
                            maxLength={200}
                            value={expense.vendorName}
                            onChange={(e) => updateExpense(index, "vendorName", e.target.value)}
                            placeholder="Vendor name"
                            disabled={saving}
                            className="eb-field"
                          />
                        </Field>

                        <Field label="Due Date" error={errors[`${index}-dueDate`]}>
                          <input
                            type="date"
                            value={expense.dueDate}
                            onChange={(e) => updateExpense(index, "dueDate", e.target.value)}
                            min={expense.expenseDate}
                            disabled={saving || expense.paymentStatus === "PAID"}
                            className="eb-field eb-mono"
                          />
                        </Field>

                        {expense.paymentStatus !== "CREDIT" && (
                          <Field label="Payment Mode" required error={errors[`${index}-paymentMode`]}>
                            <select
                              value={expense.paymentMode}
                              onChange={(e) => updateExpense(index, "paymentMode", e.target.value)}
                              disabled={saving}
                              className="eb-field"
                            >
                              <option value="">Select</option>
                              {PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </Field>
                        )}

                        {expense.paymentStatus === "PARTIAL" && (
                          <Field label="Paid Amount" required error={errors[`${index}-paidAmount`]}>
                            <input
                              type="number"
                              min="0"
                              max={expense.amount || undefined}
                              step="0.01"
                              value={expense.paidAmount}
                              onChange={(e) => updateExpense(index, "paidAmount", e.target.value)}
                              placeholder="0.00"
                              disabled={saving}
                              className="eb-field eb-mono"
                            />
                          </Field>
                        )}

                        {expense.paymentStatus !== "CREDIT" && (
                          <Field label="Ref. No.">
                            <input
                              type="text"
                              maxLength={120}
                              value={expense.referenceNumber}
                              onChange={(e) => updateExpense(index, "referenceNumber", e.target.value)}
                              placeholder="UTR / cheque no."
                              disabled={saving}
                              className="eb-field eb-mono"
                            />
                          </Field>
                        )}
                      </div>

                      <Field label="Notes">
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={expense.notes}
                          onChange={(e) => updateExpense(index, "notes", e.target.value)}
                          placeholder="Optional notes for accounts team..."
                          disabled={saving}
                          className="eb-field resize-none"
                        />
                      </Field>

                      {outstanding > 0 && expense.paymentStatus !== "CREDIT" && (
                        <p className="text-[10.5px] font-semibold" style={{ color: "#dc2626" }}>
                          {formatINR(outstanding)} remains payable to vendor
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addExpense}
            disabled={saving || expenses.length >= MAX_EXPENSE_ROWS}
            className="eb-add-row flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {expenses.length >= MAX_EXPENSE_ROWS
              ? `Limit reached (${MAX_EXPENSE_ROWS} entries)`
              : "New Entry"}
          </button>
        </div>

        {/* Footer */}
        <div className="eb-footer flex flex-col gap-3 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <TotalItem label="Total" value={totals.totalExpense} color="#1e293b" />
            <TotalItem label="Paid" value={totals.totalPaid} color="#15803d" />
            <TotalItem
              label="Balance Due"
              value={totals.totalOutstanding}
              color={totals.totalOutstanding > 0 ? "#dc2626" : "#15803d"}
              emphasize
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="eb-btn-secondary rounded-lg px-4 py-2 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || totals.totalExpense <= 0}
              className="eb-btn-primary flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-bold shadow-sm"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save {expenses.length} {expenses.length > 1 ? "Entries" : "Entry"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, required = false, children }) {
  return (
    <div>
      <label className="eb-label">
        {label}
        {required && <span style={{ color: "#ef4444" }} className="ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[10px] font-bold" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function TotalItem({ label, value, color, emphasize }) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
        {label}
      </div>
      <div className={`eb-mono font-bold ${emphasize ? "text-[15px]" : "text-[13px]"}`} style={{ color }}>
        {formatINR(value)}
      </div>
    </div>
  );
}
