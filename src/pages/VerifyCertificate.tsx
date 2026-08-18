import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Award, CheckCircle2, XCircle } from "lucide-react";
import { certificateService } from "@/services/supabase";

export default function VerifyCertificate() {
  const { code } = useParams();
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [cert, setCert] = useState<any>(null);

  useEffect(() => {
    if (!code) return;
    certificateService.verify(code)
      .then((r) => { if (r) { setCert(r); setState("ok"); } else setState("missing"); })
      .catch(() => setState("missing"));
  }, [code]);

  return (
    <div className="min-h-screen bg-surface-muted grid place-items-center p-6">
      <Card className="max-w-xl w-full p-10 border-border shadow-soft">
        <div className="text-center space-y-4">
          {state === "loading" && <p className="text-muted-foreground">Verifying…</p>}
          {state === "missing" && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-2xl font-bold">Certificate not found</h1>
              <p className="text-sm text-muted-foreground">The verification code <span className="font-mono">{code}</span> is invalid.</p>
            </>
          )}
          {state === "ok" && cert && (
            <>
              <Award className="h-12 w-12 mx-auto text-primary" />
              <h1 className="text-2xl font-bold">Verified certificate</h1>
              <p className="text-muted-foreground">Issued by {cert.workspace_name}</p>
              <div className="border-y border-border py-6 my-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Awarded to</p>
                <p className="text-xl font-semibold mt-1">{cert.student_name}</p>
                <p className="text-sm text-muted-foreground mt-3">For completing</p>
                <p className="text-lg font-medium mt-1">{cert.course_title}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">{cert.certificate_number}</span>
                <span>{new Date(cert.issued_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-success text-sm">
                <CheckCircle2 className="h-4 w-4" /> Authentic
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}