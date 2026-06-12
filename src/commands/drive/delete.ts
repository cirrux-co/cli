import { authedRequestVoid } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { handleDriveError, requireCredentials } from './drive-shared.js'

export async function driveDeleteCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    await authedRequestVoid(`public_api/v1/drive/files/${encodeURIComponent(uuid)}`, { method: 'DELETE' })

    output({ uuid, deleted: true }, {
      ...options,
      text: `Deleted ${uuid}`,
      quietValue: uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Delete', notFound: `File '${uuid}' not found.` })
  }
}
