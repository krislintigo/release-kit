/**
 * @import { CommitlintConfig } from './commitlint.d.ts'
 */

/**
 * Shared commitlint configuration built on the Conventional Commits standard so
 * that it stays in lockstep with the `conventionalcommits` preset used by
 * semantic-release: the commit types you are allowed to write here are exactly
 * the ones the release pipeline knows how to turn into a version bump.
 *
 * The line-length limits are relaxed because semantic-release itself writes
 * release commits whose body embeds the full generated release notes.
 *
 * @type {CommitlintConfig}
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
  },
}

export default config
