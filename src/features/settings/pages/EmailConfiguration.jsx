import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail as FiMail, ArrowLeft as FiArrowLeft, Save as FiSave, Eye as FiEye, EyeOff as FiEyeOff, Send as FiSend, CircleAlert as FiAlertCircle, Check as FiCheck, Info as FiInfo, ChevronDown as FiChevronDown, X as FiX, Server as FaServer, Mail as FaEnvelope, Building2 as FaBuilding, Settings as MdOutlineSettings } from "lucide-react";


import emailConfigurationService from "../api/emailConfigurationService";

/* ─── SMTP PRESETS ───────────────────────────────────────────── */
const SMTP_PRESETS = [
  {
    provider: "Gmail",
    icon: "G",
    iconBg: "bg-red-100 text-red-600",
    host: "smtp.gmail.com",
    port: "587 (TLS)",
    portValue: "587",
    encryption: "TLS",
    note: "Use App Password if 2FA enabled",
    details: [
      "Host: smtp.gmail.com",
      "Port: 587 (TLS) / 465 (SSL)",
      "Use App Password if 2FA enabled",
    ],
  },
  {
    provider: "Zoho Mail",
    icon: "Z",
    iconBg: "bg-blue-100 text-blue-600",
    host: "smtp.zoho.com",
    port: "587 (TLS)",
    portValue: "587",
    encryption: "TLS",
    note: "Username: Full email address",
    details: [
      "Host: smtp.zoho.com",
      "Port: 587 (TLS) / 465 (SSL)",
      "Username: Full email address",
    ],
  },
  {
    provider: "Outlook / Hotmail",
    icon: "O",
    iconBg: "bg-blue-100 text-blue-700",
    host: "smtp-mail.outlook.com",
    port: "587 (TLS)",
    portValue: "587",
    encryption: "TLS",
    note: "Username: Full email address",
    details: [
      "Host: smtp-mail.outlook.com",
      "Port: 587 (TLS)",
      "Username: Full email address",
    ],
  },
  {
    provider: "Yahoo Mail",
    icon: "Y",
    iconBg: "bg-purple-100 text-purple-700",
    host: "smtp.mail.yahoo.com",
    port: "587 (TLS)",
    portValue: "587",
    encryption: "TLS",
    note: "Requires App Password",
    details: [
      "Host: smtp.mail.yahoo.com",
      "Port: 587 (TLS) / 465 (SSL)",
      "Requires App Password",
    ],
  },
];

const PORT_OPTS    = ["587 (TLS)", "465 (SSL)", "25 (SMTP)", "2525 (Alt)"];
const ENC_OPTS     = ["TLS", "SSL", "None"];

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl max-w-sm
      ${type === "success"
        ? "bg-green-50 border-green-200 text-green-800"
        : type === "error"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-blue-50 border-blue-200 text-blue-800"}`}
      style={{ animation: "slideIn .3s ease both" }}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${type === "success" ? "bg-green-100" : type === "error" ? "bg-red-100" : "bg-blue-100"}`}>
        {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}
      </div>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg ml-1 flex-shrink-0">
        <FiX className="w-4 h-4"/>
      </button>
    </div>
  );
}

/* ─── TEST EMAIL MODAL ───────────────────────────────────────── */
function TestEmailModal({ onClose, onSend }) {
  const [testEmail,  setTestEmail]  = useState("");
  const [sending,    setSending]    = useState(false);
  const [result,     setResult]     = useState(null); // "success" | "error"
  const [resultMsg,  setResultMsg]  = useState("");

  const handleSend = async () => {
    if (!testEmail.trim() || !/\S+@\S+\.\S+/.test(testEmail)) {
      setResult("error"); setResultMsg("Please enter a valid email address."); return;
    }
    setSending(true); setResult(null);
    try {
      const res  = await onSend(testEmail);         // parent → emailConfigurationService.testEmail
      const data = res?.data?.data;                 // unwrap ApiResponse envelope
      if (data?.success) {
        setResult("success");
        setResultMsg(data.message || `Test email successfully sent to ${testEmail}`);
      } else {
        setResult("error");
        setResultMsg(data?.message || "Failed to send test email. Check your SMTP configuration.");
      }
    } catch (err) {
      setResult("error");
      setResultMsg(err?.response?.data?.message || "Failed to send test email. Check your SMTP configuration.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10"
        style={{ animation: "popIn .25s ease both" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-5 rounded-t-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <FiSend className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="text-white font-extrabold text-base">Send Test Email</h2>
              <p className="text-white/70 text-xs mt-0.5">Verify your SMTP configuration</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all">
            <FiX className="w-4 h-4"/>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wide mb-1.5">
              Recipient Email Address
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={e => { setTestEmail(e.target.value); setResult(null); }}
              placeholder="test@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm
                text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2
                focus:ring-blue-50 outline-none transition-all hover:border-slate-300"/>
          </div>

          {/* Result feedback */}
          {result && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border
              ${result === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"}`}
              style={{ animation: "fadeUp .3s ease both" }}>
              {result === "success"
                ? <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                : <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>}
              <p className="text-sm font-medium">{resultMsg}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300
                text-slate-600 font-bold text-sm transition-all bg-white hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleSend} disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
                text-white font-bold text-sm shadow-md shadow-blue-200 transition-all disabled:opacity-60">
              {sending
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                : <FiSend className="w-4 h-4"/>}
              {sending ? "Sending…" : "Send Test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FORM FIELD COMPONENTS ──────────────────────────────────── */
function FieldLabel({ label, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="text-sm font-extrabold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1.5">
      <FiAlertCircle className="w-3 h-3 flex-shrink-0"/>{msg}
    </p>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function EmailConfiguration() {
  const navigate = useNavigate();

  /* form state */
  const [form, setForm] = useState({
    smtpHost:     "",
    smtpPort:     "587 (TLS)",
    encryption:   "TLS",
    username:     "",
    password:     "",
    fromEmail:    "",
    fromName:     "",
    signature:    "",
  });
  const [showPass,     setShowPass]    = useState(false);
  const [errs,         setErrs]        = useState({});
  const [saving,       setSaving]      = useState(false);
  const [showTestModal,setTestModal]   = useState(false);
  const [toast,        setToast]       = useState(null);
  const [isConfigured, setIsConfigured]= useState(false);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  /* load existing config on mount — masked password shown as "••••••••" when one is stored */
  useEffect(() => {
    emailConfigurationService.getConfig()
      .then(res => {
        const d = res?.data?.data;
        if (!d) return;
        setForm(p => ({
          ...p,
          smtpHost:   d.smtpHost   || "",
          smtpPort:   d.smtpPort   || "587 (TLS)",
          encryption: d.encryption || "TLS",
          username:   d.username   || "",
          password:   d.passwordSet ? "••••••••" : "",
          fromEmail:  d.fromEmail  || "",
          fromName:   d.fromName   || "",
          signature:  d.signature  || "",
        }));
        setIsConfigured(!!d.configured);
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrs(p => ({ ...p, [k]: "" }));
  };

  /* preset quick-fill */
  const applyPreset = (preset) => {
    setForm(p => ({
      ...p,
      smtpHost:   preset.host,
      smtpPort:   preset.port,
      encryption: preset.encryption,
    }));
    setErrs({});
    showToast(`${preset.provider} settings applied.`, "info");
  };

  /* validation */
  const validate = () => {
    const e = {};
    if (!form.smtpHost.trim())  e.smtpHost  = "SMTP Host is required";
    if (!form.username.trim())  e.username  = "Username is required";
    if (!form.password.trim())  e.password  = "Password is required";
    if (!form.fromEmail.trim()) e.fromEmail = "From Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.fromEmail))
                                e.fromEmail = "Enter a valid email address";
    if (!form.fromName.trim())  e.fromName  = "From Name is required";
    return e;
  };

  /* save */
  const handleSave = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrs(v); showToast("Fix the errors below.", "error"); return; }
    setSaving(true);
    try {
      // if the password still shows the masked placeholder, the user didn't change it
      const passwordChanged = form.password !== "••••••••";
      const res  = await emailConfigurationService.saveConfig({ ...form, passwordChanged });
      const data = res?.data?.data;
      setIsConfigured(true);
      showToast(data?.message || "Email configuration saved successfully! ✅");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (err) =>
    `w-full px-4 py-3 rounded-xl border text-sm text-slate-700 placeholder-slate-400
     focus:outline-none focus:ring-2 transition-all bg-white
     ${err
       ? "border-red-300 focus:border-red-400 focus:ring-red-50"
       : "border-slate-200 focus:border-blue-400 focus:ring-blue-50 hover:border-slate-300"}`;

  const selectCls = (err) =>
    `w-full px-4 py-3 rounded-xl border text-sm text-slate-700 cursor-pointer
     focus:outline-none focus:ring-2 transition-all bg-white appearance-none
     ${err
       ? "border-red-300 focus:border-red-400 focus:ring-red-50"
       : "border-slate-200 focus:border-blue-400 focus:ring-blue-50 hover:border-slate-300"}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
        .fade-up { animation: fadeUp .45s ease both; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9;border-radius:99px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
      {showTestModal && (
        <TestEmailModal
          onClose={() => setTestModal(false)}
          onSend={(email) => emailConfigurationService.testEmail(email)}
        />
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500
                flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                <FiMail className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  Email Configuration
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Configure SMTP settings for email delivery
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/CompanySettings")}>Settings</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-blue-600 font-bold">Email Configuration</span>
                  </span>
                </p>
              </div>
            </div>
            <button onClick={() => navigate("/CompanySettings")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600
                text-sm font-bold transition-all shadow-sm">
              <FiArrowLeft className="w-4 h-4"/> Back to Settings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* ══════════════════════════════════════
              LEFT — SMTP CONFIGURATION FORM
          ══════════════════════════════════════ */}
          <form onSubmit={handleSave} noValidate>
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

              {/* Form card header — blue gradient matching screenshot */}
              <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <FaServer className="w-4 h-4"/>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">SMTP Configuration</h2>
                  <p className="text-white/70 text-xs mt-0.5">Set up your outgoing mail server</p>
                </div>
                {/* Status indicator */}
                <div className="ml-auto flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
                  <div className={`w-2 h-2 rounded-full ${isConfigured ? "bg-green-300" : "bg-amber-300 animate-pulse"}`}/>
                  <span className="text-white/80 text-xs font-bold">{isConfigured ? "Configured" : "Not Configured"}</span>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* SMTP Host */}
                <div>
                  <FieldLabel
                    label="SMTP Host"
                    required
                    hint="Your email provider's SMTP server address"
                  />
                  <div className="relative">
                    <input
                      type="text"
                      value={form.smtpHost}
                      onChange={e => set("smtpHost", e.target.value)}
                      placeholder="e.g., smtp.gmail.com, smtp.zoho.com"
                      className={inputCls(errs.smtpHost)}
                    />
                    {form.smtpHost && (
                      <FiCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500"/>
                    )}
                  </div>
                  <FieldError msg={errs.smtpHost}/>
                </div>

                {/* SMTP Port + Encryption — 2 cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="SMTP Port" required/>
                    <div className="relative">
                      <select
                        value={form.smtpPort}
                        onChange={e => set("smtpPort", e.target.value)}
                        className={selectCls(errs.smtpPort) + " pr-10"}>
                        {PORT_OPTS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                  </div>
                  <div>
                    <FieldLabel label="Encryption" required/>
                    <div className="relative">
                      <select
                        value={form.encryption}
                        onChange={e => set("encryption", e.target.value)}
                        className={selectCls(errs.encryption) + " pr-10"}>
                        {ENC_OPTS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                  </div>
                </div>

                {/* Username + Password — 2 cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="Username / Email" required hint="Usually your full email address"/>
                    <input
                      type="text"
                      value={form.username}
                      onChange={e => set("username", e.target.value)}
                      placeholder="your@email.com"
                      className={inputCls(errs.username)}
                    />
                    <FieldError msg={errs.username}/>
                  </div>
                  <div>
                    <FieldLabel label="Password" required hint="Use App Password for Gmail / 2FA accounts"/>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={e => set("password", e.target.value)}
                        placeholder="Your SMTP password"
                        className={inputCls(errs.password) + " pr-12"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                        {showPass ? <FiEyeOff className="w-4 h-4"/> : <FiEye className="w-4 h-4"/>}
                      </button>
                    </div>
                    <FieldError msg={errs.password}/>
                  </div>
                </div>

                {/* From Email + From Name — 2 cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="From Email Address" required/>
                    <div className="relative">
                      <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                      <input
                        type="email"
                        value={form.fromEmail}
                        onChange={e => set("fromEmail", e.target.value)}
                        placeholder="noreply@yourcompany.com"
                        className={inputCls(errs.fromEmail) + " pl-10"}
                      />
                    </div>
                    <FieldError msg={errs.fromEmail}/>
                  </div>
                  <div>
                    <FieldLabel label="From Name" required/>
                    <div className="relative">
                      <FaBuilding className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                      <input
                        type="text"
                        value={form.fromName}
                        onChange={e => set("fromName", e.target.value)}
                        placeholder="Your Company Name"
                        className={inputCls(errs.fromName) + " pl-10"}
                      />
                    </div>
                    <FieldError msg={errs.fromName}/>
                  </div>
                </div>

                {/* Signature — full width on purpose. Three or four lines squeezed into half a
                    column is something nobody proofreads before it goes out on every reply. */}
                <div>
                  <FieldLabel label="Email Signature"/>
                  <textarea
                    value={form.signature}
                    onChange={e => set("signature", e.target.value)}
                    rows={4}
                    placeholder={"Priya Sharma\nWanderVista Holidays\n+91 00000 00000"}
                    className={inputCls(null) + " resize-y leading-relaxed"}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    Added to the Mailbox composer when you write a message — you can edit or remove
                    it on any individual email. It is not attached automatically on send.
                  </p>
                </div>

                {/* Info note */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <FiInfo className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-extrabold">Security tip:</span> For Gmail, create an App Password at
                    {" "}<span className="font-bold">myaccount.google.com → Security → App Passwords</span>.
                    Never use your regular account password.
                  </p>
                </div>

                {/* ── ACTION BUTTONS ── */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-100">
                  {/* Save */}
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl
                      bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
                      text-white font-bold text-sm shadow-md shadow-blue-200 transition-all
                      disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]">
                    {saving
                      ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                      : <FiSave className="w-4 h-4"/>}
                    {saving ? "Saving…" : "Save Configuration"}
                  </button>

                  {/* Test Email */}
                  <button
                    type="button"
                    onClick={() => setTestModal(true)}
                    className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl
                      bg-slate-600 hover:bg-slate-700 text-white font-bold text-sm
                      shadow-md shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    <FiSend className="w-4 h-4"/> Test Email
                  </button>

                  {/* Back */}
                  <button
                    type="button"
                    onClick={() => navigate("/CompanySettings")}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl
                      border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50
                      text-slate-600 font-bold text-sm transition-all">
                    <FiArrowLeft className="w-4 h-4"/> Back to Settings
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* ══════════════════════════════════════
              RIGHT — COMMON SMTP SETTINGS SIDEBAR
          ══════════════════════════════════════ */}
          <div className="space-y-4 fade-up" style={{ animationDelay: "80ms" }}>

            {/* Common SMTP Settings card */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              {/* Teal header — matches screenshot */}
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <MdOutlineSettings className="w-4 h-4"/>
                </div>
                <h3 className="text-sm font-extrabold text-white">Common SMTP Settings</h3>
              </div>

              <div className="p-5 space-y-3">
                {SMTP_PRESETS.map((preset, idx) => (
                  <div key={preset.provider}
                    className="group border border-slate-100 hover:border-blue-200 rounded-2xl
                      p-4 transition-all duration-200 hover:bg-blue-50/30 cursor-pointer"
                    style={{ animation: "fadeUp .4s ease both", animationDelay: `${idx * 60 + 120}ms` }}
                    onClick={() => applyPreset(preset)}>
                    <div className="flex items-start gap-3">
                      {/* Provider initial avatar */}
                      <div className={`w-8 h-8 rounded-xl font-extrabold text-sm
                        flex items-center justify-center flex-shrink-0 ${preset.iconBg}`}>
                        {preset.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-slate-800 group-hover:text-blue-700 transition-colors">
                          {preset.provider}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {preset.details.map(d => (
                            <li key={d} className="text-xs text-slate-500 leading-relaxed">{d}</li>
                          ))}
                        </ul>
                      </div>
                      {/* Apply arrow */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                          <FiArrowLeft className="w-3.5 h-3.5 text-blue-600 rotate-180"/>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 ml-11">
                      <span className="text-[10px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to auto-fill →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security tips card */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden"
              style={{ animation: "fadeUp .45s ease both", animationDelay: "300ms" }}>
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-white text-sm">
                  🔐
                </div>
                <h3 className="text-sm font-extrabold text-white">Security Tips</h3>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { icon:"🔑", tip:"Use App Passwords instead of your real account password." },
                  { icon:"🔒", tip:"Always use TLS or SSL encryption — never plain SMTP." },
                  { icon:"📧", tip:"Use a dedicated sending address like noreply@yourdomain.com." },
                  { icon:"🧪", tip:"Click Test Email to verify settings before going live." },
                ].map(({ icon, tip }) => (
                  <div key={tip} className="flex items-start gap-2.5">
                    <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                    <p className="text-xs text-slate-500 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}