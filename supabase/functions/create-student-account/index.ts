import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StudentInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  status?: "active" | "invited" | "suspended";
  course_id?: string | null;
  course_slug?: string | null;
};

type Body = {
  workspace_id: string;
  students: StudentInput[];
  default_course_id?: string | null;
};

function bad(status: number, error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EMAIL_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

function isValidEmail(v: string) {
  return !!v && v.length <= 254 && !v.includes("..") && EMAIL_RE.test(v);
}

/** Mirrors public.normalize_phone_number in the database. */
function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 12 && d.startsWith("91")) d = d.slice(-10);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(-10);
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Mirrors src/lib/validators/password.ts */
function passwordProblem(pw: string): string | null {
  if (!pw) return "Password is required";
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 72) return "Password must be 72 characters or fewer";
  if (!/[A-Z]/.test(pw)) return "Password needs an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password needs a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password needs a number";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password needs a special character";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "Method not allowed");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return bad(401, "Unauthorized");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE);

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return bad(401, "Unauthorized");
  const callerId = claimsData.claims.sub as string;

  let body: Body;
  try { body = await req.json(); } catch { return bad(400, "Invalid JSON"); }

  if (!body?.workspace_id || !Array.isArray(body.students) || body.students.length === 0) {
    return bad(400, "workspace_id and students[] required");
  }

  // Authorize: caller must be org_admin / staff / super_admin in workspace
  const { data: roleOk } = await admin.rpc("has_any_workspace_role", {
    _user_id: callerId,
    _workspace_id: body.workspace_id,
    _roles: ["organization_admin", "staff", "super_admin"],
  });
  if (!roleOk) return bad(403, "Forbidden");

  const results: Array<{
    email: string;
    status: "created" | "failed" | "skipped";
    profile_id?: string;
    enrolled?: boolean;
    course_id?: string | null;
    error?: string;
  }> = [];

  // Pre-resolve slugs if any
  const slugs = Array.from(new Set(body.students.map((s) => s.course_slug).filter(Boolean) as string[]));
  let slugMap: Record<string, string> = {};
  if (slugs.length) {
    const { data: rows } = await admin
      .from("courses").select("id, slug")
      .eq("workspace_id", body.workspace_id).is("deleted_at", null).in("slug", slugs);
    slugMap = Object.fromEntries((rows ?? []).map((r: any) => [r.slug, r.id]));
  }

  for (const s of body.students) {
    try {
      const email = (s.email ?? "").trim().toLowerCase();
      if (!s.name?.trim()) {
        results.push({ email, status: "failed", error: "Student Name is required" });
        continue;
      }
      if (!isValidEmail(email)) {
        results.push({ email, status: "failed", error: "Email is not a valid address" });
        continue;
      }
      const pwProblem = passwordProblem(s.password ?? "");
      if (pwProblem) {
        results.push({ email, status: "failed", error: pwProblem });
        continue;
      }
      const phone = s.phone ? normalizePhone(s.phone) : null;
      if (s.phone && !phone) {
        results.push({ email, status: "failed", error: "Mobile number is not valid" });
        continue;
      }

      // Phone uniqueness is enforced by a unique index; check first so we do
      // not create an auth user that then fails to get a profile.
      if (phone) {
        const { data: available } = await admin.rpc("is_phone_available", { _phone: phone });
        if (available === false) {
          results.push({ email, status: "failed", error: "Mobile number already registered to another account" });
          continue;
        }
      }

      let courseId: string | null = s.course_id ?? null;
      if (!courseId && s.course_slug) {
        courseId = slugMap[s.course_slug] ?? null;
        if (!courseId) {
          results.push({ email, status: "failed", error: `Course not found: ${s.course_slug}` });
          continue;
        }
      }
      if (!courseId && body.default_course_id) courseId = body.default_course_id;

      // Create or fetch auth user
      let userId: string | null = null;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: s.password,
        email_confirm: true,
        user_metadata: { full_name: s.name },
      });
      if (createErr) {
        // If already exists, try to find user id
        const msg = createErr.message || "";
        if (/already|exists|registered/i.test(msg)) {
          // Look up via profiles by email is not available; use listUsers paged search
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
          if (!found) {
            results.push({ email, status: "failed", error: msg });
            continue;
          }
          userId = found.id;
        } else {
          results.push({ email, status: "failed", error: msg });
          continue;
        }
      } else {
        userId = created.user!.id;
      }

      // Profile upsert
      const { error: profileErr } = await admin.from("profiles").upsert({
        id: userId!,
        full_name: s.name.trim(),
        email,
        phone,
      }, { onConflict: "id" });
      if (profileErr) {
        const dup = /duplicate key|phone_normalized/i.test(profileErr.message);
        results.push({
          email,
          status: "failed",
          error: dup ? "Mobile number already registered to another account" : profileErr.message,
        });
        continue;
      }

      // Workspace member
      const { data: existingMember } = await admin
        .from("workspace_members").select("id, role")
        .eq("workspace_id", body.workspace_id).eq("profile_id", userId!).maybeSingle();

      if (existingMember) {
        await admin.from("workspace_members")
          .update({ status: s.status ?? "active" })
          .eq("id", existingMember.id);
      } else {
        const { error: mErr } = await admin.from("workspace_members").insert({
          workspace_id: body.workspace_id,
          profile_id: userId!,
          role: "student",
          status: s.status ?? "active",
        });
        if (mErr) {
          results.push({ email, status: "failed", error: mErr.message });
          continue;
        }
      }

      let enrolled = false;
      if (courseId) {
        const { data: existingEnroll } = await admin
          .from("enrollments").select("id")
          .eq("workspace_id", body.workspace_id)
          .eq("course_id", courseId)
          .eq("student_id", userId!).maybeSingle();
        if (!existingEnroll) {
          const { error: eErr } = await admin.from("enrollments").insert({
            workspace_id: body.workspace_id,
            course_id: courseId,
            student_id: userId!,
            status: "active",
          });
          if (!eErr) enrolled = true;
        } else {
          enrolled = true;
        }
      }

      results.push({
        email,
        status: "created",
        profile_id: userId!,
        enrolled,
        course_id: courseId,
      });
    } catch (e: any) {
      results.push({ email: s.email, status: "failed", error: e?.message ?? "Unknown error" });
    }
  }

  const summary = {
    total: body.students.length,
    created: results.filter((r) => r.status === "created").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  return new Response(JSON.stringify({ summary, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});