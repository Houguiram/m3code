// Leave the macOS document surface unpainted so native vibrancy remains visible.
export const MACOS_VIBRANCY_CLASS_NAME = "electron-macos";

/**
 * True while the document is that shell. Callers must leave the document
 * surface unpainted so the blur stays visible behind the sidebar.
 */
export function documentHasMacosVibrancy(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains(MACOS_VIBRANCY_CLASS_NAME)
  );
}
