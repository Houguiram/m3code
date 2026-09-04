/**
 * Primary-environment remaining-quota snapshot from CodexBar.
 *
 * @module state/quota
 */
import { useAtomValue } from "@effect/atom-react";
import {
  type ProviderInstanceId,
  type QuotaInstanceBinding,
  type QuotaSnapshot,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useCallback } from "react";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { usePrimaryEnvironmentId } from "./environments";
import { serverEnvironment } from "./server";

const EMPTY_QUOTA_ATOM = Atom.make(AsyncResult.initial<QuotaSnapshot, never>(false)).pipe(
  Atom.withLabel("web-quota:empty"),
);

export function useQuotaSnapshot(): {
  readonly snapshot: QuotaSnapshot | null;
  readonly isPending: boolean;
  readonly refresh: () => void;
} {
  const environmentId = usePrimaryEnvironmentId();
  const atom =
    environmentId === null
      ? EMPTY_QUOTA_ATOM
      : serverEnvironment.quotaSnapshot({ environmentId, input: {} });
  const result = useAtomValue(atom);

  const refresh = useCallback(() => {
    if (environmentId === null) return;
    appAtomRegistry.refresh(serverEnvironment.quotaSnapshot({ environmentId, input: {} }));
  }, [environmentId]);

  if (environmentId === null) {
    return { snapshot: null, isPending: false, refresh };
  }

  return {
    snapshot: Option.getOrNull(AsyncResult.value(result)),
    isPending: result.waiting,
    refresh,
  };
}

export function useInstanceQuota(instanceId: ProviderInstanceId): QuotaInstanceBinding | null {
  const { snapshot } = useQuotaSnapshot();
  return snapshot?.instances.find((binding) => binding.instanceId === instanceId) ?? null;
}
