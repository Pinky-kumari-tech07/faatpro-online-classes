// Sends a test email using a workspace's saved SMTP integration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const workspace_id: string | undefined = body.workspace_id;
    const to: string | undefined = body.to;
    if (!workspace_id || !to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return json({ error: "workspace_id and a valid recipient 'to' are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Verify the caller is an admin of this workspace (RLS via user JWT).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleOk, error: roleErr } = await userClient.rpc("has_any_workspace_role", {
      _user_id: userData.user.id,
      _workspace_id: workspace_id,
      _roles: ["organization_admin", "super_admin"],
    });
    if (roleErr || !roleOk) return json({ error: "Forbidden" }, 403);

    // 2) Read full SMTP config with service role (config contains the password).
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: row, error: rowErr } = await admin
      .from("workspace_integrations")
      .select("config, enabled")
      .eq("workspace_id", workspace_id)
      .eq("provider", "email_smtp")
      .maybeSingle();
    if (rowErr) return json({ error: rowErr.message }, 500);
    if (!row || !row.enabled) return json({ error: "SMTP integration is not enabled." }, 400);

    const c = (row.config ?? {}) as Record<string, any>;
    if (!c.host || !c.from_email) return json({ error: "SMTP host and from_email are required." }, 400);

    // 3) Send the test email.
    const client = new SMTPClient({
      connection: {
        hostname: c.host,
        port: Number(c.port ?? 587),
        tls: c.encryption === "ssl" || c.encryption === "tls",
        auth: c.username && c.password ? { username: c.username, password: c.password } : undefined,
      },
    });

    await client.send({
      from: c.from_name ? `${c.from_name} <${c.from_email}>` : c.from_email,
      to,
      replyTo: c.reply_to || undefined,
      subject: "Test email from your LMS",
      content: "This is a test email confirming your SMTP integration is configured correctly.",
      html: `<p>This is a test email confirming your SMTP integration is configured correctly.</p>`,
    });
    await client.close();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}