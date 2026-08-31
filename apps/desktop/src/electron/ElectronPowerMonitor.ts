import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";

import * as Electron from "electron";

export type ElectronThermalState = ReturnType<Electron.PowerMonitor["getCurrentThermalState"]>;
export type ElectronIdleState = ReturnType<Electron.PowerMonitor["getSystemIdleState"]>;

export class ElectronPowerMonitor extends Context.Service<
  ElectronPowerMonitor,
  {
    readonly getKeepAwakeState: Effect.Effect<boolean>;
    readonly setKeepAwake: (enabled: boolean, keepDisplayOn: boolean) => Effect.Effect<boolean>;
    readonly isOnBatteryPower: Effect.Effect<boolean>;
    readonly getSystemIdleTime: Effect.Effect<number>;
    readonly getSystemIdleState: (idleThresholdSeconds: number) => Effect.Effect<ElectronIdleState>;
    readonly getCurrentThermalState: Effect.Effect<ElectronThermalState>;
    readonly onSimpleEvent: (
      eventName: "lock-screen" | "unlock-screen" | "on-ac" | "on-battery" | "suspend" | "resume",
      listener: () => void,
    ) => Effect.Effect<void, never, Scope.Scope>;
    readonly onThermalStateChange: (
      listener: (state: ElectronThermalState) => void,
    ) => Effect.Effect<void, never, Scope.Scope>;
    readonly onSpeedLimitChange: (
      listener: (limit: number) => void,
    ) => Effect.Effect<void, never, Scope.Scope>;
  }
>()("@t3tools/desktop/electron/ElectronPowerMonitor") {}

const onSimpleEvent: ElectronPowerMonitor["Service"]["onSimpleEvent"] = (eventName, listener) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      Electron.powerMonitor.on(eventName as any, listener as any);
    }),
    () =>
      Effect.sync(() => {
        Electron.powerMonitor.removeListener(eventName as any, listener as any);
      }),
  ).pipe(Effect.asVoid);

const onThermalStateChange: ElectronPowerMonitor["Service"]["onThermalStateChange"] = (
  listener,
) => {
  const wrapped = (
    event: Electron.Event<Electron.PowerMonitorThermalStateChangeEventParams>,
  ): void => {
    listener(event.state);
  };
  return Effect.acquireRelease(
    Effect.sync(() => {
      Electron.powerMonitor.on("thermal-state-change", wrapped);
    }),
    () =>
      Effect.sync(() => {
        Electron.powerMonitor.removeListener("thermal-state-change", wrapped);
      }),
  ).pipe(Effect.asVoid);
};

const onSpeedLimitChange: ElectronPowerMonitor["Service"]["onSpeedLimitChange"] = (listener) => {
  const wrapped = (
    event: Electron.Event<Electron.PowerMonitorSpeedLimitChangeEventParams>,
  ): void => {
    listener(event.limit);
  };
  return Effect.acquireRelease(
    Effect.sync(() => {
      Electron.powerMonitor.on("speed-limit-change", wrapped);
    }),
    () =>
      Effect.sync(() => {
        Electron.powerMonitor.removeListener("speed-limit-change", wrapped);
      }),
  ).pipe(Effect.asVoid);
};

export const make = (() => {
  let keepAwakeBlockerId: number | null = null;
  let keepAwakeDisplayOn = false;

  const isKeepingAwake = () =>
    keepAwakeBlockerId !== null && Electron.powerSaveBlocker.isStarted(keepAwakeBlockerId);

  return ElectronPowerMonitor.of({
    getKeepAwakeState: Effect.sync(isKeepingAwake),
    setKeepAwake: (enabled, keepDisplayOn) =>
      Effect.sync(() => {
        const modeChanged = isKeepingAwake() && keepAwakeDisplayOn !== keepDisplayOn;
        if ((!enabled || modeChanged) && keepAwakeBlockerId !== null) {
          Electron.powerSaveBlocker.stop(keepAwakeBlockerId);
          keepAwakeBlockerId = null;
        }
        if (enabled && !isKeepingAwake()) {
          keepAwakeBlockerId = Electron.powerSaveBlocker.start(
            keepDisplayOn ? "prevent-display-sleep" : "prevent-app-suspension",
          );
          keepAwakeDisplayOn = keepDisplayOn;
        }
        return isKeepingAwake();
      }),
    isOnBatteryPower: Effect.sync(() => Electron.powerMonitor.isOnBatteryPower()),
    getSystemIdleTime: Effect.sync(() => Electron.powerMonitor.getSystemIdleTime()),
    getSystemIdleState: (idleThresholdSeconds) =>
      Effect.sync(() => Electron.powerMonitor.getSystemIdleState(idleThresholdSeconds)),
    getCurrentThermalState: Effect.sync(() => Electron.powerMonitor.getCurrentThermalState()),
    onSimpleEvent,
    onThermalStateChange,
    onSpeedLimitChange,
  });
})();

export const layer = Layer.succeed(ElectronPowerMonitor, make);
