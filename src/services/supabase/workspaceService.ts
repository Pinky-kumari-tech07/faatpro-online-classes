import { supabase } from "@/integrations/supabase/client";
import type { Workspace, WorkspaceMember, AppRole } from "@/types";

export interface MembershipContext {
  workspace: Workspace;
  member: WorkspaceMember;
  roles: AppRole[];
  memberCount: number;
}

export const workspaceService = {
  async listMyMemberships(userId: string): Promise<MembershipContext[]> {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("*, workspaces!inner(*)")
      .eq("profile_id", userId)
      .eq("status", "active");
    if (error) throw error;

    const byWorkspace = new Map<string, MembershipContext>();
    for (const row of (data ?? []) as Array<WorkspaceMember & { workspaces: Workspace }>) {
      const existing = byWorkspace.get(row.workspace_id);
      if (existing) {
        existing.roles.push(row.role);
      } else {
        byWorkspace.set(row.workspace_id, {
          workspace: row.workspaces,
          member: row,
          roles: [row.role],
          memberCount: 1,
        });
      }
    }
    const list = Array.from(byWorkspace.values());
    const ids = list.map((m) => m.workspace.id);
    if (ids.length > 0) {
      const { data: counts } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .in("workspace_id", ids)
        .eq("status", "active");
      const tally = new Map<string, number>();
      for (const r of (counts ?? []) as Array<{ workspace_id: string }>) {
        tally.set(r.workspace_id, (tally.get(r.workspace_id) ?? 0) + 1);
      }
      for (const m of list) m.memberCount = tally.get(m.workspace.id) ?? 1;
    }
    // Prefer the workspace where the user has the highest-privileged role.
    // Tie-break with member count so real org workspaces still win over
    // auto-created personal ones when roles are equal.
    const ROLE_RANK: Record<string, number> = {
      super_admin: 0,
      organization_admin: 1,
      instructor: 2,
      staff: 3,
      parent: 4,
      student: 5,
    };
    const bestRank = (m: MembershipContext) =>
      Math.min(...m.roles.map((r) => ROLE_RANK[r as string] ?? 99));
    list.sort((a, b) => {
      const ra = bestRank(a);
      const rb = bestRank(b);
      if (ra !== rb) return ra - rb;
      return b.memberCount - a.memberCount;
    });
    return list;
  },

  async getCurrentWorkspace(userId: string): Promise<MembershipContext | null> {
    const memberships = await this.listMyMemberships(userId);
    if (memberships.length === 0) return null;
    const storedId = typeof window !== "undefined"
      ? localStorage.getItem("lms.active_workspace")
      : null;
    return memberships.find((m) => m.workspace.id === storedId) ?? memberships[0];
  },

  setActiveWorkspace(workspaceId: string) {
    localStorage.setItem("lms.active_workspace", workspaceId);
  },
};