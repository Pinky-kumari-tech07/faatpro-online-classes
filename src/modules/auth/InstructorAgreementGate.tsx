import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const AGREEMENT_VERSION = "instructor-v1";

const AGREEMENT_TEXT = [
  "By uploading, creating, or publishing content on FAATPRO, you acknowledge and agree that:",
  "1. You remain the original creator of your educational content.",
  "2. You grant FAATPRO a worldwide, non-exclusive, perpetual license to host, market, distribute, promote, sell, and resell your courses through the FAATPRO platform.",
  "3. FAATPRO may display, advertise, bundle, discount, or promote your courses to learners.",
  "4. Student data, platform branding, marketing assets, and customer relationships remain the property of FAATPRO.",
  "5. FAATPRO reserves the right to review, approve, reject, suspend, or remove content that violates platform policies.",
  "6. Revenue sharing, payouts, and commissions are governed by the instructor payout policy.",
  "7. Courses may not be copied from third-party sources without proper rights and authorization.",
  "8. By accepting this agreement, you authorize FAATPRO to offer your approved courses to students through the platform.",
  "9. Intellectual property ownership of the original educational material remains with the instructor, while platform distribution rights are granted to FAATPRO under this agreement.",
  "10. Acceptance of this agreement is required before publishing or selling any course through FAATPRO.",
];

export default function InstructorAgreementGate() {
  const { user } = useAuth();
  const { membership, primaryRole } = useWorkspace();
  const qc = useQueryClient();
  const isInstructor = primaryRole === "instructor";
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["instructor-agreement", user?.id],
    enabled: !!user && isInstructor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_agreements")
        .select("id")
        .eq("user_id", user!.id)
        .eq("agreement_version", AGREEMENT_VERSION)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const needsAgreement = isInstructor && !isLoading && !existing;

  useEffect(() => {
    if (!needsAgreement) return;
    setScrolled(false);
    setChecked(false);
  }, [needsAgreement]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setScrolled(true);
  };

  const accept = async () => {
    if (!user) return;
    setSaving(true);
    let ip: string | null = null;
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      ip = (await res.json())?.ip ?? null;
    } catch { /* best-effort */ }
    const { error } = await supabase.from("user_agreements").insert({
      user_id: user.id,
      workspace_id: membership?.workspace.id ?? null,
      accepted_terms: true,
      accepted_privacy: true,
      accepted_code_of_conduct: true,
      role_at_signup: "instructor",
      agreement_version: AGREEMENT_VERSION,
      ip_address: ip,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save agreement", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome — agreement recorded." });
    qc.invalidateQueries({ queryKey: ["instructor-agreement", user.id] });
  };

  if (!needsAgreement) return null;

  return (
    <Dialog open={true} modal>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>FAATPRO Instructor Content License Agreement</DialogTitle>
          <DialogDescription>
            Please read the full agreement and confirm acceptance to access your instructor dashboard.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="border border-border rounded-md p-4 max-h-[50vh] overflow-y-auto text-sm leading-relaxed bg-surface-muted/30 space-y-3"
        >
          {AGREEMENT_TEXT.map((p, i) => (
            <p key={i} className={i === 0 ? "font-medium" : ""}>{p}</p>
          ))}
          <p className="text-xs text-muted-foreground pt-2">Version: {AGREEMENT_VERSION}</p>
        </div>

        {!scrolled && (
          <p className="text-xs text-muted-foreground">Scroll to the bottom of the agreement to enable acceptance.</p>
        )}

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            id="instr-agreement"
            checked={checked}
            onCheckedChange={(v) => setChecked(!!v)}
            disabled={!scrolled}
          />
          <span>I have read and agree to the Instructor Agreement.</span>
        </label>

        <DialogFooter>
          <Button onClick={accept} disabled={!scrolled || !checked || saving}>
            {saving ? "Saving…" : "Accept and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}