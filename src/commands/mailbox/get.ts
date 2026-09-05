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

export async function mailboxGetCommand(id: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const mailbox = await authedRequest<Mailbox>(`public_api/v1/mailboxes/${encodeURIComponent(id)}`)

    const lines = [
      `UUID:            ${mailbox.uuid}`,
      `Primary address: ${mailbox.primary_address}`,
      `Created at:      ${mailbox.created_at}`,
      `Updated at:      ${mailbox.updated_at}`,
    ]

    output(mailbox as unknown as Record<string, unknown>, {
      ...options,
      text: lines.join('\n'),
      quietValue: mailbox.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Fetch mailbox',
      scope: 'email',
      notFound: `Mailbox '${id}' not found.`,
    })
  }
}
