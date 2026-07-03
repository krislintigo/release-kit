import { execFileSync } from 'node:child_process'
import process from 'node:process'

/**
 * @import { InstallHooksOptions, InstallHooksResult } from './index.d.ts'
 */

/**
 * Point git at a committed hooks directory via `core.hooksPath`. This is the
 * whole of what husky does for us, done natively so the consumer needs no extra
 * tool — release-kit's own bin is enough.
 *
 * It skips gracefully when there is no git repository (e.g. when the package is
 * being installed as a dependency, where `prepare` still runs), mirroring
 * husky's "no .git, skipping" behaviour, so it is safe in a `prepare` script.
 *
 * @param {InstallHooksOptions} [options]
 * @returns {InstallHooksResult}
 */
export function installHooks(options = {}) {
  const { cwd = process.cwd(), dir = '.githooks' } = options

  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'ignore' })
  } catch {
    return { ok: false, skipped: true, dir }
  }

  execFileSync('git', ['config', 'core.hooksPath', dir], { cwd, stdio: 'ignore' })
  return { ok: true, skipped: false, dir }
}
