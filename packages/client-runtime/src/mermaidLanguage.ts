const MERMAID_FENCE_LANGUAGES = new Set(["mermaid", "mermaidjs", "mmd"]);

export type MermaidBlockView = "code" | "diagram";
export type MermaidRenderStatus = "idle" | "ready" | "error";

export function isMermaidFenceLanguage(language: string): boolean {
  return MERMAID_FENCE_LANGUAGES.has(language.trim().toLowerCase());
}

export function mermaidFenceMarkdown(code: string): string {
  const body = code.replace(/\n$/, "");
  let longestBacktickRun = 0;
  for (const match of body.matchAll(/`{3,}/g)) {
    longestBacktickRun = Math.max(longestBacktickRun, match[0].length);
  }
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}mermaid\n${body}\n${fence}\n\n`;
}

/**
 * Diagram is the default once a render succeeds. Incomplete streaming source
 * stays on code so parse errors do not flash in the timeline. A finished
 * block that still cannot parse shows the diagram pane's error state.
 */
export function resolveMermaidBlockView(input: {
  readonly preferredView: MermaidBlockView;
  readonly status: MermaidRenderStatus;
  readonly isStreaming: boolean;
}): MermaidBlockView {
  if (input.preferredView === "code") return "code";
  if (input.status === "ready") return "diagram";
  if (input.status === "error" && !input.isStreaming) return "diagram";
  return "code";
}
