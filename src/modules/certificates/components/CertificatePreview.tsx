import { forwardRef } from "react";
import { Award, QrCode, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CertificateTemplateData {
  name?: string;
  title: string;
  body_template: string;
  signature_name?: string | null;
  logo_url?: string | null;
  background_url?: string | null;
  background_style?: string | null;
  accent_color?: string | null;
  signature_image_url?: string | null;
  layout_style?: string | null;
  show_qr?: boolean;
  show_percentage?: boolean;
  show_completion_date?: boolean;
  show_certificate_number?: boolean;
}

export interface CertificateData {
  student_name?: string;
  course_title?: string;
  completion_date?: string | Date | null;
  completion_percentage?: number | null;
  certificate_number?: string;
  instructor_name?: string;
  academy_name?: string;
  issue_date?: string | Date | null;
  verification_code?: string;
}

const SAMPLE: Required<CertificateData> = {
  student_name: "Jane Doe",
  course_title: "AI Applications in Agriculture",
  completion_date: new Date(),
  completion_percentage: 94,
  certificate_number: "CERT-2026-ABC123",
  instructor_name: "Dr. R. Mehta",
  academy_name: "FAATPRO Academy",
  issue_date: new Date(),
  verification_code: "VERIFYCODE12345",
};

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function interpolate(text: string, data: Required<CertificateData>) {
  const map: Record<string, string> = {
    student_name: data.student_name,
    course_title: data.course_title,
    completion_date: fmtDate(data.completion_date),
    completion_percentage: `${Math.round(Number(data.completion_percentage) || 0)}%`,
    certificate_number: data.certificate_number,
    instructor_name: data.instructor_name,
    academy_name: data.academy_name,
    issue_date: fmtDate(data.issue_date),
    verification_code: data.verification_code,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : `{{${k}}}`));
}

function backgroundCss(style?: string | null, url?: string | null, accent = "#6366f1"): React.CSSProperties {
  if (style === "custom" && url) {
    return { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  switch (style) {
    case "clean_white":
      return { background: "#ffffff" };
    case "soft_purple":
      return { background: "linear-gradient(135deg,#faf5ff 0%,#ede9fe 100%)" };
    case "premium_blue_purple":
      return { background: "linear-gradient(135deg,#1e1b4b 0%,#4338ca 50%,#7c3aed 100%)", color: "#fff" };
    case "gold_academic":
      return { background: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 50%,#fde68a 100%)" };
    default:
      return { background: `linear-gradient(180deg,#ffffff 0%, ${accent}11 100%)` };
  }
}

interface Props {
  template: CertificateTemplateData;
  data?: CertificateData;
  scale?: number;
  className?: string;
}

export const CertificatePreview = forwardRef<HTMLDivElement, Props>(({ template, data, scale = 1, className }, ref) => {
  const merged: Required<CertificateData> = { ...SAMPLE, ...(data ?? {}) };
  const accent = template.accent_color || "#6366f1";
  const isDark = template.background_style === "premium_blue_purple";
  const bodyText = interpolate(template.body_template || "", merged);

  const W = 794;
  const H = 1123;

  return (
    <div className={cn("relative", className)} style={{ width: W * scale, height: H * scale }}>
      <div
        ref={ref}
        className="absolute top-0 left-0 origin-top-left shadow-xl"
        style={{
          width: W,
          height: H,
          transform: `scale(${scale})`,
          ...backgroundCss(template.background_style, template.background_url, accent),
          color: isDark ? "#fff" : "#0f172a",
        }}
      >
        {/* Decorative top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-4"
          style={{ background: `linear-gradient(90deg, ${accent}, #a855f7)` }}
        />
        <div className="absolute inset-0 p-16 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {template.logo_url ? (
                <img src={template.logo_url} alt="logo" className="h-14 w-14 object-contain" />
              ) : (
                <div
                  className="h-14 w-14 rounded-xl grid place-items-center"
                  style={{ background: accent, color: "#fff" }}
                >
                  <Award className="h-7 w-7" />
                </div>
              )}
              <div>
                <div className="text-sm uppercase tracking-[0.25em] opacity-70">{merged.academy_name}</div>
                <div className="text-xs opacity-60">Verified Learning Outcome</div>
              </div>
            </div>
            {template.show_certificate_number && (
              <div className="text-right text-xs opacity-70">
                <div className="uppercase tracking-widest">Certificate No.</div>
                <div className="font-mono mt-1">{merged.certificate_number}</div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mt-20 text-center">
            <div className="text-xs uppercase tracking-[0.4em] opacity-60">Certificate</div>
            <h1
              className="mt-3 text-5xl font-serif font-semibold tracking-tight"
              style={{ color: isDark ? "#fff" : accent }}
            >
              {template.title || "Certificate of Completion"}
            </h1>
            <div className="mt-2 mx-auto h-px w-24" style={{ background: accent }} />
          </div>

          {/* Recipient */}
          <div className="mt-14 text-center">
            <div className="text-sm opacity-70">This is proudly presented to</div>
            <div className="mt-4 text-5xl font-serif italic" style={{ color: isDark ? "#fff" : "#111827" }}>
              {merged.student_name}
            </div>
          </div>

          {/* Body */}
          <div className="mt-10 mx-auto max-w-xl text-center text-base leading-relaxed opacity-90 whitespace-pre-wrap">
            {bodyText}
          </div>

          {/* Course title pill */}
          <div className="mt-8 mx-auto">
            <div
              className="px-5 py-2 rounded-full text-sm font-medium"
              style={{ background: `${accent}22`, color: isDark ? "#fff" : accent, border: `1px solid ${accent}44` }}
            >
              {merged.course_title}
            </div>
          </div>

          {/* Percentage ring */}
          {template.show_percentage && merged.completion_percentage != null && (
            <div className="mt-10 flex justify-center">
              <PercentageRing value={Number(merged.completion_percentage)} color={accent} dark={isDark} />
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-10 flex items-end justify-between">
            <div className="text-left">
              {template.signature_image_url && (
                <img src={template.signature_image_url} alt="signature" className="h-12 mb-1 object-contain" />
              )}
              <div className="h-px w-44 mb-2" style={{ background: isDark ? "#ffffff66" : "#0f172a55" }} />
              <div className="text-sm font-medium">{template.signature_name || merged.instructor_name}</div>
              <div className="text-xs opacity-60">Authorized Signatory</div>
            </div>

            <div className="text-center text-xs space-y-1 opacity-80">
              {template.show_completion_date && (
                <div>
                  <span className="opacity-60">Completed: </span>
                  <span className="font-medium">{fmtDate(merged.completion_date)}</span>
                </div>
              )}
              <div>
                <span className="opacity-60">Issued: </span>
                <span className="font-medium">{fmtDate(merged.issue_date)}</span>
              </div>
              <div className="flex items-center justify-center gap-1 pt-1">
                <ShieldCheck className="h-3 w-3" style={{ color: accent }} />
                <span className="font-mono">{merged.verification_code}</span>
              </div>
            </div>

            {template.show_qr && (
              <div
                className="h-20 w-20 rounded-md grid place-items-center"
                style={{ background: isDark ? "#ffffff11" : "#0f172a08", border: `1px solid ${isDark ? "#ffffff33" : "#0f172a22"}` }}
              >
                <QrCode className="h-12 w-12" style={{ color: isDark ? "#fff" : accent }} />
              </div>
            )}
          </div>
        </div>

        {/* Decorative bottom accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2"
          style={{ background: `linear-gradient(90deg, #a855f7, ${accent})` }}
        />
      </div>
    </div>
  );
});
CertificatePreview.displayName = "CertificatePreview";

function PercentageRing({ value, color, dark }: { value: number; color: string; dark: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <svg width={92} height={92} viewBox="0 0 92 92">
        <circle cx={46} cy={46} r={r} fill="none" stroke={dark ? "#ffffff22" : "#0f172a15"} strokeWidth={8} />
        <circle
          cx={46}
          cy={46}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 46 46)"
        />
        <text
          x={46}
          y={51}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill={dark ? "#fff" : color}
        >
          {Math.round(pct)}%
        </text>
      </svg>
      <div className="text-xs uppercase tracking-widest opacity-70">Completion</div>
    </div>
  );
}