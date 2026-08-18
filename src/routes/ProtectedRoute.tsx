import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { membership, isLoading: wsLoading } = useWorkspace();
  const location = useLocation();

  if (loading || (user && wsLoading)) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    // Preserve the intended destination so session-expiry redirects don't
    // dump the user on the dashboard after login.
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/auth/login?next=${next}`} replace state={{ from: location }} />;
  }

  if (!membership) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold">No workspace yet</h2>
          <p className="text-muted-foreground text-sm">Your account is being set up. Try refreshing in a moment.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
