import { authedRequestVoid } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { handleDriveError, requireCredentials } from '../drive-shared.js'

export async function driveFolderDeleteCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    await authedRequestVoid(`public_api/v1/drive/folders/${encodeURIComponent(uuid)}`, { method: 'DELETE' })

    output({ uuid, deleted: true }, {
      ...options,
      text: `Deleted folder ${uuid}`,
      quietValue: uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Delete folder', notFound: `Folder '${uuid}' not found.` })
  }
}
