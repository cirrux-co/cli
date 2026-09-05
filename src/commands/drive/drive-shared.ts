import { handleApiError, type ApiErrorRule } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { type OutputOptions } from '../../output.js'

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

export interface DrivePublicLink {
  object: string
  uuid: string
  resource_type: string
  resource_uuid: string
  token: string
  url: string
  status: string
  created_at: string
  updated_at: string
}

export interface DriveAccessGrant {
  object: string
  uuid: string
  principal_type: string
  principal_user_uuid: string | null
  principal_email: string | null
  role: string
  status: string
}

export interface DriveSharing {
  object: string
  resource_type: string
  resource_uuid: string
  accesses: DriveAccessGrant[]
  public_link: DrivePublicLink | null
}

/** Resolve the public API path segment for a resource kind. */
export function resourceKind(options: { folder?: boolean }): 'files' | 'folders' {
  return options.folder ? 'folders' : 'files'
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

export { requireCredentials } from '../../session.js'

const FILE_TOO_LARGE = 'file is too large (2 GB max).'

// Drive's exceptions to the standard ladder. `name_taken` is the one that
// justifies the mechanism: the API answers 422, but a name collision is a
// conflict the caller resolves by picking another name, not a malformed
// request, so it exits 5 rather than 2.
export const DRIVE_ERROR_RULES: ApiErrorRule[] = [
  // A bare 413 comes from the ingress, with no JSON body to carry a code.
  { status: 413, exitCode: ExitCode.USAGE_ERROR, errorType: 'file_too_large', reason: FILE_TOO_LARGE },
  { errorCode: 'file_too_large', exitCode: ExitCode.USAGE_ERROR, reason: FILE_TOO_LARGE },
  {
    errorCode: 'storage_limit_exceeded',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'the workspace storage limit has been reached.',
  },
  {
    errorCode: 'invalid_move',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'a folder cannot be moved into itself or one of its own subfolders.',
  },
  {
    errorCode: 'public_link_exists',
    exitCode: ExitCode.CONFLICT,
    reason: 'a public link already exists for this resource.',
    hint: "Use 'cirrux drive share get' to see it, or revoke it first.",
  },
  {
    errorCode: 'name_taken',
    exitCode: ExitCode.CONFLICT,
    reason: 'a file or folder with that name already exists in this folder.',
    hint: 'Choose a different name and try again.',
  },
]

/** Map a failed Drive API call to a clear message + exit code. */
export function handleDriveError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'Drive', rules: DRIVE_ERROR_RULES })
}
