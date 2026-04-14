import { apiRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'

interface Mailbox {
  object: string
  uuid: string
  address: string
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
    const response = await apiRequest<MailboxListResponse>('public_api/v1/mailboxes', {
      token: creds.access_token,
    })

    const data = {
      object: response.object,
      data: response.data,
    }

    const lines = response.data.map((m) => `${m.uuid}\t${m.address}`)
    const quietValue = response.data.map((m) => m.uuid).join('\n')

    output(data, {
      ...options,
      text: lines.length > 0 ? lines.join('\n') : 'No mailboxes found.',
      quietValue,
    })
  } catch (error) {
    outputError(`Failed to list mailboxes: ${error instanceof Error ? error.message : error}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
