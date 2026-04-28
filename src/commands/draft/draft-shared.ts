import { ApiError } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'
import { parseApiErrorDescription } from '../email/labels.js'

export interface Draft {
  object: 'draft'
  uuid: string
  mailbox_uuid: string
  thread_uuid: string
  in_reply_to_email_uuid: string | null
  from: { address: string; name: string | null }[]
  to: { address: string; name: string | null }[]
  cc: { address: string; name: string | null }[]
  bcc: { address: string; name: string | null }[]
  subject: string | null
  snippet: string | null
  body_html: string | null
  body_text: string | null
  labels: string[]
  created_at: string
  updated_at: string
}

export function ensureCreds(options: OutputOptions): void {
  if (!getActiveCredentials()) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }
}

export function handleDraftError(
  error: unknown,
  fallbackMessage: string,
  options: OutputOptions,
): never {
  if (error instanceof ApiError) {
    const description = parseApiErrorDescription(error.body) ?? error.body

    if (error.status === 404) {
      outputError(description, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    if (error.status === 422) {
      const errorType = parseApiErrorType(error.body) ?? 'invalid_value'
      outputError(description, {
        ...options,
        code: ExitCode.GENERAL_FAILURE,
        errorType,
      })
    }

    if (error.status === 400) {
      outputError(description, {
        ...options,
        code: ExitCode.GENERAL_FAILURE,
        errorType: 'invalid_body',
      })
    }

    if (error.status === 403) {
      outputError(description || 'Forbidden.', {
        ...options,
        code: ExitCode.AUTH_REQUIRED,
        errorType: 'forbidden',
      })
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  outputError(`${fallbackMessage}: ${message}`, {
    ...options,
    code: ExitCode.GENERAL_FAILURE,
    errorType: 'api_error',
  })
}

function parseApiErrorType(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: unknown }
    return typeof parsed.error === 'string' ? parsed.error : null
  } catch {
    return null
  }
}
