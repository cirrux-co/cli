import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'

interface Mailbox {
  object: string
  uuid: string
  primary_address: string
  created_at: string
  updated_at: string
}

interface MailboxListResponse {
  object: string
  url: string
  has_more: boolean
  data: Mailbox[]
}

export async function mailboxListCommand(options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<MailboxListResponse>('public_api/v1/mailboxes')

    const data = {
      object: response.object,
      data: response.data,
    }

    const lines = response.data.map((m) => `${m.uuid}\t${m.primary_address}`)
    const quietValue = response.data.map((m) => m.uuid).join('\n')

    output(data, {
      ...options,
      text: lines.length > 0 ? lines.join('\n') : 'No mailboxes found.',
      quietValue,
    })
  } catch (error) {
    handleApiError(error, options, { action: 'List mailboxes', scope: 'email' })
  }
}
