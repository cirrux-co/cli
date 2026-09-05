import { getActiveCredentials } from './config.js'
import { ExitCode } from './exit-codes.js'
import { outputError, type OutputOptions } from './output.js'

/** Exit with AUTH_REQUIRED unless the CLI has credentials for a workspace. */
export function requireCredentials(options: OutputOptions): void {
  if (!getActiveCredentials()) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }
}
