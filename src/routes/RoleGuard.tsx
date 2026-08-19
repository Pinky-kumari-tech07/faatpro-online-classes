import { Navigate, Outlet } from "react-router-dom";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import type { AppRole } from "@/types";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function RoleGuard({ allow }: { allow: AppRole[] }) {
  const { primaryRole, isLoading } = useWorkspace();
  if (isLoading) {
    return (
      <div className="min-h-[40vh] grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!primaryRole || !allow.includes(primaryRole)) {
    // Staff should never see a 403 — silently route them to their home page,
    // including when a ?next= sent them into an admin-only area after login.
    if (primaryRole === "staff") {
      return <Navigate to="/app/courses" replace />;
    }
    return (
      <div className="min-h-[40vh] grid place-items-center p-6">
        <div className="max-w-md text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">403 Forbidden</h2>
            <p className="text-sm text-muted-foreground">You do not have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }
  return <Outlet />;
}