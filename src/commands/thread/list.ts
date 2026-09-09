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

interface Email {
  object: string
  uuid: string
  thread_uuid: string
  from: { name: string | null; address: string }[]
  to: { name: string | null; address: string }[]
  cc: { name: string | null; address: string }[]
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

interface ThreadListResponse {
  object: string
  url: string
  has_more: boolean
  next_cursor?: string
  data: Thread[]
}

export interface EmailAddress {
  name: string | null
  address: string
}

export function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address
}

/**
 * The single sender to attribute a message to.
 *
 * Mail with no `From:` header is rare but not exotic — an SMTP configuration
 * test is exactly the kind of thing that goes around during a migration — and
 * it reaches us as an empty array. The guard lives here, not in each caller,
 * because one such message must never be able to break a whole listing.
 */
export function formatSender(addresses: EmailAddress[] | null | undefined): string {
  const [first] = addresses ?? []
  return first ? formatAddress(first) : 'Unknown'
}

/** Every address on a header, for the detail views that show them all. */
export function formatAddresses(
  addresses: EmailAddress[] | null | undefined,
  fallback = 'Unknown',
): string {
  if (!addresses || addresses.length === 0) return fallback
  return addresses.map(formatAddress).join(', ')
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatThread(thread: Thread): string {
  const lines: string[] = []
  const lastEmail = thread.emails[thread.emails.length - 1]
  const from = formatSender(lastEmail?.from)
  const subject = lastEmail?.subject || '(no subject)'
  const count = thread.emails.length
  const unread = thread.emails.filter((e) => !e.read_at).length
  const labels = lastEmail?.labels?.join(', ') || ''

  const countStr = count > 1 ? ` (${count})` : ''
  const unreadStr = unread > 0 ? ` [${unread} unread]` : ''
  const dateStr = lastEmail ? formatDate(lastEmail.date) : ''

  lines.push(`${thread.uuid}  ${subject}${countStr}${unreadStr}`)
  lines.push(`  From: ${from}  ${dateStr}`)
  if (labels) lines.push(`  Labels: ${labels}`)

  return lines.join('\n')
}

/** Shared by `thread list` and `thread search`, which differ only in the empty message. */
export function formatThreadList(
  response: { data: Thread[]; has_more: boolean; next_cursor?: string },
  emptyMessage: string,
): string {
  if (response.data.length === 0) return emptyMessage

  const lines = response.data.map(formatThread)
  if (response.has_more && response.next_cursor) {
    lines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
  }

  return lines.join('\n\n')
}

export async function threadListCommand(
  mailboxUuid: string,
  options: OutputOptions & { limit?: string; cursor?: string; label?: string },
): Promise<void> {
  requireCredentials(options)

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

    output(data, {
      ...options,
      text: () => formatThreadList(response, 'No threads found.'),
      quietValue: () => response.data.map((t) => t.uuid).join('\n'),
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'List threads',
      scope: 'email',
      notFound: `Mailbox '${mailboxUuid}' not found.`,
    })
  }
}
