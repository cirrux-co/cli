import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'
import { type Email, summary } from './email-summary.js'

type UpdateBody = { read_at: string | null } | { flagged_at: string | null }

async function updateEmail(
  uuid: string,
  body: UpdateBody,
  options: OutputOptions,
  successText: (email: Email) => string,
): Promise<void> {
  requireCredentials(options)

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
    handleApiError(error, options, {
      action: 'Update email',
      scope: 'email',
      notFound: `Email '${uuid}' not found.`,
    })
  }
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
