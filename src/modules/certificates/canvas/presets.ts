import type {
  CanvasDesign,
  TextElement,
  ShapeElement,
  LineElement,
  QrElement,
  AnyElement,
} from "./types";
import { A4_PORTRAIT, A4_LANDSCAPE } from "./types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const GOLD = "#b8893a";
const GOLD_DARK = "#8a6420";
const INK = "#1f1a12";
const CREAM = "#f6ecd2";

function text(partial: Partial<TextElement> & Pick<TextElement, "text" | "x" | "y" | "w" | "h">): TextElement {
  return {
    id: uid(),
    type: "text",
    rotation: 0,
    opacity: 1,
    fontFamily: "Playfair Display",
    fontSize: 18,
    fontWeight: 500,
    color: INK,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.25,
    ...partial,
  } as TextElement;
}

function rect(x: number, y: number, w: number, h: number, stroke: string, strokeWidth: number, radius = 0): ShapeElement {
  return {
    id: uid(),
    type: "shape",
    shape: "rectangle",
    x, y, w, h,
    rotation: 0,
    opacity: 1,
    fill: "transparent",
    stroke,
    strokeWidth,
    radius,
  } as ShapeElement;
}

function line(x: number, y: number, w: number, stroke = GOLD_DARK, strokeWidth = 1): LineElement {
  return {
    id: uid(),
    type: "line",
    x, y, w, h: strokeWidth,
    rotation: 0,
    opacity: 1,
    stroke,
    strokeWidth,
  } as LineElement;
}

/**
 * "Classic Gold Parchment" preset — recreates a traditional institute certificate
 * with double gold border, cream parchment background, header meta, large institute
 * name, award block with grade & subjects, dual signature lines, and a QR.
 */
export function goldParchmentPreset(): CanvasDesign {
  const { width: W, height: H } = A4_PORTRAIT;
  const elements: AnyElement[] = [];

  // ---- Double gold border ----
  elements.push(rect(20, 20, W - 40, H - 40, GOLD, 6, 4));      // outer
  elements.push(rect(34, 34, W - 68, H - 68, GOLD_DARK, 1.5, 2)); // inner hairline

  // Decorative corner squares (diamond accents)
  const corner = (cx: number, cy: number): ShapeElement => ({
    id: uid(),
    type: "shape",
    shape: "rectangle",
    x: cx - 6, y: cy - 6, w: 12, h: 12,
    rotation: 45,
    opacity: 1,
    fill: GOLD,
    stroke: GOLD_DARK,
    strokeWidth: 1,
    radius: 1,
  } as ShapeElement);
  elements.push(corner(34, 34));
  elements.push(corner(W - 34, 34));
  elements.push(corner(34, H - 34));
  elements.push(corner(W - 34, H - 34));

  // ---- Header meta row ----
  elements.push(text({
    text: "ESTD : {{established_year}}",
    x: 60, y: 56, w: 220, h: 20,
    align: "left", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: GOLD_DARK,
  }));
  elements.push(text({
    text: "CERTIFICATE NO. : {{certificate_number}}",
    x: 60, y: 74, w: 280, h: 20,
    align: "left", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: GOLD_DARK,
  }));
  elements.push(text({
    text: "REGD. NO. : {{registration_number}}",
    x: W - 340, y: 56, w: 280, h: 20,
    align: "right", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: GOLD_DARK,
  }));
  elements.push(text({
    text: "ACADEMIC YEAR : {{academic_year}}",
    x: W - 340, y: 74, w: 280, h: 20,
    align: "right", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: GOLD_DARK,
  }));

  // ---- Center logo placeholder ----
  const logoCx = W / 2;
  elements.push({
    id: uid(),
    type: "shape",
    shape: "circle",
    x: logoCx - 42, y: 100, w: 84, h: 84,
    rotation: 0, opacity: 1,
    fill: "transparent",
    stroke: GOLD_DARK,
    strokeWidth: 2,
  } as ShapeElement);
  elements.push(text({
    text: "LOGO",
    x: logoCx - 42, y: 130, w: 84, h: 24,
    fontFamily: "Cinzel", fontSize: 14, fontWeight: 700, color: GOLD_DARK, letterSpacing: 2,
  }));

  // ---- Institute name & subtitle ----
  elements.push(text({
    text: "{{organization_name}}",
    x: 60, y: 200, w: W - 120, h: 60,
    fontFamily: "Cinzel", fontSize: 38, fontWeight: 800, color: INK, letterSpacing: 3, uppercase: true,
  }));
  elements.push(line(W / 2 - 120, 268, 240, GOLD, 1.5));
  elements.push(text({
    text: "An ISO 9001:2015 Certified Institute  •  Registered by Govt.",
    x: 60, y: 278, w: W - 120, h: 20,
    fontFamily: "Cormorant Garamond", fontSize: 13, fontWeight: 500, color: GOLD_DARK, italic: true,
  }));

  // ---- Award title ----
  elements.push(text({
    text: "Certificate of Completion",
    x: 60, y: 320, w: W - 120, h: 40,
    fontFamily: "Great Vibes", fontSize: 44, fontWeight: 400, color: GOLD_DARK,
  }));

  // ---- "This certificate is awarded to" ----
  elements.push(text({
    text: "This Certificate is proudly awarded to",
    x: 60, y: 388, w: W - 120, h: 24,
    fontFamily: "Cormorant Garamond", fontSize: 16, fontWeight: 500, color: INK, italic: true,
  }));

  // ---- Student name (large, underlined) ----
  elements.push(text({
    text: "{{student_name}}",
    x: 60, y: 418, w: W - 120, h: 60,
    fontFamily: "Playfair Display", fontSize: 44, fontWeight: 700, color: INK,
  }));
  elements.push(line(120, 488, W - 240, GOLD_DARK, 1));

  // ---- Body ----
  elements.push(text({
    text: "for successfully completing the course",
    x: 60, y: 502, w: W - 120, h: 22,
    fontFamily: "Cormorant Garamond", fontSize: 15, fontWeight: 500, color: INK, italic: true,
  }));
  elements.push(text({
    text: "{{course_title}}",
    x: 60, y: 528, w: W - 120, h: 36,
    fontFamily: "Playfair Display", fontSize: 26, fontWeight: 700, color: INK,
  }));
  elements.push(text({
    text: "from {{start_date}} to {{end_date}}",
    x: 60, y: 572, w: W - 120, h: 22,
    fontFamily: "Cormorant Garamond", fontSize: 13, fontWeight: 500, color: GOLD_DARK, italic: true,
  }));

  // ---- Grade box ----
  elements.push(rect(W / 2 - 70, 612, 140, 80, GOLD_DARK, 1.5, 6));
  elements.push(text({
    text: "GRADE",
    x: W / 2 - 70, y: 618, w: 140, h: 18,
    fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, color: GOLD_DARK, letterSpacing: 3,
  }));
  elements.push(text({
    text: "{{grade}}",
    x: W / 2 - 70, y: 636, w: 140, h: 50,
    fontFamily: "Playfair Display", fontSize: 40, fontWeight: 800, color: INK,
  }));

  // ---- Subjects line ----
  elements.push(text({
    text: "Subjects covered",
    x: 60, y: 708, w: W - 120, h: 18,
    fontFamily: "Cinzel", fontSize: 10, fontWeight: 600, color: GOLD_DARK, letterSpacing: 2,
  }));
  elements.push(text({
    text: "{{course_subjects}}",
    x: 80, y: 728, w: W - 160, h: 40,
    fontFamily: "Cormorant Garamond", fontSize: 14, fontWeight: 500, color: INK, italic: true, lineHeight: 1.4,
  }));

  // ---- Percentage / marks row ----
  elements.push(text({
    text: "Marks: {{marks}}    •    Percentage: {{completion_percentage}}",
    x: 60, y: 780, w: W - 120, h: 20,
    fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, color: GOLD_DARK, letterSpacing: 1,
  }));

  // ---- Signatures (left & right) ----
  const sigY = 920;
  elements.push(line(80, sigY, 200, INK, 1));
  elements.push(text({
    text: "Controller of Examination",
    x: 60, y: sigY + 6, w: 240, h: 18,
    align: "left", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 1,
  }));
  elements.push(text({
    text: "Signature & Seal",
    x: 60, y: sigY + 22, w: 240, h: 16,
    align: "left", fontFamily: "Cormorant Garamond", fontSize: 11, color: GOLD_DARK, italic: true,
  }));

  elements.push(line(W - 280, sigY, 200, INK, 1));
  elements.push(text({
    text: "Centre Director",
    x: W - 300, y: sigY + 6, w: 240, h: 18,
    align: "right", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, color: INK, letterSpacing: 1,
  }));
  elements.push(text({
    text: "Signature & Seal",
    x: W - 300, y: sigY + 22, w: 240, h: 16,
    align: "right", fontFamily: "Cormorant Garamond", fontSize: 11, color: GOLD_DARK, italic: true,
  }));

  // ---- ISO / accreditation badges (placeholders rendered as circles) ----
  elements.push({
    id: uid(), type: "shape", shape: "circle",
    x: 80, y: 820, w: 56, h: 56,
    rotation: 0, opacity: 1,
    fill: "transparent", stroke: GOLD_DARK, strokeWidth: 1.5,
  } as ShapeElement);
  elements.push(text({
    text: "ISO\n9001",
    x: 80, y: 830, w: 56, h: 40,
    fontFamily: "Cinzel", fontSize: 10, fontWeight: 700, color: GOLD_DARK, lineHeight: 1.2,
  }));

  // ---- QR code bottom-right ----
  elements.push({
    id: uid(),
    type: "qr",
    name: "QR Code",
    x: W - 150, y: 820,
    w: 70, h: 70,
    rotation: 0, opacity: 1,
    fg: "#000000",
    bg: "#ffffff",
  } as QrElement);
  elements.push(text({
    text: "Scan to verify",
    x: W - 170, y: 894, w: 110, h: 14,
    fontFamily: "Cinzel", fontSize: 9, fontWeight: 600, color: GOLD_DARK, letterSpacing: 1,
  }));

  // ---- Issue date ----
  elements.push(text({
    text: "Issued on {{issue_date}}    Certificate No. {{certificate_number}}",
    x: 60, y: 1040, w: W - 120, h: 18,
    fontFamily: "Cinzel", fontSize: 9, fontWeight: 600, color: GOLD_DARK, letterSpacing: 2,
  }));

  return {
    version: 1,
    orientation: "portrait",
    width: W,
    height: H,
    background: {
      color: CREAM,
      gradient: null,
      image: null,
      opacity: 1,
      brightness: 1,
      contrast: 1,
      blur: 0,
      scale: 1,
      rotation: 0,
    },
    elements,
  };
}

export const CANVAS_PRESETS = [
  { id: "gold-parchment", name: "Classic Gold Parchment", build: goldParchmentPreset },
  { id: "indian-institute", name: "Indian Institute", build: indianInstitutePreset },
  { id: "gold-parchment-landscape", name: "Classic Gold (Landscape)", build: goldParchmentLandscapePreset },
  { id: "indian-institute-landscape", name: "Indian Institute (Landscape)", build: indianInstituteLandscapePreset },
] as const;

// ============================================================
// Indian Institute preset
// ============================================================

const II_BG = "#FDF6EC";
const II_GOLD = "#C9A84C";
const II_NAVY = "#1A1A2E";
const II_MAROON = "#7B2D00";
const II_BODY = "#2C2C2C";

function iiText(
  partial: Partial<TextElement> & Pick<TextElement, "text" | "x" | "y" | "w" | "h">,
): TextElement {
  return {
    id: uid(),
    type: "text",
    rotation: 0,
    opacity: 1,
    fontFamily: "Lora",
    fontSize: 14,
    fontWeight: 400,
    color: II_BODY,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.35,
    ...partial,
  } as TextElement;
}

function iiCornerOrnament(cx: number, cy: number): ShapeElement {
  return {
    id: uid(),
    type: "shape",
    shape: "rectangle",
    x: cx - 8,
    y: cy - 8,
    w: 16,
    h: 16,
    rotation: 45,
    opacity: 1,
    fill: II_GOLD,
    stroke: "#8a6420",
    strokeWidth: 1,
    radius: 1,
  } as ShapeElement;
}

/**
 * Replicates an Indian-institute style portrait certificate with cream
 * background, double gold border, ornate corners, top meta rows, ISO header
 * block, awarded-to script, grade block, grades key, seal & QR footer.
 */
export function indianInstitutePreset(): CanvasDesign {
  const { width: W, height: H } = A4_PORTRAIT;
  const elements: AnyElement[] = [];

  // ---- Double gold border ----
  elements.push(rect(18, 18, W - 36, H - 36, II_GOLD, 5, 3));
  elements.push(rect(30, 30, W - 60, H - 60, II_GOLD, 1.2, 2));

  // Corner ornaments
  elements.push(iiCornerOrnament(30, 30));
  elements.push(iiCornerOrnament(W - 30, 30));
  elements.push(iiCornerOrnament(30, H - 30));
  elements.push(iiCornerOrnament(W - 30, H - 30));

  // ---- Top meta (left) ----
  elements.push(
    iiText({
      text: "ESTD : 2005",
      x: 50, y: 46, w: 240, h: 16,
      align: "left", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
    }),
  );
  elements.push(
    iiText({
      text: "CERTIFICATE NO. {{certificate_number}}",
      x: 50, y: 62, w: 280, h: 16,
      align: "left", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
    }),
  );

  // ---- Top meta (right) ----
  elements.push(
    iiText({
      text: "Regd. Under Govt. of Odisha",
      x: W - 320, y: 46, w: 270, h: 16,
      align: "right", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
    }),
  );
  elements.push(
    iiText({
      text: "REGD. NO.: 110391902210",
      x: W - 320, y: 62, w: 270, h: 16,
      align: "right", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
    }),
  );

  // ---- Center top emblem (circle placeholder for institute seal) ----
  const seal1X = W / 2 - 38;
  elements.push({
    id: uid(),
    type: "shape",
    shape: "circle",
    x: seal1X, y: 90, w: 76, h: 76,
    rotation: 0, opacity: 1,
    fill: "transparent",
    stroke: II_GOLD,
    strokeWidth: 2,
  } as ShapeElement);
  elements.push({
    id: uid(),
    type: "shape",
    shape: "circle",
    x: seal1X + 8, y: 98, w: 60, h: 60,
    rotation: 0, opacity: 1,
    fill: "transparent",
    stroke: II_GOLD,
    strokeWidth: 1,
  } as ShapeElement);
  elements.push(
    iiText({
      text: "SEAL",
      x: seal1X, y: 118, w: 76, h: 22,
      fontFamily: "Cinzel", fontSize: 11, fontWeight: 700, color: II_GOLD, letterSpacing: 2,
    }),
  );

  // ---- Subtle background watermark ----
  elements.push({
    id: uid(),
    type: "shape",
    shape: "circle",
    x: W / 2 - 180, y: H / 2 - 180, w: 360, h: 360,
    rotation: 0, opacity: 0.06,
    fill: II_GOLD,
    stroke: II_GOLD,
    strokeWidth: 0,
  } as ShapeElement);

  // ---- Header block ----
  elements.push(
    iiText({
      text: "INDIAN INSTITUTE",
      x: 40, y: 180, w: W - 80, h: 56,
      fontFamily: "Playfair Display", fontSize: 46, fontWeight: 800, color: II_NAVY, letterSpacing: 4, uppercase: true,
    }),
  );
  elements.push(
    iiText({
      text: "A division of Upendra Charitable Trust",
      x: 40, y: 240, w: W - 80, h: 18,
      fontFamily: "Lora", fontSize: 13, fontWeight: 500, italic: true, color: II_BODY,
    }),
  );
  elements.push(
    iiText({
      text: "Registered by Govt. of Odisha",
      x: 40, y: 258, w: W - 80, h: 18,
      fontFamily: "Lora", fontSize: 13, fontWeight: 500, italic: true, color: II_BODY,
    }),
  );
  elements.push(
    iiText({
      text: "The Institute is Certified by ISO 9005 : 2015",
      x: 40, y: 280, w: W - 80, h: 18,
      fontFamily: "Georgia", fontSize: 12, fontWeight: 700, color: II_NAVY,
    }),
  );
  elements.push(
    iiText({
      text: "Quality Management System for Providing Computer Education",
      x: 40, y: 298, w: W - 80, h: 18,
      fontFamily: "Lora", fontSize: 12, fontWeight: 400, color: II_BODY,
    }),
  );

  // ---- Awarded-to script ----
  elements.push(
    iiText({
      text: "This Certificate is awarded to",
      x: 40, y: 332, w: W - 80, h: 44,
      fontFamily: "Great Vibes", fontSize: 32, fontWeight: 400, color: II_MAROON,
    }),
  );

  // Dotted line under that text (use line with high opacity gold thin)
  elements.push(line(120, 388, W - 240, II_GOLD, 1));

  // ---- Student name ----
  elements.push(
    iiText({
      text: "{{student_name}}",
      x: 40, y: 398, w: W - 80, h: 44,
      fontFamily: "Playfair Display", fontSize: 28, fontWeight: 700, color: II_NAVY,
    }),
  );
  elements.push(line(120, 446, W - 240, II_GOLD, 1));

  // ---- Body paragraph ----
  elements.push(
    iiText({
      text: "For Completing the Course {{course_title}}",
      x: 40, y: 460, w: W - 80, h: 22,
      fontFamily: "Lora", fontSize: 14, fontWeight: 500, color: II_BODY,
    }),
  );
  elements.push(
    iiText({
      text: "(Post Graduate Diploma in Computer Application)",
      x: 40, y: 482, w: W - 80, h: 20,
      fontFamily: "Lora", fontSize: 13, fontWeight: 400, italic: true, color: II_BODY,
    }),
  );
  elements.push(
    iiText({
      text: "from {{academic_year}} academic year and places him/her grade.",
      x: 40, y: 502, w: W - 80, h: 22,
      fontFamily: "Lora", fontSize: 14, fontWeight: 500, color: II_BODY,
    }),
  );

  // ---- Grade ----
  elements.push(
    iiText({
      text: "\u201C{{grade}}\u201D",
      x: 40, y: 534, w: W - 80, h: 56,
      fontFamily: "Playfair Display", fontSize: 44, fontWeight: 800, color: II_NAVY,
    }),
  );
  elements.push(line(280, 596, W - 560, II_GOLD, 1));

  // ---- Subjects ----
  elements.push(
    iiText({
      text: "in subjects of",
      x: 40, y: 608, w: W - 80, h: 20,
      fontFamily: "Lora", fontSize: 13, fontWeight: 500, color: II_BODY,
    }),
  );
  elements.push(
    iiText({
      text: "(Computer Fundamentals, MS Word, Excel, PowerPoint, C, C++, RDBMS, Internet & Tally)",
      x: 60, y: 628, w: W - 120, h: 36,
      fontFamily: "Lora", fontSize: 12, fontWeight: 400, italic: true, color: II_BODY, lineHeight: 1.4,
    }),
  );

  // ---- Footer 4-column row ----
  const footY = 760;
  const colW = (W - 80) / 4;
  for (let i = 0; i < 4; i++) {
    const x = 40 + i * colW;
    if (i === 0 || i === 3) {
      // signature line
      elements.push(line(x + 20, footY + 40, colW - 40, II_BODY, 1));
      elements.push(
        iiText({
          text: i === 0 ? "Controller Examination" : "Centre Director",
          x, y: footY + 48, w: colW, h: 18,
          fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
        }),
      );
    } else if (i === 1) {
      // ISO logo placeholder
      elements.push({
        id: uid(), type: "shape", shape: "circle",
        x: x + colW / 2 - 28, y: footY, w: 56, h: 56,
        rotation: 0, opacity: 1,
        fill: "transparent", stroke: II_GOLD, strokeWidth: 1.5,
      } as ShapeElement);
      elements.push(
        iiText({
          text: "ISO\n9001:2015",
          x, y: footY + 10, w: colW, h: 40,
          fontFamily: "Cinzel", fontSize: 10, fontWeight: 700, color: II_GOLD, lineHeight: 1.2,
        }),
      );
    } else {
      // institute seal
      elements.push({
        id: uid(), type: "shape", shape: "circle",
        x: x + colW / 2 - 28, y: footY - 6, w: 56, h: 56,
        rotation: 0, opacity: 1,
        fill: "transparent", stroke: II_GOLD, strokeWidth: 1.5,
      } as ShapeElement);
      elements.push(
        iiText({
          text: "INDIAN INSTITUTE",
          x, y: footY + 56, w: colW, h: 16,
          fontFamily: "Georgia", fontSize: 9, fontWeight: 700, color: II_NAVY, letterSpacing: 1,
        }),
      );
    }
  }

  // ---- Grades key (bottom-left) ----
  const gKeyX = 50;
  const gKeyY = 870;
  elements.push(
    iiText({
      text: "GRADES",
      x: gKeyX, y: gKeyY, w: 180, h: 16,
      align: "left", fontFamily: "Georgia", fontSize: 11, fontWeight: 800, color: II_NAVY, letterSpacing: 1,
    }),
  );
  const gradeLines = [
    "Above 90%  -  'O'",
    "Between 80% to 89%  -  'A'",
    "Between 70% to 79%  -  'B'",
    "Between 60% to 69%  -  'C'",
    "Between 50% to 59%  -  'D'",
    "Below 49%  -  'F'",
  ];
  gradeLines.forEach((g, i) => {
    elements.push(
      iiText({
        text: g,
        x: gKeyX, y: gKeyY + 18 + i * 14, w: 200, h: 14,
        align: "left", fontFamily: "Lora", fontSize: 10, fontWeight: 500, color: II_BODY,
      }),
    );
  });

  // ---- Wax seal (bottom-center) ----
  const sealCx = W / 2;
  elements.push({
    id: uid(), type: "shape", shape: "circle",
    x: sealCx - 36, y: 890, w: 72, h: 72,
    rotation: 0, opacity: 1,
    fill: "#7B2D00", stroke: II_GOLD, strokeWidth: 2,
  } as ShapeElement);
  elements.push({
    id: uid(), type: "shape", shape: "circle",
    x: sealCx - 26, y: 900, w: 52, h: 52,
    rotation: 0, opacity: 1,
    fill: "transparent", stroke: II_GOLD, strokeWidth: 1,
  } as ShapeElement);
  elements.push(
    iiText({
      text: "OFFICIAL\nSEAL",
      x: sealCx - 36, y: 912, w: 72, h: 36,
      fontFamily: "Cinzel", fontSize: 9, fontWeight: 700, color: "#FDF6EC", letterSpacing: 1.5, lineHeight: 1.2,
    }),
  );

  // ---- QR placeholder (bottom-right) ----
  elements.push({
    id: uid(),
    type: "qr",
    name: "QR Code",
    x: W - 150, y: 890, w: 84, h: 84,
    rotation: 0, opacity: 1,
    fg: "#000000",
    bg: "#ffffff",
  } as QrElement);
  elements.push(
    iiText({
      text: "Scan to verify",
      x: W - 170, y: 976, w: 124, h: 14,
      fontFamily: "Lora", fontSize: 9, fontWeight: 500, color: II_BODY,
    }),
  );

  // ---- Very bottom contact row ----
  elements.push(
    iiText({
      text: "Email: indianinstitute.net@gmail.com",
      x: 50, y: 1070, w: 360, h: 16,
      align: "left", fontFamily: "Georgia", fontSize: 11, fontWeight: 600, color: II_NAVY,
    }),
  );
  elements.push(
    iiText({
      text: "Visit: www.indianinstitute.net",
      x: W - 410, y: 1070, w: 360, h: 16,
      align: "right", fontFamily: "Georgia", fontSize: 11, fontWeight: 600, color: II_NAVY,
    }),
  );

  return {
    version: 1,
    orientation: "portrait",
    width: W,
    height: H,
    background: {
      color: II_BG,
      gradient: null,
      image: null,
      opacity: 1,
      brightness: 1,
      contrast: 1,
      blur: 0,
      scale: 1,
      rotation: 0,
    },
    elements,
  };
}
// ============================================================
// LANDSCAPE PRESETS
// ============================================================

/**
 * Classic Gold preset — landscape (A4 1123x794).
 * Widescreen layout: institute name top, awarded-to script, large student name,
 * course, grade chip, dual signature lines, QR bottom-right.
 */
export function goldParchmentLandscapePreset(): CanvasDesign {
  const { width: W, height: H } = A4_LANDSCAPE;
  const elements: AnyElement[] = [];

  // Borders
  elements.push(rect(20, 20, W - 40, H - 40, GOLD, 6, 4));
  elements.push(rect(34, 34, W - 68, H - 68, GOLD_DARK, 1.5, 2));

  // Corner diamonds
  const corner = (cx: number, cy: number): ShapeElement => ({
    id: uid(), type: "shape", shape: "rectangle",
    x: cx - 6, y: cy - 6, w: 12, h: 12,
    rotation: 45, opacity: 1,
    fill: GOLD, stroke: GOLD_DARK, strokeWidth: 1, radius: 1,
  } as ShapeElement);
  elements.push(corner(34, 34), corner(W - 34, 34), corner(34, H - 34), corner(W - 34, H - 34));

  // Header meta
  elements.push(text({
    text: "CERTIFICATE NO. : {{certificate_number}}",
    x: 60, y: 56, w: 360, h: 20,
    align: "left", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: GOLD_DARK,
  }));
  elements.push(text({
    text: "ACADEMIC YEAR : {{academic_year}}",
    x: W - 420, y: 56, w: 360, h: 20,
    align: "right", fontFamily: "Cinzel", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: GOLD_DARK,
  }));

  // Logo / seal
  elements.push({
    id: uid(), type: "shape", shape: "circle",
    x: W / 2 - 38, y: 78, w: 76, h: 76,
    rotation: 0, opacity: 1, fill: "transparent",
    stroke: GOLD_DARK, strokeWidth: 2,
  } as ShapeElement);
  elements.push(text({
    text: "LOGO",
    x: W / 2 - 38, y: 106, w: 76, h: 22,
    fontFamily: "Cinzel", fontSize: 13, fontWeight: 700, color: GOLD_DARK, letterSpacing: 2,
  }));

  // Institute name
  elements.push(text({
    text: "{{organization_name}}",
    x: 60, y: 168, w: W - 120, h: 56,
    fontFamily: "Cinzel", fontSize: 40, fontWeight: 800, color: INK, letterSpacing: 4, uppercase: true,
  }));
  elements.push(line(W / 2 - 140, 230, 280, GOLD, 1.5));

  // Title script
  elements.push(text({
    text: "Certificate of Completion",
    x: 60, y: 246, w: W - 120, h: 44,
    fontFamily: "Great Vibes", fontSize: 48, fontWeight: 400, color: GOLD_DARK,
  }));

  // Awarded to
  elements.push(text({
    text: "This Certificate is proudly awarded to",
    x: 60, y: 308, w: W - 120, h: 22,
    fontFamily: "Cormorant Garamond", fontSize: 16, fontWeight: 500, italic: true, color: INK,
  }));

  // Student name
  elements.push(text({
    text: "{{student_name}}",
    x: 60, y: 338, w: W - 120, h: 56,
    fontFamily: "Playfair Display", fontSize: 46, fontWeight: 700, color: INK,
  }));
  elements.push(line(160, 402, W - 320, GOLD_DARK, 1));

  // Body
  elements.push(text({
    text: "for successfully completing the course",
    x: 60, y: 416, w: W - 120, h: 22,
    fontFamily: "Cormorant Garamond", fontSize: 15, fontWeight: 500, italic: true, color: INK,
  }));
  elements.push(text({
    text: "{{course_title}}",
    x: 60, y: 440, w: W - 120, h: 36,
    fontFamily: "Playfair Display", fontSize: 26, fontWeight: 700, color: INK,
  }));
  elements.push(text({
    text: "from {{start_date}} to {{end_date}}",
    x: 60, y: 482, w: W - 120, h: 20,
    fontFamily: "Cormorant Garamond", fontSize: 13, fontWeight: 500, italic: true, color: GOLD_DARK,
  }));

  // Grade chip
  elements.push(rect(W / 2 - 70, 514, 140, 70, GOLD_DARK, 1.5, 6));
  elements.push(text({
    text: "GRADE",
    x: W / 2 - 70, y: 520, w: 140, h: 16,
    fontFamily: "Cinzel", fontSize: 10, fontWeight: 700, color: GOLD_DARK, letterSpacing: 3,
  }));
  elements.push(text({
    text: "{{grade}}",
    x: W / 2 - 70, y: 536, w: 140, h: 44,
    fontFamily: "Playfair Display", fontSize: 34, fontWeight: 800, color: INK,
  }));

  // Signatures
  const sigY = 660;
  elements.push(line(100, sigY, 220, INK, 1));
  elements.push(text({
    text: "Controller of Examination",
    x: 80, y: sigY + 6, w: 260, h: 18,
    align: "left", fontFamily: "Cinzel", fontSize: 11, fontWeight: 700, color: INK, letterSpacing: 1,
  }));
  elements.push(line(W - 320, sigY, 220, INK, 1));
  elements.push(text({
    text: "Centre Director",
    x: W - 340, y: sigY + 6, w: 260, h: 18,
    align: "right", fontFamily: "Cinzel", fontSize: 11, fontWeight: 700, color: INK, letterSpacing: 1,
  }));

  // QR
  elements.push({
    id: uid(), type: "qr", name: "QR Code",
    x: W - 150, y: H - 160, w: 70, h: 70,
    rotation: 0, opacity: 1, fg: "#000000", bg: "#ffffff",
  } as QrElement);
  elements.push(text({
    text: "Scan to verify",
    x: W - 170, y: H - 84, w: 110, h: 14,
    fontFamily: "Cinzel", fontSize: 9, fontWeight: 600, color: GOLD_DARK, letterSpacing: 1,
  }));

  // Issue date
  elements.push(text({
    text: "Issued on {{issue_date}}    Certificate No. {{certificate_number}}",
    x: 60, y: H - 56, w: W - 120, h: 18,
    fontFamily: "Cinzel", fontSize: 9, fontWeight: 600, color: GOLD_DARK, letterSpacing: 2,
  }));

  return {
    version: 1,
    orientation: "landscape",
    width: W,
    height: H,
    background: {
      color: CREAM, gradient: null, image: null,
      opacity: 1, brightness: 1, contrast: 1, blur: 0, scale: 1, rotation: 0,
    },
    elements,
  };
}

/**
 * Indian Institute preset — landscape variant.
 */
export function indianInstituteLandscapePreset(): CanvasDesign {
  const { width: W, height: H } = A4_LANDSCAPE;
  const elements: AnyElement[] = [];

  // Borders
  elements.push(rect(18, 18, W - 36, H - 36, II_GOLD, 5, 3));
  elements.push(rect(30, 30, W - 60, H - 60, II_GOLD, 1.2, 2));

  // Corner ornaments
  elements.push(iiCornerOrnament(30, 30));
  elements.push(iiCornerOrnament(W - 30, 30));
  elements.push(iiCornerOrnament(30, H - 30));
  elements.push(iiCornerOrnament(W - 30, H - 30));

  // Top meta
  elements.push(iiText({
    text: "ESTD : 2005",
    x: 50, y: 46, w: 240, h: 16,
    align: "left", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
  }));
  elements.push(iiText({
    text: "CERTIFICATE NO. {{certificate_number}}",
    x: 50, y: 62, w: 320, h: 16,
    align: "left", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
  }));
  elements.push(iiText({
    text: "Regd. Under Govt. of Odisha",
    x: W - 370, y: 46, w: 320, h: 16,
    align: "right", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
  }));
  elements.push(iiText({
    text: "REGD. NO.: 110391902210",
    x: W - 370, y: 62, w: 320, h: 16,
    align: "right", fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
  }));

  // Seal
  elements.push({
    id: uid(), type: "shape", shape: "circle",
    x: W / 2 - 38, y: 76, w: 76, h: 76,
    rotation: 0, opacity: 1, fill: "transparent",
    stroke: II_GOLD, strokeWidth: 2,
  } as ShapeElement);
  elements.push(iiText({
    text: "SEAL",
    x: W / 2 - 38, y: 104, w: 76, h: 22,
    fontFamily: "Cinzel", fontSize: 11, fontWeight: 700, color: II_GOLD, letterSpacing: 2,
  }));

  // Header
  elements.push(iiText({
    text: "INDIAN INSTITUTE",
    x: 40, y: 168, w: W - 80, h: 56,
    fontFamily: "Playfair Display", fontSize: 46, fontWeight: 800, color: II_NAVY, letterSpacing: 4, uppercase: true,
  }));
  elements.push(iiText({
    text: "A division of Upendra Charitable Trust  •  Registered by Govt. of Odisha",
    x: 40, y: 226, w: W - 80, h: 18,
    fontFamily: "Lora", fontSize: 13, fontWeight: 500, italic: true, color: II_BODY,
  }));
  elements.push(iiText({
    text: "The Institute is Certified by ISO 9005 : 2015",
    x: 40, y: 248, w: W - 80, h: 18,
    fontFamily: "Georgia", fontSize: 12, fontWeight: 700, color: II_NAVY,
  }));

  // Awarded to
  elements.push(iiText({
    text: "This Certificate is awarded to",
    x: 40, y: 280, w: W - 80, h: 44,
    fontFamily: "Great Vibes", fontSize: 34, fontWeight: 400, color: II_MAROON,
  }));
  elements.push(line(180, 332, W - 360, II_GOLD, 1));

  // Student name
  elements.push(iiText({
    text: "{{student_name}}",
    x: 40, y: 342, w: W - 80, h: 50,
    fontFamily: "Playfair Display", fontSize: 32, fontWeight: 700, color: II_NAVY,
  }));
  elements.push(line(180, 394, W - 360, II_GOLD, 1));

  // Body
  elements.push(iiText({
    text: "For Completing the Course {{course_title}}",
    x: 40, y: 408, w: W - 80, h: 22,
    fontFamily: "Lora", fontSize: 14, fontWeight: 500, color: II_BODY,
  }));
  elements.push(iiText({
    text: "from {{academic_year}} academic year and places him/her grade.",
    x: 40, y: 430, w: W - 80, h: 22,
    fontFamily: "Lora", fontSize: 14, fontWeight: 500, color: II_BODY,
  }));

  // Grade
  elements.push(iiText({
    text: "\u201C{{grade}}\u201D",
    x: 40, y: 460, w: W - 80, h: 56,
    fontFamily: "Playfair Display", fontSize: 44, fontWeight: 800, color: II_NAVY,
  }));

  // Footer 4-column
  const footY = 600;
  const colW = (W - 80) / 4;
  for (let i = 0; i < 4; i++) {
    const x = 40 + i * colW;
    if (i === 0 || i === 3) {
      elements.push(line(x + 20, footY + 40, colW - 40, II_BODY, 1));
      elements.push(iiText({
        text: i === 0 ? "Controller Examination" : "Centre Director",
        x, y: footY + 48, w: colW, h: 18,
        fontFamily: "Georgia", fontSize: 11, fontWeight: 700, color: II_NAVY, letterSpacing: 0.5,
      }));
    } else if (i === 1) {
      elements.push({
        id: uid(), type: "shape", shape: "circle",
        x: x + colW / 2 - 28, y: footY, w: 56, h: 56,
        rotation: 0, opacity: 1, fill: "transparent",
        stroke: II_GOLD, strokeWidth: 1.5,
      } as ShapeElement);
      elements.push(iiText({
        text: "ISO\n9001:2015",
        x, y: footY + 10, w: colW, h: 40,
        fontFamily: "Cinzel", fontSize: 10, fontWeight: 700, color: II_GOLD, lineHeight: 1.2,
      }));
    } else {
      elements.push({
        id: uid(), type: "shape", shape: "circle",
        x: x + colW / 2 - 28, y: footY - 6, w: 56, h: 56,
        rotation: 0, opacity: 1, fill: "transparent",
        stroke: II_GOLD, strokeWidth: 1.5,
      } as ShapeElement);
      elements.push(iiText({
        text: "INDIAN INSTITUTE",
        x, y: footY + 56, w: colW, h: 16,
        fontFamily: "Georgia", fontSize: 9, fontWeight: 700, color: II_NAVY, letterSpacing: 1,
      }));
    }
  }

  // QR
  elements.push({
    id: uid(), type: "qr", name: "QR Code",
    x: W - 130, y: H - 130, w: 70, h: 70,
    rotation: 0, opacity: 1, fg: "#000000", bg: "#ffffff",
  } as QrElement);
  elements.push(iiText({
    text: "Scan to verify",
    x: W - 150, y: H - 56, w: 110, h: 14,
    fontFamily: "Lora", fontSize: 9, fontWeight: 500, color: II_BODY,
  }));

  return {
    version: 1,
    orientation: "landscape",
    width: W,
    height: H,
    background: {
      color: II_BG, gradient: null, image: null,
      opacity: 1, brightness: 1, contrast: 1, blur: 0, scale: 1, rotation: 0,
    },
    elements,
  };
}
