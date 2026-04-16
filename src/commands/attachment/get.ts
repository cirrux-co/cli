import { authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'

interface EmailAttachment {
  object: string
  uuid: string
  filename: string
  content_type: string
  file_size_bytes: number
}

export async function attachmentGetCommand(uuid: string, options: OutputOptions): Promise<void> {
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
    const attachment = await authedRequest<EmailAttachment>(
      `public_api/v1/email_attachment/${encodeURIComponent(uuid)}`,
    )

    const lines = [
      `UUID:         ${attachment.uuid}`,
      `Filename:     ${attachment.filename}`,
      `Content-Type: ${attachment.content_type}`,
      `Size:         ${attachment.file_size_bytes} bytes`,
    ]

    output(attachment as unknown as Record<string, unknown>, {
      ...options,
      text: lines.join('\n'),
      quietValue: attachment.uuid,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Attachment '${uuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to fetch attachment: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
