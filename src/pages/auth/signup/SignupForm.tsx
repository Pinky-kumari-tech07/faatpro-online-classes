import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { authService } from "@/services/supabase";
import type { SignupRole } from "@/services/supabase/authService";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail, normalizeEmail, validatePhone, normalizePhone, validatePassword, PASSWORD_RULES } from "@/lib/validators";
import { DEFAULT_AUTH_DESTINATION, authSearchForDestination, clearPostLoginRedirect, getNextSearchPath, getPostLoginDestination, savePostLoginRedirect } from "@/lib/authRedirect";

// Learner-first fallback: students who signed up without a specific destination
// should land on the public course catalog rather than the app dashboard.
const STUDENT_SIGNUP_FALLBACK = "/courses";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.64-2.54C16.86 3.3 14.66 2.3 12 2.3 6.94 2.3 2.86 6.38 2.86 11.4S6.94 20.5 12 20.5c6.92 0 9.14-4.86 9.14-7.4 0-.5-.06-.88-.14-1.26z"/>
  </svg>
);

export default function SignupForm({
  role,
  title,
  subtitle,
}: {
  role: SignupRole;
  title: string;
  subtitle: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [phoneTakenError, setPhoneTakenError] = useState("");
  
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [teachingSampleUrl, setTeachingSampleUrl] = useState("");
  const [showMoreInstructor, setShowMoreInstructor] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const nav = useNavigate();

  const isInstructor = role === "instructor";
  // Phone is mandatory for instructor signup, optional for students — but when
  // supplied it must satisfy the same shared rule everywhere in the product.
  const phoneDigits = normalizePhone(phone).replace(/\D/g, "");
  const phoneCheck = validatePhone(phone, { required: isInstructor, label: "Mobile number" });
  const phoneValid = phoneCheck.valid && (!phone || /^\d{10}$/.test(phoneDigits.slice(-10)) ? true : false);
  const phoneError =
    phoneTakenError ||
    (phoneTouched && phoneCheck.valid === false ? phoneCheck.message : "");

  const emailCheck = validateEmail(email, { required: true });
  const emailError = emailTouched && emailCheck.valid === false ? emailCheck.message : "";

  const passwordCheck = validatePassword(password);
  const passwordError = passwordTouched && passwordCheck.valid === false ? passwordCheck.message : "";

  // Preserve the "return here" destination across signup, email verification,
  // and Google OAuth so guests who came from a course/cart page land back
  // exactly where they started.
  const nextPath = getNextSearchPath();
  const destination = getPostLoginDestination();
  const roleFallback = role === "student" ? STUDENT_SIGNUP_FALLBACK : DEFAULT_AUTH_DESTINATION;
  const resolvedDestination = destination === DEFAULT_AUTH_DESTINATION ? roleFallback : destination;
  const redirectTarget = nextPath ?? resolvedDestination;
  useEffect(() => {
    if (nextPath) savePostLoginRedirect(nextPath);
  }, [nextPath]);
  const nextQuery = authSearchForDestination(
    resolvedDestination === DEFAULT_AUTH_DESTINATION && !nextPath ? null : resolvedDestination,
  );


  const canSubmit = useMemo(() => {
    if (!accepted || !fullName.trim()) return false;
    if (emailCheck.valid === false) return false;
    if (passwordCheck.valid === false) return false;
    if (password !== confirmPassword) return false;
    if (phoneCheck.valid === false) return false;
    return true;
  }, [accepted, fullName, emailCheck.valid, passwordCheck.valid, password, confirmPassword, phoneCheck.valid]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    setPhoneTouched(true);
    setPhoneTakenError("");

    if (emailCheck.valid === false) {
      toast.error(emailCheck.message);
      return;
    }
    if (phoneCheck.valid === false) {
      toast.error(phoneCheck.message);
      return;
    }
    if (passwordCheck.valid === false) {
      toast.error(passwordCheck.message);
      return;
    }
    if (isInstructor && !phoneDigits) {
      setPhoneTouched(true);
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // Pre-flight uniqueness check so the user gets a field-level error
      // instead of a generic failure. The database unique index remains the
      // authoritative guard against concurrent signups.
      if (phoneDigits) {
        const { data: available, error: availErr } = await supabase.rpc("is_phone_available", {
          _phone: phoneDigits,
        } as any);
        if (!availErr && available === false) {
          setPhoneTakenError("This phone number is already registered. Sign in instead.");
          toast.error("This phone number is already registered.");
          setLoading(false);
          return;
        }
      }
      authService.setSelectedSignupRole(role);
      if (redirectTarget !== DEFAULT_AUTH_DESTINATION) savePostLoginRedirect(redirectTarget);
      const res = await authService.registerWithRole({
        email: normalizeEmail(email), password, fullName: fullName.trim(),
        phone: phoneDigits || undefined,
        role,
        redirectTo: redirectTarget !== DEFAULT_AUTH_DESTINATION ? redirectTarget : undefined,
        bio: bio || undefined,
        yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
        linkedinUrl: linkedinUrl || undefined,
        teachingSampleUrl: teachingSampleUrl || undefined,
      });
      if (res.session) {
        toast.success("Account created");
        const destinationAfterSignup = getPostLoginDestination() || redirectTarget;
        clearPostLoginRedirect();
        nav(destinationAfterSignup, { replace: true });
      } else {
        toast.success("Check your email to verify your account");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      if (/profiles_phone_normalized_key|duplicate key|23505/i.test(message)) {
        setPhoneTakenError("This phone number is already registered. Sign in instead.");
        toast.error("This phone number is already registered.");
      } else if (/invalid_phone/i.test(message)) {
        setPhoneTakenError("Enter a valid mobile number.");
        toast.error("Enter a valid mobile number.");
      } else if (/invalid_email/i.test(message)) {
        toast.error("Enter a valid email address.");
      } else if (/already\s*(registered|exists)|user\s*already/i.test(message)) {
        const loginHref = `/auth/login${authSearchForDestination(redirectTarget !== DEFAULT_AUTH_DESTINATION ? redirectTarget : null)}`;
        toast.error("This account already exists. Please sign in.", {
          duration: 8000,
          action: { label: "Sign in", onClick: () => nav(loginHref) },
        });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    try {
      authService.setSelectedSignupRole(role);
      if (redirectTarget !== DEFAULT_AUTH_DESTINATION) savePostLoginRedirect(redirectTarget);
      const res = await authService.signInWithGoogle(redirectTarget !== DEFAULT_AUTH_DESTINATION ? redirectTarget : undefined);
      if (res?.error) throw new Error(String(res.error));
      if (!res?.redirected) {
        const destinationAfterSignup = getPostLoginDestination() || redirectTarget;
        clearPostLoginRedirect();
        nav(destinationAfterSignup, { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign up failed");
    }
  };

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const googleLabel = isInstructor ? "Sign up as instructor with Google" : "Sign up as student with Google";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-[32px] xl:text-[36px] font-bold tracking-tight leading-tight">{title}</h2>
        <p className="text-[16px] xl:text-[17px] text-muted-foreground">{subtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Input
            className="h-[52px] text-[17px]"
            placeholder="Full name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            aria-label="Full name (required)"
          />
        </div>
        <div>
          <Input
            type="email"
            className={cn("h-[52px] text-[17px]", emailError && "border-destructive focus-visible:ring-destructive")}
            placeholder="Email address *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
            aria-invalid={!!emailError}
            aria-label="Email address (required)"
          />
          {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
        </div>
        <div>
          <Input
            className={cn(
              "h-[52px] text-[17px]",
              phoneError && "border-destructive focus-visible:ring-destructive",
            )}
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder={isInstructor ? "10-digit mobile number *" : "Phone number (optional)"}
            value={phone}
            onChange={(e) => { setPhoneTakenError(""); setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 13)); }}
            onBlur={() => setPhoneTouched(true)}
            required={isInstructor}
            aria-invalid={!!phoneError}
            aria-label={isInstructor ? "Mobile number (required)" : "Phone number"}
          />
          {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
        </div>


        <div className="relative">
          <Input
            type={showPwd ? "text" : "password"}
            minLength={8}
            className="h-[52px] text-[17px] pr-11"
            placeholder="Password *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPwd ? "Hide password" : "Show password"}
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <Input
            type={showConfirm ? "text" : "password"}
            minLength={8}
            className={cn(
              "h-[52px] text-[17px] pr-11",
              passwordMismatch && "border-destructive focus-visible:ring-destructive",
            )}
            placeholder="Confirm password *"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="text-xs -mt-1 space-y-1">
          {passwordMismatch && <p className="text-destructive">Passwords do not match.</p>}
          {passwordError && <p className="text-destructive">{passwordError}</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
            {PASSWORD_RULES.map((r) => {
              const met = r.test(password);
              return (
                <li key={r.id} className={cn(met && "text-primary")}>
                  {met ? "✓" : "•"} {r.label}
                </li>
              );
            })}
          </ul>
        </div>

        {isInstructor && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowMoreInstructor((s) => !s)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMoreInstructor && "rotate-180")} />
              {showMoreInstructor ? "Hide instructor details" : "Add more instructor details"}
            </button>
            {showMoreInstructor && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <Textarea
                  rows={2}
                  placeholder="Short teaching bio (optional)"
                  className="text-[15px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  className="h-[52px] text-[17px]"
                  placeholder="Years of experience (optional)"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                />
                <Input
                  className="h-[52px] text-[17px]"
                  placeholder="LinkedIn or website (optional)"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
                <Input
                  className="h-[52px] text-[17px]"
                  placeholder="Teaching sample URL (optional)"
                  value={teachingSampleUrl}
                  onChange={(e) => setTeachingSampleUrl(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <label className="flex items-start gap-3 text-[14px] cursor-pointer">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
            <span className="text-foreground leading-snug">
              I agree to the FAATPRO{" "}
              <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms</Link>,{" "}
              <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">Privacy Policy</Link>, and{" "}
              <Link to="/code-of-conduct" target="_blank" className="text-primary hover:underline font-medium">Code of Conduct</Link>.
            </span>
          </label>
        </div>

        <Button type="submit" className="w-full h-[52px] text-[17px] font-semibold" disabled={!canSubmit || loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>

        {!isInstructor && (
          <>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-muted px-3 text-muted-foreground tracking-wider">or</span>
              </div>
            </div>

            <Button
              type="button" variant="outline"
              className="w-full h-[50px] text-[16px] font-medium gap-3"
              onClick={onGoogle}
            >
              <GoogleIcon />
              {googleLabel}
            </Button>
          </>
        )}
      </form>

      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{" "}
        <Link to={`/auth/login${nextQuery}`} className="text-primary font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  );
}