import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Resets scroll to the top on every PUSH/REPLACE navigation.
 * Preserves scroll for POP (browser Back/Forward).
 * Resets both the window and any in-app scroll containers marked with
 * [data-scroll-root].
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (navType === "POP") return;
    if (hash) return; // let anchor links behave normally

    const scrollAll = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      } catch {
        window.scrollTo(0, 0);
      }
      document.querySelectorAll<HTMLElement>("[data-scroll-root]").forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    };

    // Run after the destination page has rendered.
    scrollAll();
    const raf = requestAnimationFrame(scrollAll);
    return () => cancelAnimationFrame(raf);
  }, [pathname, search, navType, hash]);

  return null;
}