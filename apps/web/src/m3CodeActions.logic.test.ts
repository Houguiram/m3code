import { describe, expect, it } from "vite-plus/test";

import {
  getM3CodeRebuildConfirmationMessage,
  graphiteCreateCommand,
  localProjectWorkspaceRoots,
} from "./m3CodeActions.logic";

describe("m3CodeActions.logic", () => {
  it("wraps a Graphite commit message in a quoted heredoc", () => {
    expect(graphiteCreateCommand("feat(web): add M3 actions")).toBe(
      `gt create --message "$(cat <<'T3_GT_MSG'\nfeat(web): add M3 actions\nT3_GT_MSG\n)"`,
    );
  });

  it("avoids a heredoc delimiter that appears in the message", () => {
    expect(graphiteCreateCommand("T3_GT_MSG\nmore")).toContain("<<'T3_GT_MSG_1'");
  });

  it("collects local workspace roots for checkout discovery", () => {
    expect(
      localProjectWorkspaceRoots(
        [
          { environmentId: "primary", workspaceRoot: "/Users/marin/m3code" },
          { environmentId: "ssh:host", workspaceRoot: "/remote/m3code" },
        ],
        "primary",
      ),
    ).toEqual(["/Users/marin/m3code"]);
  });

  it("names the primary checkout in the rebuild confirmation", () => {
    expect(getM3CodeRebuildConfirmationMessage("/Users/marin/m3code")).toContain(
      "/Users/marin/m3code",
    );
  });
});
