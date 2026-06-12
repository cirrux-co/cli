import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { handleDriveError, requireCredentials } from './drive-shared.js'

interface DriveDownloadResponse {
  uuid: string
  name: string
  content_type: string
  size: number
  data: string
}

export async function driveDownloadCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const result = await authedRequest<DriveDownloadResponse>(
      `public_api/v1/drive/files/${encodeURIComponent(uuid)}/download`,
    )

    if (options.json) {
      output(result as unknown as Record<string, unknown>, {
        ...options,
        text: '',
        quietValue: result.data,
      })
      return
    }

    if (options.quiet) {
      process.stdout.write(result.data + '\n')
      return
    }

    // Default: write the decoded bytes to stdout (pipe to a file with `> out`).
    process.stdout.write(Buffer.from(result.data, 'base64url'))
  } catch (error) {
    handleDriveError(error, options, { action: 'Download', notFound: `File '${uuid}' not found.` })
  }
}
