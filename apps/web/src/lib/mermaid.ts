import { fnv1a32 } from "./diffRendering";
import { LRUCache } from "./lruCache";

const MAX_MERMAID_CACHE_ENTRIES = 200;
const MAX_MERMAID_CACHE_MEMORY_BYTES = 8 * 1024 * 1024;
const mermaidSvgCache = new LRUCache<string>(
  MAX_MERMAID_CACHE_ENTRIES,
  MAX_MERMAID_CACHE_MEMORY_BYTES,
);
const pendingRenders = new Map<string, Promise<string>>();

let mermaidModulePromise: Promise<typeof import("mermaid")> | null = null;
let initializedTheme: "light" | "dark" | null = null;
let renderSequence = 0;
let renderQueue: Promise<unknown> = Promise.resolve();

export function mermaidRenderCacheKey(code: string, theme: "light" | "dark"): string {
  return `${fnv1a32(code).toString(36)}:${code.length}:${theme}`;
}

function loadMermaidModule(): Promise<typeof import("mermaid")> {
  mermaidModulePromise ??= import("mermaid");
  return mermaidModulePromise;
}

function mermaidConfig(theme: "light" | "dark") {
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    suppressErrorRendering: true,
    theme: theme === "dark" ? ("dark" as const) : ("neutral" as const),
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    themeVariables: {
      background: "transparent",
    },
    flowchart: {
      htmlLabels: false,
    },
  };
}

async function getMermaid(theme: "light" | "dark") {
  const { default: mermaid } = await loadMermaidModule();
  if (initializedTheme !== theme) {
    mermaid.initialize(mermaidConfig(theme));
    initializedTheme = theme;
  }
  return mermaid;
}

function nextRenderId(): string {
  renderSequence += 1;
  return `t3mermaid-${renderSequence}`;
}

function enqueueRender<A>(run: () => Promise<A>): Promise<A> {
  const task = renderQueue.then(run, run);
  renderQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

export function mermaidParseErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message.split("\n")[0] ?? "Could not render this Mermaid diagram.";
  }
  return "Could not render this Mermaid diagram.";
}

export async function renderMermaidSvg(code: string, theme: "light" | "dark"): Promise<string> {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    throw new Error("Mermaid source is empty.");
  }

  const cacheKey = mermaidRenderCacheKey(trimmed, theme);
  const cached = mermaidSvgCache.get(cacheKey);
  if (cached != null) return cached;

  const pending = pendingRenders.get(cacheKey);
  if (pending) return pending;

  const task = enqueueRender(async () => {
    const mermaid = await getMermaid(theme);
    const { svg } = await mermaid.render(nextRenderId(), trimmed);
    mermaidSvgCache.set(cacheKey, svg, svg.length * 2);
    return svg;
  }).finally(() => {
    pendingRenders.delete(cacheKey);
  });

  pendingRenders.set(cacheKey, task);
  return task;
}

export function resetMermaidRuntimeForTests(): void {
  mermaidSvgCache.clear();
  pendingRenders.clear();
  mermaidModulePromise = null;
  initializedTheme = null;
  renderSequence = 0;
  renderQueue = Promise.resolve();
}
