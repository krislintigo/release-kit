#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { check } from './check.js'
import { verifyEnvironment } from './env.js'
import { installHooks } from './hooks.js'
import { lintCommits } from './lint.js'
import { release } from './release.js'
import { init } from './scaffold.js'

const HELP = `release-kit — release tooling for @krislintigo npm packages

Usage:
  release-kit <command> [options]

Commands:
  init           Scaffold config, CI workflow, commitlint, a git hook and
                 release scripts into the current project.
  release        Run semantic-release (reads your .releaserc) after a check.
  commitlint     Lint commit message(s) — used by the commit-msg hook.
  install-hooks  Enable the committed git hooks (sets core.hooksPath).
  check          Lint the package for publishing problems (publint).
  doctor         Report whether the environment is ready to release.
  help           Show this help.

Options:
  init:
    --pm <pnpm|npm|yarn>     Package manager to target (auto-detected).
    --node <version>         Node version for the CI workflow (default 24).
    --force                  Overwrite files that already exist.
  release:
    --dry-run                Compute the next release without publishing.
    --branch <name>          Expected release branch (default main).
    --no-verify              Skip the pre-flight environment check.
  commitlint:
    --edit <file>            Lint the message in <file> (git passes $1).
    --from <ref> --to <ref>  Lint a range of commits (e.g. in CI).
  install-hooks:
    --dir <path>             Hooks directory (default .githooks).
  check:
    --self                   Lint this package (@krislintigo/release-kit).
    --strict                 Treat suggestions as failures.
  doctor:
    --branch <name>          Expected release branch (default main).
    --require-npm-token      Fail if NPM_TOKEN is absent.

Examples:
  release-kit init
  release-kit doctor
  release-kit release --dry-run
`

/**
 * Tiny flag parser: collects `--flag value`, `--flag=value`, and boolean
 * `--flag` / `--no-flag` into a plain object. Unknown positionals are ignored.
 *
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
function parseFlags(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s)
    const key = camelCase(rawKey.replace(/^no-/, ''))
    if (rawKey.startsWith('no-')) {
      flags[key] = false
    } else if (inlineValue !== undefined) {
      flags[key] = inlineValue
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      flags[key] = argv[++i]
    } else {
      flags[key] = true
    }
  }
  return flags
}

/**
 * @param {string} value
 * @returns {string}
 */
function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

function ownPackage() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
}

const green = (text) => `[32m${text}[0m`
const red = (text) => `[31m${text}[0m`
const yellow = (text) => `[33m${text}[0m`
const dim = (text) => `[2m${text}[0m`

async function runInit(flags) {
  const pm = typeof flags.pm === 'string' ? flags.pm : undefined
  if (pm && pm !== 'pnpm' && pm !== 'npm' && pm !== 'yarn') {
    throw new Error(`Unknown package manager "${pm}". Use pnpm, npm, or yarn.`)
  }
  const result = init({
    packageManager: pm,
    node: flags.node ? Number(flags.node) : undefined,
    force: flags.force === true,
  })

  console.log(`\nScaffolding release tooling (${result.packageManager}):\n`)
  const label = { created: green('created'), overwritten: yellow('updated'), skipped: dim('skipped') }
  for (const action of result.actions) {
    console.log(`  ${label[action.status]}  ${action.path}`)
  }

  const pkg = ownPackage().name
  const install =
    result.packageManager === 'npm' ? `npm install -D ${pkg}` : `${result.packageManager} add -D ${pkg}`

  console.log(`\nNext steps:\n`)
  console.log(`  1. Install release-kit — that is the only package you need:`)
  console.log(`       ${install}`)
  console.log(`  2. Commit the generated files; running install activates the git hook.`)
  console.log(`  3. Push to "main" (or run the Release workflow) to publish.`)
  console.log(`\n  ${dim('Releasing needs a GITHUB_TOKEN, and npm trusted publishing or an NPM_TOKEN secret.')}\n`)
}

async function runRelease(flags) {
  // A dry run is a preview and is often run locally without tokens, so skip the
  // pre-flight there; semantic-release still validates what it needs.
  const skipVerify = flags.verify === false || flags.dryRun === true
  if (!skipVerify) {
    const report = verifyEnvironment({
      branch: typeof flags.branch === 'string' ? flags.branch : undefined,
    })
    if (!report.ok) {
      console.error(red('\nEnvironment is not ready to release:\n'))
      for (const issue of report.issues) console.error(`  ${red('✗')} ${issue}`)
      console.error(`\nRe-run with --no-verify to bypass these checks.\n`)
      process.exitCode = 1
      return
    }
  }

  const result = await release({ dryRun: flags.dryRun === true })
  if (!result) {
    console.log(dim('\nNo release published (no relevant commits since the last release).\n'))
    return
  }
  console.log(green(`\nReleased ${result.nextRelease.gitTag} (${result.nextRelease.type}).\n`))
}

async function runCommitlint(flags) {
  const edit = typeof flags.edit === 'string' ? flags.edit : flags.edit === true ? true : undefined
  const from = typeof flags.from === 'string' ? flags.from : undefined
  const to = typeof flags.to === 'string' ? flags.to : undefined

  const { valid, output } = await lintCommits({ edit, from, to })
  if (output.trim()) console.log(output)
  if (!valid) process.exitCode = 1
}

function runInstallHooks(flags) {
  const result = installHooks({ dir: typeof flags.dir === 'string' ? flags.dir : undefined })
  if (result.skipped) {
    console.log(dim('release-kit: no git repository — skipping git hooks setup.'))
  } else {
    console.log(green(`release-kit: git hooks enabled (core.hooksPath = ${result.dir}).`))
  }
}

async function runCheck(flags) {
  const cwd = flags.self === true ? fileURLToPath(new URL('..', import.meta.url)) : process.cwd()
  const result = await check({ cwd, strict: flags.strict === true })

  console.log(`\npublint — ${result.name}\n`)
  if (result.messages.length === 0) {
    console.log(green('  ✓ No problems found.\n'))
  } else {
    for (const message of result.messages) {
      const mark = message.type === 'error' ? red('✗') : message.type === 'warning' ? yellow('!') : dim('•')
      console.log(`  ${mark} ${message.text}`)
    }
    console.log('')
  }
  if (!result.ok) process.exitCode = 1
}

async function runDoctor(flags) {
  const report = verifyEnvironment({
    branch: typeof flags.branch === 'string' ? flags.branch : undefined,
    requireNpmToken: flags.requireNpmToken === true,
  })

  const yesNo = (value) => (value ? green('yes') : red('no'))
  console.log(`\nRelease readiness:\n`)
  console.log(`  GitHub token   ${yesNo(report.info.githubToken)}`)
  console.log(`  npm token      ${report.info.npmToken ? green('yes') : dim('no (OIDC?)')}`)
  console.log(`  Branch         ${report.info.branch ?? dim('unknown')}`)
  console.log(`  Clean tree     ${report.info.clean === undefined ? dim('unknown') : yesNo(report.info.clean)}`)

  if (report.ok) {
    console.log(green('\n  ✓ Ready to release.\n'))
  } else {
    console.log('')
    for (const issue of report.issues) console.log(`  ${yellow('!')} ${issue}`)
    console.log('')
    process.exitCode = 1
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const flags = parseFlags(rest)

  switch (command) {
    case 'init':
      return runInit(flags)
    case 'release':
      return runRelease(flags)
    case 'commitlint':
      return runCommitlint(flags)
    case 'install-hooks':
      return runInstallHooks(flags)
    case 'check':
      return runCheck(flags)
    case 'doctor':
      return runDoctor(flags)
    case 'version':
    case '--version':
    case '-v':
      console.log(ownPackage().version)
      return
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return
    default:
      console.error(red(`Unknown command "${command}".\n`))
      console.log(HELP)
      process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(red(`\n${error?.message ?? error}\n`))
  process.exitCode = 1
})
