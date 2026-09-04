---
name: sync-upstream
description: Update the M3 Code fork from pingdotgg/t3code by creating a reviewable Graphite merge PR. Use when asked to sync, pull, or merge upstream main into the fork. Do not use for ordinary feature-branch updates or to merge the resulting PR.
---

# Sync M3 Code with upstream

Create one published PR against `Houguiram/m3code` `main` that merges the latest
`pingdotgg/t3code` `main` while preserving both repositories' ancestry and the fork's intentional
behavior.

Invoking this skill authorizes fetching both remotes, preparing the current agent branch, resolving
ordinary merge conflicts, running focused verification, pushing the sync branch, and creating or
updating the Graphite PR. It does not authorize pushing directly to `origin/main`, force-rewriting
published history, enabling merge-when-ready, or merging the PR.

Read [`docs/operations/local-workflow.md`](../../../docs/operations/local-workflow.md) before
starting. Follow the repository `AGENTS.md` throughout.

## Establish a safe starting point

1. Work from the repository root. Confirm these identities instead of assuming them:
   - `origin` is `Houguiram/m3code`.
   - `upstream` is `pingdotgg/t3code`.
   - Graphite's trunk is `main`.
     Stop without changing remote configuration if any identity differs or a required remote is
     missing.
2. Require a clean worktree. Do not stash, commit, or absorb unrelated work into the sync.
3. Fetch and prune `origin` and `upstream` explicitly. Do not use `git pull upstream main`.
4. Inspect open PRs against the fork's `main`. If an upstream-sync PR already exists, report its URL
   and whether it contains the current `upstream/main`; do not create a duplicate.
5. Compare `origin/main` and `upstream/main` with ancestry checks and a short left/right log. If
   `upstream/main` is already an ancestor of `origin/main`, report that the fork is current and stop
   without creating a branch or PR.

The local `main` ref must equal `origin/main` before Graphite submission. If `main` is checked out in
another worktree, locate it with `git worktree list --porcelain`. Update it by fast-forward only and
only when that worktree is clean. Never reset it, overwrite it, or disturb a dirty worktree. If it
cannot be updated safely, stop and give the user the worktree path and exact reason.

## Prepare the sync branch

Prefer the fresh T3-created agent branch when it is clean, has no unique commits, and can be
fast-forwarded to exactly `origin/main`. This avoids checking out `main`, which commonly belongs to
another worktree. If currently on `main`, create a Graphite branch named
`t3code/sync-upstream-YYYY-MM-DD`, adding a numeric suffix if necessary. Never place the sync on top
of a feature branch or open stack.

Merge with history intact:

```bash
git merge --no-ff --no-commit upstream/main
```

Resolve conflicts by understanding both sides. Preserve upstream fixes and features together with
intentional M3 behavior; do not accept `ours` or `theirs` across the whole merge. In particular,
protect the fork identity and workflow documented in `docs/operations/local-workflow.md`, including
M3 app naming, bundle IDs, URL schemes, `~/.m3` live state, Graphite PR handling, and the local
desktop install command. Worktree sandbox state remains `.t3`.

When a conflict is genuinely ambiguous and either choice could remove a fork capability or an
upstream feature, abort the merge back to the previously clean state and ask the user with a concise
file-by-file explanation. Otherwise, finish the merge autonomously.

Create the merge commit with a conventional subject such as:

```text
chore(upstream): sync T3 Code main
```

The commit body should identify the merged upstream SHA and briefly note any fork-specific conflict
resolution. Do not squash the upstream history.

## Verify the result

Before submission:

- Prove both `origin/main` and the fetched `upstream/main` are ancestors of `HEAD`.
- Inspect the first-parent diff, merge stat, conflict resolutions, and `git diff --check`.
- Run focused tests for conflict resolutions and fork-specific code touched by upstream. Add targeted
  lint or typechecking when warranted. Do not run repository-wide checks.
- Confirm the worktree is clean and the only branch work is the upstream merge.

If there were no conflicts, do not invent broad local testing for unchanged upstream code; record
the ancestry and diff checks and let CI exercise the integrated tree.

## Submit through Graphite

Track the current branch directly onto `main` if it is not already tracked:

```bash
gt track --parent main
```

Use `gt submit` to create a published, single-branch PR. Submit only the current branch, edit the
metadata through the CLI, and do not pass `--merge-when-ready`. Do not use `gh pr create`.

Use a title such as `chore(upstream): sync T3 Code main`. The PR body must:

- Explain that the fork had fallen behind upstream and identify the upstream SHA merged.
- Summarize conflict resolutions or state that the merge was clean.
- List the focused verification performed.
- Warn: **merge this PR with a merge commit; do not squash or rebase it**, because future syncs rely
  on preserved upstream ancestry.
- End with the model and harness that performed the work.

After submission, read the PR back and verify its repository, base branch, head branch, title, body,
and published state. Return the GitHub and Graphite URLs, upstream SHA, conflict summary, verification
results, and the merge-strategy warning. Leave merging and the later `gt sync` to the user unless
they explicitly request those as a separate action.
