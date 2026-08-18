import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AuthLayout from "@/modules/auth/AuthLayout";
import { authService } from "@/services/supabase";
import { normalizeEmail, validateEmail } from "@/lib/validators";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const check = validateEmail(email, { required: true });
  const error = touched && check.valid === false ? check.message : "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (check.valid === false) return toast.error(check.message);
    setSending(true);
    try {
      await authService.resetPassword(normalizeEmail(email));
      // Always show the same confirmation — never reveal whether the address
      // is registered (account-enumeration protection).
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/rate limit|too many/i.test(msg)) {
        toast.error("Too many reset attempts. Please try again in a few minutes.");
      } else {
        setSent(true);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link.">
      {sent ? (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            If an account exists for{" "}
            <span className="text-foreground font-medium">{normalizeEmail(email)}</span>, a password
            reset link is on its way. The link expires shortly and can only be used once.
          </p>
          <p>Didn't get it? Check your spam folder, then <button type="button" className="text-primary hover:underline font-medium" onClick={() => setSent(false)}>try again</button>.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={!!error}
              className={cn(error && "border-destructive focus-visible:ring-destructive")}
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>) : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="text-sm text-center text-muted-foreground">
        <Link to="/auth/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
