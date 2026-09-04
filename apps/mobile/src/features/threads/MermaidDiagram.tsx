import { memo, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { MermaidRenderStatus } from "@t3tools/client-runtime/mermaid-language";

import { AppText as Text } from "../../components/AppText";

const RENDER_DEBOUNCE_MS = 200;
const MERMAID_SCRIPT_SRC = "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js";

type CachedMermaidSvg = {
  readonly svg: string;
  readonly height: number;
};

const mermaidSvgCache = new Map<string, CachedMermaidSvg>();

function cacheKey(code: string, theme: "light" | "dark"): string {
  return `${theme}:${code}`;
}

function mermaidHostHtml(input: {
  readonly code: string;
  readonly theme: "light" | "dark";
  readonly cachedSvg?: string;
}): string {
  const theme = input.theme === "dark" ? "dark" : "neutral";
  const source = JSON.stringify(input.code);
  const cachedSvg = input.cachedSvg ?? "";
  const bootScript =
    cachedSvg.length > 0
      ? "reportSize();"
      : `function boot() {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: ${JSON.stringify(theme)},
      themeVariables: { background: "transparent" },
      flowchart: { htmlLabels: false }
    });
    mermaid.render("t3mermaid", ${source}).then(function (result) {
      document.getElementById("diagram").innerHTML = result.svg;
      requestAnimationFrame(reportSize);
    }).catch(function (error) {
      report({ ok: false, error: String(error && error.message ? error.message : error) });
    });
  }
  var script = document.createElement("script");
  script.src = ${JSON.stringify(MERMAID_SCRIPT_SRC)};
  script.onload = boot;
  script.onerror = function () {
    report({ ok: false, error: "Could not load the Mermaid renderer." });
  };
  document.head.appendChild(script);`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html, body { margin: 0; background: transparent; }
  #diagram { overflow: hidden; }
  svg { display: block; max-width: 100%; height: auto; }
</style>
</head>
<body>
<div id="diagram">${cachedSvg}</div>
<script>
  function report(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  function reportSize() {
    var svg = document.querySelector("svg");
    if (!svg) return;
    var box = svg.getBoundingClientRect();
    report({
      ok: true,
      svg: svg.outerHTML,
      height: Math.ceil(box.height) || Math.ceil(svg.getBBox().height)
    });
  }
  ${bootScript}
</script>
</body>
</html>`;
}

export const MermaidDiagram = memo(function MermaidDiagram(props: {
  readonly code: string;
  readonly theme: "light" | "dark";
  readonly isStreaming: boolean;
  readonly errorColor: string;
  readonly onStatusChange: (status: MermaidRenderStatus) => void;
}) {
  const { code, errorColor, isStreaming, onStatusChange, theme } = props;
  const trimmed = code.trim();
  const key = cacheKey(trimmed, theme);
  const cached = trimmed.length > 0 ? mermaidSvgCache.get(key) : undefined;
  const [svg, setSvg] = useState<string | null>(cached?.svg ?? null);
  const [height, setHeight] = useState(cached?.height ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState(cached ? trimmed : "");
  const svgRef = useRef<string | null>(cached?.svg ?? null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (trimmed.length === 0) {
      svgRef.current = null;
      setSvg(null);
      setHeight(0);
      setError(null);
      setSourceCode("");
      onStatusChangeRef.current("idle");
      return;
    }

    const cachedSvg = mermaidSvgCache.get(key);
    if (cachedSvg) {
      svgRef.current = cachedSvg.svg;
      setSvg(cachedSvg.svg);
      setHeight(cachedSvg.height);
      setError(null);
      setSourceCode(trimmed);
      onStatusChangeRef.current("ready");
      return;
    }

    const timer = setTimeout(() => {
      setSourceCode(trimmed);
    }, RENDER_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [key, trimmed]);

  const html = useMemo(() => {
    if (sourceCode.length === 0) return null;
    const current = mermaidSvgCache.get(cacheKey(sourceCode, theme));
    return mermaidHostHtml({
      code: sourceCode,
      theme,
      ...(current ? { cachedSvg: current.svg } : {}),
    });
  }, [sourceCode, theme]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        ok?: boolean;
        svg?: string;
        height?: number;
        error?: string;
      };
      if (payload.ok && typeof payload.svg === "string") {
        const nextHeight = typeof payload.height === "number" ? Math.max(1, payload.height) : 1;
        mermaidSvgCache.set(cacheKey(sourceCode, theme), {
          svg: payload.svg,
          height: nextHeight,
        });
        svgRef.current = payload.svg;
        setSvg(payload.svg);
        setHeight(nextHeight);
        setError(null);
        onStatusChangeRef.current("ready");
        return;
      }
      const message =
        typeof payload.error === "string" && payload.error.length > 0
          ? payload.error.split("\n")[0]
          : "Could not render this Mermaid diagram.";
      setError(message ?? "Could not render this Mermaid diagram.");
      if (isStreaming && svgRef.current != null) {
        onStatusChangeRef.current("ready");
        return;
      }
      if (!isStreaming) {
        svgRef.current = null;
        setSvg(null);
      }
      onStatusChangeRef.current("error");
    } catch {
      onStatusChangeRef.current("error");
    }
  };

  if (error != null && !isStreaming && svg == null) {
    return (
      <View className="px-3.5 py-3">
        <Text className="text-xs leading-snug" style={{ color: errorColor }}>
          {error}
        </Text>
      </View>
    );
  }

  if (html == null) {
    return null;
  }

  return (
    <WebView
      source={{ html, baseUrl: "https://cdn.jsdelivr.net/" }}
      originWhitelist={["*"]}
      scrollEnabled={false}
      javaScriptEnabled
      automaticallyAdjustContentInsets={false}
      setSupportMultipleWindows={false}
      onMessage={handleMessage}
      style={{
        height: height > 0 ? height : 1,
        backgroundColor: "transparent",
        opacity: height > 0 ? 1 : 0,
      }}
    />
  );
});
