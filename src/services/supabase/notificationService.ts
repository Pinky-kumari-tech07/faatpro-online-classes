import { supabase } from "@/integrations/supabase/client";
import type { NotificationItem } from "@/types";

export const notificationService = {
  async list(workspaceId: string, userId: string, limit = 30): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .range(0, limit - 1);
    if (error) throw error;
    return (data ?? []) as NotificationItem[];
  },

  async unreadCount(workspaceId: string, userId: string) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("profile_id", userId)
      .is("read_at", null);
    return count ?? 0;
  },

  async markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() } as any).eq("id", id);
  },

  async markAllRead(workspaceId: string, userId: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as any)
      .eq("workspace_id", workspaceId)
      .eq("profile_id", userId)
      .is("read_at", null);
  },

  async create(input: { workspace_id: string; profile_id: string; event_type: string; title: string; body?: string }) {
    await supabase.from("notifications").insert({ channel: "in_app", ...input } as any);
  },
};