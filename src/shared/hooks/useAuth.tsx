import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/supabase";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If the URL still contains OAuth tokens, defer settling auth state
    // until SIGNED_IN fires — prevents protected routes from bouncing to /auth/login.
    const url = typeof window !== "undefined" ? window.location : null;
    const hasOAuthTokens = !!url && (
      /access_token=|refresh_token=/.test(url.hash || "") ||
      /[?&]code=/.test(url.search || "")
    );

    let settled = false;
    const settle = (s: Session | null) => {
      settled = true;
      setSession(s);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // INITIAL_SESSION always fires once after the client hydrates from storage
      // (including in a fresh tab). Treat it — and every subsequent event — as
      // the source of truth so the app never stays stuck on a loading screen.
      settle(s);
      if (event === "SIGNED_IN" && s) {
        setTimeout(async () => {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("status, is_active, total_login_count")
              .eq("id", s.user.id)
              .maybeSingle();
            // Block deactivated students.
            if (prof && (prof as any).is_active === false) {
              await supabase.auth.signOut();
              if (typeof window !== "undefined") {
                const msg = "Your account has been temporarily deactivated. Please contact support.";
                try { sessionStorage.setItem("auth_block_message", msg); } catch {}
                window.location.href = "/auth/login?deactivated=1";
              }
              return;
            }
            if (prof?.status === "deleted") {
              // Reactivate as a fresh account without forcing profile setup.
              await supabase
                .from("profiles")
                .update({
                  status: "active",
                  deleted_at: null,
                })
                .eq("id", s.user.id);
            }
            // Track last login (best-effort).
            try {
              await supabase
                .from("profiles")
                .update({
                  last_login_at: new Date().toISOString(),
                  total_login_count: ((prof as any)?.total_login_count ?? 0) + 1,
                })
                .eq("id", s.user.id);
            } catch { /* ignore */ }
          } catch { /* ignore */ }
          authService.finalizePendingSignupIfAny().catch(() => {});
        }, 0);
      }
    });
    // Belt-and-braces: also fetch the current session directly. If the auth
    // listener never fires (network hiccup, tab throttled on background load),
    // this still resolves the loading gate.
    supabase.auth.getSession()
      .then(({ data }) => {
        if (settled) return;
        // Don't end loading on a null session if OAuth tokens are still being parsed.
        if (data.session || !hasOAuthTokens) settle(data.session);
      })
      .catch(() => {
        if (!settled) settle(null);
      });

    // Absolute safety timeout — never leave the app on a blank loading screen.
    // If nothing has resolved auth after 6s, treat the user as signed out so
    // routes render instead of hanging forever.
    const failsafe = window.setTimeout(() => {
      if (!settled) settle(null);
    }, 6000);

    // Cross-tab sync: when Supabase writes/removes its token in localStorage
    // (login/logout on another tab), refresh our session snapshot.
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !/^sb-.*-auth-token$/.test(e.key)) return;
      supabase.auth.getSession().then(({ data }) => settle(data.session)).catch(() => {});
    };
    window.addEventListener("storage", onStorage);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(failsafe);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);