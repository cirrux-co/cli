import { ApiError, AuthRefreshFailedError } from './api.js'
import { ExitCode } from './exit-codes.js'
import { outputError, type OutputOptions } from './output.js'

// The single place an API failure becomes an exit code.
//
// Commands must never sniff the error message to decide what went wrong. The
// API puts its description in `error_description`, and ApiError prefers that
// for `Error.message`, so the message does NOT contain the status code — a
// `message.includes('404')` test is dead code, and a `body.includes('...')`
// test can be fooled by a description echoing a filename. Match on `status`
// and the parsed `errorCode` instead.

/** At least one of `status`/`errorCode` is mandatory, so a rule always narrows. */
type ApiErrorMatcher =
  | { status: number | number[]; errorCode?: string }
  | { status?: number | number[]; errorCode: string }

/**
 * A domain's exception to the standard ladder, expressed as data. Rules are
 * tried in order and the first match wins, all before the ladder below.
 */
export type ApiErrorRule = ApiErrorMatcher & {
  exitCode: ExitCode
  /** Defaults to the body's `error` code. */
  errorType?: string
  /** Rendered as "<action> failed: <reason>". Defaults to the API's description. */
  reason?: string
  hint?: string
}

export interface ApiErrorContext {
  /** Capitalised verb phrase naming the attempt, e.g. 'Fetch mailbox'. */
  action: string
  /** Message for a 404. Falls back to the API's description, then 'Not found.' */
  notFound?: string
  /** Noun phrase for the insufficient_scope wording, e.g. 'Drive', 'calendar'. */
  scope?: string
  rules?: ApiErrorRule[]
}

export interface ErrorClassification {
  code: ExitCode
  message: string
  errorType: string
  hint?: string
}

const RATE_LIMIT_HINT = 'Wait a moment before retrying, or slow the request rate.'

function matches(rule: ApiErrorRule, error: ApiError): boolean {
  if (rule.errorCode !== undefined && rule.errorCode !== error.errorCode) return false
  if (rule.status !== undefined) {
    const statuses = Array.isArray(rule.status) ? rule.status : [rule.status]
    if (!statuses.includes(error.status)) return false
  }
  return true
}

function rateLimitHint(error: ApiError): string {
  if (error.retryAfterMs === undefined) return RATE_LIMIT_HINT
  return `Wait ${Math.ceil(error.retryAfterMs / 1000)}s before retrying, or slow the request rate.`
}

/**
 * Decide the exit code, message and error type for a failed API call.
 *
 * Pure: it reads no process state and writes nothing, so it can be unit-tested
 * directly. `handleApiError` is the thin wrapper that prints and exits.
 */
export function classifyApiError(error: unknown, context: ApiErrorContext): ErrorClassification {
  const { action } = context
  const failed = (reason: string): string => `${action} failed: ${reason}`

  if (!(error instanceof ApiError)) {
    if (error instanceof AuthRefreshFailedError) {
      return {
        code: ExitCode.AUTH_REQUIRED,
        message: error.message,
        errorType: 'auth_required',
        hint: "Run 'cirrux login' to sign in again.",
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { code: ExitCode.GENERAL_FAILURE, message: failed(message), errorType: 'api_error' }
  }

  for (const rule of context.rules ?? []) {
    if (!matches(rule, error)) continue
    return {
      code: rule.exitCode,
      message: failed(rule.reason ?? error.description ?? 'the request was rejected.'),
      errorType: rule.errorType ?? error.errorCode ?? 'api_error',
      ...(rule.hint ? { hint: rule.hint } : {}),
    }
  }

  if (error.status === 401) {
    return {
      code: ExitCode.AUTH_REQUIRED,
      message: 'Your session is no longer valid.',
      errorType: 'auth_required',
      hint: "Run 'cirrux login' to sign in again.",
    }
  }

  // Sessions created before a scope existed lack it, so the fix is to log in
  // again rather than anything about this particular request.
  if (error.status === 403 && error.errorCode === 'insufficient_scope') {
    const scope = context.scope
    return {
      code: ExitCode.AUTH_REQUIRED,
      message: `Your session is missing ${scope ?? 'the required'} permissions.`,
      errorType: 'insufficient_scope',
      hint: `Run 'cirrux login' again to grant ${scope ?? 'the required'} access.`,
    }
  }

  if (error.status === 404) {
    return {
      code: ExitCode.NOT_FOUND,
      message: context.notFound ?? error.description ?? 'Not found.',
      errorType: 'not_found',
    }
  }

  if (error.status === 403) {
    return {
      code: ExitCode.AUTH_REQUIRED,
      message: 'You do not have permission to perform this action.',
      errorType: 'forbidden',
    }
  }

  if (error.status === 409) {
    return {
      code: ExitCode.CONFLICT,
      message: failed(error.description ?? 'it conflicts with the current state.'),
      errorType: error.errorCode ?? 'conflict',
    }
  }

  // Reached only after the HTTP layer's automatic retries are exhausted, i.e.
  // the limit stayed saturated. Give scripts a stable signal to back off on.
  if (error.status === 429) {
    return {
      code: ExitCode.RATE_LIMITED,
      message: failed('rate limit exceeded.'),
      errorType: 'rate_limited',
      hint: rateLimitHint(error),
    }
  }

  if (error.status === 422 || error.status === 400) {
    return {
      code: ExitCode.USAGE_ERROR,
      message: failed(error.description ?? 'the request was rejected.'),
      errorType: error.errorCode ?? (error.status === 422 ? 'invalid_value' : 'invalid_body'),
    }
  }

  return {
    code: ExitCode.GENERAL_FAILURE,
    message: failed(error.description ?? error.message),
    errorType: 'api_error',
  }
}

/**
 * Print a failed API call and exit with the right code.
 *
 * Domain helpers wrap this only to bind `scope`/`rules` — a wrapper never
 * contains a branch. New domain behaviour goes in an `ApiErrorRule`.
 */
export function handleApiError(
  error: unknown,
  options: OutputOptions,
  context: ApiErrorContext,
): never {
  const { code, message, errorType, hint } = classifyApiError(error, context)
  outputError(message, { ...options, code, errorType, ...(hint ? { hint } : {}) })
}
