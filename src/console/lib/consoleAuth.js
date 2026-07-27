// Platform console session storage.
//
// SuperAdmin tokens are deliberately tab-scoped: sessionStorage survives reloads in
// the current tab, but not browser restarts and not new tabs. Old localStorage keys
// are cleared on read/write as a one-time migration from the previous implementation.

const TOKEN_KEY = "sa_token";
const NAME_KEY = "sa_name";
const EMAIL_KEY = "sa_email";
const ROLE_KEY = "sa_role";
const KEYS = [TOKEN_KEY, NAME_KEY, EMAIL_KEY, ROLE_KEY];

function read(key) {
  const current = sessionStorage.getItem(key);
  const legacy = localStorage.getItem(key);
  if (legacy) localStorage.removeItem(key);
  return current || legacy;
}

function write(key, value) {
  if (value) sessionStorage.setItem(key, value);
  localStorage.removeItem(key);
}

export function getConsoleToken() {
  return read(TOKEN_KEY);
}

export function isConsoleAuthed() {
  return !!getConsoleToken();
}

export function setConsoleSession({ token, name, email, role } = {}) {
  write(TOKEN_KEY, token);
  write(NAME_KEY, name);
  write(EMAIL_KEY, email);
  write(ROLE_KEY, role);
}

export function getConsoleIdentity() {
  return {
    name: read(NAME_KEY) || "Super Admin",
    email: read(EMAIL_KEY) || "",
    role: read(ROLE_KEY) || "SUPER_ADMIN",
  };
}

export function clearConsoleSession() {
  KEYS.forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
}
