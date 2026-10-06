import { assert, it } from "@effect/vitest";
import {
  type ApplicationProjectEvent,
  EventId,
  ProjectId,
  ProviderInstanceId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ProjectStore from "./ProjectStore.ts";

it.layer(ProjectStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory)))(
  "ProjectStoreV2",
  (it) => {
    it.effect("stores a model selection without options as JSON without an options key", () =>
      Effect.gen(function* () {
        const projects = yield* ProjectStore.ProjectStoreV2;
        const sql = yield* SqlClient.SqlClient;
        const projectId = ProjectId.make("project-null-options");
        const modelSelection = { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" };
        yield* projects.apply({
          sequence: 1,
          eventId: EventId.make("event-null-options"),
          aggregateKind: "project",
          aggregateId: projectId,
          occurredAt: "2026-03-24T00:00:00.000Z",
          commandId: null,
          causationEventId: null,
          correlationId: null,
          metadata: {},
          type: "project.created",
          payload: {
            projectId,
            title: "Null options project",
            workspaceRoot: "/tmp/project-null-options",
            defaultModelSelection: modelSelection,
            scripts: [],
            createdAt: "2026-03-24T00:00:00.000Z",
            updatedAt: "2026-03-24T00:00:00.000Z",
          },
        });

        const rows = yield* sql<{ readonly defaultModelSelection: string | null }>`
          SELECT default_model_selection_json AS "defaultModelSelection"
          FROM projection_projects
          WHERE project_id = ${projectId}
        `;
        // @effect-diagnostics-next-line preferSchemaOverJson:off
        assert.strictEqual(rows[0]?.defaultModelSelection, JSON.stringify(modelSelection));
        assert.deepStrictEqual(
          Option.getOrNull(yield* projects.get(projectId))?.defaultModelSelection,
          modelSelection,
        );
      }),
    );
  },
);

it.effect("keeps Graphite settings through edits and permits clearing them", () =>
  Effect.gen(function* () {
    const projects = yield* ProjectStore.ProjectStoreV2;
    const projectId = ProjectId.make("graphite-project");
    const base = {
      sequence: 1,
      eventId: EventId.make("graphite-created"),
      aggregateKind: "project" as const,
      aggregateId: projectId,
      occurredAt: "2026-03-24T00:00:00.000Z",
      commandId: null,
      causationEventId: null,
      correlationId: null,
      metadata: {},
    };
    const apply = (event: ApplicationProjectEvent) => projects.apply(event);
    yield* apply({
      ...base,
      type: "project.created",
      payload: {
        projectId,
        title: "Graphite",
        workspaceRoot: "/tmp/graphite",
        defaultModelSelection: null,
        scripts: [],
        graphite: { mergeQueueLabel: "merge" },
        createdAt: base.occurredAt,
        updatedAt: base.occurredAt,
      },
    });
    yield* apply({
      ...base,
      sequence: 2,
      eventId: EventId.make("graphite-renamed"),
      type: "project.meta-updated",
      payload: {
        projectId,
        title: "Renamed",
        updatedAt: base.occurredAt,
      },
    });
    assert.deepStrictEqual(Option.getOrThrow(yield* projects.getShell(projectId)).graphite, {
      mergeQueueLabel: "merge",
    });
    yield* apply({
      ...base,
      sequence: 3,
      eventId: EventId.make("graphite-updated"),
      type: "project.meta-updated",
      payload: {
        projectId,
        graphite: { mergeQueueLabel: "queue" },
        updatedAt: base.occurredAt,
      },
    });
    assert.deepStrictEqual(Option.getOrThrow(yield* projects.getShell(projectId)).graphite, {
      mergeQueueLabel: "queue",
    });
    yield* apply({
      ...base,
      sequence: 4,
      eventId: EventId.make("graphite-cleared"),
      type: "project.meta-updated",
      payload: {
        projectId,
        graphite: null,
        updatedAt: base.occurredAt,
      },
    });
    assert.isNull(Option.getOrThrow(yield* projects.getShell(projectId)).graphite);
  }).pipe(
    Effect.provide(ProjectStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory))),
  ),
);
