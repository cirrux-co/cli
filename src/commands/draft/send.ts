import { authedRequest } from '../../api.js'
import { type Email, summary } from '../email/email-summary.js'
import { output, type OutputOptions } from '../../output.js'
import { ensureCreds, handleDraftError } from './draft-shared.js'

export function sendPath(uuid: string): string {
  return `public_api/v1/drafts/${encodeURIComponent(uuid)}/send`
}

export async function draftSendCommand(uuid: string, options: OutputOptions): Promise<void> {
  ensureCreds(options)

  try {
    const email = await authedRequest<Email>(sendPath(uuid), { method: 'POST' })

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: summary(email, 'Sent draft'),
      quietValue: email.uuid,
    })
  } catch (error) {
    handleDraftError(error, `Failed to send draft '${uuid}'`, options)
  }
}
