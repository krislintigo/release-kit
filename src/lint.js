import process from 'node:process'

import sharedConfig from './commitlint.js'

/**
 * @import { LintCommitsOptions, LintCommitsResult } from './index.d.ts'
 */

/**
 * Lint commit messages with commitlint's own engine, imported programmatically.
 * This is why the consumer never needs the `commitlint` binary: release-kit
 * bundles `@commitlint/{load,read,lint,format}` and drives them itself.
 *
 * The shared config is used as the seed, so linting works even when the project
 * has no `commitlint.config.js`; if it does have one, `load` merges it on top.
 *
 * @param {LintCommitsOptions} [options]
 * @returns {Promise<LintCommitsResult>}
 */
export async function lintCommits(options = {}) {
  const { cwd = process.cwd(), edit, from, to } = options

  // Namespace imports keep this resilient to CJS/ESM default-export differences
  // across commitlint versions.
  const [loadMod, readMod, lintMod, formatMod] = await Promise.all([
    import('@commitlint/load'),
    import('@commitlint/read'),
    import('@commitlint/lint'),
    import('@commitlint/format'),
  ])
  const load = loadMod.default ?? loadMod
  const read = readMod.default ?? readMod
  const lint = lintMod.default ?? lintMod
  const format = formatMod.default ?? formatMod.format

  const loaded = await load(sharedConfig, { cwd })
  const messages = await read({ cwd, edit, from, to })

  const lintOptions = {
    parserOpts: loaded.parserPreset?.parserOpts,
    plugins: loaded.plugins,
    ignores: loaded.ignores,
    defaultIgnores: loaded.defaultIgnores,
  }

  const results = []
  for (const message of messages) {
    results.push(await lint(message, loaded.rules, lintOptions))
  }

  const valid = results.every((result) => result.valid)
  const output = format({ results }, { color: true })

  return { valid, output }
}
