import { describe, expect, it } from "vite-plus/test";

import {
  isMermaidFenceLanguage,
  mermaidFenceMarkdown,
  resolveMermaidBlockView,
} from "./mermaidLanguage.js";

describe("isMermaidFenceLanguage", () => {
  it.each(["mermaid", "Mermaid", "MERMAID", " mermaid ", "mermaidjs", "mmd"])(
    "accepts %s",
    (language) => {
      expect(isMermaidFenceLanguage(language)).toBe(true);
    },
  );

  it.each(["", "text", "ts", "markdown", "mermaid.md"])("rejects %s", (language) => {
    expect(isMermaidFenceLanguage(language)).toBe(false);
  });
});

describe("mermaidFenceMarkdown", () => {
  it("wraps source in a mermaid fence", () => {
    expect(mermaidFenceMarkdown("flowchart TD\n  A --> B\n")).toBe(
      "```mermaid\nflowchart TD\n  A --> B\n```\n\n",
    );
  });

  it("lengthens the fence when the source contains backticks", () => {
    expect(mermaidFenceMarkdown("note: ```ts\nconst n = 1\n```")).toBe(
      "````mermaid\nnote: ```ts\nconst n = 1\n```\n````\n\n",
    );
  });
});

describe("resolveMermaidBlockView", () => {
  it("keeps an explicit code preference", () => {
    expect(
      resolveMermaidBlockView({
        preferredView: "code",
        status: "ready",
        isStreaming: false,
      }),
    ).toBe("code");
  });

  it("shows the diagram once a render succeeds", () => {
    expect(
      resolveMermaidBlockView({
        preferredView: "diagram",
        status: "ready",
        isStreaming: true,
      }),
    ).toBe("diagram");
  });

  it("stays on code while a streaming diagram is still parsing", () => {
    expect(
      resolveMermaidBlockView({
        preferredView: "diagram",
        status: "error",
        isStreaming: true,
      }),
    ).toBe("code");
    expect(
      resolveMermaidBlockView({
        preferredView: "diagram",
        status: "idle",
        isStreaming: true,
      }),
    ).toBe("code");
  });

  it("shows the diagram pane error after the fence is complete", () => {
    expect(
      resolveMermaidBlockView({
        preferredView: "diagram",
        status: "error",
        isStreaming: false,
      }),
    ).toBe("diagram");
  });
});
