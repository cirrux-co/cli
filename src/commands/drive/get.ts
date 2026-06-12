import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { type DriveFile, handleDriveError, requireCredentials } from './drive-shared.js'

export async function driveGetCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const file = await authedRequest<DriveFile>(`public_api/v1/drive/files/${encodeURIComponent(uuid)}`)

    output(file as unknown as Record<string, unknown>, {
      ...options,
      text: `${file.uuid}\t${file.name}\t${file.content_type}\t${file.file_size_bytes}`,
      quietValue: file.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, { action: 'Get', notFound: `File '${uuid}' not found.` })
  }
}
