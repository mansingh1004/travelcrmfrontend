import { useState, useEffect } from "react";
import { User as FiUser, Phone as FiPhone, Mail as FiMail, Search as FiSearch, ChevronDown as FiChevronDown, Calendar as FiCalendar, Tag as FiTag, Layers as FiLayers, UserCheck as FiUserCheck, IndianRupee as FaRupeeSign, MessageCircle as FiMessageCircle, Package as FiPackage } from "lucide-react";

import { leadService } from "../api/leadService";
import { useLeadSources } from "../lib/useLeadSources";

// LEAD_SOURCES used to be a hardcoded array here. It listed 8 strings against a 9-constant backend
// enum (now 25), so any lead carrying an unlisted source rendered as a blank select — inviting the
// user to overwrite a source that was already correct. The list now comes from
// GET /api/leads/meta/sources, derived from LeadSource.values(); see useLeadSources.
// Do not reintroduce a local copy, including as a fetch-failure fallback.

const LEAD_TYPES  = ["Fresh Lead", "Repeat Customer", "Corporate", "VIP"];
const COMMUNICATION_PREFERENCES = ["WhatsApp", "Call", "Email", "SMS"];
const PACKAGE_TYPES = ["Family", "Honeymoon", "Group", "Corporate", "Pilgrimage", "Adventure"];
const LEAD_STAGES = [
  "New Lead", "Contacted", "Follow Up",
  "Qualified", "Proposal Sent", "Converted", "Lost",
];

const stageColors = {
  "New Lead":      "bg-blue-100   text-blue-700",
  "Contacted":     "bg-yellow-100 text-yellow-700",
  "Follow Up":     "bg-orange-100 text-orange-700",
  "Qualified":     "bg-purple-100 text-purple-700",
  "Proposal Sent": "bg-indigo-100 text-indigo-700",
  "Converted":     "bg-green-100  text-green-700",
  "Lost":          "bg-red-100    text-red-700",
};

/* ── Resolve logged-in user (for Assign To auto-select) ───────
   Login ke waqt user/token jahan store hota hai wahan se identity
   nikaalta hai. Common localStorage patterns + JWT payload fallback
   dono try karta hai.
   TODO: agar aapka auth kisi aur key ya util mein user rakhta hai
   (e.g. authService.getCurrentUser()), yaha adjust kar lena. */
function getLoggedInIdentity() {
  // 1) Common localStorage user objects
  const userKeys = ["user", "authUser", "currentUser", "loggedInUser"];
  for (const k of userKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const u = JSON.parse(raw);
      if (u && (u.publicId || u.userId || u.id || u.username || u.email)) {
        return {
          publicId: u.publicId || u.userId || u.id || null,
          username: u.username || u.email || u.fullName || null,
        };
      }
    } catch { /* bad JSON — try next key */ }
  }
  // 2) Fallback: decode JWT payload (Spring Security mein sub = username/email)
  const tokenKeys = ["token", "accessToken", "authToken", "jwt"];
  for (const k of tokenKeys) {
    const token = localStorage.getItem(k);
    if (!token || token.split(".").length !== 3) continue;
    try {
      const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(b64));
      return {
        publicId: payload.publicId || payload.userId || null,
        username: payload.sub || payload.username || payload.email || null,
      };
    } catch { /* invalid token — try next key */ }
  }
  return { publicId: null, username: null };
}

function FieldWrapper({ label, required, icon: Icon, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
        {Icon && <Icon className="w-3.5 h-3.5 text-blue-500" />}
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
          <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />
          {error}
        </p>
      )}
    </div>
  );
}

function InputField({ icon: Icon, error, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 rounded-xl border text-sm transition-all outline-none
          ${error
            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
            : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          } text-slate-700 placeholder-slate-400`}
        {...props}
      />
    </div>
  );
}

export default function LeadInformation({
  register,
  errors,
  watch,
  setValue,
  onPhoneSearch,
  searching,
  // "create" → intelligent assignment (load-based recommendation or forced self).
  // "edit"   → keep the assignee already on the lead; plain user dropdown, no recommendation.
  mode = "create",
  // Display name of the assignee the lead already carries. Only used to label that assignee's
  // option while /users is still in flight (or came back without them) — see userOptionsFor.
  assignedUserName = "",
}) {
  const {
    withCurrent: sourceOptionsFor,
    loading: sourcesLoading,
    error: sourcesError,
  } = useLeadSources();

  const [searchPhone,  setSearchPhone]  = useState("");
  const [users,        setUsers]        = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError,   setUsersError]   = useState(false);

  // Intelligent-assignment state (create mode only)
  const [forcedSelf,      setForcedSelf]      = useState(false);
  const [selfUser,        setSelfUser]        = useState(null);   // {publicId, name}

  // ── Load the Assign To control ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Plain user list (edit mode, and the create-mode resilience fallback). Mirrors the original
    // behaviour: fetch /users and auto-select the logged-in user when nothing is chosen yet.
    const loadUsersFallback = async () => {
      try {
        const res  = await leadService.getUsers();
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data) ? res.data.data : [];
        if (cancelled) return;
        setUsers(list);

        if (!watch("assignedUserId") && list.length > 0) {
          const me   = getLoggedInIdentity();
          const norm = (s) => (s || "").toString().trim().toLowerCase();
          const match = list.find((u) =>
            (me.publicId && (u.publicId === me.publicId || u.id === me.publicId)) ||
            (me.username && (
              norm(u.username) === norm(me.username) ||
              norm(u.email)    === norm(me.username) ||
              norm(u.fullName) === norm(me.username)
            ))
          );
          if (match) {
            setValue("assignedUserId", match.publicId || match.id, { shouldValidate: true });
          } else if (list.length === 1) {
            setValue("assignedUserId", list[0].publicId || list[0].id, { shouldValidate: true });
          }
        }
      } catch {
        if (!cancelled) { setUsersError(true); setUsers([]); }
      }
    };

    // Create mode: ask the backend how to assign this lead.
    const loadRecommendation = async () => {
      try {
        const res = await leadService.getAssignmentRecommendation();
        const rec = res.data?.data ?? res.data ?? {};
        if (cancelled) return;

        if (rec.forcedSelf) {
          // Agents / staff / sub-agents: hide the dropdown, force-assign to self.
          const self = rec.self || {};
          setForcedSelf(true);
          setSelfUser({ publicId: self.id, name: self.name });
          if (self.id) setValue("assignedUserId", self.id, { shouldValidate: true });
          setUsers([]);
          return;
        }

        // Tenant admin / manager: editable dropdown from the eligible pool + a pre-filled
        // load-based recommendation (only when nothing is chosen yet).
        setForcedSelf(false);
        const pool = Array.isArray(rec.eligibleUsers) ? rec.eligibleUsers : [];
        setUsers(pool.map((u) => ({
          publicId: u.id, name: u.name, email: u.email, activeLeads: u.activeLeads,
        })));
        if (!watch("assignedUserId") && rec.recommendedUserId) {
          setValue("assignedUserId", rec.recommendedUserId, { shouldValidate: true });
        }
      } catch {
        // Resilience: if the recommendation endpoint is unavailable, fall back to the plain list
        // so an admin still gets a usable dropdown.
        if (!cancelled) await loadUsersFallback();
      }
    };

    const load = async () => {
      setUsersLoading(true);
      setUsersError(false);
      if (mode === "create") {
        await loadRecommendation();
      } else {
        await loadUsersFallback();
      }
      if (!cancelled) setUsersLoading(false);
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /**
   * The options to render, given the assignee the lead currently holds.
   *
   * `register` leaves this select uncontrolled, so RHF writes the stored id into the DOM the
   * moment the field registers — which is before /users resolves. A <select> silently discards a
   * value matching no <option>, and nothing re-applies it once the list lands (the setValue calls
   * above are all guarded on the value being empty). The result is a blank Assign To on a lead
   * whose assignee is perfectly fine, inviting the user to overwrite it.
   *
   * Prepending the current assignee fixes that, and covers the same case for a list that came
   * back without them at all — /users needs USER_READ, so an agent editing a lead gets an empty
   * pool. Exactly the failure leadSource had, and the same cure: see withCurrent() in
   * lib/useLeadSources.js.
   */
  const userOptionsFor = (current) => {
    const idOf = (u) => u.publicId || u.id;
    if (!current || users.some((u) => idOf(u) === current)) return users;
    return [{ publicId: current, name: assignedUserName || "Currently assigned" }, ...users];
  };

  const handleSearch = async () => {
    if (!searchPhone.trim()) return;
    await onPhoneSearch(searchPhone);
  };

  const selectedStage = watch("leadStage");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <FiUser className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Lead Information</h2>
          <p className="text-blue-100 text-xs">Customer contact & assignment details</p>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Phone Search */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-2.5 flex items-center gap-1.5">
            <FiSearch className="w-3.5 h-3.5" /> Search Existing Lead by Phone or email
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={searchPhone}
              onChange={e => setSearchPhone(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Enter phone number to search..."
              className="flex-1 px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-sm text-slate-700
                placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            <button type="button" onClick={handleSearch} disabled={searching}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold
                transition-all flex items-center gap-2 disabled:opacity-60 shadow-sm active:scale-95">
              {searching
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <FiSearch className="w-4 h-4" />}
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Name + Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper label="Customer Name" required icon={FiUser} error={errors.customerName?.message}>
            <InputField
              icon={FiUser}
              placeholder="Enter customer name"
              error={errors.customerName}
              {...register("customerName", { required: "Customer name is required" })}
            />
          </FieldWrapper>
          <FieldWrapper label="Email Address" icon={FiMail} error={errors.email?.message}>
            <InputField
              type="email"
              icon={FiMail}
              placeholder="Enter email address"
              {...register("email")}
            />
          </FieldWrapper>
        </div>

        {/* Phone + Budget */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper label="Phone Number" required icon={FiPhone} error={errors.phone?.message}>
            <InputField
              type="tel"
              icon={FiPhone}
              placeholder="+91 98765 43210"
              error={errors.phone}
              {...register("phone", {
                required: "Phone number is required",
                pattern: { value: /^[+\d\s\-()]{7,15}$/, message: "Enter a valid phone number" },
              })}
            />
          </FieldWrapper>

          {/* ── Budget field ── */}
          <FieldWrapper label="Budget (₹)" icon={FaRupeeSign} error={errors.budget?.message}>
            <InputField
              type="number"
              min={0}
              step="1000"
              icon={FaRupeeSign}
              placeholder="e.g. 150000"
              error={errors.budget}
              {...register("budget", {
                min: { value: 0, message: "Budget cannot be negative" },
                valueAsNumber: true,
              })}
            />
          </FieldWrapper>
        </div>

        {/* Lead Source + Lead Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Lead Source"
            icon={FiTag}
            error={sourcesError ? "Couldn't load lead sources — showing the current value only." : undefined}
          >
            <div className="relative">
              <FiTag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                  focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all"
                {...register("leadSource")}
              >
                <option value="">Select lead source</option>
                {/* The lead's own value is always present, even while the catalog is still loading
                    and even if it isn't manually selectable — otherwise the select renders blank on
                    a lead whose source is fine and the user overwrites it. */}
                {sourceOptionsFor(watch("leadSource")).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {sourcesLoading && <option value="" disabled>Loading sources…</option>}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </FieldWrapper>

          <FieldWrapper label="Lead Type" icon={FiLayers}>
            <div className="relative">
              <FiLayers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                  focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all"
                {...register("leadType")}
              >
                <option value="">Select lead type</option>
                {LEAD_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </FieldWrapper>
        </div>

        {/* Lead Stage — pill buttons */}
        <FieldWrapper label="Lead Stage" icon={FiLayers}>
          <div className="flex flex-wrap gap-2">
            {LEAD_STAGES.map(stage => (
              <button
                key={stage}
                type="button"
                onClick={() => setValue("leadStage", stage, { shouldValidate: true })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                  ${selectedStage === stage
                    ? `${stageColors[stage]} border-current shadow-sm scale-105`
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
              >
                {stage}
              </button>
            ))}
          </div>
          <input type="hidden" {...register("leadStage")} />
        </FieldWrapper>

        {/* Assign To + Birth Date + Anniversary Date — one row on md+ screens */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <FieldWrapper
            label="Assign To"
            required
            icon={FiUserCheck}
            error={errors.assignedUserId?.message}
          >
            {forcedSelf ? (
              /* Agents / staff / sub-agents: the lead is assigned to them — no dropdown to pick
                 someone else. A registered hidden field keeps the value in the submitted form. */
              <>
                <input type="hidden" {...register("assignedUserId", { required: "Assigned user is required" })} />
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <FiUserCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-700 truncate">
                    {selfUser?.name || "You"}
                  </span>
                  <span className="ml-auto text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                    Assigned to you
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <FiUserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    className={`w-full pl-9 pr-8 py-2.5 rounded-xl border bg-white text-sm text-slate-700
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all
                      ${errors.assignedUserId ? "border-red-300 bg-red-50" : "border-slate-200"}
                      ${usersLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                    disabled={usersLoading}
                    {...register("assignedUserId", {
                      required: "Assigned user is required",
                    })}
                  >
                    <option value="">
                      {usersLoading
                        ? "Loading users..."
                        : usersError
                        ? "Failed to load — retry"
                        : "Select team member"}
                    </option>
                    {/* The lead's own assignee is always present, even while /users is still
                        loading and even if it never arrives — otherwise the select renders blank
                        on a lead that is assigned correctly. */}
                    {userOptionsFor(watch("assignedUserId")).map(user => (
                      <option
                        key={user.publicId || user.id}
                        value={user.publicId || user.id}
                      >
                        {user.fullName || user.name || user.username}
                        {typeof user.activeLeads === "number" ? ` · ${user.activeLeads} active` : ""}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {/* Error state retry hint */}
                {usersError && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <span className="w-1 h-1 rounded-full bg-amber-500 inline-block" />
                    Could not load team members. Check your connection.
                  </p>
                )}
              </>
            )}
          </FieldWrapper>

          <FieldWrapper label="Birth Date" icon={FiCalendar}>
            <InputField
              type="date"
              icon={FiCalendar}
              {...register("birthDate")}
            />
          </FieldWrapper>

          <FieldWrapper label="Anniversary Date" icon={FiCalendar}>
            <InputField
              type="date"
              icon={FiCalendar}
              {...register("anniversaryDate")}
            />
          </FieldWrapper>
        </div>

        {/* Optional customer preferences and follow-up details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldWrapper label="Preferred Communication" icon={FiMessageCircle}>
            <div className="relative">
              <FiMessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                  focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all"
                {...register("preferredCommunication")}
              >
                <option value="">Select preferred channel</option>
                {COMMUNICATION_PREFERENCES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </FieldWrapper>

          <FieldWrapper label="Follow-up Date" icon={FiCalendar}>
            <InputField
              type="date"
              icon={FiCalendar}
              {...register("followUpDate")}
            />
          </FieldWrapper>

          <FieldWrapper label="Package Type" icon={FiPackage}>
            <div className="relative">
              <FiPackage className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                  focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none appearance-none cursor-pointer transition-all"
                {...register("packageType")}
              >
                <option value="">Select package type</option>
                {PACKAGE_TYPES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </FieldWrapper>
        </div>

      </div>
    </div>
  );
}
