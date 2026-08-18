import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/supabase";
import { clearPostLoginRedirect, getPostLoginDestination } from "@/lib/authRedirect";

const DEACTIVATED_MESSAGE = "Your account has been temporarily deactivated. Please contact support.";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = async (session: unknown) => {
      if (cancelled) return;
      const isActive = await authService.isCurrentUserActive();
      if (!isActive) {
        await supabase.auth.signOut();
        try { sessionStorage.setItem("auth_block_message", DEACTIVATED_MESSAGE); } catch { /* ignore */ }
        navigate("/auth/login?deactivated=1", { replace: true });
        return;
      }
      // Apply the OAuth signup role BEFORE navigating so that role-based
      // dashboard routing sees the correct role on first render.
      try { await authService.applySelectedSignupRoleIfNew(); } catch { /* ignore */ }
      // Honor ?next first, then pending post-login redirect, and only then dashboard.
      const dest = getPostLoginDestination(window.location.search);
      try {
        clearPostLoginRedirect();
      } catch { /* ignore */ }
      try {
        const clean = window.location.origin + dest;
        window.history.replaceState({}, "", clean);
      } catch { /* ignore */ }
      // eslint-disable-next-line no-console
      console.log("[oauth-callback] session established", { hasSession: !!session, dest });
      navigate(dest, { replace: true });
    };

    const fail = (msg: string) => {
      if (cancelled) return;
      // eslint-disable-next-line no-console
      console.error("[oauth-callback] failed:", msg);
      setError(msg);
      setTimeout(() => navigate("/auth/login", { replace: true }), 1500);
    };

    (async () => {
      try {
        const hash = window.location.hash || "";
        const search = window.location.search || "";
        // eslint-disable-next-line no-console
        console.log("[oauth-callback] received", { hash: hash.slice(0, 60), search: search.slice(0, 60) });

        // Surface broker / provider errors first
        const qp = new URLSearchParams(search);
        const hp = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const errCode = qp.get("error") || hp.get("error");
        const errDesc = qp.get("error_description") || hp.get("error_description");
        if (errCode || errDesc) {
          // eslint-disable-next-line no-console
          console.error("[oauth-callback] provider/broker error", { errCode, errDesc });
          fail(`${errCode ?? "oauth_error"}: ${errDesc ?? "unknown"}`);
          return;
        }

        // Listen for SIGNED_IN as a safety net
        const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
          // eslint-disable-next-line no-console
          console.log("[oauth-callback] authStateChange", event, !!s);
          if (event === "SIGNED_IN" && s) {
            sub.subscription.unsubscribe();
            void finish(s);
          }
        });

        // PKCE / authorization-code flow (?code=...)
        const params = new URLSearchParams(search);
        const code = params.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          // eslint-disable-next-line no-console
          console.log("[oauth-callback] exchangeCodeForSession", { ok: !error, hasSession: !!data?.session, error: error?.message });
          if (error) { sub.subscription.unsubscribe(); fail(error.message); return; }
          if (data.session) { sub.subscription.unsubscribe(); await finish(data.session); return; }
        }

        // Implicit flow (#access_token=...) — getSession triggers detection
        const { data, error } = await supabase.auth.getSession();
        // eslint-disable-next-line no-console
        console.log("[oauth-callback] getSession", { hasSession: !!data?.session, error: error?.message });
        if (data?.session) { sub.subscription.unsubscribe(); await finish(data.session); return; }

        // Wait briefly for SIGNED_IN, otherwise fail
        setTimeout(() => {
          if (cancelled) return;
          sub.subscription.unsubscribe();
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (d2?.session) void finish(d2.session);
            else fail("No session after OAuth callback");
          });
        }, 4000);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          {error ? `Sign-in failed: ${error}` : "Completing sign in…"}
        </p>
      </div>
    </div>
  );
}