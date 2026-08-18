import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Award, Plus, Search, MoreHorizontal, Eye, Copy, Trash2, Star, Pencil, Ban, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { certificateService } from "@/services/supabase";
import { toast } from "@/components/ui/use-toast";
import { CertificatePreview } from "./components/CertificatePreview";
import { downloadCertificatePdf } from "./utils/downloadCertificate";
import { TemplateDesigner } from "./components/TemplateDesigner";
import { IssueCertificateDialog } from "./components/IssueCertificateDialog";
import { CanvasEditorDialog } from "./canvas/CanvasEditorDialog";
import { CanvasRenderer } from "./canvas/CanvasRenderer";
import { goldParchmentPreset, indianInstitutePreset, goldParchmentLandscapePreset, indianInstituteLandscapePreset } from "./canvas/presets";
import { emptyDesign } from "./canvas/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function CertificatesPage() {
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const isStudent = primaryRole === "student";
  const canManage = ["organization_admin", "staff", "super_admin", "instructor"].includes(primaryRole ?? "");
  const qc = useQueryClient();

  const [designerOpen, setDesignerOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasEditingTpl, setCanvasEditingTpl] = useState<any | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<any | null>(null);
  const [tplSearch, setTplSearch] = useState("");
  const [orientationFilter, setOrientationFilter] = useState<"all" | "portrait" | "landscape">("all");

  const { data: templates } = useQuery({
    queryKey: ["cert-templates", wsId],
    queryFn: () => certificateService.listTemplates(wsId),
  });
  const { data: issued } = useQuery({
    queryKey: ["cert-issued", wsId, isStudent && user?.id],
    queryFn: () =>
      certificateService.listIssued(isStudent ? null : wsId, {
        studentId: isStudent ? user?.id : undefined,
      }),
  });

  const filteredTpls = useMemo(
    () => (templates ?? []).filter((t: any) => {
      if (!t.name?.toLowerCase().includes(tplSearch.toLowerCase())) return false;
      if (orientationFilter === "all") return true;
      const o = t.design_json?.orientation ?? t.orientation ?? "portrait";
      return o === orientationFilter;
    }),
    [templates, tplSearch, orientationFilter],
  );

  const refreshTemplates = () => qc.invalidateQueries({ queryKey: ["cert-templates", wsId] });
  const refreshIssued = () => qc.invalidateQueries({ queryKey: ["cert-issued", wsId] });

  const openNew = () => { setEditingTpl(null); setDesignerOpen(true); };
  const openBlankPortrait = () => {
    setCanvasEditingTpl({ id: undefined, name: "Blank Portrait", is_default: false, design_json: emptyDesign("portrait") } as any);
    setCanvasOpen(true);
  };
  const openBlankLandscape = () => {
    setCanvasEditingTpl({ id: undefined, name: "Blank Landscape", is_default: false, design_json: emptyDesign("landscape") } as any);
    setCanvasOpen(true);
  };
  const openGoldPreset = () => {
    setCanvasEditingTpl({
      id: undefined,
      name: "Classic Gold (Portrait)",
      is_default: false,
      design_json: goldParchmentPreset(),
    } as any);
    setCanvasOpen(true);
  };
  const openGoldLandscape = () => {
    setCanvasEditingTpl({
      id: undefined,
      name: "Classic Gold (Landscape)",
      is_default: false,
      design_json: goldParchmentLandscapePreset(),
    } as any);
    setCanvasOpen(true);
  };
  const openIndianInstitutePreset = () => {
    setCanvasEditingTpl({
      id: undefined,
      name: "Indian Institute (Portrait)",
      is_default: false,
      design_json: indianInstitutePreset(),
    } as any);
    setCanvasOpen(true);
  };
  const openIndianInstituteLandscape = () => {
    setCanvasEditingTpl({
      id: undefined,
      name: "Indian Institute (Landscape)",
      is_default: false,
      design_json: indianInstituteLandscapePreset(),
    } as any);
    setCanvasOpen(true);
  };
  const openEdit = (t: any) => {
    if (t?.design_json) { setCanvasEditingTpl(t); setCanvasOpen(true); }
    else { setEditingTpl(t); setDesignerOpen(true); }
  };

  const duplicate = useMutation({
    mutationFn: (id: string) => certificateService.duplicateTemplate(id),
    onSuccess: () => { toast({ title: "Template duplicated" }); refreshTemplates(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => certificateService.deleteTemplate(id),
    onSuccess: () => { toast({ title: "Template deleted" }); refreshTemplates(); },
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => certificateService.setDefaultTemplate(wsId, id),
    onSuccess: () => { toast({ title: "Default template updated" }); refreshTemplates(); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => certificateService.revokeCertificate(id),
    onSuccess: () => { toast({ title: "Certificate revoked" }); refreshIssued(); },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="text-muted-foreground mt-1">
            {isStudent ? "View and download your achievements." : "Design templates, issue, and verify certificates."}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button onClick={() => setIssueOpen(true)}><Award className="h-4 w-4 mr-1" /> Issue certificate</Button>
          </div>
        )}
      </header>

      <Tabs defaultValue="issued">
        <TabsList>
          <TabsTrigger value="issued">Issued certificates</TabsTrigger>
          {canManage && <TabsTrigger value="templates">Templates</TabsTrigger>}
        </TabsList>

        <TabsContent value="issued" className="mt-4">
          <Card className="border-border shadow-none">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Certificate #</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(issued?.rows ?? []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell>{c.courses?.title ?? "—"}</TableCell>
                    <TableCell>{c.completion_percentage != null ? `${Math.round(c.completion_percentage)}%` : "—"}</TableCell>
                    <TableCell>{c.completion_date ? new Date(c.completion_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.certificate_number}</TableCell>
                    <TableCell>{new Date(c.issued_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {c.revoked_at ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">Revoked</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-success/10 text-success">Verified</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setPreviewCert(c)}><Eye className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download PDF"
                          onClick={async () => {
                            try {
                              toast({ title: "Preparing certificate…" });
                              await downloadCertificatePdf(c.id);
                            } catch (e: any) {
                              console.error("cert download failed", e);
                              toast({ title: "Download failed", description: e?.message || "Please try again.", variant: "destructive" });
                            }
                          }}
                        ><Download className="h-4 w-4" /></Button>
                        {canManage && !c.revoked_at && (
                          <Button variant="ghost" size="sm" onClick={() => revoke.mutate(c.id)}><Ban className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(issued?.rows.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />No certificates yet.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="templates" className="mt-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search templates…" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} />
              </div>
              <Select value={orientationFilter} onValueChange={(v) => setOrientationFilter(v as any)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Orientation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All orientations</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTpls.map((t: any) => {
                const orient = t.design_json?.orientation ?? t.orientation ?? "portrait";
                const isLandscape = orient === "landscape";
                const thumbH = isLandscape ? 200 : 280;
                const baseW = t.design_json?.width ?? (isLandscape ? 1123 : 794);
                const baseH = t.design_json?.height ?? (isLandscape ? 794 : 1123);
                const thumbScale = Math.min(thumbH / baseH, 320 / baseW);
                return (
                <Card key={t.id} className="overflow-hidden border-border shadow-sm group">
                  <div className="bg-muted/30 overflow-hidden grid place-items-center border-b" style={{ height: thumbH + 16 }}>
                    <div className="pointer-events-none">
                      {t.design_json ? (
                        <CanvasRenderer design={t.design_json} scale={thumbScale} preview />
                      ) : (
                        <CertificatePreview template={t} scale={0.22} />
                      )}
                    </div>
                  </div>
                  <div className="p-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{t.name}</h4>
                        {t.is_default && <span className="text-[10px] uppercase font-medium bg-primary-soft text-primary px-2 py-0.5 rounded">Default</span>}
                        {isLandscape ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-0 text-[10px] uppercase">🟦 Landscape</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-0 text-[10px] uppercase">🟨 Portrait</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.layout_style ?? "modern_vertical"}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate.mutate(t.id)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                        {!t.is_default && <DropdownMenuItem onClick={() => setDefault.mutate(t.id)}><Star className="h-4 w-4 mr-2" /> Set as default</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
                );
              })}
              {filteredTpls.length === 0 && (
                <Card className="p-12 border-dashed col-span-full bg-surface-muted text-center text-sm text-muted-foreground shadow-none">
                  No templates yet. Create one to start issuing certificates.
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {canManage && (
        <TemplateDesigner
          open={designerOpen}
          onOpenChange={setDesignerOpen}
          workspaceId={wsId}
          initial={editingTpl}
          onSaved={refreshTemplates}
        />
      )}
      {canManage && (
        <CanvasEditorDialog
          open={canvasOpen}
          onOpenChange={setCanvasOpen}
          workspaceId={wsId}
          initial={canvasEditingTpl}
          onSaved={refreshTemplates}
        />
      )}
      <IssueCertificateDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        workspaceId={wsId}
        templates={templates ?? []}
        onSaved={refreshIssued}
      />

      <Dialog open={!!previewCert} onOpenChange={(v) => !v && setPreviewCert(null)}>
        <DialogContent className="max-w-[900px] w-[95vw] max-h-[90vh] overflow-auto p-4 sm:p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle>Certificate preview</DialogTitle>
          </DialogHeader>
          {previewCert && (() => {
            const tpl = (templates ?? []).find((t: any) => t.id === previewCert.template_id) ?? (templates ?? []).find((t: any) => t.is_default) ?? (templates ?? [])[0] ?? {
              title: "Certificate of Completion",
              body_template: "This certifies that {{student_name}} has successfully completed {{course_title}}.",
              background_style: "modern_vertical",
              accent_color: "#6366f1",
              show_qr: true, show_percentage: true, show_completion_date: true, show_certificate_number: true,
            };
            const baseW = (tpl as any)?.design_json?.width ?? 794;
            const maxW = Math.min(window.innerWidth * 0.9, 900) - 32;
            const scale = Math.min(0.6, Math.max(0.25, maxW / baseW));
            return (
              <div className="flex flex-col items-center gap-4">
                <div className="grid place-items-center">
                  {(tpl as any)?.design_json ? (
                    <CanvasRenderer
                      design={(tpl as any).design_json}
                      scale={scale}
                      data={{
                        student_name: previewCert.profiles?.full_name ?? "Student",
                        course_title: previewCert.courses?.title ?? "Course",
                        completion_date: previewCert.completion_date,
                        completion_percentage: previewCert.completion_percentage,
                        certificate_number: previewCert.certificate_number,
                        verification_code: previewCert.verification_code,
                        issue_date: previewCert.issued_at,
                      }}
                    />
                  ) : (
                    <CertificatePreview
                      template={tpl as any}
                      scale={scale}
                      data={{
                        student_name: previewCert.profiles?.full_name ?? "Student",
                        course_title: previewCert.courses?.title ?? "Course",
                        completion_date: previewCert.completion_date,
                        completion_percentage: previewCert.completion_percentage,
                        certificate_number: previewCert.certificate_number,
                        verification_code: previewCert.verification_code,
                        issue_date: previewCert.issued_at,
                      }}
                    />
                  )}
                </div>
                <Button
                  variant="default"
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    try {
                      toast({ title: "Preparing certificate…" });
                      await downloadCertificatePdf(previewCert.id);
                    } catch (e: any) {
                      console.error("cert download failed", e);
                      toast({ title: "Download failed", description: e?.message || "Please try again.", variant: "destructive" });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> Download Certificate
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}