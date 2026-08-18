export type Orientation = "portrait" | "landscape";

export type ElementType =
  | "text"
  | "image"
  | "logo"
  | "watermark"
  | "signature"
  | "shape"
  | "qr"
  | "line";

export type ShapeKind = "rectangle" | "circle" | "triangle";

export interface BaseElement {
  id: string;
  type: ElementType;
  name?: string;
  x: number; // px on stage
  y: number;
  w: number;
  h: number;
  rotation: number; // deg
  opacity: number; // 0..1
  locked?: boolean;
  hidden?: boolean;
  flipX?: boolean;
  flipY?: boolean;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  uppercase?: boolean;
  italic?: boolean;
  shadow?: boolean;
  outline?: boolean;
}

export interface ImageLikeElement extends BaseElement {
  type: "image" | "logo" | "watermark" | "signature";
  src: string;
  caption?: string; // for signature: name/designation rendered below
  subCaption?: string;
  showLine?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius?: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  stroke: string;
  strokeWidth: number;
}

export interface QrElement extends BaseElement {
  type: "qr";
  fg: string;
  bg: string;
  value?: string; // optional override; defaults to verification URL
}

export type AnyElement =
  | TextElement
  | ImageLikeElement
  | ShapeElement
  | LineElement
  | QrElement;

export interface CanvasBackground {
  color?: string;
  gradient?: { from: string; to: string; angle: number } | null;
  image?: string | null;
  opacity: number;
  brightness: number; // 0..2
  contrast: number; // 0..2
  blur: number; // px
  scale: number; // 0.5..2
  rotation: number; // deg
}

export interface CanvasDesign {
  version: 1;
  orientation: Orientation;
  width: number; // px logical (A4 @ 96dpi)
  height: number;
  background: CanvasBackground;
  elements: AnyElement[];
}

export const A4_PORTRAIT = { width: 794, height: 1123 };
export const A4_LANDSCAPE = { width: 1123, height: 794 };

export function emptyDesign(orientation: Orientation = "portrait"): CanvasDesign {
  const d = orientation === "portrait" ? A4_PORTRAIT : A4_LANDSCAPE;
  return {
    version: 1,
    orientation,
    width: d.width,
    height: d.height,
    background: {
      color: "#ffffff",
      gradient: null,
      image: null,
      opacity: 1,
      brightness: 1,
      contrast: 1,
      blur: 0,
      scale: 1,
      rotation: 0,
    },
    elements: [],
  };
}

export const DYNAMIC_TOKENS = [
  "student_name",
  "course_title",
  "completion_percentage",
  "completion_date",
  "certificate_number",
  "instructor_name",
  "grade",
  "batch",
  "duration",
  "issue_date",
  "academy_name",
  "verification_code",
  "marks",
  "percentage",
  "academic_year",
  "start_date",
  "end_date",
  "course_subjects",
  "organization_name",
  "registration_number",
  "established_year",
] as const;

/** Human-readable labels for tokens — used in the Layers panel and tool list. */
export const TOKEN_LABELS: Record<string, string> = {
  student_name: "Student Name",
  course_title: "Course Title",
  completion_percentage: "Completion %",
  completion_date: "Completion Date",
  certificate_number: "Certificate No.",
  instructor_name: "Instructor Name",
  grade: "Grade",
  batch: "Batch",
  duration: "Duration",
  issue_date: "Issue Date",
  academy_name: "Academy Name",
  verification_code: "Verification Code",
  marks: "Marks",
  percentage: "Percentage",
  academic_year: "Academic Year",
  start_date: "Start Date",
  end_date: "End Date",
  course_subjects: "Course Subjects",
  organization_name: "Organization Name",
  registration_number: "Registration No.",
  established_year: "Established Year",
};

/** Sample preview values shown inside the editor & template thumbnails. */
export const PREVIEW_DATA: Record<string, string | number> = {
  student_name: "John Doe",
  course_title: "Advanced React Development",
  completion_date: "28 June 2026",
  certificate_number: "FAAT-2026-0001",
  instructor_name: "Prashant Kumar",
  grade: "A+",
  completion_percentage: "100%",
  batch: "Batch 2026",
  duration: "40 Hours",
  issue_date: "28 June 2026",
  academy_name: "FAATPRO Academy",
  verification_code: "VRF-FAAT-0001",
  marks: "98",
  percentage: "98%",
  academic_year: "2025-2026",
  start_date: "01 January 2026",
  end_date: "28 June 2026",
  course_subjects: "React, TypeScript, Node.js",
  organization_name: "FAATPRO",
  registration_number: "REG-2026-0001",
  established_year: "2020",
};

/** Friendly name for a layer/element, falling back to its raw name/type. */
export function friendlyLayerName(el: { name?: string; type: string; text?: string }): string {
  const tryToken = (s?: string) => {
    if (!s) return null;
    const m = s.match(/^\s*\{\{\s*([\w_]+)\s*\}\}\s*$/);
    return m ? TOKEN_LABELS[m[1]] ?? m[1] : null;
  };
  if (el.name && TOKEN_LABELS[el.name]) return TOKEN_LABELS[el.name];
  return tryToken(el.name) || tryToken((el as any).text) || el.name || el.type;
}

export function substitute(text: string, data: Record<string, any>): string {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, k) => {
    const v = data?.[k];
    if (v == null) return "";
    if (k === "completion_percentage" && typeof v === "number") return `${Math.round(v)}%`;
    if (k === "completion_date" || k === "issue_date") {
      const d = v instanceof Date ? v : new Date(v);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }
    return String(v);
  });
}

export const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Merriweather",
  "Cormorant Garamond",
  "Libre Baskerville",
  "Cinzel",
  "Great Vibes",
  "Dancing Script",
  "Pinyon Script",
  "Allura",
  "Bebas Neue",
  "Oswald",
  "Raleway",
] as const;