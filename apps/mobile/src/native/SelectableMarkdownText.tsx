import { useMemo } from "react";
import { Platform } from "react-native";
import type { SelectableMarkdownTextProps } from "./SelectableMarkdownText.types";

import { MermaidMarkdownDiagram } from "./MermaidMarkdownDiagram";
import { mermaidMarkdown } from "../lib/mermaidMarkdown";
import { useAppearancePreferences } from "../features/settings/appearance/AppearancePreferencesProvider";
import { MobileEnrichedMarkdownText } from "./EnrichedMarkdownText";
import { themeColorWithAlpha } from "../lib/mobileTheme";
import { useUniwindTheme } from "../lib/useUniwindTheme";

export type {
  MarkdownFileContextMenu,
  MarkdownFileContextMenuAction,
  MarkdownImageRenderer,
  MarkdownImageRequest,
  MarkdownImageSourceResolver,
  MarkdownLinkCustomization,
  NativeMarkdownTextStyle,
  SelectableMarkdownSkill,
} from "./SelectableMarkdownText.types";

export function SelectableMarkdownText(props: SelectableMarkdownTextProps) {
  const theme = useUniwindTheme();
  const { themeAppearance } = useAppearancePreferences();
  const content = useMemo(() => mermaidMarkdown(props.markdown), [props.markdown]);
  const selectionColor = themeColorWithAlpha(theme["--color-focus"], 0.32);
  const selectionHandleColor = theme["--color-focus"];
  const textStyle = useMemo(
    () =>
      Platform.OS === "android"
        ? { selectionColor, selectionHandleColor, ...props.textStyle }
        : props.textStyle,
    [props.textStyle, selectionColor, selectionHandleColor],
  );
  return (
    <MobileEnrichedMarkdownText
      {...props}
      markdown={content.markdown}
      textStyle={textStyle}
      renderImage={(image) => {
        const code = content.diagrams.get(image.href);
        return code === undefined ? (
          props.renderImage?.(image)
        ) : (
          <MermaidMarkdownDiagram code={code} theme={themeAppearance} textStyle={textStyle} />
        );
      }}
    />
  );
}
