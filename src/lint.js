import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * @import { LintCommitsOptions, LintCommitsResult } from './index.d.ts'
 */

// The shared config's `extends: ['@commitlint/config-conventional']` must
// resolve from release-kit's own install location, not the project's — that
// package is release-kit's dependency, not necessarily reachable (or hoisted)
// from a consumer project's node_modules. Only used for the fallback load.
const OWN_DIR = fileURLToPath(new URL('.', import.meta.url))

/**
 * A resolved commitlint config counts as "the project configured itself" once
 * it actually says something — some extends, rules, or plugins. An empty shell
 * (nothing found on disk) means there is nothing to defer to.
 *
 * @param {{ extends?: unknown[], rules?: Record<string, unknown>, plugins?: Record<string, unknown> }} loaded
 * @returns {boolean}
 */
function isConfigured(loaded) {
  return (
    (loaded.extends?.length ?? 0) > 0 ||
    Object.keys(loaded.rules ?? {}).length > 0 ||
    Object.keys(loaded.plugins ?? {}).length > 0
  )
}

/**
 * Lint commit messages with commitlint's own engine, imported programmatically.
 * This is why the consumer never needs the `commitlint` binary: release-kit
 * bundles `@commitlint/{load,read,lint,format}` and drives them itself.
 *
 * `@commitlint/load`'s `seed` argument outranks whatever the project's own
 * config file sets (it is merged in last), so passing our shared config as seed
 * would silently override a project's edits to the very same rules. Instead we
 * let `load` discover the project's own config first — which already extends
 * `@krislintigo/release-kit/commitlint` when scaffolded by `init`, and correctly
 * lets the project override individual rules through normal extends semantics
 * — and only fall back to the shared config directly when the project has no
 * commitlint config of its own at all.
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

  let loaded = await load({}, { cwd })
  if (!isConfigured(loaded)) {
    const sharedConfig = (await import('./commitlint.js')).default
    loaded = await load(sharedConfig, { cwd: OWN_DIR })
  }

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
