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
import { Check, ChevronDown as FiChevronDown, Search as FiSearch, X } from "lucide-react";

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
    // Added with the 3-letter search: the matched run inside a label, and the bar on the
    // keyboard-highlighted row.
    mark: "bg-teal-100 text-teal-900",
    bar: "bg-teal-500",
  },
  blue: {
    focus: "focus:border-blue-400 focus:ring-blue-100",
    searchFocus: "focus:border-blue-400",
    highlight: "bg-blue-50",
    selected: "text-blue-700",
    mark: "bg-blue-100 text-blue-900",
    bar: "bg-blue-500",
  },
};

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  'button:not([disabled]):not([data-skip-enter="true"]),' +
  '[tabindex]:not([tabindex="-1"]):not([data-skip-enter="true"])';

const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "goa bea" → ["goa","bea"]. Every token has to be present, so word order never matters. */
const tokenize = (query) => String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * -1 = not a match, otherwise lower is better. The tiers are what make three letters land on the
 * row a clerk expects: an exact prefix ("goa" → Goa) outranks a word start ("goa" → North Goa)
 * which outranks a mid-word hit ("goa" → Margoa), and a hit that only comes from the phone/keywords
 * ranks last.
 */
const scoreOption = (haystack, label, query, tokens) => {
  if (!tokens.every((token) => haystack.includes(token))) return -1;
  if (label.startsWith(query)) return 0;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(query)}`).test(label)) return 1;
  if (label.includes(query)) return 2;
  return 3;
};

/** Wraps every matched token in the label so the eye lands on the reason a row is in the list. */
function Marked({ text, tokens, markClass }) {
  const value = String(text ?? "");
  if (!tokens.length) return value;
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "ig");
  // String.split with a capturing group interleaves the matches at the odd indexes.
  return value.split(pattern).map((part, index) =>
    index % 2 === 1
      ? <mark key={index} className={`rounded-[3px] px-[1px] font-bold ${markClass}`}>{part}</mark>
      : part
  );
}

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
  // ── Added for Create Booking; every one is optional, so the existing call sites are untouched.
  name,                 // put on the trigger, so validate()'s querySelector('[name=…]').focus() works
  onBlur,               // fires only when focus leaves the whole control, never on open
  triggerRef,           // callback ref for the trigger — FastItinerary focuses a newly added row
  searchPlaceholder = "Type to search...",
  // Error border is a prop rather than something the caller appends to className: two `border-*`
  // utilities in one class string are resolved by stylesheet order, not by the order they are
  // written, so an appended border-red-300 is not reliably the one that wins.
  invalid = false,
  /* Create Booking prints "Enter → next field" in its header and its form-level handler implements
     it for every input. A combobox breaks that: Enter picks the option and hands focus back to the
     trigger, where the next Enter re-opens the panel instead of moving on. With this on, picking an
     option lands the caret on the following control, so one Enter still means "done, next". Off by
     default — Create Lead has no such contract and must keep behaving as it always has. */
  advanceOnSelect = false,
  /* ── Server-side search, opt-in ───────────────────────────────────────────────────────────────
     Given, the typed query is handed to the caller (debounced) and the local ranking pass is
     SKIPPED — the options prop is then already the server's answer, and re-filtering it in the
     browser would hide rows the server deliberately returned.

     This exists for Create Booking's Link Lead picker. That control used to be fed one capped
     fetch of the newest 200 leads and filtered here, so an enquiry taken in June and booked in
     November was simply not in the list and could not be linked at all. Absent, everything below
     behaves exactly as it always has, so no existing call site changes. */
  onSearch = null,
  searchDebounceMs = 250,
}) {
  const tone = ACCENTS[accent] || ACCENTS.teal;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  // Both shapes are in use across the app: { value, label } from the dropdown endpoints and
  // { id, name } from the master lists. Normalise once so callers never have to care.
  // `sublabel` / `keywords` are opt-in: a second line to read, and extra text to match on without
  // crowding the label (a lead's phone number, for instance). Nothing is auto-derived from the raw
  // object — a master row's own `description` is HTML and has no business in a dropdown.
  const safeOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((o, idx) => ({
        value: o.value ?? o.id ?? idx,
        label: o.label ?? o.name ?? String(o.value ?? o.id ?? idx),
        sublabel: o.sublabel ?? o.hint ?? "",
        keywords: o.keywords ?? "",
      })),
    [options]
  );

  const selectedLabel = safeOptions.find((o) => o.value === value)?.label || "";

  const tokens = useMemo(() => (searchable ? tokenize(search) : []), [search, searchable]);

  // OLD — one `label.includes(search)` pass, unranked:
  //   return safeOptions.filter((o) => (o.label || "").toLowerCase().includes(needle));
  // A single substring meant "goa bea" (or any two words typed in the order they are read) matched
  // nothing, and the rows that came back were in master order, so the obvious answer to a
  // three-letter query could sit thirty rows down.
  /* Hand the query up, debounced, whenever the caller owns the searching. Cleared on close by the
     `search` reset, which fires this with "" and lets the caller restore its default list. */
  useEffect(() => {
    if (!onSearch) return undefined;
    const timer = setTimeout(() => onSearch(search.trim()), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [onSearch, search, searchDebounceMs]);

  const filteredOptions = useMemo(() => {
    // Server-searched: `options` IS the result set. Ranking it again here would drop rows the
    // server matched on fields this component cannot see.
    if (onSearch) return safeOptions;
    if (tokens.length === 0) return safeOptions;
    const query = search.trim().toLowerCase();
    const scored = [];
    safeOptions.forEach((option, index) => {
      const label = String(option.label || "").toLowerCase();
      const haystack = `${label} ${option.sublabel} ${option.keywords}`.toLowerCase();
      const score = scoreOption(haystack, label, query, tokens);
      if (score >= 0) scored.push({ option, score, index });
    });
    scored.sort((a, b) => a.score - b.score || a.index - b.index);
    return scored.map((entry) => entry.option);
  }, [safeOptions, search, tokens, onSearch]);

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

  // `seed` is the character that opened the panel on the type-to-open path — see handleKeyDown.
  const openPanel = (seed = "") => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelHeight = 340;
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < panelHeight && rect.top > spaceBelow);
    }
    setSearch(seed);
    // Land on the current value so Enter straight after opening re-picks what is already selected
    // instead of silently jumping to an unrelated first row. With a seed the list is about to be
    // filtered, so the only sane landing spot is the top match.
    const current = seed ? -1 : safeOptions.findIndex((o) => o.value === value);
    setHighlight(current >= 0 ? current : 0);
    setIsOpen(true);
  };

  /* The next thing the clerk can type after this control. Everything inside the panel is skipped —
     in DOM order the search box and its clear button sit immediately after the trigger, and both
     are about to unmount, so focusing one would drop focus on the floor. */
  const focusNextInForm = () => {
    const trigger = buttonRef.current;
    const form = trigger?.form || trigger?.closest("form");
    if (!trigger || !form) return false;
    const nodes = Array.from(form.querySelectorAll(FOCUSABLE)).filter(
      (node) => node === trigger || (!wrapperRef.current?.contains(node) && node.offsetParent !== null)
    );
    const next = nodes[nodes.indexOf(trigger) + 1];
    if (!next) return false;
    next.focus();
    if (typeof next.select === "function" && /^(text|number|tel|email|search)$/.test(next.type || "")) {
      next.select();
    }
    return true;
  };

  const commit = (option) => {
    if (!option) return;
    onChange(option.value);
    if (advanceOnSelect) {
      setIsOpen(false);
      setSearch("");
      if (!focusNextInForm()) buttonRef.current?.focus();
      return;
    }
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
        // Type-to-open. A native <select> answers a keystroke by jumping to the next option
        // starting with that letter and forgetting it a second later, which is why the itinerary
        // and country pickers behaved as if search stopped at the first letter. Here the keystroke
        // opens the panel and becomes the first character of a real, unbounded query.
        if (!isOpen && searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          // Space is the button's own "activate" key, not the first letter of anything — open, but
          // do not seed the query with a blank.
          openPanel(event.key === " " ? "" : event.key);
        }
        break;
    }
  };

  /* Only a focus move that leaves the whole control counts as a blur. Without the relatedTarget
     check, opening the panel (focus: trigger → search box) would report a blur and paint a
     "required" error under a field the clerk is in the middle of answering. */
  const handleBlur = (event) => {
    if (!onBlur) return;
    if (wrapperRef.current?.contains(event.relatedTarget)) return;
    onBlur(event);
  };

  return (
    <div className="relative" ref={wrapperRef} onBlur={handleBlur}>
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      )}

      <button
        ref={(node) => {
          buttonRef.current = node;
          // Callback form only — writing through a ref object passed as a prop is a mutation of
          // props, which the react-hooks rules reject outright.
          if (typeof triggerRef === "function") triggerRef(node);
        }}
        type="button"
        name={name}
        disabled={loading || disabled}
        onClick={() => (isOpen ? close(false) : openPanel())}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listId : undefined}
        aria-invalid={invalid || undefined}
        className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-8 py-2.5 rounded-xl border bg-white
          text-sm text-left text-slate-700 focus:ring-2
          ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : `border-slate-200 ${tone.focus}`}
          outline-none transition-all cursor-pointer truncate disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? "Loading..." : selectedLabel || <span className="text-slate-400">{placeholder}</span>}
      </button>

      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

      {/* OLD — the open panel was a 2px-padded search box over a bare <li> list inside a max-h-64
          box, with "No matches found" as the only feedback. Nothing told the clerk how many rows
          were left, which characters had matched, or that the keyboard drove the list at all —
          on a 200-row country master that is a list you scroll rather than search. */}
      {isOpen && !loading && (
        <div
          className={`absolute z-30 w-full min-w-[240px] bg-white border border-slate-200 rounded-xl
            shadow-lg shadow-slate-900/5 overflow-hidden flex flex-col
            ${openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
        >
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 flex-shrink-0">
              <FiSearch className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <input
                ref={searchRef}
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
                placeholder={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={filteredOptions[highlight] ? `${listId}-${highlight}` : undefined}
                className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
              />
              {search && (
                <button
                  type="button"
                  // Keep the caret in the search box: a plain click would blur it first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setSearch(""); setHighlight(0); searchRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            // Picking with the mouse must not blur the search box first — that reports a blur the
            // parent reads as "field left empty" a tick before onChange lands.
            onMouseDown={(event) => event.preventDefault()}
            className="overflow-y-auto flex-1 min-h-0 max-h-64 py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-6 text-center">
                <p className="text-sm font-medium text-slate-500">No matches</p>
                {search && <p className="mt-0.5 text-xs text-slate-400">Nothing matched “{search}”</p>}
              </li>
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
                    className={`relative mx-1 flex items-center gap-2 rounded-lg pl-3 pr-2.5 py-2 text-sm cursor-pointer ${
                      highlighted ? tone.highlight : ""
                    } ${selected ? `${tone.selected} font-semibold` : "text-slate-700"}`}
                  >
                    {highlighted && (
                      <span className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full ${tone.bar}`} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <Marked text={option.label} tokens={tokens} markClass={tone.mark} />
                      </span>
                      {option.sublabel && (
                        <span className="mt-0.5 block truncate text-xs font-normal text-slate-400">
                          <Marked text={option.sublabel} tokens={tokens} markClass={tone.mark} />
                        </span>
                      )}
                    </span>
                    {selected && <Check className="w-4 h-4 shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] font-medium text-slate-400 flex-shrink-0">
            <span>
              {filteredOptions.length} {filteredOptions.length === 1 ? "result" : "results"}
              {search && safeOptions.length !== filteredOptions.length ? ` of ${safeOptions.length}` : ""}
            </span>
            <span className="hidden sm:inline">↑↓ move · ↵ select · esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}
