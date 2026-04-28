import { authedRequestVoid } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { ensureCreds, handleDraftError } from './draft-shared.js'

export function deletePath(uuid: string): string {
  return `public_api/v1/drafts/${encodeURIComponent(uuid)}`
}

export async function draftDeleteCommand(uuid: string, options: OutputOptions): Promise<void> {
  ensureCreds(options)

  try {
    await authedRequestVoid(deletePath(uuid), { method: 'DELETE' })

    output(
      { uuid, deleted: true },
      {
        ...options,
        text: `Deleted draft ${uuid}`,
        quietValue: uuid,
      },
    )
  } catch (error) {
    handleDraftError(error, `Failed to delete draft '${uuid}'`, options)
  }
}
