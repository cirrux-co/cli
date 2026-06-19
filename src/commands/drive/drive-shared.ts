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

/** The chunked multipart route caps files at 2 GiB (server-enforced). */
export const DRIVE_MAX_BYTES = 2 * 1024 * 1024 * 1024

export type MoveDestination =
  | { ok: true; value: string | null }
  | { ok: false; message: string }

/**
 * Resolve a move destination from `--to`/`--root`. They are mutually
 * exclusive and exactly one is required; `--root` resolves to null (the root),
 * `--to` to the target folder UUID.
 */
export function resolveMoveDestination(options: { to?: string; root?: boolean }): MoveDestination {
  if (options.root && options.to) {
    return { ok: false, message: 'Use either --to <folder-uuid> or --root, not both.' }
  }
  if (!options.root && !options.to) {
    return {
      ok: false,
      message: 'Specify a destination with --to <folder-uuid> (or --root to move to the root).',
    }
  }
  return { ok: true, value: options.root ? null : (options.to as string) }
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

    if (error.status === 413 || (error.status === 422 && error.body.includes('file_too_large'))) {
      outputError(`${context.action} failed: file is too large (2 GB max).`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'file_too_large',
      })
    }

    if (error.status === 422 && error.body.includes('storage_limit_exceeded')) {
      outputError(`${context.action} failed: the workspace storage limit has been reached.`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'storage_limit_exceeded',
      })
    }

    if (error.status === 422 && error.body.includes('invalid_move')) {
      outputError(`${context.action} failed: a folder cannot be moved into itself or one of its own subfolders.`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'invalid_move',
      })
    }

    if (error.status === 422 && error.body.includes('name_taken')) {
      outputError(`${context.action} failed: a file or folder with that name already exists in this folder.`, {
        ...options,
        code: ExitCode.CONFLICT,
        errorType: 'name_taken',
        hint: 'Choose a different name and try again.',
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
