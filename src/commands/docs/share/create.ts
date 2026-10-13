import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import {
  type DocumentPublicLink,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from '../docs-shared.js'

export async function docsShareCreateCommand(ref: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    const link = await authedRequest<DocumentPublicLink>(`public_api/v1/documents/${uuid}/public_link`, {
      method: 'POST',
    })

    // The public copy is written in the background; status is 'pending' until it is ready.
    output(link as unknown as Record<string, unknown>, {
      ...options,
      text: () => `${link.url}\t(${link.status})`,
      quietValue: () => link.url,
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Create public link', notFound: 'Document not found.' })
  }
}
