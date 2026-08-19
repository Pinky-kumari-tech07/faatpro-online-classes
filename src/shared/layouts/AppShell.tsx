import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, FileText, ClipboardList,
  Video, Award, BarChart3, Settings, Search, LogOut,
  PlayCircle, Megaphone, MessagesSquare, MessageCircle, Package,
  CreditCard, Receipt, LineChart, Plug, ShieldCheck, Shield, ScrollText, Tags,
  User as UserIcon, LifeBuoy, Sparkles, Menu, X, Wallet,
  Building2, ChevronDown, ChevronRight, Landmark, Bell as BellIcon, AlertTriangle, ArrowLeftRight, Plus, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import faatproLogo from "@/assets/faatpro-logo.png.asset.json";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { authService } from "@/services/supabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import NotificationBell from "@/modules/notifications/NotificationBell";
import { useDeviceSession } from "@/shared/hooks/useDeviceSession";
import { DeviceLimitDialog } from "@/modules/security/DeviceLimitDialog";
import { NoticeTicker } from "@/modules/notices/NoticeTicker";
import InstructorAgreementGate from "@/modules/auth/InstructorAgreementGate";
import { useLocation } from "react-router-dom";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  badge?: string;
  children?: NavItem[];
};
type NavGroup = { label?: string; items: NavItem[] };

const adminGroups: NavGroup[] = [
  {
    items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Academic",
    items: [
      {
        to: "/app/courses",
        label: "Courses",
        icon: BookOpen,
        children: [
          { to: "/app/courses", label: "All Courses", icon: BookOpen, end: true },
          { to: "/app/courses/new", label: "Create Course", icon: Plus },
          { to: "/app/categories", label: "Categories", icon: Tags },
          { to: "/app/bundles", label: "Course Bundles", icon: Package },
        ],
      },
      { to: "/app/students", label: "Students", icon: Users },
      {
        to: "/app/batches",
        label: "Batches",
        icon: Users,
        children: [
          { to: "/app/batches", label: "Batch Management", icon: Users, end: true },
          { to: "/app/reports/batches", label: "Batch Reports", icon: BarChart3 },
        ],
      },
      {
        to: "/app/institutions",
        label: "Institutions",
        icon: Building2,
        children: [
          { to: "/app/institutions", label: "Institution Management", icon: Building2, end: true },
          { to: "/app/reports/institutions", label: "Institution Reports", icon: BarChart3 },
        ],
      },
      {
        to: "/app/instructor-verification",
        label: "Instructors",
        icon: ShieldCheck,
        children: [
          { to: "/app/instructor-verification", label: "Instructor Verification", icon: ShieldCheck, end: true },
          { to: "/app/instructors/transfer-report", label: "Transfer Report", icon: BarChart3 },
          { to: "/app/courses-deletion-requests", label: "Course Deletion Requests", icon: AlertTriangle },
          { to: "/app/finance/revenue/reports", label: "Instructor Reports", icon: BarChart3 },
          { to: "/app/finance/revenue/models", label: "Revenue Models", icon: Landmark },
          { to: "/app/finance/revenue/earnings", label: "Instructor Earnings", icon: Wallet },
          { to: "/app/finance/revenue/settlements", label: "Settlement Requests", icon: Wallet },
          { to: "/app/finance/revenue/history", label: "Settlement History", icon: Receipt },
        ],
      },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/app/announcements", label: "Announcements", icon: Megaphone },
      { to: "/app/messages", label: "Messages", icon: MessagesSquare },
      { to: "/app/discussions", label: "Discussions", icon: MessageCircle },
    ],
  },
  {
    label: "Reports & Insights",
    items: [
      { to: "/app/payments", label: "Payments", icon: CreditCard },
      { to: "/app/invoices", label: "Invoices", icon: Receipt },
      {
        to: "/app/reports",
        label: "Reports",
        icon: BarChart3,
        children: [
          { to: "/app/reports", label: "Reports Overview", icon: BarChart3, end: true },
          { to: "/app/analytics", label: "Analytics", icon: LineChart },
          { to: "/app/finance/gst-reports", label: "GST Reports", icon: BarChart3 },
          { to: "/app/finance/revenue/reports", label: "Revenue Reports", icon: BarChart3 },
          { to: "/app/reports/batches", label: "Batch Reports", icon: BarChart3 },
          { to: "/app/reports/institutions", label: "Institution Reports", icon: BarChart3 },
          { to: "/app/reports/login-activity", label: "Login Activity", icon: Activity },
        ],
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/app/marketing/coupons", label: "Coupons", icon: CreditCard },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/app/live-classes", label: "Live classes", icon: Video },
      { to: "/app/certificates", label: "Certificates", icon: Award },
      {
        to: "/app/finance/business-settings",
        label: "Settings",
        icon: Settings,
        children: [
          { to: "/app/finance/business-settings", label: "Business Setting", icon: Landmark, end: true },
          { to: "/app/payment-requests", label: "Payment Requests", icon: Wallet },
          { to: "/app/roles", label: "Roles & Permissions", icon: ShieldCheck },
          { to: "/app/security", label: "Device Login Control", icon: Shield },
          { to: "/app/security/video", label: "Video Security", icon: ShieldCheck },
          { to: "/app/security/content-protection", label: "Content Protection", icon: Shield },
          { to: "/app/integrations", label: "Integrations", icon: Plug },
          { to: "/app/notices", label: "Student Notices", icon: BellIcon },
          { to: "/app/support-tickets", label: "Support Tickets", icon: LifeBuoy },
          { to: "/app/activity-logs", label: "Activity Logs", icon: ScrollText },
          { to: "/app/cms", label: "Content Management", icon: FileText },
        ],
      },
    ],
  },
];

const instructorGroups: NavGroup[] = [
  { items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    label: "Teaching",
    items: [
      { to: "/app/courses", label: "Courses", icon: BookOpen },
      { to: "/app/live-classes", label: "Live Classes", icon: Video },
      { to: "/app/students", label: "Students", icon: Users },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/app/messages", label: "Messages", icon: MessagesSquare },
      { to: "/app/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    label: "Earnings",
    items: [
      { to: "/app/revenue", label: "Revenue", icon: Wallet },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/app/instructor/verification", label: "Verification", icon: ShieldCheck },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const studentGroups: NavGroup[] = [
  { items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    label: "Learning",
    items: [
      { to: "/app/courses", label: "My courses", icon: BookOpen },
      { to: "/app/bundles/me", label: "My bundles", icon: Package },
      { to: "/app/live-classes", label: "Live classes", icon: Video },
      { to: "/app/assignments", label: "Assignments", icon: FileText },
      { to: "/app/quizzes", label: "Quizzes", icon: ClipboardList },
      { to: "/app/certificates", label: "Certificates", icon: Award },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/app/messages", label: "Messages", icon: MessagesSquare },
      { to: "/app/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/app/orders", label: "My orders", icon: Receipt },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
      { to: "/app/settings", label: "Profile", icon: UserIcon },
    ],
  },
];

// Staff role: operational only. Hide anything under these prefixes so the
// sidebar matches what RLS/RPC guards allow. Route guards still enforce it.
const STAFF_HIDDEN_PREFIXES = [
  "/app/dashboard",
  "/app/settings",
  "/app/courses/new",
  "/app/courses/:id/edit",
  "/app/categories",
  "/app/bundles",
  "/app/lessons",
  "/app/assignments",
  "/app/quizzes",
  "/app/analytics",
  "/app/integrations",
  "/app/roles",
  "/app/activity-logs",
  "/app/finance/business-settings",
  "/app/finance/gst-reports",
  "/app/finance/revenue",
  "/app/security",
  "/app/instructor-verification",
  "/app/instructors",
  "/app/courses-deletion-requests",
  "/app/payment-requests",
  "/app/marketing",
  "/app/cms",
  "/app/reports",
  "/app/invoices",
  "/app/institutions",
];

function filterGroupsForStaff(groups: NavGroup[]): NavGroup[] {
  const isHidden = (to: string) =>
    STAFF_HIDDEN_PREFIXES.some((p) => to === p || to.startsWith(p + "/") || to.startsWith(p));
  const filterItems = (items: NavItem[]): NavItem[] =>
    items
      .map((it) => {
        const kids = it.children ? filterItems(it.children) : undefined;
        if (isHidden(it.to)) {
          // Parent's own target is hidden. Keep the node only if a child
          // survived, and rebind the parent link to the first allowed child
          // so clicking it never navigates to a forbidden route.
          if (kids && kids.length > 0) {
            return { ...it, to: kids[0].to, children: kids };
          }
          return null;
        }
        return kids ? { ...it, children: kids } : it;
      })
      .filter((x): x is NavItem => !!x);
  return groups
    .map((g) => ({ ...g, items: filterItems(g.items) }))
    .filter((g) => g.items.length > 0);
}

export default function AppShell() {
  const { user } = useAuth();
  const { membership, primaryRole } = useWorkspace();
  const navigate = useNavigate();
  const { block, dismissBlock, retry, inactivityWarn, continueSession, logoutNow } = useDeviceSession();

  const isStudent = primaryRole === "student" || primaryRole === "parent" || !primaryRole;
  const isInstructor = primaryRole === "instructor";
  const isStaff = primaryRole === "staff";
  const navGroups = isStudent
    ? studentGroups
    : isInstructor
      ? instructorGroups
      : isStaff
        ? filterGroupsForStaff(adminGroups)
        : adminGroups;
  const [logoutOpen, setLogoutOpen] = useState(false);
  const location = useLocation();

  // Track expanded parent menu items (persist across renders)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const toggleMenu = (key: string) => setOpenMenus((m) => ({ ...m, [key]: !m[key] }));
  // Auto-open the parent whose child matches current route
  useEffect(() => {
    const next: Record<string, boolean> = {};
    navGroups.forEach((g) =>
      g.items.forEach((it) => {
        if (it.children?.some((c) => location.pathname.startsWith(c.to))) next[it.to] = true;
      })
    );
    if (Object.keys(next).length) setOpenMenus((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Sidebar collapse (desktop) & drawer (mobile)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);
  useEffect(() => {
    // Close drawer when navigating to a wider viewport
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Lock page-level scroll while the dashboard shell is mounted so the
  // sidebar and main content can scroll independently.
  useEffect(() => {
    document.body.classList.add("app-shell-active");
    return () => document.body.classList.remove("app-shell-active");
  }, []);

  const { data: brandSettings } = useQuery({
    queryKey: ["workspace-branding", membership?.workspace.id],
    queryFn: async () => {
      if (!membership?.workspace.id) return null;
      const { data } = await supabase
        .from("workspace_settings")
        .select("logo_url")
        .eq("workspace_id", membership.workspace.id)
        .maybeSingle();
      return data;
    },
    enabled: !!membership?.workspace.id,
  });

  const logoUrl =
    (brandSettings?.logo_url?.trim() ||
      (membership?.workspace as any)?.logo_url?.trim()) ||
    null;
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const activeLogoUrl = logoUrl && failedLogoUrl !== logoUrl ? logoUrl : null;

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const displayName =
    (profile?.full_name && profile.full_name.trim()) ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "";

  const handleSignOut = async () => {
    await authService.signOut();
    navigate("/auth/login");
  };

  const initials = (displayName || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarUrl = (profile as any)?.avatar_url as string | undefined;
  const AvatarCircle = ({ className = "", textClass = "text-xs" }: { className?: string; textClass?: string }) => (
    <div className={cn("h-8 w-8 rounded-full overflow-hidden bg-primary text-primary-foreground grid place-items-center font-semibold", textClass, className)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName || "User"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        initials
      )}
    </div>
  );

  const brandLogoSrc = activeLogoUrl ?? faatproLogo.url;
  const staffHome = isStaff ? "/app/students" : "/app/dashboard";
  const BrandLogo = (
    <Link to={staffHome} aria-label="FAATPRO home" className="flex items-center gap-2 group">
      <img
        src={brandLogoSrc}
        alt={membership?.workspace.name ?? "FAATPRO"}
        className="h-10 w-auto max-w-[170px] object-contain group-hover:scale-105 transition-transform"
        loading="eager"
        decoding="async"
        onError={() => { if (activeLogoUrl) setFailedLogoUrl(activeLogoUrl); }}
      />
    </Link>
  );
  const BrandLogoCompact = (
    <Link to={staffHome} aria-label="FAATPRO home" className="flex items-center justify-center">
      <img
        src={brandLogoSrc}
        alt={membership?.workspace.name ?? "FAATPRO"}
        className="h-9 w-9 object-contain"
        loading="eager"
        decoding="async"
        onError={() => { if (activeLogoUrl) setFailedLogoUrl(activeLogoUrl); }}
      />
    </Link>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface-muted">
      <InstructorAgreementGate />
      <DeviceLimitDialog
        open={!!block}
        max={block?.max_devices ?? 0}
        onRetry={retry}
        onCancel={dismissBlock}
      />
      <AlertDialog open={inactivityWarn} onOpenChange={(o) => { if (!o) continueSession(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You've been inactive</AlertDialogTitle>
            <AlertDialogDescription>
              Your session will expire in 2 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={continueSession}>Continue session</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void logoutNow(); }}>Logout now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the login screen. Any unsaved changes may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          "z-40 flex flex-col border-r border-border bg-background transition-[width,transform] duration-300 ease-in-out h-[100dvh]",
          // Mobile: fixed drawer
          "fixed inset-y-0 left-0 w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: in-flow, collapsible width
          "lg:static lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        <div className="px-3 h-16 border-b border-border flex items-center justify-center shrink-0">
          {collapsed ? BrandLogoCompact : BrandLogo}
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden [overscroll-behavior:contain]">
          {navGroups.map((group, gi) => (
            <div key={gi} className="space-y-1">
              {group.label && !collapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                if (item.children && item.children.length) {
                  const isOpen = !!openMenus[item.to];
                  const anyChildActive = item.children.some((c) => location.pathname.startsWith(c.to));
                  return (
                    <div key={item.to} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (collapsed) {
                            navigate(item.to);
                          } else {
                            toggleMenu(item.to);
                          }
                        }}
                        aria-expanded={isOpen}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          collapsed && "lg:justify-center lg:px-2",
                          anyChildActive
                            ? "bg-primary-soft text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className={cn("flex-1 truncate text-left", collapsed && "lg:hidden")}>{item.label}</span>
                        {!collapsed && (isOpen
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />)}
                      </button>
                      {isOpen && !collapsed && (
                        <div className="ml-4 pl-3 border-l border-border/60 space-y-0.5">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.to}
                              to={child.to}
                              end={child.end}
                              onClick={() => setMobileOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
                                  isActive
                                    ? "bg-primary-soft/70 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                )
                              }
                            >
                              <child.icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                const link = (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        collapsed && "lg:justify-center lg:px-2",
                        isActive
                          ? "bg-primary-soft text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>{item.label}</span>
                    {item.badge && !collapsed && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-primary/70 bg-primary-soft px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
                if (!collapsed) {
                  return <div key={item.to}>{link}</div>;
                }
                return (
                  <TooltipProvider key={item.to} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">{link}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          ))}
        </nav>

        {!isStudent && (
          <div className="p-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn("w-full flex items-center p-2 rounded-lg hover:bg-muted transition-colors", collapsed ? "justify-center" : "gap-3")} aria-label="Account menu">
                  <AvatarCircle />
                  {!collapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-medium truncate">{displayName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!isStaff && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                      <Settings className="h-4 w-4 mr-2" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <header className="h-14 shrink-0 border-b border-border bg-background px-6 flex items-center gap-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="shrink-0"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                setMobileOpen((v) => !v);
              } else {
                setCollapsed((v) => !v);
              }
            }}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link to={isStaff ? "/app/students" : "/app"} aria-label="FAATPRO home" className="lg:hidden flex items-center">
            <img src={faatproLogo.url} alt="FAATPRO" className="h-8 w-auto object-contain" />
          </Link>
          {isStudent ? (
            <NoticeTicker />
          ) : (
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses, students, assignments…" className="pl-9 bg-surface-muted border-transparent focus-visible:bg-background" />
            </div>
          )}
          <NotificationBell />
          {!isStudent && !isStaff && (
            <Button variant="outline" size="sm" onClick={() => navigate("/app/courses")}>
              New course
            </Button>
          )}
          {isStudent && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:ring-2 hover:ring-primary/30 transition">
                    <AvatarCircle textClass="text-[11px]" className="bg-gradient-brand" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">
                    <div className="truncate">{displayName}</div>
                    <div className="text-[10px] text-muted-foreground font-normal truncate">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                    <UserIcon className="h-4 w-4 mr-2" /> My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                    <Shield className="h-4 w-4 mr-2" /> Security
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                    <Settings className="h-4 w-4 mr-2" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLogoutOpen(true)} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </header>
        <div
          data-scroll-root
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch] p-4 sm:p-6 md:p-8",
            isStudent && "pb-safe-bottom-nav md:pb-8",
          )}
        >
          <Outlet />
        </div>
        {isStudent && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t border-border grid grid-cols-5 h-16 pb-safe">
            {[
              { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
              { to: "/app/courses", label: "Courses", icon: BookOpen },
              { to: "/app/assignments", label: "Tasks", icon: FileText },
              { to: "/app/quizzes", label: "Quiz", icon: ClipboardList },
              { to: "/app/settings", label: "Profile", icon: UserIcon },
            ].map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end}
                className={({ isActive }) => cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                <i.icon className="h-5 w-5" />
                {i.label}
              </NavLink>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}