import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, XCircle, ArrowLeft, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { certificateVerificationService } from "../services/publicCourseService";
import { CertificatePreview } from "@/modules/certificates/components/CertificatePreview";
import { CanvasRenderer } from "@/modules/certificates/canvas/CanvasRenderer";

export default function CertificateVerifyPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(code ?? "");

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["verify-cert", code],
    enabled: !!code,
    queryFn: () => certificateVerificationService.verifyCertificate(code!),
  });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setStageW(entry.contentRect.width);
    });
    ro.observe(el);
    setStageW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [data]);

  return (
    <div className="w-full max-w-[1100px] mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 md:py-16 overflow-x-hidden">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center mx-auto text-primary-foreground"><Award className="h-7 w-7" /></div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold">Verify a certificate</h1>
        <p className="text-muted-foreground mt-2">Enter a verification code to confirm authenticity.</p>
      </div>

      <Card className="p-4 sm:p-6 mt-6 sm:mt-8 border-border max-w-3xl mx-auto">
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) nav(`/certificate/verify/${input.trim()}`); }} className="flex flex-col sm:flex-row gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter verification code" className="h-11" />
          <Button type="submit" size="lg" className="w-full sm:w-auto">Verify</Button>
        </form>
      </Card>

      {code && (
        <Card className="p-4 sm:p-6 mt-6 border-border overflow-hidden">
          {isLoading && <div className="text-sm text-muted-foreground">Looking up certificate…</div>}
          {isFetched && !data && (
            <div className="text-center py-6">
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <div className="mt-3 font-semibold">Certificate not found</div>
              <p className="text-sm text-muted-foreground">The code "{code}" did not match any issued certificate.</p>
            </div>
          )}
          {data && (
            <div className="py-2">
              <div className="text-center">
                {data.revoked_at ? (
                  <>
                    <Ban className="h-10 w-10 text-destructive mx-auto" />
                    <div className="mt-3 text-xl font-semibold">Certificate revoked</div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                    <div className="mt-3 text-xl font-semibold">Verified certificate</div>
                  </>
                )}
              </div>
              <div ref={stageRef} className="mt-6 w-full">
                {(() => {
                  const snap: any = data.template_snapshot ?? null;
                  const design = snap?.design_json ?? null;
                  const renderData = {
                    student_name: data.student_name,
                    course_title: data.course_title,
                    academy_name: data.workspace_name,
                    completion_date: data.completion_date,
                    completion_percentage: data.completion_percentage,
                    certificate_number: data.certificate_number,
                    verification_code: data.verification_code,
                    issue_date: data.issued_at,
                  };
                  // Render exactly the snapshotted template — scaled to container width
                  if (design) {
                    const baseW = design.width ?? 1123;
                    const baseH = design.height ?? 794;
                    // Fall back to 1:1 when the container width can't be measured
                    // yet (first paint / non-layout environments) so the
                    // certificate always renders instead of staying blank.
                    const scale = stageW > 0 ? stageW / baseW : 1;
                    return (
                      <div
                        className="mx-auto bg-white rounded-md overflow-hidden"
                        style={{ width: "100%", height: baseH * scale }}
                      >
                        <CanvasRenderer design={design} data={renderData} scale={scale} />
                      </div>
                    );
                  }
                  // Prefer generated PDF/image if present (fallback when no design snapshot)
                  if (data.pdf_url) {
                    return (
                      <iframe
                        src={data.pdf_url}
                        title="Issued certificate"
                        className="w-full aspect-[1123/794] rounded-md border border-border bg-white"
                      />
                    );
                  }
                  // Legacy fallback — snapshot-less templates from the old renderer
                  const legacyBaseW = 1123;
                  const legacyScale = stageW > 0 ? Math.min(1, stageW / legacyBaseW) : 0.55;
                  return (
                    <div className="mx-auto" style={{ width: "100%" }}>
                    <CertificatePreview
                      scale={legacyScale}
                      template={{
                        title: snap?.title ?? "Certificate of Completion",
                        body_template: snap?.body_template ?? "This certifies that {{student_name}} has successfully completed {{course_title}}.",
                        background_style: snap?.background_style ?? "modern_vertical",
                        accent_color: snap?.accent_color ?? data.accent_color ?? "#6366f1",
                        signature_image_url: snap?.signature_image_url,
                        show_qr: snap?.show_qr ?? true,
                        show_percentage: snap?.show_percentage ?? true,
                        show_completion_date: snap?.show_completion_date ?? true,
                        show_certificate_number: snap?.show_certificate_number ?? true,
                      } as any}
                      data={renderData}
                    />
                    </div>
                  );
                })()}
              </div>
              <div className="mt-6 grid gap-4 text-left" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <div><div className="text-xs text-muted-foreground">Student</div><div className="font-medium">{data.student_name}</div></div>
                <div><div className="text-xs text-muted-foreground">Course</div><div className="font-medium">{data.course_title}</div></div>
                <div><div className="text-xs text-muted-foreground">Completion</div><div className="font-medium">{data.completion_percentage != null ? `${Math.round(data.completion_percentage)}%` : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Completed on</div><div className="font-medium">{data.completion_date ? new Date(data.completion_date).toLocaleDateString() : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Issued</div><div className="font-medium">{new Date(data.issued_at).toLocaleDateString()}</div></div>
                <div className="min-w-0"><div className="text-xs text-muted-foreground">Certificate number</div><div className="font-mono text-sm break-all">{data.certificate_number}</div></div>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back to homepage</Link>
      </div>
    </div>
  );
}