import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { type DriveFolder, handleDriveError, requireCredentials } from '../drive-shared.js'

export async function driveFolderTrashCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const folder = await authedRequest<DriveFolder>(
      `public_api/v1/drive/folders/${encodeURIComponent(uuid)}/trash`,
      { method: 'POST' },
    )

    output(folder as unknown as Record<string, unknown>, {
      ...options,
      text: `Trashed folder ${folder.name} (${folder.uuid})`,
      quietValue: folder.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Trash folder', notFound: `Folder '${uuid}' not found.` })
  }
}
