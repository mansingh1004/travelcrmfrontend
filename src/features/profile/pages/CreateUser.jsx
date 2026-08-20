import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User as FiUser, Mail as FiMail, Phone as FiPhone, Eye as FiEye, EyeOff as FiEyeOff, CircleCheck as FiCheckCircle, CircleX as FiXCircle, CircleAlert as FiAlertCircle, ArrowLeft as FiArrowLeft, Shield as FiShield, Users as FiUsers, ChevronDown as FiChevronDown, Info as FiInfo, UserPlus as FaUserPlus } from "lucide-react";


import { createUserService } from "../api/profilecreateUserService";
import userService from "../api/profileUserService";

/* ─── CONSTANTS ──────────────────────────────────────────────── */
// Roles a tenant admin can assign (mapped to backend Role enum in userMappers).
const ROLES = [
  { value:"Staff",              label:"Staff",              desc:"Basic access to assigned modules" },
  { value:"Manager",            label:"Manager",            desc:"Manage team and view all reports" },
  { value:"Travel Agent",       label:"Travel Agent",       desc:"Handle leads, quotations & bookings" },
  { value:"Organization Admin", label:"Organization Admin", desc:"Full access to the organization" },
  { value:"Account",            label:"Account",            desc:"Finance, invoices & payments" },
];

const PERMISSION_TEMPLATES = [
  { value:"basic",   label:"Basic Access Only"  },
  { value:"sales",   label:"Sales Team Access"  },
  { value:"support", label:"Support Access"     },
  { value:"full",    label:"Full Access"        },
  { value:"custom",  label:"Custom Permissions" },
];

const PASSWORD_RULES = [
  { id:"len",   label:"At least 8 characters",      test:(p) => p.length >= 8             },
  { id:"upper", label:"At least one uppercase letter", test:(p) => /[A-Z]/.test(p)        },
  { id:"lower", label:"At least one lowercase letter", test:(p) => /[a-z]/.test(p)        },
  { id:"num",   label:"At least one number",           test:(p) => /[0-9]/.test(p)        },
  { id:"spec",  label:"At least one special character",test:(p) => /[^A-Za-z0-9]/.test(p) },
];

/* ─── HELPERS ────────────────────────────────────────────────── */
function getStrength(password) {
  if (!password) return { score: 0, label: "", color: "", pct: 0 };
  let score = 0;
  if (password.length >= 8)              score++;
  if (password.length >= 12)             score++;
  if (/[A-Z]/.test(password))           score++;
  if (/[a-z]/.test(password))           score++;
  if (/[0-9]/.test(password))           score++;
  if (/[^A-Za-z0-9]/.test(password))    score++;
  const pct = Math.round((score / 6) * 100);
  if (score <= 2) return { score, pct, label:"Weak",   color:"bg-red-500",    text:"text-red-600"    };
  if (score <= 3) return { score, pct, label:"Fair",   color:"bg-amber-500",  text:"text-amber-600"  };
  if (score <= 4) return { score, pct, label:"Good",   color:"bg-blue-500",   text:"text-blue-600"   };
  return            { score, pct, label:"Strong", color:"bg-emerald-500",text:"text-emerald-600" };
}

const AVATAR_GRADS = [
  "from-blue-500 to-blue-600","from-indigo-500 to-indigo-600",
  "from-teal-500 to-teal-600","from-purple-500 to-purple-600",
];
// (n || "") — NOT a `= ""` default: a default only fires on `undefined`, so a null name from the API
// would hit null.trim() and crash the page.
const initials = (n) => (n || "").trim().split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"U";

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,4000); return()=>clearTimeout(t); },[onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
      ${type==="success"?"bg-green-50 border-green-200 text-green-800":"bg-red-50 border-red-200 text-red-800"}`}
      style={{animation:"slideIn .3s ease both"}}>
      <span className="text-lg">{type==="success"?"✅":"❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
    </div>
  );
}

/* ─── FIELD LABEL ─────────────────────────────────────────────── */
function Label({ children, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-extrabold text-slate-700">
        {children}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputCls = (err) =>
  `w-full px-4 py-3 rounded-xl border text-sm text-slate-700 placeholder-slate-400
   focus:outline-none focus:ring-2 transition-all bg-white
   ${err
     ? "border-red-300 focus:border-red-400 focus:ring-red-50"
     : "border-slate-200 focus:border-blue-400 focus:ring-blue-50 hover:border-slate-300"}`;

/* ─── TOGGLE SWITCH ──────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={()=>onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none
        ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
      <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200
        ${checked ? "translate-x-6" : "translate-x-1"}`}/>
    </button>
  );
}

/* ─── PASSWORD INPUT ──────────────────────────────────────────── */
function PasswordInput({ label, value, onChange, show, onToggle, error, hint, placeholder }) {
  return (
    <div>
      <Label required hint={hint}>{label}</Label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder || ""}
          className={inputCls(error) + " pr-12"}
          autoComplete="new-password"
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
          {show ? <FiEyeOff className="w-4 h-4"/> : <FiEye className="w-4 h-4"/>}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{error}
        </p>
      )}
    </div>
  );
}

/* ─── SECTION CARD ────────────────────────────────────────────── */
function SectionCard({ children, delay=0 }) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
      style={{animation:`fadeUp .4s ease both`, animationDelay:`${delay}ms`}}>
      {children}
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function CreateUser() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username:"", fullName:"", email:"", phone:"",
    password:"", confirmPassword:"",
    role:"Staff", permissionTemplate:"basic",
    isActive: true,
  });
  const [errs,      setErrs]      = useState({});
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [toast,     setToast]     = useState(null);

  // Live active-users count for the header badge.
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  useEffect(() => {
    userService.getStats()
      .then((res) => setActiveUsersCount(res.data?.active ?? 0))
      .catch(() => {});
  }, []);

  const set = (k, v) => { setForm(p=>({...p,[k]:v})); setErrs(p=>({...p,[k]:""})); };
  const showToast = useCallback((msg, type="success") => setToast({msg,type}), []);

  /* live password rules */
  const ruleResults = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(form.password) }));
  const allRulesPassed = ruleResults.every(r => r.passed);
  const strength = getStrength(form.password);
  const passedCount = ruleResults.filter(r => r.passed).length;

  /* valiation */
  const validate = () => {
    const e = {};
    if (!form.username.trim())   e.username = "Username is required";
    if (/\s/.test(form.username))e.username = "Username cannot contain spaces";
    if (!form.fullName.trim())   e.fullName = "Full name is required";
    if (!form.email.trim())      e.email    = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.password)          e.password = "Password is required";
    if (form.password && !allRulesPassed) e.password = "Password does not meet all requirements";
    if (!form.confirmPassword)   e.confirmPassword = "Please confirm your password";
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    if (!form.role)              e.role = "Please select a role";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs2 = validate();
    if (Object.keys(errs2).length) {
      setErrs(errs2);
      showToast("Please fix the errors below.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createUserService.create(form);
      showToast(`User "${form.fullName}" created successfully! 🎉`);
      setTimeout(() => navigate("/Users"), 1500);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create user.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({ username:"", fullName:"", email:"", phone:"", password:"", confirmPassword:"", role:"Staff", permissionTemplate:"basic", isActive:true });
    setErrs({});
    showToast("Form reset.");
  };

  /* selected role config */
  const selectedRole = ROLES.find(r => r.value === form.role) || ROLES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200 flex-shrink-0">
                <FaUserPlus className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Create User</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Add a new staff member to your CRM
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/Users")}>Users</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Create</span>
                  </span>
                </p>
              </div>
            </div>
            <button type="button" onClick={()=>navigate("/Users")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                text-sm font-bold transition-all shadow-sm">
              <FiArrowLeft className="w-4 h-4"/> Back to Users
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col xl:flex-row gap-6">

            {/* ══ LEFT + CENTER — MAIN FORM ══ */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* ── USER INFORMATION CARD ── */}
              <SectionCard delay={0}>
                {/* Header — matches screenshot blue bar with Active Users count */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                      <FiUsers className="w-4 h-4"/>
                    </div>
                    <h2 className="text-sm font-extrabold text-white">User Information</h2>
                  </div>
                  <span className="text-xs font-bold bg-white/20 border border-white/30 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"/>
                    Active Users: {activeUsersCount}
                  </span>
                </div>

                {/* Two-column form grid — matches screenshot exactly */}
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                    {/* ──── LEFT COLUMN ──── */}
                    <div className="space-y-5">

                      {/* Username */}
                      <div>
                        <Label required>Username</Label>
                        <input
                          value={form.username}
                          onChange={e => set("username", e.target.value.replace(/\s/g,""))}
                          className={inputCls(errs.username)}
                          placeholder="admin_ntat"
                          autoComplete="username"
                        />
                        {errs.username
                          ? <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{errs.username}</p>
                          : <p className="mt-1.5 text-xs text-slate-400">Username must be globally unique across all companies in the database</p>}
                      </div>

                      {/* Password */}
                      <div>
                        <PasswordInput
                          label="Password"
                          value={form.password}
                          onChange={e => set("password", e.target.value)}
                          show={showPass}
                          onToggle={() => setShowPass(v=>!v)}
                          error={errs.password}
                          hint={!errs.password ? "Minimum 8 characters with uppercase, lowercase, number, and special character" : undefined}
                        />
                        {/* Strength meter */}
                        {form.password.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 font-medium">Strength</span>
                              <span className={`text-xs font-extrabold ${strength.text}`}>{strength.label}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${strength.color}`}
                                style={{width:`${strength.pct}%`}}/>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <PasswordInput
                        label="Confirm Password"
                        value={form.confirmPassword}
                        onChange={e => set("confirmPassword", e.target.value)}
                        show={showConf}
                        onToggle={() => setShowConf(v=>!v)}
                        error={errs.confirmPassword}
                        placeholder="Confirm password"
                      />

                      {/* Email */}
                      <div>
                        <Label required>Email</Label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => set("email", e.target.value)}
                          className={inputCls(errs.email)}
                          placeholder="Enter email address"
                        />
                        {errs.email
                          ? <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{errs.email}</p>
                          : <p className="mt-1.5 text-xs text-slate-400">Multiple users can share the same email</p>}
                      </div>

                      {/* Password requirements checklist */}
                      {form.password.length > 0 && (
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wide mb-3">
                            Password Requirements
                          </p>
                          <div className="space-y-2">
                            {ruleResults.map(rule => (
                              <div key={rule.id} className="flex items-center gap-2">
                                {rule.passed
                                  ? <FiCheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0"/>
                                  : <FiXCircle    className="w-4 h-4 text-red-400    flex-shrink-0"/>}
                                <span className={`text-xs transition-colors ${rule.passed ? "text-emerald-600 font-semibold" : "text-slate-500"}`}>
                                  {rule.label}
                                </span>
                              </div>
                            ))}
                          </div>
                          {/* Progress */}
                          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">
                              {passedCount} of {PASSWORD_RULES.length} requirements met
                            </span>
                            {allRulesPassed && (
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <FiCheckCircle className="w-3 h-3"/> All met
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ──── RIGHT COLUMN ──── */}
                    <div className="space-y-5">

                      {/* Full Name */}
                      <div>
                        <Label required>Full Name</Label>
                        <input
                          value={form.fullName}
                          onChange={e => set("fullName", e.target.value)}
                          className={inputCls(errs.fullName)}
                          placeholder="Enter full name"
                        />
                        {errs.fullName && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{errs.fullName}</p>
                        )}
                      </div>

                      {/* Phone Number */}
                      <div>
                        <Label hint="Optional - will be validated if provided">Phone Number</Label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e => set("phone", e.target.value)}
                          className={inputCls(false)}
                          placeholder="Enter phone number"
                        />
                      </div>

                      {/* Role */}
                      <div>
                        <Label required>Role</Label>
                        <div className="relative">
                          <select
                            value={form.role}
                            onChange={e => set("role", e.target.value)}
                            className={inputCls(errs.role) + " pr-10 cursor-pointer appearance-none"}
                          >
                            {ROLES.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">{selectedRole.desc}</p>
                        {errs.role && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><FiAlertCircle className="w-3 h-3"/>{errs.role}</p>
                        )}
                      </div>

                      {/* Permission Template */}
                      <div>
                        <Label hint="Template will be applied after user creation. You can modify permissions later.">
                          Permission Template
                        </Label>
                        <div className="relative">
                          <select
                            value={form.permissionTemplate}
                            onChange={e => set("permissionTemplate", e.target.value)}
                            className={inputCls(false) + " pr-10 cursor-pointer appearance-none"}
                          >
                            {PERMISSION_TEMPLATES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                        </div>
                         <p className="mt-1.5 text-xs text-amber-500 font-medium">
                            No templates available.{" "}
                          <span
                            className="text-blue-500 cursor-pointer hover:underline"
                            onClick={() => navigate("/CreatePermissionTemplate")}
                           >
                            Create templates
                          </span>
                             {" "}to streamline user setup.
                          </p>
                      </div>

                      {/* Account Status Toggle — matches screenshot exactly */}
                      <div>
                        <Label>Account Status</Label>
                        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all
                          ${form.isActive
                            ? "bg-blue-50 border-blue-200"
                            : "bg-slate-50 border-slate-200"}`}>
                          <Toggle checked={form.isActive} onChange={v => set("isActive", v)}/>
                          <div>
                            <p className={`text-sm font-bold ${form.isActive ? "text-blue-700" : "text-slate-600"}`}>
                              {form.isActive ? "Active - User can log in and access the system" : "Inactive - User cannot log in"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">Inactive users cannot log in</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ── ACTION BUTTONS ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5"
                style={{animation:"fadeUp .5s ease both"}}>
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <button type="submit" disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl
                      bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm
                      shadow-md shadow-blue-200 hover:shadow-lg transition-all
                      disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                        Creating User…
                      </>
                    ) : (
                      <>
                        <FaUserPlus className="w-4 h-4"/> Create User
                      </>
                    )}
                  </button>

                  <button type="button" onClick={() => navigate("/Users")} disabled={submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3
                      rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600
                      hover:text-slate-800 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-50">
                    ✕ Cancel
                  </button>

                  <button type="button" onClick={handleReset} disabled={submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3
                      rounded-xl border-2 border-red-100 hover:border-red-200 text-red-400
                      hover:text-red-600 font-bold text-sm transition-all bg-white hover:bg-red-50 disabled:opacity-40">
                    <FiArrowLeft className="w-4 h-4"/> Reset
                  </button>
                </div>
                <p className="text-right text-xs text-slate-400 mt-3">
                  <span className="text-red-500 font-bold">*</span> Required fields
                </p>
              </div>
            </div>

            {/* ══ RIGHT SIDEBAR — LIVE PREVIEW ══ */}
            <div className="w-full xl:w-72 2xl:w-80 flex-shrink-0">
              <div className="xl:sticky xl:top-20 space-y-4">

                {/* User Preview card */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
                  style={{animation:"fadeUp .5s ease both"}}>
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                      <FiUser className="w-4 h-4"/>
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-800">User Preview</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Updates as you type</p>
                    </div>
                  </div>
                  <div className="p-5">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3 pb-4 border-b border-slate-100 mb-4">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${AVATAR_GRADS[0]} flex items-center justify-center text-white text-xl font-extrabold shadow-md`}>
                        {form.fullName ? initials(form.fullName) : "U"}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-slate-800">
                          {form.fullName || <span className="text-slate-400 font-normal italic">Full name</span>}
                        </p>
                        <p className="text-xs text-blue-600 font-bold mt-0.5">
                          {form.username || <span className="text-slate-400 font-normal">username</span>}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full
                            ${form.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${form.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}/>
                            {form.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                            {form.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Preview fields */}
                    {[
                      { icon:<FiMail className="w-3.5 h-3.5"/>,  label:"Email",   value:form.email   },
                      { icon:<FiPhone className="w-3.5 h-3.5"/>, label:"Phone",   value:form.phone   },
                      { icon:<FiShield className="w-3.5 h-3.5"/>,label:"Template",value:PERMISSION_TEMPLATES.find(t=>t.value===form.permissionTemplate)?.label },
                    ].map(({icon,label,value})=>(
                      <div key={label} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 mt-0.5">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {value || <span className="text-slate-300 font-normal italic">Not set</span>}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Password strength preview */}
                    {form.password.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-slate-400 font-medium">Password Strength</span>
                          <span className={`text-[11px] font-extrabold ${strength.text}`}>{strength.label}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${strength.color}`}
                            style={{width:`${strength.pct}%`}}/>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{passedCount}/{PASSWORD_RULES.length} requirements met</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tips card */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
                  style={{animation:"fadeUp .6s ease both"}}>
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0">
                      <FiInfo className="w-4 h-4"/>
                    </div>
                    <h2 className="text-sm font-extrabold text-slate-800">Quick Tips</h2>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      { icon:"💡", tip:"Username must be unique across all companies" },
                      { icon:"🔒", tip:"Use a strong password with mixed characters"  },
                      { icon:"👤", tip:"Choose the right role for proper access"      },
                      { icon:"⚙️",  tip:"Permission templates can be changed later"    },
                    ].map(({icon,tip})=>(
                      <div key={tip} className="flex items-start gap-2.5">
                        <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}