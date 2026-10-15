import { describe, expect, it } from "vite-plus/test";
import { mermaidMarkdown } from "./mermaidMarkdown";

describe("Mermaid in native Markdown", () => {
  it("preserves prose and ordinary code while replacing Mermaid with native media slots", () => {
    const source =
      "Before\n\n```ts\nconst mermaid = 1;\n```\n\n```mermaid\ngraph TD; A-->B\n```\n\nAfter";
    const result = mermaidMarkdown(source);
    expect([...result.diagrams.values()]).toEqual(["graph TD; A-->B"]);
    expect(result.markdown).toContain("```ts\nconst mermaid = 1;\n```");
    expect(result.markdown).toContain("![Mermaid diagram](m3-mermaid://diagram/");
    expect(result.markdown).toMatch(/^Before[\s\S]*After$/);
  });

  it("keeps a quoted diagram inside its quote and recognizes aliases", () => {
    const result = mermaidMarkdown(
      "> ```mmd\n> graph TD; A-->B\n> ```\n\n```mermaidjs\ngraph LR; X-->Y\n```",
    );
    expect([...result.diagrams.values()]).toEqual(["graph TD; A-->B", "graph LR; X-->Y"]);
    expect(result.markdown).toMatch(/^> !\[Mermaid diagram\]/);
    expect(result.markdown.match(/m3-mermaid:\/\/diagram\//g)).toHaveLength(2);
  });

  it("leaves literal fence examples and prose unchanged", () => {
    const source = "Mermaid example:\n\n````text\n```mermaid\ngraph TD\n```\n````";
    expect(mermaidMarkdown(source)).toEqual({ markdown: source, diagrams: new Map() });
  });
});
