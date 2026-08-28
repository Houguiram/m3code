import { assert, describe, it } from "@effect/vitest";

import {
  appleScriptForLoginTerminalCommand,
  isLinkedM3CodeWorktreePath,
  openM3CodeLoginTerminal,
  parsePrimaryWorktreePath,
  posixSingleQuote,
  resolvePrimaryM3CodeCheckout,
  type M3CodeLocalInstallHost,
} from "./M3CodeLocalInstall.ts";

function makeHost(
  options: {
    readonly platform?: NodeJS.Platform;
    readonly homeDirectory?: string;
    readonly files?: ReadonlySet<string>;
    readonly git?: Record<string, string>;
    readonly opened?: string[];
  } = {},
): M3CodeLocalInstallHost {
  const files = options.files ?? new Set();
  const git = options.git ?? {};
  const opened = options.opened ?? [];
  return {
    platform: options.platform ?? "darwin",
    homeDirectory: options.homeDirectory ?? "/Users/marin",
    joinPath: (...parts) => parts.join("/"),
    fileExists: async (path) => files.has(path),
    runGit: async (cwd, args) => git[`${cwd} ${args.join(" ")}`] ?? null,
    openTerminalScript: async (script) => {
      opened.push(script);
    },
  };
}

const installScript = (root: string) => `${root}/scripts/install-desktop-local.ts`;

describe("M3CodeLocalInstall", () => {
  it("parses the first worktree as the primary checkout", () => {
    assert.equal(
      parsePrimaryWorktreePath(
        [
          "worktree /Users/marin/m3code",
          "HEAD abc",
          "branch refs/heads/main",
          "",
          "worktree /Users/marin/.m3/worktrees/m3code/t3code-123",
          "HEAD def",
        ].join("\n"),
      ),
      "/Users/marin/m3code",
    );
  });

  it("quotes paths for a login Terminal window", () => {
    assert.equal(posixSingleQuote("/Users/marin/M3's Code"), `'/Users/marin/M3'\\''s Code'`);
    assert.include(
      appleScriptForLoginTerminalCommand(
        "/Users/marin/m3code",
        "gt sync && vp run install:desktop:local",
      ),
      `do script "cd '/Users/marin/m3code' && gt sync && vp run install:desktop:local"`,
    );
  });

  it("prefers ~/m3code over linked worktrees", async () => {
    const host = makeHost({
      files: new Set([
        installScript("/Users/marin/m3code"),
        installScript("/Users/marin/.m3/worktrees/m3code/t3code-123"),
      ]),
      git: {
        "/Users/marin/m3code rev-parse --show-toplevel": "/Users/marin/m3code\n",
        "/Users/marin/m3code worktree list --porcelain": "worktree /Users/marin/m3code\nHEAD abc\n",
      },
    });

    const checkout = await resolvePrimaryM3CodeCheckout(host, [
      "/Users/marin/.m3/worktrees/m3code/t3code-123",
    ]);
    assert.equal(checkout, "/Users/marin/m3code");
    assert.equal(isLinkedM3CodeWorktreePath("/Users/marin/.m3/worktrees/m3code/t3code-123"), true);
  });

  it("walks a linked worktree to the primary checkout", async () => {
    const worktree = "/Users/marin/.m3/worktrees/m3code/t3code-123";
    const primary = "/Users/marin/m3code";
    const files = new Set([installScript(primary), installScript(worktree)]);
    const porcelain = [
      `worktree ${primary}`,
      "HEAD abc",
      "",
      `worktree ${worktree}`,
      "HEAD def",
    ].join("\n");
    const host: M3CodeLocalInstallHost = {
      platform: "darwin",
      homeDirectory: "/Users/other",
      joinPath: (...parts) => parts.join("/"),
      fileExists: async (path) => files.has(path),
      runGit: async (cwd, args) => {
        const command = args.join(" ");
        if (cwd === worktree && command === "rev-parse --show-toplevel") return `${worktree}\n`;
        if (cwd === worktree && command === "worktree list --porcelain") return porcelain;
        return null;
      },
      openTerminalScript: async () => undefined,
    };

    const checkout = await resolvePrimaryM3CodeCheckout(host, [worktree]);
    assert.equal(checkout, primary);
  });

  it("opens Terminal for a rebuild from main", async () => {
    const opened: string[] = [];
    const host = makeHost({
      files: new Set([installScript("/Users/marin/m3code")]),
      git: {
        "/Users/marin/m3code rev-parse --show-toplevel": "/Users/marin/m3code\n",
        "/Users/marin/m3code worktree list --porcelain": "worktree /Users/marin/m3code\n",
      },
      opened,
    });

    const result = await openM3CodeLoginTerminal({
      host,
      command: "rebuild-from-main",
      cwd: null,
      candidatePaths: [],
    });
    assert.equal(result.started, true);
    assert.equal(result.checkoutPath, "/Users/marin/m3code");
    assert.equal(opened.length, 1);
    assert.include(opened[0] ?? "", "gt sync && vp run install:desktop:local");
  });

  it("refuses to install outside macOS", async () => {
    const result = await openM3CodeLoginTerminal({
      host: makeHost({ platform: "linux" }),
      command: "install-local",
      cwd: "/Users/marin/m3code",
      candidatePaths: [],
    });
    assert.equal(result.started, false);
    assert.include(result.error ?? "", "macOS");
  });
});
