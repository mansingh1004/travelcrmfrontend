import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  FileText,
  IdCard,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  RotateCcw,
  ShieldCheck,
  StickyNote,
} from "lucide-react";

import customerService from "../api/customerService";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

const CUSTOMER_TYPES = ["Individual", "Regular", "Corporate", "VIP", "Group", "Agent"];
const COMMUNICATION_OPTIONS = ["WhatsApp", "Phone Call", "Email", "SMS", "All Channels"];
const LOYALTY_TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const CUSTOMER_STATUSES = ["Active", "Inactive", "Blocked"];
const TODAY = new Date().toISOString().slice(0, 10);
const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh",
];

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const optionalText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

function Panel({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({ label, icon: Icon, required, optional, error, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {label}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SelectField({ icon: Icon, children, className = "", ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
      <select {...props} className={`${inputClass} appearance-none pr-9 ${Icon ? "pl-9" : ""} ${className}`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export default function CreateCustomerClean() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      alternatePhone: "",
      commPref: "",
      type: "Individual",
      tier: "Bronze",
      status: "Active",
      birthday: "",
      anniversary: "",
      city: "",
      state: "",
      address: "",
      pincode: "",
      passportNo: "",
      panNo: "",
      aadharNo: "",
      documents: "",
      notes: "",
    },
  });

  const onSubmit = async (data) => {
    if (submitting) return;
    const payload = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: optionalText(data.email),
      alternatePhone: optionalText(data.alternatePhone),
      commPref: data.commPref || null,
      type: data.type || "Individual",
      tier: data.tier || "Bronze",
      status: data.status || "Active",
      birthday: data.birthday || null,
      anniversary: data.anniversary || null,
      city: optionalText(data.city),
      state: optionalText(data.state),
      address: optionalText(data.address),
      pincode: optionalText(data.pincode),
      passportNo: optionalText(data.passportNo),
      panNo: optionalText(data.panNo)?.toUpperCase() || null,
      aadharNo: optionalText(data.aadharNo),
      documents: optionalText(data.documents),
      notes: optionalText(data.notes),
    };

    setSubmitting(true);
    try {
      const response = await customerService.create(payload);
      const customer = response?.data?.data ?? response?.data;
      showToast(`Customer ${customer?.customerCode || customer?.name || ""} created successfully.`, "success");
      navigate("/AllCustomers");
    } catch (error) {
      if (!isAlreadyReported(error)) {
        showToast(getErrorMessage(error, "Could not create the customer."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate("/AllCustomers")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to customers">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">Create Customer</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Create a durable customer profile for future leads and bookings</p>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm">
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {submitting ? "Creating..." : "Create Customer"}
          </button>
        </div>
      </header>

      <main className="w-full space-y-5 px-0 py-4">
        <Panel icon={CircleUserRound} title="Identity & Contact" description="Only full name and phone are required">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full Name" icon={CircleUserRound} required error={errors.name?.message}>
              <input autoFocus placeholder="Customer full name" className={`${inputClass} ${errors.name ? "border-red-300" : ""}`} {...register("name", {
                required: "Full name is required",
                minLength: { value: 2, message: "Name must contain at least 2 characters" },
                maxLength: { value: 150, message: "Name must not exceed 150 characters" },
              })} />
            </Field>
            <Field label="Phone" icon={Phone} required error={errors.phone?.message}>
              <input type="tel" placeholder="+91 98765 43210" className={`${inputClass} ${errors.phone ? "border-red-300" : ""}`} {...register("phone", {
                required: "Phone number is required",
                pattern: { value: /^[+\d\s\-()\u00A0]{7,16}$/, message: "Enter a valid phone number" },
              })} />
            </Field>
            <Field label="Email" icon={Mail} optional error={errors.email?.message}>
              <input type="email" placeholder="customer@email.com" className={`${inputClass} ${errors.email ? "border-red-300" : ""}`} {...register("email", {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
                maxLength: { value: 150, message: "Email must not exceed 150 characters" },
              })} />
            </Field>
            <Field label="Alternate Phone" icon={Phone} optional error={errors.alternatePhone?.message}>
              <input type="tel" placeholder="Alternate number" className={inputClass} {...register("alternatePhone", {
                maxLength: { value: 20, message: "Alternate phone must not exceed 20 characters" },
              })} />
            </Field>
            <Field label="Preferred Communication" icon={MessageCircleMore} optional>
              <SelectField icon={MessageCircleMore} {...register("commPref")}>
                <option value="">No preference</option>
                {COMMUNICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </SelectField>
            </Field>
            <Field label="Customer Type" icon={Building2} optional>
              <SelectField icon={Building2} {...register("type")}>
                {CUSTOMER_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </SelectField>
            </Field>
            <Field label="Loyalty Tier" icon={ShieldCheck} optional>
              <SelectField icon={ShieldCheck} {...register("tier")}>
                {LOYALTY_TIERS.map((option) => <option key={option} value={option}>{option}</option>)}
              </SelectField>
            </Field>
            <Field label="Status" icon={CheckCircle2} optional>
              <SelectField icon={CheckCircle2} {...register("status")}>
                {CUSTOMER_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
              </SelectField>
            </Field>
          </div>
        </Panel>

        <Panel icon={MapPin} title="Address & Important Dates" description="Reusable profile information; all fields are optional">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="City" icon={MapPin} optional error={errors.city?.message}>
              <input placeholder="Customer city" className={inputClass} {...register("city", { maxLength: { value: 100, message: "City must not exceed 100 characters" } })} />
            </Field>
            <Field label="State" icon={MapPin} optional>
              <SelectField icon={MapPin} {...register("state")}>
                <option value="">Select state</option>
                {INDIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </SelectField>
            </Field>
            <Field label="Pincode / ZIP" icon={MapPin} optional error={errors.pincode?.message}>
              <input inputMode="numeric" placeholder="400001" className={`${inputClass} ${errors.pincode ? "border-red-300" : ""}`} {...register("pincode", {
                pattern: { value: /^$|^\d{4,8}$/, message: "Enter a valid pincode" },
              })} />
            </Field>
            <div className="hidden lg:block" />
            <Field label="Birthday" icon={CalendarDays} optional error={errors.birthday?.message}>
              <input type="date" max={TODAY} className={inputClass} {...register("birthday", {
                validate: (value) => !value || value <= TODAY || "Birthday cannot be in the future",
              })} />
            </Field>
            <Field label="Anniversary" icon={CalendarDays} optional>
              <input type="date" className={inputClass} {...register("anniversary")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Full Address" icon={MapPin} optional error={errors.address?.message}>
                <input placeholder="House / Flat, street, area and locality" className={inputClass} {...register("address", {
                  maxLength: { value: 1000, message: "Address must not exceed 1000 characters" },
                })} />
              </Field>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
          <Panel icon={IdCard} title="Identity Documents" description="Capture only when required for visa, ticketing or compliance">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Passport Number" icon={IdCard} optional error={errors.passportNo?.message}>
                <input placeholder="A1234567" className={inputClass} {...register("passportNo", { maxLength: { value: 30, message: "Passport number must not exceed 30 characters" } })} />
              </Field>
              <Field label="PAN Number" icon={IdCard} optional error={errors.panNo?.message}>
                <input placeholder="ABCDE1234F" maxLength={10} className={`${inputClass} uppercase ${errors.panNo ? "border-red-300" : ""}`} {...register("panNo", {
                  pattern: { value: /^$|^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: "Enter a valid PAN number" },
                })} />
              </Field>
              <Field label="Aadhar Number" icon={IdCard} optional error={errors.aadharNo?.message}>
                <input placeholder="1234 5678 9012" className={inputClass} {...register("aadharNo", { maxLength: { value: 20, message: "Aadhar number must not exceed 20 characters" } })} />
              </Field>
              <div className="sm:col-span-3">
                <Field label="Document Notes" icon={FileText} optional error={errors.documents?.message}>
                  <textarea rows={3} placeholder="Passport expiry, visa history or document instructions" className={`${inputClass} resize-y`} {...register("documents", {
                    maxLength: { value: 2000, message: "Document notes must not exceed 2000 characters" },
                  })} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel icon={StickyNote} title="Customer Notes" description="Long-term preferences and internal context">
            <Field label="Preferences & Notes" icon={StickyNote} optional error={errors.notes?.message}>
              <textarea rows={8} placeholder="Meal, seat, hotel, accessibility or communication preferences" className={`${inputClass} resize-y`} {...register("notes", {
                maxLength: { value: 2000, message: "Notes must not exceed 2000 characters" },
              })} />
            </Field>
          </Panel>
        </div>

        <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500"><span className="font-bold text-red-500">*</span> Only Full Name and Phone are required. All other fields may be completed later.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => reset()} disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">
              <RotateCcw className="h-4 w-4" /> Clear
            </button>
            <button type="button" onClick={() => navigate("/AllCustomers")} disabled={submitting} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Creating..." : "Create Customer"}
            </button>
          </div>
        </div>
      </main>
    </form>
  );
}
