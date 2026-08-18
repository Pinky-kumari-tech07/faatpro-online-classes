import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const CACHE_RESET_VERSION = "2026-07-24-course-assets-upload-fix";

async function clearStalePreviewCaches() {
  if (typeof window === "undefined") return;

  // Always unregister any service worker — this app never registers one, so
  // any SW present is stale from a previous deploy and can serve a blank shell.
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }

  // Version-gated one-time cache + protection style purge.
  try {
    const lastReset = window.localStorage.getItem("faatpro.cacheResetVersion");
    if (lastReset === CACHE_RESET_VERSION) return;

    if ("caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
    }

    document.querySelectorAll("style[data-content-protection]").forEach((node) => node.remove());
    document.documentElement.style.filter = "";
    document.body.style.filter = "";
    document.body.style.opacity = "";

    window.localStorage.setItem("faatpro.cacheResetVersion", CACHE_RESET_VERSION);
  } catch {
    // Cache cleanup must never block app rendering.
  }
}

void clearStalePreviewCaches();

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>,
  );
}
