import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import AuthLayout from "@/modules/auth/AuthLayout";
import { authService } from "@/services/supabase";
import { DEFAULT_AUTH_DESTINATION, authSearchForDestination, clearPostLoginRedirect, getNextSearchPath, getPostLoginDestination, savePostLoginRedirect } from "@/lib/authRedirect";

const DEACTIVATED_MESSAGE = "Your account has been temporarily deactivated. Please contact support.";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const nav = useNavigate();

  const nextPath = getNextSearchPath();
  const destination = getPostLoginDestination();
  const redirectTarget = nextPath ?? destination;
  const nextQuery = authSearchForDestination(destination === DEFAULT_AUTH_DESTINATION && !nextPath ? null : destination);

  useEffect(() => {
    if (nextPath) savePostLoginRedirect(nextPath);
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("deactivated") === "1") {
        const msg = sessionStorage.getItem("auth_block_message")
          || DEACTIVATED_MESSAGE;
        setAuthNotice(msg);
        toast.error(msg, { duration: 8000 });
        sessionStorage.removeItem("auth_block_message");
        const url = new URL(window.location.href);
        url.searchParams.delete("deactivated");
        window.history.replaceState({}, "", url.toString());
      }
    } catch { /* ignore */ }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (redirectTarget !== DEFAULT_AUTH_DESTINATION) savePostLoginRedirect(redirectTarget);
      await authService.signInWithPassword(email, password);
      try { await authService.finalizePendingSignupIfAny(); } catch { /* ignore */ }
      const destinationAfterLogin = getPostLoginDestination();
      clearPostLoginRedirect();
      nav(destinationAfterLogin, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      if (message === DEACTIVATED_MESSAGE) setAuthNotice(message);
      toast.error(message);
    } finally { setLoading(false); }
  };

  const onGoogle = async () => {
    try {
      if (redirectTarget !== DEFAULT_AUTH_DESTINATION) savePostLoginRedirect(redirectTarget);
      const res = await authService.signInWithGoogle(redirectTarget !== DEFAULT_AUTH_DESTINATION ? redirectTarget : undefined);
      if (res?.error) throw new Error(String(res.error));
      if (!res?.redirected) {
        const destinationAfterLogin = getPostLoginDestination();
        clearPostLoginRedirect();
        nav(destinationAfterLogin, { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign in failed");
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your workspace.">
      {authNotice && (
        <Alert variant="destructive">
          <AlertDescription>{authNotice}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth/forgot" className="text-xs text-primary hover:underline">Forgot?</Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={onGoogle}>
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to={`/auth/register${nextQuery}`} className="text-primary font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}