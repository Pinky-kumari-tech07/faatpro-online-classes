import { supabase } from "@/integrations/supabase/client";

export interface AgreementPayload {
  userId: string;
  workspaceId?: string | null;
  roleAtSignup: "student" | "instructor";
  version?: string;
}

export const agreementService = {
  async recordAgreementAcceptance(payload: AgreementPayload) {
    const { error } = await supabase.from("user_agreements").insert({
      user_id: payload.userId,
      workspace_id: payload.workspaceId ?? null,
      accepted_terms: true,
      accepted_privacy: true,
      accepted_code_of_conduct: true,
      role_at_signup: payload.roleAtSignup,
      agreement_version: payload.version ?? "v1",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (error) throw error;
  },
};