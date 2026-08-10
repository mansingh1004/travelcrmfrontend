// src/components/ChangePassword/ChangePassword.jsx
// ─────────────────────────────────────────────────────────────
// Change Password Page — Travel CRM
// Perfectly matches CRM design system:
//   bg: from-slate-50 via-blue-50/30 to-slate-100
//   cards: bg-white/80 rounded-2xl border border-slate-200/60
//   primary: blue-600 | font: Plus Jakarta Sans
// Features:
//   - Live password strength meter
//   - Real-time requirement checklist (turns green tick on pass)
//   - Show/hide toggle for all 3 fields
//   - Full validation before submit
//   - Loading spinner on submit
//   - Toast notifications (top-right, same as all CRM pages)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Key as FiKey, Eye as FiEye, EyeOff as FiEyeOff, CircleCheck as FiCheckCircle, CircleX as FiXCircle, CircleAlert as FiAlertCircle, Shield as FiShield, Info as FiInfo, ArrowLeft as FiArrowLeft, X as FiX } from "lucide-react";

// ── Uncomment when backend is ready ──────────────────────────
// import authService from "../services/authService";

/* ─── PASSWORD RULES ─────────────────────────────────────────── */
const RULES = [
  { id:"len",   label:"At least 6 characters long",     test:(p)=>p.length>=6          },
  { id:"upper", label:"At least one uppercase letter",  test:(p)=>/[A-Z]/.test(p)      },
  { id:"lower", label:"At least one lowercase letter",  test:(p)=>/[a-z]/.test(p)      },
  { id:"num",   label:"At least one number",            test:(p)=>/[0-9]/.test(p)      },
  { id:"spec",  label:"At least one special character", test:(p)=>/[^A-Za-z0-9]/.test(p) },
  { id:"match", label:"Passwords must match",           test:()=>false /* dynamic */    },
];

/* ─── STRENGTH CONFIG ────────────────────────────────────────── */
function getStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6)             score++;
  if (password.length >= 12)            score++;
  if (/[A-Z]/.test(password))          score++;
  if (/[a-z]/.test(password))          score++;
  if (/[0-9]/.test(password))          score++;
  if (/[^A-Za-z0-9]/.test(password))   score++;
  if (score <= 2) return { score, label:"Weak",   color:"bg-red-500",    text:"text-red-600"    };
  if (score <= 4) return { score, label:"Fair",   color:"bg-amber-500",  text:"text-amber-600"  };
  if (score === 5) return { score, label:"Good",  color:"bg-blue-500",   text:"text-blue-600"   };
  return            { score,       label:"Strong", color:"bg-emerald-500",text:"text-emerald-600" };
}

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-xs
        ${type === "success"
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn .3s ease both" }}>
      <span className="text-lg">{type === "success" ? "✅" : "❌"}</span>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1">×</button>
    </div>
  );
}

/* ─── PASSWORD INPUT ─────────────────────────────────────────── */
function PasswordInput({ label, value, onChange, show, onToggleShow, error, id, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-extrabold text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder || ""}
          autoComplete={id === "current" ? "current-password" : "new-password"}
          className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm text-slate-700 placeholder-slate-400
            focus:outline-none focus:ring-2 transition-all bg-white
            ${error
              ? "border-red-300 focus:border-red-400 focus:ring-red-50"
              : "border-slate-200 focus:border-blue-400 focus:ring-blue-50 hover:border-slate-300"}`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          tabIndex={-1}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
          {show ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <FiAlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function ChangePassword() {
  const navigate = useNavigate();

  const [current,  setCurrent]  = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  /* live rule checks */
  const ruleResults = RULES.map(rule => ({
    ...rule,
    passed: rule.id === "match"
      ? newPass.length > 0 && newPass === confirm
      : rule.test(newPass),
  }));

  const strength = getStrength(newPass, confirm);
  const allPassed = ruleResults.every(r => r.passed);
  const passedCount = ruleResults.filter(r => r.passed).length;
  const strengthPct = Math.round((strength.score / 6) * 100);

  /* validation */
  const validate = () => {
    const e = {};
    if (!current.trim())          e.current = "Current password is required";
    if (!newPass)                  e.newPass = "New password is required";
    if (!allPassed)                e.newPass = "Password does not meet all requirements";
    if (!confirm)                  e.confirm = "Please confirm your new password";
    if (newPass && confirm && newPass !== confirm) e.confirm = "Passwords do not match";
    if (current && newPass && current === newPass)
      e.newPass = "New password must be different from current password";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      showToast("Please fix the errors below.", "error");
      return;
    }
    setSaving(true);
    try {
      // BACKEND: await authService.changePassword({ currentPassword: current, newPassword: newPass });
      await new Promise(r => setTimeout(r, 1200)); // mock

      showToast("Password changed successfully! You have been logged out of all other sessions. ✅");
      setCurrent(""); setNewPass(""); setConfirm("");
      setErrors({});
      setTimeout(() => navigate("/CompanySettings"), 2000);
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to change password. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => navigate(-1);

  /* clear errors on type */
  const handleCurrent = (v) => { setCurrent(v); setErrors(p => ({ ...p, current: "" })); };
  const handleNew     = (v) => { setNewPass(v); setErrors(p => ({ ...p, newPass: "" })); };
  const handleConfirm = (v) => { setConfirm(v); setErrors(p => ({ ...p, confirm: "" })); };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200 flex-shrink-0">
                <FiKey className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  Change Password
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Update your account security credentials
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span
                      className="hover:text-blue-600 cursor-pointer transition-colors"
                      onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Change Password</span>
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                text-sm font-bold transition-all shadow-sm">
              <FiArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* ── FORM CARD ── */}
          <div
            className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

            {/* Card header — blue gradient, matches CRM section headers */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <FiShield className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-white">Password Security</h2>
            </div>

            <div className="p-6 space-y-5">

              {/* Security notice banner — teal, matches CRM info banners */}
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl px-4 py-3 flex items-start gap-3">
                <FiInfo className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                <p className="text-sm text-white font-medium leading-relaxed">
                  <span className="font-extrabold">Security Notice:</span> Changing your password will log you out of all other devices and sessions.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">

                {/* Current Password */}
                <PasswordInput
                  id="current"
                  label="Current Password"
                  value={current}
                  onChange={e => handleCurrent(e.target.value)}
                  show={showCur}
                  onToggleShow={() => setShowCur(v => !v)}
                  error={errors.current}
                />

                {/* New Password */}
                <div className="space-y-2">
                  <PasswordInput
                    id="new"
                    label="New Password"
                    value={newPass}
                    onChange={e => handleNew(e.target.value)}
                    show={showNew}
                    onToggleShow={() => setShowNew(v => !v)}
                    error={errors.newPass}
                  />

                  {/* Strength meter — shows once user starts typing */}
                  {newPass.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Password strength</span>
                        <span className={`text-xs font-extrabold ${strength.text}`}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${strength.color}`}
                          style={{ width: `${strengthPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm New Password */}
                <PasswordInput
                  id="confirm"
                  label="Confirm New Password"
                  value={confirm}
                  onChange={e => handleConfirm(e.target.value)}
                  show={showCon}
                  onToggleShow={() => setShowCon(v => !v)}
                  error={errors.confirm}
                />

                {/* Password Requirements Checklist */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-extrabold text-slate-700 mb-3 uppercase tracking-wide">
                    Password Requirements:
                  </p>
                  <div className="space-y-2">
                    {ruleResults.map(rule => (
                      <div key={rule.id} className="flex items-center gap-2.5">
                        {rule.passed ? (
                          <FiCheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <FiXCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                        <span className={`text-sm transition-colors ${
                          rule.passed ? "text-emerald-600 font-semibold" : "text-slate-500"
                        }`}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Progress indicator */}
                  {(newPass.length > 0 || confirm.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        {passedCount} of {RULES.length} requirements met
                      </span>
                      {allPassed && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <FiCheckCircle className="w-3 h-3" /> All requirements met
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl
                      bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm
                      shadow-md shadow-blue-200 hover:shadow-lg transition-all
                      disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Changing Password…
                      </>
                    ) : (
                      <>
                        <FiKey className="w-4 h-4" /> Change Password
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3
                      rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600
                      hover:text-slate-800 font-bold text-sm transition-all bg-white hover:bg-slate-50
                      disabled:opacity-50">
                    <FiX className="w-4 h-4" /> Cancel
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* ── SECURITY TIPS CARD ── */}
          <div
            className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
            style={{ animationDelay: "100ms" }}>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0">
                <FiShield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800">Security Tips</h2>
                <p className="text-xs text-slate-400 mt-0.5">Keep your account safe</p>
              </div>
            </div>
            <div className="p-5">
              <ul className="space-y-3">
                {[
                  "Use a unique password not used on any other website",
                  "Mix uppercase, lowercase, numbers and symbols for a stronger password",
                  "Avoid using personal information like your name or birthday",
                  "Consider using a password manager to generate and store strong passwords",
                  "Never share your password with anyone, including support staff",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-extrabold
                      flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-600 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}