import { authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { formatAddress, formatDate } from './list.js'

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
  read_at: string | null
  flagged_at: string | null
  date: string
  labels: string[]
  attachments: EmailAttachment[]
}

interface Thread {
  object: string
  uuid: string
  mailbox_uuid: string
  last_email_received_at: string | null
  last_email_sent_at: string | null
  emails: Email[]
}

export function formatEmailLine(email: Email): string {
  const from = email.from[0] ? formatAddress(email.from[0]) : 'Unknown'
  const flags: string[] = []
  if (!email.read_at) flags.push('unread')
  if (email.flagged_at) flags.push('flagged')
  if (email.attachments.length > 0) flags.push(`${email.attachments.length} attachment${email.attachments.length === 1 ? '' : 's'}`)
  const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : ''
  const labels = email.labels.length > 0 ? `\n    Labels: ${email.labels.join(', ')}` : ''

  return [
    `  ${email.uuid}${flagStr}`,
    `    ${formatDate(email.date)}  ${from}`,
    `    ${email.subject || '(no subject)'}${labels}`,
  ].join('\n')
}

export function formatThreadDetail(thread: Thread): string {
  const header = `Thread: ${thread.uuid}  (${thread.emails.length} email${thread.emails.length === 1 ? '' : 's'})`
  const body = thread.emails.map(formatEmailLine).join('\n\n')
  return body.length > 0 ? `${header}\n\n${body}` : `${header}\n\n  (no emails)`
}

export async function threadGetCommand(uuid: string, options: OutputOptions): Promise<void> {
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
    const thread = await authedRequest<Thread>(`public_api/v1/threads/${encodeURIComponent(uuid)}`)

    const quietValue = thread.emails.map((e) => e.uuid).join('\n')

    output(thread as unknown as Record<string, unknown>, {
      ...options,
      text: formatThreadDetail(thread),
      quietValue,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Thread '${uuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to fetch thread: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
