/**
 * @import { LintStagedConfig } from './lint-staged.d.ts'
 */

/**
 * Minimal lint-staged configuration that formats every staged file Prettier
 * understands. It intentionally does not assume a linter or a specific set of
 * extensions — extend it in your project when you want type-checking or ESLint
 * on staged files.
 *
 * Requires `prettier` to be available in the consuming project.
 *
 * @type {LintStagedConfig}
 */
const config = {
  '*': 'prettier --ignore-unknown --write',
}

export default config
