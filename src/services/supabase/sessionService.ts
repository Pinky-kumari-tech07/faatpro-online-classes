import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "lms.device_session_token";
const LOGIN_METHOD_KEY = "lms.last_login_method";

export type LoginMethod = "email" | "google" | "otp";

export function setLastLoginMethod(method: LoginMethod) {
  try { localStorage.setItem(LOGIN_METHOD_KEY, method); } catch { /* ignore */ }
}

export function getLastLoginMethod(): LoginMethod {
  try {
    const v = localStorage.getItem(LOGIN_METHOD_KEY);
    if (v === "email" || v === "google" || v === "otp") return v;
  } catch { /* ignore */ }
  return "email";
}

export function getOrCreateDeviceToken(): string {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function clearDeviceToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function parseUA(ua: string) {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device_type = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  const device_name = `${browser} on ${os}`;
  return { browser, os, device_type, device_name };
}

async function fetchLocation(): Promise<{ ip: string | null; location: string | null }> {
  try {
    const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!r.ok) return { ip: null, location: null };
    const j: any = await r.json();
    const loc = [j.city, j.region, j.country_name].filter(Boolean).join(", ");
    return { ip: j.ip ?? null, location: loc || null };
  } catch {
    return { ip: null, location: null };
  }
}

export async function registerSession(workspaceId: string | null): Promise<
  { status: "ok"; session_id: string } | { status: "limit_exceeded"; max_devices: number; active: number }
> {
  const token = getOrCreateDeviceToken();
  const ua = navigator.userAgent || "";
  const { browser, os, device_type, device_name } = parseUA(ua);
  const { ip, location } = await fetchLocation();

  const { data, error } = await supabase.rpc("register_user_session", {
    p_token: token,
    p_workspace_id: workspaceId,
    p_device_name: device_name,
    p_device_type: device_type,
    p_browser: browser,
    p_os: os,
    p_ip: ip,
    p_location: location,
    p_user_agent: ua,
    p_login_method: getLastLoginMethod(),
  });
  if (error) throw error;
  return data as any;
}

export async function closeCurrentSession(reason: "manual_logout" | "inactivity_timeout" | "remote_logout" = "manual_logout") {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await supabase.rpc("close_user_session", { p_token: token, p_reason: reason });
  } catch { /* best-effort */ }
}

export async function heartbeatSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase
    .from("user_sessions")
    .update({ last_active: new Date().toISOString() })
    .eq("session_token", token);
}

export async function checkCurrentSessionActive(): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return true;
  const { data, error } = await supabase
    .from("user_sessions")
    .select("is_active, expires_at")
    .eq("session_token", token)
    .maybeSingle();
  if (error || !data) return true; // don't be aggressive on errors
  if (!data.is_active) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

export async function listMySessions() {
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .order("last_active", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokeSession(id: string) {
  const { data, error } = await supabase.rpc("revoke_user_session", { p_session_id: id });
  if (error) throw error;
  return data as boolean;
}

export async function revokeAllSessions(userId: string, workspaceId: string | null) {
  const { data, error } = await supabase.rpc("revoke_all_user_sessions", {
    p_user_id: userId,
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return data as number;
}

export async function getSecuritySettings(workspaceId: string) {
  const { data, error } = await supabase.rpc("get_security_settings", { _workspace_id: workspaceId });
  if (error) throw error;
  return data as any;
}

export async function upsertSecuritySettings(input: {
  workspace_id: string;
  max_devices: number;
  session_expiry_days: number;
  allow_multi_device: boolean;
  auto_logout_oldest: boolean;
}) {
  const { error } = await supabase
    .from("workspace_security_settings")
    .upsert(input, { onConflict: "workspace_id" });
  if (error) throw error;
}