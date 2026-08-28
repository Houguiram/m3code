import { describe, expect, it } from "vite-plus/test";

import { openOnHostLabel, pullRequestLinkContextMenuItems } from "./pullRequestLinkContextMenu";

describe("pull request link context menu", () => {
  it("offers the copy first and the host's own page after it", () => {
    expect(pullRequestLinkContextMenuItems("Open on GitHub", null)).toEqual([
      { id: "copy-link", label: "Copy link", icon: "copy" },
      { id: "open-external", label: "Open on GitHub" },
    ]);
  });

  it("offers Graphite last, and only for a pull request it can show", () => {
    expect(
      pullRequestLinkContextMenuItems(
        "Open on GitHub",
        "https://app.graphite.dev/github/pr/t3-oss/t3-code/42",
      ),
    ).toEqual([
      { id: "copy-link", label: "Copy link", icon: "copy" },
      { id: "open-external", label: "Open on GitHub" },
      { id: "open-graphite", label: "Open in Graphite" },
    ]);
  });

  it("makes Graphite primary while keeping GitHub available for configured projects", () => {
    expect(
      pullRequestLinkContextMenuItems(
        "Open on GitHub",
        "https://app.graphite.dev/github/pr/t3-oss/t3-code/42",
        true,
      ),
    ).toEqual([
      { id: "copy-link", label: "Copy link", icon: "copy" },
      { id: "open-graphite", label: "Open in Graphite" },
      { id: "open-external", label: "Open on GitHub" },
    ]);
  });

  it("names every host it knows, and says nothing false about one it does not", () => {
    expect(openOnHostLabel("github")).toBe("Open on GitHub");
    expect(openOnHostLabel("gitlab")).toBe("Open on GitLab");
    expect(openOnHostLabel("bitbucket")).toBe("Open on Bitbucket");
    expect(openOnHostLabel("azure-devops")).toBe("Open on Azure DevOps");
    expect(openOnHostLabel("something-else")).toBe("Open on host");
  });
});
