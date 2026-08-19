import partnerClient from "./hotelPartnerClient";

const unwrap = (res) => res?.data?.data ?? res?.data;

/** The token is a live credential — encode it, and never log it. */
const path = (token, suffix = "") =>
  `/hotel-partner/registrations/${encodeURIComponent(token)}${suffix}`;

/**
 * Maps a backend error to the message the page shows.
 *
 * The three token failures are distinct on purpose and the backend gives each its own status:
 * 404 unknown, 410 expired, 409 withdrawn. Rendering one generic "something went wrong" here would
 * strand an owner who just needs to ask for a fresh link.
 */
export function partnerErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message;
  if (serverMsg) return serverMsg;
  if (status === 404) return "This registration link is not valid.";
  if (status === 410) return "This registration link has expired. Please ask for a new one.";
  if (status === 409) return "This registration link is no longer active.";
  if (err?.code === "ECONNABORTED") return "The connection timed out. Please try again.";
  if (!err?.response) return "You appear to be offline. Your changes are not saved yet.";
  return fallback;
}

export const hotelPartnerService = {
  /** Open the link. The backend creates the draft on first call, so this doubles as "start". */
  resolve: (token) => partnerClient.get(path(token)).then(unwrap),

  /** Autosave. Sends the WHOLE form — the backend replaces, it does not merge. */
  saveDraft: (token, payload) => partnerClient.put(path(token), payload).then(unwrap),

  submit: (token) => partnerClient.post(path(token, "/submit")).then(unwrap),

  /**
   * Candidate Google listings for this property, so the owner can pick their own.
   *
   * Stores nothing. The chosen place id rides along on the next autosave like any other field, which
   * is what keeps it under the same partner-editability rule as the rest of the form.
   *
   * `q` is optional — blank makes the backend search on the property's own name and address, which
   * is what the owner would have typed. An empty array is a NORMAL answer, not a failure: the
   * feature may be off, Google may know nothing, or the hourly cap may be spent.
   */
  searchGoogle: (token, q) =>
    partnerClient
      .get(path(token, "/google/search"), { params: q ? { q } : {} })
      .then((res) => unwrap(res) ?? []),

  /**
   * Upload one photo (hotel or room) and get back its URL.
   *
   * The caller places the URL in the right array and the next autosave persists it — the endpoint
   * stores nothing itself, which is what lets one endpoint serve both hotel and room photos.
   *
   * Overrides the client's 45s timeout: a phone photo over mobile data regularly exceeds it, and an
   * axios timeout produces no `error.response` at all, so it would surface as "offline".
   */
  uploadImage: (token, file, onProgress) => {
    const body = new FormData();
    body.append("file", file);
    return partnerClient
      .post(path(token, "/images"), body, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((res) => unwrap(res)?.imagePath);
  },
};
