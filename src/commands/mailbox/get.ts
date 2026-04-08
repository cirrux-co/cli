import { apiRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'

interface Mailbox {
  object: string
  id: string
  address: string
  created_at: string
  updated_at: string
}

export async function mailboxGetCommand(id: string, options: OutputOptions): Promise<void> {
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
    const mailbox = await apiRequest<Mailbox>(`public_api/v1/mailboxes/${encodeURIComponent(id)}`, {
      token: creds.access_token,
    })

    const lines = [
      `ID:         ${mailbox.id}`,
      `Address:    ${mailbox.address}`,
      `Created at: ${mailbox.created_at}`,
      `Updated at: ${mailbox.updated_at}`,
    ]

    output(mailbox as unknown as Record<string, unknown>, {
      ...options,
      text: lines.join('\n'),
      quietValue: mailbox.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Mailbox '${id}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to fetch mailbox: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
