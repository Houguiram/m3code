import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

const { activeBlockers, isStartedMock, startMock, stopMock } = vi.hoisted(() => {
  const active = new Set<number>();
  let nextId = 1;
  return {
    activeBlockers: active,
    isStartedMock: vi.fn((id: number) => active.has(id)),
    startMock: vi.fn((_type: string) => {
      const id = nextId++;
      active.add(id);
      return id;
    }),
    stopMock: vi.fn((id: number) => {
      active.delete(id);
    }),
  };
});

vi.mock("electron", () => ({
  powerMonitor: {
    getCurrentThermalState: vi.fn(),
    getSystemIdleState: vi.fn(),
    getSystemIdleTime: vi.fn(),
    isOnBatteryPower: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  powerSaveBlocker: {
    isStarted: isStartedMock,
    start: startMock,
    stop: stopMock,
  },
}));

import * as ElectronPowerMonitor from "./ElectronPowerMonitor.ts";

describe("ElectronPowerMonitor", () => {
  it.effect("switches the active assertion when display sleep preference changes", () =>
    Effect.gen(function* () {
      const powerMonitor = yield* ElectronPowerMonitor.ElectronPowerMonitor;

      assert.isFalse(yield* powerMonitor.getKeepAwakeState);
      assert.isTrue(yield* powerMonitor.setKeepAwake(true, false));
      assert.isTrue(yield* powerMonitor.setKeepAwake(true, true));
      assert.isTrue(yield* powerMonitor.setKeepAwake(true, true));
      assert.isFalse(yield* powerMonitor.setKeepAwake(false, true));

      assert.deepEqual(startMock.mock.calls, [
        ["prevent-app-suspension"],
        ["prevent-display-sleep"],
      ]);
      assert.deepEqual(stopMock.mock.calls, [[1], [2]]);
      assert.equal(activeBlockers.size, 0);
    }).pipe(Effect.provide(ElectronPowerMonitor.layer)),
  );
});
