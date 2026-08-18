import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";

export type ContentProtectionSettings = {
  id?: string;
  workspace_id?: string;
  disable_right_click: boolean;
  disable_keyboard_shortcuts: boolean;
  disable_copy: boolean;
  disable_text_selection: boolean;
  disable_image_drag: boolean;
  disable_print: boolean;
  devtools_detection: boolean;
  dynamic_watermark: boolean;
  video_watermark: boolean;
  pdf_protection: boolean;
  screenshot_deterrence: boolean;
  apply_on_public_site: boolean;
};

export const DEFAULT_CONTENT_PROTECTION: ContentProtectionSettings = {
  disable_right_click: true,
  disable_keyboard_shortcuts: true,
  disable_copy: true,
  disable_text_selection: true,
  disable_image_drag: true,
  disable_print: true,
  devtools_detection: true,
  dynamic_watermark: true,
  video_watermark: true,
  pdf_protection: true,
  screenshot_deterrence: true,
  apply_on_public_site: false,
};

const Ctx = createContext<ContentProtectionSettings>(DEFAULT_CONTENT_PROTECTION);

async function fetchSettings(workspaceId?: string | null): Promise<ContentProtectionSettings> {
  let query = supabase.from("content_protection_settings" as any).select("*").limit(1);
  if (workspaceId) query = supabase.from("content_protection_settings" as any).select("*").eq("workspace_id", workspaceId).limit(1);
  const { data } = await query;
  const row = (data && data[0]) as any;
  if (!row) {
    // Fallback: read any row (e.g. public site without active workspace)
    const { data: any2 } = await supabase.from("content_protection_settings" as any).select("*").limit(1);
    const fb = (any2 && any2[0]) as any;
    return fb ? { ...DEFAULT_CONTENT_PROTECTION, ...fb } : DEFAULT_CONTENT_PROTECTION;
  }
  return { ...DEFAULT_CONTENT_PROTECTION, ...row };
}

export function ContentProtectionProvider({ children }: { children: ReactNode }) {
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace?.id ?? null;
  const { data } = useQuery({
    queryKey: ["content-protection-settings", workspaceId],
    queryFn: () => fetchSettings(workspaceId),
    staleTime: 60_000,
  });
  const value = useMemo(() => data ?? DEFAULT_CONTENT_PROTECTION, [data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useContentProtection = () => useContext(Ctx);