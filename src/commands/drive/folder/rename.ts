import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { type DriveFolder, handleDriveError, requireCredentials } from '../drive-shared.js'

export async function driveFolderRenameCommand(
  uuid: string,
  newName: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    const folder = await authedRequest<DriveFolder>(
      `public_api/v1/drive/folders/${encodeURIComponent(uuid)}`,
      { method: 'POST', body: { name: newName } },
    )

    output(folder as unknown as Record<string, unknown>, {
      ...options,
      text: `Renamed folder to ${folder.name} (${folder.uuid})`,
      quietValue: folder.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Rename folder', notFound: `Folder '${uuid}' not found.` })
  }
}
