import { supabase } from "@/integrations/supabase/client";

export type InstitutionType =
  | "College"
  | "University"
  | "Institute"
  | "School"
  | "Coaching Center"
  | "Other";

export const INSTITUTION_TYPES: InstitutionType[] = [
  "College",
  "University",
  "Institute",
  "School",
  "Coaching Center",
  "Other",
];

export interface Institution {
  id: string;
  workspace_id: string;
  name: string;
  code: string | null;
  type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstitutionInput {
  name: string;
  code?: string | null;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_active?: boolean;
}

export const institutionService = {
  async list(workspaceId: string): Promise<Institution[]> {
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data as any) ?? [];
  },

  async listActiveAll(): Promise<Institution[]> {
    const { data, error } = await supabase
      .from("institutions")
      .select("id, workspace_id, name, code, type, city, state, country, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data as any) ?? [];
  },

  async create(workspaceId: string, input: InstitutionInput): Promise<Institution> {
    // Validate uniqueness of name (case-insensitive) within workspace
    const { data: dup } = await supabase
      .from("institutions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", input.name.trim())
      .maybeSingle();
    if (dup) throw new Error("An institution with this name already exists.");
    if (input.code && input.code.trim()) {
      const { data: dupCode } = await supabase
        .from("institutions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("code", input.code.trim())
        .maybeSingle();
      if (dupCode) throw new Error("This institution code is already in use.");
    }
    const payload = {
      workspace_id: workspaceId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      type: input.type || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || "India",
      is_active: input.is_active ?? true,
    };
    const { data, error } = await supabase
      .from("institutions")
      .insert(payload as any)
      .select("*")
      .single();
    if (error) throw error;
    return data as any;
  },

  async update(id: string, workspaceId: string, input: InstitutionInput): Promise<Institution> {
    // Uniqueness checks excluding self
    const { data: dup } = await supabase
      .from("institutions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", input.name.trim())
      .neq("id", id)
      .maybeSingle();
    if (dup) throw new Error("An institution with this name already exists.");
    if (input.code && input.code.trim()) {
      const { data: dupCode } = await supabase
        .from("institutions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("code", input.code.trim())
        .neq("id", id)
        .maybeSingle();
      if (dupCode) throw new Error("This institution code is already in use.");
    }
    const payload: any = {
      name: input.name.trim(),
      code: input.code?.trim() || null,
      type: input.type || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || "India",
    };
    if (typeof input.is_active === "boolean") payload.is_active = input.is_active;
    const { data, error } = await supabase
      .from("institutions")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as any;
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from("institutions")
      .update({ is_active: isActive } as any)
      .eq("id", id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("institutions").delete().eq("id", id);
    if (error) throw error;
  },
};