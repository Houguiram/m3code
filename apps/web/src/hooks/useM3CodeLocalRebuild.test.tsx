import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const testState = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock("./useM3CodeCheckout", () => ({
  useM3CodeCheckoutPath: () => ({
    checkoutPath: null,
    candidatePaths: [],
  }),
}));

vi.mock("../components/ui/toast", () => ({
  stackedThreadToast: (toast: unknown) => toast,
  toastManager: { add: testState.addToast },
}));

import { useM3CodeLocalRebuild } from "./useM3CodeLocalRebuild";

describe("useM3CodeLocalRebuild", () => {
  let startRebuild: ReturnType<typeof useM3CodeLocalRebuild>["startRebuild"] | null = null;

  beforeEach(() => {
    testState.addToast.mockReset();
    vi.stubGlobal("window", { desktopBridge: {} });

    function HookHarness() {
      ({ startRebuild } = useM3CodeLocalRebuild());
      return null;
    }

    renderToStaticMarkup(<HookHarness />);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports when the local rebuild is unavailable", async () => {
    const result = await startRebuild?.();

    expect(result).toEqual({
      started: false,
      error: "Local rebuild is not available.",
    });
    expect(testState.addToast).toHaveBeenCalledWith({
      type: "error",
      title: "Could not start local rebuild",
      description: "Local rebuild is not available.",
    });
  });
});
