export { createReleaseConfig, releaseConfig } from './config.js'
export { release, dryRun } from './release.js'
export { verifyEnvironment } from './env.js'
export { check } from './check.js'
export { init, detectPackageManager } from './scaffold.js'
export { installHooks } from './hooks.js'
export { lintCommits } from './lint.js'
export { default as commitlintConfig } from './commitlint.js'

// The default export is the ready-to-use shareable config, so a project can do:
//   { "extends": "@krislintigo/release-kit" }
export { default } from './config.js'
