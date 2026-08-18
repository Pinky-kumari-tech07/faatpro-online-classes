import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceService, type MembershipContext } from "@/services/supabase";
import { useAuth } from "./useAuth";
import type { AppRole } from "@/types";

interface WorkspaceCtx {
  membership: MembershipContext | null;
  memberships: MembershipContext[];
  isLoading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  setActive: (workspaceId: string) => void;
  primaryRole: AppRole | null;
}

const Ctx = createContext<WorkspaceCtx>({
  membership: null,
  memberships: [],
  isLoading: true,
  hasRole: () => false,
  hasAnyRole: () => false,
  setActive: () => {},
  primaryRole: null,
});

const ROLE_PRIORITY: AppRole[] = [
  "super_admin",
  "organization_admin",
  "instructor",
  "staff",
  "parent",
  "student",
];

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: memberships = [], isLoading, refetch } = useQuery({
    queryKey: ["memberships", user?.id],
    queryFn: () => workspaceService.listMyMemberships(user!.id),
    enabled: !!user,
  });

  const storedId = typeof window !== "undefined"
    ? localStorage.getItem("lms.active_workspace")
    : null;
  const membership =
    memberships.find((m) => m.workspace.id === storedId) ?? memberships[0] ?? null;

  const hasRole = (role: AppRole) => !!membership?.roles.includes(role);
  const hasAnyRole = (roles: AppRole[]) =>
    !!membership?.roles.some((r) => roles.includes(r));

  // Compute primary role across ALL active memberships, not just the
  // currently-active workspace. A user who is an instructor in one
  // workspace and a student in another should still be treated as an
  // instructor for role-based routing/UI decisions.
  const allRoles = memberships.flatMap((m) => m.roles);
  const primaryRole =
    ROLE_PRIORITY.find((r) => allRoles.includes(r)) ??
    (membership ? ROLE_PRIORITY.find((r) => membership.roles.includes(r)) ?? null : null);

  const setActive = (workspaceId: string) => {
    workspaceService.setActiveWorkspace(workspaceId);
    refetch();
  };

  return (
    <Ctx.Provider value={{ membership, memberships, isLoading, hasRole, hasAnyRole, setActive, primaryRole }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWorkspace = () => useContext(Ctx);