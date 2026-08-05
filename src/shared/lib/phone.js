// src/shared/lib/phone.js
//
// One phone rule, mirroring the server's own annotation:
//
//   @Pattern(regexp = "^\\+?[1-9]\\d{7,14}$", message = "Enter a valid phone number")
//
// i.e. an optional leading "+", a first digit of 1-9 (no leading zero), and 8-15 digits in
// total - and NO spaces, dashes, brackets or dots.
//
// The forms used to carry five different regexes of their own, all of which permitted separators
// the server rejects: /^[+\d\s\-()]{7,20}$/ on the lead form, {7,15} on a dead copy, and {7,16}
// on the customer and vendor forms. The lead form's own placeholder, "+91 98765 43210", passed
// every one of those and failed the server - the field told the user what to type and the save
// then 400'd.
//
// The fix is to accept what people actually type and normalise before sending, rather than to
// forbid separators in the UI: a number pasted from WhatsApp or Word carries a non-breaking
// space, and rejecting it would move the annoyance rather than remove it.

/**
 * Strip everything the server's pattern will not accept.
 *
 * JS \s already matches U+00A0, the non-breaking space that WhatsApp Web and Word paste in, so
 * no separate escape is needed for it. Three of the five old regexes had been patched to allow
 * that character explicitly, which is the clue that it turns up often.
 *
 * A leading "+" is PRESERVED: the server's pattern allows it, and dropping it would silently
 * rewrite how an international number is stored.
 */
export const normalizePhone = (value) =>
  String(value ?? "")
    .replace(/[\s().‐-―-]/g, "")
    .trim();

/** The server's pattern, verbatim. Change this only when the annotation changes. */
export const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

/** Would the server accept this, once normalised? */
export const isValidPhone = (value) => PHONE_PATTERN.test(normalizePhone(value));

/**
 * react-hook-form rule. Validates the NORMALISED value, so "+91 98765 43210", "9876543210" and
 * "(+91) 98765-43210" are all accepted - they normalise to something the server takes - while
 * "0987654321" (leading zero) and "123" are still rejected, exactly as the server rejects them.
 *
 * `validate`, not `pattern`: `pattern` tests the raw field value and cannot normalise first.
 */
export const phoneRule = {
  required: "Phone number is required",
  validate: (value) => isValidPhone(value) || "Enter a valid phone number",
};
