// src/features/profile/api/signatureService.js
//
// Authorised-signatory signature — the frontend half of the contract.
//
// ═══ WHAT THIS IS, AND WHAT IT IS NOT ══════════════════════════════════════════════════════════
// An ELECTRONIC signature: a captured image of a handwritten mark, stored against the company and
// stamped into quotation PDFs beside a printed name.
//
// It is NOT a Digital Signature Certificate. No PKI, no X.509, no keystore, no cryptographic
// signing of the document. Nothing here proves who signed or that the file is unaltered — it
// reproduces the look of a signed page, which is what a quotation needs and all it needs. If a
// legally-binding DSC is ever required that is a different feature with a different threat model;
// do not grow this one into it.
//
// ═══ WHY THESE ENDPOINTS ARE SEPARATE FROM THE COMPANY UPDATE ══════════════════════════════════
// This is the single most important note in the file.
//
// PUT /api/company carries the CompanyDTO, and that DTO is what quotation rendering reads for the
// PDF header block — company name, address, GSTIN. Adding signature fields to it would put the
// signature in the blast radius of every quotation that gets generated: one mapper change, one
// null where a String was expected, and PDFs stop rendering for a feature that has nothing to do
// with them.
//
// So the signature has its own endpoints, its own DTO and its own columns. The frontend mirrors
// that separation exactly — SignatureSection holds its own state and never touches the company
// form object. Do not "simplify" this later by folding the fields into CompanyDTO.
//
// ═══ WHAT THE BACKEND MUST GUARANTEE ═══════════════════════════════════════════════════════════
//
// 1. UNGUESSABLE FILENAMES. A predictable path like /uploads/signatures/{companyId}.png means any
//    authenticated user who can read a company id can fetch another tenant's signature — an image
//    that appears on their contracts. Store under a random opaque key (UUID or hash), never one
//    derived from the tenant identifier.
//
// 2. THE URL IS NOT A PUBLIC STATIC PATH. Obscurity is a mitigation, not a control. Serve
//    signatureUrl through an authenticated, tenant-scoped route so that guessing the key is not
//    enough. (Consequence: see obligation 4 — the PDF pipeline cannot fetch that URL.)
//
// 3. PERMISSIONS. Writes (POST/PATCH/DELETE) require SETTINGS_MANAGE. Reads (GET) are open to any
//    authenticated tenant user — a salesperson needs to see whose signature goes on their
//    quotation without being able to change it.
//
// 4. THE PDF PIPELINE MUST EMBED BASE64, NOT A URL OR A FILE PATH. The renderer used for these
//    documents fetches image src values without the session's credentials, so an authenticated URL
//    resolves to nothing and — this is the dangerous part — it renders NOTHING RATHER THAN FAILING.
//    The PDF comes out looking complete, with the signature silently missing. Read the bytes
//    server-side and inline them as a data: URI.
//
// 5. LOADING THE SIGNATURE DURING PDF GENERATION MUST NOT BE ABLE TO THROW. Wrap the read so a
//    missing, moved or corrupt file yields null and the template simply omits the block. A
//    quotation that fails to generate because a signature file was moved is a worse outcome than a
//    quotation printed without a signature — the customer is waiting for the document either way.
//
// 6. signatureEnabled IS THE PDF PIPELINE'S RESPONSIBILITY. Nothing on this screen reads it; it
//    exists solely so an owner can keep a stored signature while temporarily leaving it off
//    documents. If the template ignores the flag, the toggle silently does nothing forever.

import API from "@shared/api/http";

/* Matches the 2MB cap the logo and favicon uploads already enforce in EditProfileTab. Restated
   here rather than imported because this component does its own upload and must not depend on
   that one — see the isolation note above. */
export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

/* PNG first — it is the only one of the two that carries transparency, and a signature without
   transparency paints a rectangle over whatever sits behind it in the PDF footer. JPG is accepted
   because most people photograph or scan a signature on paper, and refusing that outright would
   send them away rather than let the UI warn them about the white background. */
export const SIGNATURE_ACCEPT = "image/png,image/jpeg";

export const signatureService = {
  /* ── GET /api/company/signature ──────────────────────────────────────────────────────────────
     The first call the section makes, and it MUST NOT 404 when nothing has been set up.

     "No signature yet" is a normal state for every company that has never opened this screen —
     which is all of them, on day one. The UI reserves 404/501 to mean something entirely
     different: "this endpoint is not deployed on this server". Returning 404 for an empty
     signature makes a working backend indistinguishable from a missing one, and the screen will
     tell the user the feature is unavailable when in fact it is working perfectly.

     Return 200 with hasSignature:false instead.

     → { hasSignature:          boolean,
         signatureUrl:          string|null,   // authenticated URL — see obligation 2
         signatoryName:         string|null,   // "Rajesh Kumar"
         signatoryDesignation:  string|null,   // "Managing Director"
         sealUrl:               string|null,   // optional round stamp, independent of the signature
         signatureEnabled:      boolean,       // include it on quotations at all
         updatedAt:             ISO string|null } */
  get: () => API.get("/company/signature"),

  /* ── POST /api/company/signature ─────────────────────────────────────────────────────────────
     multipart/form-data: file, signatoryName, signatoryDesignation

     The name and designation ride WITH the file rather than in a follow-up call so that capturing
     a signature is one atomic action. Splitting it means a failure between the two calls leaves an
     image on file with nobody's name under it, which is exactly the thing that renders as an
     anonymous scribble on a customer's quotation.

     `file` is a trimmed, transparent PNG produced by SignaturePad, or an image the user uploaded.

     → the same shape as GET.
     Returning the full state rather than just a url means the UI never has to guess what the
     server stored, and never has to construct a URL itself. */
  upload: (file, signatoryName, signatoryDesignation) => {
    const formData = new FormData();
    formData.append("file", file);
    // Empty string rather than omitted: a missing multipart part and a deliberately cleared field
    // are different intents, and the server should be able to tell them apart.
    formData.append("signatoryName", signatoryName || "");
    formData.append("signatoryDesignation", signatoryDesignation || "");
    return API.post("/company/signature", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /* ── POST /api/company/signature/seal ────────────────────────────────────────────────────────
     multipart/form-data: file

     A company seal or rubber stamp, printed beside the signature on documents that expect one.
     Entirely OPTIONAL and entirely INDEPENDENT: a company may have a seal and no signature, or a
     signature and no seal, and neither upload may disturb the other.

     → the same shape as GET. */
  uploadSeal: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return API.post("/company/signature/seal", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /* ── PATCH /api/company/signature ────────────────────────────────────────────────────────────
     body: { signatoryName, signatoryDesignation, signatureEnabled }

     Metadata only — no file. Deliberately separate from the POST above so that correcting a
     misspelled name, or turning the signature off for a month, does not require re-drawing it. A
     re-draw would produce a visibly different signature on documents for no reason the user asked
     for.

     → the same shape as GET. */
  updateMeta: (body) => API.patch("/company/signature", body),

  /* ── DELETE /api/company/signature ───────────────────────────────────────────────────────────
     Removes the signature image and its metadata. The seal is NOT removed — it is a separate
     artefact with its own delete below.

     → the same shape as GET, now with hasSignature:false, so the UI can render the post-delete
       state without a second round trip. */
  remove: () => API.delete("/company/signature"),

  /* ── DELETE /api/company/signature/seal ──────────────────────────────────────────────────────
     Removes only the seal. The signature is untouched.

     → the same shape as GET. */
  removeSeal: () => API.delete("/company/signature/seal"),
};

export default signatureService;
