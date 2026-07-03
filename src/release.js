import process from 'node:process'

import { createReleaseConfig } from './config.js'

/**
 * @import { ReleaseOptions } from './index.d.ts'
 */

/**
 * Load semantic-release lazily. It is an (optional) peer dependency, so we only
 * require it to be installed when an actual release is requested, and we fail
 * with an actionable message instead of a raw module-resolution error.
 *
 * @returns {Promise<typeof import('semantic-release').default>}
 */
async function loadSemanticRelease() {
  try {
    const mod = await import('semantic-release')
    return mod.default ?? mod
  } catch (cause) {
    throw new Error(
      'Could not load "semantic-release". Install it in your project:\n' +
        '  pnpm add -D semantic-release',
      { cause },
    )
  }
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
  const resolvedConfig = config ?? createReleaseConfig(configOptions)

  return semanticRelease({ ...resolvedConfig, dryRun }, { cwd, env })
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
