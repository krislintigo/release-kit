/** A commitlint rule tuple: `[level, applicable, value?]`. */
export type CommitlintRule = [0 | 1 | 2, 'always' | 'never', ...unknown[]]

/** A minimal commitlint configuration shape. */
export interface CommitlintConfig {
  extends?: string[]
  parserPreset?: string | object
  rules?: Record<string, CommitlintRule | [0 | 1 | 2]>
  [key: string]: unknown
}

/** Shared commitlint config built on Conventional Commits. */
declare const config: CommitlintConfig
export default config
