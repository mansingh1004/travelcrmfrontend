import partnerClient from "./transportPartnerClient";

const unwrap = (res) => res?.data?.data ?? res?.data;

/** The token is a live credential — encode it, and never log it. */
const path = (token, suffix = "") =>
  `/transport-partner/registrations/${encodeURIComponent(token)}${suffix}`;

/**
 * The photo limits the SERVER enforces, restated here so the UI can say them before a file is
 * picked rather than after a 5 MB upload comes back rejected.
 *
 * `MAX_PHOTOS` is counted across the WHOLE registration, not per vehicle — `TransportPartnerUploadService`
 * sums every vehicle's gallery. A ten-vehicle fleet therefore shares forty photos between them,
 * which is the one limit an operator can hit without doing anything unreasonable.
 */
export const PHOTO_LIMITS = {
  maxMb: 5,
  maxPhotos: 40,
  accept: "image/jpeg,image/png,image/webp",
  hint: "JPG, PNG or WebP · up to 5 MB each",
};

/**
 * True when the failure is specifically an EXPIRED link.
 *
 * Broken out of {@link partnerErrorMessage} because expiry is the one token failure with a fix the
 * operator can act on — ask whoever invited them for a fresh link — and it therefore earns its own
 * screen rather than a line in a red box. 404 (never valid) and 409 (withdrawn) have no such action,
 * so they stay generic.
 */
export const isLinkExpired = (err) => err?.response?.status === 410;

/**
 * Maps a backend error to the message the page shows.
 *
 * The three token failures are distinct on purpose and the backend gives each its own status:
 * 404 unknown, 410 expired, 409 withdrawn or no-longer-editable. Rendering one generic "something
 * went wrong" here would strand an operator who just needs to ask for a fresh link.
 *
 * The server message wins whenever there is one. That is not politeness — on submit the backend
 * answers with EVERY outstanding problem joined into a single sentence, and that sentence is the
 * whole point of the call. Rewriting it would throw away the only complete answer the operator gets.
 */
export function partnerErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message;
  if (serverMsg) return serverMsg;
  if (status === 404) return "This registration link is not valid.";
  if (status === 410) return "This registration link has expired. Please ask for a new one.";
  if (status === 409) return "This registration link is no longer active.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (err?.code === "ECONNABORTED") return "The connection timed out. Please try again.";
  if (!err?.response) return "You appear to be offline. Your changes are not saved yet.";
  return fallback;
}

export const transportPartnerService = {
  /** Open the link. The backend creates the draft on first call, so this doubles as "start". */
  resolve: (token) => partnerClient.get(path(token)).then(unwrap),

  /** Autosave. Sends the WHOLE document — every vehicle and every rate. The backend replaces, it does not merge. */
  saveDraft: (token, payload) => partnerClient.put(path(token), payload).then(unwrap),

  submit: (token) => partnerClient.post(path(token, "/submit")).then(unwrap),

  /**
   * Upload one vehicle photo and get back its URL.
   *
   * The caller places the URL in the right vehicle's array and the next autosave persists it — the
   * endpoint stores nothing itself, which is what lets one endpoint serve a form whose vehicles have
   * no server-side identity until they are saved. A photo taken for a vehicle the operator then
   * deletes is simply never referenced.
   *
   * Overrides the client's 45s timeout: a phone photo over mobile data regularly exceeds it, and an
   * axios timeout produces no `error.response` at all, so it would surface as "offline".
   *
   * There is deliberately no place-lookup call here, unlike the hotel form's Google search. A hotel
   * is a fixed address a guest navigates to; an operator's sellable unit is a VEHICLE, which is at no
   * address at all — what matters is the city it works out of, and that is a plain field on the form.
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
