import { supabase } from "@/integrations/supabase/client";

export type VerificationStatus = "pending" | "approved" | "rejected" | "resubmission_required";

export interface InstructorProfile {
  id: string;
  user_id: string;
  workspace_id: string | null;
  // Personal
  date_of_birth: string | null;
  gender: string | null;
  // Professional
  institution: string | null;
  passing_year: number | null;
  years_experience: number | null;
  specialization: string | null;
  // Teaching
  subjects: string[];
  languages: string[];
  // Social / links
  linkedin_url: string | null;
  website_url: string | null;
  youtube_url: string | null;
  // Extra uploads
  resume_url: string | null;
  government_id_url: string | null;
  // Academic
  board_type: string | null;
  board_certificate_url: string | null;
  highest_qualification: string | null;
  highest_qualification_certificate_url: string | null;
  additional_certifications: string[];
  // KYC
  aadhaar_number: string | null;
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  pan_number: string | null;
  pan_card_url: string | null;
  // Banking
  account_holder_name: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  branch_name: string | null;
  bank_document_url: string | null;
  upi_id: string | null;
  // Contact
  registration_mobile: string | null;
  whatsapp_number: string | null;
  alternative_contact: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  // Verification
  verification_status: VerificationStatus;
  verification_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "instructor_profiles";
const BUCKET = "instructor-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const REVIEW_STATUSES: VerificationStatus[] = ["pending", "approved", "rejected", "resubmission_required"];

export const instructorProfileService = {
  async getMine(userId: string): Promise<InstructorProfile | null> {
    const { data, error } = await (supabase as any)
      .from(TABLE).select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data as InstructorProfile | null;
  },

  async upsertMine(userId: string, workspaceId: string | null, patch: Partial<InstructorProfile>): Promise<InstructorProfile> {
    const existing = await this.getMine(userId);
    if (existing) {
      const { data, error } = await (supabase as any)
        .from(TABLE).update(patch).eq("user_id", userId).select("*").single();
      if (error) throw error;
      return data as InstructorProfile;
    }
    const { data, error } = await (supabase as any)
      .from(TABLE).insert({ user_id: userId, workspace_id: workspaceId, ...patch }).select("*").single();
    if (error) throw error;
    return data as InstructorProfile;
  },

  /**
   * Marks the instructor's verification as submitted for admin review.
   * Also resets the status to "pending" so reviewers see it in their queue
   * (used both for first-time submission and re-submission after changes were requested).
   */
  async submitForReview(userId: string): Promise<InstructorProfile> {
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .update({
        submitted_at: new Date().toISOString(),
        verification_status: "pending",
        verification_notes: null,
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data as InstructorProfile;
  },

  validateFile(file: File) {
    if (!ALLOWED.includes(file.type)) throw new Error("Only PDF, JPG, JPEG or PNG files are allowed");
    if (file.size > MAX_BYTES) throw new Error("File must be 10 MB or smaller");
  },

  async uploadDocument(userId: string, folder: "aadhaar" | "pan" | "qualification" | "bank", file: File): Promise<string> {
    this.validateFile(file);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  },

  async signedUrl(path: string, expiresIn = 3600): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    if (error) return null;
    return data.signedUrl;
  },

  async deleteDocument(path: string): Promise<void> {
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  },

  // Admin
  // Instructor verification is a platform-wide workflow for FAATPRO. It must be driven
  // by instructor_profiles.verification_status only; workspace membership is not a
  // reliable source because newly-registered instructors can live in a personal
  // auto-created workspace before an admin approves them.
  async listForReview(_workspaceId?: string | null, opts: { allWorkspaces?: boolean; status?: VerificationStatus | "all" } = {}) {
    type Row = InstructorProfile & { profile: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } };

    let q = (supabase as any)
      .from(TABLE)
      .select("*, profile:profiles!instructor_profiles_user_id_fkey(id, full_name, email, avatar_url)")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (opts.status && opts.status !== "all") {
      q = q.eq("verification_status", opts.status);
    } else {
      q = q.in("verification_status", REVIEW_STATUSES);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[InstructorVerification] instructor_profiles query failed", error);
      throw error;
    }

    const rows = ((data ?? []) as Row[]).map((r) => ({
      ...r,
      profile: r.profile ?? { id: r.user_id, full_name: null, email: null, avatar_url: null },
    }));

    console.info("[InstructorVerification] instructor_profiles query result", rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      workspace_id: r.workspace_id,
      verification_status: r.verification_status,
      submitted_at: r.submitted_at,
      profile: r.profile,
    })));

    if (rows.length === 0) {
      const { data: debugRows, error: debugError } = await (supabase as any)
        .from(TABLE)
        .select("id,user_id,workspace_id,verification_status,submitted_at")
        .in("verification_status", REVIEW_STATUSES)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(25);

      if (debugError) {
        console.error("[InstructorVerification] debug comparison query failed", debugError);
      } else {
        console.info("[InstructorVerification] debug comparison rows", debugRows ?? []);
        if (!debugRows?.length) {
          console.warn("[InstructorVerification] No readable instructor_profiles rows were returned for verification statuses. Check admin RLS access or whether submitted rows use a different status value.");
        }
      }
    }

    return rows;
  },

  async setStatus(id: string, status: VerificationStatus, notes: string | null) {
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .update({ verification_status: status, verification_notes: notes })
      .eq("id", id)
      .select("*").single();
    if (error) throw error;
    return data as InstructorProfile;
  },
};

export const VALIDATION = {
  aadhaar: (v: string) => /^\d{12}$/.test(v.replace(/\s+/g, "")),
  pan: (v: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v.toUpperCase()),
  ifsc: (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()),
  upi: (v: string) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v),
  phone: (v: string) => /^\d{10}$/.test(v.replace(/\D/g, "")),
  pin: (v: string) => /^\d{6}$/.test(v),
};

export function maskAadhaar(v: string | null | undefined): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length !== 12) return v;
  return `XXXX XXXX ${d.slice(8)}`;
}