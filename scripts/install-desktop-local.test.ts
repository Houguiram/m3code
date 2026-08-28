import { assert, describe, it } from "@effect/vitest";

import { findDesktopDevProcesses } from "./install-desktop-local.ts";

describe("install-desktop-local", () => {
  it("finds only desktop development processes from this repository", () => {
    const root = "/Users/example/m3code";
    const processes = [
      `101 node ${root}/scripts/dev-runner.ts dev:desktop`,
      `102 ${root}/apps/desktop/.electron-runtime/M3 Code (Dev).app/Contents/MacOS/Electron`,
      `103 node ${root}/node_modules/.bin/vp pack --watch`,
      `104 /Applications/M3 Code (Alpha).app/Contents/MacOS/M3 Code (Alpha)`,
      "105 node /Users/example/other/scripts/dev-runner.ts dev:desktop",
    ].join("\n");

    assert.deepEqual(findDesktopDevProcesses(processes, root), [
      `101 node ${root}/scripts/dev-runner.ts dev:desktop`,
      `102 ${root}/apps/desktop/.electron-runtime/M3 Code (Dev).app/Contents/MacOS/Electron`,
      `103 node ${root}/node_modules/.bin/vp pack --watch`,
    ]);
  });
});
