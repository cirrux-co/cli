import { authedRequestVoid } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { output, type OutputOptions } from '../../output.js'
import { requireCredentials } from './draft-shared.js'

export function deletePath(uuid: string): string {
  return `public_api/v1/drafts/${encodeURIComponent(uuid)}`
}

export async function draftDeleteCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    await authedRequestVoid(deletePath(uuid), { method: 'DELETE' })

    output(
      { uuid, deleted: true },
      {
        ...options,
        text: () => `Deleted draft ${uuid}`,
        quietValue: () => uuid,
      },
    )
  } catch (error) {
    handleApiError(error, options, {
      action: 'Delete draft',
      scope: 'email',
      notFound: `Draft '${uuid}' not found.`,
    })
  }
}
