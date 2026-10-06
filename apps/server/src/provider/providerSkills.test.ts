import {
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationProjectShell,
  type ServerProvider,
  type ServerProviderSkill,
} from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import type { ProviderInstance } from "./ProviderDriver.ts";
import * as ProviderInstanceRegistry from "./ProviderInstanceRegistry.ts";
import { makeManualOnlyProviderMaintenanceCapabilities } from "./providerMaintenance.ts";
import { queryProviderSkills } from "./providerSkills.ts";

const instanceId = ProviderInstanceId.make("claude-work");
const projectId = ProjectId.make("project-1");
const threadId = ThreadId.make("thread-1");
const driverKind = ProviderDriverKind.make("claudeAgent");
const now = "2026-08-28T00:00:00.000Z";

const fallbackSkill: ServerProviderSkill = {
  name: "global-skill",
  path: "/home/ishan/.claude/skills/global-skill/SKILL.md",
  enabled: true,
  scope: "user",
};

const workspaceSkill: ServerProviderSkill = {
  name: "workspace-skill",
  path: "/worktrees/feature/.claude/skills/workspace-skill/SKILL.md",
  enabled: true,
  scope: "project",
};

const project = {
  id: projectId,
  title: "T3 Code",
  workspaceRoot: "/projects/t3code",
  repositoryIdentity: null,
  defaultModelSelection: null,
  scripts: [],
  createdAt: now,
  updatedAt: now,
} satisfies OrchestrationProjectShell;

function makeLayer(input: {
  readonly loadSkills?: ProviderInstance["listSkillsForCwd"];
  readonly snapshotForCwd?: ProviderInstance["snapshotForCwd"];
  readonly threadProjectId?: ProjectId;
  readonly worktreePath?: string | null;
}) {
  const snapshot = {
    instanceId,
    driver: driverKind,
    status: "ready",
    enabled: true,
    installed: true,
    auth: { status: "authenticated" },
    checkedAt: now,
    version: "1.0.0",
    models: [],
    slashCommands: [],
    skills: [fallbackSkill],
  } satisfies ServerProvider;
  const instance = {
    instanceId,
    driverKind,
    continuationIdentity: {
      driverKind,
      continuationKey: `${driverKind}:instance:${instanceId}`,
    },
    displayName: undefined,
    enabled: true,
    snapshot: {
      resolveMaintenance: () =>
        Effect.succeed(
          makeManualOnlyProviderMaintenanceCapabilities({
            provider: driverKind,
            packageName: null,
          }),
        ),
      getSnapshot: Effect.succeed(snapshot),
      refresh: Effect.succeed(snapshot),
      streamChanges: Stream.empty,
      applyUsageLimits: () => Effect.void,
    },
    ...(input.loadSkills ? { listSkillsForCwd: input.loadSkills } : {}),
    ...(input.snapshotForCwd ? { snapshotForCwd: input.snapshotForCwd } : {}),
    orchestrationAdapter: {} as ProviderInstance["orchestrationAdapter"],
    textGeneration: {} as ProviderInstance["textGeneration"],
  } satisfies ProviderInstance;

  return Layer.mergeAll(
    Layer.mock(ProviderInstanceRegistry.ProviderInstanceRegistry)({
      getInstance: () => Effect.succeed(instance),
    }),
    Layer.mock(ProjectStore.ProjectStoreV2)({
      getShell: () => Effect.succeed(Option.some(project)),
    }),
    Layer.mock(ProjectionStore.ProjectionStoreV2)({
      getThreadShell: () =>
        Effect.succeed({
          projectId: input.threadProjectId ?? projectId,
          worktreePath:
            input.worktreePath === undefined ? "/worktrees/feature" : input.worktreePath,
        } as NonNullable<
          Effect.Success<ReturnType<ProjectionStore.ProjectionStoreV2["Service"]["getThreadShell"]>>
        >),
    }),
  );
}

it.effect("discovers skills from the thread worktree", () =>
  Effect.gen(function* () {
    let discoveredCwd: string | undefined;
    const result = yield* queryProviderSkills({ instanceId, projectId, threadId }).pipe(
      Effect.provide(
        makeLayer({
          loadSkills: (cwd) => {
            discoveredCwd = cwd;
            return Effect.succeed(Option.some([workspaceSkill]));
          },
        }),
      ),
    );

    assert.strictEqual(discoveredCwd, "/worktrees/feature");
    assert.deepStrictEqual(result, { source: "workspace", skills: [workspaceSkill] });
  }),
);

it.effect("uses the project root when the supplied thread belongs to another project", () =>
  Effect.gen(function* () {
    let discoveredCwd: string | undefined;
    const result = yield* queryProviderSkills({ instanceId, projectId, threadId }).pipe(
      Effect.provide(
        makeLayer({
          threadProjectId: ProjectId.make("project-2"),
          loadSkills: (cwd) => {
            discoveredCwd = cwd;
            return Effect.succeed(Option.some([]));
          },
        }),
      ),
    );

    assert.strictEqual(discoveredCwd, "/projects/t3code");
    assert.deepStrictEqual(result, { source: "workspace", skills: [] });
  }),
);

it.effect("preserves the provider snapshot when scoped discovery fails", () =>
  Effect.gen(function* () {
    const result = yield* queryProviderSkills({ instanceId, projectId, threadId }).pipe(
      Effect.provide(
        makeLayer({
          loadSkills: () => Effect.succeed(Option.none()),
        }),
      ),
    );

    assert.deepStrictEqual(result, {
      source: "providerSnapshot",
      skills: [fallbackSkill],
    });
  }),
);

it.effect("uses workspace snapshots for providers without a separate skills loader", () =>
  Effect.gen(function* () {
    let discoveredCwd: string | undefined;
    const baseLayer = makeLayer({});
    const registry = yield* ProviderInstanceRegistry.ProviderInstanceRegistry.pipe(
      Effect.provide(baseLayer),
    );
    const instance = yield* registry.getInstance(instanceId);
    assert.ok(instance);
    const snapshot = yield* instance.snapshot.getSnapshot;
    const result = yield* queryProviderSkills({ instanceId, projectId, threadId }).pipe(
      Effect.provide(
        makeLayer({
          snapshotForCwd: (cwd) => {
            discoveredCwd = cwd;
            return Effect.succeed({ ...snapshot, skills: [workspaceSkill] });
          },
        }),
      ),
    );
    assert.strictEqual(discoveredCwd, "/worktrees/feature");
    assert.deepStrictEqual(result, { source: "workspace", skills: [workspaceSkill] });
  }),
);
