/**
 * @import { CreateReleaseConfigOptions, ReleaseConfig } from './index.d.ts'
 */

/**
 * The conventional-commits preset drives both which commits trigger a release
 * and how the release notes / changelog are grouped.
 */
const DEFAULT_PRESET = 'conventionalcommits'

/**
 * Files committed back to the repository by `@semantic-release/git` after the
 * version bump. `pnpm-lock.yaml` is included so the lockfile stays in sync with
 * the released `package.json` version.
 */
const DEFAULT_GIT_ASSETS = ['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml']

const DEFAULT_GIT_MESSAGE =
  'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'

/**
 * Normalise a `boolean | object` toggle into a plugin options object, or `null`
 * when the plugin should be skipped. `true` uses the provided defaults, an
 * object is shallow-merged over them, and any falsy value disables the plugin.
 *
 * @param {boolean | Record<string, unknown> | undefined} value
 * @param {Record<string, unknown>} defaults
 * @returns {Record<string, unknown> | null}
 */
function toggle(value, defaults) {
  if (!value) return null
  if (value === true) return { ...defaults }
  return { ...defaults, ...value }
}

/**
 * Build a semantic-release configuration from a small set of high-level
 * options. The plugin order is fixed to the order semantic-release expects
 * (analyze → notes → changelog → npm → github → git); toggling a plugin off
 * simply removes it from that pipeline without disturbing the rest.
 *
 * @param {CreateReleaseConfigOptions} [options]
 * @returns {ReleaseConfig}
 */
export function createReleaseConfig(options = {}) {
  const {
    branches = ['main'],
    tagFormat = 'v${version}',
    preset = DEFAULT_PRESET,
    presetConfig,
    releaseRules,
    parserOpts,
    npm = true,
    provenance = true,
    changelog = true,
    changelogFile = 'CHANGELOG.md',
    github = true,
    git = true,
    gitAssets = DEFAULT_GIT_ASSETS,
    gitMessage = DEFAULT_GIT_MESSAGE,
    extraPlugins = [],
  } = options

  const analyzerOptions = {
    preset,
    ...(presetConfig ? { presetConfig } : {}),
    ...(releaseRules ? { releaseRules } : {}),
    ...(parserOpts ? { parserOpts } : {}),
  }

  const notesOptions = {
    preset,
    ...(presetConfig ? { presetConfig } : {}),
    ...(parserOpts ? { parserOpts } : {}),
  }

  /** @type {import('./index.d.ts').PluginSpec[]} */
  const plugins = [
    ['@semantic-release/commit-analyzer', analyzerOptions],
    ['@semantic-release/release-notes-generator', notesOptions],
  ]

  const changelogOptions = toggle(changelog, { changelogFile })
  if (changelogOptions) {
    plugins.push(['@semantic-release/changelog', changelogOptions])
  }

  const npmOptions = toggle(npm, { npmPublish: true, provenance })
  if (npmOptions) {
    plugins.push(['@semantic-release/npm', npmOptions])
  }

  const githubOptions = toggle(github, { assets: [] })
  if (githubOptions) {
    plugins.push(['@semantic-release/github', githubOptions])
  }

  const gitOptions = toggle(git, { assets: gitAssets, message: gitMessage })
  if (gitOptions) {
    plugins.push(['@semantic-release/git', gitOptions])
  }

  for (const plugin of extraPlugins) {
    plugins.push(plugin)
  }

  return { branches, tagFormat, plugins }
}

/**
 * The default, ready-to-use configuration. Consumers can reference it directly
 * from a `.releaserc.json` via `{ "extends": "@krislintigo/release-kit" }`.
 *
 * @type {ReleaseConfig}
 */
export const releaseConfig = createReleaseConfig()

export default releaseConfig
