import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

/**
 * @import { InitOptions, InitResult, PackageManager, ScaffoldAction } from './index.d.ts'
 */

/**
 * Package-manager-specific command fragments used in the generated CI workflow.
 *
 * @type {Record<PackageManager, { install: string, run: string, setup: string }>}
 */
const PM = {
  pnpm: {
    install: 'pnpm install --frozen-lockfile',
    run: 'pnpm',
    setup: 'pnpm/action-setup@v6',
  },
  npm: {
    install: 'npm ci',
    run: 'npm run',
    setup: '',
  },
  yarn: {
    install: 'yarn install --immutable',
    run: 'yarn',
    setup: '',
  },
}

/**
 * Detect which package manager a project uses, from its `packageManager` field
 * first and then from any lockfile present.
 *
 * @param {string} cwd
 * @returns {PackageManager}
 */
export function detectPackageManager(cwd) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
    if (typeof pkg.packageManager === 'string') {
      const name = pkg.packageManager.split('@')[0]
      if (name === 'pnpm' || name === 'npm' || name === 'yarn') return name
    }
  } catch {
    // no or invalid package.json — fall through to lockfile detection
  }
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

/**
 * The release CI workflow, tailored to the chosen package manager. Publishes with
 * provenance (OIDC), so it needs either npm trusted publishing configured for the
 * package or an `NPM_TOKEN` secret.
 *
 * @param {PackageManager} pm
 * @param {number} node
 * @returns {string}
 */
function releaseWorkflow(pm, node) {
  const setupPm = pm === 'pnpm' ? `\n      - name: Setup pnpm\n        uses: ${PM.pnpm.setup}\n` : '\n'
  const cache = pm === 'yarn' ? 'yarn' : pm
  return `name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
${setupPm}      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: ${node}
          cache: ${cache}

      - run: ${PM[pm].install}
      - run: ${PM[pm].run} check
      - run: ${PM[pm].run} release
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`
}

/**
 * Ensure a directory exists, then write a file, honoring the `force` flag.
 *
 * @param {string} cwd
 * @param {string} relativePath
 * @param {string} content
 * @param {boolean} force
 * @returns {ScaffoldAction}
 */
function write(cwd, relativePath, content, force) {
  const target = join(cwd, relativePath)
  const exists = existsSync(target)
  if (exists && !force) return { path: relativePath, status: 'skipped' }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  return { path: relativePath, status: exists ? 'overwritten' : 'created' }
}

/**
 * Add release scripts to the project's `package.json` without disturbing scripts
 * that already exist (unless `force`).
 *
 * @param {string} cwd
 * @param {boolean} force
 * @returns {ScaffoldAction}
 */
function patchPackageJson(cwd, force) {
  const target = join(cwd, 'package.json')
  if (!existsSync(target)) return { path: 'package.json', status: 'skipped' }
  const pkg = JSON.parse(readFileSync(target, 'utf8'))
  const scripts = pkg.scripts ?? {}
  const desired = {
    prepare: 'release-kit install-hooks',
    commitlint: 'release-kit commitlint',
    check: 'release-kit check',
    release: 'release-kit release',
    'release:dry-run': 'release-kit release --dry-run',
  }
  let changed = false
  for (const [name, command] of Object.entries(desired)) {
    if (scripts[name] === undefined || force) {
      if (scripts[name] !== command) {
        scripts[name] = command
        changed = true
      }
    }
  }
  if (!changed) return { path: 'package.json', status: 'skipped' }
  pkg.scripts = scripts
  writeFileSync(target, JSON.stringify(pkg, null, 2) + '\n')
  return { path: 'package.json', status: 'overwritten' }
}

/**
 * Scaffold a project's release CI and convenience scripts.
 *
 * Everything release-kit needs to actually run — the semantic-release config,
 * the commitlint ruleset, and the git commit-msg hook — is bundled inside the
 * package itself and applies automatically; `release-kit release` and
 * `release-kit commitlint` work with zero files in the project. `init` only
 * writes what genuinely has to live in the project: the GitHub Actions workflow
 * (GitHub only reads workflows from the repo) and `package.json` scripts. If a
 * project adds its own `.releaserc.json` / `commitlint.config.js` later, that
 * takes priority over the bundled defaults automatically — no extra step.
 *
 * Existing files are left untouched unless `force` is set.
 *
 * @param {InitOptions} [options]
 * @returns {InitResult}
 */
export function init(options = {}) {
  const {
    cwd = process.cwd(),
    packageManager = detectPackageManager(cwd),
    node = 24,
    force = false,
  } = options

  /** @type {ScaffoldAction[]} */
  const actions = []

  actions.push(write(cwd, '.github/workflows/release.yml', releaseWorkflow(packageManager, node), force))
  actions.push(patchPackageJson(cwd, force))

  return { packageManager, actions }
}
