import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * End-to-end style test for the certificate snapshot workflow.
 *
 *  1. Issue a certificate against a template (v1 design).
 *  2. Simulate an admin editing the template afterwards (v2 design in DB).
 *  3. Verify the public /certificate/verify page renders the ORIGINAL v1 design
 *     from `certificates.template_snapshot`, never the updated v2 template
 *     and never the workspace default template.
 *  4. Verify the PDF download path also uses the v1 snapshot design.
 */

// -----------------------------------------------------------------------------
// Simulated backend state — mutable across steps of the test.
// -----------------------------------------------------------------------------

const V1_DESIGN = {
  width: 1123,
  height: 794,
  background: { color: "#ffffff" },
  elements: [{ id: "t1", type: "text", text: "V1_ORIGINAL_TEMPLATE", x: 40, y: 40, w: 400, h: 60, fontSize: 24 }],
};

const V2_DESIGN = {
  width: 1123,
  height: 794,
  background: { color: "#000000" },
  elements: [{ id: "t1", type: "text", text: "V2_UPDATED_TEMPLATE", x: 40, y: 40, w: 400, h: 60, fontSize: 24 }],
};

const DEFAULT_DESIGN = {
  width: 1123,
  height: 794,
  background: { color: "#eeeeee" },
  elements: [{ id: "t1", type: "text", text: "DEFAULT_FALLBACK_TEMPLATE", x: 40, y: 40, w: 400, h: 60, fontSize: 24 }],
};

const CERT_ID = "cert-1";
const TEMPLATE_ID = "tpl-1";
const WORKSPACE_ID = "ws-1";
const CODE = "VERIFY123";

// The certificate row — the trigger populates template_snapshot at insert time
// with V1_DESIGN. After that, the templates table is mutated to V2 but the
// snapshot must never change.
const certRow: any = {
  id: CERT_ID,
  workspace_id: WORKSPACE_ID,
  template_id: TEMPLATE_ID,
  certificate_number: "CERT-0001",
  verification_code: CODE,
  issued_at: "2026-01-01T00:00:00Z",
  completion_date: "2025-12-31",
  completion_percentage: 100,
  pdf_url: null,
  template_snapshot: {
    title: "V1 Title",
    body_template: "V1 body",
    accent_color: "#111111",
    design_json: V1_DESIGN,
  },
  courses: { title: "Course A" },
  profiles: { full_name: "Jane Student" },
};

// Live template row — starts as V1, then admin "edits" it to V2 mid-test.
const templateRow: any = {
  id: TEMPLATE_ID,
  workspace_id: WORKSPACE_ID,
  is_default: false,
  title: "V1 Title",
  body_template: "V1 body",
  accent_color: "#111111",
  design_json: V1_DESIGN,
};

const defaultTemplateRow: any = {
  id: "tpl-default",
  workspace_id: WORKSPACE_ID,
  is_default: true,
  title: "Default Title",
  body_template: "Default body",
  accent_color: "#999999",
  design_json: DEFAULT_DESIGN,
};

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

// Capture every CanvasRenderer render so we can assert exactly which design
// (v1 snapshot vs v2 updated vs default) got rendered.
const rendererCalls: any[] = [];
vi.mock("@/modules/certificates/canvas/CanvasRenderer", () => ({
  CanvasRenderer: (props: any) => {
    rendererCalls.push(props);
    const label = props.design?.elements?.[0]?.text ?? "unknown";
    return <div data-testid="canvas-renderer" data-label={label} />;
  },
}));

vi.mock("@/modules/certificates/components/CertificatePreview", () => ({
  CertificatePreview: (props: any) => (
    <div data-testid="legacy-preview" data-title={props.template?.title} />
  ),
}));

// Stub html2canvas + jsPDF so we can exercise downloadCertificatePdf in jsdom.
vi.mock("html2canvas", () => ({
  default: vi.fn(async () => ({
    width: 2246,
    height: 1588,
    toDataURL: () => "data:image/png;base64,AAAA",
  })),
}));

const jsPdfSave = vi.fn();
vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    addImage: vi.fn(),
    save: jsPdfSave,
  })),
}));

// Mock the Supabase client. We simulate the RPC `verify_certificate` returning
// a row that always includes the ORIGINAL snapshot, and the `certificates`
// table returning the persisted row + snapshot regardless of later template
// mutations.
vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (name: string) => {
    if (name === "verify_certificate") {
      return {
        data: [
          {
            certificate_number: certRow.certificate_number,
            issued_at: certRow.issued_at,
            student_name: certRow.profiles.full_name,
            course_title: certRow.courses.title,
            workspace_name: "Test Academy",
            completion_percentage: certRow.completion_percentage,
            completion_date: certRow.completion_date,
            verification_code: certRow.verification_code,
            accent_color: "#111111",
            revoked_at: null,
            template_id: certRow.template_id,
            template_snapshot: certRow.template_snapshot,
            pdf_url: certRow.pdf_url,
          },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  });

  const from = vi.fn((table: string) => {
    const builder: any = {
      _table: table,
      _filters: {} as Record<string, any>,
      select() { return builder; },
      eq(col: string, val: any) { builder._filters[col] = val; return builder; },
      async maybeSingle() {
        if (table === "certificates") return { data: certRow, error: null };
        if (table === "certificate_templates") {
          if (builder._filters.id === TEMPLATE_ID) return { data: templateRow, error: null };
          if (builder._filters.is_default === true) return { data: defaultTemplateRow, error: null };
          return { data: null, error: null };
        }
        if (table === "workspaces") return { data: { name: "Test Academy" }, error: null };
        return { data: null, error: null };
      },
    };
    return builder;
  });

  return { supabase: { rpc, from } };
});

// -----------------------------------------------------------------------------
// Test setup
// -----------------------------------------------------------------------------

import CertificateVerifyPage from "@/modules/public/pages/CertificateVerifyPage";
import { downloadCertificatePdf } from "@/modules/certificates/utils/downloadCertificate";

function renderVerifyPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/certificate/verify/${CODE}`]}>
        <Routes>
          <Route path="/certificate/verify/:code" element={<CertificateVerifyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rendererCalls.length = 0;
  jsPdfSave.mockClear();
  // Reset: snapshot on cert stays V1, template starts at V1.
  templateRow.design_json = V1_DESIGN;
  templateRow.title = "V1 Title";
  certRow.pdf_url = null;
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("Certificate snapshot end-to-end", () => {
  it("verify page renders the original snapshot even after the template is updated", async () => {
    // Simulate admin editing the template AFTER the certificate was issued.
    templateRow.design_json = V2_DESIGN;
    templateRow.title = "V2 Title";

    renderVerifyPage();

    await waitFor(() => expect(screen.getByText("Verified certificate")).toBeInTheDocument());
    const rendered = await screen.findByTestId("canvas-renderer");

    // Must render the frozen V1 snapshot, not the mutated V2 template and not
    // the workspace default template.
    expect(rendered.getAttribute("data-label")).toBe("V1_ORIGINAL_TEMPLATE");
    expect(rendered.getAttribute("data-label")).not.toBe("V2_UPDATED_TEMPLATE");
    expect(rendered.getAttribute("data-label")).not.toBe("DEFAULT_FALLBACK_TEMPLATE");

    const lastCall = rendererCalls[rendererCalls.length - 1];
    expect(lastCall.design).toEqual(V1_DESIGN);
  });

  it("PDF download uses the frozen snapshot design, not the updated template", async () => {
    // Admin edits template to V2 after issuance.
    templateRow.design_json = V2_DESIGN;

    await downloadCertificatePdf(CERT_ID);

    // At least one CanvasRenderer render must have used V1 snapshot.
    const usedDesigns = rendererCalls.map((c) => c.design?.elements?.[0]?.text);
    expect(usedDesigns).toContain("V1_ORIGINAL_TEMPLATE");
    expect(usedDesigns).not.toContain("V2_UPDATED_TEMPLATE");
    expect(usedDesigns).not.toContain("DEFAULT_FALLBACK_TEMPLATE");
    expect(jsPdfSave).toHaveBeenCalledWith("CERT-0001.pdf");
  });

  it("verify page never falls back to the workspace default template", async () => {
    templateRow.design_json = V2_DESIGN;
    renderVerifyPage();
    await waitFor(() => expect(screen.getByTestId("canvas-renderer")).toBeInTheDocument());
    // Legacy fallback preview must not be used when a snapshot design exists.
    expect(screen.queryByTestId("legacy-preview")).toBeNull();
  });
});