/**
 * CodexBarQuotaService - remaining subscription limits via the local CLI.
 *
 * Personal-fork path: exec `codexbar usage` rather than scrape cookies or
 * call unofficial provider APIs directly. Missing CLI, timeouts, and parse
 * failures return an unavailable snapshot instead of failing the RPC.
 *
 * @module CodexBarQuotaService
 */
import { type QuotaAccount, type QuotaSnapshot, type ServerProvider } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { bindQuotaInstances, quotaProviderForDriver } from "@t3tools/shared/quotaMatch";
import { isCommandMissingCause, spawnAndCollect } from "../provider/providerSnapshot.ts";
import * as ServerSettings from "../serverSettings.ts";
import { mergeQuotaAccounts, parseCodexBarUsageJson } from "./codexBarUsage.ts";

const CLI_TIMEOUT_MS = 45_000;
const ACCOUNT_CACHE_MS = 90_000;
const STALE_AFTER_SECONDS = 180;
const CODEXBAR_BINARIES = [
  "codexbar",
  "/opt/homebrew/bin/codexbar",
  "/usr/local/bin/codexbar",
] as const;

const EMPTY_SNAPSHOT = (readAt: string, message: string): QuotaSnapshot => ({
  available: false,
  readAt,
  staleAfterSeconds: STALE_AFTER_SECONDS,
  message,
  accounts: [],
  instances: [],
});

type CliLaunch =
  | { readonly _tag: "ok"; readonly stdout: string }
  | { readonly _tag: "missing" }
  | { readonly _tag: "failed" };

interface CachedAccounts {
  readonly fetchedAtMs: number;
  readonly accounts: readonly QuotaAccount[];
  readonly cliMissing: boolean;
}

export class CodexBarQuotaService extends Context.Service<
  CodexBarQuotaService,
  {
    readonly readSnapshot: (
      providers: ReadonlyArray<ServerProvider>,
    ) => Effect.Effect<QuotaSnapshot>;
  }
>()("t3/usage/CodexBarQuotaService") {}

export const layerTest = Layer.succeed(
  CodexBarQuotaService,
  CodexBarQuotaService.of({
    readSnapshot: (_providers) =>
      Effect.succeed(
        EMPTY_SNAPSHOT("1970-01-01T00:00:00.000Z", "CodexBar quota is disabled in tests."),
      ),
  }),
);

const runCodexBar = Effect.fn("CodexBarQuotaService.runCodexBar")(function* (
  args: ReadonlyArray<string>,
): Effect.fn.Return<CliLaunch, never, ChildProcessSpawner.ChildProcessSpawner> {
  for (const binaryPath of CODEXBAR_BINARIES) {
    const result = yield* spawnAndCollect(
      binaryPath,
      ChildProcess.make(binaryPath, [...args]),
    ).pipe(Effect.timeoutOption(CLI_TIMEOUT_MS), Effect.result);
    if (Result.isFailure(result)) {
      if (!isCommandMissingCause(result.failure)) {
        return { _tag: "failed" } satisfies CliLaunch;
      }
      continue;
    }
    if (Option.isNone(result.success)) {
      return { _tag: "failed" } satisfies CliLaunch;
    }
    return { _tag: "ok", stdout: result.success.value.stdout } satisfies CliLaunch;
  }
  return { _tag: "missing" } satisfies CliLaunch;
});

const usageArgs = (provider: "claude" | "codex" | "cursor", allAccounts: boolean) => [
  "usage",
  "--provider",
  provider,
  ...(allAccounts ? (["--all-accounts"] as const) : []),
  "--format",
  "json",
  "--json-only",
];

const fetchProviderAccounts = Effect.fn("CodexBarQuotaService.fetchProviderAccounts")(function* (
  provider: "claude" | "codex" | "cursor",
  allAccounts: boolean,
): Effect.fn.Return<
  { readonly cliMissing: boolean; readonly accounts: readonly QuotaAccount[] },
  never,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const launched = yield* runCodexBar(usageArgs(provider, allAccounts));
  if (launched._tag !== "ok") {
    return { cliMissing: launched._tag === "missing", accounts: [] as readonly QuotaAccount[] };
  }
  return { cliMissing: false, accounts: parseCodexBarUsageJson(launched.stdout) };
});

const fetchAccounts = Effect.fn("CodexBarQuotaService.fetchAccounts")(
  function* (): Effect.fn.Return<
    { readonly cliMissing: boolean; readonly accounts: readonly QuotaAccount[] },
    never,
    ChildProcessSpawner.ChildProcessSpawner
  > {
    const version = yield* runCodexBar(["--version"]);
    if (version._tag === "missing") {
      return { cliMissing: true, accounts: [] as readonly QuotaAccount[] };
    }
    if (version._tag === "failed") {
      return { cliMissing: false, accounts: [] as readonly QuotaAccount[] };
    }

    const [codexAll, claude, cursor] = yield* Effect.all(
      [
        fetchProviderAccounts("codex", true),
        fetchProviderAccounts("claude", false),
        fetchProviderAccounts("cursor", false),
      ],
      { concurrency: "unbounded" },
    );
    const codex =
      codexAll.accounts.length > 0 ? codexAll : yield* fetchProviderAccounts("codex", false);

    return {
      cliMissing: false,
      accounts: mergeQuotaAccounts([codex.accounts, claude.accounts, cursor.accounts]),
    };
  },
);

export const layer = Layer.effect(
  CodexBarQuotaService,
  Effect.gen(function* () {
    const settingsService = yield* ServerSettings.ServerSettingsService;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const cacheRef = yield* Ref.make<CachedAccounts | null>(null);

    const loadAccounts = Effect.fn("CodexBarQuotaService.loadAccounts")(
      function* (): Effect.fn.Return<
        CachedAccounts,
        never,
        ChildProcessSpawner.ChildProcessSpawner
      > {
        const nowMs = yield* Clock.currentTimeMillis;
        const cached = yield* Ref.get(cacheRef);
        if (cached !== null && nowMs - cached.fetchedAtMs < ACCOUNT_CACHE_MS) {
          return cached;
        }

        const fetched = yield* fetchAccounts();
        const next: CachedAccounts = {
          fetchedAtMs: nowMs,
          accounts: fetched.accounts,
          cliMissing: fetched.cliMissing,
        };
        yield* Ref.set(cacheRef, next);
        return next;
      },
    );

    const readSnapshot = Effect.fn("CodexBarQuotaService.readSnapshot")(function* (
      providers: ReadonlyArray<ServerProvider>,
    ): Effect.fn.Return<QuotaSnapshot, never, ChildProcessSpawner.ChildProcessSpawner> {
      const readAt = DateTime.formatIso(yield* DateTime.now);
      const loaded = yield* loadAccounts();
      if (loaded.cliMissing) {
        return EMPTY_SNAPSHOT(
          readAt,
          "CodexBar CLI was not found. Install it from CodexBar → Preferences → Advanced.",
        );
      }
      if (loaded.accounts.length === 0) {
        return EMPTY_SNAPSHOT(readAt, "CodexBar returned no remaining-limit data.");
      }

      const settings = yield* settingsService.getSettings.pipe(
        Effect.catchCause(() => Effect.succeed(null)),
      );
      const instances = providers
        .filter((provider) => quotaProviderForDriver(provider.driver) !== null)
        .map((provider) => {
          const pin = settings?.providerInstances[provider.instanceId]?.codexBarAccount;
          return {
            instanceId: provider.instanceId,
            driver: provider.driver,
            email: provider.auth.email,
            ...(pin ? { pin } : {}),
          };
        });

      return {
        available: true,
        readAt,
        staleAfterSeconds: STALE_AFTER_SECONDS,
        message: null,
        accounts: [...loaded.accounts],
        instances: [...bindQuotaInstances(instances, loaded.accounts)],
      } satisfies QuotaSnapshot;
    });

    return CodexBarQuotaService.of({
      readSnapshot: (providers) =>
        readSnapshot(providers).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        ),
    });
  }),
);
