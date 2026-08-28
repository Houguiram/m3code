/**
 * The class the macOS desktop shell carries on the document element, where the
 * window is backed by a native vibrancy view. The boot script in index.html
 * sets it before first paint and the platform classes keep it applied.
 *
 * Kept free of imports so the surfaces that paint the document (theme sync,
 * boot chrome) can ask about it without pulling in app modules.
 */
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
