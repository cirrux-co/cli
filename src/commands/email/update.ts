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
  read_at: string | null
  flagged_at: string | null
  date: string
  labels: string[]
  attachments: EmailAttachment[]
}

type UpdateBody = { read_at: string | null } | { flagged_at: string | null }

async function updateEmail(
  uuid: string,
  body: UpdateBody,
  options: OutputOptions,
  successText: (email: Email) => string,
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
    const email = await authedRequest<Email>(
      `public_api/v1/emails/${encodeURIComponent(uuid)}`,
      { method: 'POST', body: body as unknown as Record<string, unknown> },
    )

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: successText(email),
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

    outputError(`Failed to update email: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}

function summary(email: Email, action: string): string {
  const from = email.from?.map(formatAddress).join(', ') ?? 'Unknown'
  const subject = email.subject || '(no subject)'
  return `${action} ${email.uuid}\n  ${subject}\n  From: ${from}`
}

export async function emailReadCommand(uuid: string, options: OutputOptions): Promise<void> {
  await updateEmail(
    uuid,
    { read_at: new Date().toISOString() },
    options,
    (email) => summary(email, 'Marked as read:'),
  )
}

export async function emailUnreadCommand(uuid: string, options: OutputOptions): Promise<void> {
  await updateEmail(
    uuid,
    { read_at: null },
    options,
    (email) => summary(email, 'Marked as unread:'),
  )
}

export async function emailFlagCommand(uuid: string, options: OutputOptions): Promise<void> {
  await updateEmail(
    uuid,
    { flagged_at: new Date().toISOString() },
    options,
    (email) => summary(email, 'Flagged:'),
  )
}

export async function emailUnflagCommand(uuid: string, options: OutputOptions): Promise<void> {
  await updateEmail(
    uuid,
    { flagged_at: null },
    options,
    (email) => summary(email, 'Unflagged:'),
  )
}
