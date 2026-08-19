import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AuthLayout from "@/modules/auth/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/supabase";
import { PASSWORD_RULES, validatePassword } from "@/lib/validators";

type LinkState = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const nav = useNavigate();

  // The recovery link puts a one-time token in the URL which supabase-js
  // exchanges for a short-lived session. Without that session there is nothing
  // to update, so surface an explicit "expired link" state instead of failing
  // silently on submit.
  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) setLinkState("valid");
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setLinkState(data.session ? "valid" : "invalid");
    })();
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const check = validatePassword(password);
  const error = touched && check.valid === false ? check.message : "";
  const mismatch = confirm.length > 0 && password !== confirm;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (check.valid === false) return toast.error(check.message);
    if (password !== confirm) return toast.error("Passwords do not match");
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      toast.success("Password updated. Please sign in with your new password.");
      // Invalidate the recovery session so the reset link cannot be replayed.
      await authService.signOut();
      nav("/auth/login", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update password";
      if (/expired|invalid|not authenticated|session/i.test(msg)) setLinkState("invalid");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (linkState === "checking") {
    return (
      <AuthLayout title="Set a new password">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verifying your reset link…
        </div>
      </AuthLayout>
    );
  }

  if (linkState === "invalid") {
    return (
      <AuthLayout title="Reset link expired">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>This password reset link is invalid or has already been used. Request a new one to continue.</p>
          <Button asChild className="w-full"><Link to="/auth/forgot-password">Request a new link</Link></Button>
          <p className="text-center">
            <Link to="/auth/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={!!error}
            className={cn(error && "border-destructive focus-visible:ring-destructive")}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 text-xs text-muted-foreground">
            {PASSWORD_RULES.map((r) => (
              <li key={r.id} className={cn(r.test(password) && "text-primary")}>
                {r.test(password) ? "✓" : "•"} {r.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">Confirm new password</Label>
          <Input
            id="pw2"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            className={cn(mismatch && "border-destructive focus-visible:ring-destructive")}
            required
          />
          {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</>) : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
