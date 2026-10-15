import { isMermaidFenceLanguage } from "@t3tools/client-runtime/mermaid-language";
import { markdownWithHtml, parseMarkdownDocument, type MarkdownNode } from "./markdownDocument";

/** Native Markdown hosts React media inside the document, including quoted diagrams. */
export function mermaidMarkdown(source: string) {
  let markdown = markdownWithHtml(source);
  const diagrams = new Map<string, string>();
  if (!/mermaid|mermaidjs|mmd/i.test(markdown)) return { markdown, diagrams };
  const edits: Array<{ start: number; end: number; replacement: string }> = [];
  const visit = (node: MarkdownNode) => {
    if (node.type === "code" && isMermaidFenceLanguage(node.lang ?? "")) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined) return;
      const href = `m3-mermaid://diagram/${start}`;
      diagrams.set(href, node.value);
      edits.push({ start, end, replacement: `![Mermaid diagram](${href})` });
    } else if ("children" in node) {
      node.children.forEach(visit);
    }
  };
  visit(parseMarkdownDocument(markdown));
  for (let index = edits.length - 1; index >= 0; index -= 1) {
    const edit = edits[index]!;
    markdown = markdown.slice(0, edit.start) + edit.replacement + markdown.slice(edit.end);
  }
  return { markdown, diagrams };
}
