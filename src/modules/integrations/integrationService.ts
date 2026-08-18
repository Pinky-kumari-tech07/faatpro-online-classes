import { supabase } from "@/integrations/supabase/client";
import type { IntegrationProvider, WorkspaceIntegration } from "./types";
import { SECRET_FIELDS, MASK } from "./types";

export const integrationService = {
  async list(workspaceId: string): Promise<WorkspaceIntegration[]> {
    const { data, error } = await supabase
      .from("workspace_integrations" as any)
      .select("*")
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return (data ?? []) as unknown as WorkspaceIntegration[];
  },

  async upsert(
    workspaceId: string,
    provider: IntegrationProvider,
    category: string,
    enabled: boolean,
    mode: string | null,
    incomingConfig: Record<string, any>,
    existing?: WorkspaceIntegration,
  ): Promise<WorkspaceIntegration> {
    // Preserve secret values when caller sent the mask placeholder
    const config = { ...incomingConfig };
    for (const f of SECRET_FIELDS[provider]) {
      if (config[f] === MASK || config[f] === "" || config[f] == null) {
        if (existing?.config?.[f]) config[f] = existing.config[f];
        else delete config[f];
      }
    }

    const row = {
      workspace_id: workspaceId,
      provider,
      category,
      enabled,
      mode,
      config,
    };

    const { data, error } = await supabase
      .from("workspace_integrations" as any)
      .upsert(row, { onConflict: "workspace_id,provider" })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WorkspaceIntegration;
  },

  /** Returns config with secrets masked, safe to send to forms. */
  maskedConfig(integration: WorkspaceIntegration): Record<string, any> {
    const masked = { ...integration.config };
    for (const f of SECRET_FIELDS[integration.provider]) {
      if (masked[f]) masked[f] = MASK;
    }
    return masked;
  },

  async sendTestEmail(workspaceId: string, to: string) {
    const { data, error } = await supabase.functions.invoke("smtp-test", {
      body: { workspace_id: workspaceId, to },
    });
    if (error) throw error;
    return data;
  },
};