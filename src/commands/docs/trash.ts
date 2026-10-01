import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type CirruxDocument,
  documentTitle,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'

export async function docsTrashCommand(ref: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    const document = await authedRequest<CirruxDocument>(`public_api/v1/documents/${uuid}/trash`, {
      method: 'POST',
    })

    output(document as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Moved ${documentTitle(document)} to Trash (${document.uuid})`,
      quietValue: () => document.uuid,
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Trash document', notFound: 'Document not found.' })
  }
}
