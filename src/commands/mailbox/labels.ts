import { authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'

interface Label {
  object: string
  uuid: string
  name: string
  type: string
  color: string | null
  description: string | null
  is_visible: boolean
  position: number
}

interface MailboxLabelsResponse {
  object: string
  url: string
  has_more: boolean
  data: Label[]
}

export async function mailboxLabelsListCommand(
  mailboxUuid: string,
  options: OutputOptions,
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
    const response = await authedRequest<MailboxLabelsResponse>(
      `public_api/v1/mailboxes/${encodeURIComponent(mailboxUuid)}/labels`,
    )

    const data = {
      object: response.object,
      data: response.data,
    }

    const lines = response.data.map((l) => `${l.uuid}\t${l.type}\t${l.name}`)
    const quietValue = response.data.map((l) => l.uuid).join('\n')

    output(data, {
      ...options,
      text: lines.length > 0 ? lines.join('\n') : 'No labels found.',
      quietValue,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Mailbox '${mailboxUuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to list labels: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
