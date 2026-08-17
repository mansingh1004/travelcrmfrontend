// features/whatsapp/components/MailEditor.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A formatting toolbar for the email body.
//
// Same idiom the rest of the app already uses — a contentEditable div driven by
// document.execCommand (Sightseeing, AddonService and the quotation builder each
// carry their own copy). No editor library is added for this: the dependency is
// heavier than the feature, and a fourth idiom on one screen would be worse than
// a third copy of the existing one.
//
// Two things email needs that those copies do not have:
//   • a LINK button — an email without one is a link pasted as raw text, and
//     "click here" is most of what an agency actually sends
//   • paste as plain text — pasting from Word or another mail client otherwise
//     drags in font tags and background colours that survive into the customer's
//     inbox looking nothing like what the operator saw
//
// Uncontrolled by design: React must not own innerHTML while the caret lives in
// it — re-rendering a contentEditable from state moves the cursor to the start on
// every keystroke. The parent seeds it once and reads changes through onChange.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Eraser, Strikethrough,
} from "lucide-react";

export default function MailEditor({
  initialValue = "",
  onChange,
  placeholder = "Write your email…",
  minHeight = 150,
}) {
  const ref = useRef(null);

  // Seeded ONCE. A dependency on initialValue would fight the caret — the parent
  // remounts with a new key when it genuinely wants a fresh body.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialValue || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange?.(ref.current?.innerHTML ?? "");

  const exec = (e, command, arg = null) => {
    // onMouseDown + preventDefault, never onClick: a click steals focus from the
    // editable first, and execCommand with no selection silently does nothing.
    e.preventDefault();
    document.execCommand(command, false, arg);
    ref.current?.focus();
    emit();
  };

  const addLink = (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    const selected = sel ? String(sel).trim() : "";
    // eslint-disable-next-line no-alert
    const url = window.prompt(
      selected ? `Link "${selected}" to which address?` : "Paste the link address",
      "https://",
    );
    if (!url || url === "https://") return;
    ref.current?.focus();
    if (selected) {
      document.execCommand("createLink", false, url);
    } else {
      // Nothing selected — insert the URL as its own link rather than creating an
      // invisible empty anchor the operator cannot see or remove.
      document.execCommand("insertHTML", false,
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    }
    emit();
  };

  const onPaste = (e) => {
    // Plain text only. Rich paste carries the source's fonts and colours, which
    // reach the customer looking broken and are near-impossible to strip after.
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, text);
    emit();
  };

  const Btn = ({ title, onDown, children }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={onDown}
      className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-colors">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        <Btn title="Bold (Ctrl+B)" onDown={(e) => exec(e, "bold")}><Bold className="w-3.5 h-3.5" strokeWidth={2.5} /></Btn>
        <Btn title="Italic (Ctrl+I)" onDown={(e) => exec(e, "italic")}><Italic className="w-3.5 h-3.5" /></Btn>
        <Btn title="Underline (Ctrl+U)" onDown={(e) => exec(e, "underline")}><Underline className="w-3.5 h-3.5" /></Btn>
        <Btn title="Strikethrough" onDown={(e) => exec(e, "strikeThrough")}><Strikethrough className="w-3.5 h-3.5" /></Btn>
        <span className="w-px h-4 bg-slate-300 mx-1" />
        <Btn title="Bulleted list" onDown={(e) => exec(e, "insertUnorderedList")}><List className="w-3.5 h-3.5" /></Btn>
        <Btn title="Numbered list" onDown={(e) => exec(e, "insertOrderedList")}><ListOrdered className="w-3.5 h-3.5" /></Btn>
        <span className="w-px h-4 bg-slate-300 mx-1" />
        <Btn title="Insert link" onDown={addLink}><Link2 className="w-3.5 h-3.5" /></Btn>
        <Btn title="Clear formatting" onDown={(e) => exec(e, "removeFormat")}><Eraser className="w-3.5 h-3.5" /></Btn>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Email body"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        style={{ minHeight }}
        className="w-full px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-700 outline-none overflow-y-auto
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5
          [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_u]:underline
          [&_a]:text-blue-600 [&_a]:underline
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
      />
    </div>
  );
}
