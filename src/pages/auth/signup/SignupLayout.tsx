import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Radio, ClipboardList } from "lucide-react";
import AuthLogo from "@/modules/auth/AuthLogo";

const SIGNUP_VISUAL = "/auth/faappro-signup-visual.jpg";

export interface LeftPanelCopy {
  headline: string;
  subtext: string;
  bullets: string[];
}

export default function SignupLayout({
  left,
  children,
}: {
  left: LeftPanelCopy;
  children: ReactNode;
}) {
  const icons = [BadgeCheck, Radio, ClipboardList];
  const location = useLocation();
  const authSearch = location.search || "";
  return (
    <div className="min-h-screen lg:h-screen lg:grid lg:grid-cols-[40%_60%] bg-surface-muted lg:overflow-hidden">
      {/* Left brand / visual panel */}
      <aside className="relative overflow-hidden bg-gradient-brand text-primary-foreground lg:h-screen p-8 xl:p-10 flex flex-col justify-between min-h-[260px]">
        {/* Background image with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${SIGNUP_VISUAL})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/75 to-accent/60" aria-hidden />

        {/* Logo */}
        <div className="relative z-10">
          <AuthLogo darkBg />
        </div>

        {/* Headline & bullets (desktop only) */}
        <div className="hidden lg:block relative z-10 space-y-6 max-w-md">
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              {left.headline}
            </h1>
            <p className="text-primary-foreground/85 text-[15px] leading-relaxed">
              {left.subtext}
            </p>
          </div>
          <ul className="space-y-2.5">
            {left.bullets.map((label, i) => {
              const Icon = icons[i % icons.length];
              return (
                <li key={label} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/15 grid place-items-center backdrop-blur border border-white/20">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-primary-foreground/95">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="hidden lg:block relative z-10 text-xs text-primary-foreground/60">
          © FAATPRO
        </p>
      </aside>

      {/* Right form panel */}
      <main className="flex flex-col lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-6 md:px-10 pt-5 pb-2 shrink-0">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to homepage
          </Link>
          <Link to={`/auth/login${authSearch}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 md:px-10 py-6">
          <div className="w-full max-w-[600px]">{children}</div>
        </div>
      </main>
    </div>
  );
}