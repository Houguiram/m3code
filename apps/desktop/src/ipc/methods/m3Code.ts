import {
  M3CodeCheckoutCandidatePathsSchema,
  M3CodeCheckoutResultSchema,
  M3CodeOpenLoginTerminalInputSchema,
  M3CodeOpenLoginTerminalResultSchema,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import {
  createLiveM3CodeLocalInstallHost,
  openM3CodeLoginTerminal,
  resolvePrimaryM3CodeCheckout,
} from "../../source/M3CodeLocalInstall.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

const liveHost = Effect.fn("desktop.m3Code.liveHost")(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  return createLiveM3CodeLocalInstallHost({
    platform: environment.platform,
    homeDirectory: environment.homeDirectory,
  });
});

export const resolveM3CodeCheckout = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.RESOLVE_M3_CODE_CHECKOUT_CHANNEL,
  payload: M3CodeCheckoutCandidatePathsSchema,
  result: M3CodeCheckoutResultSchema,
  handler: Effect.fn("desktop.ipc.m3Code.resolveCheckout")(function* (input) {
    const host = yield* liveHost();
    const checkoutPath = yield* Effect.tryPromise(() =>
      resolvePrimaryM3CodeCheckout(host, input.candidatePaths),
    );
    return { checkoutPath };
  }),
});

export const openM3CodeLoginTerminalMethod = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.OPEN_M3_CODE_LOGIN_TERMINAL_CHANNEL,
  payload: M3CodeOpenLoginTerminalInputSchema,
  result: M3CodeOpenLoginTerminalResultSchema,
  handler: Effect.fn("desktop.ipc.m3Code.openLoginTerminal")(function* (input) {
    const host = yield* liveHost();
    return yield* Effect.tryPromise(() =>
      openM3CodeLoginTerminal({
        host,
        command: input.command,
        cwd: input.cwd,
        candidatePaths: input.candidatePaths,
      }),
    );
  }),
});
