import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text as NativeText,
  View,
  type ColorValue,
} from "react-native";
import {
  isMermaidFenceLanguage,
  resolveMermaidBlockView,
  type MermaidBlockView,
  type MermaidRenderStatus,
} from "@t3tools/client-runtime/mermaid-language";
import { MermaidDiagram } from "../features/threads/MermaidDiagram";
import { useMarkdownCodeHighlight } from "../features/threads/markdownCodeHighlightState";
import type { ReviewDiffTheme } from "../features/review/shikiReviewHighlighter";
import { SymbolView } from "../components/AppSymbol";
import { CopyTextButton } from "../components/CopyTextButton";
import type { NativeMarkdownTextStyle } from "./SelectableMarkdownText.types";

export function MermaidMarkdownDiagram(props: {
  readonly code: string;
  readonly theme: "light" | "dark";
  readonly textStyle: NativeMarkdownTextStyle;
}) {
  return (
    <MarkdownCodeBlock
      backgroundColor={props.textStyle.codeBlockBackgroundColor}
      borderColor={props.textStyle.dividerColor}
      content={props.code}
      copyTintColor={props.textStyle.mutedColor}
      headerTextColor={props.textStyle.mutedColor}
      fontSize={props.textStyle.fontSize * 0.9}
      highlightCode
      language="mermaid"
      lineHeight={props.textStyle.lineHeight}
      textColor={props.textStyle.codeColor}
      theme={props.theme}
    />
  );
}

function MarkdownCodeBlock(props: {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly content: string;
  readonly copyTintColor: ColorValue;
  readonly headerTextColor: string;
  readonly fontSize: number;
  readonly highlightCode: boolean;
  readonly language?: string | null;
  readonly lineHeight: number;
  readonly textColor: string;
  readonly theme: ReviewDiffTheme;
}) {
  const content = props.content.replace(/\n$/, "");
  const languageLabel = props.language?.trim() || "text";
  const mermaid = isMermaidFenceLanguage(languageLabel);
  const [preferredMermaidView, setPreferredMermaidView] = useState<MermaidBlockView>("diagram");
  const [mermaidStatus, setMermaidStatus] = useState<MermaidRenderStatus>("idle");
  const mermaidView = mermaid
    ? resolveMermaidBlockView({
        preferredView: preferredMermaidView,
        status: mermaidStatus,
        isStreaming: false,
      })
    : "code";
  const highlighted = useMarkdownCodeHighlight({
    code: content,
    enabled: mermaidView === "code" && props.highlightCode && Boolean(props.language?.trim()),
    language: props.language,
    theme: props.theme,
  });
  let tokenOffset = 0;

  return (
    <View
      className="my-3 min-w-0 max-w-full self-stretch overflow-hidden rounded-lg border"
      style={{ backgroundColor: props.backgroundColor, borderColor: props.borderColor }}
    >
      <View
        className="flex-row items-center justify-between gap-2 border-b py-1 pr-1.5 pl-3.5"
        style={{ borderBottomColor: props.borderColor }}
      >
        <NativeText
          className="flex-1 font-mono uppercase opacity-70"
          numberOfLines={1}
          style={{
            color: props.headerTextColor,
            fontSize: props.fontSize,
            ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
          }}
        >
          {languageLabel}
        </NativeText>
        <View className="flex-row items-center">
          {mermaid ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mermaidView === "diagram" ? "Show code" : "Show diagram"}
              hitSlop={8}
              onPress={() =>
                setPreferredMermaidView(mermaidView === "diagram" ? "code" : "diagram")
              }
              style={{
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SymbolView
                name={
                  mermaidView === "diagram"
                    ? "chevron.left.forwardslash.chevron.right"
                    : "point.3.connected.trianglepath.dotted"
                }
                size={16}
                tintColor={props.copyTintColor}
                type="monochrome"
              />
            </Pressable>
          ) : null}
          <CopyTextButton
            accessibilityLabel="Copy code"
            text={content}
            tintColor={props.copyTintColor}
            buttonSize={32}
            iconSize={16}
          />
        </View>
      </View>
      {mermaid ? (
        <View style={{ display: mermaidView === "diagram" ? "flex" : "none" }}>
          <MermaidDiagram
            code={content}
            errorColor={props.headerTextColor}
            isStreaming={false}
            theme={props.theme}
            onStatusChange={setMermaidStatus}
          />
        </View>
      ) : null}
      {mermaidView === "code" ? (
        <ScrollView
          horizontal
          bounces={false}
          nestedScrollEnabled={Platform.OS === "android"}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-3.5 py-3"
        >
          <NativeText
            selectable
            selectionColorClassName={Platform.OS === "android" ? "accent-focus/32" : undefined}
            className="font-mono"
            style={{
              color: props.textColor,
              fontSize: props.fontSize,
              lineHeight: props.lineHeight,
              ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
            }}
          >
            {highlighted
              ? highlighted.map((line, lineIndex) => {
                  const lineStartOffset = tokenOffset;
                  const lineText = line.map((token) => token.content).join("");
                  const renderedLine = (
                    <NativeText key={`line:${lineStartOffset}:${lineText}`}>
                      {line.map((token) => {
                        const startOffset = tokenOffset;
                        tokenOffset += token.content.length;
                        const fontStyle =
                          token.fontStyle !== null && (token.fontStyle & 1) === 1
                            ? ("italic" as const)
                            : ("normal" as const);
                        const fontWeight =
                          token.fontStyle !== null && (token.fontStyle & 2) === 2
                            ? ("700" as const)
                            : ("400" as const);

                        return (
                          <NativeText
                            key={`${startOffset}:${token.content}:${token.color ?? ""}:${
                              token.fontStyle ?? ""
                            }`}
                            style={{
                              color: token.color ?? props.textColor,
                              fontStyle,
                              fontWeight,
                            }}
                          >
                            {token.content}
                          </NativeText>
                        );
                      })}
                      {lineIndex + 1 < highlighted.length ? "\n" : ""}
                    </NativeText>
                  );
                  if (lineIndex + 1 < highlighted.length) {
                    tokenOffset += 1;
                  }
                  return renderedLine;
                })
              : content}
          </NativeText>
        </ScrollView>
      ) : null}
    </View>
  );
}
