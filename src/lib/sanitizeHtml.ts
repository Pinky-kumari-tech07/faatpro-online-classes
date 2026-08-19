// Lightweight HTML sanitizer for rich-text content stored in the DB.
// Removes editor metadata (data-*, contenteditable, aria-hidden, on* handlers)
// and dangerous tags (script/style/iframe). Keeps standard formatting tags.

const STRIP_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta"];

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // Fallback regex-only cleanup for SSR
    return html
      .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, "")
      .replace(/\sdata-[a-z0-9_-]+='[^']*'/gi, "")
      .replace(/\son[a-z]+="[^"]*"/gi, "")
      .replace(/\saria-hidden="[^"]*"/gi, "")
      .replace(/\scontenteditable="[^"]*"/gi, "");
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";

  const walk = (node: Element) => {
    // Remove dangerous tags entirely
    if (STRIP_TAGS.includes(node.tagName.toLowerCase())) {
      node.remove();
      return;
    }
    // Strip junky attributes
    for (const attr of Array.from(node.attributes)) {
      const n = attr.name.toLowerCase();
      if (
        n.startsWith("data-") ||
        n.startsWith("on") ||
        n === "contenteditable" ||
        n === "aria-hidden" ||
        n === "spellcheck" ||
        n === "autocorrect" ||
        n === "autocapitalize"
      ) {
        node.removeAttribute(attr.name);
      }
      // Drop editor-specific class names but keep semantic classes (prose, list-*, text-*)
      if (n === "class") {
        const cleaned = attr.value
          .split(/\s+/)
          .filter((c) => !/^(ProseMirror|ql-|tiptap|editor|cm-|monaco|ProseMirror-)/i.test(c))
          .filter((c) => !/(selection|anchor|focus)/i.test(c))
          .join(" ")
          .trim();
        if (cleaned) node.setAttribute("class", cleaned);
        else node.removeAttribute("class");
      }
    }
    for (const child of Array.from(node.children)) walk(child);
  };
  walk(root);
  // Strip comments
  const treeWalker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: ChildNode[] = [];
  let c: Node | null;
  while ((c = treeWalker.nextNode())) comments.push(c as ChildNode);
  comments.forEach((n) => n.remove());
  return root.innerHTML.trim();
}

/** True when the value contains real HTML tags worth rendering as HTML. */
export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?(p|div|span|h[1-6]|ul|ol|li|strong|em|a|img|br|blockquote|pre|code|table)\b/i.test(value);
}
