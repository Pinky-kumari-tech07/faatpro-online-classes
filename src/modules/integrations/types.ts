export type IntegrationProvider =
  | "google_meet"
  | "zoom"
  | "razorpay"
  | "google_oauth"
  | "email_smtp";

export interface WorkspaceIntegration {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  category: string;
  enabled: boolean;
  mode: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const SECRET_FIELDS: Record<IntegrationProvider, string[]> = {
  google_meet: [],
  zoom: ["client_secret"],
  razorpay: ["key_secret", "webhook_secret"],
  google_oauth: ["client_secret"],
  email_smtp: ["password"],
};

export const MASK = "••••••••";