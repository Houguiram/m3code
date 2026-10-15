import { useMemo } from "react";
import { mermaidMarkdown } from "../../lib/mermaidMarkdown";
import { SelectableMarkdownText } from "../../native/SelectableMarkdownText";
import type { SelectableMarkdownTextProps } from "../../native/SelectableMarkdownText.types";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { MermaidMarkdownDiagram } from "./MermaidMarkdownDiagram";

export function ThreadMarkdownText(props: SelectableMarkdownTextProps) {
  const { themeAppearance } = useAppearancePreferences();
  const content = useMemo(() => mermaidMarkdown(props.markdown), [props.markdown]);
  return (
    <SelectableMarkdownText
      {...props}
      markdown={content.markdown}
      renderImage={(image) => {
        const code = content.diagrams.get(image.href);
        return code === undefined ? (
          props.renderImage?.(image)
        ) : (
          <MermaidMarkdownDiagram code={code} theme={themeAppearance} textStyle={props.textStyle} />
        );
      }}
    />
  );
}
