import { Link, useLocation } from "react-router-dom";
import { UserCheck, BookOpen, ArrowRight, ArrowLeft, Check } from "lucide-react";
import AuthLogo from "@/modules/auth/AuthLogo";
import { Button } from "@/components/ui/button";

const ROLES = [
  {
    to: "/auth/register/student",
    title: "Student account",
    desc: "Join courses, attend live classes, and earn verified certificates.",
    Icon: BookOpen,
    bullets: ["Enroll in courses", "Track lesson progress", "Submit assignments"],
    cta: "Continue as student",
  },
  {
    to: "/auth/register/instructor",
    title: "Instructor account",
    desc: "Build courses, host live sessions, and support your learners.",
    Icon: UserCheck,
    bullets: ["Create courses & lessons", "Grade quizzes & assignments", "Host live classes"],
    cta: "Continue as instructor",
  },
];

export default function RegisterPage() {
  const location = useLocation();
  const authSearch = location.search || "";
  // Default learners to the course catalog when no explicit destination was set.
  const studentSearch = authSearch || "?next=/courses";
  return (
    <div className="min-h-screen flex flex-col bg-surface-muted">
      <div className="flex items-center justify-between px-6 md:px-10 pt-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to homepage
        </Link>
        <AuthLogo />
        <Link to={`/auth/login${authSearch}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Sign in
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-4xl space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h1 className="text-[34px] md:text-[44px] font-bold tracking-tight leading-tight">
              Join FAATPRO
            </h1>
            <p className="text-[17px] md:text-[18px] text-muted-foreground">
              Choose the right account type to continue.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {ROLES.map(({ to, title, desc, Icon, bullets, cta }) => (
              <Link
                key={to}
                to={`${to}${to.endsWith("/student") ? studentSearch : authSearch}`}
                className="group rounded-2xl border border-border bg-card p-7 transition-all hover:border-primary/60 hover:shadow-lg flex flex-col"
              >
                <div className="h-14 w-14 rounded-2xl bg-gradient-brand text-primary-foreground grid place-items-center mb-5 shadow-md">
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground leading-relaxed">{desc}</p>
                <ul className="mt-5 space-y-2">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2.5 text-[14px] text-foreground/85">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-6 h-[48px] text-[15px] font-semibold w-full justify-between group-hover:bg-primary/90"
                >
                  <span>
                    {cta}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              </Link>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to={`/auth/login${authSearch}`} className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}