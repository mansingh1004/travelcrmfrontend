import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft as FiArrowLeft, Save as FiSave, Eye as FiEye, EyeOff as FiEyeOff, CircleAlert as FiAlertCircle, Check as FiCheck, Info as FiInfo, X as FiX, Send as FiSend, ExternalLink as FiExternalLink, Copy as FaCopy, Key as FaKey, FileText as FaFileAlt, Globe as FaGlobe, Image as FaImage, Phone as FaPhone, CircleCheck as FaCheckCircle, List as FaListUl, Blocks as MdOutlineIntegrationInstructions } from "lucide-react";
import { WhatsAppIcon as FaWhatsapp } from "@shared/ui/WhatsAppIcon";


import whatsAppConfigService from "../api/whatsAppConfigService";

/* ─── PROVIDERS ──────────────────────────────────────────────────
   Two ways the same WhatsApp number can be reached, and they are onboarded
   completely differently — so every label, hint and link on this page is
   provider-specific rather than one set of Interakt wording with extra
   fields bolted on. A tenant on Meta who reads "find this in your Interakt
   dashboard" has been sent to an account they do not have.

   The key names match the backend vocabulary (tenant_settings.wa_provider).
──────────────────────────────────────────────────────────────── */
const INTERAKT = "INTERAKT";
const META_CLOUD = "META_CLOUD";

const PROVIDERS = [
  {
    key: INTERAKT,
    name: "Interakt",
    tag: "Easiest to start",
    blurb: "A WhatsApp partner (BSP). One API key, set up in a day.",
  },
  {
    key: META_CLOUD,
    name: "Meta Cloud API",
    tag: "Direct, no middleman",
    blurb: "Talk to Meta directly. Cheaper per message and supports free-text replies, but needs your own Meta app.",
  },
];

/* ─── SETUP GUIDE STEPS ──────────────────────────────────────── */
const SETUP_STEPS = {
  [INTERAKT]: [
    {
      step: 1,
      title: "Create Interakt Account",
      desc: "Sign up at interakt.shop and complete business verification.",
      icon: <FaGlobe className="w-4 h-4"/>,
      color: "from-blue-500 to-blue-600",
    },
    {
      step: 2,
      title: "Get API Key",
      desc: "Go to Developer Settings in your Interakt dashboard.",
      icon: <FaKey className="w-4 h-4"/>,
      color: "from-purple-500 to-purple-600",
    },
    {
      step: 3,
      title: "Create Template",
      desc: "Create a WhatsApp-approved message template for quotations.",
      icon: <FaFileAlt className="w-4 h-4"/>,
      color: "from-amber-500 to-amber-600",
    },
    {
      step: 4,
      title: "Save & Test",
      desc: "Enter your settings below, save, and send a test message.",
      icon: <FaCheckCircle className="w-4 h-4"/>,
      color: "from-green-500 to-green-600",
    },
  ],
  [META_CLOUD]: [
    {
      step: 1,
      title: "Verify Your Business",
      desc: "In Meta Business Manager, complete Business Verification (GST certificate + address proof).",
      icon: <FaGlobe className="w-4 h-4"/>,
      color: "from-blue-500 to-blue-600",
    },
    {
      step: 2,
      title: "Add WhatsApp to a Meta App",
      desc: "Create a Business-type app, add the WhatsApp product, and register your number.",
      icon: <MdOutlineIntegrationInstructions className="w-4 h-4"/>,
      color: "from-indigo-500 to-indigo-600",
    },
    {
      step: 3,
      title: "Create a Permanent Token",
      desc: "Add a System User with the WhatsApp permissions, then generate a token that does not expire.",
      icon: <FaKey className="w-4 h-4"/>,
      color: "from-purple-500 to-purple-600",
    },
    {
      step: 4,
      title: "Copy the Three Values",
      desc: "Access token, Phone Number ID and WABA ID — all on the API Setup screen. Paste them below and test.",
      icon: <FaCheckCircle className="w-4 h-4"/>,
      color: "from-green-500 to-green-600",
    },
  ],
};

const LANG_OPTIONS = [
  { code: "en", label: "English (en)" },
  { code: "hi", label: "Hindi (hi)" },
  { code: "es", label: "Spanish (es)" },
  { code: "pt_BR", label: "Portuguese Brazil (pt_BR)" },
  { code: "id", label: "Indonesian (id)" },
];

/* ─── TOAST ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl max-w-sm
      ${type === "success" ? "bg-green-50 border-green-200 text-green-800"
      : type === "error"   ? "bg-red-50 border-red-200 text-red-800"
      : "bg-blue-50 border-blue-200 text-blue-800"}`}
      style={{ animation: "slideIn .3s ease both" }}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${type === "success" ? "bg-green-100" : type === "error" ? "bg-red-100" : "bg-blue-100"}`}>
        {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}
      </div>
      <p className="text-sm font-semibold flex-1">{msg}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 ml-1 flex-shrink-0">
        <FiX className="w-4 h-4"/>
      </button>
    </div>
  );
}

/* ─── FIELD LABEL ────────────────────────────────────────────── */
function FieldLabel({ label, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="text-sm font-extrabold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{hint}</p>}
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
export default function WhatsAppConfiguration() {
  const navigate = useNavigate();

  /* form state */
  const [form, setForm] = useState({
    // One credential slot for both providers: the Interakt API key, or the Meta access token.
    apiKey:            "",
    templateName:      "",
    templateLanguage:  "en",
    headerImageUrl:    "",
    provider:          INTERAKT,
    phoneNumberId:     "",
    businessAccountId: "",
  });
  const isMeta = form.provider === META_CLOUD;
  const [showApiKey,  setShowApiKey]  = useState(false);
  const [errs,        setErrs]        = useState({});
  const [saving,      setSaving]      = useState(false);

  /* test section */
  const [testPhone,   setTestPhone]   = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult,  setTestResult]  = useState(null); // {type, msg}

  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  /* integration stats for the sidebar (null → show placeholders) */
  const [stats, setStats] = useState(null);
  const refreshStats = useCallback(() => {
    whatsAppConfigService.getStats()
      .then(res => setStats(res?.data?.data || null))
      .catch(() => {});
  }, []);

  /* load existing config + stats on mount — masked API key shown as "••••••••" when stored */
  useEffect(() => {
    whatsAppConfigService.getConfig()
      .then(res => {
        const d = res?.data?.data;
        if (!d) return;
        setForm(p => ({
          ...p,
          apiKey:            d.apiKeySet ? "••••••••" : "",
          templateName:      d.templateName     || "",
          templateLanguage:  d.templateLanguage || "en",
          headerImageUrl:    d.headerImageUrl   || "",
          // The backend answers with the provider actually IN EFFECT — a tenant who never chose one
          // is on the server default, so this is never blank and the toggle always shows the truth.
          provider:          d.provider === META_CLOUD ? META_CLOUD : INTERAKT,
          phoneNumberId:     d.phoneNumberId     || "",
          businessAccountId: d.businessAccountId || "",
        }));
      })
      .catch(() => {});
    refreshStats();
  }, [refreshStats]);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrs(p => ({ ...p, [k]: "" }));
  };

  /* where this provider's credentials actually live */
  const credentialUrl = isMeta
    ? "https://business.facebook.com/wa/manage/home/"
    : "https://app.interakt.ai/settings/developer-settings";

  /* copy API key hint URL */
  const handleCopyHintUrl = () => {
    navigator.clipboard.writeText(credentialUrl).catch(() => {});
    showToast("Dashboard URL copied to clipboard.", "info");
  };

  /* switching provider clears the stored secret from the box, deliberately.
     An Interakt API key left sitting in the field while "Meta Cloud API" is selected would be saved
     as a Meta access token and fail on the first send with an authentication error that points
     nowhere near the real cause. */
  const switchProvider = (key) => {
    if (key === form.provider) return;
    setForm(p => ({ ...p, provider: key, apiKey: "" }));
    setErrs({});
  };

  /* validation */
  const validate = () => {
    const e = {};
    if (!form.apiKey.trim())           e.apiKey           = isMeta ? "Access Token is required" : "API Key is required";
    if (!form.templateName.trim())     e.templateName     = "Template Name is required";
    if (!form.templateLanguage.trim()) e.templateLanguage = "Template Language is required";
    // Caught here rather than at send time on purpose: without it the first failure is a Graph 400
    // on a real customer message, which reads as "WhatsApp is broken" instead of "one field is blank".
    if (isMeta && !form.phoneNumberId.trim()) {
      e.phoneNumberId = "Phone Number ID is required for Meta Cloud API";
    }
    return e;
  };

  /* save */
  const handleSave = async (ev) => {
    ev.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrs(v); showToast("Fix the errors below.", "error"); return; }
    setSaving(true);
    try {
      // if the API key still shows the masked placeholder, the user didn't change it
      const apiKeyChanged = form.apiKey !== "••••••••";
      const res  = await whatsAppConfigService.saveConfig({ ...form, apiKeyChanged });
      const data = res?.data?.data;
      showToast(data?.message || "WhatsApp configuration saved successfully! ✅");
      refreshStats();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* test send */
  const handleTestSend = async () => {
    if (!testPhone.trim() || testPhone.replace(/\D/g, "").length !== 10) {
      setTestResult({ type: "error", msg: "Enter a valid 10-digit phone number." });
      return;
    }
    setTestSending(true); setTestResult(null);
    try {
      const res  = await whatsAppConfigService.sendTestMessage(testPhone);
      const data = res?.data?.data;
      if (data?.success) {
        setTestResult({ type: "success", msg: data.message || `Test message sent successfully to +91${testPhone}` });
        refreshStats();
      } else {
        setTestResult({ type: "error", msg: data?.message || "Failed to send test message. Check your API key and template." });
      }
    } catch (err) {
      setTestResult({ type: "error", msg: err?.response?.data?.message || "Failed to send test message. Check your API key and template." });
    } finally {
      setTestSending(false);
    }
  };

  const inputCls = (err) =>
    `w-full px-4 py-3 rounded-xl border text-sm text-slate-700 placeholder-slate-400
     focus:outline-none focus:ring-2 transition-all bg-white
     ${err
       ? "border-red-300 focus:border-red-400 focus:ring-red-50"
       : "border-slate-200 focus:border-green-400 focus:ring-green-50 hover:border-slate-300"}`;

  const steps = SETUP_STEPS[form.provider] || SETUP_STEPS[INTERAKT];

  const isConfigured = form.apiKey.trim().length > 0
    && form.templateName.trim().length > 0
    // On Meta the token alone cannot send anything — the Phone Number ID is half the address.
    && (!isMeta || form.phoneNumberId.trim().length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/20 to-slate-100"
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

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600
                flex items-center justify-center text-white shadow-lg shadow-green-200 flex-shrink-0">
                <FaWhatsapp className="w-6 h-6"/>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  WhatsApp Configuration
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {isMeta ? "Meta Cloud API Integration" : "Interakt Business API Integration"}
                  <span className="hidden sm:inline ml-3 text-slate-300">|</span>
                  <span className="hidden sm:inline ml-3 text-xs">
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/")}>Home</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate("/CompanySettings")}>Settings</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-green-600 font-bold">WhatsApp Configuration</span>
                  </span>
                </p>
              </div>
            </div>
            <button onClick={() => navigate("/CompanySettings")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
                hover:border-green-300 bg-white hover:bg-green-50 text-slate-600 hover:text-green-700
                text-sm font-bold transition-all shadow-sm">
              <FiArrowLeft className="w-4 h-4"/> Back to Settings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* ══════════════════════════════════════
              LEFT — MAIN CONFIGURATION FORM
          ══════════════════════════════════════ */}
          <div className="space-y-5">

            {/* ── INTEGRATION SETTINGS CARD ── */}
            <form onSubmit={handleSave} noValidate>
              <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up">

                {/* Card header — green gradient */}
                <div className="bg-gradient-to-r from-green-500 via-green-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                      <MdOutlineIntegrationInstructions className="w-5 h-5"/>
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white">WhatsApp Integration Settings</h2>
                      <p className="text-white/70 text-xs mt-0.5">
                        {isMeta ? "Direct on Meta WhatsApp Cloud API" : "Powered by Interakt Business API"}
                      </p>
                    </div>
                  </div>
                  {/* Status badge */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold
                    ${isConfigured ? "bg-white/30 text-white" : "bg-white/20 text-white/80"}`}>
                    <div className={`w-2 h-2 rounded-full ${isConfigured ? "bg-green-200 animate-pulse" : "bg-amber-300 animate-pulse"}`}/>
                    {isConfigured ? "Configured" : "Not Configured"}
                  </div>
                </div>

                <div className="p-6 space-y-5">

                  {/* ── PROVIDER CHOICE ──
                      First, because everything below it changes meaning depending on the answer. */}
                  <div>
                    <FieldLabel
                      label="How do you connect to WhatsApp?"
                      required
                      hint="Both send from the same WhatsApp number. The difference is who you get your credentials from."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PROVIDERS.map(p => {
                        const active = form.provider === p.key;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => switchProvider(p.key)}
                            className={`text-left p-4 rounded-2xl border-2 transition-all
                              ${active
                                ? "border-green-500 bg-green-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                ${active ? "border-green-500" : "border-slate-300"}`}>
                                {active && <div className="w-2 h-2 rounded-full bg-green-500"/>}
                              </div>
                              <span className={`text-sm font-extrabold ${active ? "text-green-800" : "text-slate-700"}`}>
                                {p.name}
                              </span>
                              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full
                                ${active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                                {p.tag}
                              </span>
                            </div>
                            <p className={`text-xs mt-1.5 leading-relaxed ${active ? "text-green-700" : "text-slate-400"}`}>
                              {p.blurb}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Provider banner */}
                  <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <FaWhatsapp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-green-800">
                        {isMeta ? "WhatsApp Integration Settings (Meta Cloud API)"
                                : "WhatsApp Integration Settings (Interakt)"}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        {isMeta
                          ? "Send quotations, confirmations and updates straight from Meta — no partner in between. You will need your own Meta app and a verified business."
                          : "Connect your Interakt account to send quotations, confirmations, and updates via WhatsApp Business API."}
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => window.open(isMeta ? "https://business.facebook.com/wa/manage/home/" : "https://interakt.shop", "_blank")}
                      className="flex items-center gap-1 text-xs font-bold text-green-700 hover:underline flex-shrink-0">
                      Visit <FiExternalLink className="w-3 h-3"/>
                    </button>
                  </div>

                  {/* API Key / Access Token — one stored credential, named for the provider in use */}
                  <div>
                    <FieldLabel
                      label={isMeta ? "Access Token" : "API Key"}
                      required
                      hint={isMeta
                        ? "The permanent System User token from your Meta app. A temporary token from the API Setup screen expires in 24 hours and will stop your messages overnight."
                        : "You can find this in your Interakt Dashboard under Developer Settings"}
                    />
                    <div className="relative">
                      <FaKey className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={form.apiKey}
                        onChange={e => set("apiKey", e.target.value)}
                        placeholder={isMeta ? "Paste your permanent access token" : "Enter your Interakt API key"}
                        className={inputCls(errs.apiKey) + " pl-10 pr-20"}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {/* Copy hint URL */}
                        <button type="button" onClick={handleCopyHintUrl}
                          title={isMeta ? "Copy WhatsApp Manager URL" : "Copy Interakt Dashboard URL"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all">
                          <FaCopy className="w-3.5 h-3.5"/>
                        </button>
                        {/* Show/hide */}
                        <button type="button" onClick={() => setShowApiKey(v => !v)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                          {showApiKey ? <FiEyeOff className="w-4 h-4"/> : <FiEye className="w-4 h-4"/>}
                        </button>
                      </div>
                    </div>
                    <FieldError msg={errs.apiKey}/>
                    <button type="button"
                      onClick={() => window.open(credentialUrl, "_blank")}
                      className="mt-1.5 text-xs text-green-600 font-semibold hover:underline flex items-center gap-1">
                      {isMeta ? "Open Meta WhatsApp Manager" : "Open Interakt Developer Settings"} <FiExternalLink className="w-3 h-3"/>
                    </button>
                  </div>

                  {/* ── META-ONLY IDENTIFIERS ──
                      Hidden on the Interakt path rather than disabled: they mean nothing there, and a
                      greyed-out box still reads as "something I have not filled in". */}
                  {isMeta && (
                    <>
                      <div>
                        <FieldLabel
                          label="Phone Number ID"
                          required
                          hint="NOT your phone number — the numeric id shown next to it on Meta's API Setup screen."
                        />
                        <div className="relative">
                          <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                          <input
                            type="text"
                            value={form.phoneNumberId}
                            onChange={e => set("phoneNumberId", e.target.value)}
                            placeholder="e.g., 109876543210987"
                            className={inputCls(errs.phoneNumberId) + " pl-10"}
                          />
                        </div>
                        <FieldError msg={errs.phoneNumberId}/>
                      </div>

                      <div>
                        <FieldLabel
                          label="WhatsApp Business Account ID"
                          hint="Your WABA id, on the same screen. Not needed to send — it is used for managing templates later."
                        />
                        <div className="relative">
                          <FaListUl className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                          <input
                            type="text"
                            value={form.businessAccountId}
                            onChange={e => set("businessAccountId", e.target.value)}
                            placeholder="e.g., 102938475610293"
                            className={inputCls(false) + " pl-10"}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Template Name */}
                  <div>
                    <FieldLabel
                      label="Template Name"
                      required
                      hint="The name of your approved WhatsApp template for sending quotations"
                    />
                    <div className="relative">
                      <FaFileAlt className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                      <input
                        type="text"
                        value={form.templateName}
                        onChange={e => set("templateName", e.target.value)}
                        placeholder="e.g., quotation_template"
                        className={inputCls(errs.templateName) + " pl-10"}
                      />
                    </div>
                    <FieldError msg={errs.templateName}/>
                  </div>

                  {/* Template Language */}
                  <div>
                    <FieldLabel
                      label="Template Language"
                      required
                      hint="Language code (e.g., en, es, hi)"
                    />
                    <div className="relative">
                      <FaGlobe className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10"/>
                      <select
                        value={form.templateLanguage}
                        onChange={e => set("templateLanguage", e.target.value)}
                        className={inputCls(errs.templateLanguage) + " pl-10 pr-10 appearance-none cursor-pointer"}>
                        {LANG_OPTIONS.map(l => (
                          <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                      </select>
                      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                    <FieldError msg={errs.templateLanguage}/>
                  </div>

                  {/* Header Image URL */}
                  <div>
                    <FieldLabel
                      label="Header Image URL"
                      hint="URL for the header image (if your template has a media header)"
                    />
                    <div className="relative">
                      <FaImage className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                      <input
                        type="url"
                        value={form.headerImageUrl}
                        onChange={e => set("headerImageUrl", e.target.value)}
                        placeholder="https://yoursite.com/images/header.jpg"
                        className={inputCls(false) + " pl-10"}
                      />
                    </div>
                  </div>

                  {/* Template Format Information — blue left border panel */}
                  <div className="border-l-4 border-blue-500 bg-blue-50 rounded-r-2xl p-4 space-y-2">
                    <p className="text-sm font-extrabold text-blue-800 flex items-center gap-2">
                      <FiInfo className="w-4 h-4 flex-shrink-0"/>
                      Template Format Information
                    </p>
                    <p className="text-xs text-blue-700 font-medium">
                      Your WhatsApp template should have:
                    </p>
                    <ul className="space-y-1 ml-1">
                      {[
                        <>A variable for client name <code className="bg-blue-200 text-blue-800 px-1 rounded text-[10px] font-bold">{"{{1}}"}</code> in the body</>,
                        <>At least one button with a dynamic URL <code className="bg-blue-200 text-blue-800 px-1 rounded text-[10px] font-bold">{"{{1}}"}</code> (required by your template)</>,
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"/>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 p-3 bg-blue-100 rounded-xl border border-blue-200">
                      <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
                        <span className="font-extrabold text-blue-800">Example template body:</span>{" "}
                        <span className="italic">"Hello {`{{1}}`}, your travel quotation is ready! Click the button below to view it."</span>
                      </p>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center justify-center gap-2.5 px-7 py-3 rounded-2xl
                        bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700
                        text-white font-bold text-sm shadow-md shadow-green-200 transition-all
                        disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]">
                      {saving
                        ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                        : <FiSave className="w-4 h-4"/>}
                      {saving ? "Saving…" : "Save Configuration"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* ── TEST WHATSAPP INTEGRATION CARD ── */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
              style={{ animationDelay: "80ms" }}>

              {/* Card header — teal gradient */}
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <FiSend className="w-4 h-4"/>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">Test WhatsApp Integration</h2>
                  <p className="text-white/70 text-xs mt-0.5">Send a test message to verify your configuration</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Phone Number with +91 prefix */}
                <div>
                  <FieldLabel
                    label="Phone Number"
                    hint="Enter a 10-digit Indian phone number. The country code +91 will be added automatically."
                  />
                  <div className="flex gap-0">
                    {/* +91 prefix block */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border border-slate-200
                      border-r-0 rounded-l-xl text-sm font-extrabold text-slate-600 flex-shrink-0">
                      <FaPhone className="w-3 h-3 text-slate-500"/>
                      +91
                    </div>
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setTestPhone(v);
                        setTestResult(null);
                      }}
                      placeholder="Enter only the 10-digit number (without country code)"
                      className="flex-1 px-4 py-3 rounded-r-xl border border-slate-200 bg-white text-sm
                        text-slate-700 placeholder-slate-400 focus:border-green-400 focus:ring-2
                        focus:ring-green-50 outline-none transition-all hover:border-slate-300"
                    />
                  </div>
                  {/* Phone length indicator */}
                  {testPhone.length > 0 && (
                    <p className={`mt-1.5 text-xs flex items-center gap-1.5 font-medium
                      ${testPhone.length === 10 ? "text-green-600" : "text-amber-600"}`}>
                      {testPhone.length === 10
                        ? <><FiCheck className="w-3 h-3"/> Valid phone number</>
                        : <><FiAlertCircle className="w-3 h-3"/> {testPhone.length}/10 digits entered</>}
                    </p>
                  )}
                </div>

                {/* Test result feedback */}
                {testResult && (
                  <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border
                    ${testResult.type === "success"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-700"}`}
                    style={{ animation: "fadeUp .3s ease both" }}>
                    {testResult.type === "success"
                      ? <FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                      : <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>}
                    <p className="text-sm font-medium">{testResult.msg}</p>
                  </div>
                )}

                {/* Send Test Message button */}
                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={testSending || !isConfigured}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-2xl
                    bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600
                    text-white font-bold text-sm shadow-md shadow-teal-200 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]">
                  {testSending
                    ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                    : <FiSend className="w-4 h-4"/>}
                  {testSending ? "Sending…" : "Send Test Message"}
                </button>
                {!isConfigured && (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <FiAlertCircle className="w-3 h-3 flex-shrink-0"/>
                    Save your API Key and Template Name above before testing.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              RIGHT SIDEBAR
          ══════════════════════════════════════ */}
          <div className="space-y-5">

            {/* Setup Guide card */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
              style={{ animationDelay: "100ms" }}>
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <FaListUl className="w-4 h-4"/>
                </div>
                <h3 className="text-sm font-extrabold text-white">Setup Guide</h3>
              </div>
              <div className="p-5 space-y-4">
                {steps.map((s, i) => (
                  <div key={s.step}
                    className="flex items-start gap-3 group"
                    style={{ animation: "fadeUp .4s ease both", animationDelay: `${i * 70 + 150}ms` }}>
                    {/* Step circle with gradient */}
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color}
                      flex items-center justify-center text-white flex-shrink-0
                      group-hover:scale-110 transition-transform duration-200`}>
                      {s.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Step {s.step}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-800 leading-snug">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                    {/* connector line (except last) */}
                    {i < steps.length - 1 && (
                      <div className="absolute ml-4 mt-9 w-px h-3 bg-slate-200"/>
                    )}
                  </div>
                ))}
                {/* CTA */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => window.open(
                      isMeta ? "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                             : "https://interakt.shop", "_blank")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                      bg-gradient-to-r from-indigo-600 to-purple-600
                      text-white text-xs font-bold transition-all hover:opacity-90">
                    <FaWhatsapp className="w-3.5 h-3.5"/>
                    {isMeta ? "Get Started with Meta Cloud API" : "Get Started with Interakt"}
                    <FiExternalLink className="w-3 h-3"/>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats card */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden fade-up"
              style={{ animationDelay: "200ms" }}>
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  📊
                </div>
                <h3 className="text-sm font-extrabold text-white">Integration Stats</h3>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label:"Messages Sent", value: stats ? String(stats.messagesSent) : "—", sub:"This month",   color:"text-green-600" },
                  { label:"Delivery Rate", value: stats?.deliveryRate || "—",               sub:"Last 30 days", color:"text-blue-600"  },
                  { label:"Last Tested",   value: stats?.lastTestedAt || "—",               sub:"Test result",  color:"text-teal-600"  },
                  { label:"API Status",    value: stats?.apiStatus    || "—",               sub: stats?.apiStatusSub || "—", color:"text-emerald-600"},
                ].map((s, i) => (
                  <div key={s.label}
                    className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                    style={{ animation: "fadeUp .4s ease both", animationDelay: `${i * 60 + 250}ms` }}>
                    <div>
                      <p className="text-xs font-bold text-slate-600">{s.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
                    </div>
                    <p className={`text-sm font-extrabold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Help note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 fade-up"
              style={{ animationDelay: "280ms" }}>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">💡</span>
                <div>
                  <p className="text-xs font-extrabold text-amber-800 mb-1">Need Help?</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Templates must be approved by WhatsApp before use. Approval usually takes 1–2 business days.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}