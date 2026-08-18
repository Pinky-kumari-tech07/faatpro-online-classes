import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  Image as ImageIcon,
  Square,
  Circle as CircleIcon,
  Triangle,
  Minus,
  QrCode,
  PenTool,
  Droplet,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy as CopyIcon,
  ArrowUp,
  ArrowDown,
  Upload,
  Sparkles,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Layers as LayersIcon,
  ZoomIn,
  ZoomOut,
  Save,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { certificateService } from "@/services/supabase";
import { CanvasRenderer } from "./CanvasRenderer";
import {
  type AnyElement,
  type CanvasDesign,
  type Orientation,
  type TextElement,
  type ImageLikeElement,
  type ShapeElement,
  type LineElement,
  type QrElement,
  A4_LANDSCAPE,
  A4_PORTRAIT,
  DYNAMIC_TOKENS,
  GOOGLE_FONTS,
  emptyDesign,
  TOKEN_LABELS,
  PREVIEW_DATA,
  friendlyLayerName,
} from "./types";

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface Props {
  workspaceId: string;
  initialDesign?: CanvasDesign | null;
  initialName?: string;
  initialIsDefault?: boolean;
  templateId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CanvasEditor({
  workspaceId,
  initialDesign,
  initialName,
  initialIsDefault,
  templateId,
  onClose,
  onSaved,
}: Props) {
  const [design, setDesign] = useState<CanvasDesign>(() => initialDesign || emptyDesign("landscape"));
  const [name, setName] = useState(initialName || "Blank Template");
  const [isDefault, setIsDefault] = useState(!!initialIsDefault);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [saving, setSaving] = useState(false);

  const selected = design.elements.find((e) => e.id === selectedId) || null;

  // Load google fonts on demand
  useEffect(() => {
    const families = Array.from(
      new Set(
        design.elements
          .filter((e): e is TextElement => e.type === "text")
          .map((e) => e.fontFamily)
          .filter(Boolean),
      ),
    );
    if (!families.length) return;
    const id = "canvas-editor-fonts";
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    const href = `https://fonts.googleapis.com/css2?${families
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800`)
      .join("&")}&display=swap`;
    if (existing) existing.href = href;
    else {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [design.elements]);

  // ---------- element ops ----------
  const update = useCallback((id: string, patch: Partial<AnyElement>) => {
    setDesign((d) => ({
      ...d,
      elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as AnyElement) : e)),
    }));
  }, []);

  const add = useCallback((el: AnyElement) => {
    setDesign((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const remove = useCallback((id: string) => {
    setDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const duplicate = useCallback((id: string) => {
    setDesign((d) => {
      const src = d.elements.find((e) => e.id === id);
      if (!src) return d;
      const copy = { ...src, id: uid(), x: src.x + 20, y: src.y + 20 } as AnyElement;
      setSelectedId(copy.id);
      return { ...d, elements: [...d.elements, copy] };
    });
  }, []);

  const reorder = useCallback((id: string, dir: "up" | "down" | "top" | "bottom") => {
    setDesign((d) => {
      const idx = d.elements.findIndex((e) => e.id === id);
      if (idx < 0) return d;
      const arr = [...d.elements];
      const [el] = arr.splice(idx, 1);
      if (dir === "up") arr.splice(Math.min(arr.length, idx + 1), 0, el);
      else if (dir === "down") arr.splice(Math.max(0, idx - 1), 0, el);
      else if (dir === "top") arr.push(el);
      else arr.unshift(el);
      return { ...d, elements: arr };
    });
  }, []);

  // ---------- add factories ----------
  const addText = () =>
    add({
      id: uid(),
      type: "text",
      name: "Text",
      x: design.width / 2 - 150,
      y: design.height / 2 - 30,
      w: 300,
      h: 60,
      rotation: 0,
      opacity: 1,
      text: "Double-click to edit",
      fontFamily: "Playfair Display",
      fontSize: 36,
      fontWeight: 600,
      color: "#1a1a1a",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.2,
    } as TextElement);

  const addPlaceholder = (token: string) =>
    add({
      id: uid(),
      type: "text",
      name: token,
      x: design.width / 2 - 200,
      y: design.height / 2 - 30,
      w: 400,
      h: 60,
      rotation: 0,
      opacity: 1,
      text: `{{${token}}}`,
      fontFamily: "Playfair Display",
      fontSize: 32,
      fontWeight: 600,
      color: "#1a1a1a",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.2,
    } as TextElement);

  const uploadAndAdd = async (file: File, kind: "image" | "logo" | "watermark" | "signature") => {
    try {
      const url = await certificateService.uploadTemplateAsset(workspaceId, file, "logo");
      add({
        id: uid(),
        type: kind,
        name: kind,
        x: design.width / 2 - 80,
        y: design.height / 2 - 80,
        w: 160,
        h: 160,
        rotation: 0,
        opacity: kind === "watermark" ? 0.15 : 1,
        src: url,
        ...(kind === "signature" ? { caption: "Signatory Name", subCaption: "Designation", showLine: true } : {}),
      } as ImageLikeElement);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  const addShape = (shape: "rectangle" | "circle" | "triangle") =>
    add({
      id: uid(),
      type: "shape",
      name: shape,
      shape,
      x: design.width / 2 - 80,
      y: design.height / 2 - 80,
      w: 160,
      h: 160,
      rotation: 0,
      opacity: 1,
      fill: "transparent",
      stroke: "#6366f1",
      strokeWidth: 4,
      radius: shape === "rectangle" ? 8 : 0,
    } as ShapeElement);

  const addLine = () =>
    add({
      id: uid(),
      type: "line",
      name: "Line",
      x: design.width / 2 - 120,
      y: design.height / 2,
      w: 240,
      h: 8,
      rotation: 0,
      opacity: 1,
      stroke: "#1a1a1a",
      strokeWidth: 2,
    } as LineElement);

  const addQr = () =>
    add({
      id: uid(),
      type: "qr",
      name: "QR Code",
      x: design.width - 200,
      y: design.height - 200,
      w: 140,
      h: 140,
      rotation: 0,
      opacity: 1,
      fg: "#000000",
      bg: "#ffffff",
    } as QrElement);

  // ---------- save ----------
  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        design_json: design,
        orientation: design.orientation,
        is_default: isDefault,
        // also stash a few legacy fields for compatibility
        title: name.trim(),
        accent_color: "#6366f1",
      };
      if (templateId) {
        await certificateService.updateTemplate(templateId, payload);
      } else {
        await certificateService.createTemplate({ ...payload, workspace_id: workspaceId });
      }
      toast({ title: templateId ? "Template updated" : "Template created" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ---------- export PNG/PDF ----------
  const stageRef = useRef<HTMLDivElement>(null);
  const exportImage = async (format: "png" | "jpg" | "pdf") => {
    // Render at full size off-screen
    const { default: html2canvas } = await import("html2canvas");
    const off = document.createElement("div");
    off.style.position = "fixed";
    off.style.left = "-20000px";
    off.style.top = "0";
    off.style.background = "#fff";
    document.body.appendChild(off);
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(off);
    await new Promise<void>((res) => {
      root.render(<CanvasRenderer design={design} scale={1} />);
      requestAnimationFrame(() => requestAnimationFrame(() => res()));
    });
    // wait for fonts/images
    await (document as any).fonts?.ready?.catch(() => {});
    const imgs = Array.from(off.querySelectorAll("img"));
    await Promise.all(
      imgs.map((i) =>
        i.complete
          ? Promise.resolve()
          : new Promise((r) => {
              i.onload = r;
              i.onerror = r;
            }),
      ),
    );
    const node = off.firstElementChild as HTMLElement;
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: design.width,
      height: design.height,
      windowWidth: design.width,
      windowHeight: design.height,
    });
    if (format === "pdf") {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: design.orientation,
        unit: "px",
        format: [design.width, design.height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, design.width, design.height, undefined, "FAST");
      pdf.save(`${name || "certificate"}.pdf`);
    } else {
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.95);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${name || "certificate"}.${format}`;
      a.click();
    }
    root.unmount();
    off.remove();
  };

  // ---------- orientation ----------
  const setOrientation = (o: Orientation) => {
    const d = o === "portrait" ? A4_PORTRAIT : A4_LANDSCAPE;
    setDesign((s) => ({ ...s, orientation: o, width: d.width, height: d.height }));
  };

  // ---------- file upload helper ----------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<"image" | "logo" | "watermark" | "signature" | "background">("image");
  const triggerUpload = (kind: typeof pendingKind) => {
    setPendingKind(kind);
    fileInputRef.current?.click();
  };
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (pendingKind === "background") {
      try {
        const url = await certificateService.uploadTemplateAsset(workspaceId, f, "background");
        setDesign((d) => ({ ...d, background: { ...d.background, image: url } }));
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
    } else {
      uploadAndAdd(f, pendingKind);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Topbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-56"
            placeholder="Template name"
          />
          <Select value={design.orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)] ?? z)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={String(zoom)} onValueChange={(v) => setZoom(Number(v))}>
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOOMS.map((z) => (
                  <SelectItem key={z} value={String(z)}>
                    {Math.round(z * 100)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)] ?? z)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs ml-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <span>Default</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportImage("png")}>
            <Download className="h-4 w-4 mr-1" /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportImage("jpg")}>
            <Download className="h-4 w-4 mr-1" /> JPG
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportImage("pdf")}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[220px_1fr_320px] min-h-0">
        {/* Toolbox */}
        <ScrollArea className="border-r bg-muted/20">
          <div className="p-3 space-y-3">
            <Section title="Add element">
              <ToolButton icon={Type} label="Text" onClick={addText} />
              <ToolButton icon={ImageIcon} label="Image" onClick={() => triggerUpload("image")} />
              <ToolButton icon={ImageIcon} label="Logo" onClick={() => triggerUpload("logo")} />
              <ToolButton icon={Droplet} label="Watermark" onClick={() => triggerUpload("watermark")} />
              <ToolButton icon={PenTool} label="Signature" onClick={() => triggerUpload("signature")} />
              <ToolButton icon={QrCode} label="QR Code" onClick={addQr} />
              <ToolButton icon={Square} label="Rectangle" onClick={() => addShape("rectangle")} />
              <ToolButton icon={CircleIcon} label="Circle" onClick={() => addShape("circle")} />
              <ToolButton icon={Triangle} label="Triangle" onClick={() => addShape("triangle")} />
              <ToolButton icon={Minus} label="Line" onClick={addLine} />
            </Section>

            <Section title="Placeholders">
              <div className="grid grid-cols-1 gap-1">
                {DYNAMIC_TOKENS.map((t) => (
                  <button
                    key={t}
                    onClick={() => addPlaceholder(t)}
                    className="text-[11px] text-left px-2 py-1 rounded border bg-background hover:bg-primary hover:text-primary-foreground transition-colors flex flex-col"
                    title={`{{${t}}}`}
                  >
                    <span className="font-medium">{TOKEN_LABELS[t] ?? t}</span>
                    <span className="text-[10px] opacity-70 truncate">{String(PREVIEW_DATA[t] ?? "")}</span>
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </ScrollArea>

        {/* Canvas */}
        <div className="bg-[hsl(var(--muted))] overflow-auto">
          <div className="min-h-full min-w-full grid place-items-center p-8">
            <Stage
              design={design}
              zoom={zoom}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              update={update}
              stageRef={stageRef}
            />
          </div>
        </div>

        {/* Right inspector */}
        <ScrollArea className="border-l bg-background">
          <Tabs defaultValue="inspect">
            <TabsList className="m-3">
              <TabsTrigger value="inspect">Inspect</TabsTrigger>
              <TabsTrigger value="background">Background</TabsTrigger>
              <TabsTrigger value="layers">
                <LayersIcon className="h-3.5 w-3.5 mr-1" /> Layers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inspect" className="px-4 pb-6">
              {selected ? (
                <Inspector
                  el={selected}
                  update={(patch) => update(selected.id, patch)}
                  remove={() => remove(selected.id)}
                  duplicate={() => duplicate(selected.id)}
                  reorder={(dir) => reorder(selected.id, dir)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Select an element to edit its properties.</p>
              )}
            </TabsContent>

            <TabsContent value="background" className="px-4 pb-6 space-y-4">
              <BackgroundPanel
                design={design}
                setDesign={setDesign}
                triggerUpload={() => triggerUpload("background")}
              />
            </TabsContent>

            <TabsContent value="layers" className="px-4 pb-6">
              <LayersPanel
                design={design}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                update={update}
                remove={remove}
                reorder={reorder}
              />
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </div>
    </div>
  );
}

/* =========================================================== */
/* STAGE                                                       */
/* =========================================================== */

function Stage({
  design,
  zoom,
  selectedId,
  setSelectedId,
  update,
  stageRef,
}: {
  design: CanvasDesign;
  zoom: number;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  update: (id: string, patch: Partial<AnyElement>) => void;
  stageRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="relative" style={{ width: design.width * zoom, height: design.height * zoom }}>
      <CanvasRenderer design={design} scale={zoom} innerRef={stageRef} preview />
      {/* overlay for interaction */}
      <div
        className="absolute inset-0"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSelectedId(null);
        }}
        style={{ pointerEvents: "auto" }}
      >
        {design.elements.map((el) => (
          <ElementOverlay
            key={el.id}
            el={el}
            zoom={zoom}
            selected={selectedId === el.id}
            onSelect={() => setSelectedId(el.id)}
            onChange={(patch) => update(el.id, patch)}
            stageW={design.width}
            stageH={design.height}
          />
        ))}
      </div>
    </div>
  );
}

function ElementOverlay({
  el,
  zoom,
  selected,
  onSelect,
  onChange,
  stageW,
  stageH,
}: {
  el: AnyElement;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (p: Partial<AnyElement>) => void;
  stageW: number;
  stageH: number;
}) {
  const dragData = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    if (el.locked || el.hidden) return;
    dragData.current = { x: e.clientX, y: e.clientY, ox: el.x, oy: el.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragData.current) return;
      const dx = (ev.clientX - dragData.current.x) / zoom;
      const dy = (ev.clientY - dragData.current.y) / zoom;
      onChange({ x: dragData.current.ox + dx, y: dragData.current.oy + dy });
    };
    const onUp = () => {
      dragData.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (corner: "nw" | "ne" | "sw" | "se") => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - start.x) / zoom;
      const dy = (ev.clientY - start.y) / zoom;
      let { ox, oy, ow, oh } = start;
      if (corner.includes("e")) ow = Math.max(20, start.ow + dx);
      if (corner.includes("s")) oh = Math.max(20, start.oh + dy);
      if (corner.includes("w")) {
        ow = Math.max(20, start.ow - dx);
        ox = start.ox + (start.ow - ow);
      }
      if (corner.includes("n")) {
        oh = Math.max(20, start.oh - dy);
        oy = start.oy + (start.oh - oh);
      }
      onChange({ x: ox, y: oy, w: ow, h: oh });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const onMove = (ev: MouseEvent) => {
      const angle = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      onChange({ rotation: Math.round(angle) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (el.hidden) return null;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.w * zoom,
        height: el.h * zoom,
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: "center",
        cursor: el.locked ? "not-allowed" : "move",
        outline: selected ? "2px solid hsl(var(--primary))" : "1px dashed transparent",
        outlineOffset: 0,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.outline = "1px dashed hsl(var(--primary) / .5)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.outline = "1px dashed transparent";
      }}
    >
      {selected && !el.locked && (
        <>
          {(["nw", "ne", "sw", "se"] as const).map((c) => (
            <div
              key={c}
              onMouseDown={startResize(c)}
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                background: "hsl(var(--primary))",
                border: "2px solid white",
                borderRadius: 2,
                ...(c === "nw" && { left: -6, top: -6, cursor: "nwse-resize" }),
                ...(c === "ne" && { right: -6, top: -6, cursor: "nesw-resize" }),
                ...(c === "sw" && { left: -6, bottom: -6, cursor: "nesw-resize" }),
                ...(c === "se" && { right: -6, bottom: -6, cursor: "nwse-resize" }),
              }}
            />
          ))}
          <div
            onMouseDown={startRotate}
            style={{
              position: "absolute",
              top: -28,
              left: "50%",
              transform: "translateX(-50%)",
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "hsl(var(--primary))",
              border: "2px solid white",
              display: "grid",
              placeItems: "center",
              cursor: "grab",
            }}
          >
            <RotateCw className="h-3 w-3 text-white" />
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================== */
/* INSPECTOR                                                   */
/* =========================================================== */

function Inspector({
  el,
  update,
  remove,
  duplicate,
  reorder,
}: {
  el: AnyElement;
  update: (p: Partial<AnyElement>) => void;
  remove: () => void;
  duplicate: () => void;
  reorder: (d: "up" | "down" | "top" | "bottom") => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold capitalize">{el.type} element</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => reorder("up")} title="Bring forward">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => reorder("down")} title="Send backward">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={duplicate} title="Duplicate">
            <CopyIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={remove} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Row label="Position">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={el.x} onChange={(v) => update({ x: v } as any)} />
          <NumberInput label="Y" value={el.y} onChange={(v) => update({ y: v } as any)} />
          <NumberInput label="W" value={el.w} onChange={(v) => update({ w: v } as any)} />
          <NumberInput label="H" value={el.h} onChange={(v) => update({ h: v } as any)} />
        </div>
      </Row>

      <Row label={`Rotation: ${el.rotation}°`}>
        <Slider
          value={[el.rotation]}
          min={-180}
          max={180}
          step={1}
          onValueChange={(v) => update({ rotation: v[0] } as any)}
        />
      </Row>

      <Row label={`Opacity: ${Math.round(el.opacity * 100)}%`}>
        <Slider
          value={[el.opacity * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => update({ opacity: v[0] / 100 } as any)}
        />
      </Row>

      <div className="flex items-center gap-2 text-xs">
        <Button variant="outline" size="sm" onClick={() => update({ locked: !el.locked } as any)}>
          {el.locked ? <Lock className="h-3.5 w-3.5 mr-1" /> : <Unlock className="h-3.5 w-3.5 mr-1" />}
          {el.locked ? "Locked" : "Unlocked"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => update({ hidden: !el.hidden } as any)}>
          {el.hidden ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
          {el.hidden ? "Hidden" : "Visible"}
        </Button>
        {(el.type === "image" || el.type === "logo" || el.type === "watermark" || el.type === "signature") && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => update({ flipX: !el.flipX } as any)}
              title="Flip H"
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => update({ flipY: !el.flipY } as any)}
              title="Flip V"
            >
              <FlipVertical className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {el.type === "text" && <TextProps el={el} update={update} />}
      {el.type === "shape" && <ShapeProps el={el} update={update} />}
      {el.type === "line" && <LineProps el={el} update={update} />}
      {el.type === "qr" && <QrProps el={el} update={update} />}
      {el.type === "signature" && <SignatureProps el={el} update={update} />}
    </div>
  );
}

function TextProps({ el, update }: { el: TextElement; update: (p: Partial<AnyElement>) => void }) {
  return (
    <>
      <Row label="Text">
        <Textarea rows={3} value={el.text} onChange={(e) => update({ text: e.target.value } as any)} />
        <p className="text-[10px] text-muted-foreground mt-1">
          Use {`{{token}}`} placeholders, e.g. {`{{student_name}}`}
        </p>
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Font">
          <Select value={el.fontFamily} onValueChange={(v) => update({ fontFamily: v } as any)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Weight">
          <Select value={String(el.fontWeight)} onValueChange={(v) => update({ fontWeight: Number(v) } as any)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[300, 400, 500, 600, 700, 800].map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </div>
      <Row label={`Font size: ${el.fontSize}px`}>
        <Slider
          value={[el.fontSize]}
          min={8}
          max={200}
          step={1}
          onValueChange={(v) => update({ fontSize: v[0] } as any)}
        />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Color">
          <ColorPicker value={el.color} onChange={(v) => update({ color: v } as any)} />
        </Row>
        <Row label="Align">
          <Select value={el.align} onValueChange={(v) => update({ align: v as any } as any)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </div>
      <Row label={`Letter spacing: ${el.letterSpacing}`}>
        <Slider
          value={[el.letterSpacing]}
          min={-5}
          max={20}
          step={0.5}
          onValueChange={(v) => update({ letterSpacing: v[0] } as any)}
        />
      </Row>
      <Row label={`Line height: ${el.lineHeight.toFixed(2)}`}>
        <Slider
          value={[el.lineHeight * 100]}
          min={80}
          max={250}
          step={5}
          onValueChange={(v) => update({ lineHeight: v[0] / 100 } as any)}
        />
      </Row>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <ToggleChip
          label="Uppercase"
          active={!!el.uppercase}
          onClick={() => update({ uppercase: !el.uppercase } as any)}
        />
        <ToggleChip label="Italic" active={!!el.italic} onClick={() => update({ italic: !el.italic } as any)} />
        <ToggleChip label="Shadow" active={!!el.shadow} onClick={() => update({ shadow: !el.shadow } as any)} />
        <ToggleChip label="Outline" active={!!el.outline} onClick={() => update({ outline: !el.outline } as any)} />
      </div>
    </>
  );
}

function ShapeProps({ el, update }: { el: ShapeElement; update: (p: Partial<AnyElement>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Fill">
          <ColorPicker value={el.fill} onChange={(v) => update({ fill: v } as any)} allowTransparent />
        </Row>
        <Row label="Stroke">
          <ColorPicker value={el.stroke} onChange={(v) => update({ stroke: v } as any)} />
        </Row>
      </div>
      <Row label={`Border: ${el.strokeWidth}px`}>
        <Slider
          value={[el.strokeWidth]}
          min={0}
          max={30}
          step={1}
          onValueChange={(v) => update({ strokeWidth: v[0] } as any)}
        />
      </Row>
      {el.shape === "rectangle" && (
        <Row label={`Radius: ${el.radius ?? 0}`}>
          <Slider
            value={[el.radius ?? 0]}
            min={0}
            max={200}
            step={1}
            onValueChange={(v) => update({ radius: v[0] } as any)}
          />
        </Row>
      )}
    </>
  );
}

function LineProps({ el, update }: { el: LineElement; update: (p: Partial<AnyElement>) => void }) {
  return (
    <>
      <Row label="Stroke">
        <ColorPicker value={el.stroke} onChange={(v) => update({ stroke: v } as any)} />
      </Row>
      <Row label={`Thickness: ${el.strokeWidth}px`}>
        <Slider
          value={[el.strokeWidth]}
          min={1}
          max={30}
          step={1}
          onValueChange={(v) => update({ strokeWidth: v[0] } as any)}
        />
      </Row>
    </>
  );
}

function QrProps({ el, update }: { el: QrElement; update: (p: Partial<AnyElement>) => void }) {
  return (
    <>
      <Row label="Override value (defaults to verification URL)">
        <Input
          value={el.value || ""}
          onChange={(e) => update({ value: e.target.value } as any)}
          placeholder="https://..."
        />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Foreground">
          <ColorPicker value={el.fg} onChange={(v) => update({ fg: v } as any)} />
        </Row>
        <Row label="Background">
          <ColorPicker value={el.bg} onChange={(v) => update({ bg: v } as any)} />
        </Row>
      </div>
    </>
  );
}

function SignatureProps({ el, update }: { el: ImageLikeElement; update: (p: Partial<AnyElement>) => void }) {
  return (
    <>
      <Row label="Name (under signature)">
        <Input value={el.caption || ""} onChange={(e) => update({ caption: e.target.value } as any)} />
      </Row>
      <Row label="Designation">
        <Input value={el.subCaption || ""} onChange={(e) => update({ subCaption: e.target.value } as any)} />
      </Row>
      <div className="flex items-center gap-2 text-xs">
        <Switch checked={!!el.showLine} onCheckedChange={(v) => update({ showLine: v } as any)} />
        <span>Show signature line</span>
      </div>
    </>
  );
}

/* =========================================================== */
/* BACKGROUND PANEL                                            */
/* =========================================================== */

function BackgroundPanel({
  design,
  setDesign,
  triggerUpload,
}: {
  design: CanvasDesign;
  setDesign: React.Dispatch<React.SetStateAction<CanvasDesign>>;
  triggerUpload: () => void;
}) {
  const b = design.background;
  const setB = (patch: Partial<typeof b>) => setDesign((d) => ({ ...d, background: { ...d.background, ...patch } }));

  return (
    <>
      <Row label="Background color">
        <ColorPicker value={b.color || "#ffffff"} onChange={(v) => setB({ color: v })} />
      </Row>

      <Row label="Gradient">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={!!b.gradient}
              onCheckedChange={(v) => setB({ gradient: v ? { from: "#6366f1", to: "#ec4899", angle: 135 } : null })}
            />
            <span className="text-xs">Enable gradient</span>
          </div>
          {b.gradient && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <ColorPicker
                  value={b.gradient.from}
                  onChange={(v) => setB({ gradient: { ...b.gradient!, from: v } })}
                />
                <ColorPicker value={b.gradient.to} onChange={(v) => setB({ gradient: { ...b.gradient!, to: v } })} />
              </div>
              <Slider
                value={[b.gradient.angle]}
                min={0}
                max={360}
                step={1}
                onValueChange={(v) => setB({ gradient: { ...b.gradient!, angle: v[0] } })}
              />
            </>
          )}
        </div>
      </Row>

      <Row label="Image">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={triggerUpload}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {b.image ? "Replace" : "Upload"}
          </Button>
          {b.image && (
            <Button variant="ghost" size="sm" onClick={() => setB({ image: null })}>
              <X className="h-3 w-3" /> Remove
            </Button>
          )}
        </div>
        {b.image && <img src={b.image} alt="" className="mt-2 w-full h-24 object-cover rounded border" />}
      </Row>

      <Row label={`Opacity: ${Math.round(b.opacity * 100)}%`}>
        <Slider
          value={[b.opacity * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setB({ opacity: v[0] / 100 })}
        />
      </Row>
      <Row label={`Brightness: ${b.brightness.toFixed(2)}`}>
        <Slider
          value={[b.brightness * 100]}
          min={0}
          max={200}
          step={1}
          onValueChange={(v) => setB({ brightness: v[0] / 100 })}
        />
      </Row>
      <Row label={`Contrast: ${b.contrast.toFixed(2)}`}>
        <Slider
          value={[b.contrast * 100]}
          min={0}
          max={200}
          step={1}
          onValueChange={(v) => setB({ contrast: v[0] / 100 })}
        />
      </Row>
      <Row label={`Blur: ${b.blur}px`}>
        <Slider value={[b.blur]} min={0} max={30} step={1} onValueChange={(v) => setB({ blur: v[0] })} />
      </Row>
      <Row label={`Scale: ${b.scale.toFixed(2)}`}>
        <Slider
          value={[b.scale * 100]}
          min={50}
          max={200}
          step={1}
          onValueChange={(v) => setB({ scale: v[0] / 100 })}
        />
      </Row>
      <Row label={`Rotation: ${b.rotation}°`}>
        <Slider value={[b.rotation]} min={-180} max={180} step={1} onValueChange={(v) => setB({ rotation: v[0] })} />
      </Row>
    </>
  );
}

/* =========================================================== */
/* LAYERS PANEL                                                */
/* =========================================================== */

function LayersPanel({
  design,
  selectedId,
  setSelectedId,
  update,
  remove,
  reorder,
}: {
  design: CanvasDesign;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  update: (id: string, patch: Partial<AnyElement>) => void;
  remove: (id: string) => void;
  reorder: (id: string, dir: "up" | "down" | "top" | "bottom") => void;
}) {
  return (
    <div className="space-y-1">
      {[...design.elements].reverse().map((el) => (
        <div
          key={el.id}
          className={`flex items-center gap-1 px-2 py-1.5 rounded border text-xs ${selectedId === el.id ? "bg-primary/10 border-primary" : "bg-background border-border"}`}
        >
          <button
            onClick={() => update(el.id, { hidden: !el.hidden } as any)}
            className="text-muted-foreground hover:text-foreground"
          >
            {el.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => update(el.id, { locked: !el.locked } as any)}
            className="text-muted-foreground hover:text-foreground"
          >
            {el.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setSelectedId(el.id)} className="flex-1 text-left truncate">
            <input
              value={friendlyLayerName(el as any)}
              onChange={(e) => update(el.id, { name: e.target.value } as any)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent w-full outline-none"
            />
          </button>
          <button onClick={() => reorder(el.id, "up")} className="text-muted-foreground hover:text-foreground">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => reorder(el.id, "down")} className="text-muted-foreground hover:text-foreground">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => remove(el.id)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {design.elements.length === 0 && (
        <p className="text-xs text-muted-foreground">No layers yet. Add an element from the toolbox.</p>
      )}
    </div>
  );
}

/* =========================================================== */
/* Small UI helpers                                            */
/* =========================================================== */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">{title}</h4>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-2 rounded-md border bg-background hover:bg-primary hover:text-primary-foreground transition-colors text-[11px]"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground w-3">{label}</span>
      <Input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 text-xs"
      />
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
  allowTransparent,
}: {
  value: string;
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={value === "transparent" ? "#ffffff" : value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 rounded border border-input cursor-pointer"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs font-mono" />
      {allowTransparent && (
        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => onChange("transparent")}>
          None
        </Button>
      )}
    </div>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded border text-xs ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
    >
      {label}
    </button>
  );
}
