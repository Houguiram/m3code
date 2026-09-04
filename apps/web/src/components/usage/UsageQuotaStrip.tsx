import { useAtomValue } from "@effect/atom-react";
import type { QuotaInstanceBinding, QuotaSnapshot } from "@t3tools/contracts";
import { formatQuotaWindow } from "@t3tools/shared/quotaFormat";

import { primaryServerProvidersAtom } from "../../state/server";
import { Button } from "../ui/button";

function matchHint(binding: QuotaInstanceBinding): string | null {
  if (binding.match === "ambiguous") {
    return "Multiple CodexBar accounts share this email. Pin one in Settings.";
  }
  if (binding.match === "unmatched") {
    return "No CodexBar account linked. Pin one in Settings if this is unexpected.";
  }
  if (binding.match === "manual") return "Linked in Settings";
  return null;
}

export function UsageQuotaStrip(props: {
  readonly snapshot: QuotaSnapshot | null;
  readonly isPending: boolean;
  readonly onRefresh: () => void;
}) {
  const providers = useAtomValue(primaryServerProvidersAtom);
  const nowMs = Date.now();

  if (props.snapshot === null && props.isPending) {
    return (
      <section className="rounded-xl border border-border/60 px-4 py-3">
        <p className="text-sm text-muted-foreground">Reading remaining subscription limits…</p>
      </section>
    );
  }

  if (props.snapshot === null) return null;

  if (!props.snapshot.available) {
    return (
      <section className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Remaining this window</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.snapshot.message ?? "CodexBar remaining limits are unavailable."}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={props.onRefresh}>
          Retry
        </Button>
      </section>
    );
  }

  const nameByInstance = new Map(
    providers.map((provider) => [provider.instanceId, provider.displayName ?? provider.instanceId]),
  );

  return (
    <section className="rounded-xl border border-border/60 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Remaining this window</p>
        <p className="text-[11px] text-muted-foreground">
          From CodexBar · account limits, not token cost
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.snapshot.instances.map((binding) => {
          const title = nameByInstance.get(binding.instanceId) ?? binding.instanceId;
          const hint = matchHint(binding);
          const windows = binding.account?.windows ?? [];
          return (
            <div key={binding.instanceId} className="min-w-0">
              <p className="truncate text-sm text-foreground">{title}</p>
              {binding.account ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {binding.account.label}
                  {binding.account.plan ? ` · ${binding.account.plan}` : ""}
                </p>
              ) : null}
              {windows.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {windows.map((window) => (
                    <li key={`${binding.instanceId}:${window.kind}`} className="tabular-nums">
                      {formatQuotaWindow(window, nowMs)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
