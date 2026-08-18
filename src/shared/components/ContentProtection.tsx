import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useContentProtection } from "@/shared/hooks/useContentProtection";
import { useAuth } from "@/shared/hooks/useAuth";
import { toast } from "sonner";

/**
 * Global content protection layer.
 *
 * Wires the workspace's Content Protection Settings into:
 *  - contextmenu / dragstart / copy / cut / selectstart handlers
 *  - DevTools shortcut blockers (F12, Ctrl/Cmd+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+P, Ctrl+A, Ctrl+C, Ctrl+X)
 *  - DevTools open detection (blurs [data-premium] areas, shows banner)
 *  - Print blocking
 *  - CSS rules disabling text selection and image/video dragging
 *  - Dynamic and video watermark via [data-premium] / video elements
 *
 * Inputs in <input>, <textarea>, [contenteditable], .allow-select stay fully usable.
 */
export default function ContentProtection() {
  const s = useContentProtection();
  const { user } = useAuth();
  const location = useLocation();
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  const isPublicSite =
    !location.pathname.startsWith("/app") &&
    !location.pathname.startsWith("/learn") &&
    !location.pathname.startsWith("/checkout") &&
    !location.pathname.startsWith("/auth") &&
    !location.pathname.includes("/lessons/") &&
    !location.pathname.includes("/preview");

  const isProtectedLearningSurface =
    location.pathname.startsWith("/app") ||
    location.pathname.startsWith("/learn") ||
    location.pathname.startsWith("/checkout") ||
    location.pathname.includes("/lessons/") ||
    location.pathname.includes("/preview");

  // Keep public/auth pages completely free of global blocking CSS/handlers so
  // stale preview protection can never make the whole site look blank.
  const enabled = isProtectedLearningSurface;

  // ---- Global event handlers ----
  useEffect(() => {
    if (!enabled) return;
    const inField = (t: EventTarget | null) => {
      if (!t) return false;
      // Event targets may be Text/Document nodes without .closest — resolve to the nearest Element.
      let el: Element | null = null;
      if (t instanceof Element) el = t;
      else if (t instanceof Node && (t as Node).parentElement) el = (t as Node).parentElement;
      if (!el || typeof (el as any).closest !== "function") return false;
      return !!el.closest("input, textarea, [contenteditable=true], .allow-select");
    };

    const onContext = (e: MouseEvent) => {
      if (!s.disable_right_click) return;
      if (inField(e.target)) return;
      e.preventDefault();
    };
    const onDrag = (e: DragEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "IMG" || t.tagName === "VIDEO" || t.closest("[data-premium]"))) {
        e.preventDefault();
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      if (inField(e.target)) return;
      if (isPublicSite && !(e.target as HTMLElement)?.closest?.("[data-premium], .protected-content")) {
        if (!s.disable_copy) return;
      }
      e.preventDefault();
    };
    const onSelectStart = (e: Event) => {
      if (!s.disable_text_selection) return;
      if (inField(e.target)) return;
      if ((e.target as HTMLElement)?.closest?.("[data-premium], .protected-content")) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (!s.disable_keyboard_shortcuts) return;
      if (e.key === "F12") return e.preventDefault();
      if (mod && e.shiftKey && ["i", "j", "c"].includes(k)) return e.preventDefault();
      if (mod && k === "u") return e.preventDefault();
      if (mod && k === "s") return e.preventDefault();
      if (mod && k === "p") return e.preventDefault();
      if (mod && ["a", "c", "x"].includes(k) && !inField(e.target)) {
        const el = e.target as HTMLElement;
        if (el?.closest?.("[data-premium], .protected-content")) e.preventDefault();
      }
    };
    const onBeforePrint = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", onContext);
    document.addEventListener("dragstart", onDrag);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeprint", onBeforePrint);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("dragstart", onDrag);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, [enabled, s]);

  // ---- DevTools detection ----
  useEffect(() => {
    if (!enabled || !s.devtools_detection) return;
    // Skip devtools detection inside iframes (e.g. Lovable preview) and on
    // dev/preview hostnames where browser dock/zoom trigger false positives.
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const isDevHost = /localhost|127\.0\.0\.1|lovableproject\.com|lovable\.app/i.test(host);
    if (inIframe || isDevHost) return;
    const check = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 200;
      const heightThreshold = window.outerHeight - window.innerHeight > 200;
      setDevtoolsOpen(widthThreshold || heightThreshold);
    };
    check();
    const id = window.setInterval(check, 1500);
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", check);
    };
  }, [enabled, s.devtools_detection]);

  // ---- CSS rules (selection / image / video / print) ----
  useEffect(() => {
    if (!enabled) return;
    const style = document.createElement("style");
    style.setAttribute("data-content-protection", "true");
    const css: string[] = [];
    if (s.disable_text_selection) {
      css.push(`
        [data-premium], .protected-content {
          -webkit-user-select: none; -ms-user-select: none; user-select: none;
        }
        [data-premium] input, [data-premium] textarea, [data-premium] [contenteditable=true],
        .protected-content input, .protected-content textarea, .protected-content [contenteditable=true],
        .allow-select, .allow-select * {
          -webkit-user-select: text !important; user-select: text !important;
        }
      `);
    }
    if (s.disable_image_drag) {
      css.push(`img, video { -webkit-user-drag: none; user-drag: none; }`);
    }
    if (s.disable_print) {
      css.push(`@media print { body { display: none !important; } }`);
    }
    if (devtoolsOpen && s.devtools_detection) {
      css.push(`[data-premium] > :not([data-devtools-banner]) { filter: blur(14px) !important; pointer-events: none !important; }`);
    }
    style.textContent = css.join("\n");
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [enabled, s, devtoolsOpen]);

  // ---- Toast for blocked shortcut (one-time soft hint) ----
  useEffect(() => {
    if (!enabled || !s.disable_keyboard_shortcuts) return;
    let warned = false;
    const onKey = (e: KeyboardEvent) => {
      if (warned) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "F12" || (mod && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase()))) {
        warned = true;
        try { toast("Developer tools are disabled for protected content."); } catch {}
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, s.disable_keyboard_shortcuts]);

  // ---- DevTools banner ----
  if (enabled && devtoolsOpen && s.devtools_detection) {
    return (
      <div
        data-devtools-banner
        className="fixed inset-x-0 top-0 z-[9999] bg-destructive text-destructive-foreground text-center text-sm py-2 px-4 shadow-lg"
      >
        Developer tools detected. Please close DevTools to continue learning.
      </div>
    );
  }

  // Watermark identity (used by PremiumWatermark below)
  void user;
  return null;
}

/**
 * Drop into any premium surface (lesson body, PDF viewer, etc.):
 *   <div data-premium className="relative">
 *     <PremiumWatermark />
 *     ...content...
 *   </div>
 */
export function PremiumWatermark({ label }: { label?: string }) {
  const { user } = useAuth();
  const s = useContentProtection();
  const [pos, setPos] = useState({ x: 20, y: 20 });
  useEffect(() => {
    if (!s.dynamic_watermark) return;
    const id = window.setInterval(() => {
      setPos({ x: Math.random() * 70 + 5, y: Math.random() * 80 + 5 });
    }, 8000);
    return () => window.clearInterval(id);
  }, [s.dynamic_watermark]);
  if (!s.dynamic_watermark) return null;
  const name = (user?.user_metadata as any)?.full_name || user?.email || "Guest";
  const email = user?.email ?? "";
  const stamp = new Date().toLocaleString();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute select-none text-xs font-medium text-foreground/30 mix-blend-difference transition-all duration-1000"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "rotate(-18deg)" }}
    >
      <div>{label ?? "FAATPRO"} · {name}</div>
      <div>{email}</div>
      <div>{stamp}</div>
    </div>
  );
}