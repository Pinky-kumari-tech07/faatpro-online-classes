import { supabase } from "@/integrations/supabase/client";

/**
 * Buckets that are NOT public. Files in these buckets must be read through a
 * short-lived signed URL — a `getPublicUrl(...)` link returns 400/404.
 */
const PRIVATE_BUCKETS = new Set(["lesson-files", "lesson-assets", "submissions", "instructor-documents"]);

const OBJECT_URL_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/;

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const m = OBJECT_URL_RE.exec(url);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Returns a usable URL for a stored file. Public buckets are returned as-is;
 * private buckets get a freshly signed URL so enrolled students (and staff)
 * can actually open the file.
 */
export async function resolveStorageUrl(
  urlOrPath: string | null | undefined,
  opts: { bucket?: string; expiresIn?: number } = {},
): Promise<string | null> {
  const value = String(urlOrPath ?? "").trim();
  if (!value) return null;

  const parsed = value.startsWith("http") ? parseStorageUrl(value) : null;
  const bucket = parsed?.bucket ?? opts.bucket;
  const path = parsed?.path ?? (value.startsWith("http") ? null : value);

  if (!bucket || !path) return value;
  if (!PRIVATE_BUCKETS.has(bucket)) return value;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, opts.expiresIn ?? 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
