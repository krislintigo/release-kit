# @krislintigo/release-kit

Opinionated release toolkit for npm packages. It bundles a shareable
[semantic-release](https://semantic-release.gitbook.io) configuration, a shared
[commitlint](https://commitlint.js.org) config, a native git commit-msg hook, a
[publint](https://publint.dev) check, and a small CLI that scaffolds all of it
into a project and drives releases.

It is **self-contained**: everything runs through the single `release-kit`
binary, so the only thing you install is this package — no husky,
`@commitlint/cli` or `semantic-release` binaries to add yourself.

The release pipeline builds the changelog from your Git history (Conventional
Commits), creates GitHub releases and tags, and publishes to npm with provenance.

## Install

```sh
pnpm add -D @krislintigo/release-kit
```

That is the whole install — **no peer dependencies**. semantic-release, the
commitlint engine and every release plugin are bundled and driven through the
`release-kit` binary, which is always available because release-kit is a direct
dependency. This behaves identically on pnpm, npm and yarn, and under
`pnpm link` / local development.

Requires Node.js 24.16.0 or newer.

## Quick start

Scaffold everything into an existing package:

```sh
pnpm dlx @krislintigo/release-kit init
```

`init` writes a `.releaserc.json`, a GitHub Actions workflow, a
`commitlint.config.js`, a native `.githooks/commit-msg` hook, pnpm hoist
patterns, and release scripts, and registers the hooks via `core.hooksPath` on
the next install. Existing files are never overwritten unless you pass `--force`.

## The release config

### As a shareable config (recommended)

`.releaserc.json`:

```json
{
  "extends": "@krislintigo/release-kit"
}
```

This pulls in the default pipeline, in order:

1. `@semantic-release/commit-analyzer` — decides the next version from commits.
2. `@semantic-release/release-notes-generator` — renders the release notes.
3. `@semantic-release/changelog` — writes `CHANGELOG.md`.
4. `@semantic-release/npm` — publishes to npm (with provenance).
5. `@semantic-release/github` — creates the GitHub release and tag.
6. `@semantic-release/git` — commits `CHANGELOG.md`, `package.json` and
   `pnpm-lock.yaml` back to `main`.

All of them use the `conventionalcommits` preset.

### With fine-tuning

For anything the shareable config does not cover, build the config yourself in a
`release.config.js`:

```js
import { createReleaseConfig } from '@krislintigo/release-kit'

export default createReleaseConfig({
  branches: ['main', { name: 'next', prerelease: true }],
  npm: { pkgRoot: 'dist' },
  gitAssets: ['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml'],
})
```

Each plugin can be toggled off (`false`) or handed an options object.

#### Options

| Option          | Default                                          | Description                                                        |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `branches`      | `['main']`                                        | Release branches (maintenance / prerelease branch objects allowed). |
| `tagFormat`     | `'v${version}'`                                   | Git tag format.                                                    |
| `preset`        | `'conventionalcommits'`                           | conventional-changelog preset.                                    |
| `presetConfig`  | —                                                 | Extra preset config (e.g. custom `types`).                        |
| `releaseRules`  | —                                                 | Custom rules for which commits bump which version.                |
| `parserOpts`    | —                                                 | Custom commit-parser options.                                     |
| `npm`           | `true`                                            | Publish to npm. `false` or `@semantic-release/npm` options.       |
| `provenance`    | `true`                                            | Publish with npm provenance.                                      |
| `changelog`     | `true`                                            | Write a changelog. `false` or plugin options.                    |
| `changelogFile` | `'CHANGELOG.md'`                                  | Changelog path.                                                   |
| `github`        | `true`                                            | Create a GitHub release. `false` or `@semantic-release/github` options. |
| `git`           | `true`                                            | Commit artifacts back. `false` or plugin options.                |
| `gitAssets`     | `['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml']` | Files committed by `@semantic-release/git`.                  |
| `gitMessage`    | `chore(release): …[skip ci]`                      | Release commit message.                                          |
| `extraPlugins`  | `[]`                                              | Plugins appended to the end of the pipeline.                     |

## commitlint & git hooks

`init` installs a native git `commit-msg` hook (via `core.hooksPath`, no husky)
that runs `release-kit commitlint`, which lints the message with commitlint's
engine — bundled here, so there is nothing else to install. It also writes a
`commitlint.config.js` for editor integration and manual runs:

```js
export default {
  extends: ['@krislintigo/release-kit/commitlint'],
}
```

Built on `@commitlint/config-conventional`, so the commit types it accepts are
exactly the ones the release pipeline understands. The hook works even without
this file — the shared ruleset is the default.

## CLI

```
release-kit init           Scaffold config, CI, commitlint, git hook and scripts.
release-kit release        Run semantic-release (reads .releaserc) after a check.
release-kit commitlint     Lint commit message(s); used by the commit-msg hook.
release-kit install-hooks  Enable the committed git hooks (sets core.hooksPath).
release-kit check          Lint the package for publishing problems (publint).
release-kit doctor         Report whether the environment is ready to release.
```

Run `release-kit help` for the full flag reference. Useful ones:

```sh
release-kit init --node 24             # set the CI workflow's Node version
release-kit doctor                     # tokens, branch and clean-tree check
release-kit check                      # publint the current package
release-kit release --dry-run          # preview the next release
```

## Programmatic API

```js
import { release, dryRun, verifyEnvironment, check, init } from '@krislintigo/release-kit'

const report = verifyEnvironment({ branch: 'main' })
if (report.ok) await release()
```

- `release(options)` / `dryRun(options)` — run semantic-release. With no config
  options it uses the project's own `.releaserc`; pass `createReleaseConfig`
  options (or a ready `config`) to override.
- `verifyEnvironment(options)` — check tokens, branch and working tree; returns a
  report, never throws.
- `check(options)` — run publint and get structured results.
- `lintCommits(options)` — lint commit messages with the bundled commitlint engine.
- `installHooks(options)` — set `core.hooksPath`; skips when there is no repo.
- `init(options)` / `detectPackageManager(cwd)` — the scaffolding used by the CLI.

## CI

The generated workflow releases on every push to `main`. It needs:

- `GITHUB_TOKEN` — provided automatically by GitHub Actions.
- npm auth — either [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)
  configured for the package (the workflow already requests `id-token: write`),
  or an `NPM_TOKEN` repository secret.

## pnpm note

semantic-release resolves its plugins from the project root. Because those
plugins are dependencies of this package, pnpm needs them hoisted. `init` writes
this for you; to do it by hand, add to `.npmrc`:

```
public-hoist-pattern[]=@semantic-release/*
public-hoist-pattern[]=conventional-changelog-*
```

(npm and yarn hoist by default, so this is a pnpm-only step.)

## License

MIT © krislintigo
