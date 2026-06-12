import { ApiError } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'

export interface DriveFile {
  object: string
  uuid: string
  folder_uuid: string | null
  name: string
  content_type: string
  file_size_bytes: number
  upload_status: string
  created_at: string
  updated_at: string
}

export interface DriveFolder {
  object: string
  uuid: string
  parent_uuid: string | null
  name: string
  color: string | null
}

/** The simple upload/download route caps files at 100 MB (server-enforced). */
export const DRIVE_SIMPLE_ROUTE_MAX_BYTES = 100 * 1024 * 1024

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

/**
 * Map a failed Drive API call to a clear message + exit code. A 403
 * `insufficient_scope` is treated specially: existing sessions predate the
 * Drive scopes, so the fix is to log in again.
 */
export function handleDriveError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  if (error instanceof ApiError) {
    if (error.status === 403 && error.body.includes('insufficient_scope')) {
      outputError('Your session is missing Drive permissions.', {
        ...options,
        code: ExitCode.AUTH_REQUIRED,
        hint: "Run 'cirrux login' again to grant Drive access.",
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

    if (error.status === 413) {
      outputError(`${context.action} failed: file is too large for this route (100 MB max). Use the web app for larger files.`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'file_too_large',
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
