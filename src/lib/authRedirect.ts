export const POST_LOGIN_REDIRECT_KEY = "post_login_redirect";
// Persisted (localStorage) so the intent survives a NEW TAB — email
// confirmation links and some OAuth flows open a fresh tab where
// sessionStorage is empty. Only non-sensitive navigation context is stored.
const REDIRECT_TTL_MS = 60 * 60 * 1000;
// Post-login lands at /app which role-routes via AppIndexRedirect
// (staff → /app/courses, everyone else → /app/dashboard).
export const DEFAULT_AUTH_DESTINATION = "/app";

export function getAllowedPostLoginPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  const normalized = path.toLowerCase();
  if (
    normalized === "/profile" ||
    normalized.startsWith("/profile/") ||
    normalized === "/settings" ||
    normalized.startsWith("/settings/") ||
    normalized === "/app/settings" ||
    normalized.startsWith("/app/settings") ||
    normalized.includes("onboarding")
  ) {
    return null;
  }
  return path;
}

export function getNextSearchPath(search: string = window.location.search) {
  try {
    return getAllowedPostLoginPath(new URLSearchParams(search).get("next"));
  } catch {
    return null;
  }
}

export function getStoredPostLoginRedirect() {
  try {
    const raw =
      localStorage.getItem(POST_LOGIN_REDIRECT_KEY) ??
      sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (!raw) return null;
    // New format: {"p":"/courses/x?checkout=1","t":1699999999}
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as { p?: string; t?: number };
      if (!parsed?.p) return null;
      if (parsed.t && Date.now() - parsed.t > REDIRECT_TTL_MS) {
        clearPostLoginRedirect();
        return null;
      }
      return getAllowedPostLoginPath(parsed.p);
    }
    return getAllowedPostLoginPath(raw);
  } catch {
    return null;
  }
}

export function savePostLoginRedirect(path: string | null | undefined) {
  const allowed = getAllowedPostLoginPath(path);
  try {
    if (allowed) {
      const payload = JSON.stringify({ p: allowed, t: Date.now() });
      localStorage.setItem(POST_LOGIN_REDIRECT_KEY, payload);
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, payload);
    } else {
      localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    }
  } catch {
    // ignore storage failures
  }
  return allowed;
}

export function clearPostLoginRedirect() {
  try {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch { /* ignore */ }
}

export function getPostLoginDestination(search: string = window.location.search) {
  return getNextSearchPath(search) ?? getStoredPostLoginRedirect() ?? DEFAULT_AUTH_DESTINATION;
}

export function authSearchForDestination(path: string | null | undefined) {
  const allowed = getAllowedPostLoginPath(path);
  return allowed ? `?next=${encodeURIComponent(allowed)}` : "";
}

export function authCallbackUrlForDestination(path: string | null | undefined) {
  const allowed = getAllowedPostLoginPath(path);
  const base = `${window.location.origin}/auth/callback`;
  return allowed ? `${base}?next=${encodeURIComponent(allowed)}` : base;
}