import { useEffect, useRef, useState } from "react";
import type { MermaidRenderStatus } from "@t3tools/client-runtime/mermaid-language";

import { mermaidParseErrorMessage, renderMermaidSvg } from "../lib/mermaid";

const STREAMING_RENDER_DEBOUNCE_MS = 200;

export function MermaidDiagram({
  code,
  theme,
  isStreaming,
  onStatusChange,
}: {
  readonly code: string;
  readonly theme: "light" | "dark";
  readonly isStreaming: boolean;
  readonly onStatusChange: (status: MermaidRenderStatus) => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      svgRef.current = null;
      setSvg(null);
      setError(null);
      onStatusChange("idle");
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(
      () => {
        void renderMermaidSvg(trimmed, theme).then(
          (nextSvg) => {
            if (cancelled) return;
            svgRef.current = nextSvg;
            setSvg(nextSvg);
            setError(null);
            onStatusChange("ready");
          },
          (cause) => {
            if (cancelled) return;
            setError(mermaidParseErrorMessage(cause));
            if (isStreaming && svgRef.current != null) {
              onStatusChange("ready");
              return;
            }
            if (!isStreaming) {
              svgRef.current = null;
              setSvg(null);
            }
            onStatusChange("error");
          },
        );
      },
      isStreaming ? STREAMING_RENDER_DEBOUNCE_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, isStreaming, onStatusChange, theme]);

  if (error != null && !isStreaming) {
    return (
      <div className="chat-markdown-mermaid-error" role="alert">
        {error}
      </div>
    );
  }

  if (svg == null) {
    return null;
  }

  return (
    <div
      className="chat-markdown-mermaid"
      aria-label="Mermaid diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
