# M3 Code local workflow

> For agents and humans working in this fork. Product usage belongs in [docs/user](../user/).

This checkout is **M3 Code**, not the official T3 Code app. Use Graphite for pull requests, and
update the installed Mac app with `vp run install:desktop:local`. Do not invent a `gh pr create`
path or a Finder DMG install unless that command has failed and the developer asked for a fallback.

## Identity

| Thing             | Official T3 Code     | This fork                                              |
| ----------------- | -------------------- | ------------------------------------------------------ |
| Installed app     | T3 Code              | M3 Code (Alpha) at `/Applications/M3 Code (Alpha).app` |
| Bundle ID         | `com.t3tools.t3code` | `com.houguiram.m3code`                                 |
| Protocol          | `t3code://`          | `m3code://` (dev: `m3code-dev://`)                     |
| Live state        | `~/.t3/userdata`     | `~/.m3/userdata`                                       |
| Desktop dev state | `~/.t3/dev`          | `~/.m3/dev`                                            |

The two apps can coexist. Never start a server against `~/.t3/userdata` or open that database
read-write. Treat `~/.m3/userdata` the same way while the installed app is running: read and copy
are fine; do not migrate, vacuum-overwrite, or delete it from a script.

Worktree sandboxes still use a gitignored `.t3` directory (upstream naming). That is isolated
checkout state, not the official app.

## Git and pull requests

Never commit or open a pull request unless the developer asked. One concern per PR.

This repo is synced with Graphite (`Houguiram/m3code`). The loop is:

```bash
# 1. Commit on a Graphite branch (creates the branch if you are on main)
gt create --message "$(cat <<'EOF'
feat(scope): short why-focused title

EOF
)"

# 2. When asked to open a PR or submit
gt submit

# 3. After the PR merges, update main and delete the merged branch
gt sync
```

`gt create` without extra flags stacks on the current branch. Conventional commit titles, plain
language, same as upstream: `fix(web): new threads no longer spike CPU`. The PR body is the problem
in a sentence or two, then how you fixed it.

Do not use `gh pr create` for this repo. Graphite owns the GitHub PR, stack metadata, and restack
after `gt sync`. `gh` is fine for reading checks, comments, and reviews.

If `gt submit` reports that Graphite could not verify access to `Houguiram/m3code`:

1. Confirm the repo appears at [app.graphite.com/settings](https://app.graphite.com/settings).
2. If it is missing, **install** the Graphite GitHub App on the personal account that owns the
   repo: [https://github.com/apps/graphite-app](https://github.com/apps/graphite-app). Choose
   **Install**, pick `Houguiram`, and grant **All repositories** or at least `m3code`.
3. A **Revoke** button on GitHub means you are on Authorized GitHub Apps
   (`github.com/settings/apps/authorizations`). That page does not grant repository access. The
   install with a repo picker lives at `github.com/settings/installations` after the app is
   installed.
4. Refresh the CLI token at [app.graphite.com/activate](https://app.graphite.com/activate) and run
   the `gt auth --token …` command it prints, then retry `gt submit`.

`gt config` may print a spurious `ERROR: undefined is not a function` while still inferring owner
`Houguiram` and name `m3code`. Ignore that error if the inferred remote is correct.

## Installed desktop app

To put the current tree into `/Applications` and relaunch it:

```bash
vp run install:desktop:local
```

That command builds a host-architecture ZIP, quits the installed M3 Code app, replaces
`/Applications/M3 Code (Alpha).app`, strips `com.apple.quarantine`, and opens the new bundle. It
takes a few minutes. Any in-flight agent turns in the installed app are interrupted.

Stop `vp run dev:desktop` first. The installer refuses to run while that watcher, `M3 Code (Dev).app`,
or `vp pack --watch` from this repo is alive. Daily use of the installed app together with
`dev:desktop` is fine: they use `~/.m3/userdata` and `~/.m3/dev` respectively. Only the install
step requires the dev desktop stack to be down.

Do not hand the developer a DMG and ask them to drag the app into Applications. Use this command
unless they asked for a shareable artifact.

To build without installing:

- Shareable DMG: `vp run dist:desktop:dmg:arm64` (or `:x64`)
- ZIP only: `vp run dist:desktop:artifact --platform mac --target zip --arch arm64`

Command catalog: [Scripts](../internals/scripts.md).

## Desktop development

```bash
vp i
vp run dev:desktop
```

Read ports and the pairing URL from the `[dev-runner]` line. Hand over the full pairing URL,
including the token.

CORS for the Electron renderer allowlists `m3code://app` and `m3code-dev://app` in
`apps/server/src/http.ts`. If the dev window shows a connection error after a scheme rename, that
list is the first place to check.

UI changes in `apps/web` hot-reload in the running `dev:desktop` window. Do not rebuild the
installed app to preview CSS or React.

## T3 Connect

Production Clerk allowlists `t3code://app`, not `m3code://app`. The in-app T3 Connect sign-in UI
often never appears in this fork (`origin_invalid`). That is expected until Clerk origins include
the M3 schemes.

Link the **installed** environment with the CLI OAuth flow, which uses `app.t3.codes` in a browser:

```bash
node apps/server/src/bin.ts connect link --base-dir ~/.m3
```

Do not pass `~/.t3`. After a successful link, agent activity can publish to T3 Connect for mobile
and remote clients.

Public Clerk and relay identifiers live in the repository-root `.env` copied from `.env.example`.
Details: [T3 Connect](../internals/t3-connect.md).
