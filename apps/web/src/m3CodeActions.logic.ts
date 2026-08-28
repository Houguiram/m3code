const HEREDOC_BASE = "T3_GT_MSG";

export function graphiteCreateCommand(message: string): string {
  let delimiter = HEREDOC_BASE;
  let suffix = 0;
  while (message.split("\n").includes(delimiter)) {
    suffix += 1;
    delimiter = `${HEREDOC_BASE}_${suffix}`;
  }
  return `gt create --message "$(cat <<'${delimiter}'\n${message}\n${delimiter}\n)"`;
}

export const M3_CODE_GRAPHITE_SYNC_COMMAND = "gt sync";
export const M3_CODE_GRAPHITE_SUBMIT_COMMAND = "gt submit";
export const M3_CODE_DESKTOP_DEV_COMMAND = "vp run dev:desktop";
export const M3_CODE_INSTALL_LOCAL_COMMAND = "vp run install:desktop:local";

export function getM3CodeRebuildConfirmationMessage(checkoutPath: string): string {
  return `Sync ${checkoutPath} with main and rebuild the installed M3 Code app?\n\nTerminal will run \`gt sync && vp run install:desktop:local\`. The app will quit and relaunch when the build finishes.`;
}

export function getM3CodeInstallCwdConfirmationMessage(cwd: string): string {
  return `Install this tree as the local M3 Code app?\n\n${cwd}\n\nThe installed app will quit and relaunch. Stop desktop development first if it is running.`;
}

export function localProjectWorkspaceRoots(
  projects: ReadonlyArray<{
    readonly environmentId: string;
    readonly workspaceRoot: string;
  }>,
  primaryEnvironmentId: string | null,
): ReadonlyArray<string> {
  return projects
    .filter(
      (project) =>
        project.environmentId === "primary" ||
        (primaryEnvironmentId !== null && project.environmentId === primaryEnvironmentId),
    )
    .map((project) => project.workspaceRoot);
}
