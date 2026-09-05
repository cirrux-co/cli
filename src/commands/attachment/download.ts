import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'

interface AttachmentData {
  uuid: string
  size: number
  data: string
}

export async function attachmentDownloadCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const result = await authedRequest<AttachmentData>(
      `public_api/v1/email_attachments/${encodeURIComponent(uuid)}/get`,
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

    // Default: write decoded binary to stdout (for piping to file)
    const decoded = Buffer.from(result.data, 'base64url')
    process.stdout.write(decoded)
  } catch (error) {
    handleApiError(error, options, {
      action: 'Download attachment',
      scope: 'email',
      notFound: `Attachment '${uuid}' not found or content not available.`,
    })
  }
}
