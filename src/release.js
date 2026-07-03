import process from 'node:process'

import { createReleaseConfig } from './config.js'

/**
 * @import { ReleaseOptions } from './index.d.ts'
 */

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

  // With an explicit config or config options, build/inject it. Otherwise pass
  // nothing so semantic-release loads the project's own config (e.g. a
  // `.releaserc.json` that extends "@krislintigo/release-kit") — this keeps any
  // per-project customisation intact when invoked via `release-kit release`.
  const base = config ?? (Object.keys(configOptions).length > 0 ? createReleaseConfig(configOptions) : {})

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
