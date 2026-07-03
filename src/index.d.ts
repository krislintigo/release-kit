import type { CommitlintConfig } from './commitlint.d.ts'
import type { LintStagedConfig } from './lint-staged.d.ts'

/** A semantic-release plugin: a module name, or `[name, options]`. */
export type PluginSpec = string | [string, Record<string, unknown>]

/** A release branch: a name, a glob, or a branch object (maintenance/prerelease). */
export type ReleaseBranch =
  | string
  | {
      name: string
      channel?: string | false
      prerelease?: boolean | string
      range?: string
    }

/** A fully-formed semantic-release configuration. */
export interface ReleaseConfig {
  branches: ReleaseBranch[]
  tagFormat: string
  plugins: PluginSpec[]
}

/** Options for {@link createReleaseConfig}. Every field has a sensible default. */
export interface CreateReleaseConfigOptions {
  /** Release branches. Default: `['main']`. */
  branches?: ReleaseBranch[]
  /** Git tag format. Default: `'v${version}'`. */
  tagFormat?: string
  /** conventional-changelog preset. Default: `'conventionalcommits'`. */
  preset?: string
  /** Extra configuration passed to the preset (e.g. custom `types`). */
  presetConfig?: Record<string, unknown>
  /** Custom rules deciding which commits trigger which release type. */
  releaseRules?: Array<Record<string, unknown>>
  /** Custom commit-parser options. */
  parserOpts?: Record<string, unknown>
  /** Publish to npm. `true` (default), `false`, or `@semantic-release/npm` options. */
  npm?:
    | boolean
    | { npmPublish?: boolean; provenance?: boolean; pkgRoot?: string; tarballDir?: string }
  /** Enable npm provenance when publishing. Default: `true`. */
  provenance?: boolean
  /** Write a changelog file. `true` (default), `false`, or plugin options. */
  changelog?: boolean | { changelogFile?: string; changelogTitle?: string }
  /** Changelog file path when `changelog` is enabled. Default: `'CHANGELOG.md'`. */
  changelogFile?: string
  /** Create a GitHub release. `true` (default), `false`, or `@semantic-release/github` options. */
  github?: boolean | Record<string, unknown>
  /** Commit release artifacts back to git. `true` (default), `false`, or plugin options. */
  git?: boolean | { assets?: string[]; message?: string }
  /** Files committed by `@semantic-release/git`. Default: CHANGELOG, package.json, pnpm-lock. */
  gitAssets?: string[]
  /** Commit message for the release commit. */
  gitMessage?: string
  /** Extra plugins appended to the end of the pipeline. */
  extraPlugins?: PluginSpec[]
}

/**
 * Build a semantic-release configuration from high-level options, preserving the
 * plugin order semantic-release requires.
 */
export function createReleaseConfig(options?: CreateReleaseConfigOptions): ReleaseConfig

/** The default, ready-to-use configuration (`createReleaseConfig()`). */
export declare const releaseConfig: ReleaseConfig

/** Options for {@link verifyEnvironment}. */
export interface VerifyEnvironmentOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  /** Branch a release is expected to run from. Default: `'main'`. */
  branch?: string
  /** Flag a missing `NPM_TOKEN` as a blocking issue. Default: `false`. */
  requireNpmToken?: boolean
}

/** Result of {@link verifyEnvironment}. */
export interface EnvironmentReport {
  ok: boolean
  issues: string[]
  info: {
    githubToken?: boolean
    npmToken?: boolean
    branch?: string
    clean?: boolean
  }
}

/** Inspect the local environment for release readiness. Never throws. */
export function verifyEnvironment(options?: VerifyEnvironmentOptions): EnvironmentReport

/** A single release, as reported by semantic-release. */
export interface ReleaseResult {
  nextRelease: {
    type: string
    version: string
    gitTag: string
    gitHead: string
    notes?: string
  }
  commits: unknown[]
  releases: unknown[]
  [key: string]: unknown
}

/** Options for {@link release} / {@link dryRun}: any config option, plus runtime options. */
export interface ReleaseOptions extends CreateReleaseConfigOptions {
  /** Use this config verbatim instead of building one from the other options. */
  config?: ReleaseConfig
  dryRun?: boolean
  cwd?: string
  env?: Record<string, string | undefined>
}

/** Run semantic-release programmatically. Resolves to `false` when nothing was released. */
export function release(options?: ReleaseOptions): Promise<ReleaseResult | false>

/** Run a release in dry-run mode. */
export function dryRun(options?: ReleaseOptions): Promise<ReleaseResult | false>

/** Options for {@link check}. */
export interface CheckOptions {
  cwd?: string
  /** Lowest publint level to report. Default: `'suggestion'`. */
  level?: 'suggestion' | 'warning' | 'error'
  /** Treat the package as strictly as possible. Default: `false`. */
  strict?: boolean
}

/** A single formatted publint message. */
export interface CheckMessage {
  type: 'error' | 'warning' | 'suggestion'
  text: string
}

/** Result of {@link check}. */
export interface CheckResult {
  ok: boolean
  name: string
  messages: CheckMessage[]
  errors: number
  warnings: number
}

/** Lint a package for publishing problems with publint. */
export function check(options?: CheckOptions): Promise<CheckResult>

/** Supported package managers. */
export type PackageManager = 'pnpm' | 'npm' | 'yarn'

/** A single file operation performed by {@link init}. */
export interface ScaffoldAction {
  path: string
  status: 'created' | 'overwritten' | 'skipped'
}

/** Options for {@link init}. */
export interface InitOptions {
  cwd?: string
  /** Package manager to target. Auto-detected when omitted. */
  packageManager?: PackageManager
  /** Node version written into the CI workflow. Default: `24`. */
  node?: number
  /** Create the husky commit-msg hook. Default: `true`. */
  hooks?: boolean
  /** Overwrite files that already exist. Default: `false`. */
  force?: boolean
}

/** Result of {@link init}. */
export interface InitResult {
  packageManager: PackageManager
  actions: ScaffoldAction[]
  /** Dev dependencies the project should install to complete setup. */
  devDependencies: string[]
}

/** Scaffold release tooling into a project. */
export function init(options?: InitOptions): InitResult

/** Detect a project's package manager from its `packageManager` field or lockfile. */
export function detectPackageManager(cwd: string): PackageManager

/** The shared commitlint configuration (also at `@krislintigo/release-kit/commitlint`). */
export declare const commitlintConfig: CommitlintConfig

/** The shared lint-staged configuration (also at `@krislintigo/release-kit/lint-staged`). */
export declare const lintStagedConfig: LintStagedConfig

export type { CommitlintConfig, LintStagedConfig }

declare const _default: ReleaseConfig
export default _default
