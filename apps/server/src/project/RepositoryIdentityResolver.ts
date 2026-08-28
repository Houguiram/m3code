import type { RepositoryIdentity } from "@t3tools/contracts";
import {
  detectSourceControlProviderFromGitRemoteUrl,
  normalizeGitRemoteUrl,
} from "@t3tools/shared/git";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import * as ProcessRunner from "../processRunner.ts";

const DEFAULT_REPOSITORY_IDENTITY_CACHE_CAPACITY = 512;
const DEFAULT_POSITIVE_CACHE_TTL = Duration.minutes(1);
const DEFAULT_NEGATIVE_CACHE_TTL = Duration.minutes(1);

export interface RepositoryIdentityResolverOptions {
  readonly cacheCapacity?: number;
  readonly positiveCacheTtl?: Duration.Input;
  readonly negativeCacheTtl?: Duration.Input;
}

export class RepositoryIdentityResolver extends Context.Service<
  RepositoryIdentityResolver,
  {
    readonly resolve: (cwd: string) => Effect.Effect<RepositoryIdentity | null>;
  }
>()("t3/project/RepositoryIdentityResolver") {}

function parseRemoteFetchUrls(stdout: string): Map<string, string> {
  const remotes = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(trimmed);
    if (!match) continue;
    const [, remoteName = "", remoteUrl = "", direction = ""] = match;
    if (direction !== "fetch" || remoteName.length === 0 || remoteUrl.length === 0) {
      continue;
    }
    remotes.set(remoteName, remoteUrl);
  }
  return remotes;
}

/** `remote.<name>.gh-resolved` lines, keyed by remote, as `git config --get-regexp` prints them. */
function parseBaseRepositoryDeclarations(stdout: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const match = /^remote\.(.+)\.gh-resolved\s+(\S+)$/.exec(line.trim());
    const [, remoteName = "", declaration = ""] = match ?? [];
    if (remoteName.length > 0 && declaration.length > 0) {
      declarations.set(remoteName, declaration);
    }
  }
  return declarations;
}

/**
 * The remote holding the repository this checkout's change requests live in, where the checkout
 * says which one that is. `gh repo set-default` records it per remote as `gh-resolved`: `base`
 * means that remote's own repository, and any other value names the repository outright, which is
 * the parent when a fork defaults to its upstream.
 *
 * A fork is either shape — a contributor pushes to their fork and opens change requests against
 * the parent, while a maintained fork opens them against itself — and only this declaration tells
 * them apart. The CLIs resolve a bare change request against the same declaration, so honouring it
 * keeps the repository this identity names and the repository a change request's own URL names as
 * one repository rather than two.
 */
function pickDeclaredBaseRemote(
  remotes: ReadonlyMap<string, string>,
  baseDeclarations: ReadonlyMap<string, string>,
): string | null {
  const canonicalKeys = new Map(
    [...remotes].map(([remoteName, remoteUrl]) => [remoteName, normalizeGitRemoteUrl(remoteUrl)]),
  );
  for (const [remoteName, declaration] of baseDeclarations) {
    if (!remotes.has(remoteName)) continue;
    if (declaration === "base") return remoteName;
    const declaredKey = normalizeGitRemoteUrl(declaration);
    const declaredRemote = [...canonicalKeys].find(([, key]) => key === declaredKey)?.[0];
    if (declaredRemote !== undefined) return declaredRemote;
  }
  return null;
}

function pickPrimaryRemote(
  remotes: ReadonlyMap<string, string>,
  baseDeclarations: ReadonlyMap<string, string>,
): { readonly remoteName: string; readonly remoteUrl: string } | null {
  const preferredRemoteNames = [
    pickDeclaredBaseRemote(remotes, baseDeclarations),
    "upstream",
    "origin",
  ].filter((remoteName): remoteName is string => remoteName !== null);
  for (const preferredRemoteName of preferredRemoteNames) {
    const remoteUrl = remotes.get(preferredRemoteName);
    if (remoteUrl) {
      return { remoteName: preferredRemoteName, remoteUrl };
    }
  }

  const [remoteName, remoteUrl] =
    [...remotes.entries()].toSorted(([left], [right]) => left.localeCompare(right))[0] ?? [];
  return remoteName && remoteUrl ? { remoteName, remoteUrl } : null;
}

function buildRepositoryIdentity(input: {
  readonly remoteName: string;
  readonly remoteUrl: string;
  readonly rootPath: string;
}): RepositoryIdentity {
  const canonicalKey = normalizeGitRemoteUrl(input.remoteUrl);
  const sourceControlProvider = detectSourceControlProviderFromGitRemoteUrl(input.remoteUrl);
  const repositoryPath = canonicalKey.split("/").slice(1).join("/");
  const repositoryPathSegments = repositoryPath.split("/").filter((segment) => segment.length > 0);
  const [owner] = repositoryPathSegments;
  const repositoryName = repositoryPathSegments.at(-1);

  return {
    canonicalKey,
    locator: {
      source: "git-remote",
      remoteName: input.remoteName,
      remoteUrl: input.remoteUrl,
    },
    rootPath: input.rootPath,
    ...(repositoryPath ? { displayName: repositoryPath } : {}),
    ...(sourceControlProvider ? { provider: sourceControlProvider.kind } : {}),
    ...(owner ? { owner } : {}),
    ...(repositoryName ? { name: repositoryName } : {}),
  };
}

const resolveRepositoryIdentityCacheKey = Effect.fn("RepositoryIdentityResolver.resolveCacheKey")(
  function* (cwd: string) {
    const processRunner = yield* ProcessRunner.ProcessRunner;
    let cacheKey = cwd;

    // git is a real executable on every platform — no cmd.exe shell mode, which
    // would split paths containing spaces during cmd's re-tokenization.
    const topLevelResult = yield* processRunner
      .run({
        command: "git",
        args: ["-C", cwd, "rev-parse", "--show-toplevel"],
        timeoutBehavior: "timedOutResult",
      })
      .pipe(Effect.option);
    if (topLevelResult._tag === "None" || topLevelResult.value.code !== 0) {
      return cacheKey;
    }

    const candidate = topLevelResult.value.stdout.trim();
    if (candidate.length > 0) {
      cacheKey = candidate;
    }

    return cacheKey;
  },
);

const resolveRepositoryIdentityFromCacheKey = Effect.fn(
  "RepositoryIdentityResolver.resolveFromCacheKey",
)(function* (
  cacheKey: string,
): Effect.fn.Return<RepositoryIdentity | null, never, ProcessRunner.ProcessRunner> {
  const processRunner = yield* ProcessRunner.ProcessRunner;
  const remoteResult = yield* processRunner
    .run({
      command: "git",
      args: ["-C", cacheKey, "remote", "-v"],
      timeoutBehavior: "timedOutResult",
    })
    .pipe(Effect.option);
  if (remoteResult._tag === "None" || remoteResult.value.code !== 0) {
    return null;
  }

  // `--get-regexp` exits non-zero when nothing matches, which is the ordinary case of a checkout
  // that has never named a base repository, so the declarations stay empty rather than failing.
  const baseDeclarationResult = yield* processRunner
    .run({
      command: "git",
      args: ["-C", cacheKey, "config", "--get-regexp", String.raw`^remote\..*\.gh-resolved$`],
      timeoutBehavior: "timedOutResult",
    })
    .pipe(Effect.option);
  const baseDeclarations =
    baseDeclarationResult._tag === "Some" && baseDeclarationResult.value.code === 0
      ? parseBaseRepositoryDeclarations(baseDeclarationResult.value.stdout)
      : new Map<string, string>();

  const remote = pickPrimaryRemote(
    parseRemoteFetchUrls(remoteResult.value.stdout),
    baseDeclarations,
  );
  return remote ? buildRepositoryIdentity({ ...remote, rootPath: cacheKey }) : null;
});

export const make = Effect.fn("RepositoryIdentityResolver.make")(function* (
  options: RepositoryIdentityResolverOptions = {},
) {
  const processRunner = yield* ProcessRunner.ProcessRunner;

  const repositoryIdentityCache = yield* Cache.makeWith<string, RepositoryIdentity | null>(
    (cacheKey) =>
      resolveRepositoryIdentityFromCacheKey(cacheKey).pipe(
        Effect.provideService(ProcessRunner.ProcessRunner, processRunner),
      ),
    {
      capacity: options.cacheCapacity ?? DEFAULT_REPOSITORY_IDENTITY_CACHE_CAPACITY,
      timeToLive: Exit.match({
        onSuccess: (value) =>
          value === null
            ? (options.negativeCacheTtl ?? DEFAULT_NEGATIVE_CACHE_TTL)
            : (options.positiveCacheTtl ?? DEFAULT_POSITIVE_CACHE_TTL),
        onFailure: () => Duration.zero,
      }),
    },
  );

  const resolve: RepositoryIdentityResolver["Service"]["resolve"] = Effect.fn(
    "RepositoryIdentityResolver.resolve",
  )(function* (cwd) {
    const cacheKey = yield* resolveRepositoryIdentityCacheKey(cwd).pipe(
      Effect.provideService(ProcessRunner.ProcessRunner, processRunner),
    );
    return yield* Cache.get(repositoryIdentityCache, cacheKey);
  });

  return RepositoryIdentityResolver.of({ resolve });
});

export const layer = Layer.effect(RepositoryIdentityResolver, make()).pipe(
  Layer.provide(ProcessRunner.layer),
);
