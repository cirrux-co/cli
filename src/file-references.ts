import { type ApiErrorRule } from './api-errors.js'
import { ExitCode } from './exit-codes.js'

/**
 * A file already in Cirrux, named by uuid: the server copies it, so its bytes never pass through
 * the CLI. An email attachment, or a Drive file.
 */
export type FileReference = { attachment_uuid: string } | { drive_file_uuid: string }

// Commander option collector for repeatable uuid flags.
export function collectUuid(value: string, previous: string[]): string[] {
  return [...previous, value]
}

/** Pure: the references for repeated attachment and Drive file flags, attachments first. */
export function fileReferences(attachmentUuids: string[] = [], driveFileUuids: string[] = []): FileReference[] {
  return [
    ...attachmentUuids.map((uuid) => ({ attachment_uuid: uuid })),
    ...driveFileUuids.map((uuid) => ({ drive_file_uuid: uuid })),
  ]
}

// A referenced file that isn't there is its own 404, so it never reads as the draft or folder
// being missing. Every other refusal (too large, still uploading) is a 422 the ladder already
// reports with the API's description.
export const FILE_REFERENCE_ERROR_RULES: ApiErrorRule[] = [
  {
    errorCode: 'attachment_not_found',
    exitCode: ExitCode.NOT_FOUND,
    hint: "'cirrux email get <email-uuid> --json' lists an email's attachments with their uuids.",
  },
  {
    errorCode: 'drive_file_not_found',
    exitCode: ExitCode.NOT_FOUND,
    hint: "Find Drive files with 'cirrux drive search <query>'.",
  },
]
