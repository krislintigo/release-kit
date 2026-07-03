/** A lint-staged command: a string, or an array of commands, or a function. */
export type LintStagedCommand =
  | string
  | string[]
  | ((filenames: string[]) => string | string[] | Promise<string | string[]>)

/** A lint-staged configuration mapping globs to commands. */
export interface LintStagedConfig {
  [glob: string]: LintStagedCommand
}

/** Shared lint-staged config that formats staged files with Prettier. */
declare const config: LintStagedConfig
export default config
