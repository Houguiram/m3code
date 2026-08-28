import type { M3CodeOpenLoginTerminalResult } from "@t3tools/contracts";

// @effect-diagnostics nodeBuiltinImport:off - Host-side macOS Terminal launch uses Node subprocess APIs directly.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

const execFile = NodeUtil.promisify(NodeChildProcess.execFile);

export const M3_CODE_INSTALL_SCRIPT_RELATIVE = "scripts/install-desktop-local.ts";
export const M3_CODE_INSTALL_LOCAL_COMMAND = "vp run install:desktop:local";
export const M3_CODE_REBUILD_FROM_MAIN_COMMAND = `gt sync && ${M3_CODE_INSTALL_LOCAL_COMMAND}`;

export interface M3CodeLocalInstallHost {
  readonly platform: NodeJS.Platform;
  readonly homeDirectory: string;
  readonly fileExists: (path: string) => Promise<boolean>;
  readonly runGit: (cwd: string, args: ReadonlyArray<string>) => Promise<string | null>;
  readonly openTerminalScript: (appleScript: string) => Promise<void>;
  readonly joinPath: (...parts: string[]) => string;
}

export function posixSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function appleScriptStringLiteral(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function appleScriptForLoginTerminalCommand(cwd: string, command: string): string {
  const shell = `cd ${posixSingleQuote(cwd)} && ${command}`;
  return [
    'tell application "Terminal"',
    "  activate",
    `  do script ${appleScriptStringLiteral(shell)}`,
    "end tell",
  ].join("\n");
}

export function parsePrimaryWorktreePath(porcelain: string): string | null {
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      const path = line.slice("worktree ".length).trim();
      return path.length > 0 ? path : null;
    }
  }
  return null;
}

export function isLinkedM3CodeWorktreePath(path: string): boolean {
  return path.replaceAll("\\", "/").includes("/.m3/worktrees/");
}

async function isM3CodeCheckout(host: M3CodeLocalInstallHost, cwd: string): Promise<boolean> {
  return host.fileExists(host.joinPath(cwd, M3_CODE_INSTALL_SCRIPT_RELATIVE));
}

async function resolveRepoRoot(host: M3CodeLocalInstallHost, cwd: string): Promise<string | null> {
  const topLevel = await host.runGit(cwd, ["rev-parse", "--show-toplevel"]);
  const root = topLevel?.trim() || cwd;
  return (await isM3CodeCheckout(host, root)) ? root : null;
}

async function resolveMainCheckout(
  host: M3CodeLocalInstallHost,
  repoRoot: string,
): Promise<string | null> {
  const porcelain = await host.runGit(repoRoot, ["worktree", "list", "--porcelain"]);
  if (porcelain !== null) {
    const primary = parsePrimaryWorktreePath(porcelain);
    if (
      primary &&
      !isLinkedM3CodeWorktreePath(primary) &&
      (await isM3CodeCheckout(host, primary))
    ) {
      return primary;
    }
  }
  if (!isLinkedM3CodeWorktreePath(repoRoot)) {
    return repoRoot;
  }
  return null;
}

export async function resolvePrimaryM3CodeCheckout(
  host: M3CodeLocalInstallHost,
  candidatePaths: ReadonlyArray<string>,
): Promise<string | null> {
  const seen = new Set<string>();
  const candidates = [host.joinPath(host.homeDirectory, "m3code"), ...candidatePaths];

  for (const raw of candidates) {
    const cwd = raw.trim();
    if (cwd.length === 0 || seen.has(cwd)) continue;
    seen.add(cwd);

    const repoRoot = await resolveRepoRoot(host, cwd);
    if (repoRoot === null) continue;
    const main = await resolveMainCheckout(host, repoRoot);
    if (main !== null) return main;
  }

  return null;
}

export async function openM3CodeLoginTerminal(input: {
  readonly host: M3CodeLocalInstallHost;
  readonly command: "install-local" | "rebuild-from-main";
  readonly cwd: string | null;
  readonly candidatePaths: ReadonlyArray<string>;
}): Promise<M3CodeOpenLoginTerminalResult> {
  if (input.host.platform !== "darwin") {
    return {
      started: false,
      checkoutPath: null,
      error: "Local desktop installation is only supported on macOS.",
    };
  }

  const checkoutPath =
    input.command === "rebuild-from-main"
      ? await resolvePrimaryM3CodeCheckout(input.host, [
          ...(input.cwd === null ? [] : [input.cwd]),
          ...input.candidatePaths,
        ])
      : input.cwd;

  if (checkoutPath === null || checkoutPath.trim().length === 0) {
    return {
      started: false,
      checkoutPath: null,
      error: "Could not find the M3 Code checkout.",
    };
  }

  if (!(await isM3CodeCheckout(input.host, checkoutPath))) {
    return {
      started: false,
      checkoutPath,
      error: `No local desktop installer at ${checkoutPath}.`,
    };
  }

  const command =
    input.command === "rebuild-from-main"
      ? M3_CODE_REBUILD_FROM_MAIN_COMMAND
      : M3_CODE_INSTALL_LOCAL_COMMAND;

  try {
    await input.host.openTerminalScript(appleScriptForLoginTerminalCommand(checkoutPath, command));
  } catch (error) {
    return {
      started: false,
      checkoutPath,
      error: error instanceof Error ? error.message : "Failed to open Terminal.",
    };
  }

  return { started: true, checkoutPath, error: null };
}

export function createLiveM3CodeLocalInstallHost(input: {
  readonly platform: NodeJS.Platform;
  readonly homeDirectory: string;
}): M3CodeLocalInstallHost {
  return {
    platform: input.platform,
    homeDirectory: input.homeDirectory,
    joinPath: NodePath.join,
    fileExists: async (path) => {
      try {
        await NodeFSP.access(path);
        return true;
      } catch {
        return false;
      }
    },
    runGit: async (cwd, args) => {
      try {
        const result = await execFile("git", [...args], {
          cwd,
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        });
        return result.stdout;
      } catch {
        return null;
      }
    },
    openTerminalScript: async (appleScript) => {
      await new Promise<void>((resolve, reject) => {
        const child = NodeChildProcess.spawn("osascript", ["-e", appleScript], {
          detached: true,
          stdio: "ignore",
        });
        child.once("error", reject);
        child.once("close", (code, signal) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(
            new Error(
              signal === null
                ? `osascript exited with status ${String(code)}.`
                : `osascript exited from signal ${signal}.`,
            ),
          );
        });
      });
    },
  };
}
