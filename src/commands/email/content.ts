import { authedRequestRaw } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'

export async function emailContentCommand(
  uuid: string,
  format: string,
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

  if (format !== 'raw' && format !== 'body') {
    outputError('Format must be "raw" or "body".', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  try {
    const { body } = await authedRequestRaw(
      `public_api/v1/email/${encodeURIComponent(uuid)}/get/${encodeURIComponent(format)}`,
    )

    process.stdout.write(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('404')) {
      outputError(`Email '${uuid}' not found or content not available.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    outputError(`Failed to fetch email content: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
