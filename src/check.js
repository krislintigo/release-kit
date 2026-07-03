import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/**
 * @import { CheckOptions, CheckResult } from './index.d.ts'
 */

/**
 * Lint a package for publishing problems with publint (broken `exports`, missing
 * files, wrong module types, ...). Returns a structured result; it does not exit
 * the process, so it can be used both from the CLI and from your own scripts.
 *
 * @param {CheckOptions} [options]
 * @returns {Promise<CheckResult>}
 */
export async function check(options = {}) {
  const { cwd = process.cwd(), level = 'suggestion', strict = false } = options

  // Namespace import so a future publint that renames/removes an export does not
  // turn into a hard ESM binding error at module-load time.
  const publintModule = await import('publint')
  const publint = publintModule.publint
  const formatMessage = publintModule.formatMessage

  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  const { messages } = await publint({ pkgDir: cwd, level, strict })

  const formatted = messages.map((message) => ({
    type: message.type,
    text:
      typeof formatMessage === 'function'
        ? (formatMessage(message, pkg) ?? describe(message))
        : describe(message),
  }))

  const errors = formatted.filter((message) => message.type === 'error').length
  const warnings = formatted.filter((message) => message.type === 'warning').length

  return { ok: errors === 0, name: pkg.name, messages: formatted, errors, warnings }
}

/**
 * Fallback one-line description when publint's own formatter is unavailable.
 *
 * @param {{ code: string, path?: string[] }} message
 * @returns {string}
 */
function describe(message) {
  const path = Array.isArray(message.path) && message.path.length > 0 ? ` (${message.path.join('.')})` : ''
  return `${message.code}${path}`
}
