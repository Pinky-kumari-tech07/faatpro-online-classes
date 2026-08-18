import { ReactNode } from "react";
import AuthLogo from "./AuthLogo";

export default function AuthLayout({ children, title, subtitle }: {
  children: ReactNode; title: string; subtitle?: string;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-muted">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-brand text-primary-foreground relative overflow-hidden">
        <div className="relative z-10">
          <AuthLogo darkBg />
        </div>
        <div className="relative z-10 space-y-3 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">A calmer way to run your academy.</h1>
          <p className="text-primary-foreground/80">
            Multi-tenant workspaces, role-based dashboards, and content-first learning — all in one place.
          </p>
        </div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-20 -left-20 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}