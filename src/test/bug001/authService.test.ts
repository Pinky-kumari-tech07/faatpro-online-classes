import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcCalls: Array<{ fn: string; args: any }> = [];
const authState: { user: { id: string } | null; profile: any } = {
  user: { id: "u-instructor" },
  profile: { signup_role: "instructor" },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: authState.user } }) },
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: authState.profile }),
          order: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "ws-1" } }) }),
          }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    rpc: async (fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      return { data: null, error: null };
    },
  },
}));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: {} } }));
vi.mock("@/services/supabase/agreementService", () => ({
  agreementService: { recordAgreementAcceptance: async () => {} },
}));
vi.mock("@/services/supabase/sessionService", () => ({
  closeCurrentSession: async () => {},
  setLastLoginMethod: () => {},
  clearDeviceToken: () => {},
}));
vi.mock("@/lib/authRedirect", () => ({
  DEFAULT_AUTH_DESTINATION: "/app",
  authCallbackUrlForDestination: (x: string) => x,
  getAllowedPostLoginPath: (x?: string) => x ?? null,
  savePostLoginRedirect: () => {},
}));

import { authService } from "@/services/supabase/authService";

beforeEach(() => {
  rpcCalls.length = 0;
  authService.clearSelectedSignupRole();
});

describe("BUG-001 authService dispatch", () => {
  it("tags email signup as source=email_signup", async () => {
    await authService.applyPostSignup("u-instructor", {
      email: "i@x", password: "x", fullName: "I", role: "instructor",
    });
    const c = rpcCalls.find((c) => c.fn === "apply_signup_role");
    expect(c).toBeDefined();
    expect(c!.args.desired_role).toBe("instructor");
    expect(c!.args.source).toBe("email_signup");
  });

  it("tags Google OAuth callback as source=google_oauth", async () => {
    authService.setSelectedSignupRole("instructor");
    authState.profile = { signup_role: null };
    await authService.applySelectedSignupRoleIfNew();
    const c = rpcCalls.find((c) => c.fn === "apply_signup_role");
    expect(c).toBeDefined();
    expect(c!.args.source).toBe("google_oauth");
  });

  it("skips RPC when no pending OAuth role", async () => {
    await authService.applySelectedSignupRoleIfNew();
    expect(rpcCalls.find((c) => c.fn === "apply_signup_role")).toBeUndefined();
  });
});