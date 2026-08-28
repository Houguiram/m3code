import { useCallback } from "react";

import { ensureLocalApi } from "../localApi";
import { getM3CodeRebuildConfirmationMessage } from "../m3CodeActions.logic";
import { stackedThreadToast, toastManager } from "../components/ui/toast";
import { useM3CodeCheckoutPath } from "./useM3CodeCheckout";

export function useM3CodeLocalRebuild() {
  const { checkoutPath, candidatePaths } = useM3CodeCheckoutPath();

  const startRebuild = useCallback(async () => {
    const bridge = window.desktopBridge;
    const openTerminal = bridge?.openM3CodeLoginTerminal;
    if (typeof openTerminal !== "function" || checkoutPath === null) {
      return { started: false as const, error: "Local rebuild is not available." };
    }
    let confirmed = false;
    try {
      confirmed = await ensureLocalApi().dialogs.confirm(
        getM3CodeRebuildConfirmationMessage(checkoutPath),
      );
    } catch (error) {
      const description = error instanceof Error ? error.message : "Confirmation failed.";
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not confirm rebuild",
          description,
        }),
      );
      return { started: false as const, error: description };
    }
    if (!confirmed) return { started: false as const, error: null };

    try {
      const result = await openTerminal({
        command: "rebuild-from-main",
        cwd: checkoutPath,
        candidatePaths: [...candidatePaths],
      });
      if (!result.started) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not start local rebuild",
            description: result.error ?? "Terminal did not open.",
          }),
        );
      }
      return result;
    } catch (error) {
      const description = error instanceof Error ? error.message : "An unexpected error occurred.";
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not start local rebuild",
          description,
        }),
      );
      return { started: false as const, error: description };
    }
  }, [candidatePaths, checkoutPath]);

  return { checkoutPath, startRebuild };
}
