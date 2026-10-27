import type { ContextMenuItem } from "@t3tools/contracts";
import { graphitePullRequestUrl } from "@t3tools/shared/sourceControl";
import {
  type SourceControlDefinition,
  UNKNOWN_SOURCE_CONTROL_CLIENT,
} from "@t3tools/client-runtime/source-control-clients";

import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";
import { readLocalApi } from "~/localApi";

import { toastManager } from "../ui/toast";

export type PullRequestLinkContextMenuAction = "copy-link" | "open-external" | "open-graphite";

export const openOnHostLabel = (host: SourceControlDefinition): string =>
  host === UNKNOWN_SOURCE_CONTROL_CLIENT ? "Open on host" : `Open on ${host.label}`;

/**
 * Copy first: it is the reason to right-click a number rather than click it. Graphite follows the
 * host's own page, and only appears for a pull request it can show.
 */
export function pullRequestLinkContextMenuItems(
  openLabel: string,
  graphiteUrl: string | null,
  preferGraphite = false,
): readonly ContextMenuItem<PullRequestLinkContextMenuAction>[] {
  return [
    { id: "copy-link", label: "Copy link", icon: "copy" },
    ...(preferGraphite && graphiteUrl !== null
      ? [{ id: "open-graphite" as const, label: "Open in Graphite" }]
      : [{ id: "open-external" as const, label: openLabel }]),
    ...(graphiteUrl === null
      ? []
      : preferGraphite
        ? [{ id: "open-external" as const, label: openLabel }]
        : [{ id: "open-graphite" as const, label: "Open in Graphite" }]),
  ];
}

export async function showPullRequestLinkContextMenu({
  url,
  openLabel,
  preferGraphite = false,
  position,
}: {
  readonly url: string;
  readonly openLabel: string;
  readonly preferGraphite?: boolean;
  readonly position: { readonly x: number; readonly y: number };
}): Promise<void> {
  const api = readLocalApi();
  if (!api) return;
  const graphiteUrl = graphitePullRequestUrl(url);
  let action: PullRequestLinkContextMenuAction | null = null;
  try {
    action = await api.contextMenu.show(
      pullRequestLinkContextMenuItems(openLabel, graphiteUrl, preferGraphite),
      position,
    );
  } catch {
    return;
  }
  try {
    if (action === "copy-link") {
      await writeTextToClipboard(
        preferGraphite && graphiteUrl !== null ? graphiteUrl : url,
        "link",
      );
    } else if (action === "open-external") await api.shell.openExternal(url);
    else if (action === "open-graphite" && graphiteUrl !== null) {
      await api.shell.openExternal(graphiteUrl);
    }
  } catch {
    toastManager.add({
      type: "error",
      title: action === "copy-link" ? "Could not copy the link" : "Could not open the link",
    });
  }
}
