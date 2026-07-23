
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity,ArrowLeft,BarChart3,Check,ChevronRight,Copy,Globe2,Inbox,Link2,LoaderCircle,Megaphone,MessageCircle,Phone,Plus,RefreshCw,ScrollText,Search,Settings2,ShieldCheck,Store,Trash2,TriangleAlert,Wifi,X,Zap,} from "lucide-react";

import leadSourceService from "../api/leadSourceService";



const CHANNEL_UI = {
  WEBSITE_FORM: {
    icon: Globe2,
    gradient: "from-blue-600 via-blue-500 to-cyan-400",
    soft: "bg-blue-50 text-blue-700",
    border: "border-blue-200",
    ring: "ring-blue-200",
    glow: "shadow-blue-200/60",
  },
  WEBLINK_ENQUIRY: {
    icon: Link2,
    gradient: "from-sky-600 via-cyan-500 to-teal-400",
    soft: "bg-sky-50 text-sky-700",
    border: "border-sky-200",
    ring: "ring-sky-200",
    glow: "shadow-sky-200/60",
  },
  JUSTDIAL: {
    icon: Store,
    gradient: "from-amber-600 via-orange-500 to-yellow-400",
    soft: "bg-amber-50 text-amber-700",
    border: "border-amber-200",
    ring: "ring-amber-200",
    glow: "shadow-amber-200/60",
  },
  INDIAMART: {
    icon: Store,
    gradient: "from-orange-600 via-orange-500 to-amber-400",
    soft: "bg-orange-50 text-orange-700",
    border: "border-orange-200",
    ring: "ring-orange-200",
    glow: "shadow-orange-200/60",
  },
  TRADEINDIA: {
    icon: Store,
    gradient: "from-rose-600 via-pink-500 to-orange-400",
    soft: "bg-rose-50 text-rose-700",
    border: "border-rose-200",
    ring: "ring-rose-200",
    glow: "shadow-rose-200/60",
  },
  SULEKHA: {
    icon: Store,
    gradient: "from-red-600 via-rose-500 to-pink-400",
    soft: "bg-red-50 text-red-700",
    border: "border-red-200",
    ring: "ring-red-200",
    glow: "shadow-red-200/60",
  },
  GOOGLE_ADS: {
    icon: Megaphone,
    gradient: "from-emerald-600 via-green-500 to-lime-400",
    soft: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
    ring: "ring-emerald-200",
    glow: "shadow-emerald-200/60",
  },
  META_ADS: {
    icon: Megaphone,
    gradient: "from-indigo-600 via-violet-500 to-fuchsia-400",
    soft: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
    ring: "ring-indigo-200",
    glow: "shadow-indigo-200/60",
  },
  INSTAGRAM_DM: {
    icon: MessageCircle,
    gradient: "from-fuchsia-600 via-pink-500 to-rose-400",
    soft: "bg-fuchsia-50 text-fuchsia-700",
    border: "border-fuchsia-200",
    ring: "ring-fuchsia-200",
    glow: "shadow-fuchsia-200/60",
  },
  FB_MESSENGER: {
    icon: MessageCircle,
    gradient: "from-blue-700 via-blue-500 to-sky-400",
    soft: "bg-blue-50 text-blue-700",
    border: "border-blue-200",
    ring: "ring-blue-200",
    glow: "shadow-blue-200/60",
  },
  WHATSAPP: {
    icon: MessageCircle,
    gradient: "from-green-600 via-emerald-500 to-teal-400",
    soft: "bg-green-50 text-green-700",
    border: "border-green-200",
    ring: "ring-green-200",
    glow: "shadow-green-200/60",
  },
  IVR_CALL: {
    icon: Phone,
    gradient: "from-violet-700 via-purple-500 to-indigo-400",
    soft: "bg-violet-50 text-violet-700",
    border: "border-violet-200",
    ring: "ring-violet-200",
    glow: "shadow-violet-200/60",
  },
};

const FALLBACK_UI = {
  icon: Inbox,
  gradient: "from-slate-700 via-slate-600 to-slate-400",
  soft: "bg-slate-100 text-slate-700",
  border: "border-slate-200",
  ring: "ring-slate-200",
  glow: "shadow-slate-200/60",
};

const STATUS_UI = {
  CONNECTED: {
    label: "Connected",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  DEGRADED: {
    label: "Needs attention",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  DISABLED: {
    label: "Disabled",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
};

const EVENT_STATUS = {
  PROCESSED: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "Lead created",
  },
  APPENDED: {
    chip: "border-green-200 bg-green-50 text-green-700",
    text: "Added to existing lead",
  },
  RECEIVED: {
    chip: "border-slate-200 bg-slate-100 text-slate-600",
    text: "Received",
  },
  DUPLICATE: {
    chip: "border-slate-200 bg-slate-100 text-slate-600",
    text: "Duplicate",
  },
  IGNORED: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    text: "Not a lead",
  },
  DEFERRED: {
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    text: "Fetching details",
  },
  QUARANTINED_QUOTA: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    text: "Plan limit reached",
  },
  FAILED: {
    chip: "border-red-200 bg-red-50 text-red-700",
    text: "Failed",
  },
};

const uiFor = (code) => CHANNEL_UI[code] ?? FALLBACK_UI;

const eventStatus = (status) =>
  EVENT_STATUS[status] ?? {
    chip: "border-slate-200 bg-slate-100 text-slate-600",
    text: status || "Unknown",
  };

const fmtNumber = (value) =>
  new Intl.NumberFormat("en-IN").format(Number(value) || 0);

const fmtDate = (iso) =>
  !iso
    ? "Never"
    : new Date(iso).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

/* -------------------------------------------------------------------------- */
/* Shared UI                                                                  */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status = "DISABLED" }) {
  const ui = STATUS_UI[status] ?? STATUS_UI.DISABLED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${ui.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} />
      {ui.label}
    </span>
  );
}

function CopyButton({ value, label = "Copy", dark = false }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The value remains selectable when clipboard access is blocked.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        dark
          ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
          : "border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, helper, className }) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-3.5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-5">
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl ${className}`}
      />
      <div className="relative flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px] sm:tracking-[0.16em]">
            {label}
          </p>
          <p className="mt-2 truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500 sm:text-xs">{helper}</p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg sm:h-11 sm:w-11 sm:rounded-2xl ${className}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-slate-200" />
            <div className="h-6 w-20 rounded-full bg-slate-100" />
          </div>
          <div className="mt-5 h-4 w-32 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-3/4 rounded bg-slate-100" />
          <div className="mt-6 h-10 rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-5 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-extrabold text-slate-800">{title}</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">
        {description}
      </p>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One-time URL                                                               */
/* -------------------------------------------------------------------------- */

function IssuedUrlModal({ url, onClose }) {
  useEffect(() => {
    if (!url) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="issued-url-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="relative flex max-h-[88dvh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-xl sm:rounded-[28px]"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-white px-5 py-6 sm:px-7">
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">
                  Connection created
                </p>
                <h2 id="issued-url-title" className="mt-1 text-xl font-black text-slate-900">
                  Save your secure intake URL
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close secure URL"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 pb-8 sm:p-7 sm:pb-7">
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-xs font-medium leading-5 text-amber-900 sm:text-sm">
              This URL is displayed only once. Copy it now and add it to the
              provider. Rotate the connection later if the URL is lost.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <code className="block max-h-24 overflow-auto break-all text-xs font-semibold leading-5 text-slate-700">
              {url}
            </code>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
            <div className="flex-[1.35]">
              <CopyButton value={url} label="Copy secure URL" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add connection drawer                                                      */
/* -------------------------------------------------------------------------- */

function DrawerField({
  label,
  required,
  helpText,
  type = "text",
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : "off"}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
      {helpText && (
        <span className="mt-1.5 block text-xs leading-5 text-slate-400">
          {helpText}
        </span>
      )}
    </label>
  );
}

function AddConnectionDrawer({ channel, onClose, onCreated }) {
  const [label, setLabel] = useState("");
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!channel) return null;

  const ui = uiFor(channel.code);
  const Icon = ui.icon;
  const credentialFields = channel.credentialFields ?? [];
  const configFields = channel.configFields ?? [];

  const setField = (key, value) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const credentials = {};
      const config = {};

      credentialFields.forEach((field) => {
        if (values[field.key]) credentials[field.key] = values[field.key];
      });

      configFields.forEach((field) => {
        if (values[field.key]) config[field.key] = values[field.key];
      });

      const created = await leadSourceService.createConnection({
        channel: channel.code,
        label: label.trim(),
        credentials,
        config,
      });

      await onCreated(created?.data ?? created);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Could not create this connection. Check the details and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 p-0 backdrop-blur-sm sm:p-3"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-white px-5 py-6 sm:px-6">
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${ui.gradient} text-white shadow-md`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  New connection
                </p>
                <h2 className="truncate text-xl font-black text-slate-900">
                  Connect {channel.displayName}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
          {channel.setupHint && (
            <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-xs leading-5 text-blue-800">
                {channel.setupHint}
              </p>
            </div>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Settings2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Connection identity
                </h3>
                <p className="text-xs text-slate-400">
                  Give this integration a recognisable name.
                </p>
              </div>
            </div>

            <DrawerField
              label="Connection name"
              required
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Goa Landing Page or Mumbai DID"
              helpText="You can create multiple connections for the same lead source."
            />
          </section>

          {credentialFields.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Secure credentials
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sensitive values are submitted securely.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {credentialFields.map((field) => (
                  <DrawerField
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    helpText={field.helpText}
                    type="password"
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {configFields.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Source configuration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Settings used while processing incoming leads.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {configFields.map((field) => (
                  <DrawerField
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    helpText={field.helpText}
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {error && (
            <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className={`flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${ui.gradient} px-4 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {saving ? "Connecting..." : "Create connection"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Deliveries drawer                                                          */
/* -------------------------------------------------------------------------- */

function DeliveriesDrawer({ conn, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [body, setBody] = useState(null);
  const [bodyLoading, setBodyLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await leadSourceService.getEvents(conn.publicId, {
          size: 25,
        });

        const items = normalizeArray(response?.data ?? response);
        if (alive) {
          setRows(items);
          setError(null);
        }
      } catch (requestError) {
        if (alive) {
          setError(
            requestError?.response?.data?.message ||
              "Could not load recent deliveries."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [conn.publicId]);

  const openDelivery = async (row) => {
    if (openId === row.publicId) {
      setOpenId(null);
      setBody(null);
      return;
    }

    setOpenId(row.publicId);
    setBody(null);
    setBodyLoading(true);

    try {
      const response = await leadSourceService.getEvent(
        conn.publicId,
        row.publicId
      );
      setBody(response?.data ?? response);
    } catch {
      setBody({ rawPayload: "Could not load this delivery." });
    } finally {
      setBodyLoading(false);
    }
  };

  const rawPayload =
    typeof body?.rawPayload === "string"
      ? body.rawPayload
      : body?.rawPayload
        ? JSON.stringify(body.rawPayload, null, 2)
        : "";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 p-0 backdrop-blur-sm sm:p-3"
      onMouseDown={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-slate-950 px-5 py-6 text-white sm:px-6">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-300">
                <Activity className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Delivery diagnostics
                </p>
                <h3 className="truncate text-xl font-black">
                  Recent deliveries
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {conn.label}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 p-2 transition-colors hover:bg-white/20"
              aria-label="Close deliveries"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading deliveries...
            </div>
          )}

          {error && (
            <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <EmptyState
              title="No deliveries received"
              description="When this provider sends a request, every delivery will appear here, including requests that did not become leads."
            />
          )}

          <div className="space-y-3">
            {rows.map((row) => {
              const status = eventStatus(row.status);
              const isOpen = openId === row.publicId;

              return (
                <article
                  key={row.publicId}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => openDelivery(row)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${status.chip}`}
                        >
                          {status.text}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {fmtDate(row.createdAt)}
                        </span>
                      </div>

                      {row.errorMessage && (
                        <p className="mt-2 line-clamp-2 text-xs font-medium text-red-600">
                          {row.errorMessage}
                        </p>
                      )}
                    </div>

                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      {bodyLoading && (
                        <div className="flex items-center gap-2 py-4 text-xs font-semibold text-slate-400">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Loading payload...
                        </div>
                      )}

                      {!bodyLoading && body && (
                        <>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                              Provider payload
                            </p>
                            {rawPayload && (
                              <CopyButton value={rawPayload} label="Copy" />
                            )}
                          </div>

                          {body.payloadTruncated && (
                            <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                              This payload was longer than the stored limit and
                              has been truncated.
                            </p>
                          )}

                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-slate-200 bg-slate-950 p-4 text-[11px] leading-5 text-slate-200">
                            {rawPayload || "This delivery had no content."}
                          </pre>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Channel and connection cards                                               */
/* -------------------------------------------------------------------------- */
/* ChannelCard deliberately mirrors StatCard's language: white/glass body,
   the channel's color living only in a small icon chip (plus a whisper of it
   in the card's own shadow tint). That is "same style as the dashboard /
   count cards" — no more full-bleed gradient tiles. */

function ChannelCard({ channel, selected, onClick }) {
  const ui = uiFor(channel.code);
  const Icon = ui.icon;
  const connectionCount = Number(channel.connectionCount) || 0;
  const leadCount = Number(channel.totalLeadCount) || 0;
  const status =
    connectionCount > 0 ? channel.worstStatus || "CONNECTED" : "DISABLED";
  const statusUi = STATUS_UI[status] ?? STATUS_UI.DISABLED;
  const isLive = connectionCount > 0 && status === "CONNECTED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[230px] flex-col overflow-hidden rounded-[26px] border bg-white/90 p-5 text-left shadow-sm ${ui.glow} backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl focus:outline-none focus:ring-4 ${ui.ring} ${
        selected
          ? `border-transparent ring-4 ${ui.ring} shadow-xl`
          : "border-slate-200/80 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${ui.gradient} text-white shadow-md`}
        >
          <Icon className="h-6 w-6" />
          {isLive && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
          )}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
            connectionCount > 0
              ? statusUi.className
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connectionCount > 0 ? statusUi.dot : "bg-slate-300"
            }`}
          />
          {connectionCount > 0 ? statusUi.label : "Available"}
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-black tracking-tight text-slate-900">
          {channel.displayName}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-slate-500">
          {channel.description}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            Connections
          </p>
          <p className="mt-1 text-base font-black text-slate-800">
            {fmtNumber(connectionCount)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            Leads
          </p>
          <p className="mt-1 text-base font-black text-slate-800">
            {fmtNumber(leadCount)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs font-extrabold text-slate-500 transition-colors group-hover:text-slate-800">
          {selected ? "Opening..." : "View connections"}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${ui.gradient} text-white shadow-sm transition-transform duration-300 group-hover:translate-x-1`}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function ConnectionRow({
  conn,
  onRotate,
  onToggle,
  onDelete,
  onDeliveries,
  busy,
}) {
  const status = conn.enabled ? conn.status || "CONNECTED" : "DISABLED";
  const overlapOpen = Boolean(conn.tokenPreviousRevokeAt);
  const leadCount = Number(conn.leadCount) || 0;

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-xl">
      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          status === "CONNECTED"
            ? "bg-emerald-500"
            : status === "DEGRADED"
              ? "bg-amber-500"
              : "bg-slate-300"
        }`}
      />

      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-black text-slate-900">
                {conn.label}
              </h3>
              <StatusBadge status={status} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Leads received
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-800">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  {fmtNumber(leadCount)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Token prefix
                </p>
                <code className="mt-1 block truncate text-sm font-black text-slate-700">
                  {conn.tokenPrefix || "—"}…
                </code>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Last lead
                </p>
                <p className="mt-1 truncate text-xs font-bold text-slate-700">
                  {fmtDate(conn.lastLeadReceivedAt)}
                </p>
              </div>
            </div>

            {!conn.lastLeadReceivedAt && conn.tokenLastUsedAt && (
              <div className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Traffic is reaching this URL, but no lead has been created. Last
                contact: {fmtDate(conn.tokenLastUsedAt)}.
              </div>
            )}

            {!conn.tokenLastUsedAt && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-400">
                <Wifi className="h-4 w-4" />
                Nothing has reached this URL yet.
              </div>
            )}

            {overlapOpen && (
              <div className="mt-3 flex gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-medium leading-5 text-blue-800">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
                The previous URL remains active until{" "}
                {fmtDate(conn.tokenPreviousRevokeAt)}.
              </div>
            )}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap xl:max-w-xs xl:justify-end">
            <button
              type="button"
              onClick={() => onDeliveries(conn)}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg sm:col-span-1"
            >
              <ScrollText className="h-4 w-4" />
              Deliveries
            </button>

            <button
              type="button"
              onClick={() => onToggle(conn)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              {conn.enabled ? "Pause" : "Enable"}
            </button>

            <button
              type="button"
              onClick={() => onRotate(conn)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-extrabold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Rotate
            </button>

            <button
              type="button"
              onClick={() => onDelete(conn)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-extrabold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sm:hidden">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ChannelConnectionsModal({
  channel,
  connections,
  loading,
  error,
  busyConnectionId,
  onClose,
  onAdd,
  onRotate,
  onToggle,
  onDelete,
  onDeliveries,
}) {
  useEffect(() => {
    if (!channel) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [channel, onClose]);

  if (!channel) return null;

  const ui = uiFor(channel.code);
  const Icon = ui.icon;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-connections-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-slate-50 shadow-2xl sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[30px]"
      >
        <div className="flex shrink-0 justify-center bg-white pb-1 pt-2.5 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>

        <header className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-white px-4 py-5 sm:px-6 sm:py-6">
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${ui.gradient} text-white shadow-md`}
              >
                <Icon className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                  Lead source
                </p>
                <h2
                  id="channel-connections-title"
                  className="truncate text-xl font-black text-slate-900 sm:text-2xl"
                >
                  {channel.displayName}
                </h2>
                <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">
                  {channel.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close source popup"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-extrabold ${ui.soft} ${ui.border}`}
              >
                {fmtNumber(channel.connectionCount)} connections
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-600">
                {fmtNumber(channel.totalLeadCount)} leads captured
              </span>
            </div>

            <button
              type="button"
              onClick={() => onAdd(channel)}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${ui.gradient} px-4 py-2.5 text-xs font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg sm:w-auto`}
            >
              <Plus className="h-4 w-4" />
              Add connection
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 pb-8 sm:p-5 sm:pb-5">
          {error && (
            <div className="mb-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading connections...
            </div>
          ) : connections.length === 0 ? (
            <EmptyState
              title="No connections yet"
              description={`Create the first ${channel.displayName} connection to receive leads automatically.`}
              action={
                <button
                  type="button"
                  onClick={() => onAdd(channel)}
                  className={`mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r ${ui.gradient} px-4 py-2.5 text-xs font-extrabold text-white shadow-lg`}
                >
                  <Plus className="h-4 w-4" />
                  Create first connection
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <ConnectionRow
                  key={connection.publicId}
                  conn={connection}
                  busy={busyConnectionId === connection.publicId}
                  onRotate={onRotate}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onDeliveries={onDeliveries}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LeadSources() {
  const navigate = useNavigate();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [connections, setConnections] = useState([]);
  const [connLoading, setConnLoading] = useState(false);

  const [drawerChannel, setDrawerChannel] = useState(null);
  const [deliveriesFor, setDeliveriesFor] = useState(null);
  const [issuedUrl, setIssuedUrl] = useState(null);

  const [busyConnectionId, setBusyConnectionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadChannels = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await leadSourceService.getChannels();
      const data = normalizeArray(response?.data ?? response);
      setChannels(data);
      setError(null);
      return data;
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Could not load lead sources. Please try again."
      );
      return [];
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  const loadConnections = useCallback(async (channelCode) => {
    setConnLoading(true);
    setConnectionError(null);

    try {
      const response =
        await leadSourceService.getConnections(channelCode);
      const data = normalizeArray(response?.data ?? response);
      setConnections(data);
      return data;
    } catch (requestError) {
      setConnections([]);
      setConnectionError(
        requestError?.response?.data?.message ||
          "Could not load connections for this source."
      );
      return [];
    } finally {
      setConnLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const openChannel = async (channel) => {
    setSelected(channel);
    await loadConnections(channel.code);
  };

  const refresh = async () => {
    const latestChannels = await loadChannels({ silent: true });

    if (selected) {
      const freshSelected =
        latestChannels.find((channel) => channel.code === selected.code) ??
        selected;
      setSelected(freshSelected);
      await loadConnections(freshSelected.code);
    }
  };

  const handleCreated = async (created) => {
    setDrawerChannel(null);
    setIssuedUrl(created?.ingestUrl ?? null);

    const latestChannels = await loadChannels({ silent: true });
    const target =
      latestChannels.find(
        (channel) => channel.code === created?.channelCode
      ) ?? selected;

    if (target) {
      setSelected(target);
      await loadConnections(target.code);
    }
  };

  const rotate = async (conn) => {
    const confirmed = window.confirm(
      `Issue a new URL for "${conn.label}"?\n\n` +
        "The current URL will continue working for a short overlap period, giving you time to update the provider."
    );

    if (!confirmed) return;

    setBusyConnectionId(conn.publicId);
    setConnectionError(null);

    try {
      const response = await leadSourceService.rotateToken(conn.publicId);
      const updated = response?.data ?? response;
      setIssuedUrl(updated?.ingestUrl ?? null);
      await refresh();
    } catch (requestError) {
      setConnectionError(
        requestError?.response?.data?.message ||
          "Could not rotate this URL."
      );
    } finally {
      setBusyConnectionId(null);
    }
  };

  const toggle = async (conn) => {
    setBusyConnectionId(conn.publicId);
    setConnectionError(null);

    try {
      await leadSourceService.updateConnection(conn.publicId, {
        channel: conn.channelCode,
        label: conn.label,
        enabled: !conn.enabled,
      });
      await refresh();
    } catch (requestError) {
      setConnectionError(
        requestError?.response?.data?.message ||
          "Could not update this connection."
      );
    } finally {
      setBusyConnectionId(null);
    }
  };

  const remove = async (conn) => {
    const confirmed = window.confirm(
      `Delete "${conn.label}"?\n\n` +
        "Its URL will stop working immediately. Leads already received will remain in the CRM."
    );

    if (!confirmed) return;

    setBusyConnectionId(conn.publicId);
    setConnectionError(null);

    try {
      await leadSourceService.deleteConnection(conn.publicId);
      await refresh();
    } catch (requestError) {
      setConnectionError(
        requestError?.response?.data?.message ||
          "Could not delete this connection."
      );
    } finally {
      setBusyConnectionId(null);
    }
  };

  const filteredChannels = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return channels;

    return channels.filter((channel) =>
      [channel.displayName, channel.description, channel.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [channels, searchTerm]);

  const stats = useMemo(() => {
    const totalConnections = channels.reduce(
      (sum, channel) => sum + (Number(channel.connectionCount) || 0),
      0
    );
    const totalLeads = channels.reduce(
      (sum, channel) => sum + (Number(channel.totalLeadCount) || 0),
      0
    );
    const connectedSources = channels.filter(
      (channel) =>
        Number(channel.connectionCount) > 0 &&
        channel.worstStatus === "CONNECTED"
    ).length;

    return {
      totalSources: channels.length,
      totalConnections,
      totalLeads,
      connectedSources,
    };
  }, [channels]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_transparent_30%),linear-gradient(to_bottom_right,_#f8fafc,_#eef2ff,_#f8fafc)]">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-x-0.5 hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                Settings · Automation
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Lead Sources
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Connect every place your enquiries arrive from and manage each
                integration from one responsive workspace.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Globe2}
            label="Sources"
            value={fmtNumber(stats.totalSources)}
            helper="Available channels"
            className="bg-gradient-to-br from-blue-600 to-cyan-500"
          />
          <StatCard
            icon={Link2}
            label="Connections"
            value={fmtNumber(stats.totalConnections)}
            helper="Configured endpoints"
            className="bg-gradient-to-br from-violet-600 to-fuchsia-500"
          />
          <StatCard
            icon={Activity}
            label="Healthy"
            value={fmtNumber(stats.connectedSources)}
            helper="Connected sources"
            className="bg-gradient-to-br from-emerald-600 to-green-500"
          />
          <StatCard
            icon={BarChart3}
            label="Leads captured"
            value={fmtNumber(stats.totalLeads)}
            helper="Across all sources"
            className="bg-gradient-to-br from-amber-500 to-orange-500"
          />
        </section>

        <main className="mt-6">
          {error && (
            <div className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => loadChannels()}
                className="text-xs font-extrabold underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          <section className="rounded-[28px] border border-white/80 bg-white/80 p-4 shadow-xl shadow-slate-200/40 backdrop-blur-xl sm:p-5 lg:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                  Integration marketplace
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Select a lead source
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Click a card to open its connections in a popup.
                </p>
              </div>

              <label className="relative block w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search lead sources..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            {loading ? (
              <LoadingCards />
            ) : filteredChannels.length === 0 ? (
              <EmptyState
                title="No sources found"
                description="Try a different search term or clear the search to view all available integrations."
                action={
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="mt-4 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white"
                  >
                    Clear search
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredChannels.map((channel) => (
                  <ChannelCard
                    key={channel.code}
                    channel={channel}
                    selected={selected?.code === channel.code}
                    onClick={() => openChannel(channel)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      <ChannelConnectionsModal
        channel={selected}
        connections={connections}
        loading={connLoading}
        error={connectionError}
        busyConnectionId={busyConnectionId}
        onClose={() => setSelected(null)}
        onAdd={setDrawerChannel}
        onRotate={rotate}
        onToggle={toggle}
        onDelete={remove}
        onDeliveries={setDeliveriesFor}
      />

      <AddConnectionDrawer
        channel={drawerChannel}
        onClose={() => setDrawerChannel(null)}
        onCreated={handleCreated}
      />

      <IssuedUrlModal
        url={issuedUrl}
        onClose={() => setIssuedUrl(null)}
      />

      {deliveriesFor && (
        <DeliveriesDrawer
          conn={deliveriesFor}
          onClose={() => setDeliveriesFor(null)}
        />
      )}
    </div>
  );
}




