import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked for safe, clean output
marked.setOptions({
  breaks: true,    // single newline → <br>
  gfm: true,       // GitHub Flavored Markdown
});

/**
 * Parses a Markdown string and returns sanitized HTML.
 * Safe to pass directly to dangerouslySetInnerHTML.
 */
export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "code", "pre", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "blockquote", "a", "hr", "table",
      "thead", "tbody", "tr", "th", "td", "img"
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "src", "alt", "width", "height"],
  });
}
