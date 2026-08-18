import { supabase } from "@/integrations/supabase/client";
import { normalizeEmail, validateEmail, validatePhone, validatePassword } from "@/lib/validators";

/**
 * Canonical CSV headers. "Student Name" is the canonical name column because
 * that is what the Students page exports; legacy "name" files stay supported.
 */
const HEADER_ALIASES: Record<string, keyof StudentRow> = {
  "student name": "name",
  "name": "name",
  "full name": "name",
  "email": "email",
  "email address": "email",
  "password": "password",
  "temporary password": "password",
  "phone": "phone",
  "mobile": "phone",
  "mobile number": "phone",
  "phone number": "phone",
  "course_slug": "course_slug",
  "course slug": "course_slug",
  "course": "course_slug",
  "status": "status",
};

export type StudentRow = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  course_slug?: string;
  status?: "active" | "invited" | "suspended";
};

export type ValidatedRow = StudentRow & {
  rowNumber: number;
  valid: boolean;
  error?: string;
  course_id?: string | null;
};

export const studentService = {
  async createStudent(payload: {
    workspace_id: string;
    name: string;
    email: string;
    password: string;
    phone?: string;
    status?: string;
    course_id?: string | null;
  }) {
    const { data, error } = await supabase.functions.invoke("create-student-account", {
      body: {
        workspace_id: payload.workspace_id,
        students: [{
          name: payload.name,
          email: payload.email,
          password: payload.password,
          phone: payload.phone,
          status: payload.status ?? "active",
          course_id: payload.course_id ?? null,
        }],
      },
    });
    if (error) throw error;
    const first = (data as any)?.results?.[0];
    if (first?.status === "failed") throw new Error(first.error || "Failed to create student");
    return first;
  },

  async importStudents(payload: {
    workspace_id: string;
    students: StudentRow[];
    default_course_id?: string | null;
  }) {
    const { data, error } = await supabase.functions.invoke("create-student-account", {
      body: payload,
    });
    if (error) throw error;
    return data as {
      summary: { total: number; created: number; failed: number };
      results: Array<{ email: string; status: string; enrolled?: boolean; error?: string; course_id?: string | null }>;
    };
  },

  parseCsv(text: string): StudentRow[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = splitCsvLine(lines[0]).map((h) => {
      const key = h.trim().toLowerCase().replace(/^\ufeff/, "");
      return HEADER_ALIASES[key] ?? key;
    });
    const rows: StudentRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const obj: any = {};
      headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? "").trim(); });
      rows.push({
        name: obj.name ?? "",
        email: obj.email ?? "",
        password: obj.password ?? "",
        phone: obj.phone || undefined,
        course_slug: obj.course_slug || undefined,
        status: (String(obj.status ?? "").toLowerCase() as any) || undefined,
      });
    }
    return rows;
  },

  validate(rows: StudentRow[], slugMap: Record<string, string>): ValidatedRow[] {
    const seen = new Set<string>();
    const seenPhones = new Set<string>();
    return rows.map((r, i) => {
      const email = normalizeEmail(r.email);
      const phoneDigits = String(r.phone ?? "").replace(/\D/g, "");
      let error: string | undefined;
      let valid = true;
      let course_id: string | null = null;
      const emailCheck = validateEmail(email, { required: true, label: "Email" });
      const passwordCheck = validatePassword(r.password);
      const phoneCheck = validatePhone(r.phone, { label: "Mobile" });
      if (!r.name?.trim()) { valid = false; error = 'Column "Student Name" is required'; }
      else if (emailCheck.valid === false) { valid = false; error = `Column "Email": ${emailCheck.message}`; }
      else if (!r.password) { valid = false; error = 'Column "Password" is required for new accounts'; }
      else if (passwordCheck.valid === false) { valid = false; error = `Column "Password": ${passwordCheck.message}`; }
      else if (phoneCheck.valid === false) { valid = false; error = `Column "Mobile": ${phoneCheck.message}`; }
      else if (seen.has(email)) { valid = false; error = "Duplicate email in this file"; }
      else if (phoneDigits && seenPhones.has(phoneDigits.slice(-10))) { valid = false; error = "Duplicate mobile number in this file"; }
      else if (r.course_slug) {
        course_id = slugMap[r.course_slug] ?? null;
        if (!course_id) { valid = false; error = `Course not found: ${r.course_slug}`; }
      }
      if (valid) {
        seen.add(email);
        if (phoneDigits) seenPhones.add(phoneDigits.slice(-10));
      }
      return { ...r, email, rowNumber: i + 2, valid, error, course_id };
    });
  },

  sampleCsv(): string {
    return "Student Name,Email,Password,Mobile,Course Slug,Status\nAarav Sharma,aarav@example.com,Student@123,9000000000,,active\nPriya Mehta,priya@example.com,Student@123,9000000001,,active\n";
  },
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}