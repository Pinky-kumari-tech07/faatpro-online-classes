import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { certificateService } from "@/services/supabase";
import { CertificatePreview, type CertificateTemplateData } from "./CertificatePreview";

const DYNAMIC_FIELDS = [
  "student_name", "course_title", "completion_date", "completion_percentage",
  "certificate_number", "instructor_name", "academy_name", "issue_date", "verification_code",
];

const DEFAULT_BODY =
  "This certifies that {{student_name}} has successfully completed {{course_title}} with a completion score of {{completion_percentage}} on {{completion_date}}.";

const BACKGROUND_OPTIONS = [
  { value: "clean_white", label: "Clean white" },
  { value: "soft_purple", label: "Soft purple gradient" },
  { value: "premium_blue_purple", label: "Premium blue / purple" },
  { value: "gold_academic", label: "Gold academic" },
  { value: "modern_vertical", label: "Modern vertical" },
  { value: "custom", label: "Custom image" },
];

const LAYOUT_OPTIONS = [
  { value: "modern_vertical", label: "Modern vertical" },
  { value: "minimal_vertical", label: "Minimal vertical" },
  { value: "premium_gradient", label: "Premium gradient" },
  { value: "classic_academic", label: "Classic academic" },
  { value: "corporate_skill", label: "Corporate skill" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  initial?: any;
  onSaved: () => void;
}

export function TemplateDesigner({ open, onOpenChange, workspaceId, initial, onSaved }: Props) {
  const isEdit = !!initial?.id;
  const buildInitial = () => ({
    name: initial?.name ?? "",
    title: initial?.title ?? "Certificate of Completion",
    body_template: initial?.body_template ?? DEFAULT_BODY,
    signature_name: initial?.signature_name ?? "",
    accent_color: initial?.accent_color ?? "#6366f1",
    background_style: initial?.background_style ?? "modern_vertical",
    background_url: initial?.background_url ?? null,
    logo_url: initial?.logo_url ?? null,
    signature_image_url: initial?.signature_image_url ?? null,
    layout_style: initial?.layout_style ?? "modern_vertical",
    show_qr: initial?.show_qr ?? true,
    show_percentage: initial?.show_percentage ?? true,
    show_completion_date: initial?.show_completion_date ?? true,
    show_certificate_number: initial?.show_certificate_number ?? true,
    is_default: initial?.is_default ?? false,
  });
  const [form, setForm] = useState<any>(buildInitial);
  const [baseline, setBaseline] = useState<any>(buildInitial);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (open && initial) {
      const next = { ...buildInitial(), ...initial };
      setForm(next);
      setBaseline(next);
    } else if (open && !initial) {
      const next = buildInitial();
      setForm(next);
      setBaseline(next);
    }
  }, [open, initial?.id]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const requestClose = () => {
    if (isDirty) setConfirmClose(true);
    else onOpenChange(false);
  };

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [focusField, setFocusField] = useState<"title" | "body">("body");

  const insertToken = (token: string) => {
    const tag = `{{${token}}}`;
    if (focusField === "title") {
      const el = titleRef.current;
      if (!el) { setForm({ ...form, title: (form.title ?? "") + tag }); return; }
      const s = el.selectionStart ?? form.title.length;
      const e = el.selectionEnd ?? form.title.length;
      const v = (form.title ?? "");
      setForm({ ...form, title: v.slice(0, s) + tag + v.slice(e) });
    } else {
      const el = bodyRef.current;
      if (!el) { setForm({ ...form, body_template: (form.body_template ?? "") + tag }); return; }
      const s = el.selectionStart ?? form.body_template.length;
      const e = el.selectionEnd ?? form.body_template.length;
      const v = (form.body_template ?? "");
      setForm({ ...form, body_template: v.slice(0, s) + tag + v.slice(e) });
    }
  };

  const upload = async (file: File, kind: "background" | "logo" | "signature") => {
    try {
      const url = await certificateService.uploadTemplateAsset(workspaceId, file, kind);
      if (kind === "background") setForm((f: any) => ({ ...f, background_url: url, background_style: "custom" }));
      if (kind === "logo") setForm((f: any) => ({ ...f, logo_url: url }));
      if (kind === "signature") setForm((f: any) => ({ ...f, signature_image_url: url }));
      toast({ title: "Uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, workspace_id: workspaceId };
      if (isEdit) await certificateService.updateTemplate(initial.id, payload);
      else await certificateService.createTemplate(payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Template updated" : "Template created" });
      onSaved();
      setBaseline(form);
      setConfirmClose(false);
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const template: CertificateTemplateData = form;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) requestClose();
        else onOpenChange(true);
      }}
    >
      {/* Hide shadcn's built-in close X — we provide a single labeled Close button below */}
      <DialogContent className="max-w-[1280px] w-[95vw] h-[90vh] p-0 overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <div className="text-base font-semibold">{isEdit ? "Edit template" : "New certificate template"}</div>
            <div className="text-xs text-muted-foreground">Vertical portrait • A4</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              <Save className="h-4 w-4 mr-1" /> {isEdit ? "Save changes" : "Save template"}
            </Button>
            <Button variant="outline" size="sm" onClick={requestClose}>
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] overflow-hidden">
          {/* Live preview */}
          <div className="bg-muted/30 overflow-auto grid place-items-center p-6">
            <CertificatePreview template={template} scale={0.55} />
          </div>

          {/* Settings */}
          <ScrollArea className="border-l bg-background">
            <div className="p-5 space-y-6">
              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Basics</h4>
                <div>
                  <Label>Template name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FAATPRO Modern Vertical" />
                </div>
                <div>
                  <Label>Certificate title</Label>
                  <Input ref={titleRef} value={form.title} onFocus={() => setFocusField("title")} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Body text</Label>
                  <Textarea ref={bodyRef} rows={5} value={form.body_template} onFocus={() => setFocusField("body")} onChange={(e) => setForm({ ...form, body_template: e.target.value })} />
                </div>
                <div>
                  <Label>Signature name</Label>
                  <Input value={form.signature_name ?? ""} onChange={(e) => setForm({ ...form, signature_name: e.target.value })} placeholder="Dr. R. Mehta" />
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Dynamic fields</h4></div>
                <p className="text-xs text-muted-foreground">Click a chip to insert into the focused field (title or body).</p>
                <div className="flex flex-wrap gap-1.5">
                  {DYNAMIC_FIELDS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => insertToken(f)}
                      className="text-xs px-2 py-1 rounded-md border border-border bg-muted hover:bg-primary hover:text-primary-foreground transition-colors font-mono"
                    >
                      {`{{${f}}}`}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Visual style</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Accent color</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="h-9 w-12 rounded border border-input" />
                      <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label>Layout style</Label>
                    <Select value={form.layout_style} onValueChange={(v) => setForm({ ...form, layout_style: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LAYOUT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Background</Label>
                  <Select value={form.background_style} onValueChange={(v) => setForm({ ...form, background_style: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BACKGROUND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <UploadRow label="Custom background image" value={form.background_url} onUpload={(f) => upload(f, "background")} onClear={() => setForm({ ...form, background_url: null })} />
                <UploadRow label="Logo" value={form.logo_url} onUpload={(f) => upload(f, "logo")} onClear={() => setForm({ ...form, logo_url: null })} />
                <UploadRow label="Signature image" value={form.signature_image_url} onUpload={(f) => upload(f, "signature")} onClear={() => setForm({ ...form, signature_image_url: null })} />
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Display toggles</h4>
                <ToggleRow label="Show QR / verification badge" value={form.show_qr} onChange={(v) => setForm({ ...form, show_qr: v })} />
                <ToggleRow label="Show completion percentage" value={form.show_percentage} onChange={(v) => setForm({ ...form, show_percentage: v })} />
                <ToggleRow label="Show completion date" value={form.show_completion_date} onChange={(v) => setForm({ ...form, show_completion_date: v })} />
                <ToggleRow label="Show certificate number" value={form.show_certificate_number} onChange={(v) => setForm({ ...form, show_certificate_number: v })} />
                <ToggleRow label="Set as default" value={form.is_default} onChange={(v) => setForm({ ...form, is_default: v })} />
              </section>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to save your changes before leaving the certificate builder?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue editing</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Discard changes
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              disabled={!form.name || save.isPending}
            >
              Save &amp; exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function UploadRow({ label, value, onUpload, onClear }: { label: string; value?: string | null; onUpload: (f: File) => void; onClear: () => void }) {
  const id = `up-${label.replace(/\s+/g, "-")}`;
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input id={id} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        <Button type="button" variant="outline" size="sm" asChild>
          <label htmlFor={id} className="cursor-pointer"><Upload className="h-4 w-4 mr-1" /> {value ? "Replace" : "Upload"}</label>
        </Button>
        {value && (
          <>
            <img src={value} alt="" className="h-8 w-8 rounded object-cover border" />
            <Button type="button" variant="ghost" size="sm" onClick={onClear}><X className="h-3 w-3" /></Button>
          </>
        )}
      </div>
    </div>
  );
}