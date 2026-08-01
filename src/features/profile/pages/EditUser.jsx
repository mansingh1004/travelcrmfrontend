import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { User as FiUser, Mail as FiMail, Phone as FiPhone, Eye as FiEye, EyeOff as FiEyeOff, CircleCheck as FiCheckCircle, CircleX as FiXCircle, CircleAlert as FiAlertCircle, Save as FiSave, ArrowLeft as FiArrowLeft, Shield as FiShield, Users as FiUsers, ChevronDown as FiChevronDown, Info as FiInfo, Calendar as FiCalendar, Clock as FiClock, Lock as FiLock, UserPen as FaUserEdit, Shield as FaShieldAlt, BadgeCheck as MdVerified } from "lucide-react";


import editUserService from "../api/profileEditUserService";
import { userPermissionsService } from "../api/profileUserPermissionsService";

/* Roles a tenant admin can assign (mapped to backend Role enum in userMappers). */
const ROLES = [
  { value:"Staff",              label:"Staff",              desc:"Basic access to assigned modules" },
  { value:"Manager",            label:"Manager",            desc:"Manage team and view all reports" },
  { value:"Travel Agent",       label:"Travel Agent",       desc:"Handle leads, quotations & bookings" },
  { value:"Organization Admin", label:"Organization Admin", desc:"Full access to the organization" },
  { value:"Account",            label:"Account",            desc:"Finance, invoices & payments" },
];

const PASSWORD_RULES = [
  { id:"len",   label:"At least 8 characters",        test:(p)=>p.length>=8             },
  { id:"upper", label:"At least one uppercase letter", test:(p)=>/[A-Z]/.test(p)        },
  { id:"lower", label:"At least one lowercase letter", test:(p)=>/[a-z]/.test(p)        },
  { id:"num",   label:"At least one number",           test:(p)=>/[0-9]/.test(p)        },
  { id:"spec",  label:"At least one special character",test:(p)=>/[^A-Za-z0-9]/.test(p) },
];

const AVATAR_GRADS = [
  "from-blue-500 to-blue-600","from-indigo-500 to-indigo-600",
  "from-teal-500 to-teal-600","from-purple-500 to-purple-600",
];
const initials = (n="") =>
  n.trim().split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"U";
// id is a UUID string — hash it to a stable gradient index.
const avatarGrad = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_GRADS.length;
  return AVATAR_GRADS[h];
};

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

/* ─── TOGGLE SWITCH ──────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={()=>onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0
        ${checked?"bg-blue-600":"bg-slate-300"}`}>
      <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200
        ${checked?"translate-x-6":"translate-x-1"}`}/>
    </button>
  );
}

/* ─── FIELD LABEL ─────────────────────────────────────────────── */
function Label({ children, required }) {
  return (
    <label className="block text-sm font-extrabold text-slate-700 mb-1.5">
      {children}{required&&<span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

const inputCls = (err, disabled) =>
  `w-full px-4 py-3 rounded-xl border text-sm transition-all
   ${disabled
     ?"border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
     :err
       ?"border-red-300 bg-white text-slate-700 focus:border-red-400 focus:ring-2 focus:ring-red-50 focus:outline-none"
       :"border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:outline-none hover:border-slate-300"}`;

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function EditUser() {
  const navigate  = useNavigate();
  const { id }    = useParams(); // e.g. /EditUser/34

  const [user,       setUser]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState({
    email:"", fullName:"", phone:"", role:"Staff", isActive:true,
  });
  const [errs,       setErrs]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState(null);

  // Password management
  const [setNewPass,     setSetNewPass]     = useState(false);
  const [newPassword,    setNewPassword]    = useState("");
  const [confirmPass,    setConfirmPass]    = useState("");
  const [showNewPass,    setShowNewPass]    = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [passErrs,       setPassErrs]       = useState({});

  const showToast = useCallback((msg, type="success")=>setToast({msg,type}),[]);

  /* load user + permission counts.
     mapUserFromApi hardcodes `permissions: { pages: 0, total: 0 }` because GET /users/{id} does
     not carry them — the real numbers live on GET /users/{id}/permissions, which returns
     { pages, total, permissions }. Fetched alongside so the counters show the same figures the
     Manage Detailed Permissions page does. */
  useEffect(()=>{
    setLoading(true);
    Promise.all([
      editUserService.getById(id),
      // Permission counts are supplementary: a failure here must not blank the whole form, so it
      // resolves to null and the counters simply fall back to the mapper's zeros.
      userPermissionsService.getPermissions(id).catch(()=> null),
    ])
      .then(([res, permRes])=>{
        const u = res.data;
        const p = permRes?.data;
        // Prefer the endpoint's own counts; derive from the map if it only returns the map.
        const granted = p?.permissions
          ? Object.values(p.permissions).filter(v=>v?.access).length
          : null;
        setUser({
          ...u,
          permissions: {
            pages: p?.pages ?? granted ?? u.permissions.pages,
            total: p?.total ?? (p?.permissions ? Object.keys(p.permissions).length : u.permissions.total),
          },
        });
        setForm({
          email:u.email, fullName:u.fullName,
          phone:u.phone||"", role:u.role,
          isActive: u.status==="Active",
        });
      })
      .catch(()=> showToast("Failed to load user data.","error"))
      .finally(()=> setLoading(false));
  },[id, showToast]);

  /* clear errors on type */
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setErrs(p=>({...p,[k]:""})); };

  /* password rules */
  const ruleResults = PASSWORD_RULES.map(r=>({ ...r, passed:r.test(newPassword) }));
  const allRulesPassed = ruleResults.every(r=>r.passed);
  const passedCount = ruleResults.filter(r=>r.passed).length;

  /* validation */
  const validate = () => {
    const e={};
    if(!form.fullName.trim()) e.fullName="Full name is required";
    if(!form.email.trim())    e.email="Email is required";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email="Enter a valid email";
    if(!form.role)            e.role="Please select a role";
    return e;
  };

  const validatePass = () => {
    const e={};
    if(!newPassword)         e.newPassword="Password is required";
    if(!allRulesPassed)      e.newPassword="Password does not meet all requirements";
    if(!confirmPass)         e.confirmPass="Please confirm the password";
    if(newPassword!==confirmPass) e.confirmPass="Passwords do not match";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs2 = validate();
    if(setNewPass){ Object.assign(errs2, validatePass()); }
    if(Object.keys(errs2).length||Object.keys({...errs2}).length){
      const formErrs = validate();
      const pErrs = setNewPass ? validatePass() : {};
      setErrs(formErrs);
      setPassErrs(pErrs);
      if(Object.keys(formErrs).length||Object.keys(pErrs).length){
        showToast("Please fix the errors below.","error"); return;
      }
    }
    setSubmitting(true);
    try {
      const wanted = form.email.trim().toLowerCase();
      const emailChanged = wanted !== (user?.email || "").trim().toLowerCase();

      const res = await editUserService.fullUpdate(id, {
        fullName: form.fullName.trim(),
        email:    form.email.trim(),
        phone:    form.phone.trim(),
        role:     form.role,
        isActive: form.isActive,
        ...(setNewPass && { newPassword, confirmPassword: confirmPass }),
      });

      // The server is the authority on whether it accepts an email change. If it echoes back the
      // OLD address, it silently dropped the field — say so instead of reporting a success that
      // did not happen, and stay on the page so the value on screen is not mistaken for saved.
      const saved = (res?.data?.email || "").trim().toLowerCase();
      if (emailChanged && saved && saved !== wanted) {
        showToast(`Profile saved, but the email was NOT changed — the server still has ${res.data.email}.`, "error");
        setForm(p=>({ ...p, email: res.data.email }));
        setUser(res.data);
        return;
      }

      showToast(`User "${form.fullName}" updated successfully! ✅`);
      setTimeout(()=>navigate("/Users"), 1500);
    } catch(err){
      showToast(err?.response?.data?.message||"Failed to update user.","error");
    } finally { setSubmitting(false); }
  };

  /* selected role */
  const selectedRole = ROLES.find(r=>r.value===form.role)||ROLES[0];

  if(loading){
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-sm text-slate-500 font-medium">Loading user data…</p>
        </div>
      </div>
    );
  }

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
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-200 flex-shrink-0">
                <FaUserEdit className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Edit User</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Update user details and permissions
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={()=>navigate("/Users")}>Users</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Edit</span>
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

            {/* ══ LEFT — MAIN FORM ══ */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* ── USER INFORMATION CARD ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">
                {/* Header — matches screenshot blue bar with Active badge */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                      <FiUsers className="w-4 h-4"/>
                    </div>
                    <h2 className="text-sm font-extrabold text-white">User Information</h2>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5
                    ${form.isActive?"bg-emerald-400/20 border border-emerald-300/40 text-emerald-200":"bg-slate-400/20 border border-slate-300/40 text-slate-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${form.isActive?"bg-emerald-300 animate-pulse":"bg-slate-400"}`}/>
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Two-column form */}
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                    {/* ──── LEFT COLUMN ──── */}
                    <div className="space-y-5">

                      {/* Username — READ ONLY */}
                      <div>
                        <Label>Username</Label>
                        <input
                          value={user?.username||""}
                          disabled
                          className={inputCls(false, true)}
                          readOnly
                        />
                        <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
                          <FiLock className="w-3 h-3"/> Derived from the email — not stored separately
                        </p>
                      </div>

                      {/* Email — editable. This is the user's LOGIN identifier: changing it
                          changes the address they sign in with, and the username shown above is
                          derived from its local-part, so it moves too. */}
                      <div>
                        <Label required>Email</Label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e=>set("email",e.target.value)}
                          className={inputCls(errs.email, false)}
                          placeholder="Email address"
                        />
                        {errs.email ? (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{errs.email}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                            <FiAlertCircle className="w-3 h-3 flex-shrink-0"/>
                            This is the sign-in address — the user must use the new one to log in.
                          </p>
                        )}
                      </div>

                      {/* Full Name */}
                      <div>
                        <Label required>Full Name</Label>
                        <input
                          value={form.fullName}
                          onChange={e=>set("fullName",e.target.value)}
                          className={inputCls(errs.fullName, false)}
                          placeholder="Enter full name"
                        />
                        {errs.fullName && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{errs.fullName}
                          </p>
                        )}
                      </div>

                      {/* Phone */}
                      <div>
                        <Label>Phone Number</Label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e=>set("phone",e.target.value)}
                          className={inputCls(false,false)}
                          placeholder="Enter phone number"
                        />
                      </div>

                      {/* Role */}
                      <div>
                        <Label required>Role</Label>
                        <div className="relative">
                          <select
                            value={form.role}
                            onChange={e=>set("role",e.target.value)}
                            className={inputCls(errs.role,false)+" pr-10 cursor-pointer appearance-none"}>
                            {ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">{selectedRole.desc}</p>
                      </div>

                      {/* Account Status */}
                      <div>
                        <Label>Account Status</Label>
                        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all
                          ${form.isActive?"bg-blue-50 border-blue-200":"bg-slate-50 border-slate-200"}`}>
                          <Toggle checked={form.isActive} onChange={v=>set("isActive",v)}/>
                          <p className={`text-sm font-bold ${form.isActive?"text-blue-700":"text-slate-600"}`}>
                            {form.isActive ? "Active - User can log in and access the system" : "Inactive - User cannot log in"}
                          </p>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">Inactive users cannot log in</p>
                      </div>
                    </div>

                    {/* ──── RIGHT COLUMN ──── */}
                    <div className="space-y-5">

                      {/* Current Permissions */}
                      <div>
                        <Label>Current Permissions</Label>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {/* Pages */}
                          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white relative overflow-hidden">
                            <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full bg-white/10"/>
                            <div className="relative z-10 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                <FiShield className="w-4 h-4"/>
                              </div>
                              <div>
                                <p className="text-xs font-bold opacity-80">Pages</p>
                                <p className="text-2xl font-extrabold leading-none">{user?.permissions?.pages||0}</p>
                              </div>
                            </div>
                          </div>
                          {/* Total */}
                          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white relative overflow-hidden">
                            <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full bg-white/10"/>
                            <div className="relative z-10 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                <FiCheckCircle className="w-4 h-4"/>
                              </div>
                              <div>
                                <p className="text-xs font-bold opacity-80">Total</p>
                                <p className="text-2xl font-extrabold leading-none">{user?.permissions?.total||0}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Manage Detailed Permissions button */}
                        <button type="button"
                          onClick={()=>navigate(`/UserPermissions/${id}`)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                            bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm
                            shadow-md shadow-teal-200 transition-all">
                          <FiShield className="w-4 h-4"/> Manage Detailed Permissions
                        </button>
                      </div>

                      {/* Password Management */}
                      <div>
                        <Label>Password Management</Label>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          {/* Toggle row */}
                          <div className="flex items-center gap-3 mb-1">
                            <Toggle checked={setNewPass} onChange={v=>{ setSetNewPass(v); if(!v){ setNewPassword(""); setConfirmPass(""); setPassErrs({}); }}}/>
                            <p className={`text-sm font-bold ${setNewPass?"text-blue-700":"text-slate-600"}`}>
                              Set new password
                            </p>
                          </div>
                          <p className="text-xs text-slate-400 mb-3">Check this to change the user's password</p>

                          {/* Password fields — only visible when toggle is ON */}
                          {setNewPass && (
                            <div className="space-y-3 pt-3 border-t border-slate-200">
                              {/* New Password */}
                              <div>
                                <label className="block text-xs font-extrabold text-slate-600 mb-1.5 uppercase tracking-wide">
                                  New Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type={showNewPass?"text":"password"}
                                    value={newPassword}
                                    onChange={e=>{ setNewPassword(e.target.value); setPassErrs(p=>({...p,newPassword:""})); }}
                                    className={inputCls(passErrs.newPassword,false)+" pr-12"}
                                    placeholder="Min 8 characters"
                                  />
                                  <button type="button" onClick={()=>setShowNewPass(v=>!v)} tabIndex={-1}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showNewPass?<FiEyeOff className="w-4 h-4"/>:<FiEye className="w-4 h-4"/>}
                                  </button>
                                </div>
                                {passErrs.newPassword && (
                                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                    <FiAlertCircle className="w-3 h-3"/>{passErrs.newPassword}
                                  </p>
                                )}
                              </div>

                              {/* Confirm Password */}
                              <div>
                                <label className="block text-xs font-extrabold text-slate-600 mb-1.5 uppercase tracking-wide">
                                  Confirm Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type={showConfirm?"text":"password"}
                                    value={confirmPass}
                                    onChange={e=>{ setConfirmPass(e.target.value); setPassErrs(p=>({...p,confirmPass:""})); }}
                                    className={inputCls(passErrs.confirmPass,false)+" pr-12"}
                                    placeholder="Re-enter new password"
                                  />
                                  <button type="button" onClick={()=>setShowConfirm(v=>!v)} tabIndex={-1}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showConfirm?<FiEyeOff className="w-4 h-4"/>:<FiEye className="w-4 h-4"/>}
                                  </button>
                                </div>
                                {passErrs.confirmPass && (
                                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                    <FiAlertCircle className="w-3 h-3"/>{passErrs.confirmPass}
                                  </p>
                                )}
                              </div>

                              {/* Mini checklist */}
                              {newPassword.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 p-3">
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {ruleResults.map(r=>(
                                      <div key={r.id} className="flex items-center gap-2">
                                        {r.passed
                                          ? <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"/>
                                          : <FiXCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0"/>}
                                        <span className={`text-xs ${r.passed?"text-emerald-600 font-semibold":"text-slate-500"}`}>{r.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">{passedCount}/{PASSWORD_RULES.length} met</span>
                                    {allRulesPassed && (
                                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <FiCheckCircle className="w-3 h-3"/> All met
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Account Information */}
                      <div>
                        <Label>Account Information</Label>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
                          {[
                            { icon:<FiCalendar className="w-3.5 h-3.5"/>, label:"Created",      value:user?.createdAt   },
                            { icon:<FiClock className="w-3.5 h-3.5"/>,    label:"Last Updated", value:user?.lastUpdated },
                            { icon:<FiClock className="w-3.5 h-3.5"/>,    label:"Last Login",   value:user?.lastLogin   },
                          ].map(({icon,label,value})=>(
                            <div key={label} className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                                {icon}
                              </div>
                              <div>
                                <span className="text-xs font-extrabold text-slate-500">{label}: </span>
                                <span className="text-xs font-bold text-slate-700">{value||"Never"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm p-5 fade-up"
                style={{animationDelay:"80ms"}}>
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  {/* Update User */}
                  <button type="submit" disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl
                      bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm
                      shadow-md shadow-blue-200 hover:shadow-lg transition-all
                      disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                        Updating User…
                      </>
                    ) : (
                      <><FiSave className="w-4 h-4"/> Update User</>
                    )}
                  </button>

                  {/* Cancel */}
                  <button type="button" onClick={()=>navigate("/Users")} disabled={submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3
                      rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600
                      hover:text-slate-800 font-bold text-sm transition-all bg-white hover:bg-slate-50 disabled:opacity-50">
                    ✕ Cancel
                  </button>

                  {/* Manage Permissions */}
                  <button type="button"
                    onClick={()=>navigate(`/UserPermissions/${id}`)}
                    disabled={submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3
                      rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm
                      shadow-md shadow-teal-200 transition-all disabled:opacity-50">
                    <FaShieldAlt className="w-4 h-4"/> Manage Permissions
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

                {/* User Preview */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
                  style={{animation:"fadeUp .5s ease both"}}>
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                      <FiUser className="w-4 h-4"/>
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-800">User Preview</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Updates as you edit</p>
                    </div>
                  </div>
                  <div className="p-5">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3 pb-4 border-b border-slate-100 mb-4">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad(user?.id||34)} flex items-center justify-center text-white text-xl font-extrabold shadow-md`}>
                        {form.fullName ? initials(form.fullName) : initials(user?.fullName||"")}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
                          {form.fullName || <span className="text-slate-400 font-normal italic">Full name</span>}
                          <MdVerified className="w-4 h-4 text-blue-500 flex-shrink-0"/>
                        </p>
                        <p className="text-xs text-blue-600 font-bold mt-0.5">@{user?.username}</p>
                        <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full
                            ${form.isActive?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${form.isActive?"bg-emerald-500 animate-pulse":"bg-slate-400"}`}/>
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
                      { icon:<FiMail className="w-3.5 h-3.5"/>,    label:"Email",  value:form.email    },
                      { icon:<FiPhone className="w-3.5 h-3.5"/>,   label:"Phone",  value:form.phone    },
                      { icon:<FiCalendar className="w-3.5 h-3.5"/>,label:"Joined", value:user?.createdAt?.split(" ")[0]+" "+user?.createdAt?.split(" ")[1]+" "+user?.createdAt?.split(" ")[2] },
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

                    {/* Permissions mini summary */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Permissions</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {label:"Pages",  value:user?.permissions?.pages||0,  color:"text-teal-600",  bg:"bg-teal-50   border-teal-200"},
                          {label:"Total",  value:user?.permissions?.total||0,  color:"text-emerald-600",bg:"bg-emerald-50 border-emerald-200"},
                        ].map(({label,value,color,bg})=>(
                          <div key={label} className={`text-center py-2 rounded-xl border ${bg}`}>
                            <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tips card */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
                  style={{animation:"fadeUp .6s ease both"}}>
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0">
                      <FiInfo className="w-4 h-4"/>
                    </div>
                    <h2 className="text-sm font-extrabold text-slate-800">Edit Tips</h2>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      { icon:"🔒", tip:"Username cannot be changed once set" },
                      { icon:"🔑", tip:"Toggle 'Set new password' to update credentials" },
                      { icon:"🛡️", tip:"Use Manage Permissions for granular access" },
                      { icon:"⚠️", tip:"Inactive users are immediately logged out" },
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