import { offerAgentSetup } from '../agent-setup.js'
import { apiKeyStillInUseNotice } from '../api-key.js'
import { login } from '../auth.js'
import { ExitCode } from '../exit-codes.js'
import { InvalidLoginScopesError, parseLoginScopes } from '../login-scopes.js'
import { outputError } from '../output.js'

export async function loginCommand(
  options: { browser?: boolean; json?: boolean; scopes?: string } = {},
): Promise<void> {
  let scopes: string[] | undefined
  try {
    scopes = parseLoginScopes(options.scopes)
  } catch (error) {
    if (!(error instanceof InvalidLoginScopesError)) throw error
    outputError(error.message, { code: ExitCode.USAGE_ERROR, json: options.json, errorType: 'invalid_scope' })
  }

  try {
    // Commander negates `--no-browser` into `options.browser === false`.
    await login({ noBrowser: options.browser === false, json: options.json, scopes })
  } catch (error) {
    outputError(error instanceof Error ? error.message : String(error), {
      code: ExitCode.GENERAL_FAILURE,
      json: options.json,
      errorType: 'login_failed',
    })
  }

  const notice = apiKeyStillInUseNotice()
  if (notice) process.stderr.write(`${notice}\n`)

  if (!options.json && process.stdin.isTTY && process.stdout.isTTY) {
    await offerAgentSetup()
  }
}
