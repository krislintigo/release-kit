import process from 'node:process'

import { cosmiconfig } from 'cosmiconfig'

import { createReleaseConfig } from './config.js'

/**
 * @import { ReleaseOptions } from './index.d.ts'
 */

// Same module name semantic-release itself uses internally to search for
// `.releaserc*` / `release.config.*` / a `release` field in package.json — see
// semantic-release's own `lib/get-config.js`. Reusing it means "does the
// project have its own config" is answered identically to how semantic-release
// would answer it.
const CONFIG_NAME = 'release'

/**
 * Load semantic-release lazily. It is an (optional) peer dependency, so we only
 * import it, so a release only pays for loading it when one is actually run.
 *
 * @returns {Promise<typeof import('semantic-release').default>}
 */
async function loadSemanticRelease() {
  const mod = await import('semantic-release')
  return mod.default ?? mod
}

/**
 * Run a release programmatically. Pass a fully-formed `config`, or any
 * {@link createReleaseConfig} option to build one on the fly. Returns
 * semantic-release's result object (`false` when no release was made).
 *
 * With no `config`/config options, the project's own semantic-release config is
 * used as-is when it has one (a `.releaserc.json`, `release.config.js`, or a
 * `release` field in `package.json` — discovered the same way semantic-release
 * itself would). Only when the project has no config of its own does this fall
 * back to release-kit's bundled default ({@link createReleaseConfig}), so a
 * project needs no `.releaserc.json` at all to release.
 *
 * @param {ReleaseOptions} [options]
 * @returns {Promise<import('semantic-release').Result>}
 */
export async function release(options = {}) {
  const {
    config,
    dryRun = false,
    cwd = process.cwd(),
    env = process.env,
    ...configOptions
  } = options

  const semanticRelease = await loadSemanticRelease()

  let base = config
  if (!base) {
    if (Object.keys(configOptions).length > 0) {
      // Explicit createReleaseConfig options always take priority — they must
      // go through createReleaseConfig itself, since raw option names like
      // `npm`/`github`/`preset` are our abstraction, not semantic-release's.
      base = createReleaseConfig(configOptions)
    } else {
      const hasOwnConfig = Boolean(await cosmiconfig(CONFIG_NAME).search(cwd))
      base = hasOwnConfig ? {} : createReleaseConfig()
    }
  }

  return semanticRelease({ ...base, dryRun }, { cwd, env })
}

/**
 * Convenience wrapper for {@link release} with `dryRun: true`. Computes the next
 * version and release notes without publishing, tagging, or pushing anything.
 *
 * @param {ReleaseOptions} [options]
 * @returns {Promise<import('semantic-release').Result>}
 */
export function dryRun(options = {}) {
  return release({ ...options, dryRun: true })
}
