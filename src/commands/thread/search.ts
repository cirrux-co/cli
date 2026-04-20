import { authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { formatThread } from './list.js'

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

interface ThreadSearchResponse {
  object: string
  url: string
  query: string
  has_more: boolean
  next_cursor?: string
  data: Thread[]
}

export async function threadSearchCommand(
  query: string,
  options: OutputOptions & { mailboxUuid?: string; limit?: string; cursor?: string },
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
    params.set('q', query)
    if (options.mailboxUuid) params.set('mailbox_uuid', options.mailboxUuid)
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)

    const path = `public_api/v1/search/threads?${params.toString()}`

    const response = await authedRequest<ThreadSearchResponse>(path)

    const data: Record<string, unknown> = {
      object: response.object,
      query: response.query,
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
      text: textLines.length > 0 ? textLines.join('\n\n') : 'No threads matched the query.',
      quietValue,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('422')) {
      outputError(`Invalid query: ${message}`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'invalid_query',
      })
    }

    if (message.includes('404')) {
      outputError(`Mailbox not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to search threads: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
