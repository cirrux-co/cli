import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { type DriveFile, handleDriveError, requireCredentials } from './drive-shared.js'

export async function driveTrashCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const file = await authedRequest<DriveFile>(
      `public_api/v1/drive/files/${encodeURIComponent(uuid)}/trash`,
      { method: 'POST' },
    )

    output(file as unknown as Record<string, unknown>, {
      ...options,
      text: `Trashed ${file.name} (${file.uuid})`,
      quietValue: file.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Trash', notFound: `File '${uuid}' not found.` })
  }
}
