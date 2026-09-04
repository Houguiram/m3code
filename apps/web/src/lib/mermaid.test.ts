import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mermaidInitialize = vi.fn();
const mermaidRender = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: (...args: unknown[]) => mermaidInitialize(...args),
    render: (...args: unknown[]) => mermaidRender(...args),
  },
}));

import {
  mermaidParseErrorMessage,
  mermaidRenderCacheKey,
  renderMermaidSvg,
  resetMermaidRuntimeForTests,
} from "./mermaid";

describe("renderMermaidSvg", () => {
  afterEach(() => {
    resetMermaidRuntimeForTests();
    mermaidInitialize.mockReset();
    mermaidRender.mockReset();
  });

  it("renders once and reuses the cached SVG", async () => {
    mermaidRender.mockResolvedValue({ svg: "<svg>ok</svg>" });

    await expect(renderMermaidSvg("flowchart TD\n  A --> B", "dark")).resolves.toBe(
      "<svg>ok</svg>",
    );
    await expect(renderMermaidSvg("flowchart TD\n  A --> B", "dark")).resolves.toBe(
      "<svg>ok</svg>",
    );

    expect(mermaidRender).toHaveBeenCalledTimes(1);
    expect(mermaidInitialize).toHaveBeenCalledTimes(1);
  });

  it("re-renders when the theme changes", async () => {
    mermaidRender.mockResolvedValue({ svg: "<svg>ok</svg>" });

    await renderMermaidSvg("flowchart TD\n  A --> B", "dark");
    await renderMermaidSvg("flowchart TD\n  A --> B", "light");

    expect(mermaidRender).toHaveBeenCalledTimes(2);
    expect(mermaidInitialize).toHaveBeenCalledTimes(2);
  });

  it("surfaces a single-line parse error", async () => {
    mermaidRender.mockRejectedValue(new Error("Parse error on line 2:\nflowchart\n^"));

    await expect(renderMermaidSvg("flowchart TD\n  A -", "dark")).rejects.toThrow(
      "Parse error on line 2:",
    );
    expect(mermaidParseErrorMessage(new Error("Parse error on line 2:\nflowchart\n^"))).toBe(
      "Parse error on line 2:",
    );
  });

  it("rejects empty source without loading mermaid", async () => {
    await expect(renderMermaidSvg("   \n", "dark")).rejects.toThrow("Mermaid source is empty.");
    expect(mermaidRender).not.toHaveBeenCalled();
  });

  it("keys the cache by source and theme", () => {
    expect(mermaidRenderCacheKey("A", "dark")).not.toBe(mermaidRenderCacheKey("B", "dark"));
    expect(mermaidRenderCacheKey("A", "dark")).not.toBe(mermaidRenderCacheKey("A", "light"));
  });
});
