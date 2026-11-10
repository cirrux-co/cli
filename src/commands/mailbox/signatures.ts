import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'

export interface Signature {
  object: string
  uuid: string
  mailbox_uuid: string
  name: string
  mode: 'rich' | 'html'
  is_default: boolean
  position: number
  html: string
  created_at: string
  updated_at: string | null
}

interface MailboxSignaturesResponse {
  object: string
  url: string
  has_more: boolean
  data: Signature[]
}

export function signaturesPath(mailboxUuid: string): string {
  return `public_api/v1/mailboxes/${encodeURIComponent(mailboxUuid)}/signatures`
}

/** Pure: one tab-separated line per signature, the default marked. */
export function signatureLines(signatures: Signature[]): string {
  if (signatures.length === 0) return 'No signatures found.'

  return signatures.map((s) => `${s.uuid}\t${s.is_default ? 'default' : '-'}\t${s.mode}\t${s.name}`).join('\n')
}

export async function mailboxSignaturesListCommand(mailboxUuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<MailboxSignaturesResponse>(signaturesPath(mailboxUuid))

    output(
      { object: response.object, data: response.data },
      {
        ...options,
        text: () => signatureLines(response.data),
        quietValue: () => response.data.map((s) => s.uuid).join('\n'),
      },
    )
  } catch (error) {
    handleApiError(error, options, {
      action: 'List signatures',
      notFound: `Mailbox '${mailboxUuid}' not found.`,
      scope: 'email',
    })
  }
}
