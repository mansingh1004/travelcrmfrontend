import { useRef, useEffect } from "react";
import { ChevronDown, List, Plus, Trash2, Star } from "lucide-react";

export function Label({ children, required }) {
  return (
    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-rose-500 ml-1">*</span>}
    </label>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl
        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
        placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

export function Select({ options = [], placeholder = "Select...", className = "", ...props }) {
  return (
    <div className="relative">
      <select
        className={`w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
          appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {/* Two option shapes, and the string form is the one every existing caller uses — it must
            keep behaving byte-for-byte. The {value,label} form was added for master-backed pickers
            (cruise, airline), where the value is a publicId the user must never see and the label
            carries the supplier: "Royal Caribbean Explorer — via Seaways DMC". */}
        {options.map(o => (typeof o === "object" && o !== null)
          ? <option key={o.value} value={o.value}>{o.label}</option>
          : <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl
        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
        placeholder-slate-400 resize-none ${className}`}
      {...props}
    />
  );
}

export function SectionCard({ title, icon: Icon, iconColor = "text-blue-600", children, headerRight }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          {Icon && <div className={`w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center ${iconColor}`}><Icon size={15} /></div>}
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        {headerRight}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function AddBtn({ onClick, label = "Add" }) {
  return (
    <button onClick={onClick} type="button"
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all active:scale-95">
      <Plus size={13} strokeWidth={2.5} /> {label}
    </button>
  );
}

export function RemoveBtn({ onClick }) {
  return (
    <button onClick={onClick} type="button"
      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
      <Trash2 size={14} />
    </button>
  );
}

export function IncludeToggle({ included, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div onClick={onChange}
        className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${included ? "bg-blue-600" : "bg-slate-300"}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${included ? "left-5" : "left-0.5"}`} />
      </div>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </label>
  );
}

export function AIBanner({ text = "AI Suggestions available for this section" }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-teal-600 rounded-xl text-white text-sm font-medium mb-5">
      <Star size={16} className="flex-shrink-0" />
      <span>{text}</span>
      <button className="ml-auto text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-bold transition-all">Use AI</button>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc, onAdd, addLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 -rotate-3">
        <Icon size={26} className="text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-600 mb-1">{title}</p>
      <p className="text-xs text-slate-400 mb-4">{desc}</p>
      {onAdd && <AddBtn onClick={onAdd} label={addLabel} />}
    </div>
  );
}

export function FieldGrid({ cols = 3, children }) {
  const gridCls = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };
  return <div className={`grid ${gridCls[cols] || gridCls[3]} gap-4`}>{children}</div>;
}

export function RichText({ value, onChange, rows = 5 }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, []);
  const exec = (cmd) => { document.execCommand(cmd, false, null); ref.current.focus(); };
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
        {[["B","bold"],["I","italic"],["U","underline"]].map(([lbl, cmd]) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); exec(cmd); }}
            className="w-7 h-7 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            style={{ fontStyle: cmd === "italic" ? "italic" : "normal", textDecoration: cmd === "underline" ? "underline" : "none" }}>
            {lbl}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <button onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}
          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
          <List size={13} />
        </button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={e => onChange?.(e.currentTarget.innerHTML)}
        className="w-full px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
        style={{ minHeight: `${rows * 24}px` }}
      />
    </div>
  );
}