import { PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import { useEffect, useMemo, useState } from "react";

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
  const candidatePaths = useMemo(
    () =>
      localProjectWorkspaceRoots(projects, primaryEnvironmentId ?? PRIMARY_LOCAL_ENVIRONMENT_ID),
    [primaryEnvironmentId, projects],
  );
  const [checkoutPath, setCheckoutPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron) {
      setCheckoutPath(null);
      return;
    }
    const resolve = window.desktopBridge?.resolveM3CodeCheckout;
    if (typeof resolve !== "function") {
      setCheckoutPath(null);
      return;
    }
    let cancelled = false;
    void resolve([...candidatePaths])
      .then((result) => {
        if (!cancelled) setCheckoutPath(result.checkoutPath);
      })
      .catch(() => {
        if (!cancelled) setCheckoutPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, [candidatePaths]);

  return { checkoutPath, candidatePaths };
}
