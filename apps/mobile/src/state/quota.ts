/**
 * Remaining-quota snapshot from CodexBar on the first connected environment.
 *
 * @module state/quota
 */
import { useAtomValue } from "@effect/atom-react";
import { type QuotaSnapshot } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useCallback } from "react";

import { appAtomRegistry } from "./atom-registry";
import { environmentPresentations } from "./presentation";
import { serverEnvironment } from "./server";

const EMPTY_QUOTA_ATOM = Atom.make(AsyncResult.initial<QuotaSnapshot, never>(false)).pipe(
  Atom.withLabel("mobile-quota:empty"),
);

export function useQuotaSnapshot(): {
  readonly snapshot: QuotaSnapshot | null;
  readonly isPending: boolean;
  readonly refresh: () => void;
} {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const environmentId = presentations.keys().next().value;
  const atom =
    environmentId === undefined
      ? EMPTY_QUOTA_ATOM
      : serverEnvironment.quotaSnapshot({ environmentId, input: {} });
  const result = useAtomValue(atom);

  const refresh = useCallback(() => {
    if (environmentId === undefined) return;
    appAtomRegistry.refresh(serverEnvironment.quotaSnapshot({ environmentId, input: {} }));
  }, [environmentId]);

  if (environmentId === undefined) {
    return { snapshot: null, isPending: false, refresh };
  }

  return {
    snapshot: Option.getOrNull(AsyncResult.value(result)),
    isPending: result.waiting,
    refresh,
  };
}
