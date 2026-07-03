import { execFileSync } from 'node:child_process'
import process from 'node:process'

/**
 * @import { EnvironmentReport, VerifyEnvironmentOptions } from './index.d.ts'
 */

/**
 * Run a git command and return its trimmed stdout.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/**
 * Inspect the local environment for the things a release needs: an authentication
 * token for GitHub, an optional npm token, a clean working tree, and the expected
 * release branch. This never throws — it returns a structured report so callers
 * (the CLI, CI scripts, or your own tooling) can decide how strict to be.
 *
 * @param {VerifyEnvironmentOptions} [options]
 * @returns {EnvironmentReport}
 */
export function verifyEnvironment(options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    branch = 'main',
    requireNpmToken = false,
  } = options

  /** @type {string[]} */
  const issues = []
  /** @type {EnvironmentReport['info']} */
  const info = {}

  info.githubToken = Boolean(env.GITHUB_TOKEN || env.GH_TOKEN)
  if (!info.githubToken) {
    issues.push('Missing GITHUB_TOKEN (or GH_TOKEN) — required by @semantic-release/github.')
  }

  info.npmToken = Boolean(env.NPM_TOKEN || env.NODE_AUTH_TOKEN)
  if (requireNpmToken && !info.npmToken) {
    issues.push(
      'Missing NPM_TOKEN — required to publish to npm unless you use OIDC trusted publishing.',
    )
  }

  let insideRepo
  try {
    insideRepo = git(['rev-parse', '--is-inside-work-tree'], cwd) === 'true'
  } catch {
    insideRepo = false
  }

  if (!insideRepo) {
    issues.push('Not a git repository, or git is not available on PATH.')
  } else {
    // `branch --show-current` is empty (not an error) on an unborn branch or a
    // detached HEAD, unlike `rev-parse --abbrev-ref HEAD`.
    info.branch = git(['branch', '--show-current'], cwd) || undefined
    info.clean = git(['status', '--porcelain'], cwd) === ''

    if (info.branch && branch && info.branch !== branch) {
      issues.push(`On branch "${info.branch}", but the configured release branch is "${branch}".`)
    }
    if (!info.clean) {
      issues.push('Working tree has uncommitted changes.')
    }
  }

  return { ok: issues.length === 0, issues, info }
}
