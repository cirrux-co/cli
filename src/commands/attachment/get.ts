import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'

interface EmailAttachment {
  object: string
  uuid: string
  filename: string
  content_type: string
  file_size_bytes: number
}

export async function attachmentGetCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const attachment = await authedRequest<EmailAttachment>(
      `public_api/v1/email_attachments/${encodeURIComponent(uuid)}`,
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
    handleApiError(error, options, {
      action: 'Fetch attachment',
      scope: 'email',
      notFound: `Attachment '${uuid}' not found.`,
    })
  }
}
