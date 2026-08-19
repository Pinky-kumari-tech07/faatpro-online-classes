import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, Image as ImageIcon, Trash2, ExternalLink } from "lucide-react";
import { instructorProfileService } from "@/services/supabase";
import { toast } from "@/components/ui/use-toast";

interface Props {
  label: string;
  userId: string;
  folder: "aadhaar" | "pan" | "qualification" | "bank";
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  helper?: string;
  disabled?: boolean;
}

export function DocumentField({ label, userId, folder, value, onChange, helper, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!value) { setPreview(null); return; }
      const url = await instructorProfileService.signedUrl(value);
      if (on) setPreview(url);
    })();
    return () => { on = false; };
  }, [value]);

  const isImage = preview && /\.(png|jpe?g|gif|webp)$/i.test(value || "");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = await instructorProfileService.uploadDocument(userId, folder, file);
      if (value) {
        try { await instructorProfileService.deleteDocument(value); } catch { /* ignore */ }
      }
      onChange(path);
      toast({ title: `${label} uploaded`, description: "Don't forget to save." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function remove() {
    if (!value) return;
    try { await instructorProfileService.deleteDocument(value); } catch { /* ignore */ }
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Card className="p-3 border-dashed">
        {value ? (
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-md bg-muted grid place-items-center overflow-hidden flex-shrink-0">
              {isImage && preview ? (
                <img src={preview} alt={label} className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.split("/").pop()}</p>
              <p className="text-xs text-muted-foreground">Uploaded</p>
            </div>
            <div className="flex gap-1">
              {preview && (
                <Button type="button" size="sm" variant="ghost" onClick={() => window.open(preview, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => ref.current?.click()} disabled={busy || disabled}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={disabled}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy || disabled}
            className="w-full flex flex-col items-center justify-center gap-1 py-6 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="font-medium">Click to upload</span>
            <span className="text-xs">PDF, JPG, PNG · max 10 MB</span>
          </button>
        )}
        <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={pick} />
      </Card>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

export function MultiDocumentField({ label, userId, folder, value, onChange, disabled }: {
  label: string;
  userId: string;
  folder: "aadhaar" | "pan" | "qualification" | "bank";
  value: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const paths = await Promise.all(files.map((f) => instructorProfileService.uploadDocument(userId, folder, f)));
      onChange([...value, ...paths]);
      toast({ title: `${files.length} file(s) uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function removeAt(i: number) {
    const target = value[i];
    try { await instructorProfileService.deleteDocument(target); } catch { /* ignore */ }
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {value.map((p, i) => (
          <Card key={p} className="p-2.5 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">{p.split("/").pop()}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => removeAt(i)} disabled={disabled}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy || disabled}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Add files
        </Button>
        <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png" multiple className="hidden" onChange={pick} />
      </div>
    </div>
  );
}