import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Settings as SettingsIcon, Upload, Image as ImageIcon, PenLine, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { INDIAN_STATES } from "./invoiceUtils";
import {
  collectErrors, validateCompanyName, validateEmail, validateGstin, validateGstRate,
  validateHsnSac, validatePan, validatePhone, validatePincode,
} from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";

const DEFAULTS = {
  company_name: "FAATPRO",
  company_gstin: "",
  pan_number: "",
  business_address: "",
  business_city: "",
  business_state: "Odisha",
  business_country: "India",
  business_pin: "",
  business_email: "",
  business_phone: "",
  invoice_prefix: "INV",
  invoice_starting_number: 1,
  default_hsn_sac: "999293",
  default_gst_rate: 18,
  authorized_signatory: "",
  signatory_designation: "",
  logo_url: "",
  signature_url: "",
  invoice_footer_text: "",
  invoice_notes: "",
  enable_gst: true,
  enable_invoice_logo: true,
  enable_qr_code: true,
  enable_digital_signature: true,
  terms: "",
};

export default function GstSettingsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(DEFAULTS);
  const [uploading, setUploading] = useState<"logo" | "signature" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    enabled: !!wsId,
    queryKey: ["gst-settings", wsId],
    queryFn: async () => {
      const { data, error } = await supabase.from("gst_settings").select("*").eq("workspace_id", wsId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULTS, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No workspace");
      const found = collectErrors([
        ["company_name", validateCompanyName(form.company_name)],
        ["company_gstin", validateGstin(form.company_gstin)],
        ["pan_number", validatePan(form.pan_number)],
        ["business_email", validateEmail(form.business_email, { label: "Business email" })],
        ["business_phone", validatePhone(form.business_phone, { label: "Business phone" })],
        ["business_pin", validatePincode(form.business_pin)],
        ["default_gst_rate", validateGstRate(form.default_gst_rate)],
        ["default_hsn_sac", validateHsnSac(form.default_hsn_sac)],
      ]);
      setErrors(found);
      const first = Object.values(found)[0];
      if (first) throw new Error(first);
      const payload = {
        ...form,
        workspace_id: wsId,
        invoice_starting_number: Number(form.invoice_starting_number) || 1,
        default_gst_rate: Number(form.default_gst_rate),
      };
      const { error } = await supabase.from("gst_settings").upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setErrors({});
      toast({ title: "GST settings saved" });
      qc.invalidateQueries({ queryKey: ["gst-settings", wsId] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: mapDbError(e), variant: "destructive" }),
  });

  const set = (k: string, v: any) => {
    setErrors((p) => ({ ...p, [k]: "" }));
    setForm((f: any) => ({ ...f, [k]: v }));
  };

  const uploadAsset = async (file: File, kind: "logo" | "signature") => {
    if (!wsId) return;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `invoice/${wsId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("certificate-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("certificate-assets").getPublicUrl(path);
      set(kind === "logo" ? "logo_url" : "signature_url", data.publicUrl);
      toast({ title: `${kind === "logo" ? "Logo" : "Signature"} uploaded` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader title="Finance · GST & Invoice Settings" description="Configure seller details, branding, signatory, and invoice defaults. These appear on every generated invoice." />

      <Card className="p-5 border-border space-y-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Company Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company name" error={errors.company_name}><Input value={form.company_name ?? ""} aria-invalid={!!errors.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
          <Field label="GSTIN" error={errors.company_gstin}><Input value={form.company_gstin ?? ""} aria-invalid={!!errors.company_gstin} onChange={(e) => set("company_gstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" /></Field>
          <Field label="PAN number" error={errors.pan_number}><Input value={form.pan_number ?? ""} aria-invalid={!!errors.pan_number} onChange={(e) => set("pan_number", e.target.value.toUpperCase())} placeholder="AAAAA0000A" /></Field>
          <Field label="Business email" error={errors.business_email}><Input type="email" value={form.business_email ?? ""} aria-invalid={!!errors.business_email} onChange={(e) => set("business_email", e.target.value)} /></Field>
          <Field label="Business phone" error={errors.business_phone}><Input value={form.business_phone ?? ""} aria-invalid={!!errors.business_phone} onChange={(e) => set("business_phone", e.target.value)} /></Field>
          <Field label="Authorized signatory name"><Input value={form.authorized_signatory ?? ""} onChange={(e) => set("authorized_signatory", e.target.value)} placeholder="e.g. Rajesh Kumar" /></Field>
          <Field label="Signatory designation"><Input value={form.signatory_designation ?? ""} onChange={(e) => set("signatory_designation", e.target.value)} placeholder="e.g. Director / Proprietor" /></Field>
          <Field label="Business address" full><Textarea rows={2} value={form.business_address ?? ""} onChange={(e) => set("business_address", e.target.value)} /></Field>
          <Field label="City"><Input value={form.business_city ?? ""} onChange={(e) => set("business_city", e.target.value)} /></Field>
          <Field label="State">
            <Select value={form.business_state ?? "Odisha"} onValueChange={(v) => set("business_state", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country"><Input value={form.business_country ?? "India"} onChange={(e) => set("business_country", e.target.value)} /></Field>
          <Field label="PIN" error={errors.business_pin}><Input value={form.business_pin ?? ""} aria-invalid={!!errors.business_pin} onChange={(e) => set("business_pin", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="p-5 border-border space-y-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Branding — Logo & Signature</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AssetUpload
            label="Company logo (PNG/JPG)"
            url={form.logo_url}
            onFile={(f) => uploadAsset(f, "logo")}
            onClear={() => set("logo_url", "")}
            loading={uploading === "logo"}
            icon={<ImageIcon className="h-4 w-4" />}
          />
          <AssetUpload
            label="Authorized signature (transparent PNG)"
            url={form.signature_url}
            onFile={(f) => uploadAsset(f, "signature")}
            onClear={() => set("signature_url", "")}
            loading={uploading === "signature"}
            icon={<PenLine className="h-4 w-4" />}
          />
        </div>
      </Card>

      <Card className="p-5 border-border space-y-5">
        <h3 className="font-semibold text-sm">Invoice Numbering & GST Defaults</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Invoice prefix"><Input value={form.invoice_prefix ?? ""} onChange={(e) => set("invoice_prefix", e.target.value)} placeholder="INV" /></Field>
          <Field label="Starting number">
            <Input type="number" min={1} value={form.invoice_starting_number ?? 1} onChange={(e) => set("invoice_starting_number", e.target.value)} />
          </Field>
          <Field label="Default HSN/SAC" error={errors.default_hsn_sac}><Input value={form.default_hsn_sac ?? ""} aria-invalid={!!errors.default_hsn_sac} onChange={(e) => set("default_hsn_sac", e.target.value)} placeholder="999293 (online education)" /></Field>
          <Field label="Default GST rate (%)">
            <Input type="number" step="0.01" value={form.default_gst_rate ?? 18} onChange={(e) => set("default_gst_rate", e.target.value)} />
          </Field>
          <Field label="Invoice notes (shown above footer)" full>
            <Textarea rows={2} value={form.invoice_notes ?? ""} onChange={(e) => set("invoice_notes", e.target.value)} placeholder="e.g. Thank you for your business." />
          </Field>
          <Field label="Invoice footer text" full>
            <Textarea rows={2} value={form.invoice_footer_text ?? ""} onChange={(e) => set("invoice_footer_text", e.target.value)} placeholder="This is a computer-generated GST Invoice. No physical signature required." />
          </Field>
          <Field label="Terms & conditions" full>
            <Textarea rows={2} value={form.terms ?? ""} onChange={(e) => set("terms", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 border-border space-y-5">
        <h3 className="font-semibold text-sm">Invoice Feature Toggles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ToggleRow label="Enable GST calculation" hint="Show tax lines on invoices" checked={!!form.enable_gst} onChange={(v) => set("enable_gst", v)} />
          <ToggleRow label="Show logo on invoice" hint="Renders your uploaded logo in header" checked={!!form.enable_invoice_logo} onChange={(v) => set("enable_invoice_logo", v)} />
          <ToggleRow label="Show QR verification code" hint="Adds a scannable verification QR" checked={!!form.enable_qr_code} onChange={(v) => set("enable_qr_code", v)} />
          <ToggleRow label="Show digital signature" hint="Renders the uploaded signature image" checked={!!form.enable_digital_signature} onChange={(v) => set("enable_digital_signature", v)} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, full, error }: { label: string; children: React.ReactNode; full?: boolean; error?: string }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AssetUpload({ label, url, onFile, onClear, loading, icon }: {
  label: string; url?: string; onFile: (f: File) => void; onClear: () => void; loading?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">{icon}{label}</Label>
      <div className="rounded-md border border-dashed border-border p-3 flex items-center gap-3 min-h-[96px]">
        {url ? (
          <>
            <img src={url} alt="asset" className="h-16 w-auto max-w-[140px] object-contain bg-muted/40 rounded" />
            <div className="flex flex-col gap-1">
              <label className="cursor-pointer">
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <Button asChild size="sm" variant="outline" disabled={loading}>
                  <span>{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3 mr-1" /> Replace</>}</span>
                </Button>
              </label>
              <Button size="sm" variant="ghost" onClick={onClear} className="text-destructive"><X className="h-3 w-3 mr-1" /> Remove</Button>
            </div>
          </>
        ) : (
          <label className="cursor-pointer flex-1">
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <div className="flex flex-col items-center justify-center text-muted-foreground text-xs gap-1 py-3">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>Click to upload</span>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
