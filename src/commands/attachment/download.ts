import { apiRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'

interface AttachmentData {
  uuid: string
  size: number
  data: string
}

export async function attachmentDownloadCommand(uuid: string, options: OutputOptions): Promise<void> {
  const creds = getActiveCredentials()
  if (!creds) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }

  try {
    const result = await apiRequest<AttachmentData>(
      `public_api/v1/email_attachment/${encodeURIComponent(uuid)}/get`,
      { token: creds.access_token },
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
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Attachment '${uuid}' not found or content not available.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to download attachment: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
