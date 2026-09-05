import { authedRequestRaw } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'

export async function emailContentCommand(
  uuid: string,
  format: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  if (format !== 'raw' && format !== 'body') {
    outputError('Format must be "raw" or "body".', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  try {
    const { body } = await authedRequestRaw(
      `public_api/v1/emails/${encodeURIComponent(uuid)}/get/${encodeURIComponent(format)}`,
    )

    process.stdout.write(body)
  } catch (error) {
    handleApiError(error, options, {
      action: 'Fetch email content',
      scope: 'email',
      notFound: `Email '${uuid}' not found or content not available.`,
    })
  }
}
