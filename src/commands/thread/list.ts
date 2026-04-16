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

interface Email {
  object: string
  uuid: string
  thread_uuid: string
  from: { name: string | null; address: string }[]
  to: { name: string | null; address: string }[]
  cc: { name: string | null; address: string }[]
  subject: string
  snippet: string | null
  is_read: boolean
  is_flagged: boolean
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

interface ThreadListResponse {
  object: string
  url: string
  has_more: boolean
  next_cursor?: string
  data: Thread[]
}

export function formatAddress(addr: { name: string | null; address: string }): string {
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatThread(thread: Thread): string {
  const lines: string[] = []
  const lastEmail = thread.emails[thread.emails.length - 1]
  const from = lastEmail ? formatAddress(lastEmail.from[0]) : 'Unknown'
  const subject = lastEmail?.subject || '(no subject)'
  const count = thread.emails.length
  const unread = thread.emails.filter((e) => !e.is_read).length
  const labels = lastEmail?.labels?.join(', ') || ''

  const countStr = count > 1 ? ` (${count})` : ''
  const unreadStr = unread > 0 ? ` [${unread} unread]` : ''
  const dateStr = lastEmail ? formatDate(lastEmail.date) : ''

  lines.push(`${thread.uuid}  ${subject}${countStr}${unreadStr}`)
  lines.push(`  From: ${from}  ${dateStr}`)
  if (labels) lines.push(`  Labels: ${labels}`)

  return lines.join('\n')
}

export async function threadListCommand(
  mailboxUuid: string,
  options: OutputOptions & { limit?: string; cursor?: string; label?: string },
): Promise<void> {
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
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)
    if (options.label) params.set('label', options.label)

    const qs = params.toString()
    const path = `public_api/v1/mailboxes/${encodeURIComponent(mailboxUuid)}/threads${qs ? `?${qs}` : ''}`

    const response = await authedRequest<ThreadListResponse>(path)

    const data: Record<string, unknown> = {
      object: response.object,
      has_more: response.has_more,
      ...(response.next_cursor ? { next_cursor: response.next_cursor } : {}),
      data: response.data,
    }

    const textLines = response.data.map(formatThread)
    if (response.has_more && response.next_cursor) {
      textLines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
    }

    const quietValue = response.data.map((t) => t.uuid).join('\n')

    output(data, {
      ...options,
      text: textLines.length > 0 ? textLines.join('\n\n') : 'No threads found.',
      quietValue,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Mailbox '${mailboxUuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to list threads: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
