import type {
  ProviderSkillsListInput,
  ProviderSkillsListResult,
  ServerProviderSkill,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProviderInstanceRegistry from "./ProviderInstanceRegistry.ts";

const providerSnapshotResult = (
  skills: ReadonlyArray<ServerProviderSkill>,
): ProviderSkillsListResult => ({
  source: "providerSnapshot",
  skills,
});

export const queryProviderSkills = Effect.fn("queryProviderSkills")(function* (
  input: ProviderSkillsListInput,
): Effect.fn.Return<
  ProviderSkillsListResult,
  never,
  | ProjectStore.ProjectStoreV2
  | ProjectionStore.ProjectionStoreV2
  | ProviderInstanceRegistry.ProviderInstanceRegistry
> {
  const providerRegistry = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const projects = yield* ProjectStore.ProjectStoreV2;
  const threads = yield* ProjectionStore.ProjectionStoreV2;
  const instance = yield* providerRegistry.getInstance(input.instanceId);
  if (!instance) {
    return providerSnapshotResult([]);
  }
  const fallbackSkills = (yield* instance.snapshot.getSnapshot).skills;
  const snapshotForCwd = instance.snapshotForCwd;
  const listSkillsForCwd =
    instance.listSkillsForCwd ??
    (snapshotForCwd
      ? (cwd: string) =>
          snapshotForCwd(cwd).pipe(
            Effect.map((snapshot) => Option.some(snapshot.skills)),
            Effect.orElseSucceed(() => Option.none()),
          )
      : undefined);
  if (!listSkillsForCwd) {
    return providerSnapshotResult(fallbackSkills);
  }

  const project = yield* projects
    .getShell(input.projectId)
    .pipe(Effect.orElseSucceed(() => Option.none()));
  if (Option.isNone(project)) {
    return providerSnapshotResult(fallbackSkills);
  }

  let cwd = project.value.workspaceRoot;
  if (input.threadId) {
    const thread = yield* threads
      .getThreadShell(input.threadId)
      .pipe(Effect.orElseSucceed(() => null));
    if (thread !== null && thread.projectId === input.projectId) {
      cwd = thread.worktreePath ?? cwd;
    }
  }

  const skills = yield* listSkillsForCwd(cwd);
  if (Option.isNone(skills)) {
    return providerSnapshotResult(fallbackSkills);
  }
  return {
    source: "workspace",
    skills: skills.value,
  };
});
