import { authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { formatAddress } from '../thread/list.js'

interface EmailAttachment {
  object: string
  uuid: string
  filename: string
  content_type: string
  file_size_bytes: number
}

interface Email {
  object: string
  uuid: string
  thread_uuid: string
  from: { name: string | null; address: string }[]
  to: { name: string | null; address: string }[]
  cc: { name: string | null; address: string }[] | null
  subject: string
  snippet: string | null
  is_read: boolean
  is_flagged: boolean
  date: string
  labels: string[]
  attachments: EmailAttachment[]
}

export async function emailGetCommand(uuid: string, options: OutputOptions): Promise<void> {
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
    const email = await authedRequest<Email>(`public_api/v1/email/${encodeURIComponent(uuid)}`)

    const from = email.from?.map(formatAddress).join(', ') ?? 'Unknown'
    const to = email.to?.map(formatAddress).join(', ') ?? ''
    const cc = email.cc?.map(formatAddress).join(', ')
    const attachments = email.attachments?.length
      ? email.attachments.map((a) => `${a.filename} (${a.content_type}, ${a.file_size_bytes} bytes)`).join(', ')
      : 'None'

    const lines = [
      `UUID:        ${email.uuid}`,
      `Thread:      ${email.thread_uuid}`,
      `Subject:     ${email.subject}`,
      `From:        ${from}`,
      `To:          ${to}`,
      ...(cc ? [`CC:          ${cc}`] : []),
      `Date:        ${email.date}`,
      `Read:        ${email.is_read ? 'Yes' : 'No'}`,
      `Flagged:     ${email.is_flagged ? 'Yes' : 'No'}`,
      `Labels:      ${email.labels.join(', ') || 'None'}`,
      `Attachments: ${attachments}`,
      ...(email.snippet ? [`Snippet:     ${email.snippet}`] : []),
    ]

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: lines.join('\n'),
      quietValue: email.uuid,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Email '${uuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to fetch email: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
