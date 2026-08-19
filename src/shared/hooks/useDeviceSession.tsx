import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";
import {
  registerSession,
  heartbeatSession,
  checkCurrentSessionActive,
  clearDeviceToken,
} from "@/services/supabase/sessionService";
import { authService } from "@/services/supabase";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

export type SessionBlock = { max_devices: number; active: number } | null;

// Inactivity policy
const INACTIVITY_WARN_MS = 28 * 60 * 1000; // show warning at 28 min
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000; // auto logout at 30 min
const ACTIVITY_THROTTLE_MS = 60 * 1000; // don't spam heartbeats

export function useDeviceSession() {
  const { user } = useAuth();
  const { membership, isLoading } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [block, setBlock] = useState<SessionBlock>(null);
  const [inactivityWarn, setInactivityWarn] = useState(false);
  const registered = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastPingRef = useRef<number>(0);
  const warnTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

  const doInactivityLogout = useCallback(async () => {
    setInactivityWarn(false);
    try { await authService.signOut("inactivity_timeout"); } catch { /* ignore */ }
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    toast({ title: "Signed out", description: "You were logged out due to inactivity." });
    navigate(`/auth/login?next=${next}`, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  const scheduleInactivityTimers = useCallback(() => {
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    warnTimerRef.current = window.setTimeout(() => setInactivityWarn(true), INACTIVITY_WARN_MS);
    logoutTimerRef.current = window.setTimeout(() => { void doInactivityLogout(); }, INACTIVITY_LOGOUT_MS);
  }, [doInactivityLogout]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setInactivityWarn(false);
    scheduleInactivityTimers();
    if (Date.now() - lastPingRef.current > ACTIVITY_THROTTLE_MS) {
      lastPingRef.current = Date.now();
      heartbeatSession().catch(() => {});
    }
  }, [scheduleInactivityTimers]);

  const continueSession = useCallback(() => {
    markActivity();
  }, [markActivity]);

  useEffect(() => {
    if (!user || isLoading) return;
    const wsId = membership?.workspace.id ?? null;
    const key = `${user.id}:${wsId ?? "none"}`;
    if (registered.current === key) return;
    registered.current = key;

    (async () => {
      try {
        const res = await registerSession(wsId);
        if (res.status === "limit_exceeded") {
          setBlock({ max_devices: res.max_devices, active: res.active });
        } else {
          setBlock(null);
        }
      } catch (e) {
        // ignore – don't block app on tracking failure
      }
    })();

    const heartbeat = setInterval(() => {
      heartbeatSession().catch(() => {});
    }, 60_000);

    const validator = setInterval(async () => {
      const ok = await checkCurrentSessionActive();
      if (!ok) {
        clearInterval(heartbeat);
        clearInterval(validator);
        clearDeviceToken();
        await authService.signOut();
        toast({
          title: "Signed out",
          description: "This device was logged out remotely.",
        });
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        navigate(`/auth/login?next=${next}`, { replace: true });
      }
    }, 45_000);

    // Activity listeners — only meaningful interactions.
    const events = ["click", "keydown", "scroll", "touchstart"] as const;
    const onActivity = () => {
      if (document.visibilityState === "hidden") return;
      markActivity();
    };
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onActivity);
    scheduleInactivityTimers();

    return () => {
      clearInterval(heartbeat);
      clearInterval(validator);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onActivity);
      if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    };
  }, [user, membership, isLoading, navigate, location.pathname, location.search, location.hash, markActivity, scheduleInactivityTimers]);

  // Re-arm timers on route change (page navigation counts as activity).
  useEffect(() => {
    if (!user) return;
    markActivity();
  }, [location.pathname, user, markActivity]);

  const dismissBlock = () => setBlock(null);

  const retry = async () => {
    if (!user) return;
    const wsId = membership?.workspace.id ?? null;
    const res = await registerSession(wsId);
    if (res.status === "limit_exceeded") {
      setBlock({ max_devices: res.max_devices, active: res.active });
    } else {
      setBlock(null);
    }
  };

  return {
    block,
    dismissBlock,
    retry,
    inactivityWarn,
    continueSession,
    logoutNow: doInactivityLogout,
  };
}