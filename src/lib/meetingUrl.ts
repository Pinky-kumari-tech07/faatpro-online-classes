/**
 * Normalize a meeting URL entered by a user (Zoom / Google Meet / Teams / custom).
 * Guarantees the returned string starts with http:// or https:// so that
 * anchor tags and window.open never resolve it as a relative path
 * (which would otherwise turn `meet.google.com/...` into
 * `https://faatpro.com/app/meet.google.com/...`).
 */
import { parseHttpUrl } from "./validators/url";

export function normalizeMeetingUrl(input?: string | null): string {
  const url = parseHttpUrl(input);
  // Never fabricate a link from arbitrary text like "abcd123".
  return url ? url.toString() : "";
}