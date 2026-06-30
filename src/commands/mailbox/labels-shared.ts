import { ApiError } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'

export interface Label {
  object: string
  uuid: string
  name: string
  type: string
  color: string | null
  description: string | null
  is_visible: boolean
  position: number
}

/** Exit early with a clear message when there are no stored credentials. */
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

/** Map a failed label API call to a clear message + exit code. */
export function handleLabelError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  if (error instanceof ApiError) {
    const description = error.description ?? error.body

    if (error.status === 403 && error.body.includes('insufficient_scope')) {
      outputError('Your session is missing the permissions to manage labels.', {
        ...options,
        code: ExitCode.AUTH_REQUIRED,
        hint: "Run 'cirrux login' again to grant write access.",
        errorType: 'insufficient_scope',
      })
    }

    if (error.status === 404) {
      outputError(context.notFound ?? 'Not found.', {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    if (error.status === 403) {
      outputError('You do not have permission to perform this action.', {
        ...options,
        code: ExitCode.AUTH_REQUIRED,
        errorType: 'forbidden',
      })
    }

    if (error.status === 422 || error.status === 400) {
      outputError(`${context.action} failed: ${description}`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: error.status === 422 ? 'invalid_value' : 'invalid_body',
      })
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  outputError(`${context.action} failed: ${message}`, {
    ...options,
    code: ExitCode.GENERAL_FAILURE,
    errorType: 'api_error',
  })
}
