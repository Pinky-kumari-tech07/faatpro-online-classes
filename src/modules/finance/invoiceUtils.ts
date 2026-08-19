import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import faatproLogo from "@/assets/faatpro-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Jammu & Kashmir","Ladakh","Puducherry",
  "Chandigarh","Andaman & Nicobar","Dadra & Nagar Haveli","Lakshadweep",
];

export type InvoiceRow = any;

const SYM: Record<string, string> = { INR: "Rs.", USD: "$", EUR: "€", GBP: "£" };
export const fmtMoney = (n: any, currency = "INR") => {
  const sym = SYM[currency] ?? `${currency} `;
  const v = Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${v}`;
};

// ---------------- Number to words (Indian numbering) ----------------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + " Hundred");
  if (r) parts.push(twoDigits(r));
  return parts.join(" ");
}
export function numberToIndianWords(num: number, currency = "INR"): string {
  if (num === null || num === undefined || isNaN(num)) return "";
  const rounded = Math.round(num * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  const unit = currency === "INR" ? "Rupees" : currency;
  if (rupees === 0 && paise === 0) return `${unit} Zero Only`;

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  if (crore) parts.push(twoDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));

  let words = `${unit} ${parts.join(" ").trim()}`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  words += " Only";
  return words;
}

// ---------------- Helpers ----------------
async function loadImageDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function normalizeItems(inv: any): Array<{
  description: string; hsn: string; qty: number; rate: number;
  discount: number; taxRate: number; taxAmount: number; total: number;
}> {
  if (Array.isArray(inv.line_items) && inv.line_items.length) {
    return inv.line_items.map((it: any) => ({
      description: it.description || it.title || "Item",
      hsn: it.hsn_sac || inv.hsn_sac || "999293",
      qty: Number(it.qty ?? 1),
      rate: Number(it.rate ?? 0),
      discount: Number(it.discount ?? 0),
      taxRate: Number(it.tax_rate ?? (Number(inv.cgst_rate ?? 0) + Number(inv.sgst_rate ?? 0))),
      taxAmount: Number(it.tax_amount ?? 0),
      total: Number(it.total ?? 0),
    }));
  }
  const rate = Number(inv.rate ?? inv.taxable_amount ?? 0);
  const taxRate =
    inv.gst_type === "intra_state"
      ? Number(inv.cgst_rate ?? 0) + Number(inv.sgst_rate ?? 0)
      : Number(inv.igst_rate ?? 0);
  const taxAmount =
    inv.gst_type === "intra_state"
      ? Number(inv.cgst_amount ?? 0) + Number(inv.sgst_amount ?? 0)
      : Number(inv.igst_amount ?? 0);
  return [{
    description: inv.course_title || inv.item_title || "Course enrollment",
    hsn: inv.hsn_sac || "999293",
    qty: Number(inv.qty ?? 1),
    rate,
    discount: Number(inv.discount_amount ?? 0),
    taxRate,
    taxAmount,
    total: Number(inv.total_amount ?? inv.taxable_amount ?? 0),
  }];
}

// ---------------- PDF ----------------
const PRIMARY: [number, number, number] = [30, 58, 95];      // deep navy
const ACCENT: [number, number, number] = [200, 155, 60];     // gold
const MUTED: [number, number, number] = [110, 118, 129];
const BORDER: [number, number, number] = [222, 226, 230];

export async function generateInvoicePdf(inv: InvoiceRow, opts?: {
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
  footerText?: string | null;
  notes?: string | null;
  enableLogo?: boolean;
  enableSignature?: boolean;
  enableQr?: boolean;
  verifyUrl?: string | null;
}): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const isCN = inv.doc_type === "credit_note";

  const enableLogo = opts?.enableLogo !== false;
  const enableSignature = opts?.enableSignature !== false;
  const enableQr = opts?.enableQr !== false;

  // Preload images
  const [logoData, signatureData] = await Promise.all([
    enableLogo ? loadImageDataUrl(opts?.logoUrl || faatproLogo.url) : Promise.resolve(null),
    enableSignature ? loadImageDataUrl(opts?.signatureUrl || null) : Promise.resolve(null),
  ]);

  // ============== HEADER ==============
  // Left: logo + brand
  let hx = M;
  if (logoData) {
    try {
      // Wider aspect ratio to render the full FAATPRO wordmark clearly
      doc.addImage(logoData, "PNG", M, 30, 140, 56);
      hx = M + 152;
    } catch { /* ignore */ }
  }
  // Brand name & tagline intentionally omitted — logo represents the brand.

  // Right: TAX INVOICE title
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...PRIMARY);
  doc.text(isCN ? "CREDIT NOTE" : "TAX INVOICE", W - M, 52, { align: "right" });
  doc.setDrawColor(...ACCENT).setLineWidth(1.5);
  doc.line(W - M - 120, 58, W - M, 58);

  // Divider under header
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(M, 100, W - M, 100);

  // ============== META STRIP ==============
  const metaY = 120;
  const metaCell = (x: number, w: number, label: string, value: string) => {
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, metaY);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(30, 30, 30);
    doc.text(value || "—", x, metaY + 14, { maxWidth: w });
  };
  const cellW = (W - M * 2) / 4;
  metaCell(M, cellW, "Invoice No.", String(inv.invoice_number ?? "—"));
  metaCell(M + cellW, cellW, "Invoice Date",
    new Date(inv.issued_at ?? inv.created_at ?? Date.now()).toLocaleDateString("en-IN"));
  metaCell(M + cellW * 2, cellW, "Order ID", String(inv.order_id ?? "—"));
  metaCell(M + cellW * 3, cellW, "Payment Status", String(inv.payment_status ?? "—").toUpperCase());

  // ============== PARTY BLOCKS ==============
  let y = 160;
  const colW = (W - M * 2 - 20) / 2;

  const drawParty = (x: number, title: string, lines: (string | undefined | null)[]) => {
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, colW, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...PRIMARY);
    doc.text(title.toUpperCase(), x + 10, y + 12);

    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(45, 45, 45);
    let ly = y + 34;
    for (const l of lines) {
      if (!l) continue;
      const txt = String(l);
      const wrapped = doc.splitTextToSize(txt, colW - 20);
      doc.text(wrapped, x + 10, ly);
      ly += 12 * wrapped.length;
    }
    return ly + 4;
  };

  const sellerLines = [
    inv.seller_name,
    inv.seller_address,
    [inv.seller_city, inv.seller_state, inv.seller_pin].filter(Boolean).join(", "),
    inv.seller_country,
    inv.seller_gstin ? `GSTIN: ${inv.seller_gstin}` : null,
    inv.seller_pan ? `PAN: ${inv.seller_pan}` : null,
    inv.seller_phone ? `Phone: ${inv.seller_phone}` : null,
    inv.seller_email ? `Email: ${inv.seller_email}` : null,
  ];
  const buyerLines = [
    inv.buyer_name,
    inv.buyer_address,
    [inv.buyer_city, inv.buyer_state, inv.buyer_pin].filter(Boolean).join(", "),
    inv.buyer_country,
    inv.buyer_gstin ? `GSTIN: ${inv.buyer_gstin}` : null,
    inv.buyer_phone ? `Phone: ${inv.buyer_phone}` : null,
    inv.buyer_email ? `Email: ${inv.buyer_email}` : null,
  ];
  const sy = drawParty(M, "Seller (Bill From)", sellerLines);
  const by = drawParty(M + colW + 20, "Buyer (Bill To)", buyerLines);
  y = Math.max(sy, by) + 6;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(`Place of Supply: ${inv.place_of_supply || inv.buyer_state || "—"}`, M, y);
  y += 14;

  // ============== ITEMS TABLE ==============
  const items = normalizeItems(inv);
  const currency = inv.currency || "INR";
  const money = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "HSN/SAC", "Qty", "Rate", "Discount", "Tax %", "Tax Amt", "Total"]],
    body: items.map((it, i) => [
      String(i + 1), it.description, it.hsn, String(it.qty),
      money(it.rate), money(it.discount), `${it.taxRate}%`,
      money(it.taxAmount), money(it.total),
    ]),
    styles: { fontSize: 9, cellPadding: 6, lineColor: BORDER, lineWidth: 0.3, textColor: [40, 40, 40] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: "auto" as any },
      2: { cellWidth: 55, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 60, halign: "right" },
      5: { cellWidth: 55, halign: "right" },
      6: { cellWidth: 40, halign: "right" },
      7: { cellWidth: 55, halign: "right" },
      8: { cellWidth: 65, halign: "right" },
    },
    margin: { left: M, right: M },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ============== TOTALS ==============
  const subtotal = items.reduce((s, it) => s + it.rate * it.qty, 0);
  const discount = Number(inv.discount_amount ?? items.reduce((s, it) => s + it.discount, 0));
  const taxable = Number(inv.taxable_amount ?? subtotal - discount);
  const totals: [string, string][] = [
    ["Subtotal", money(subtotal)],
    ["Discount", `- ${money(discount)}`],
    ["Taxable Amount", money(taxable)],
  ];
  if (inv.gst_type === "intra_state") {
    totals.push([`CGST @ ${inv.cgst_rate}%`, money(inv.cgst_amount)]);
    totals.push([`SGST @ ${inv.sgst_rate}%`, money(inv.sgst_amount)]);
  } else {
    totals.push([`IGST @ ${inv.igst_rate}%`, money(inv.igst_amount)]);
  }
  if (inv.round_off) totals.push(["Round Off", money(inv.round_off)]);

  const boxW = 240, boxX = W - M - boxW;
  let ty = y + 4;
  doc.setDrawColor(...BORDER).setLineWidth(0.4);
  doc.setFontSize(9.5);
  for (const [label, amt] of totals) {
    doc.setFont("helvetica", "normal").setTextColor(...MUTED);
    doc.text(label, boxX + 12, ty);
    doc.setFont("helvetica", "normal").setTextColor(30, 30, 30);
    doc.text(amt, boxX + boxW - 12, ty, { align: "right" });
    ty += 16;
  }
  // Grand total band
  doc.setFillColor(...PRIMARY);
  doc.rect(boxX, ty - 2, boxW, 28, "F");
  doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(255, 255, 255);
  doc.text("Grand Total", boxX + 12, ty + 16);
  doc.text(`${currency === "INR" ? "Rs. " : `${currency} `}${money(inv.total_amount)}`,
    boxX + boxW - 12, ty + 16, { align: "right" });

  const rightBottom = ty + 28;

  // Amount in words (left column)
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...MUTED);
  doc.text("AMOUNT IN WORDS", M, y + 4);
  doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(30, 30, 30);
  const words = inv.amount_in_words || numberToIndianWords(Number(inv.total_amount ?? 0), currency);
  const wrappedWords = doc.splitTextToSize(words, W - M * 2 - boxW - 20);
  doc.text(wrappedWords, M, y + 20);

  y = Math.max(rightBottom, y + 20 + wrappedWords.length * 12) + 20;

  // ============== PAYMENT INFO ==============
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...PRIMARY);
  doc.text("PAYMENT INFORMATION", M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 60, 60);
  const pi: [string, string][] = [
    ["Method", (inv.payment_method || "—").toString().toUpperCase()],
  ];
  pi.forEach(([k, v], i) => {
    const px = M + (i % 2) * ((W - M * 2) / 2);
    const py = y + Math.floor(i / 2) * 14;
    doc.setTextColor(...MUTED); doc.text(`${k}:`, px, py);
    doc.setTextColor(30, 30, 30); doc.text(String(v), px + 80, py);
  });
  y += 32;

  // ============== QR + SIGNATURE ==============
  const bottomY = Math.max(y + 20, H - 170);
  // QR (left)
  if (enableQr) {
    try {
      const verifyUrl = opts?.verifyUrl
        || (typeof window !== "undefined"
          ? `${window.location.origin}/verify/${inv.invoice_number || inv.id || ""}`
          : `https://faatpro.com/verify/${inv.invoice_number || inv.id || ""}`);
      const qrData = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 240 });
      doc.addImage(qrData, "PNG", M, bottomY, 72, 72);
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
      doc.text("Scan to verify", M, bottomY + 84);
    } catch { /* ignore */ }
  }

  // Signature (right)
  const sigX = W - M - 180;
  if (signatureData) {
    try { doc.addImage(signatureData, "PNG", sigX, bottomY, 120, 40); } catch { /* ignore */ }
  }
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(sigX, bottomY + 50, sigX + 180, bottomY + 50);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...PRIMARY);
  doc.text(opts?.signatoryName || inv.authorized_signatory || "Authorized Signatory",
    sigX + 90, bottomY + 64, { align: "center" });
  if (opts?.signatoryDesignation) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(opts.signatoryDesignation, sigX + 90, bottomY + 76, { align: "center" });
  }

  // ============== NOTES / TERMS ==============
  if (opts?.notes || inv.terms) {
    const noteText = opts?.notes || inv.terms;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
    doc.text("NOTES", M, bottomY + 100);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(80, 80, 80);
    const wrapped = doc.splitTextToSize(String(noteText), W - M * 2);
    doc.text(wrapped, M, bottomY + 112);
  }

  // ============== FOOTER ==============
  const footY = H - 40;
  doc.setDrawColor(...ACCENT).setLineWidth(1);
  doc.line(M, footY - 20, W - M, footY - 20);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  const footerText = opts?.footerText
    || "This is a computer-generated GST Invoice. No physical signature required.  •  Generated by FAATPRO LMS";
  doc.text(footerText, W / 2, footY - 6, { align: "center" });

  return doc;
}

export async function downloadInvoice(inv: InvoiceRow, opts?: Parameters<typeof generateInvoicePdf>[1]) {
  const doc = await generateInvoicePdf(inv, opts);
  const safe = String(inv.invoice_number || "invoice").replace(/[^a-z0-9-]+/gi, "_");
  doc.save(`${safe}.pdf`);
}

export async function previewInvoice(inv: InvoiceRow, opts?: Parameters<typeof generateInvoicePdf>[1]) {
  const doc = await generateInvoicePdf(inv, opts);
  const url = doc.output("bloburl");
  window.open(url as any, "_blank", "noopener,noreferrer");
}

// Fetch branding/settings options for a workspace to apply to every invoice.
export async function loadInvoiceBrandingOpts(workspaceId: string | null | undefined) {
  if (!workspaceId) return {};
  const { data } = await supabase
    .from("gst_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return {};
  return {
    logoUrl: (data as any).logo_url || null,
    signatureUrl: (data as any).signature_url || null,
    signatoryName: (data as any).authorized_signatory || null,
    signatoryDesignation: (data as any).signatory_designation || null,
    footerText: (data as any).invoice_footer_text || null,
    notes: (data as any).invoice_notes || null,
    enableLogo: (data as any).enable_invoice_logo !== false,
    enableSignature: (data as any).enable_digital_signature !== false,
    enableQr: (data as any).enable_qr_code !== false,
  } as Parameters<typeof generateInvoicePdf>[1];
}
