import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { SEARCH_ERROR_RULES } from '../search-shared.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'
import { formatAddress, formatDate } from '../thread/list.js'

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

interface EmailSearchResponse {
  object: string
  url: string
  query: string
  has_more: boolean
  next_cursor?: string
  data: Email[]
}

export function formatEmailSummary(email: Email): string {
  const from = email.from?.[0] ? formatAddress(email.from[0]) : 'Unknown'
  const subject = email.subject || '(no subject)'
  const date = formatDate(email.date)
  const attachments = email.attachments?.length ? `  [${email.attachments.length} attachment${email.attachments.length === 1 ? '' : 's'}]` : ''
  const unread = email.read_at ? '' : '  [unread]'

  const lines = [
    `${email.uuid}  ${subject}${unread}${attachments}`,
    `  From: ${from}  ${date}`,
  ]
  if (email.snippet) lines.push(`  ${email.snippet}`)
  return lines.join('\n')
}

export async function emailSearchCommand(
  query: string,
  options: OutputOptions & { mailboxUuid?: string; limit?: string; cursor?: string },
): Promise<void> {
  requireCredentials(options)

  try {
    const params = new URLSearchParams()
    params.set('q', query)
    if (options.mailboxUuid) params.set('mailbox_uuid', options.mailboxUuid)
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)

    const path = `public_api/v1/search/emails?${params.toString()}`

    const response = await authedRequest<EmailSearchResponse>(path)

    const data: Record<string, unknown> = {
      object: response.object,
      query: response.query,
      has_more: response.has_more,
      ...(response.next_cursor ? { next_cursor: response.next_cursor } : {}),
      data: response.data,
    }

    const textLines = response.data.map(formatEmailSummary)
    if (response.has_more && response.next_cursor) {
      textLines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
    }

    const quietValue = response.data.map((e) => e.uuid).join('\n')

    output(data, {
      ...options,
      text: textLines.length > 0 ? textLines.join('\n\n') : 'No emails matched the query.',
      quietValue,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Search emails',
      scope: 'email',
      notFound: 'Mailbox not found.',
      rules: SEARCH_ERROR_RULES,
    })
  }
}
