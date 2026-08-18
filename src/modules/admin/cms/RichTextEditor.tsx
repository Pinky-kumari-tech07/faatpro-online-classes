import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3,
  List, ListOrdered, Link2, Image as ImageIcon, Table as TableIcon,
  Quote, Code, Undo2, Redo2, Strikethrough, Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

type Props = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
};

export default function RichTextEditor({ value, onChange, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value -> editor only when it differs (avoid caret jumps).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(sanitizeRichHtml(ref.current.innerHTML));
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL");
    if (url) exec("createLink", url);
  };

  const insertImage = () => {
    const url = window.prompt("Image URL");
    if (url) exec("insertImage", url);
  };

  const insertTable = () => {
    const cols = Number(window.prompt("Columns?", "3")) || 3;
    const rows = Number(window.prompt("Rows?", "3")) || 3;
    let html = '<table class="w-full border-collapse my-4"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? "th" : "td";
        html += `<${tag} style="border:1px solid #ddd;padding:6px;">${r === 0 ? `Col ${c + 1}` : "&nbsp;"}</${tag}>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br/></p>";
    exec("insertHTML", html);
  };

  const tools: { icon: any; cmd?: string; val?: string; label: string; onClick?: () => void }[] = [
    { icon: Undo2, cmd: "undo", label: "Undo" },
    { icon: Redo2, cmd: "redo", label: "Redo" },
    { icon: Heading1, cmd: "formatBlock", val: "H1", label: "H1" },
    { icon: Heading2, cmd: "formatBlock", val: "H2", label: "H2" },
    { icon: Heading3, cmd: "formatBlock", val: "H3", label: "H3" },
    { icon: Bold, cmd: "bold", label: "Bold" },
    { icon: Italic, cmd: "italic", label: "Italic" },
    { icon: Underline, cmd: "underline", label: "Underline" },
    { icon: Strikethrough, cmd: "strikeThrough", label: "Strike" },
    { icon: List, cmd: "insertUnorderedList", label: "Bullet list" },
    { icon: ListOrdered, cmd: "insertOrderedList", label: "Numbered list" },
    { icon: Quote, cmd: "formatBlock", val: "BLOCKQUOTE", label: "Quote" },
    { icon: Code, cmd: "formatBlock", val: "PRE", label: "Code block" },
    { icon: Link2, label: "Link", onClick: insertLink },
    { icon: ImageIcon, label: "Image", onClick: insertImage },
    { icon: TableIcon, label: "Table", onClick: insertTable },
    { icon: Eraser, cmd: "removeFormat", label: "Clear formatting" },
  ];

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-background", className)}>
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
        {tools.map((t, i) => (
          <Button
            key={i}
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (t.onClick ? t.onClick() : t.cmd && exec(t.cmd, t.val))}
          >
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(sanitizeRichHtml((e.target as HTMLDivElement).innerHTML))}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          const clean = html ? sanitizeRichHtml(html) : text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
          document.execCommand("insertHTML", false, clean);
          if (ref.current) onChange(sanitizeRichHtml(ref.current.innerHTML));
        }}
        className="prose prose-neutral dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none
          prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
          prose-a:text-primary"
      />
    </div>
  );
}