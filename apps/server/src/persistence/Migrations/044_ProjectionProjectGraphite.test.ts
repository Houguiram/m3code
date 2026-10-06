import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layer({ filename: ":memory:" })));

layer("044_ProjectionProjectGraphite", (it) => {
  it.effect("adds nullable Graphite configuration to project projections", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 43 });
      yield* runMigrations({ toMigrationInclusive: 44 });

      const columns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        PRAGMA table_info(projection_projects)
      `;
      const graphite = columns.find((column) => column.name === "graphite_json");

      assert.equal(graphite?.name, "graphite_json");
      assert.equal(graphite?.notnull, 0);
    }),
  );
  it.effect("preserves existing Graphite configuration when upgrading to V2", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 55 });
      yield* sql`INSERT INTO projection_projects
        (project_id, title, workspace_root, default_model_selection_json, scripts_json, created_at, updated_at, graphite_json)
        VALUES ('legacy-m3', 'M3', '/tmp/m3', NULL, '[]', '2026-03-24T00:00:00.000Z', '2026-03-24T00:00:00.000Z', '{"mergeQueueLabel":"merge"}')`;
      yield* runMigrations();
      const rows = yield* sql<{
        readonly graphite_json: string;
      }>`SELECT graphite_json FROM projection_projects WHERE project_id = 'legacy-m3'`;
      assert.equal(rows[0]?.graphite_json, '{"mergeQueueLabel":"merge"}');
    }),
  );
});
