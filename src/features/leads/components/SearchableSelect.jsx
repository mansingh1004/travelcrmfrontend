// OLD — replaced in create-form redesign.
// Kept in full for reference. The problem was not styling: every option was a bare <li onClick>,
// and the whole component had zero key handling — no ArrowUp/ArrowDown, no Enter-to-pick, no Esc,
// no highlighted-option state, no focus restore. Because it is the Departing Country control, the
// lead form could not be completed without a mouse. Worse, the search box sits inside the page's
// <form>, so pressing Enter after typing (the universal combo-box gesture) ran the form's submit
// handler instead of selecting the match.
//
// import { useState, useRef, useEffect } from "react";
// import { ChevronDown as FiChevronDown, Search as FiSearch } from "lucide-react";
//
//
// export default function SearchableSelect({
//   options = [],
//   value,
//   onChange,
//   placeholder = "Select",
//   loading = false,
//   icon: Icon,
//   searchable = true,
// }) {
//   const [isOpen,     setIsOpen]     = useState(false);
//   const [search,     setSearch]     = useState("");
//   const [openUpward, setOpenUpward] = useState(false);
//
//   const wrapperRef = useRef(null);
//   const buttonRef  = useRef(null);
//
//   // ── Safe options — ensure array + normalize { value, label } ──
//   const safeOptions = (Array.isArray(options) ? options : []).map((o, idx) => ({
//     // Support both { value, label } and { id, name } shapes
//     value : o.value ?? o.id   ?? idx,   // fallback to index if both missing
//     label : o.label ?? o.name ?? String(o.value ?? o.id ?? idx),
//   }));
//
//   const selectedLabel = safeOptions.find(o => o.value === value)?.label || "";
//
//   const filteredOptions = searchable
//     ? safeOptions.filter(o =>
//         (o.label || "").toLowerCase().includes(search.toLowerCase())
//       )
//     : safeOptions;
//
//   // ── Close on outside click ────────────────────────────────────
//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
//         setIsOpen(false);
//         setSearch("");
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);
//
//   // ── Open direction — up or down ───────────────────────────────
//   const handleToggle = () => {
//     if (!isOpen && buttonRef.current) {
//       const rect        = buttonRef.current.getBoundingClientRect();
//       const panelHeight = 300;
//       const spaceBelow  = window.innerHeight - rect.bottom;
//       const spaceAbove  = rect.top;
//       setOpenUpward(spaceBelow < panelHeight && spaceAbove > spaceBelow);
//     }
//     setIsOpen(prev => !prev);
//   };
//
//   return (
//     <div className="relative" ref={wrapperRef}>
//       {Icon && (
//         <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
//       )}
//
//       <button
//         ref={buttonRef}
//         type="button"
//         disabled={loading}
//         onClick={handleToggle}
//         className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-8 py-2.5 rounded-xl border border-slate-200 bg-white
//           text-sm text-left text-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-50
//           outline-none transition-all cursor-pointer truncate disabled:opacity-60 disabled:cursor-not-allowed`}
//       >
//         {loading ? "Loading..." : selectedLabel || placeholder}
//       </button>
//
//       <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
//
//       {isOpen && !loading && (
//         <div className={`absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-lg
//           max-h-64 overflow-hidden flex flex-col
//           ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
//
//           {searchable && (
//             <div className="relative p-2 border-b border-slate-100 flex-shrink-0">
//               <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//               <input
//                 autoFocus
//                 type="text"
//                 value={search}
//                 onChange={e => setSearch(e.target.value)}
//                 placeholder="Search..."
//                 className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400"
//               />
//             </div>
//           )}
//
//           <ul className="overflow-y-auto flex-1 min-h-0">
//             {filteredOptions.length === 0 ? (
//               <li className="px-3 py-2 text-sm text-slate-400">No matches found</li>
//             ) : (
//               filteredOptions.map((option, idx) => (
//                 <li
//                   // FIX: key = value + index — ensures uniqueness even if values are duplicate/undefined
//                   key={`${option.value}-${idx}`}
//                   onClick={() => {
//                     onChange(option.value);
//                     setIsOpen(false);
//                     setSearch("");
//                   }}
//                   className={`px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 ${
//                     option.value === value
//                       ? "bg-teal-50 text-teal-700 font-medium"
//                       : "text-slate-700"
//                   }`}
//                 >
//                   {option.label}
//                 </li>
//               ))
//             )}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// }


// ─────────────────────────────────────────────────────────────────────────────
// NEW — create-form redesign.
//
// Same props, same visual language, same { value, label } / { id, name } tolerance. What changed
// is that it is now a real combobox:
//   ArrowDown / ArrowUp   move a highlight through the filtered list (wraps at both ends)
//   Enter                 picks the highlighted option — and never reaches the surrounding <form>
//   Esc                   closes and returns focus to the trigger
//   Home / End            jump to first / last match
//   Tab                   closes and moves on, leaving the current value alone
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo, useId } from "react";
import { ChevronDown as FiChevronDown, Search as FiSearch } from "lucide-react";

/**
 * Accent classes, so this one combobox can serve features with different accents without any of
 * them forking it. `teal` is the default and is byte-identical to what the lead form has always
 * rendered — nothing about Leads changes by adding this.
 */
const ACCENTS = {
  teal: {
    focus: "focus:border-teal-400 focus:ring-teal-50",
    searchFocus: "focus:border-teal-400",
    highlight: "bg-teal-50",
    selected: "text-teal-700",
  },
  blue: {
    focus: "focus:border-blue-400 focus:ring-blue-100",
    searchFocus: "focus:border-blue-400",
    highlight: "bg-blue-50",
    selected: "text-blue-700",
  },
};

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select",
  loading = false,
  icon: Icon,
  searchable = true,
  accent = "teal",
  className = "",
  disabled = false,
}) {
  const tone = ACCENTS[accent] || ACCENTS.teal;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  // Both shapes are in use across the app: { value, label } from the dropdown endpoints and
  // { id, name } from the master lists. Normalise once so callers never have to care.
  const safeOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((o, idx) => ({
        value: o.value ?? o.id ?? idx,
        label: o.label ?? o.name ?? String(o.value ?? o.id ?? idx),
      })),
    [options]
  );

  const selectedLabel = safeOptions.find((o) => o.value === value)?.label || "";

  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return safeOptions;
    const needle = search.toLowerCase();
    return safeOptions.filter((o) => (o.label || "").toLowerCase().includes(needle));
  }, [safeOptions, search, searchable]);

  const close = (returnFocus = true) => {
    setIsOpen(false);
    setSearch("");
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The highlight is set at the two moments it can change meaning — opening, and typing — rather
  // than synced from an effect. Effects that setState on render cascade an extra pass, and here
  // there is no external system to synchronise with: both call sites already know the answer.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: "nearest" });
  }, [highlight, isOpen]);

  const openPanel = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelHeight = 300;
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < panelHeight && rect.top > spaceBelow);
    }
    // Land on the current value so Enter straight after opening re-picks what is already selected
    // instead of silently jumping to an unrelated first row. `search` is always "" on open, so the
    // unfiltered list is the right one to index into.
    const current = safeOptions.findIndex((o) => o.value === value);
    setHighlight(current >= 0 ? current : 0);
    setIsOpen(true);
  };

  const commit = (option) => {
    if (!option) return;
    onChange(option.value);
    close();
  };

  const move = (delta) => {
    if (filteredOptions.length === 0) return;
    setHighlight((current) => {
      const next = current + delta;
      if (next < 0) return filteredOptions.length - 1;
      if (next >= filteredOptions.length) return 0;
      return next;
    });
  };

  /**
   * One handler for the trigger and the search box.
   *
   * stopPropagation matters as much as preventDefault here: this control is rendered inside the
   * page's <form>, so an un-halted Enter runs the form's submit handler. That is what used to make
   * "type three letters, press Enter" create the record instead of choosing the option.
   */
  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) openPanel();
        else move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) openPanel();
        else move(-1);
        break;
      case "Home":
        if (isOpen) { event.preventDefault(); setHighlight(0); }
        break;
      case "End":
        if (isOpen) { event.preventDefault(); setHighlight(Math.max(0, filteredOptions.length - 1)); }
        break;
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        if (!isOpen) openPanel();
        else commit(filteredOptions[highlight]);
        break;
      case "Escape":
        if (isOpen) { event.preventDefault(); event.stopPropagation(); close(); }
        break;
      case "Tab":
        if (isOpen) close(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      )}

      <button
        ref={buttonRef}
        type="button"
        disabled={loading || disabled}
        onClick={() => (isOpen ? close(false) : openPanel())}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listId : undefined}
        className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-8 py-2.5 rounded-xl border border-slate-200 bg-white
          text-sm text-left text-slate-700 ${tone.focus} focus:ring-2
          outline-none transition-all cursor-pointer truncate disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? "Loading..." : selectedLabel || <span className="text-slate-400">{placeholder}</span>}
      </button>

      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

      {isOpen && !loading && (
        <div
          className={`absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-lg
            max-h-64 overflow-hidden flex flex-col
            ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          {searchable && (
            <div className="relative p-2 border-b border-slate-100 flex-shrink-0">
              <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(event) => {
                  // Narrowing the list invalidates the old index — it can point past the end, or at
                  // a row that is no longer visible. Back to the top on every keystroke.
                  setSearch(event.target.value);
                  setHighlight(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                aria-controls={listId}
                aria-activedescendant={filteredOptions[highlight] ? `${listId}-${highlight}` : undefined}
                className={`w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 outline-none ${tone.searchFocus}`}
              />
            </div>
          )}

          <ul ref={listRef} id={listId} role="listbox" className="overflow-y-auto flex-1 min-h-0">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No matches found</li>
            ) : (
              filteredOptions.map((option, idx) => {
                const selected = option.value === value;
                const highlighted = idx === highlight;
                return (
                  <li
                    key={`${option.value}-${idx}`}
                    id={`${listId}-${idx}`}
                    role="option"
                    aria-selected={selected}
                    data-highlighted={highlighted}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => commit(option)}
                    className={`px-3 py-2 text-sm cursor-pointer ${
                      highlighted ? tone.highlight : ""
                    } ${selected ? `${tone.selected} font-medium` : "text-slate-700"}`}
                  >
                    {option.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
