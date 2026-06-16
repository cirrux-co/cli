import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { type DriveFolder, handleDriveError, requireCredentials } from '../drive-shared.js'

export async function driveFolderGetCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const folder = await authedRequest<DriveFolder>(
      `public_api/v1/drive/folders/${encodeURIComponent(uuid)}`,
    )

    output(folder as unknown as Record<string, unknown>, {
      ...options,
      text: `${folder.name} (${folder.uuid})`,
      quietValue: folder.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Get folder', notFound: `Folder '${uuid}' not found.` })
  }
}
