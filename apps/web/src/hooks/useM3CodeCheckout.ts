import { PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { isElectron } from "../env";
import { localProjectWorkspaceRoots } from "../m3CodeActions.logic";
import { usePrimaryEnvironmentId } from "../state/environments";
import { useProjects } from "../state/entities";

export function useM3CodeCheckoutPath(): {
  readonly checkoutPath: string | null;
  readonly candidatePaths: ReadonlyArray<string>;
} {
  const projects = useProjects();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const candidatePaths = localProjectWorkspaceRoots(
    projects,
    primaryEnvironmentId ?? PRIMARY_LOCAL_ENVIRONMENT_ID,
  );
  const candidateKey = JSON.stringify(candidatePaths);
  const [resolution, setResolution] = useState<{ key: string; checkoutPath: string | null } | null>(
    null,
  );

  // oxlint-disable-next-line t3code/react-effect-budget -- Resolve the checkout through desktop IPC when local project paths change.
  useEffect(() => {
    if (!isElectron) {
      return;
    }
    const resolve = window.desktopBridge?.resolveM3CodeCheckout;
    if (typeof resolve !== "function") {
      return;
    }
    let cancelled = false;
    void resolve([...candidatePaths])
      .then((result) => {
        if (!cancelled) setResolution({ key: candidateKey, checkoutPath: result.checkoutPath });
      })
      .catch(() => {
        if (!cancelled) setResolution({ key: candidateKey, checkoutPath: null });
      });
    return () => {
      cancelled = true;
    };
  }, [candidatePaths, candidateKey]);

  return {
    checkoutPath: isElectron && resolution?.key === candidateKey ? resolution.checkoutPath : null,
    candidatePaths,
  };
}
