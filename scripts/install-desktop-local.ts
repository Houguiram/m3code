#!/usr/bin/env node

// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off - Host-side macOS installation uses Node subprocess and timing APIs directly.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { HostProcessArchitecture, HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeProcess from "node:process";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import * as Effect from "effect/Effect";

const execFile = NodeUtil.promisify(NodeChildProcess.execFile);
const repoRoot = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const desktopPackagePath = NodePath.join(repoRoot, "apps/desktop/package.json");
const applicationId = "com.houguiram.m3code";
const applicationDirectory = "/Applications";
const quitTimeoutMs = 30_000;

type DesktopPackage = {
  readonly productName?: string;
  readonly version?: string;
};

async function run(
  command: string,
  args: ReadonlyArray<string>,
  options: { readonly allowFailure?: boolean; readonly cwd?: string } = {},
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  try {
    return await execFile(command, [...args], {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (options.allowFailure) {
      const result = error as { readonly stdout?: string; readonly stderr?: string };
      return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    }
    throw error;
  }
}

async function runInteractive(command: string, args: ReadonlyArray<string>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = NodeChildProcess.spawn(command, [...args], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} was terminated by ${signal}.`
            : `${command} exited with code ${String(code)}.`,
        ),
      );
    });
  });
}

async function readDesktopPackage(): Promise<Required<DesktopPackage>> {
  const manifest = JSON.parse(await NodeFSP.readFile(desktopPackagePath, "utf8")) as DesktopPackage;
  if (!manifest.productName || !manifest.version) {
    throw new Error(`${desktopPackagePath} must define productName and version.`);
  }
  return { productName: manifest.productName, version: manifest.version };
}

async function processList(): Promise<string> {
  return (await run("ps", ["-Ao", "pid=,args="])).stdout;
}

export function findDesktopDevProcesses(processes: string, root: string): ReadonlyArray<string> {
  return processes
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.includes(root) &&
        (line.includes("dev-runner.ts dev:desktop") ||
          line.includes("M3 Code (Dev).app") ||
          line.includes("vp pack --watch")),
    );
}

async function ensureDesktopDevStopped(): Promise<void> {
  const matches = findDesktopDevProcesses(await processList(), repoRoot);
  if (matches.length === 0) return;

  throw new Error(
    [
      "M3 Code desktop development is still running.",
      "Quit M3 Code (Dev) and stop its dev runner before installing:",
      ...matches.map((line) => `  ${line}`),
    ].join("\n"),
  );
}

async function isInstalledAppRunning(appPath: string): Promise<boolean> {
  const executablePrefix = `${appPath}/Contents/MacOS/`;
  return (await processList()).split("\n").some((line) => line.includes(executablePrefix));
}

async function waitForInstalledAppToQuit(appPath: string): Promise<void> {
  const deadline = Date.now() + quitTimeoutMs;
  while (await isInstalledAppRunning(appPath)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `M3 Code did not quit within ${quitTimeoutMs / 1_000} seconds. Quit it manually and rerun the command.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function quitInstalledApp(appPath: string): Promise<void> {
  if (!(await isInstalledAppRunning(appPath))) return;
  NodeProcess.stdout.write("Quitting the installed M3 Code app...\n");
  await run("osascript", ["-e", `tell application id "${applicationId}" to quit`]);
  await waitForInstalledAppToQuit(appPath);
}

async function ensureDatabaseReleased(): Promise<void> {
  const stateDatabase = NodePath.join(NodeOS.homedir(), ".m3/userdata/state.sqlite");
  const result = await run("lsof", [stateDatabase], { allowFailure: true });
  if (!result.stdout.trim()) return;
  throw new Error(
    `M3 Code is still using ${stateDatabase}. Quit the app normally and rerun the command.`,
  );
}

async function replaceApplication(sourceApp: string, destinationApp: string): Promise<void> {
  const productName = NodePath.basename(destinationApp, ".app");
  const stagingApp = NodePath.join(
    applicationDirectory,
    `.${productName}.app.install-${String(NodeProcess.pid)}`,
  );
  const backupApp = NodePath.join(
    applicationDirectory,
    `.${productName}.app.backup-${String(NodeProcess.pid)}`,
  );
  let movedExistingApp = false;

  await NodeFSP.rm(stagingApp, { force: true, recursive: true });
  await NodeFSP.rm(backupApp, { force: true, recursive: true });
  NodeProcess.stdout.write("Staging the new application...\n");
  await run("ditto", [sourceApp, stagingApp]);

  try {
    try {
      await NodeFSP.rename(destinationApp, backupApp);
      movedExistingApp = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }

    await NodeFSP.rename(stagingApp, destinationApp);
    await run("xattr", ["-dr", "com.apple.quarantine", destinationApp], { allowFailure: true });
    await run("open", [destinationApp]);
    if (movedExistingApp) {
      await NodeFSP.rm(backupApp, { force: true, recursive: true });
    }
  } catch (error) {
    await NodeFSP.rm(stagingApp, { force: true, recursive: true });
    if (movedExistingApp) {
      await NodeFSP.rm(destinationApp, { force: true, recursive: true });
      await NodeFSP.rename(backupApp, destinationApp);
    }
    throw error;
  }
}

async function main(
  hostPlatform: NodeJS.Platform,
  hostArchitecture: NodeJS.Architecture,
): Promise<void> {
  if (hostPlatform !== "darwin") {
    throw new Error("Local desktop installation is only supported on macOS.");
  }
  if (hostArchitecture !== "arm64" && hostArchitecture !== "x64") {
    throw new Error(`Unsupported macOS architecture: ${hostArchitecture}.`);
  }

  await ensureDesktopDevStopped();
  const desktopPackage = await readDesktopPackage();
  const archiveName = `M3-Code-${desktopPackage.version}-${hostArchitecture}.zip`;
  const archivePath = NodePath.join(repoRoot, "release", archiveName);
  const destinationApp = NodePath.join(applicationDirectory, `${desktopPackage.productName}.app`);

  NodeProcess.stdout.write(
    `Building M3 Code ${desktopPackage.version} for ${hostArchitecture}...\n`,
  );
  await runInteractive("vp", [
    "run",
    "dist:desktop:artifact",
    "--platform",
    "mac",
    "--target",
    "zip",
    "--arch",
    hostArchitecture,
  ]);

  const temporaryDirectory = await NodeFSP.mkdtemp(
    NodePath.join(NodeOS.tmpdir(), "m3code-local-install-"),
  );
  try {
    NodeProcess.stdout.write(`Extracting ${archiveName}...\n`);
    await run("ditto", ["-x", "-k", archivePath, temporaryDirectory]);
    const sourceApp = NodePath.join(temporaryDirectory, `${desktopPackage.productName}.app`);
    await NodeFSP.access(sourceApp);

    await quitInstalledApp(destinationApp);
    await ensureDatabaseReleased();
    await replaceApplication(sourceApp, destinationApp);
  } finally {
    await NodeFSP.rm(temporaryDirectory, { force: true, recursive: true });
  }

  NodeProcess.stdout.write(
    `Installed and relaunched ${desktopPackage.productName} ${desktopPackage.version}.\n`,
  );
}

if (import.meta.main) {
  Effect.gen(function* () {
    const hostPlatform = yield* HostProcessPlatform;
    const hostArchitecture = yield* HostProcessArchitecture;
    yield* Effect.tryPromise(() => main(hostPlatform, hostArchitecture));
  }).pipe(NodeRuntime.runMain);
}
