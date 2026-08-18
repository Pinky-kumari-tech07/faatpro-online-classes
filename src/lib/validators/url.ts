import { fail, ok, type ValidationResult } from "./types";

/**
 * Strict URL validation. Unlike the old behaviour we never invent a scheme for
 * bare text like "abcd123" — the value must parse as a real http(s) URL with a
 * dotted hostname (or localhost).
 */
export function parseHttpUrl(value: unknown): URL | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname;
  if (!host) return null;
  const isLocalhost = host === "localhost";
  // Require a real dotted hostname with a TLD of at least 2 letters.
  if (!isLocalhost && !/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host)) return null;
  return url;
}

export function isValidHttpUrl(value: unknown): boolean {
  return parseHttpUrl(value) !== null;
}

export function validateUrl(
  value: unknown,
  opts: { required?: boolean; label?: string; httpsOnly?: boolean } = {},
): ValidationResult {
  const label = opts.label ?? "URL";
  const raw = String(value ?? "").trim();
  if (!raw) return opts.required ? fail(`${label} is required`) : ok();
  const url = parseHttpUrl(raw);
  if (!url) return fail(`${label} must be a valid link, e.g. https://example.com/path`);
  if (opts.httpsOnly && url.protocol !== "https:") return fail(`${label} must start with https://`);
  return ok();
}

/** Meeting links must be https and resolve to a real host. */
export function validateMeetingUrl(
  value: unknown,
  opts: { required?: boolean } = {},
): ValidationResult {
  const raw = String(value ?? "").trim();
  if (!raw) return opts.required ? fail("Meeting URL is required") : ok();
  const url = parseHttpUrl(raw);
  if (!url) {
    return fail("Enter a full meeting link, e.g. https://meet.google.com/abc-defg-hij");
  }
  if (url.protocol !== "https:") return fail("Meeting URL must start with https://");
  return ok();
}

/**
 * Normalizes a valid meeting URL to an absolute https link.
 * Returns "" when the input is not a valid URL (never fabricates a link).
 */
export function normalizeMeetingUrlStrict(value: unknown): string {
  const url = parseHttpUrl(value);
  if (!url) return "";
  return url.toString();
}