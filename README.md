# @krislintigo/release-kit

Opinionated, **zero-config-by-default** release toolkit for npm packages. It
bundles a [semantic-release](https://semantic-release.gitbook.io) configuration,
a [commitlint](https://commitlint.js.org) ruleset, a native git commit-msg hook,
a [publint](https://publint.dev) check, and a small CLI that drives releases.

It is **self-contained**: everything runs through the single `release-kit`
binary, so the only thing you install is this package — no husky,
`@commitlint/cli` or `semantic-release` binaries to add yourself.

It is also **convention-over-configuration**: the semantic-release config, the
commitlint ruleset, and the git hook all live inside this package and apply
automatically — a project needs **no `.releaserc.json`, no
`commitlint.config.js`, no hook file** to release. If a project adds one of
those anyway, it is detected and takes priority over the bundled default —
release-kit gets out of the way automatically, no extra step required.

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

```sh
pnpm add -D @krislintigo/release-kit
pnpm dlx @krislintigo/release-kit init
```

That's it — `release-kit release` and the commit-msg hook already work with the
bundled defaults. `init` only writes what genuinely has to live in the project:

- `.github/workflows/release.yml` — GitHub only reads workflows from the repo,
  so this can't be bundled elsewhere.
- `package.json` scripts (`prepare`, `commitlint`, `check`, `release`,
  `release:dry-run`) — convenience wrappers around the `release-kit` binary.
  `prepare: release-kit install-hooks` is what turns the git hook on the first
  time dependencies are installed.

Existing files are never overwritten unless you pass `--force`.

## The release config

Nothing to write. `release-kit release` uses release-kit's bundled default
pipeline automatically:

1. `@semantic-release/commit-analyzer` — decides the next version from commits.
2. `@semantic-release/release-notes-generator` — renders the release notes.
3. `@semantic-release/changelog` — writes `CHANGELOG.md`.
4. `@semantic-release/npm` — publishes to npm (with provenance).
5. `@semantic-release/github` — creates the GitHub release and tag.
6. `@semantic-release/git` — commits `CHANGELOG.md`, `package.json` and
   `pnpm-lock.yaml` back to `main`.

All of them use the `conventionalcommits` preset.

### Overriding it

Add a `.releaserc.json` (or `release.config.js`, or a `release` field in
`package.json` — anything semantic-release itself would discover) and it is
used instead, verbatim:

```json
{
  "extends": "@krislintigo/release-kit"
}
```

Extending the bundled config like this is the easiest way to layer a few
changes on top of it, since [createReleaseConfig](#fine-tuning-programmatically)
is not available from a plain JSON file. For full control, use `release.config.js`
and build the config in code (see below).

### Fine-tuning programmatically

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

Nothing to write here either. `release-kit install-hooks` (wired into
`prepare`) points git's `core.hooksPath` straight at a `commit-msg` hook bundled
inside this package — no hook file is scaffolded into the project. That hook
runs `release-kit commitlint`, which lints with commitlint's engine (also
bundled) against release-kit's shared ruleset, built on
`@commitlint/config-conventional`.

If the project already manages its own git hooks — a different
`core.hooksPath`, or a real hook file already sitting at `.git/hooks/commit-msg`
— `install-hooks` detects that and leaves it alone.

### Overriding the ruleset

Add a `commitlint.config.js` and it takes priority automatically:

```js
export default {
  extends: ['@krislintigo/release-kit/commitlint'],
  rules: {
    'body-max-line-length': [0, 'always'],
  },
}
```

## CLI

```
release-kit init           Scaffold the CI workflow and package.json scripts.
release-kit release        Run semantic-release with the bundled or project config.
release-kit commitlint     Lint commit message(s); used by the commit-msg hook.
release-kit install-hooks  Enable the bundled git hooks (sets core.hooksPath).
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

- `release(options)` / `dryRun(options)` — run semantic-release. With no
  `createReleaseConfig` options, it uses the project's own config (a
  `.releaserc.json`, `release.config.js`, or `release` field in `package.json`)
  when present, falling back to the bundled default otherwise. Pass
  `createReleaseConfig` options (or a ready `config`) to always override.
- `verifyEnvironment(options)` — check tokens, branch and working tree; returns a
  report, never throws.
- `check(options)` — run publint and get structured results.
- `lintCommits(options)` — lint commit messages; uses the project's own
  commitlint config when present, the bundled ruleset otherwise.
- `installHooks(options)` — point `core.hooksPath` at the bundled hooks; skips
  when there is no repo, or the project already manages its own hooks.
- `init(options)` / `detectPackageManager(cwd)` — the scaffolding used by the CLI.

## CI

The generated workflow releases on every push to `main`. It needs:

- `GITHUB_TOKEN` — provided automatically by GitHub Actions.
- npm auth — either [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)
  configured for the package (the workflow already requests `id-token: write`),
  or an `NPM_TOKEN` repository secret.

## License

MIT © krislintigo
