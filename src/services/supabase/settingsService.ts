import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceSettings, Workspace, WorkspaceMember, AppRole } from "@/types";

export const settingsService = {
  async getSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
    const { data } = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return data as any;
  },

  async upsertSettings(workspaceId: string, patch: Partial<WorkspaceSettings>) {
    const { error } = await supabase
      .from("workspace_settings")
      .upsert({ workspace_id: workspaceId, ...patch } as any, { onConflict: "workspace_id" });
    if (error) throw error;
  },

  async updateWorkspace(workspaceId: string, patch: Partial<Workspace>) {
    const { error } = await supabase.from("workspaces").update(patch as any).eq("id", workspaceId);
    if (error) throw error;
  },

  async listMembers(workspaceId: string) {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("*, profiles(full_name, avatar_url)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<WorkspaceMember & { profiles?: { full_name: string | null; avatar_url: string | null } }>;
  },

  async updateMemberRole(memberId: string, role: AppRole) {
    const { error } = await supabase.from("workspace_members").update({ role } as any).eq("id", memberId);
    if (error) throw error;
  },

  async removeMember(memberId: string) {
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    if (error) throw error;
  },
};