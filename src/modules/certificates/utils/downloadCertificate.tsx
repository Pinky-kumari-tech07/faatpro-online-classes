import { createRoot } from "react-dom/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { CertificatePreview } from "../components/CertificatePreview";
import { CanvasRenderer } from "../canvas/CanvasRenderer";

async function fetchFullCertificate(certificateId: string) {
  const { data: cert, error } = await supabase
    .from("certificates")
    .select("*, courses(title), profiles(full_name)")
    .eq("id", certificateId)
    .maybeSingle();
  if (error) throw error;
  if (!cert) throw new Error("Certificate not found");

  let template: any = null;
  // Always prefer the frozen snapshot captured at issue time so later template
  // edits never change historical certificates.
  const snapshot: any = (cert as any).template_snapshot ?? null;
  if (snapshot) {
    template = { ...snapshot, __from_snapshot: true };
  }
  if (!template && (cert as any).template_id) {
    const { data: tpl } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("id", (cert as any).template_id)
      .maybeSingle();
    template = tpl;
  }
  if (!template) {
    const { data: tpl } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("workspace_id", (cert as any).workspace_id)
      .eq("is_default", true)
      .maybeSingle();
    template = tpl;
  }
  if (!template) {
    template = {
      name: "Default",
      title: "Certificate of Completion",
      body_template:
        "This is to certify that {{student_name}} has successfully completed {{course_title}}.",
      accent_color: "#6366f1",
      background_style: "modern_vertical",
      show_qr: true,
      show_percentage: true,
      show_completion_date: true,
      show_certificate_number: true,
    };
  }

  let workspaceName = "";
  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", (cert as any).workspace_id)
    .maybeSingle();
  if (ws) workspaceName = (ws as any).name;

  return { cert: cert as any, template, workspaceName };
}

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          })
    )
  ).then(() => undefined);
}

export async function downloadCertificatePdf(certificateId: string): Promise<void> {
  const { cert, template, workspaceName } = await fetchFullCertificate(certificateId);

  // Prefer pre-generated PDF in storage when available — no client render needed.
  if (cert.pdf_url) {
    try {
      const res = await fetch(cert.pdf_url, { mode: "cors" });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cert.certificate_number || "certificate"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // fall through to regenerate
    }
  }

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.height = "1123px";
  container.style.background = "#fff";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    const useCanvas = !!(template as any)?.design_json;
    const dj = (template as any)?.design_json;
    if (useCanvas) {
      container.style.width = `${dj.width}px`;
      container.style.height = `${dj.height}px`;
    }

    await new Promise<void>((resolve) => {
      root.render(
        useCanvas ? (
          <CanvasRenderer
            design={dj}
            scale={1}
            data={{
              student_name: cert.profiles?.full_name || "Student",
              course_title: cert.courses?.title || "Course",
              completion_date: cert.completion_date,
              completion_percentage: cert.completion_percentage,
              certificate_number: cert.certificate_number,
              verification_code: cert.verification_code,
              issue_date: cert.issued_at,
              academy_name: workspaceName || "Academy",
              instructor_name: template.signature_name || "Instructor",
            }}
          />
        ) : (
          <CertificatePreview
            template={template}
            data={{
              student_name: cert.profiles?.full_name || "Student",
              course_title: cert.courses?.title || "Course",
              completion_date: cert.completion_date,
              completion_percentage: cert.completion_percentage,
              certificate_number: cert.certificate_number,
              verification_code: cert.verification_code,
              issue_date: cert.issued_at,
              academy_name: workspaceName || "Academy",
              instructor_name: template.signature_name || "Instructor",
            }}
            scale={1}
          />
        )
      );
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await waitForImages(container);

    const node = useCanvas
      ? (container.firstElementChild as HTMLElement)
      : ((container.firstElementChild?.firstElementChild as HTMLElement | undefined) ?? (container.firstElementChild as HTMLElement));
    if (!node) throw new Error("Render failed");

    // Ensure nothing inside the rendered node clips at its edges.
    node.style.overflow = "visible";
    container.style.overflow = "visible";

    const W = useCanvas ? dj.width : 794;
    const H = useCanvas ? dj.height : 1123;
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: W,
      height: H,
      windowWidth: W,
      windowHeight: H,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    });

    // Build the PDF page from the captured canvas's actual aspect ratio so the
    // output matches the preview exactly (no cropping at top/bottom or sides).
    const PX_TO_MM = 25.4 / 96;
    const rawW = canvas.width / 2; // scale=2
    const rawH = canvas.height / 2;
    const pageW = +(rawW * PX_TO_MM).toFixed(2);
    const pageH = +(rawH * PX_TO_MM).toFixed(2);
    // Choose orientation from actual captured dimensions so landscape templates export landscape.
    const orientation: "portrait" | "landscape" = pageW > pageH ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "mm", format: [pageW, pageH] });
    const actualW = pdf.internal.pageSize.getWidth();
    const actualH = pdf.internal.pageSize.getHeight();
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      actualW,
      actualH,
      undefined,
      "FAST"
    );
    pdf.save(`${cert.certificate_number || "certificate"}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
