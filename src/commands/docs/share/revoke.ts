import { authedRequestVoid } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { handleDocsError, requireCredentials, resolveDocumentRef } from '../docs-shared.js'

export async function docsShareRevokeCommand(ref: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    await authedRequestVoid(`public_api/v1/documents/${uuid}/public_link`, { method: 'DELETE' })

    output({ uuid, revoked: true }, {
      ...options,
      text: () => `Revoked public link for ${uuid}`,
      quietValue: () => uuid,
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Revoke public link', notFound: `No public link exists for '${uuid}'.` })
  }
}
