import { authedRequest } from '../../../api.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
import {
  type DriveFolder,
  handleDriveError,
  requireCredentials,
  resolveMoveDestination,
} from '../drive-shared.js'

interface MoveFolderOptions extends OutputOptions {
  to?: string
  root?: boolean
}

export async function driveFolderMoveCommand(uuid: string, options: MoveFolderOptions): Promise<void> {
  requireCredentials(options)

  const destination = resolveMoveDestination(options)
  if (!destination.ok) {
    outputError(destination.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }
  const parentUuid = destination.value

  try {
    const folder = await authedRequest<DriveFolder>(
      `public_api/v1/drive/folders/${encodeURIComponent(uuid)}`,
      { method: 'POST', body: { parent_uuid: parentUuid } },
    )

    output(folder as unknown as Record<string, unknown>, {
      ...options,
      text: `Moved folder ${folder.name} to ${parentUuid ?? 'the root'} (${folder.uuid})`,
      quietValue: folder.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Move folder',
      notFound: `Folder '${uuid}' or destination folder not found.`,
    })
  }
}
