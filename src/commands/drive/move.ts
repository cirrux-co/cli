import { authedRequest } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  type DriveFile,
  handleDriveError,
  requireCredentials,
  resolveMoveDestination,
} from './drive-shared.js'

interface MoveOptions extends OutputOptions {
  to?: string
  root?: boolean
}

export async function driveMoveCommand(uuid: string, options: MoveOptions): Promise<void> {
  requireCredentials(options)

  const destination = resolveMoveDestination(options)
  if (!destination.ok) {
    outputError(destination.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }
  const folderUuid = destination.value

  try {
    const file = await authedRequest<DriveFile>(
      `public_api/v1/drive/files/${encodeURIComponent(uuid)}`,
      { method: 'POST', body: { folder_uuid: folderUuid } },
    )

    output(file as unknown as Record<string, unknown>, {
      ...options,
      text: `Moved ${file.name} to ${folderUuid ?? 'the root'} (${file.uuid})`,
      quietValue: file.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Move',
      notFound: `File '${uuid}' or destination folder not found.`,
    })
  }
}
