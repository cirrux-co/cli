import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { type Email, summary } from '../email/email-summary.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from './draft-shared.js'

export function sendPath(uuid: string): string {
  return `public_api/v1/drafts/${encodeURIComponent(uuid)}/send`
}

export async function draftSendCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const email = await authedRequest<Email>(sendPath(uuid), { method: 'POST' })

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: summary(email, 'Sent draft'),
      quietValue: email.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Send draft',
      scope: 'email',
      notFound: `Draft '${uuid}' not found.`,
    })
  }
}
