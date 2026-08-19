import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

/**
 * Shared student submission dialog.
 * Used by /app/assignments and by the in-course lesson player so the student
 * never loses the course context while submitting.
 */
export function AssignmentSubmitDialog({
  assignment, onClose, workspaceId, studentId, onSubmitted,
}: {
  assignment: any;
  onClose: () => void;
  workspaceId: string;
  studentId: string;
  onSubmitted?: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", assignment.id)
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) console.error("Load submission error:", error);
      if (data) {
        setExisting(data);
        setText(data.submission_text ?? "");
      }
      setLoading(false);
    })();
  }, [assignment.id, studentId]);

  const submit = useMutation({
    mutationFn: async () => {
      let file_path: string | null = existing?.file_path ?? null;
      if (file) {
        const path = `${workspaceId}/${studentId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("submissions").upload(path, file);
        if (error) throw error;
        file_path = path;
      }
      const payload: any = {
        workspace_id: workspaceId,
        assignment_id: assignment.id,
        student_id: studentId,
        submission_text: text || null,
        file_path,
        is_draft: false,
        submitted_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("assignment_submissions")
        .upsert(payload, { onConflict: "assignment_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: existing ? "Submission updated" : "Submitted" });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["submissions", assignment.id] });
      // Course-player state (progress, completion + certificate gating)
      qc.invalidateQueries({ queryKey: ["learn-assign-subs"] });
      qc.invalidateQueries({ queryKey: ["learn-assignments"] });
      qc.invalidateQueries({ queryKey: ["learn-progress-map"] });
      qc.invalidateQueries({ queryKey: ["course-completion-status"] });
      qc.invalidateQueries({ queryKey: ["learn-cert"] });
      onSubmitted?.();
      onClose();
    },
    onError: (e: any) => {
      console.error("Submit assignment error:", e);
      toast({ title: "Error", description: e.message ?? "Failed to submit", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Update submission" : "Submit"} · {assignment.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {existing?.graded_at && (
            <div className="text-sm text-muted-foreground rounded-md border px-3 py-2">
              This submission has been graded. Updates may not be reviewed.
            </div>
          )}
          {assignment.instructions && (
            <div className="text-sm text-muted-foreground whitespace-pre-line rounded-md border bg-muted/30 px-3 py-2 max-h-40 overflow-y-auto">
              {assignment.instructions}
            </div>
          )}
          <Textarea rows={6} placeholder="Your response…" value={text} onChange={(e) => setText(e.target.value)} />
          {assignment.allow_file_upload && (
            <div className="space-y-1">
              {existing?.file_path && !file && (
                <div className="text-xs text-muted-foreground">Current file: {existing.file_path.split("/").pop()}</div>
              )}
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={loading || submit.isPending || (!text && !file && !existing)}>
            {submit.isPending ? "Saving…" : existing ? "Update submission" : "Submit assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignmentSubmitDialog;
