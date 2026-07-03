import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

/**
 * @import { InitOptions, InitResult, PackageManager, ScaffoldAction } from './index.d.ts'
 */

/**
 * Package-manager-specific command fragments used across the generated files.
 *
 * @type {Record<PackageManager, { install: string, run: string, commitlint: string, setup: string }>}
 */
const PM = {
  pnpm: {
    install: 'pnpm install --frozen-lockfile',
    run: 'pnpm',
    commitlint: 'pnpm exec commitlint --edit "$1"',
    setup: 'pnpm/action-setup@v4',
  },
  npm: {
    install: 'npm ci',
    run: 'npm run',
    commitlint: 'npx --no-install commitlint --edit "$1"',
    setup: '',
  },
  yarn: {
    install: 'yarn install --immutable',
    run: 'yarn',
    commitlint: 'yarn commitlint --edit "$1"',
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
    branches:
      - main
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

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
${setupPm}      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${node}
          cache: ${cache}
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        run: ${PM[pm].install}

      - name: Check package
        run: ${PM[pm].run} check

      - name: Release
        run: ${PM[pm].run} release
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          # Only needed if you are not using npm trusted publishing (OIDC):
          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
`
}

const RELEASERC = `${JSON.stringify({ extends: '@krislintigo/release-kit' }, null, 2)}\n`

const COMMITLINT_CONFIG = `export default {
  extends: ['@krislintigo/release-kit/commitlint'],
}
`

const NPMRC_PATTERNS = [
  'public-hoist-pattern[]=@semantic-release/*',
  'public-hoist-pattern[]=conventional-changelog-*',
]

/**
 * Ensure a directory exists, then write a file, honouring the `force` flag.
 *
 * @param {string} cwd
 * @param {string} relativePath
 * @param {string} content
 * @param {boolean} force
 * @param {number} [mode]
 * @returns {ScaffoldAction}
 */
function write(cwd, relativePath, content, force, mode) {
  const target = join(cwd, relativePath)
  const exists = existsSync(target)
  if (exists && !force) return { path: relativePath, status: 'skipped' }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  if (mode !== undefined) chmodSync(target, mode)
  return { path: relativePath, status: exists ? 'overwritten' : 'created' }
}

/**
 * Merge pnpm hoist patterns into an existing (or new) `.npmrc`, adding only the
 * lines that are missing so an existing config is never clobbered.
 *
 * @param {string} cwd
 * @returns {ScaffoldAction}
 */
function ensureNpmrc(cwd) {
  const target = join(cwd, '.npmrc')
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : ''
  const lines = existing.split('\n')
  const missing = NPMRC_PATTERNS.filter((pattern) => !lines.includes(pattern))
  if (missing.length === 0) return { path: '.npmrc', status: 'skipped' }
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
  writeFileSync(target, existing + prefix + missing.join('\n') + '\n')
  return { path: '.npmrc', status: existing ? 'overwritten' : 'created' }
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
    prepare: 'husky',
    commitlint: 'commitlint',
    release: 'semantic-release',
    'release:dry-run': 'semantic-release --dry-run',
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
 * Scaffold release tooling into a project: semantic-release config, a CI
 * workflow, commitlint config, a husky commit-msg hook, pnpm hoist patterns, and
 * release scripts. Existing files are left untouched unless `force` is set.
 *
 * @param {InitOptions} [options]
 * @returns {InitResult}
 */
export function init(options = {}) {
  const {
    cwd = process.cwd(),
    packageManager = detectPackageManager(cwd),
    node = 24,
    hooks = true,
    force = false,
  } = options

  /** @type {ScaffoldAction[]} */
  const actions = []

  actions.push(write(cwd, '.releaserc.json', RELEASERC, force))
  actions.push(write(cwd, '.github/workflows/release.yml', releaseWorkflow(packageManager, node), force))
  actions.push(write(cwd, 'commitlint.config.js', COMMITLINT_CONFIG, force))

  if (hooks) {
    const hook = `${PM[packageManager].commitlint}\n`
    actions.push(write(cwd, '.husky/commit-msg', hook, force, 0o755))
  }

  if (packageManager === 'pnpm') {
    actions.push(ensureNpmrc(cwd))
  }

  actions.push(patchPackageJson(cwd, force))

  const devDependencies = ['@krislintigo/release-kit', 'semantic-release', 'husky', '@commitlint/cli']

  return { packageManager, actions, devDependencies }
}
