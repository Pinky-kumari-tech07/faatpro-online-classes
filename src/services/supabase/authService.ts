import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Profile } from "@/types";
import { agreementService } from "./agreementService";
import { DEFAULT_AUTH_DESTINATION, authCallbackUrlForDestination, getAllowedPostLoginPath, savePostLoginRedirect } from "@/lib/authRedirect";
import { closeCurrentSession, setLastLoginMethod, clearDeviceToken } from "./sessionService";

export type SignupRole = "student" | "instructor";

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: SignupRole;
  expertise?: string;
  bio?: string;
  yearsExperience?: number;
  linkedinUrl?: string;
  teachingSampleUrl?: string;
  redirectTo?: string;
}

const PENDING_ROLE_KEY = "lms.pending_signup_role";

export const authService = {
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async signInWithPassword(email: string, password: string) {
    setLastLoginMethod("email");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if ((prof as any)?.is_active === false) {
        await supabase.auth.signOut();
        throw new Error("Your account has been temporarily deactivated. Please contact support.");
      }
    }
    return data;
  },

  async isCurrentUserActive() {
    const user = await this.getCurrentUser();
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();
    return (data as any)?.is_active !== false;
  },

  async signUpWithPassword(email: string, password: string, fullName: string, redirectTo?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrlForDestination(getAllowedPostLoginPath(redirectTo) ?? DEFAULT_AUTH_DESTINATION),
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  },

  async signInWithGoogle(redirectTo?: string) {
    const destination = getAllowedPostLoginPath(redirectTo);
    if (destination) savePostLoginRedirect(destination);
    setLastLoginMethod("google");
    return lovable.auth.signInWithOAuth("google", {
      // Carry the destination in the callback URL so it survives the external
      // Google round trip even when storage is unavailable (new tab / ITP).
      redirect_uri: authCallbackUrlForDestination(destination),
    });
  },

  setSelectedSignupRole(role: SignupRole) {
    try { localStorage.setItem(PENDING_ROLE_KEY, role); } catch { /* ignore */ }
  },

  getSelectedSignupRole(): SignupRole | null {
    try {
      const v = localStorage.getItem(PENDING_ROLE_KEY);
      return v === "student" || v === "instructor" ? v : null;
    } catch {
      return null;
    }
  },

  clearSelectedSignupRole() {
    try { localStorage.removeItem(PENDING_ROLE_KEY); } catch { /* ignore */ }
  },

  async registerWithRole(payload: RegisterPayload) {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: authCallbackUrlForDestination(getAllowedPostLoginPath(payload.redirectTo) ?? DEFAULT_AUTH_DESTINATION),
        data: {
          full_name: payload.fullName,
          phone: payload.phone ?? null,
          signup_role: payload.role,
        },
      },
    });
    if (error) throw error;

    const user = data.user;
    const session = data.session;

    // If we have a session, apply role + profile fields + agreement
    if (user && session) {
      await this.applyPostSignup(user.id, payload);
    } else {
      // Stash pending state so we can finalize after email verification login
      try {
        localStorage.setItem(
          "lms.pending_signup",
          JSON.stringify({ userId: user?.id ?? null, payload }),
        );
      } catch { /* ignore */ }
    }

    return data;
  },

  async applyPostSignup(userId: string, payload: RegisterPayload) {
    // Update profile with role metadata
    await supabase
      .from("profiles")
      .update({
        phone: payload.phone ?? null,
        signup_role: payload.role,
        expertise: payload.role === "instructor" ? payload.expertise ?? null : null,
        bio: payload.role === "instructor" ? payload.bio ?? null : null,
        years_experience: payload.role === "instructor" ? payload.yearsExperience ?? null : null,
        linkedin_url: payload.role === "instructor" ? payload.linkedinUrl ?? null : null,
        teaching_sample_url: payload.role === "instructor" ? payload.teachingSampleUrl ?? null : null,
        instructor_status: payload.role === "instructor" ? "active" : null,
      })
      .eq("id", userId);

    // Delegate role/membership/instructor_profile creation to the
    // authoritative server-side function. It refuses to downgrade users
    // who already hold elevated roles and provisions instructor_profiles
    // atomically for instructor signups.
    await supabase.rpc("apply_signup_role", {
      desired_role: payload.role as any,
      source: "email_signup",
    } as any);

    // Read back the primary workspace id for agreement recording.
    const { data: mem } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("profile_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    try {
      await agreementService.recordAgreementAcceptance({
        userId,
        workspaceId: mem?.workspace_id ?? null,
        roleAtSignup: payload.role,
      });
    } catch { /* non-blocking */ }

    try { localStorage.removeItem("lms.pending_signup"); } catch { /* ignore */ }
    this.clearSelectedSignupRole();
  },

  async finalizePendingSignupIfAny() {
    let raw: string | null = null;
    try { raw = localStorage.getItem("lms.pending_signup"); } catch { /* ignore */ }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { userId: string | null; payload: RegisterPayload };
        const user = await this.getCurrentUser();
        if (user) await this.applyPostSignup(user.id, parsed.payload);
      } catch { /* ignore */ }
    }
    // Also handle OAuth (Google) signup: apply the selected signup role only
    // for first-time accounts. Never overwrite an existing elevated role.
    await this.applySelectedSignupRoleIfNew().catch(() => {});
  },

  /**
   * For OAuth signups (Google, etc.), the signup page stores the intended
   * role (`student` / `instructor`) in localStorage before redirecting.
   * After the OAuth callback establishes a session, apply that role — but
   * ONLY for brand-new accounts. Never downgrade instructor/admin/staff/etc.
   */
  async applySelectedSignupRoleIfNew() {
    const desired = this.getSelectedSignupRole();
    if (!desired) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    // The server function is the single source of truth: it will refuse
    // to downgrade elevated users and will provision instructor_profiles
    // + workspace_members.role atomically for new instructor accounts.
    try {
      await supabase.rpc("apply_signup_role", {
        desired_role: desired as any,
        source: "google_oauth",
      } as any);
    } catch { /* non-blocking */ }
    this.clearSelectedSignupRole();
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async signOut(reason: "manual_logout" | "inactivity_timeout" | "remote_logout" = "manual_logout") {
    try { await closeCurrentSession(reason); } catch { /* ignore */ }
    try { clearDeviceToken(); } catch { /* ignore */ }
    await supabase.auth.signOut();
  },

  onAuthStateChange(cb: (event: string, session: unknown) => void) {
    return supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  },
};