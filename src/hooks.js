import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * @import { InstallHooksOptions, InstallHooksResult } from './index.d.ts'
 */

// Hooks ship inside this package (see hooks/commit-msg next to src/), so
// pointing core.hooksPath here works with zero files scaffolded into the
// consumer project. Absolute, so it is correct however deep node_modules ends
// up (monorepos, pnpm's per-dependency virtual store, etc.) — .git/config is
// never committed anyway, so a machine-local absolute path is no less portable
// than a relative one would be.
const BUNDLED_HOOKS_DIR = fileURLToPath(new URL('../hooks', import.meta.url))

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/**
 * Ensure every file in a hooks directory is executable. Packing/publishing does
 * not reliably preserve the executable bit (e.g. it is lost for files that were
 * never `git add`ed with it set), and git silently *ignores* a non-executable
 * hook instead of erroring — so without this, commit-msg linting could be
 * silently skipped. Self-healing this at install time removes that dependency
 * on the package's own file permissions surviving the trip to the registry.
 *
 * @param {string} dir
 */
function ensureExecutable(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    try {
      chmodSync(join(dir, entry), 0o755)
    } catch {
      // best-effort — a read-only install (e.g. some CI caches) shouldn't fail the install
    }
  }
}

/**
 * Point git at release-kit's bundled hooks directory via `core.hooksPath`, so
 * the commit-msg hook works without any file in the project itself.
 *
 * A hooks setup the project already has takes priority and is left alone:
 * this is a no-op when `core.hooksPath` is already set to something else (a
 * different hook manager, or a project-specific hooks directory), or when a
 * real (non-sample) hook already exists at the default `$GIT_DIR/hooks`.
 *
 * Skips gracefully when there is no git repository (e.g. `prepare` still runs
 * when the package is installed outside of one).
 *
 * @param {InstallHooksOptions} [options]
 * @returns {InstallHooksResult}
 */
export function installHooks(options = {}) {
  const { cwd = process.cwd(), dir = BUNDLED_HOOKS_DIR } = options

  let gitDir
  try {
    gitDir = git(['rev-parse', '--absolute-git-dir'], cwd)
  } catch {
    return { ok: false, skipped: true, reason: 'no-git', dir }
  }

  let existingHooksPath = ''
  try {
    existingHooksPath = git(['config', 'core.hooksPath'], cwd)
  } catch {
    // unset — fall through
  }

  if (existingHooksPath && existingHooksPath !== dir) {
    return { ok: false, skipped: true, reason: 'custom-hooks-path', dir: existingHooksPath }
  }

  if (!existingHooksPath && existsSync(join(gitDir, 'hooks', 'commit-msg'))) {
    return { ok: false, skipped: true, reason: 'existing-hook-file', dir: join(gitDir, 'hooks') }
  }

  if (dir === BUNDLED_HOOKS_DIR) {
    ensureExecutable(dir)
  }

  execFileSync('git', ['config', 'core.hooksPath', dir], { cwd, stdio: 'ignore' })
  return { ok: true, skipped: false, dir }
}
