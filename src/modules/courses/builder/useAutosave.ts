import { useEffect, useRef, useState } from "react";

/**
 * Calls saveFn every `intervalMs` ms while `dirty` is true.
 * Returns last saved timestamp.
 */
export function useAutosave(opts: {
  dirty: boolean;
  saveFn: () => Promise<void>;
  intervalMs?: number;
  enabled?: boolean;
}) {
  const { dirty, saveFn, intervalMs = 60000, enabled = true } = opts;
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(async () => {
      if (!dirtyRef.current || saving) return;
      setSaving(true);
      try {
        await saveFn();
        setLastSavedAt(Date.now());
      } catch {
        // swallow; explicit Save button will surface errors
      } finally {
        setSaving(false);
      }
    }, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);

  return { lastSavedAt, saving, setLastSavedAt };
}

export function formatRelative(ts: number | null) {
  if (!ts) return "Not saved yet";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "Saved just now";
  if (s < 60) return `Saved ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Saved ${m}m ago`;
  return `Saved ${new Date(ts).toLocaleTimeString()}`;
}