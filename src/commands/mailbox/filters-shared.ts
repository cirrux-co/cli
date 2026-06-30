import { ApiError, parseApiErrorDescription } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'

export { requireCredentials } from './labels-shared.js'

export interface Filter {
  object: string
  uuid: string
  mailbox_uuid: string
  name: string
  description: string | null
  status: string
  priority: number
  stop_processing: boolean
  condition_ast: unknown
  actions: unknown[]
  match_count: number
  last_matched_at: string | null
  created_at: string
  updated_at: string | null
}

/** Map a failed filter API call to a clear message + exit code. */
export function handleFilterError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  if (error instanceof ApiError) {
    const description = parseApiErrorDescription(error.body) ?? error.body

    if (error.status === 403 && error.body.includes('insufficient_scope')) {
      outputError('Your session is missing the permissions to manage filters.', {
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
