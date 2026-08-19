import { useCallback, useEffect, useState } from "react";
import {
  Loader2, AlertTriangle, CheckCircle2, ShieldAlert, Save, Settings2, Power,
} from "lucide-react";
import { configService } from "../api/configService";
import { ConsoleTable } from "../components/ConsoleTable";
import SuperAdminMfaActionModal from "../components/SuperAdminMfaActionModal";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus";

export default function GlobalConfig() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMaint, setSavingMaint] = useState(false);
  const [edits, setEdits] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [mfaAction, setMfaAction] = useState(null);
  const [mfaError, setMfaError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([configService.getMaintenance(), configService.listConfig()]);
      setEnabled(!!m.enabled);
      setMessage(m.message || "");
      setConfig(Array.isArray(c) ? c : []);
    } catch {
      showToast("error", "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const saveMaintenance = (nextEnabled) => {
    setMfaError("");
    setMfaAction({ type: "maintenance", nextEnabled });
  };

  const saveConfigRow = (key) => {
    setMfaError("");
    setMfaAction({ type: "config", key });
  };

  const confirmMfaAction = async (mfaCode) => {
    const action = mfaAction;
    if (!action) return;
    setMfaError("");

    if (action.type === "maintenance") {
      setSavingMaint(true);
      try {
        const res = await configService.setMaintenance(action.nextEnabled, message, mfaCode);
        setEnabled(!!res.enabled);
        setMessage(res.message || "");
        showToast("success", action.nextEnabled ? "Maintenance mode ENABLED" : "Maintenance mode disabled");
        setMfaAction(null);
        load();
      } catch (e) {
        setMfaError(e?.response?.data?.message || "Save failed");
      } finally {
        setSavingMaint(false);
      }
      return;
    }

    setSavingKey(action.key);
    try {
      await configService.setConfig(action.key, edits[action.key], undefined, mfaCode);
      showToast("success", `Saved ${action.key}`);
      setEdits((e) => { const n = { ...e }; delete n[action.key]; return n; });
      setMfaAction(null);
      load();
    } catch (e) {
      setMfaError(e?.response?.data?.message || "Save failed");
    } finally {
      setSavingKey(null);
    }
  };

  const actionCopy = () => {
    if (mfaAction?.type === "maintenance") {
      return {
        title: "Confirm maintenance change",
        description: "Enter your authenticator code to update maintenance mode.",
        confirmLabel: "Save",
      };
    }
    return {
      title: "Confirm config change",
      description: `Enter your authenticator code to update ${mfaAction?.key || "this setting"}.`,
      confirmLabel: "Save",
    };
  };

  const copy = actionCopy();
  const actionSaving = mfaAction?.type === "maintenance" ? savingMaint : savingKey === mfaAction?.key;

  const configColumns = [
    { id: "key", header: "Key", accessorKey: "key",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-heading">{row.original.key}</div>
          {row.original.description && <div className="mt-0.5 text-xs text-muted">{row.original.description}</div>}
        </div>
      ) },
    { id: "value", header: "Value", enableSorting: false,
      cell: ({ row }) => (
        <input
          value={edits[row.original.key] ?? row.original.value ?? ""}
          onChange={(e) => setEdits((prev) => ({ ...prev, [row.original.key]: e.target.value }))}
          className={inputCls}
        />
      ) },
    { id: "action", header: "Action", enableSorting: false, meta: { numeric: true },
      cell: ({ row }) => {
        const dirty = edits[row.original.key] !== undefined && edits[row.original.key] !== row.original.value;
        return (
          <button onClick={() => saveConfigRow(row.original.key)}
            disabled={!dirty || savingKey === row.original.key}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-40">
            {savingKey === row.original.key ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        );
      } },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-heading">Global Config</h1>
        <p className="text-sm text-body">Platform-wide settings and the tenant-app maintenance switch.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted"><Loader2 size={20} className="mx-auto animate-spin" /></div>
      ) : (
        <>
          {/* ── Maintenance mode ── */}
          <section
            className={`rounded-xl border p-5 ${
              enabled ? "border-red-500/40 bg-red-500/5" : "border-border bg-surface"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  enabled ? "bg-red-500/15 text-red-500" : "bg-accent-soft text-accent-soft-text"}`}>
                  <Power size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-heading">Maintenance Mode</h2>
                  <p className="mt-0.5 max-w-xl text-xs text-muted">
                    When ON, every tenant user gets a 503 with the message below. The console and login stay reachable.
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={enabled}
                onClick={() => saveMaintenance(!enabled)}
                disabled={savingMaint}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                  enabled ? "bg-red-500" : "bg-border-strong"
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {enabled && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">
                <ShieldAlert size={14} /> The tenant app is currently DOWN for all users.
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-muted">Message shown to tenants</label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="We'll be back shortly…"
                className={inputCls}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => saveMaintenance(enabled)}
                  disabled={savingMaint}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-hover disabled:opacity-60"
                >
                  {savingMaint ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save message
                </button>
              </div>
            </div>
          </section>

          {/* ── Raw config ── */}
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-heading">
              <Settings2 size={15} className="text-muted" /> All settings
            </h2>
            <ConsoleTable
              columns={configColumns}
              rows={config}
              state="ready"
              density="compact"
              emptyTitle="No settings yet"
              emptyHint="Toggling maintenance creates the first entries."
            />
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {mfaAction && (
        <SuperAdminMfaActionModal
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirmLabel}
          saving={actionSaving}
          error={mfaError}
          onClose={() => (actionSaving ? undefined : setMfaAction(null))}
          onConfirm={confirmMfaAction}
        />
      )}
    </div>
  );
}
