import { login } from '../auth.js'
import { ExitCode } from '../exit-codes.js'
import { outputError } from '../output.js'

export async function loginCommand(options: { browser?: boolean; json?: boolean } = {}): Promise<void> {
  try {
    // Commander negates `--no-browser` into `options.browser === false`.
    await login({ noBrowser: options.browser === false, json: options.json })
  } catch (error) {
    outputError(error instanceof Error ? error.message : String(error), {
      code: ExitCode.GENERAL_FAILURE,
      json: options.json,
      errorType: 'login_failed',
    })
  }
}
