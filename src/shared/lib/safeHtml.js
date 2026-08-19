// shared/lib/safeHtml.js
// ─────────────────────────────────────────────────────────────────────────────
// The only sanctioned way to put HTML on screen.
//
// WHY THIS EXISTS
// Five places in this app rendered server-persisted, user-authored HTML through
// dangerouslySetInnerHTML with no sanitizer anywhere in the dependency tree — a
// marketing campaign body, an add-on description, a cruise description. All three
// are written in a contentEditable by one staff user, stored, and re-rendered for
// another: a colleague opening a campaign to approve it, or an admin editing a
// master row. That is stored XSS between users of the same tenant, and the token
// and permission cache both live in localStorage, so the payload runs with the
// reader's session.
//
// HOW TO USE IT
//     <div dangerouslySetInnerHTML={safeHtml(value)} />
// The helper returns the {__html} object React wants, so the call site cannot
// accidentally pass raw text — if you are constructing that object by hand, you
// are bypassing this file.
//
// WHAT IT ALLOWS
// The tags a rich-text editor in this app can actually produce, plus links and
// images, and nothing else. No <script>, no <iframe>, no <style>, no event
// handlers, no javascript:/data: URLs (DOMPurify drops those by default — the
// explicit ALLOWED_URI_REGEXP is belt to that braces because email bodies do
// legitimately carry mailto: and tel:).
//
// Sanitizing at RENDER, not at save, is deliberate: content already in the
// database was written before this existed, and a save-time filter would leave
// every existing row dangerous while looking like the problem was solved.
// ─────────────────────────────────────────────────────────────────────────────
import DOMPurify from "dompurify";

const CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "div", "span",
    "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "code",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "hr",
  ],
  ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt", "width", "height", "style"],
  // style is allowed because pasted email bodies are unreadable without it, but DOMPurify still
  // strips expression()/behaviour and anything that resolves to script.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "link", "meta"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "formaction"],
};

/* Every link that survives opens in a new tab and cannot reach back through window.opener.
   Registered once at module load; DOMPurify hooks are global to the instance. */
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Sanitize `html` and hand back React's `dangerouslySetInnerHTML` payload.
 *
 * @param {string} html untrusted markup — a campaign body, a master description, an email body
 * @returns {{__html: string}} safe to spread into dangerouslySetInnerHTML
 */
export function safeHtml(html) {
  return { __html: DOMPurify.sanitize(String(html ?? ""), CONFIG) };
}

/**
 * Sanitize to a plain string, for the rare caller that needs the markup itself rather than the
 * React payload (e.g. building an email body to send).
 */
export function sanitizeHtml(html) {
  return DOMPurify.sanitize(String(html ?? ""), CONFIG);
}

/**
 * Strip every tag and return readable text — for a preview line, a list row, or any surface that
 * must never render markup at all.
 */
export function htmlToText(html) {
  const stripped = DOMPurify.sanitize(String(html ?? ""), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  // DOMPurify escapes entities on the way out; a textarea round-trip decodes them without
  // executing anything, which is the standard safe decode.
  const el = document.createElement("textarea");
  el.innerHTML = stripped;
  return el.value.replace(/\n{3,}/g, "\n\n").trim();
}
