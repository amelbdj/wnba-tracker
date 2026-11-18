// Audience measurement (Umami, self-hosted — see ops/umami and the privacy
// page). Everything here is best-effort: if the script is blocked, not loaded
// yet, or the visitor opted out, these calls quietly do nothing.
//
// What is sent is deliberately small. Page views come from the script itself
// (it follows the router's history changes); `track` adds a few named actions.
// Never pass free text the visitor typed (e.g. what they searched for).

// The key Umami's own script checks before sending anything.
const OPT_OUT_KEY = "umami.disabled";

export function isOptedOut() {
  try {
    return Boolean(localStorage.getItem(OPT_OUT_KEY));
  } catch {
    return false; // storage unavailable
  }
}

export function setOptedOut(optedOut) {
  try {
    if (optedOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // storage blocked: nothing we can remember
  }
}

export function track(name, data) {
  try {
    if (isOptedOut()) return;
    const umami = globalThis.umami;
    if (umami && typeof umami.track === "function") umami.track(name, data);
  } catch {
    // measurement must never break the page
  }
}
